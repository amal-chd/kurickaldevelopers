import { describe, it, expect, beforeEach } from 'vitest';
import {
  LEGACY_ORG_ID, getActiveOrgId, setActiveOrgId, scopedSettingsId, hasModule, moduleForPath,
  formatMoney, isReadOnlyStatus, trialDaysLeft, OrgContext,
} from './tenant';

const ctx = (features: string[]): OrgContext => ({
  org: { id: 'acme', status: 'active', is_legacy: false } as any,
  plan: null, subscription: null, features,
  limits: { max_users: 10, max_projects: 5, max_storage_mb: null },
  usage: { users: 1, projects: 0, pending_invites: 0 }, razorpayKeyId: null,
});

describe('tenant scoping', () => {
  beforeEach(() => setActiveOrgId(null));

  it('defaults to the legacy org so existing data stays visible', () => {
    expect(getActiveOrgId()).toBe(LEGACY_ORG_ID);
    setActiveOrgId('');
    expect(getActiveOrgId()).toBe('main');
  });

  it('keeps legacy settings ids unchanged and prefixes other tenants', () => {
    expect(scopedSettingsId('task_assignment')).toBe('task_assignment');
    setActiveOrgId('acme');
    expect(scopedSettingsId('task_assignment')).toBe('acme:task_assignment');
  });
});

describe('feature gating', () => {
  it('never locks out while context is unknown', () => {
    expect(hasModule(null, 'salary')).toBe(true);
  });
  it('legacy wildcard unlocks everything', () => {
    expect(hasModule(ctx(['*']), 'salary')).toBe(true);
  });
  it('respects the plan feature list', () => {
    const c = ctx(['tasks', 'projects']);
    expect(hasModule(c, 'projects')).toBe(true);
    expect(hasModule(c, 'salary')).toBe(false);
  });
  it('maps routes (incl. nested) to modules', () => {
    expect(moduleForPath('/app/projects')).toBe('projects');
    expect(moduleForPath('/app/projects/abc/edit')).toBe('projects');
    expect(moduleForPath('/app/projectsX')).toBeNull();
    expect(moduleForPath('/app/dashboard')).toBeNull();
    expect(moduleForPath('/app/admin/audit-log')).toBe('audit_log');
  });
});

describe('billing helpers', () => {
  it('formats paise as rupees', () => {
    expect(formatMoney(149900)).toMatch(/1,499/);
    expect(formatMoney(149950)).toMatch(/1,499\.50/);
  });
  it('flags read-only statuses', () => {
    expect(isReadOnlyStatus('expired')).toBe(true);
    expect(isReadOnlyStatus('past_due')).toBe(false);
  });
  it('computes trial days left, never negative', () => {
    expect(trialDaysLeft({ trial_ends_at: new Date(Date.now() + 2.5 * 86400000).toISOString() } as any)).toBe(3);
    expect(trialDaysLeft({ trial_ends_at: new Date(Date.now() - 86400000).toISOString() } as any)).toBe(0);
    expect(trialDaysLeft(null)).toBeNull();
  });
});
