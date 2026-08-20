import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Subtask } from '../../types';
import { notifyPush } from '../push';

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
  const payload = {
    ...data,
    task_id: taskId,
    is_done: data.isDone || false,
    completed_by: data.completedBy || null,
  };
  delete (payload as any).isDone;
  delete (payload as any).completedBy;
  delete (payload as any).taskId;

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
        .select('assignee_ids, title')
        .eq('id', taskId)
        .single();
        
      if (!taskError && taskData) {
        const assigneeIds: string[] = taskData.assignee_ids || [];
        const title: string = taskData.title || 'Task';

        notifyPush({ event: 'task', taskId, kind: 'subtask_added' });

        for (const uid of new Set(assigneeIds)) {
          if (uid === addedByUid || !uid) continue;
          // @ts-ignore
          if (typeof createNotification !== 'undefined') {
            // @ts-ignore
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
      }
    } catch (_) {
      // Best effort notification delivery
    }
  }

  return newId;
};

export const updateSubtask = async (taskId: string, subtaskId: string, data: Partial<Subtask>): Promise<void> => {
  const payload: any = { ...data };
  if (payload.isDone !== undefined) {
    payload.is_done = payload.isDone;
    delete payload.isDone;
  }
  if (payload.completedBy !== undefined) {
    payload.completed_by = payload.completedBy;
    delete payload.completedBy;
  }
  
  const { error } = await supabase
    .from('subtasks')
    .update(payload)
    .eq('id', subtaskId)
    .eq('task_id', taskId);
    
  if (error) throw error;
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
  const channel = supabase.channel(`subtasks:task_id=eq.${taskId}`)
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
