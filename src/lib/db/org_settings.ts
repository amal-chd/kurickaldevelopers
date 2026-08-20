import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { OrgSettings } from '../../types';

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

// ─── Org Settings ─────────────────────────────────────────────────────────────
export const getOrgSettings = async (): Promise<OrgSettings | null> => {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'org').single();
    if (error || !data) return null;
    return data as OrgSettings;
  } catch (err: any) {
    console.warn('Gracefully handled getOrgSettings error:', err);
    return null;
  }
};

export const updateOrgSettings = async (data: Partial<OrgSettings>): Promise<void> => {
  const { error } = await supabase.from('settings').upsert({ id: 'org', ...data });
  if (error) {
    logPermissionError('updateOrgSettings', error);
  }
};
