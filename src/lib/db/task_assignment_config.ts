import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { TaskAssignmentConfig } from '../../types';

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

// ─── Task Assignment Config ─────────────────────────────────────────────────
export const getTaskAssignmentConfig = async (): Promise<TaskAssignmentConfig | null> => {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'task_assignment').single();
  if (error || !data) return null;
  return data as TaskAssignmentConfig;
};

export const updateTaskAssignmentConfig = async (
  data: Partial<TaskAssignmentConfig>,
): Promise<void> => {
  const { error } = await supabase.from('settings').upsert({ id: 'task_assignment', ...data, updated_at: new Date().toISOString() });
  if (error) {
    logPermissionError('updateTaskAssignmentConfig', error);
  }
};

export const subscribeTaskAssignmentConfig = (
  cb: (config: TaskAssignmentConfig | null) => void,
) => {
  const channel = supabase.channel('task_assignment_config')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.task_assignment' }, (payload) => {
      cb(payload.new as TaskAssignmentConfig);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};
