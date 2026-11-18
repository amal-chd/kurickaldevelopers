// ═══════════════════════════════════════════════════════════════════════════
//  saas-api — Task Pilot multi-tenant control plane
//
//  Every call: POST { action, ...params } with `Authorization: Bearer <Firebase
//  ID token>` (except the few PUBLIC_ACTIONS). The token is verified with the
//  Firebase Admin SDK; all DB access uses the service role, so authorisation
//  is enforced HERE, per action:
//    • tenant actions  → caller must be an active member of the org
//    • org-admin       → member whose role has settings_manage / team_manage
//    • platform admin  → verified email listed in public.platform_admins
//
//  Secrets (supabase secrets set …):
//    FIREBASE_SERVICE_ACCOUNT, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//    APP_URL (e.g. https://taskpilot.app)
//  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import admin from "npm:firebase-admin@11.10.1";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-org-id, apikey, x-client-info",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const RZP_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RZP_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
// Base URL for links we hand out (invitations). APP_URL wins when set;
// otherwise use the https origin the admin is working on, so links always
// point at the domain the product is actually served from.
const APP_URL_ENV = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
function appUrl(req: Request): string {
  if (APP_URL_ENV) return APP_URL_ENV;
  const origin = req.headers.get("origin") ?? "";
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return origin;
  return "https://kurickaldevelopers.vercel.app";
}

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ─── Firebase admin ────────────────────────────────────────────────────────
let fbApp: admin.app.App | null = null;
function firebase(): admin.app.App {
  if (fbApp) return fbApp;
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) throw new HttpError(500, "FIREBASE_SERVICE_ACCOUNT not configured");
  const sa = JSON.parse(raw);
  if (typeof sa.private_key === "string") sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  fbApp = admin.initializeApp({ credential: admin.credential.cert(sa) }, "saas-api");
  return fbApp;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
// Awaits a PostgREST query and throws on error. Typed loosely on purpose:
// list queries never return null data without an error; single-row
// lookups (.maybeSingle) are null-checked by the caller.
// deno-lint-ignore no-explicit-any
async function q<T = any>(p: PromiseLike<{ data: unknown; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new HttpError(500, error.message);
  return data as T;
}
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";

async function audit(actor: Caller | null, action: string, target_type: string, target_id: string | null, org_id: string | null, details: Record<string, unknown> = {}) {
  try {
    await sb.from("platform_audit_logs").insert({
      actor_uid: actor?.uid ?? null, actor_email: actor?.email ?? null,
      action, target_type, target_id, org_id, details,
    });
  } catch (_) { /* never block on audit */ }
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function razorpay(path: string, method = "GET", body?: unknown) {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    throw new HttpError(503, "Online payments are not configured yet. Please contact support to activate your plan.", "PAYMENTS_NOT_CONFIGURED");
  }
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: "Basic " + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, data?.error?.description ?? `Razorpay error ${res.status}`);
  return data;
}

// ─── Default role templates for a new tenant ───────────────────────────────
const ALL = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));
const PERMS_FULL = [
  "tasks_view","tasks_view_all","tasks_create","tasks_edit","tasks_delete","tasks_approve",
  "projects_view","projects_view_all","projects_create","projects_edit","projects_delete",
  "docs_view","docs_view_all","docs_upload","docs_approve","team_view","team_manage","team_delete",
  "reports_view","reports_export","time_log","time_view_all","roles_manage","settings_manage",
  "notifications_manage","chat_view","chat_send","chat_create_group","chat_announce","chat_moderate",
  "attendance_view_all","contact_view","contact_manage","performance_view","performance_manage",
  "assets_view","assets_manage","leave_manage","salary_manage","expenses_manage","expenses_approve",
];
const ROLE_TEMPLATES = [
  { key: "owner", name: "Owner / Director", color: "#1A3A5C", level: 100, description: "Full access to the workspace, billing and settings", perms: ALL(PERMS_FULL) },
  { key: "admin", name: "Admin", color: "#9C27B0", level: 90, description: "Team, roles and settings", perms: { ...ALL(PERMS_FULL), projects_delete: false, chat_announce: false } },
  { key: "project_manager", name: "Project Manager", color: "#2196F3", level: 80, description: "Projects, tasks and assignments",
    perms: ALL(["tasks_view","tasks_view_all","tasks_create","tasks_edit","tasks_approve","projects_view","projects_view_all","projects_create","projects_edit","docs_view","docs_view_all","docs_upload","docs_approve","team_view","reports_view","reports_export","time_log","time_view_all","chat_view","chat_send","chat_create_group","attendance_view_all","performance_view","assets_view","expenses_approve"]) },
  { key: "site_engineer", name: "Site Engineer", color: "#009688", level: 60, description: "Field tasks, site diary, documents",
    perms: ALL(["tasks_view","tasks_create","tasks_edit","projects_view","docs_view","docs_upload","team_view","reports_view","time_log","chat_view","chat_send","assets_view"]) },
  { key: "accounts", name: "Accounts", color: "#4CAF50", level: 50, description: "Finance, expenses, salary and reports",
    perms: ALL(["tasks_view","tasks_view_all","projects_view","projects_view_all","docs_view","docs_view_all","docs_upload","team_view","reports_view","reports_export","time_view_all","chat_view","chat_send","attendance_view_all","salary_manage","expenses_manage","expenses_approve"]) },
  { key: "supervisor", name: "Supervisor / Foreman", color: "#F59E0B", level: 40, description: "Crew supervision, attendance and task updates",
    perms: ALL(["tasks_view","tasks_edit","projects_view","docs_view","team_view","time_log","chat_view","chat_send"]) },
  { key: "worker", name: "Worker", color: "#9E9E9E", level: 20, description: "Attendance and assigned tasks",
    perms: ALL(["tasks_view","team_view","time_log","chat_view","chat_send"]) },
  { key: "client", name: "Client (view only)", color: "#64748B", level: 10, description: "Read-only project visibility for clients",
    perms: ALL(["tasks_view","projects_view","docs_view","chat_view","chat_send"]) },
];

// ─── Caller resolution ─────────────────────────────────────────────────────
interface Caller { uid: string; email: string; emailVerified: boolean; name: string; signInProvider: string }
interface Membership { org_id: string; role_id: string | null; is_owner: boolean; status: string }

async function getCaller(req: Request): Promise<Caller> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in required");
  try {
    const d = await firebase().auth().verifyIdToken(token);
    return {
      uid: d.uid, email: (d.email ?? "").toLowerCase(), emailVerified: !!d.email_verified,
      name: (d as any).name ?? "", signInProvider: d.firebase?.sign_in_provider ?? "",
    };
  } catch {
    throw new HttpError(401, "Session expired — please sign in again");
  }
}

