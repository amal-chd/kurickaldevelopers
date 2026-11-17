import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
//  Tenant (organisation) context
//
//  LEGACY_ORG_ID is the organisation every pre-SaaS record belongs to (it's the
//  `orgId: 'main'` already stored on Firestore user docs). The active org id is
//  sent on every Supabase request as `x-org-id`; RLS scopes rows to it. Code
//  that never sets an org (old builds) is treated as the legacy org, so the
//  existing workspace behaves exactly as before.
// ─────────────────────────────────────────────────────────────────────────────
export const LEGACY_ORG_ID = 'main';

let activeOrgId: string = LEGACY_ORG_ID;
export const getActiveOrgId = () => activeOrgId;
export const setActiveOrgId = (id: string | null | undefined) => {
  activeOrgId = id || LEGACY_ORG_ID;
};

/** Per-tenant key for singleton rows in `settings` (legacy keeps its old ids). */
export const scopedSettingsId = (key: string) =>
  activeOrgId === LEGACY_ORG_ID ? key : `${activeOrgId}:${key}`;

// ─── Module catalogue (feature-based access) ─────────────────────────────────
export type ModuleKey =
  | 'tasks' | 'projects' | 'team' | 'documents' | 'chat' | 'site_diary' | 'attendance'
  | 'notifications' | 'expenses' | 'leave' | 'assets' | 'reports' | 'performance'
  | 'salary' | 'audit_log' | 'advanced_roles' | 'priority_support' | 'sso' | 'api_access';

export const MODULES: { key: ModuleKey; label: string; description: string; core?: boolean }[] = [
  { key: 'tasks', label: 'Tasks & approvals', description: 'Assign, track and approve work with subtasks, comments and attachments.', core: true },
  { key: 'projects', label: 'Projects & sites', description: 'Multi-site projects with budgets, health, members and progress.', core: true },
  { key: 'team', label: 'Team directory', description: 'People, roles and permissions.', core: true },
  { key: 'attendance', label: 'GPS attendance', description: 'Geo-fenced check-in/out from the mobile app.' },
  { key: 'site_diary', label: 'Daily site diary / DPR', description: 'Daily progress, manpower, weather and photos.' },
  { key: 'documents', label: 'Documents & drawings', description: 'Versioned drawings, approvals and a built-in viewer.' },
  { key: 'chat', label: 'Team chat', description: 'Project channels, direct messages and announcements.' },
  { key: 'notifications', label: 'Notifications', description: 'Push, in-app alerts and broadcasts.' },
  { key: 'expenses', label: 'Purchase & expenses', description: 'Site expenses, purchase requests and approvals.' },
  { key: 'leave', label: 'Leave management', description: 'Leave requests and approvals.' },
  { key: 'assets', label: 'Assets & equipment', description: 'Equipment register, allocation and maintenance.' },
  { key: 'reports', label: 'Reports & exports', description: 'Analytics dashboards and Excel exports.' },
  { key: 'performance', label: 'Performance & points', description: 'Automatic performance scoring for every team member.' },
  { key: 'salary', label: 'Salary slips', description: 'Payroll slips for staff.' },
  { key: 'audit_log', label: 'Audit trail', description: 'Complete activity log for compliance.' },
  { key: 'advanced_roles', label: 'Advanced roles', description: 'Unlimited custom roles with granular permissions.' },
  { key: 'priority_support', label: 'Priority support', description: 'Faster response from the Task Pilot team.' },
  { key: 'sso', label: 'Single sign-on', description: 'SAML / Google Workspace SSO.' },
  { key: 'api_access', label: 'API access', description: 'Integrate Task Pilot with your ERP.' },
];

/** Route prefix → module required to open it. Routes not listed are always available. */
export const ROUTE_MODULES: [string, ModuleKey][] = [
  ['/app/projects', 'projects'],
  ['/app/documents', 'documents'],
  ['/app/chat', 'chat'],
  ['/app/site-diary', 'site_diary'],
  ['/app/reports', 'reports'],
  ['/app/performance', 'performance'],
  ['/app/assets', 'assets'],
  ['/app/leave', 'leave'],
  ['/app/salary', 'salary'],
  ['/app/expenses', 'expenses'],
  ['/app/admin/attendance', 'attendance'],
  ['/app/admin/audit-log', 'audit_log'],
];
export const moduleForPath = (path: string): ModuleKey | null =>
  ROUTE_MODULES.find(([p]) => path === p || path.startsWith(p + '/'))?.[1] ?? null;

