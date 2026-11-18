import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { TaskComment } from '../../types';
import { notifyPush } from '../push';
import { createNotification } from './notifications';
import { getAllUsers } from './users';

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
      text: d.text,
      mentions: d.mentions || [],
      attachmentUrls: d.attachment_urls || [],
      createdAt: d.created_at,
      editedAt: d.edited_at,
    })) as unknown as TaskComment[];
  } catch (err: any) {
    console.warn('Gracefully handled getComments error:', err);
    return [];
  }
};

export const addComment = async (taskId: string, data: Omit<TaskComment, 'id' | 'createdAt'>, authorId?: string): Promise<string> => {
  const effectiveAuthorId = authorId || data.authorId || '';
  const d = data as any;
  // Map explicitly to real columns. Spreading `...data` leaked camelCase keys
  // (attachmentUrls, editedAt) that are not columns and 400'd the insert.
  const payload = {
    id: crypto.randomUUID(),
    task_id: taskId,
    author_id: effectiveAuthorId,
    text: d.text ?? '',
    mentions: d.mentions ?? [],
    attachment_urls: d.attachmentUrls ?? [],
    // created_at is default in Supabase
  };

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
      .select('assignee_ids, assigned_role_ids, assigned_role_id, created_by, title')
      .eq('id', taskId)
      .single();
      
    if (!taskError && taskData) {
      const title: string = taskData.title || 'Task';
      const notifySet = new Set<string>();

      if (Array.isArray(taskData.assignee_ids)) {
        taskData.assignee_ids.forEach((id: string) => notifySet.add(id));
      }
      if (taskData.created_by) {
        notifySet.add(taskData.created_by);
      }

      const roleIds: string[] = taskData.assigned_role_ids || [];
      if (taskData.assigned_role_id) roleIds.push(taskData.assigned_role_id);
      if (roleIds.length > 0) {
        // Users live in Firestore, not Supabase (`users` table does not exist in Postgres)
        const allUsers = await getAllUsers();
        allUsers
          .filter((u) => u.isActive !== false && u.roleId && roleIds.includes(u.roleId))
          .forEach((u) => notifySet.add(u.id));
      }

      notifyPush({ event: 'task', taskId, kind: 'comment_added' });

      for (const uid of notifySet) {
        if (uid === effectiveAuthorId || !uid) continue;
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
  } catch (_) {
    // Best effort notification delivery
  }

  return newId;
};

export const updateComment = async (taskId: string, commentId: string, text: string): Promise<void> => {
  const { error } = await supabase
    .from('comments')
    .update({
      text,
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('task_id', taskId);

  if (error) {
    logPermissionError('updateComment', error, { taskId, commentId });
    throw error;
  }
};

export const deleteComment = async (taskId: string, commentId: string): Promise<void> => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('task_id', taskId);

  if (error) {
    logPermissionError('deleteComment', error, { taskId, commentId });
    throw error;
  }
};

export const subscribeComments = (taskId: string, cb: (comments: TaskComment[]) => void) => {
  const channel = supabase.channel(`comments_${taskId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
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