async function platformRole(c: Caller): Promise<string | null> {
  if (!c.email) return null;
  const row = await q(sb.from("platform_admins").select("role, uid").eq("email", c.email).maybeSingle());
  if (!row) return null;
  // Email must be proven (verified address, Google sign-in, or designated platform admin)
  const isBootstrapAdmin = c.email === "admin@taskpilot.app" || c.email === "thekadaapp@gmail.com";
  if (!isBootstrapAdmin && !c.emailVerified && c.signInProvider !== "google.com") return null;
  if (!row.uid) await sb.from("platform_admins").update({ uid: c.uid }).eq("email", c.email);
  else if (row.uid !== c.uid) return null; // address re-registered by someone else
  return row.role;
}
async function requirePlatform(c: Caller, roles: string[] = ["owner", "admin", "support", "finance"]) {
  const r = await platformRole(c);
  if (!r || !roles.includes(r)) throw new HttpError(403, "Platform administrator access required");
  return r;
}

async function membership(c: Caller, orgId?: string): Promise<Membership | null> {
  let qb = sb.from("org_members").select("org_id, role_id, is_owner, status").eq("user_uid", c.uid).eq("status", "active");
  if (orgId) qb = qb.eq("org_id", orgId);
  const rows = await q<Membership[]>(qb.order("created_at").limit(1));
  if (rows.length) return rows[0];
  // Legacy users (pre-SaaS) have no membership row yet — derive from Firestore.
  const snap = await firebase().firestore().collection("users").doc(c.uid).get();
  if (!snap.exists) return null;
  const u = snap.data() ?? {};
  const legacyOrg = u.orgId ?? "main";
  if (orgId && orgId !== legacyOrg) return null;
  if (u.isActive === false) return null;
  await sb.from("org_members").upsert({ org_id: legacyOrg, user_uid: c.uid, email: c.email, name: u.name ?? null, role_id: u.roleId ?? null, status: "active" }, { onConflict: "org_id,user_uid" });
  return { org_id: legacyOrg, role_id: u.roleId ?? null, is_owner: false, status: "active" };
}
async function requireMember(c: Caller, orgId?: string) {
  const m = await membership(c, orgId);
  if (!m) throw new HttpError(403, "You are not a member of this workspace");
  return m;
}
async function rolePerms(roleId: string | null): Promise<{ level: number; perms: Record<string, boolean> }> {
  if (!roleId) return { level: 0, perms: {} };
  const r = await q(sb.from("roles").select("level, permissions").eq("id", roleId).maybeSingle());
  return { level: r?.level ?? 0, perms: r?.permissions ?? {} };
}
async function requireOrgAdmin(c: Caller, orgId?: string, perm: "settings_manage" | "team_manage" = "settings_manage") {
  const m = await requireMember(c, orgId);
  if (m.is_owner) return m;
  const { level, perms } = await rolePerms(m.role_id);
  if (level >= 100 || perms[perm] === true || perms.roles_manage === true) return m;
  throw new HttpError(403, "Only workspace administrators can do this");
}

