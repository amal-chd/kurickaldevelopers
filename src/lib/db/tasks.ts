import { Timestamp, QueryConstraint } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Task } from '../../types';
import { recalculatePerformanceScore } from './performance_score_and_points_engine';

const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.code === '42501' || error?.message?.includes('permission') || error?.message?.includes('denied');
  if (isPermissionError) {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    console.error(`[AUTHORIZATION ERROR] Action: ${actionName} failed with permission-denied.`, {
      errorMessage: error.message,
      errorCode: error.code,
      currentUserUid: firebaseUser?.uid ?? 'not-authenticated',
      currentUserRole: appUser?.roleId ?? 'no-role-assigned',
      userPermissions: permissions,
      context,
    });
  } else {
    console.warn(`[API ERROR] Action: ${actionName} failed.`, error, context);
  }
};

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const toIso = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return String(v);
};

const toTs = (v: any): Timestamp | undefined => {
  if (!v) return undefined;
  if (typeof v?.toDate === 'function') return v as Timestamp;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : Timestamp.fromDate(d);
};

// Legacy rows may carry `assigned_to` as a JSON array string or a bare uid.
const parseLegacyAssignedTo = (v: any): string[] | null => {
  if (!v) return null;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [String(v)];
  }
};

const progressFromRow = (raw: any): Task['memberProgress'] => {
  const out: NonNullable<Task['memberProgress']> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [uid, p] of Object.entries<any>(raw)) {
    if (!p || typeof p !== 'object') continue;
    out[uid] = {
      ...p,
      updatedAt: toTs(p.updatedAt),
      completedAt: toTs(p.completedAt),
    };
  }
  return out;
};

const progressToRow = (progress: Task['memberProgress']): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [uid, p] of Object.entries(progress ?? {})) {
    if (!p) continue;
    const entry: Record<string, any> = { status: p.status };
    if (p.updatedAt) entry.updatedAt = toIso(p.updatedAt);
    if (p.completedAt) entry.completedAt = toIso(p.completedAt);
    if (p.completedBy) entry.completedBy = p.completedBy;
    if (p.completionStatus) entry.completionStatus = p.completionStatus;
    if (p.delaySeconds !== undefined && p.delaySeconds !== null) entry.delaySeconds = p.delaySeconds;
    if (p.actualHours !== undefined && p.actualHours !== null) entry.actualHours = p.actualHours;
    out[uid] = entry;
  }
  return out;
};

const convertRowToTask = (row: any): Task => {
  return {
    ...row,
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    milestoneId: row.milestone_id,
    assigneeIds: row.assignee_ids?.length ? row.assignee_ids : (parseLegacyAssignedTo(row.assigned_to) ?? []),
    assignedRoleId: row.assigned_role_id,
    assignedRoleIds: row.assigned_role_ids || [],
    createdBy: row.created_by,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ? Timestamp.fromDate(new Date(row.due_date)) : null,
    estimatedHours: row.estimated_hours || 0,
    actualHours: row.actual_hours || 0,
    tags: row.labels || row.tags || [],
    dependsOn: row.depends_on || [],
    isRecurring: row.is_recurring || false,
    recurrenceRule: row.recurrence_rule,
    isTemplate: row.is_template || false,
    attachmentUrls: row.attachments || row.attachment_urls || [],
    createdAt: row.created_at ? Timestamp.fromDate(new Date(row.created_at)) : null,
    updatedAt: row.updated_at ? Timestamp.fromDate(new Date(row.updated_at)) : null,
    completedAt: toTs(row.completed_at),
    completionStatus: row.completion_status ?? undefined,
    delaySeconds: row.delay_seconds ?? undefined,
    memberProgress: progressFromRow(row.member_progress),

    isArchived: row.is_archived || false,
    rejectionReason: row.rejection_reason,
    rejectionCount: row.rejection_count || 0,
    reopenCount: row.reopen_count || 0,
    extensionCount: row.extension_count || 0,
    originalDueDate: row.original_due_date ? Timestamp.fromDate(new Date(row.original_due_date)) : null,
    peerReviewStatus: row.peer_review_status,
    managerReviewStatus: row.manager_review_status,
  } as unknown as Task;
};