// ─── Types returned by saas-api ──────────────────────────────────────────────
export interface Plan {
  id: string; name: string; tagline?: string; description?: string; currency: string;
  price_monthly: number; price_yearly: number; max_users: number | null; max_projects: number | null;
  max_storage_mb: number | null; features: string[]; trial_days: number; highlight: boolean;
  is_custom_pricing: boolean; sort_order: number; is_public?: boolean; is_active?: boolean;
}
export interface Organization {
  id: string; name: string; slug: string; industry: string; company_size?: string; country: string;
  currency: string; timezone: string; logo_url?: string; website?: string; phone?: string; email?: string;
  address?: string; tax_id?: string; owner_uid?: string; owner_email?: string;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  plan_id: string | null; billing_cycle: 'monthly' | 'yearly'; trial_ends_at?: string; current_period_end?: string;
  enabled_modules: string[] | null; feature_overrides: Record<string, boolean>; limit_overrides: Record<string, number>;
  onboarding_completed: boolean; is_legacy: boolean; created_at: string;
}
export interface Subscription {
  id: string; plan_id: string; billing_cycle: string; status: string; provider_subscription_id?: string;
  current_period_start?: string; current_period_end?: string; cancel_at_period_end: boolean; short_url?: string;
}
export interface OrgContext {
  org: Organization; plan: Plan | null; subscription: Subscription | null; features: string[];
  limits: { max_users: number | null; max_projects: number | null; max_storage_mb: number | null };
  usage: { users: number; projects: number; pending_invites: number };
  razorpayKeyId: string | null;
}

interface TenantState {
  context: OrgContext | null;
  platformRole: string | null;
  needsOnboarding: boolean;
  loaded: boolean;
  setContext: (c: OrgContext | null) => void;
  setPlatformRole: (r: string | null) => void;
  setNeedsOnboarding: (v: boolean) => void;
  setLoaded: (v: boolean) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  context: null,
  platformRole: null,
  needsOnboarding: false,
  loaded: false,
  setContext: (context) => {
    if (context) setActiveOrgId(context.org.id);
    set({ context });
  },
  setPlatformRole: (platformRole) => set({ platformRole }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  setLoaded: (loaded) => set({ loaded }),
  reset: () => {
    setActiveOrgId(LEGACY_ORG_ID);
    set({ context: null, platformRole: null, needsOnboarding: false, loaded: false });
  },
}));

/** True when the active plan includes the module (legacy workspace: everything). */
export function hasModule(ctx: OrgContext | null, key: ModuleKey | string): boolean {
  if (!ctx) return true; // context still loading or API unreachable → never lock out
  return ctx.features.includes('*') || ctx.features.includes(key);
}

export function useFeature(key: ModuleKey | string): boolean {
  const ctx = useTenantStore((s) => s.context);
  return hasModule(ctx, key);
}

export const isReadOnlyStatus = (s?: string) => s === 'suspended' || s === 'cancelled' || s === 'expired';

export const formatMoney = (minor: number, currency = 'INR') =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

export const trialDaysLeft = (org?: Organization | null) => {
  if (!org?.trial_ends_at) return null;
  return Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000));
};

/**
 * Realtime fallback for non-legacy tenants. Until Firebase is enabled as a
 * Supabase Third-Party Auth provider (VITE_SUPABASE_FIREBASE_AUTH=true),
 * Realtime can't tell which org a socket belongs to, so tenant rows don't
 * stream. Poll the (already tenant-scoped) fetcher instead. No-op for the
 * legacy workspace and once authenticated Realtime is on.
 */
export function tenantPoll(fetcher: () => unknown, intervalMs: number): () => void {
  if (activeOrgId === LEGACY_ORG_ID || import.meta.env.VITE_SUPABASE_FIREBASE_AUTH === 'true') return () => {};
  const id = window.setInterval(() => {
    if (document.visibilityState === 'visible') void fetcher();
  }, intervalMs);
  return () => window.clearInterval(id);
}
