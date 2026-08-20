import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Role } from '../../types';

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

// ─── Roles ────────────────────────────────────────────────────────────────────
export const getRole = async (roleId: string): Promise<Role | null> => {
  try {
    const { data, error } = await supabase.from('roles').select('*').eq('id', roleId).single();
    if (error || !data) return null;
    return data as Role;
  } catch (err: any) {
    console.warn('Gracefully handled getRole error:', err);
    return null;
  }
};

export const getAllRoles = async (): Promise<Role[]> => {
  try {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    return data as Role[];
  } catch (err: any) {
    console.warn('Gracefully handled getAllRoles error:', err);
    return [];
  }
};

export const createRole = async (data: Omit<Role, 'id'>): Promise<string> => {
  const { data: inserted, error } = await supabase.from('roles').insert([{ ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select('id').single();
  if (error) throw error;
  return inserted.id;
};

export const updateRole = async (roleId: string, data: Partial<Role>): Promise<void> => {
  const { error } = await supabase.from('roles').update(data).eq('id', roleId);
  if (error) throw error;
};

export const deleteRole = async (roleId: string): Promise<void> => {
  const { error } = await supabase.from('roles').delete().eq('id', roleId);
  if (error) throw error;
};