// camelCase model key → [snake column, value transform].
const TASK_COLUMNS: Record<string, [string, (v: any) => any]> = {
  title: ['title', (v) => v],
  description: ['description', (v) => v],
  projectId: ['project_id', (v) => v],
  milestoneId: ['milestone_id', (v) => v],
  assigneeIds: ['assignee_ids', (v) => v || []],
  assignedRoleId: ['assigned_role_id', (v) => v ?? null],
  assignedRoleIds: ['assigned_role_ids', (v) => v || []],
  createdBy: ['created_by', (v) => v],
  status: ['status', (v) => v],
  priority: ['priority', (v) => v],
  dueDate: ['due_date', toIso],
  estimatedHours: ['estimated_hours', (v) => v || 0],
  actualHours: ['actual_hours', (v) => v || 0],
  tags: ['labels', (v) => v || []],
  dependsOn: ['depends_on', (v) => v || []],
  isRecurring: ['is_recurring', (v) => v || false],
  recurrenceRule: ['recurrence_rule', (v) => v ?? null],
  isTemplate: ['is_template', (v) => v || false],
  attachmentUrls: ['attachments', (v) => v || []],
  completedAt: ['completed_at', toIso],
  completionStatus: ['completion_status', (v) => v ?? null],
  delaySeconds: ['delay_seconds', (v) => (v === undefined ? null : v)],
  memberProgress: ['member_progress', progressToRow],
  isArchived: ['is_archived', (v) => v || false],
  rejectionReason: ['rejection_reason', (v) => v ?? null],
  rejectionCount: ['rejection_count', (v) => v || 0],
  reopenCount: ['reopen_count', (v) => v || 0],
  extensionCount: ['extension_count', (v) => v || 0],
  originalDueDate: ['original_due_date', toIso],
  peerReviewStatus: ['peer_review_status', (v) => v ?? null],
  managerReviewStatus: ['manager_review_status', (v) => v ?? null],
};

// Maps ONLY the keys present on `task`. This matters for updates: filling in
// defaults for absent keys (e.g. `assignee_ids: []`) turned every partial
// update — a status change, a comment-driven edit — into a wipe of the task's
// assignees, roles, labels, attachments and estimate.
// Never spread `...task` either — camelCase keys are not real columns and make
// PostgREST reject the whole write with a 400.
const convertTaskToRow = (task: any): any => {
  const row: Record<string, any> = {};
  for (const [key, [column, transform]] of Object.entries(TASK_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(task, key) && task[key] !== undefined) {
      row[column] = transform(task[key]);
    }
  }
  return row;
};

