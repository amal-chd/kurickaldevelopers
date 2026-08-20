import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { TaskComment } from '../../types';
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


// ─── Comments ─────────────────────────────────────────────────────────────────
export const getComments = async (taskId: string): Promise<TaskComment[]> => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return (data || []).map(d => ({
      ...d,
      id: d.id,
      taskId: d.task_id,
      authorId: d.author_id,
      createdAt: d.created_at,
    })) as unknown as TaskComment[];
  } catch (err: any) {
    console.warn('Gracefully handled getComments error:', err);
    return [];
  }
};

export const addComment = async (taskId: string, data: Omit<TaskComment, 'id' | 'createdAt'>, authorId?: string): Promise<string> => {
  const effectiveAuthorId = authorId || data.authorId || '';
  const payload = {
    ...data,
    task_id: taskId,
    id: crypto.randomUUID(),
    author_id: effectiveAuthorId,
    // created_at is default in Supabase
  };
  delete (payload as any).authorId;
  delete (payload as any).taskId;

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  const newId = inserted.id;

  try {
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('assignee_ids, created_by, title')
      .eq('id', taskId)
      .single();
      
    if (!taskError && taskData) {
      const assigneeIds: string[] = taskData.assignee_ids || [];
      const createdBy: string = taskData.created_by || '';
      const title: string = taskData.title || 'Task';

      notifyPush({ event: 'task', taskId, kind: 'comment_added' });

      const notifySet = new Set([...assigneeIds, ...(createdBy ? [createdBy] : [])].filter(Boolean));
      for (const uid of notifySet) {
        if (uid === effectiveAuthorId || !uid) continue;
        // @ts-ignore
        if (typeof createNotification !== 'undefined') {
          // @ts-ignore
          await createNotification({
            userId: uid,
            type: 'task_updated',
            title: 'New Comment on Task',
            body: `New comment on "${title}"`,
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

  return newId;
};

export const subscribeComments = (taskId: string, cb: (comments: TaskComment[]) => void) => {
  const channel = supabase.channel(`comments:task_id=eq.${taskId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` }, async () => {
      const data = await getComments(taskId);
      cb(data);
    })
    .subscribe();

  // Call initially
  getComments(taskId).then(cb).catch(console.warn);
    
  return () => {
    supabase.removeChannel(channel);
  };
};
