import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard, Download, Loader2, AlertTriangle, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { saasApi, loadRazorpay } from '../../lib/saasApi';
import { useTenantStore, formatMoney, trialDaysLeft, Plan, OrgContext } from '../../lib/tenant';
import { PricingCards } from './marketing/PricingPage';
import { useAuthStore } from '../../store/authStore';

const STATUS: Record<string, [string, string]> = {
  trialing: ['Free trial', 'bg-indigo-50 text-indigo-700'],
  active: ['Active', 'bg-emerald-50 text-emerald-700'],
  past_due: ['Payment overdue', 'bg-amber-50 text-amber-800'],
  suspended: ['Suspended', 'bg-red-50 text-red-700'],
  cancelled: ['Cancelled', 'bg-slate-100 text-slate-700'],
  expired: ['Trial ended', 'bg-red-50 text-red-700'],
};

const Meter: React.FC<{ label: string; used: number; max: number | null }> = ({ label, used, max }) => {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold">{used}{max !== null ? ` / ${max}` : ' · unlimited'}</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-slate-900'}`} style={{ width: max ? `${pct}%` : '4%' }} />
      </div>
    </div>
  );
};

async function refreshContext() {
  const ctx = await saasApi<OrgContext>('org_context');
  useTenantStore.getState().setContext(ctx);
  return ctx;
}