const applyConstraints = (queryObj: any, constraints: QueryConstraint[]) => {
  let q = queryObj;
  try {
    for (const c of constraints as any[]) {
      if (c.type === 'where' || c.type === 'whereFilter' || c._op) {
        const field = toSnakeCase(c._field?.segments?.[0] || c.field || c.operand?.name || '');
        const op = c._op || c.op;
        const val = c._value || c.value;
        if (field) {
          if (op === '==') q = q.eq(field, val);
          else if (op === '>') q = q.gt(field, val);
          else if (op === '<') q = q.lt(field, val);
          else if (op === '>=') q = q.gte(field, val);
          else if (op === '<=') q = q.lte(field, val);
          else if (op === 'array-contains') q = q.contains(field, [val]);
        }
      } else if (c.type === 'orderBy' || c._direction) {
        const field = toSnakeCase(c._field?.segments?.[0] || c.field || '');
        const dir = c._direction || c.direction || 'asc';
        if (field) {
          q = q.order(field, { ascending: dir === 'asc' });
        }
      } else if (c.type === 'limit' || c._limit) {
        const l = c._limit || c.limit;
        if (l) q = q.limit(l);
      }
    }
  } catch (err) {
    console.warn('Error parsing constraints for Supabase', err);
  }
  return q;
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = async (constraints: QueryConstraint[] = []): Promise<Task[]> => {
  try {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;
    const roleId = appUser?.roleId;

    if (!uid) return [];

    if (permissions.tasks_view_all) {
      try {
        let q = supabase.from('tasks').select('*');
        q = applyConstraints(q, constraints);
        q = q.order('created_at', { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(convertRowToTask);
      } catch (err: any) {
        logPermissionError('getTasks (tasks_view_all query)', err);
        return [];
      }
    }

    if (constraints.length > 0) {
      try {
        let q = supabase.from('tasks').select('*');
        q = applyConstraints(q, constraints);
        q = q.order('created_at', { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map(convertRowToTask);
      } catch (err: any) {
        logPermissionError('getTasks (constraints query)', err);
        return [];
      }
    }

    const tasksMap = new Map<string, Task>();

    try {
      const { data, error } = await supabase.from('tasks').select('*').contains('assignee_ids', [uid]);
      if (error) throw error;
      data?.forEach((d) => tasksMap.set(d.id, convertRowToTask(d)));
    } catch (err: any) {
      logPermissionError('getTasks (assignee query)', err);
    }

    if (roleId) {
      try {
        const { data, error } = await supabase.from('tasks').select('*').contains('assigned_role_ids', [roleId]);
        if (error) throw error;
        data?.forEach((d) => tasksMap.set(d.id, convertRowToTask(d)));
      } catch (err: any) {
        logPermissionError('getTasks (role query)', err);
      }
    }

    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('created_by', uid);
      if (error) throw error;
      data?.forEach((d) => tasksMap.set(d.id, convertRowToTask(d)));
    } catch (err: any) {
      logPermissionError('getTasks (created query)', err);
    }

    const tasks = Array.from(tasksMap.values());
    tasks.sort((a, b) => {
      const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
      const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
      return tb - ta;
    });

    return tasks;
  } catch (err: any) {
    logPermissionError('getTasks (top-level)', err);
    return [];
  }
};

export const getTask = async (id: string): Promise<Task | null> => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return convertRowToTask(data);
  } catch (err: any) {
    logPermissionError('getTask', err, { id });
    return null;
  }
};

export const createTask = async (data: Omit<Task, 'id'>): Promise<string> => {
  const rowData = convertTaskToRow(data);
  rowData.id = crypto.randomUUID();
  rowData.created_at = new Date().toISOString();
  rowData.updated_at = new Date().toISOString();

  const { data: insertedData, error } = await supabase
    .from('tasks')
    .insert([rowData])
    .select('id')
    .single();

  if (error) throw error;

  if (data.assigneeIds && data.assigneeIds.length > 0) {
    data.assigneeIds.forEach(uid => {
      try {
        if (typeof recalculatePerformanceScore === 'function') {
          recalculatePerformanceScore(uid).catch(err => console.warn('Error recalculating score on task create:', err));
        }
      } catch (e) {}
    });
  }
  return insertedData.id;
};

export const updateTask = async (id: string, data: Partial<Task>): Promise<void> => {
  const rowData = convertTaskToRow(data);
  // NEVER mutate the primary key on update. Previously this assigned a fresh
  // random UUID, which either violated the tasks.id foreign keys from
  // comments/subtasks/performance_reviews (update_rule NO ACTION → the whole
  // update threw) or silently re-keyed the row and orphaned it. This broke
  // every task edit — including assigning a role to an existing task.
  delete rowData.id;
  rowData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('tasks')
    .update(rowData)
    .eq('id', id);

  if (error) throw error;

  try {
    const { data: taskData } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (taskData) {
      const task = convertRowToTask(taskData);
      if (task.assigneeIds) {
        task.assigneeIds.forEach(uid => {
          try {
            if (typeof recalculatePerformanceScore === 'function') {
              recalculatePerformanceScore(uid).catch(err => console.warn('Error recalculating score on task update:', err));
            }
          } catch (e) {}
        });
      }
    }
  } catch (err) {
    console.warn('Error triggering recalculation in updateTask:', err);
  }
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
};

export const subscribeTasks = (cb: (tasks: Task[]) => void, constraints: QueryConstraint[] = []) => {
  const { firebaseUser, appUser, permissions } = useAuthStore.getState();
  const uid = firebaseUser?.uid;
  const roleId = appUser?.roleId;

  if (!uid) {
    cb([]);
    return () => {};
  }

  const fetchAndEmit = () => {
    getTasks(constraints).then(cb).catch(err => {
      logPermissionError('subscribeTasks fetch', err);
      cb([]);
    });
  };

  fetchAndEmit();

  const channel = supabase
    .channel(`public:tasks_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      fetchAndEmit();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
