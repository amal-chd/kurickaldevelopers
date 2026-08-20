import { Timestamp, QueryConstraint } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Task } from '../../types';

// Declare anything that was used implicitly or missing in imports but present in original code
declare function recalculatePerformanceScore(uid: string): Promise<void>;

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

const convertRowToTask = (row: any): Task => {
  return {
    ...row,
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    milestoneId: row.milestone_id,
    assigneeIds: row.assigned_to ? JSON.parse(row.assigned_to) : (row.assignee_ids || []),
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

const convertTaskToRow = (task: any): any => {
  return {
    ...task,
    title: task.title,
    description: task.description,
    project_id: task.projectId,
    milestone_id: task.milestoneId,
    assignee_ids: task.assigneeIds || [],
    assigned_role_id: task.assignedRoleId,
    assigned_role_ids: task.assignedRoleIds || [],
    created_by: task.createdBy,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate?.toDate ? task.dueDate.toDate().toISOString() : task.dueDate,
    estimated_hours: task.estimatedHours || 0,
    actual_hours: task.actualHours || 0,
    labels: task.tags || [],
    depends_on: task.dependsOn || [],
    is_recurring: task.isRecurring || false,
    recurrence_rule: task.recurrenceRule,
    is_template: task.isTemplate || false,
    attachments: task.attachmentUrls || [],
    
    is_archived: task.isArchived || false,
    rejection_reason: task.rejectionReason,
    rejection_count: task.rejectionCount || 0,
    reopen_count: task.reopenCount || 0,
    extension_count: task.extensionCount || 0,
    original_due_date: task.originalDueDate?.toDate ? task.originalDueDate.toDate().toISOString() : task.originalDueDate,
    peer_review_status: task.peerReviewStatus,
    manager_review_status: task.managerReviewStatus,
  };
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
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
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
  rowData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('tasks')
    .update(rowData)
    .eq('id', id);

  if (error) throw error;

  try {
    const { data: taskData } = await supabase.from('tasks').select('*').eq('id', id).single();
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
    .channel('public:tasks')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      fetchAndEmit();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
