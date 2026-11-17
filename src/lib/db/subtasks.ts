import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Subtask } from '../../types';
import { notifyPush } from '../push';
import { createNotification } from './notifications';

// Helper to log detailed, production-grade diagnostic information for permission/authorization errors
const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.message?.includes('permission') || error?.message?.includes('denied');
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


// ─── Subtasks ─────────────────────────────────────────────────────────────────
export const getSubtasks = async (taskId: string): Promise<Subtask[]> => {
  try {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId);
    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      id: d.id,
      taskId: d.task_id,
      isDone: d.is_done,
      completedBy: d.completed_by,
      createdAt: d.created_at,
    })) as unknown as Subtask[];
  } catch (err: any) {
    console.warn('Gracefully handled getSubtasks error:', err);
    return [];
  }
};

export const addSubtask = async (taskId: string, data: Omit<Subtask, 'id'>, addedByUid?: string): Promise<string> => {
  // subtasks columns: id, task_id, title, is_done, completed_by. Map explicitly
  // — spreading `...data` leaked camelCase keys (createdAt, taskId) that are not
  // columns and 400'd the insert.
  const payload = {
    id: crypto.randomUUID(),
    task_id: taskId,
    title: (data as any).title ?? '',
    is_done: data.isDone || false,
    completed_by: data.completedBy || null,
  };

  const { data: inserted, error } = await supabase
    .from('subtasks')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  const newId = inserted.id;

  if (addedByUid) {
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('assignee_ids, assigned_role_ids, assigned_role_id, created_by, title')
        .eq('id', taskId)
        .single();
        
      if (!taskError && taskData) {
        const title: string = taskData.title || 'Task';
        const recipients = new Set<string>();

        if (Array.isArray(taskData.assignee_ids)) {
          taskData.assignee_ids.forEach((id: string) => recipients.add(id));
        }
        if (taskData.created_by) {
          recipients.add(taskData.created_by);
        }

        const roleIds: string[] = taskData.assigned_role_ids || [];
        if (taskData.assigned_role_id) roleIds.push(taskData.assigned_role_id);
        if (roleIds.length > 0) {
          const { data: roleUsers } = await supabase
            .from('users')
            .select('id')
            .in('role_id', roleIds)
            .eq('is_active', true);
          if (roleUsers) {
            roleUsers.forEach((u: { id: string }) => recipients.add(u.id));
          }
        }

        notifyPush({ event: 'task', taskId, kind: 'subtask_added' });

        for (const uid of recipients) {
          if (uid === addedByUid || !uid) continue;
          await createNotification({
            userId: uid,
            type: 'task_updated',
            title: 'New Subtask Added',
            body: `A subtask "${data.title}" was added to: ${title}`,
            relatedId: taskId,
            isRead: {},
            createdAt: null as any,
          });
        }
      }
    } catch (_) {
      // Best effort notification delivery
    }
  }

  return newId;
};

export const updateSubtask = async (
  taskId: string, 
  subtaskId: string, 
  data: Partial<Subtask>, 
  updatedByUid?: string,
  subtaskTitle?: string
): Promise<void> => {
  // Only touch real columns — never spread the camelCase Partial wholesale.
  const payload: any = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.isDone !== undefined) payload.is_done = data.isDone;
  if (data.completedBy !== undefined) payload.completed_by = data.completedBy;

  const { error } = await supabase
    .from('subtasks')
    .update(payload)
    .eq('id', subtaskId)
    .eq('task_id', taskId);
    
  if (error) throw error;

  if (data.isDone === true && updatedByUid) {
    try {
      const { data: taskData } = await supabase
        .from('tasks')
        .select('assignee_ids, assigned_role_ids, assigned_role_id, created_by, title')
        .eq('id', taskId)
        .single();
        
      if (taskData) {
        const title: string = taskData.title || 'Task';
        const recipients = new Set<string>();

        if (Array.isArray(taskData.assignee_ids)) {
          taskData.assignee_ids.forEach((id: string) => recipients.add(id));
        }
        if (taskData.created_by) {
          recipients.add(taskData.created_by);
        }

        const roleIds: string[] = taskData.assigned_role_ids || [];
        if (taskData.assigned_role_id) roleIds.push(taskData.assigned_role_id);
        if (roleIds.length > 0) {
          const { data: roleUsers } = await supabase
            .from('users')
            .select('id')
            .in('role_id', roleIds)
            .eq('is_active', true);
          if (roleUsers) {
            roleUsers.forEach((u: { id: string }) => recipients.add(u.id));
          }
        }

        notifyPush({ event: 'task', taskId, kind: 'subtask_completed' });

        for (const uid of recipients) {
          if (uid === updatedByUid || !uid) continue;
          await createNotification({
            userId: uid,
            type: 'task_updated',
            title: 'Subtask Completed',
            body: `Subtask "${subtaskTitle || 'Subtask'}" marked completed on: ${title}`,
            relatedId: taskId,
            isRead: {},
            createdAt: null as any,
          });
        }
      }
    } catch (_) {
      // Best effort notification
    }
  }
};

export const deleteSubtask = async (taskId: string, subtaskId: string): Promise<void> => {
  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', subtaskId)
    .eq('task_id', taskId);
    
  if (error) throw error;
};

export const subscribeSubtasks = (taskId: string, cb: (subtasks: Subtask[]) => void) => {
  const channel = supabase.channel(`subtasks_${taskId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks', filter: `task_id=eq.${taskId}` }, async () => {
      const data = await getSubtasks(taskId);
      cb(data);
    })
    .subscribe();
    
  // Call initially
  getSubtasks(taskId).then(cb).catch(console.warn);

  return () => {
    supabase.removeChannel(channel);
  };
};
