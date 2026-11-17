// ═══════════════════════════════════════════════════════════════════════════
//  razorpay-webhook — authoritative subscription/payment state from Razorpay
//
//  Configure in Razorpay Dashboard → Settings → Webhooks:
//    URL:    https://<project>.supabase.co/functions/v1/razorpay-webhook
//    Secret: same value as the RAZORPAY_WEBHOOK_SECRET function secret
//    Events: subscription.* , payment.failed , invoice.paid
//  Deploy with --no-verify-jwt (Razorpay can't send a Supabase JWT; the
//  X-Razorpay-Signature HMAC is the authentication).
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
const SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const toIso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);

async function notifyOwner(orgId: string, title: string, body: string) {
  const org = (await sb.from("organizations").select("owner_uid").eq("id", orgId).maybeSingle()).data;
  if (!org?.owner_uid) return;
  await sb.from("app_notifications").insert({ id: crypto.randomUUID(), org_id: orgId, user_id: org.owner_uid, title, body, type: "billing", related_id: orgId, related_type: "organization", is_read: {} });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!SECRET) return new Response("Webhook secret not configured", { status: 500 });
  const expected = await hmacHex(SECRET, raw);
  let diff = signature.length ^ expected.length;
  for (let i = 0; i < Math.min(signature.length, expected.length); i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) {
    return new Response("Invalid signature", { status: 401 });
  }

  const evt = JSON.parse(raw);
  const eventId = req.headers.get("x-razorpay-event-id") ?? `${evt.event}:${evt.created_at}:${evt.payload?.payment?.entity?.id ?? evt.payload?.subscription?.entity?.id}`;
  const rzSub = evt.payload?.subscription?.entity;
  const rzPay = evt.payload?.payment?.entity;

  // Idempotency: Razorpay retries; process each event once.
  const { error: dupErr } = await sb.from("billing_events").insert({ id: eventId, event_type: evt.event, payload: evt, org_id: rzSub?.notes?.org_id ?? rzPay?.notes?.org_id ?? null });
  if (dupErr) {
    if (dupErr.code === "23505") return new Response("duplicate", { status: 200 });
    return new Response(dupErr.message, { status: 500 });
  }

  try {
    const subRow = rzSub?.id
      ? (await sb.from("subscriptions").select("*").eq("provider_subscription_id", rzSub.id).maybeSingle()).data
      : rzPay?.subscription_id
        ? (await sb.from("subscriptions").select("*").eq("provider_subscription_id", rzPay.subscription_id).maybeSingle()).data
        : null;

    if (subRow && rzSub) {
      await sb.from("subscriptions").update({
        status: rzSub.status, current_period_start: toIso(rzSub.current_start), current_period_end: toIso(rzSub.current_end),
        provider_customer_id: rzSub.customer_id ?? subRow.provider_customer_id,
        ...(rzSub.status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", subRow.id);
    }

    const orgId = subRow?.org_id;
    const now = new Date().toISOString();
    switch (evt.event) {
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.resumed":
        if (orgId) {
          await sb.from("organizations").update({ status: "active", plan_id: subRow.plan_id, billing_cycle: subRow.billing_cycle, current_period_end: toIso(rzSub?.current_end), updated_at: now }).eq("id", orgId);
        }
        if (orgId && rzPay?.id && evt.event === "subscription.charged") {
          const exists = (await sb.from("payments").select("id").eq("provider_payment_id", rzPay.id).maybeSingle()).data;
          if (!exists) {
            const tax = (await sb.from("platform_settings").select("value").eq("key", "tax").maybeSingle()).data?.value ?? {};
            const gst = Number(tax.gst_percent ?? 18);
            const taxAmount = tax.prices_include_tax === false ? Math.round(rzPay.amount * gst / 100) : Math.round(rzPay.amount - rzPay.amount / (1 + gst / 100));
            const org = (await sb.from("organizations").select("name,address,tax_id,owner_email").eq("id", orgId).single()).data;
            await sb.from("payments").insert({
              org_id: orgId, subscription_id: subRow.id, provider_payment_id: rzPay.id, provider_invoice_id: rzPay.invoice_id ?? null,
              amount: rzPay.amount, tax_amount: taxAmount, currency: rzPay.currency, status: "paid", plan_id: subRow.plan_id,
              description: `Task Pilot ${subRow.plan_id} (${subRow.billing_cycle})`, period_start: toIso(rzSub?.current_start), period_end: toIso(rzSub?.current_end),
              paid_at: toIso(rzPay.created_at) ?? now, billing_details: { name: org?.name, address: org?.address, tax_id: org?.tax_id, email: org?.owner_email, method: rzPay.method },
            });
          }
          await notifyOwner(orgId, "Payment received", `Thank you — your Task Pilot subscription has been renewed.`);
        }
        break;
      case "subscription.pending":
        if (orgId) {
          await sb.from("organizations").update({ status: "past_due", updated_at: now }).eq("id", orgId);
          await notifyOwner(orgId, "Payment failed", "We couldn't charge your payment method. Razorpay will retry — please check your card/UPI mandate.");
        }
        break;
      case "subscription.halted":
        if (orgId) {
          await sb.from("organizations").update({ status: "past_due", updated_at: now }).eq("id", orgId);
          await notifyOwner(orgId, "Subscription on hold", "All retries failed. Update your payment method in Settings → Billing to avoid suspension.");
        }
        break;
      case "subscription.cancelled":
      case "subscription.completed":
        if (orgId) {
          const end = toIso(rzSub?.current_end);
          const stillPaid = end && new Date(end) > new Date();
          await sb.from("organizations").update({ status: stillPaid ? "active" : "cancelled", current_period_end: end, updated_at: now }).eq("id", orgId);
          await notifyOwner(orgId, "Subscription cancelled", stillPaid ? `Your workspace stays active until ${end!.slice(0, 10)}.` : "Your workspace is now read-only. Re-subscribe any time to continue.");
        }
        break;
      case "subscription.paused":
        if (orgId) await sb.from("organizations").update({ status: "suspended", updated_at: now }).eq("id", orgId);
        break;
      case "payment.failed":
        if (orgId) await notifyOwner(orgId, "Payment attempt failed", rzPay?.error_description ?? "Your payment could not be completed.");
        break;
    }
    await sb.from("billing_events").update({ processed_at: now, org_id: orgId ?? null }).eq("id", eventId);
    return new Response("ok", { status: 200 });
  } catch (e) {
    await sb.from("billing_events").update({ error: (e as Error).message }).eq("id", eventId);
    // 500 → Razorpay retries; delete the idempotency row so the retry is processed.
    await sb.from("billing_events").delete().eq("id", eventId).is("processed_at", null);
    return new Response("error", { status: 500 });
  }
});