// ─── Org context (plan, usage, features) ───────────────────────────────────
async function orgContext(orgId: string) {
  const org = await q(sb.from("organizations").select("*").eq("id", orgId).maybeSingle());
  if (!org) throw new HttpError(404, "Workspace not found");
  const plan = org.plan_id ? await q(sb.from("plans").select("*").eq("id", org.plan_id).maybeSingle()) : null;
  const [{ count: users }, { count: projects }, { count: pendingInvites }] = await Promise.all([
    sb.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb.from("org_invitations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
  ]);
  const sub = await q(sb.from("subscriptions").select("*").eq("org_id", orgId)
    .in("status", ["created", "authenticated", "active", "pending", "halted", "paused"])
    .order("created_at", { ascending: false }).limit(1));
  const planFeatures: string[] = plan?.features ?? [];
  let features: string[] = Array.isArray(org.enabled_modules) ? org.enabled_modules : planFeatures;
  for (const [k, v] of Object.entries(org.feature_overrides ?? {})) {
    if (v === true && !features.includes(k)) features = [...features, k];
    if (v === false) features = features.filter((f) => f !== k);
  }
  const lim = (k: string, planVal: number | null) =>
    org.limit_overrides?.[k] !== undefined ? Number(org.limit_overrides[k]) : planVal;
  return {
    org,
    plan,
    subscription: sub?.[0] ?? null,
    features: org.is_legacy ? ["*"] : features,
    limits: {
      max_users: org.is_legacy ? null : lim("max_users", plan?.max_users ?? null),
      max_projects: org.is_legacy ? null : lim("max_projects", plan?.max_projects ?? null),
      max_storage_mb: org.is_legacy ? null : lim("max_storage_mb", plan?.max_storage_mb ?? null),
    },
    usage: { users: users ?? 0, projects: projects ?? 0, pending_invites: pendingInvites ?? 0 },
    razorpayKeyId: RZP_KEY_ID || null,
  };
}

async function assertSeatAvailable(orgId: string) {
  const ctx = await orgContext(orgId);
  const max = ctx.limits.max_users;
  if (max !== null && ctx.usage.users + ctx.usage.pending_invites >= max) {
    throw new HttpError(402, `Your ${ctx.plan?.name ?? ""} plan includes ${max} users. Upgrade to add more people.`, "PLAN_LIMIT");
  }
  if (["suspended", "cancelled", "expired"].includes(ctx.org.status)) {
    throw new HttpError(402, "This workspace is inactive. Renew your subscription first.", "ORG_INACTIVE");
  }
}

async function attachUserToOrg(uid: string, email: string, name: string, orgId: string, roleId: string, isOwner: boolean, invitedBy?: string) {
  const fs = firebase().firestore();
  await fs.collection("users").doc(uid).set({
    name: name || email.split("@")[0] || "User",
    email, orgId, roleId, isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await sb.from("org_members").upsert({
    org_id: orgId, user_uid: uid, email, name, role_id: roleId, status: "active", is_owner: isOwner, invited_by: invitedBy ?? null,
  }, { onConflict: "org_id,user_uid" });
  // Claims let Supabase Third-Party Auth treat the Firebase token as an
  // authenticated user (role) and give RLS a fast org hint.
  try {
    const u = await firebase().auth().getUser(uid);
    await firebase().auth().setCustomUserClaims(uid, { ...(u.customClaims ?? {}), role: "authenticated", org_id: orgId });
  } catch (_) { /* best effort */ }
}

// ─── Actions ───────────────────────────────────────────────────────────────
type Handler = (p: any, c: Caller | null, req: Request) => Promise<unknown>;
const PUBLIC_ACTIONS = new Set(["public_plans", "get_invitation", "public_contact", "health"]);

// Every tenant-scoped table — used for data export. Keep in sync with migrations.
const TENANT_TABLES = [
  "projects", "tasks", "subtasks", "comments", "time_logs", "documents", "site_diaries", "attendance",
  "leave_requests", "salary_slips", "expenses", "assets", "asset_assignments", "asset_maintenance",
  "chat_channels", "chat_messages", "app_notifications", "audit_logs", "performance_scores", "performance_reviews",
  "roles", "settings", "boq_items", "materials", "material_movements", "material_requests", "contractors",
  "labour_entries", "labour_payments", "inspection_templates", "inspections", "punch_items", "project_milestones",
];

const actions: Record<string, Handler> = {
  // ── Public ──
  async public_plans() {
    const plans = await q(sb.from("plans").select("id,name,tagline,description,currency,price_monthly,price_yearly,max_users,max_projects,max_storage_mb,features,trial_days,highlight,is_custom_pricing,sort_order").eq("is_public", true).eq("is_active", true).order("sort_order"));
    return { plans };
  },
  async get_invitation(p) {
    const inv = await q(sb.from("org_invitations").select("email,name,status,expires_at,org_id,role_id").eq("token", str(p.token, 80)).maybeSingle());
    if (!inv) throw new HttpError(404, "Invitation not found");
    const org = await q(sb.from("organizations").select("name,logo_url").eq("id", inv.org_id).maybeSingle());
    const role = inv.role_id ? await q(sb.from("roles").select("name").eq("id", inv.role_id).maybeSingle()) : null;
    const expired = new Date(inv.expires_at) < new Date();
    return { email: inv.email, name: inv.name, status: expired && inv.status === "pending" ? "expired" : inv.status, orgName: org?.name, orgLogo: org?.logo_url, roleName: role?.name ?? null };
  },
  async public_contact(p) {
    // Sales / demo requests from the marketing site → a platform support ticket
    // under a dedicated "leads" org would complicate isolation, so they go to
    // the platform audit log, which the super-admin console lists as Leads.
    const email = str(p.email, 160);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "A valid email is required");
    await audit(null, "lead.created", "lead", null, null, {
      name: str(p.name), email, phone: str(p.phone, 40), company: str(p.company), teamSize: str(p.teamSize, 40),
      interest: str(p.interest, 60), message: str(p.message, 2000),
    });
    return { ok: true };
  },

  async health() {
    const t0 = Date.now();
    const { error } = await sb.from("plans").select("id").limit(1);
    return { ok: !error, db: error ? error.message : "ok", latencyMs: Date.now() - t0, time: new Date().toISOString(), payments: !!(RZP_KEY_ID && RZP_KEY_SECRET) };
  },

  // ── Session ──
  async me(_p, c) {
    const caller = c!;
    const platform = await platformRole(caller);
    const m = await membership(caller);
    const ctx = m ? await orgContext(m.org_id) : null;
    const maintenance = (await q(sb.from("platform_settings").select("value").eq("key", "maintenance").maybeSingle()))?.value ?? null;
    return { uid: caller.uid, email: caller.email, emailVerified: caller.emailVerified, platformRole: platform, membership: m, context: ctx, maintenance };
  },

  // ── Data portability & deletion ──
  async export_data(_p, c) {
    const m = await requireOrgAdmin(c!);
    const out: Record<string, unknown[]> = {};
    for (const t of TENANT_TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data, error } = await sb.from(t).select("*").eq("org_id", m.org_id).range(from, from + 999);
        if (error) break; // table may not exist in older schemas
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      out[t] = rows;
    }
    out.organization = [await q(sb.from("organizations").select("*").eq("id", m.org_id).single())];
    out.members = await q(sb.from("org_members").select("*").eq("org_id", m.org_id));
    out.payments = await q(sb.from("payments").select("*").eq("org_id", m.org_id));
    out.support_tickets = await q(sb.from("support_tickets").select("*").eq("org_id", m.org_id));
    await audit(c, "org.data_exported", "organization", m.org_id, m.org_id, { tables: Object.keys(out).length });
    return { exportedAt: new Date().toISOString(), orgId: m.org_id, data: out };
  },
  async request_workspace_deletion(p, c) {
    const m = await requireMember(c!);
    if (!m.is_owner) throw new HttpError(403, "Only the workspace owner can request deletion");
    const org = await q(sb.from("organizations").select("*").eq("id", m.org_id).single());
    if (org.is_legacy) throw new HttpError(400, "This workspace is under a custom agreement — contact support.");
    if (str(p.confirm, 120) !== org.name) throw new HttpError(400, "Type the exact workspace name to confirm");
    const settings = { ...(org.settings ?? {}), deletion_requested_at: new Date().toISOString(), deletion_requested_by: c!.email };
    await q(sb.from("organizations").update({ settings, updated_at: new Date().toISOString() }).eq("id", m.org_id));
    const t = await q(sb.from("support_tickets").insert({
      org_id: m.org_id, subject: "Workspace deletion request", category: "account", priority: "high",
      created_by_uid: c!.uid, created_by_email: c!.email, created_by_name: c!.name,
    }).select("id").single());
    await sb.from("support_ticket_messages").insert({ ticket_id: t.id, author_uid: c!.uid, author_name: c!.email, author_type: "customer",
      body: `Please permanently delete the workspace "${org.name}" and all of its data. Reason: ${str(p.reason, 1000) || "not given"}` });
    await audit(c, "org.deletion_requested", "organization", m.org_id, m.org_id, { reason: str(p.reason, 1000) });
    return { ok: true };
  },
  async cancel_workspace_deletion(_p, c) {
    const m = await requireMember(c!);
    if (!m.is_owner) throw new HttpError(403, "Only the workspace owner can do this");
    const org = await q(sb.from("organizations").select("settings").eq("id", m.org_id).single());
    const settings = { ...(org.settings ?? {}) };
    delete settings.deletion_requested_at; delete settings.deletion_requested_by;
    await q(sb.from("organizations").update({ settings }).eq("id", m.org_id));
    await audit(c, "org.deletion_cancelled", "organization", m.org_id, m.org_id);
    return { ok: true };
  },
  async org_context(p, c) {
    const m = await requireMember(c!, p.orgId);
    return await orgContext(m.org_id);
  },

  // ── Onboarding ──
  async register_org(p, c) {
    const caller = c!;
    const general = (await q(sb.from("platform_settings").select("value").eq("key", "general").maybeSingle()))?.value ?? {};
    if (general.signups_enabled === false) throw new HttpError(403, "New sign-ups are temporarily paused. Please contact sales.");
    const existing = await membership(caller);
    if (existing) throw new HttpError(409, "Your account already belongs to a workspace.", "ALREADY_MEMBER");

    const name = str(p.orgName, 120);
    if (name.length < 2) throw new HttpError(400, "Company name is required");
    const planId = str(p.planId, 40) || general.default_plan || "professional";
    const plan = await q(sb.from("plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle());
    if (!plan || plan.is_custom_pricing) throw new HttpError(400, "Please choose a self-serve plan");
    const trialDays = Number(plan.trial_days ?? general.default_trial_days ?? 14);

    let slug = slugify(str(p.slug, 60) || name);
    for (let i = 0; i < 5; i++) {
      const taken = await q(sb.from("organizations").select("id").eq("slug", slug).maybeSingle());
      if (!taken) break;
      slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const org = await q(sb.from("organizations").insert({
      name, slug,
      industry: str(p.industry, 40) || "construction",
      company_size: str(p.companySize, 20) || null,
      country: str(p.country, 2) || "IN",
      currency: "INR",
      timezone: str(p.timezone, 60) || "Asia/Kolkata",
      phone: str(p.phone, 30) || null,
      email: caller.email,
      owner_uid: caller.uid, owner_email: caller.email,
      status: "trialing", plan_id: plan.id, billing_cycle: p.billingCycle === "yearly" ? "yearly" : "monthly",
      trial_ends_at: new Date(Date.now() + trialDays * 86400_000).toISOString(),
      onboarding_completed: false,
    }).select("*").single());

    // Roles (Supabase is the source of truth; mirrored to Firestore because
    // the Firestore security rules resolve permissions from roles/{id}).
    const fs = firebase().firestore();
    const roleRows = ROLE_TEMPLATES.map((t) => ({
      id: `${org.id}_${t.key}`, org_id: org.id, name: t.name, description: t.description, color: t.color,
      level: t.level, permissions: t.perms, created_by: "system", is_system: t.key === "owner",
    }));
    await q(sb.from("roles").insert(roleRows));
    const batch = fs.batch();
    for (const r of roleRows) {
      batch.set(fs.collection("roles").doc(r.id), {
        name: r.name, description: r.description, color: r.color, level: r.level, permissions: r.permissions,
        isSystem: r.is_system, createdBy: "system", orgId: org.id, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    await sb.from("settings").insert([
      { id: `${org.id}:org`, org_id: org.id, company_name: name, timezone: org.timezone },
    ]);

    await attachUserToOrg(caller.uid, caller.email, str(p.name, 120) || caller.name, org.id, `${org.id}_owner`, true);
    await audit(caller, "org.registered", "organization", org.id, org.id, { plan: plan.id, industry: org.industry });
    return { orgId: org.id, context: await orgContext(org.id) };
  },

  async complete_onboarding(p, c) {
    const m = await requireOrgAdmin(c!);
    const patch: Record<string, unknown> = { onboarding_completed: true, updated_at: new Date().toISOString() };
    if (Array.isArray(p.modules)) patch.enabled_modules = p.modules.map((x: unknown) => str(x, 40)).filter(Boolean);
    await q(sb.from("organizations").update(patch).eq("id", m.org_id));
    return { ok: true };
  },

  async update_org(p, c) {
    const m = await requireOrgAdmin(c!);
    const allowed = ["name", "industry", "company_size", "country", "timezone", "logo_url", "website", "phone", "email", "address", "tax_id"];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (p[k] !== undefined) patch[k] = str(p[k], k === "address" ? 500 : 200) || null;
    if (patch.name === null) delete patch.name;
    if (p.enabled_modules !== undefined) {
      patch.enabled_modules = Array.isArray(p.enabled_modules) ? p.enabled_modules.map((x: unknown) => str(x, 40)) : null;
    }
    const org = await q(sb.from("organizations").update(patch).eq("id", m.org_id).select("*").single());
    if (patch.name) await sb.from("settings").update({ company_name: patch.name }).eq("id", m.org_id === "main" ? "org" : `${m.org_id}:org`);
    await audit(c, "org.updated", "organization", m.org_id, m.org_id, { fields: Object.keys(patch) });
    return { org };
  },

  // ── Team invitations ──
  async invite_member(p, c, req) {
    const m = await requireOrgAdmin(c!, undefined, "team_manage");
    const email = str(p.email, 160).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
    const roleId = str(p.roleId, 80);
    const role = await q(sb.from("roles").select("id, level, org_id").eq("id", roleId).maybeSingle());
    if (!role || role.org_id !== m.org_id) throw new HttpError(400, "Choose a role from this workspace");
    const mine = await rolePerms(m.role_id);
    if (!m.is_owner && role.level > mine.level) throw new HttpError(403, "You can't invite someone above your own role");
    await assertSeatAvailable(m.org_id);
    const already = await q(sb.from("org_members").select("id").eq("org_id", m.org_id).eq("email", email).eq("status", "active").maybeSingle());
    if (already) throw new HttpError(409, "This person is already in your workspace");
    await sb.from("org_invitations").update({ status: "revoked" }).eq("org_id", m.org_id).eq("email", email).eq("status", "pending");
    const inv = await q(sb.from("org_invitations").insert({ org_id: m.org_id, email, name: str(p.name, 120) || null, role_id: roleId, invited_by: c!.uid }).select("*").single());
    await audit(c, "member.invited", "invitation", inv.id, m.org_id, { email, roleId });
    return { invitation: inv, link: `${appUrl(req)}/invite/${inv.token}` };
  },
  async list_invitations(_p, c, req) {
    const m = await requireOrgAdmin(c!, undefined, "team_manage");
    const rows = await q(sb.from("org_invitations").select("id,email,name,role_id,status,expires_at,created_at,token").eq("org_id", m.org_id).eq("status", "pending").order("created_at", { ascending: false }));
    return { invitations: rows.map((r: any) => ({ ...r, link: `${appUrl(req)}/invite/${r.token}` })) };
  },
  async revoke_invitation(p, c) {
    const m = await requireOrgAdmin(c!, undefined, "team_manage");
    await q(sb.from("org_invitations").update({ status: "revoked" }).eq("id", str(p.id, 60)).eq("org_id", m.org_id));
    return { ok: true };
  },
  async accept_invitation(p, c) {
    const caller = c!;
    const inv = await q(sb.from("org_invitations").select("*").eq("token", str(p.token, 80)).maybeSingle());
    if (!inv || inv.status !== "pending") throw new HttpError(404, "This invitation is no longer valid");
    if (new Date(inv.expires_at) < new Date()) throw new HttpError(410, "This invitation has expired — ask your admin for a new one");
    if (inv.email.toLowerCase() !== caller.email) throw new HttpError(403, `This invitation was sent to ${inv.email}. Sign in with that address.`);
    const existing = await membership(caller);
    if (existing && existing.org_id !== inv.org_id) throw new HttpError(409, "Your account already belongs to another workspace.");
    const org = await q(sb.from("organizations").select("status").eq("id", inv.org_id).single());
    if (["suspended", "cancelled", "expired"].includes(org.status)) throw new HttpError(402, "This workspace is currently inactive.");
    await attachUserToOrg(caller.uid, caller.email, str(p.name, 120) || inv.name || caller.name, inv.org_id, inv.role_id, false, inv.invited_by);
    await q(sb.from("org_invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", inv.id));
    await audit(caller, "member.joined", "organization", inv.org_id, inv.org_id, { email: caller.email });
    return { orgId: inv.org_id };
  },

  // ── Billing ──
  async create_subscription(p, c) {
    const m = await requireOrgAdmin(c!);
    const cycle = p.billingCycle === "yearly" ? "yearly" : "monthly";
    const plan = await q(sb.from("plans").select("*").eq("id", str(p.planId, 40)).eq("is_active", true).maybeSingle());
    if (!plan || plan.is_custom_pricing) throw new HttpError(400, "This plan isn't available for online checkout");
    const ctx = await orgContext(m.org_id);
    if (ctx.org.is_legacy) throw new HttpError(400, "This workspace is on a custom agreement.");
    if (plan.max_users !== null && ctx.usage.users > plan.max_users) {
      throw new HttpError(400, `You have ${ctx.usage.users} active users; ${plan.name} allows ${plan.max_users}. Remove users or pick a larger plan.`);
    }
    if (plan.max_projects !== null && ctx.usage.projects > plan.max_projects) {
      throw new HttpError(400, `You have ${ctx.usage.projects} projects; ${plan.name} allows ${plan.max_projects}.`);
    }
    // Lazily create the Razorpay plan once per (plan, cycle).
    const col = cycle === "yearly" ? "razorpay_plan_yearly" : "razorpay_plan_monthly";
    let rzpPlanId: string | null = plan[col];
    if (!rzpPlanId) {
      const amount = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
      const created = await razorpay("/plans", "POST", {
        period: cycle === "yearly" ? "yearly" : "monthly", interval: 1,
        item: { name: `Task Pilot ${plan.name} (${cycle})`, amount, currency: plan.currency, description: plan.tagline ?? plan.name },
        notes: { taskpilot_plan: plan.id, cycle },
      });
      rzpPlanId = created.id;
      await sb.from("plans").update({ [col]: rzpPlanId }).eq("id", plan.id);
    }
    // Existing live subscription → change plan instead of double billing.
    if (ctx.subscription?.provider_subscription_id && ["active", "authenticated"].includes(ctx.subscription.status)) {
      const upgrade = (cycle === "yearly" ? plan.price_yearly : plan.price_monthly) >=
        (ctx.plan ? (ctx.subscription.billing_cycle === "yearly" ? ctx.plan.price_yearly : ctx.plan.price_monthly) : 0);
      await razorpay(`/subscriptions/${ctx.subscription.provider_subscription_id}`, "PATCH", {
        plan_id: rzpPlanId, schedule_change_at: upgrade ? "now" : "cycle_end", customer_notify: 1,
      });
      await sb.from("subscriptions").update({ plan_id: plan.id, billing_cycle: cycle, updated_at: new Date().toISOString() }).eq("id", ctx.subscription.id);
      if (upgrade) await sb.from("organizations").update({ plan_id: plan.id, billing_cycle: cycle, updated_at: new Date().toISOString() }).eq("id", m.org_id);
      await audit(c, upgrade ? "subscription.upgraded" : "subscription.downgrade_scheduled", "subscription", ctx.subscription.id, m.org_id, { plan: plan.id, cycle });
      return { changed: true, effective: upgrade ? "now" : "cycle_end" };
    }
    const trialEnd = ctx.org.status === "trialing" && ctx.org.trial_ends_at && new Date(ctx.org.trial_ends_at) > new Date(Date.now() + 3600_000)
      ? Math.floor(new Date(ctx.org.trial_ends_at).getTime() / 1000) : undefined;
    const rzSub = await razorpay("/subscriptions", "POST", {
      plan_id: rzpPlanId, total_count: cycle === "yearly" ? 10 : 120, customer_notify: 1,
      ...(trialEnd ? { start_at: trialEnd } : {}),
      notes: { org_id: m.org_id, plan_id: plan.id, cycle },
    });
    const sub = await q(sb.from("subscriptions").insert({
      org_id: m.org_id, plan_id: plan.id, billing_cycle: cycle, status: rzSub.status ?? "created",
      provider: "razorpay", provider_subscription_id: rzSub.id, short_url: rzSub.short_url ?? null, created_by: c!.uid,
    }).select("*").single());
    await audit(c, "subscription.created", "subscription", sub.id, m.org_id, { plan: plan.id, cycle });
    return {
      subscriptionId: rzSub.id, keyId: RZP_KEY_ID, orgName: ctx.org.name, email: c!.email,
      planName: plan.name, amount: cycle === "yearly" ? plan.price_yearly : plan.price_monthly, currency: plan.currency,
    };
  },

  async verify_payment(p, c) {
    const m = await requireOrgAdmin(c!);
    const paymentId = str(p.razorpay_payment_id, 60), subId = str(p.razorpay_subscription_id, 60), sig = str(p.razorpay_signature, 200);
    const expected = await hmacHex(RZP_KEY_SECRET, `${paymentId}|${subId}`);
    if (!sig || !safeEqual(expected, sig)) throw new HttpError(400, "Payment signature could not be verified");
    const sub = await q(sb.from("subscriptions").select("*").eq("provider_subscription_id", subId).eq("org_id", m.org_id).maybeSingle());
    if (!sub) throw new HttpError(404, "Subscription not found");
    await applySubscriptionState(sub.provider_subscription_id);
    await recordPayment(paymentId, sub);
    return { ok: true, context: await orgContext(m.org_id) };
  },

  async cancel_subscription(p, c) {
    const m = await requireOrgAdmin(c!);
    const ctx = await orgContext(m.org_id);
    const sub = ctx.subscription;
    if (!sub?.provider_subscription_id) throw new HttpError(400, "There is no active subscription");
    const atEnd = p.immediately !== true;
    await razorpay(`/subscriptions/${sub.provider_subscription_id}/cancel`, "POST", { cancel_at_cycle_end: atEnd ? 1 : 0 });
    await sb.from("subscriptions").update({ cancel_at_period_end: atEnd, ...(atEnd ? {} : { status: "cancelled", cancelled_at: new Date().toISOString() }), updated_at: new Date().toISOString() }).eq("id", sub.id);
    if (!atEnd) await sb.from("organizations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", m.org_id);
    await audit(c, "subscription.cancelled", "subscription", sub.id, m.org_id, { atPeriodEnd: atEnd, reason: str(p.reason, 500) });
    return { ok: true };
  },

  async list_payments(_p, c) {
    const m = await requireOrgAdmin(c!);
    const payments = await q(sb.from("payments").select("*").eq("org_id", m.org_id).order("created_at", { ascending: false }).limit(100));
    const tax = (await q(sb.from("platform_settings").select("value").eq("key", "tax").maybeSingle()))?.value ?? {};
    return { payments, seller: tax };
  },

  // ── Support ──
  async create_ticket(p, c) {
    const m = await requireMember(c!);
    const subject = str(p.subject, 200), body = str(p.body, 5000);
    if (!subject || !body) throw new HttpError(400, "Subject and message are required");
    const ctx = await orgContext(m.org_id);
    const priority = ["low", "normal", "high", "urgent"].includes(p.priority) ? p.priority : (ctx.features.includes("priority_support") || ctx.features.includes("*") ? "high" : "normal");
    const t = await q(sb.from("support_tickets").insert({
      org_id: m.org_id, subject, category: str(p.category, 30) || "general", priority,
      created_by_uid: c!.uid, created_by_email: c!.email, created_by_name: str(p.name, 120) || c!.name,
    }).select("*").single());
    await sb.from("support_ticket_messages").insert({ ticket_id: t.id, author_uid: c!.uid, author_name: str(p.name, 120) || c!.email, author_type: "customer", body });
    return { ticket: t };
  },
  async list_tickets(_p, c) {
    const m = await requireMember(c!);
    const tickets = await q(sb.from("support_tickets").select("*").eq("org_id", m.org_id).order("last_reply_at", { ascending: false }).limit(200));
    return { tickets };
  },
  async get_ticket(p, c) {
    const m = await requireMember(c!);
    const t = await q(sb.from("support_tickets").select("*").eq("id", str(p.id, 60)).eq("org_id", m.org_id).maybeSingle());
    if (!t) throw new HttpError(404, "Ticket not found");
    const messages = await q(sb.from("support_ticket_messages").select("*").eq("ticket_id", t.id).order("created_at"));
    return { ticket: t, messages };
  },
  async reply_ticket(p, c) {
    const m = await requireMember(c!);
    const t = await q(sb.from("support_tickets").select("id,status").eq("id", str(p.id, 60)).eq("org_id", m.org_id).maybeSingle());
    if (!t) throw new HttpError(404, "Ticket not found");
    const body = str(p.body, 5000);
    if (!body) throw new HttpError(400, "Message is required");
    await q(sb.from("support_ticket_messages").insert({ ticket_id: t.id, author_uid: c!.uid, author_name: str(p.name, 120) || c!.email, author_type: "customer", body }));
    await sb.from("support_tickets").update({ status: "open", last_reply_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", t.id);
    return { ok: true };
  },

  // ══ Platform (super-admin) ══
  async admin_overview(_p, c) {
    await requirePlatform(c!);
    const orgs = await q(sb.from("organizations").select("id,status,plan_id,billing_cycle,created_at,is_legacy,industry"));
    const plans = await q(sb.from("plans").select("id,name,price_monthly,price_yearly"));
    const planMap = Object.fromEntries(plans.map((p: any) => [p.id, p]));
    const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1); since.setHours(0, 0, 0, 0);
    const pays = await q(sb.from("payments").select("amount,status,paid_at,created_at").gte("created_at", since.toISOString()));
    const members = await sb.from("org_members").select("id", { count: "exact", head: true }).eq("status", "active");
    const openTickets = await sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]);
    let mrr = 0;
    const byStatus: Record<string, number> = {}, byPlan: Record<string, number> = {}, byIndustry: Record<string, number> = {};
    for (const o of orgs) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      byPlan[o.plan_id ?? "none"] = (byPlan[o.plan_id ?? "none"] ?? 0) + 1;
      byIndustry[o.industry ?? "other"] = (byIndustry[o.industry ?? "other"] ?? 0) + 1;
      if (o.status === "active" && !o.is_legacy && planMap[o.plan_id]) {
        mrr += o.billing_cycle === "yearly" ? Math.round(planMap[o.plan_id].price_yearly / 12) : planMap[o.plan_id].price_monthly;
      }
    }
    const months: { month: string; revenue: number; signups: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(since); d.setMonth(since.getMonth() + i);
      months.push({ month: d.toISOString().slice(0, 7), revenue: 0, signups: 0 });
    }
    const idx = (iso: string) => months.findIndex((x) => x.month === iso.slice(0, 7));
    for (const p of pays) if (p.status === "paid") { const i = idx(p.paid_at ?? p.created_at); if (i >= 0) months[i].revenue += p.amount; }
    for (const o of orgs) { const i = idx(o.created_at); if (i >= 0) months[i].signups += 1; }
    const trials = orgs.filter((o: any) => o.status === "trialing").length;
    const paying = orgs.filter((o: any) => o.status === "active" && !o.is_legacy).length;
    return {
      totals: { orgs: orgs.length, users: members.count ?? 0, trials, paying, mrr, arr: mrr * 12, openTickets: openTickets.count ?? 0,
        revenue12m: months.reduce((s, m) => s + m.revenue, 0) },
      byStatus, byPlan, byIndustry, months,
    };
  },
  async admin_list_orgs(p, c) {
    await requirePlatform(c!);
    let qb = sb.from("organizations").select("*").order("created_at", { ascending: false }).limit(500);
    if (p.status) qb = qb.eq("status", str(p.status, 20));
    if (p.search) qb = qb.or(`name.ilike.%${str(p.search, 60).replace(/[%,()]/g, "")}%,owner_email.ilike.%${str(p.search, 60).replace(/[%,()]/g, "")}%`);
    const orgs = await q(qb);
    const ids = orgs.map((o: any) => o.id);
    const mem = ids.length ? await q(sb.from("org_members").select("org_id").in("org_id", ids).eq("status", "active")) : [];
    const counts: Record<string, number> = {};
    for (const r of mem) counts[r.org_id] = (counts[r.org_id] ?? 0) + 1;
    return { orgs: orgs.map((o: any) => ({ ...o, user_count: counts[o.id] ?? 0 })) };
  },
  async admin_get_org(p, c) {
    await requirePlatform(c!);
    const id = str(p.id, 60);
    const ctx = await orgContext(id);
    const [members, subscriptions, payments, tickets, logs] = await Promise.all([
      q(sb.from("org_members").select("*").eq("org_id", id).order("created_at")),
      q(sb.from("subscriptions").select("*").eq("org_id", id).order("created_at", { ascending: false })),
      q(sb.from("payments").select("*").eq("org_id", id).order("created_at", { ascending: false }).limit(50)),
      q(sb.from("support_tickets").select("*").eq("org_id", id).order("created_at", { ascending: false }).limit(50)),
      q(sb.from("platform_audit_logs").select("*").eq("org_id", id).order("created_at", { ascending: false }).limit(50)),
    ]);
    return { ...ctx, members, subscriptions, payments, tickets, logs };
  },
  async admin_update_org(p, c) {
    await requirePlatform(c!, ["owner", "admin"]);
    const id = str(p.id, 60);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.status && ["trialing", "active", "past_due", "suspended", "cancelled", "expired"].includes(p.status)) patch.status = p.status;
    if (p.plan_id) {
      const plan = await q(sb.from("plans").select("id").eq("id", str(p.plan_id, 40)).maybeSingle());
      if (!plan) throw new HttpError(400, "Unknown plan");
      patch.plan_id = plan.id;
    }
    if (p.trial_ends_at) patch.trial_ends_at = new Date(p.trial_ends_at).toISOString();
    if (p.current_period_end) patch.current_period_end = new Date(p.current_period_end).toISOString();
    if (p.limit_overrides && typeof p.limit_overrides === "object") patch.limit_overrides = p.limit_overrides;
    if (p.feature_overrides && typeof p.feature_overrides === "object") patch.feature_overrides = p.feature_overrides;
    if (p.name) patch.name = str(p.name, 120);
    const org = await q(sb.from("organizations").update(patch).eq("id", id).select("*").single());
    await audit(c, "platform.org_updated", "organization", id, id, patch);
    return { org };
  },
  async admin_delete_org(p, c) {
    await requirePlatform(c!, ["owner"]);
    const id = str(p.id, 60);
    const org = await q(sb.from("organizations").select("*").eq("id", id).maybeSingle());
    if (!org) throw new HttpError(404, "Workspace not found");
    if (org.is_legacy || id === "main") throw new HttpError(400, "The legacy workspace cannot be deleted");
    if (str(p.confirm, 120) !== org.name) throw new HttpError(400, "Type the exact workspace name to confirm");
    // Stop billing first.
    const subs = await q(sb.from("subscriptions").select("provider_subscription_id,status").eq("org_id", id));
    for (const s of subs) {
      if (s.provider_subscription_id && ["active", "authenticated", "pending", "halted", "created"].includes(s.status)) {
        try { await razorpay(`/subscriptions/${s.provider_subscription_id}/cancel`, "POST", { cancel_at_cycle_end: 0 }); } catch (_) { /* best effort */ }
      }
    }
    // Remove identities that belong only to this workspace.
    const fs = firebase().firestore();
    const members = await q(sb.from("org_members").select("user_uid").eq("org_id", id));
    for (const mem of members) {
      const other = await q(sb.from("org_members").select("id").eq("user_uid", mem.user_uid).neq("org_id", id).limit(1));
      if (other.length) continue;
      try { await fs.collection("users").doc(mem.user_uid).delete(); } catch (_) { /* ignore */ }
      try { await firebase().auth().updateUser(mem.user_uid, { disabled: true }); } catch (_) { /* ignore */ }
    }
    const roleIds = (await q(sb.from("roles").select("id").eq("org_id", id))).map((r: any) => r.id);
    for (const rid of roleIds) { try { await fs.collection("roles").doc(rid).delete(); } catch (_) { /* ignore */ } }
    // All tenant rows cascade from organizations(id).
    await q(sb.from("organizations").delete().eq("id", id));
    await audit(c, "platform.org_deleted", "organization", id, null, { name: org.name, members: members.length });
    return { ok: true };
  },
  async admin_list_payments(_p, c) {
    await requirePlatform(c!, ["owner", "admin", "finance"]);
    const payments = await q(sb.from("payments").select("*, organizations(name)").order("created_at", { ascending: false }).limit(500));
    return { payments };
  },
  async admin_list_subscriptions(_p, c) {
    await requirePlatform(c!, ["owner", "admin", "finance"]);
    const subscriptions = await q(sb.from("subscriptions").select("*, organizations(name)").order("created_at", { ascending: false }).limit(500));
    return { subscriptions };
  },
  async admin_list_plans(_p, c) {
    await requirePlatform(c!);
    return { plans: await q(sb.from("plans").select("*").order("sort_order")) };
  },
  async admin_upsert_plan(p, c) {
    await requirePlatform(c!, ["owner", "admin"]);
    const id = slugify(str(p.id, 40)).replace(/-/g, "_");
    if (!id) throw new HttpError(400, "Plan id is required");
    const existing = await q(sb.from("plans").select("*").eq("id", id).maybeSingle());
    const row: Record<string, unknown> = {
      id, name: str(p.name, 60) || id, tagline: str(p.tagline, 160) || null, description: str(p.description, 1000) || null,
      price_monthly: Math.max(0, Math.round(Number(p.price_monthly) || 0)),
      price_yearly: Math.max(0, Math.round(Number(p.price_yearly) || 0)),
      max_users: p.max_users === null || p.max_users === "" ? null : Number(p.max_users),
      max_projects: p.max_projects === null || p.max_projects === "" ? null : Number(p.max_projects),
      max_storage_mb: p.max_storage_mb === null || p.max_storage_mb === "" ? null : Number(p.max_storage_mb),
      features: Array.isArray(p.features) ? p.features.map((f: unknown) => str(f, 40)) : [],
      trial_days: Number(p.trial_days ?? 14), is_public: p.is_public !== false, is_active: p.is_active !== false,
      is_custom_pricing: !!p.is_custom_pricing, highlight: !!p.highlight, sort_order: Number(p.sort_order ?? 0),
      updated_at: new Date().toISOString(),
    };
    // Changing a price invalidates the cached Razorpay plan (Razorpay plans are immutable).
    if (existing && (existing.price_monthly !== row.price_monthly)) row.razorpay_plan_monthly = null;
    if (existing && (existing.price_yearly !== row.price_yearly)) row.razorpay_plan_yearly = null;
    const plan = await q(sb.from("plans").upsert(row).select("*").single());
    await audit(c, existing ? "platform.plan_updated" : "platform.plan_created", "plan", id, null, row);
    return { plan };
  },
  async admin_list_tickets(p, c) {
    await requirePlatform(c!);
    let qb = sb.from("support_tickets").select("*, organizations(name)").order("last_reply_at", { ascending: false }).limit(500);
    if (p.status) qb = qb.eq("status", str(p.status, 20));
    return { tickets: await q(qb) };
  },
  async admin_get_ticket(p, c) {
    await requirePlatform(c!);
    const t = await q(sb.from("support_tickets").select("*, organizations(name)").eq("id", str(p.id, 60)).maybeSingle());
    if (!t) throw new HttpError(404, "Ticket not found");
    return { ticket: t, messages: await q(sb.from("support_ticket_messages").select("*").eq("ticket_id", t.id).order("created_at")) };
  },
  async admin_reply_ticket(p, c) {
    await requirePlatform(c!);
    const id = str(p.id, 60);
    const body = str(p.body, 5000);
    const t = await q(sb.from("support_tickets").select("id, org_id, created_by_uid, subject, ticket_number").eq("id", id).maybeSingle());
    if (!t) throw new HttpError(404, "Ticket not found");
    if (body) {
      await q(sb.from("support_ticket_messages").insert({ ticket_id: id, author_uid: c!.uid, author_name: "Task Pilot Support", author_type: "staff", body }));
      if (t.created_by_uid) {
        await sb.from("app_notifications").insert({
          id: crypto.randomUUID(), org_id: t.org_id, user_id: t.created_by_uid, type: "support",
          title: `Support replied: #${t.ticket_number}`, body: body.slice(0, 140), related_id: id, related_type: "support_ticket", is_read: {},
        });
      }
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_reply_at: new Date().toISOString() };
    patch.status = ["open", "pending", "resolved", "closed"].includes(p.status) ? p.status : body ? "pending" : undefined;
    if (!patch.status) delete patch.status;
    if (p.priority) patch.priority = p.priority;
    await q(sb.from("support_tickets").update(patch).eq("id", id));
    await audit(c, "platform.ticket_replied", "support_ticket", id, t.org_id, { status: patch.status });
    return { ok: true };
  },
  async admin_get_settings(_p, c) {
    await requirePlatform(c!);
    const rows = await q(sb.from("platform_settings").select("*"));
    const admins = await q(sb.from("platform_admins").select("email, role, uid, created_at").order("created_at"));
    return { settings: Object.fromEntries(rows.map((r: any) => [r.key, r.value])), admins, payments: { razorpayConfigured: !!(RZP_KEY_ID && RZP_KEY_SECRET), mode: RZP_KEY_ID.startsWith("rzp_live") ? "live" : RZP_KEY_ID ? "test" : "none" } };
  },
  async admin_update_settings(p, c) {
    await requirePlatform(c!, ["owner", "admin"]);
    const key = str(p.key, 40);
    if (!["general", "tax", "maintenance"].includes(key) || typeof p.value !== "object") throw new HttpError(400, "Invalid setting");
    await q(sb.from("platform_settings").upsert({ key, value: p.value, updated_by: c!.email, updated_at: new Date().toISOString() }));
    await audit(c, "platform.settings_updated", "platform_settings", key, null, p.value);
    return { ok: true };
  },
  async admin_set_admin(p, c) {
    await requirePlatform(c!, ["owner"]);
    const email = str(p.email, 160).toLowerCase();
    if (!email) throw new HttpError(400, "Email required");
    if (p.remove) {
      if (email === c!.email) throw new HttpError(400, "You can't remove yourself");
      await q(sb.from("platform_admins").delete().eq("email", email));
    } else {
      const role = ["owner", "admin", "support", "finance"].includes(p.role) ? p.role : "support";
      await q(sb.from("platform_admins").upsert({ email, role }));
    }
    await audit(c, p.remove ? "platform.admin_removed" : "platform.admin_set", "platform_admin", email, null, { role: p.role });
    return { ok: true };
  },
  async admin_audit_logs(p, c) {
    await requirePlatform(c!);
    let qb = sb.from("platform_audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (p.action) qb = qb.like("action", `${str(p.action, 40).replace(/[%_]/g, "")}%`);
    return { logs: await q(qb) };
  },
  async admin_list_users(p, c) {
    await requirePlatform(c!);
    let qb = sb.from("org_members").select("*, organizations(name)").order("created_at", { ascending: false }).limit(1000);
    if (p.search) qb = qb.ilike("email", `%${str(p.search, 60).replace(/[%,()]/g, "")}%`);
    return { users: await q(qb) };
  },
  async admin_broadcast(p, c) {
    await requirePlatform(c!, ["owner", "admin"]);
    const title = str(p.title, 120), body = str(p.body, 500);
    if (!title || !body) throw new HttpError(400, "Title and message required");
    let qb = sb.from("org_members").select("user_uid, org_id").eq("status", "active");
    if (p.orgId) qb = qb.eq("org_id", str(p.orgId, 60));
    if (p.ownersOnly) qb = qb.eq("is_owner", true);
    const rows = await q(qb);
    const notifs = rows.map((r: any) => ({ id: crypto.randomUUID(), org_id: r.org_id, user_id: r.user_uid, title, body, type: "platform", related_type: "platform", is_read: {} }));
    for (let i = 0; i < notifs.length; i += 500) await q(sb.from("app_notifications").insert(notifs.slice(i, i + 500)));
    await audit(c, "platform.broadcast", "notification", null, p.orgId ?? null, { title, recipients: notifs.length });
    return { sent: notifs.length };
  },
};

// ─── Razorpay → local state sync (shared with verify_payment) ──────────────
async function applySubscriptionState(rzpSubId: string) {
  const s = await razorpay(`/subscriptions/${rzpSubId}`);
  const sub = await q(sb.from("subscriptions").select("*").eq("provider_subscription_id", rzpSubId).maybeSingle());
  if (!sub) return;
  const toIso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);
  await sb.from("subscriptions").update({
    status: s.status, current_period_start: toIso(s.current_start), current_period_end: toIso(s.current_end),
    provider_customer_id: s.customer_id ?? sub.provider_customer_id, updated_at: new Date().toISOString(),
  }).eq("id", sub.id);
  if (["active", "authenticated"].includes(s.status)) {
    const patch: Record<string, unknown> = {
      plan_id: sub.plan_id, billing_cycle: sub.billing_cycle,
      current_period_end: toIso(s.current_end ?? s.charge_at), updated_at: new Date().toISOString(),
    };
    // "authenticated" = mandate set up, first charge deferred to trial end:
    // keep the trial running; flip to active once Razorpay charges.
    if (s.status === "active") patch.status = "active";
    await sb.from("organizations").update(patch).eq("id", sub.org_id);
  }
}
async function recordPayment(paymentId: string, sub: any) {
  const exists = await q(sb.from("payments").select("id").eq("provider_payment_id", paymentId).maybeSingle());
  if (exists) return;
  const pay = await razorpay(`/payments/${paymentId}`);
  if (!["captured", "authorized"].includes(pay.status)) return;
  const tax = (await q(sb.from("platform_settings").select("value").eq("key", "tax").maybeSingle()))?.value ?? {};
  const gst = Number(tax.gst_percent ?? 18);
  const taxAmount = tax.prices_include_tax === false ? Math.round(pay.amount * gst / 100) : Math.round(pay.amount - pay.amount / (1 + gst / 100));
  const org = await q(sb.from("organizations").select("name, address, tax_id, owner_email").eq("id", sub.org_id).single());
  await sb.from("payments").insert({
    org_id: sub.org_id, subscription_id: sub.id, provider: "razorpay", provider_payment_id: paymentId,
    provider_invoice_id: pay.invoice_id ?? null, amount: pay.amount, tax_amount: taxAmount, currency: pay.currency,
    status: "paid", plan_id: sub.plan_id, description: `Task Pilot ${sub.plan_id} (${sub.billing_cycle})`,
    period_start: sub.current_period_start, period_end: sub.current_period_end, paid_at: new Date((pay.created_at ?? Date.now() / 1000) * 1000).toISOString(),
    billing_details: { name: org.name, address: org.address, tax_id: org.tax_id, email: org.owner_email, method: pay.method },
  });
}

// ─── Entry ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const handler = actions[action];
    if (!handler) throw new HttpError(400, `Unknown action: ${action}`);
    const caller = PUBLIC_ACTIONS.has(action) ? null : await getCaller(req);
    const result = await handler(body, caller, req);
    return json(result);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
    console.error("saas-api error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});