const BillingPage: React.FC = () => {
  const ctx = useTenantStore((s) => s.context);
  const { appUser } = useAuthStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[] | null>(null);

  useEffect(() => {
    refreshContext().catch(() => {});
    saasApi<{ payments: any[] }>('list_payments').then((r) => setPayments(r.payments)).catch(() => setPayments([]));
  }, []);

  if (!ctx) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const { org, plan, subscription, usage, limits } = ctx;
  if (org.is_legacy) {
    return <div className="p-6 max-w-3xl"><h1 className="text-xl font-bold">Plan & Billing</h1><p className="text-slate-600 mt-2">{org.name} is on a custom agreement with every module enabled. Contact Task Pilot support for billing questions.</p></div>;
  }

  const checkout = async (p: Plan, cycle: 'monthly' | 'yearly') => {
    setBusy(p.id);
    try {
      const r = await saasApi<any>('create_subscription', { planId: p.id, billingCycle: cycle });
      if (r.changed) {
        toast.success(r.effective === 'now' ? `Upgraded to ${p.name}` : `${p.name} will start at your next renewal`);
        await refreshContext();
        return;
      }
      await loadRazorpay();
      const rzp = new (window as any).Razorpay({
        key: r.keyId,
        subscription_id: r.subscriptionId,
        name: 'Task Pilot',
        description: `${r.planName} plan (${cycle})`,
        image: `${window.location.origin}/logo.png`,
        prefill: { email: r.email, name: appUser?.name, contact: org.phone ?? undefined },
        notes: { org_id: org.id },
        theme: { color: '#0F172A' },
        handler: async (resp: any) => {
          try {
            await saasApi('verify_payment', resp);
            toast.success('Subscription activated — thank you!');
            await refreshContext();
            saasApi<{ payments: any[] }>('list_payments').then((x) => setPayments(x.payments));
          } catch (e: any) {
            toast.error(`Payment received but verification failed: ${e.message}. It will sync automatically within minutes.`);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.on('payment.failed', (resp: any) => toast.error(resp?.error?.description ?? 'Payment failed'));
      rzp.open();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel your subscription? Your workspace stays active until the end of the current billing period, then becomes read-only. Your data is kept.')) return;
    setBusy('cancel');
    try {
      await saasApi('cancel_subscription', {});
      toast.success('Subscription will end at the close of this billing period');
      await refreshContext();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const [statusLabel, statusClass] = STATUS[org.status] ?? [org.status, 'bg-slate-100'];
  const days = trialDaysLeft(org);
  const live = subscription && ['active', 'authenticated'].includes(subscription.status);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">{plan?.name ?? 'No plan'} plan</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
            {subscription?.cancel_at_period_end && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100">Cancels at period end</span>}
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {org.status === 'trialing' && days !== null && `Trial ends ${new Date(org.trial_ends_at!).toLocaleDateString()} (${days} day${days === 1 ? '' : 's'} left). `}
            {live && subscription?.current_period_end && `Renews ${new Date(subscription.current_period_end).toLocaleDateString()} · billed ${subscription.billing_cycle}. `}
            {live && subscription?.status === 'authenticated' && 'Payment mandate set up — first charge at trial end. '}
            {plan && !plan.is_custom_pricing && `${formatMoney(org.billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly, plan.currency)} / ${org.billing_cycle === 'yearly' ? 'year' : 'month'} incl. GST.`}
          </p>
          {org.status === 'past_due' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg p-3"><AlertTriangle className="w-4 h-4" />Your last payment failed. Razorpay retries automatically; to change your card or UPI, choose your plan again below.</p>
          )}
          <div className="mt-5 grid sm:grid-cols-2 gap-5">
            <Meter label="Team members" used={usage.users + usage.pending_invites} max={limits.max_users} />
            <Meter label="Projects" used={usage.projects} max={limits.max_projects} />
          </div>
          {live && !subscription?.cancel_at_period_end && (
            <button onClick={cancel} disabled={busy === 'cancel'} className="mt-6 text-sm text-red-600 font-medium hover:underline disabled:opacity-50">Cancel subscription</button>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4" />Payments</h2>
          <p className="text-sm text-slate-600 mt-2">Billed securely by Razorpay — UPI AutoPay, cards and netbanking e-mandate. Prices include GST.</p>
          {!ctx.razorpayKeyId && <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5">Online checkout isn't enabled yet. <Link to="/app/support" className="underline font-semibold">Contact support</Link> to activate a plan.</p>}
        </section>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-4">{live ? 'Change plan' : 'Choose a plan'}</h2>
        <PricingCards onSelect={checkout} currentPlanId={live ? plan?.id : null} busyPlanId={busy} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <h2 className="font-bold p-5 border-b border-slate-100">Invoices</h2>
        {payments === null ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : payments.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3 font-medium">Invoice</th><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Description</th><th className="p-3 font-medium text-right">Amount</th><th className="p-3 font-medium">Status</th><th className="p-3" /></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono text-xs">{p.invoice_number}</td>
                    <td className="p-3">{new Date(p.paid_at ?? p.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{p.description}</td>
                    <td className="p-3 text-right font-semibold">{formatMoney(p.amount, p.currency)}</td>
                    <td className="p-3 capitalize">{p.status}</td>
                    <td className="p-3 text-right"><Link to={`/app/billing/invoice/${p.id}`} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium"><Download className="w-3.5 h-3.5" />View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export const InvoicePage: React.FC = () => {
  const { id } = useParams();
  const ctx = useTenantStore((s) => s.context);
  const [data, setData] = useState<{ payments: any[]; seller: any } | null>(null);
  useEffect(() => { saasApi<{ payments: any[]; seller: any }>('list_payments').then(setData).catch((e) => toast.error(e.message)); }, []);
  const p = data?.payments.find((x) => x.id === id);
  if (!data) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!p) return <div className="p-6">Invoice not found.</div>;
  const net = p.amount - p.tax_amount;
  const half = Math.round(p.tax_amount / 2);
  const b = p.billing_details ?? {};
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-3xl mx-auto flex justify-end mb-3 print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold"><Printer className="w-4 h-4" />Print / Save PDF</button>
      </div>
      <article className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 print:border-0 print:p-0">
        <header className="flex justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg"><img src="/logo.png" alt="" className="w-8 h-8 rounded" />{data.seller.seller_name || 'Task Pilot'}</div>
            {data.seller.seller_gstin && <p className="text-xs text-slate-500 mt-1">GSTIN {data.seller.seller_gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight">Tax Invoice</p>
            <p className="text-sm font-mono mt-1">{p.invoice_number}</p>
            <p className="text-sm text-slate-500">{new Date(p.paid_at ?? p.created_at).toLocaleDateString()}</p>
          </div>
        </header>
        <section className="mt-8 text-sm">
          <p className="text-slate-500">Billed to</p>
          <p className="font-semibold">{b.name ?? ctx?.org.name}</p>
          {b.address && <p className="whitespace-pre-line">{b.address}</p>}
          {b.tax_id && <p>GSTIN {b.tax_id}</p>}
          {b.email && <p>{b.email}</p>}
        </section>
        <table className="w-full mt-8 text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500"><tr><th className="py-2 font-medium">Description</th><th className="py-2 font-medium text-right">Amount</th></tr></thead>
          <tbody>
            <tr className="border-b border-slate-100"><td className="py-3">{p.description}{p.period_start && <span className="block text-xs text-slate-500">{new Date(p.period_start).toLocaleDateString()} – {p.period_end ? new Date(p.period_end).toLocaleDateString() : ''}</span>}</td><td className="py-3 text-right">{formatMoney(net, p.currency)}</td></tr>
            <tr><td className="py-1.5 text-right text-slate-500">CGST</td><td className="py-1.5 text-right">{formatMoney(half, p.currency)}</td></tr>
            <tr><td className="py-1.5 text-right text-slate-500">SGST</td><td className="py-1.5 text-right">{formatMoney(p.tax_amount - half, p.currency)}</td></tr>
            <tr className="border-t border-slate-200 font-bold"><td className="py-3 text-right">Total paid</td><td className="py-3 text-right">{formatMoney(p.amount, p.currency)}</td></tr>
          </tbody>
        </table>
        <p className="mt-8 text-xs text-slate-500">Paid via Razorpay{b.method ? ` (${b.method})` : ''} · Payment ID {p.provider_payment_id}. For inter-state supply, IGST applies in place of CGST + SGST.</p>
      </article>
    </div>
  );
};

export default BillingPage;
