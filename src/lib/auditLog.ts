import { Timestamp } from 'firebase/firestore';
import { supabase } from './supabaseClient';
import { useAuthStore } from '../store/authStore';
import { AuditChange, AuditLog } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
//  Audit logging — Discord-style activity trail, shared with the mobile app.
//
//  The document schema is CANONICAL and identical across both clients. Writes
//  also include legacy aliases (`userId` / `userName` / `details` / `createdAt`)
//  so an older reader still renders the entry. Writes are best-effort: a failed
//  audit write must NEVER surface as a failure of the primary operation.
//
//  NOTE: Firestore rules require `actorId == auth.uid`, so the actor is always
//  taken from the signed-in user — never passed in by the caller.
// ─────────────────────────────────────────────────────────────────────────────

export const AuditCategory = {
  user: 'user',
  role: 'role',
  project: 'project',
  task: 'task',
  attendance: 'attendance',
  document: 'document',
  siteDiary: 'site_diary',
  settings: 'settings',
  notification: 'notification',
  expense: 'expense',
  leave: 'leave',
  salary: 'salary',
  auth: 'auth',
} as const;

/** Categories shown as quick-filter chips, in display order. */
export const AUDIT_CATEGORIES: string[] = [
  'user',
  'role',
  'project',
  'task',
  'attendance',
  'document',
  'site_diary',
  'settings',
  'notification',
  'expense',
  'leave',
  'salary',
  'auth',
];

export const categoryLabel = (c: string): string => {
  const map: Record<string, string> = {
    user: 'Users',
    role: 'Roles',
    project: 'Projects',
    task: 'Tasks',
    attendance: 'Attendance',
    document: 'Documents',
    site_diary: 'Site Diary',
    settings: 'Settings',
    notification: 'Notifications',
    expense: 'Expenses',
    leave: 'Leave',
    salary: 'Salary',
    auth: 'Auth',
  };
  return map[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Other');
};

const humanize = (field: string): string => {
  if (!field) return field;
  const spaced = field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const norm = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);

export interface LogAuditParams {
  action: string;
  category: string;
  targetId?: string;
  targetName?: string;
  description: string;
  changes?: AuditChange[];
  meta?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'critical';
}

/** Records an audit entry. Never throws — logging must not break the caller. */
export const logAudit = async (p: LogAuditParams): Promise<void> => {
  try {
    const { appUser } = useAuthStore.getState();
    const actorId = appUser?.id ?? '';
    const actorName = (appUser?.name ?? '').trim() || 'System';
    // audit_logs now lives in Supabase (shared with the mobile app). Category is
    // stored as `target_type` — the table has no separate category column.
    await supabase.from('audit_logs').insert({
      id: crypto.randomUUID(),
      action: p.action,
      actor_id: actorId,
      actor_name: actorName,
      actor_role: appUser?.roleId ?? '',
      actor_avatar: appUser?.avatarUrl ?? '',
      target_id: p.targetId ?? '',
      target_type: p.category,
      target_name: p.targetName ?? '',
      description: p.description,
      changes: (p.changes ?? []).map((c) => ({
        field: c.field,
        label: c.label ?? humanize(c.field),
        from: norm(c.from),
        to: norm(c.to),
      })),
      meta: p.meta ?? {},
      severity: p.severity ?? 'info',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Best-effort: swallow. The primary operation has already succeeded.
    console.warn('logAudit failed (non-fatal):', err);
  }
};

/** Builds an AuditChange only when the value actually changed. */
export const diff = (
  field: string,
  from: unknown,
  to: unknown,
  label?: string,
): AuditChange[] =>
  String(from ?? '') === String(to ?? '')
    ? []
    : [{ field, label: label ?? humanize(field), from: norm(from), to: norm(to) }];

/**
 * Reads the most recent audit entries. Tolerant of BOTH the modern schema and
 * the legacy schema so historical entries from either client still render.
 */
export const fetchAuditLogs = async (pageLimit = 100): Promise<AuditLog[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(pageLimit);
    if (error) throw error;
    return (data ?? []).map((x: any) => {
      const rawChanges: any[] = Array.isArray(x.changes) ? x.changes : [];
      return {
        id: x.id,
        action: x.action ?? '',
        actorId: x.actor_id ?? '',
        actorName: x.actor_name ?? '',
        actorRole: x.actor_role ?? '',
        actorAvatar: x.actor_avatar ?? '',
        targetId: x.target_id ?? '',
        targetType: x.target_type ?? '',
        targetName: x.target_name ?? '',
        description: x.description ?? '',
        changes: rawChanges.map((c) => ({
          field: c.field ?? '',
          label: c.label ?? humanize(c.field ?? ''),
          from: c.from ?? null,
          to: c.to ?? null,
        })),
        meta: x.meta ?? {},
        severity: x.severity ?? 'info',
        // Wrap as a Firestore Timestamp so the UI's toDate() keeps working.
        createdAt: x.created_at ? Timestamp.fromDate(new Date(x.created_at)) : null,
      } as AuditLog;
    });
  } catch (err) {
    console.warn('Gracefully handled fetchAuditLogs error:', err);
    return [];
  }
};
