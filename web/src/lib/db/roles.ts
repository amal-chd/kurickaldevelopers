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
// Map snake_case row → camelCase Role so isSystem/createdBy/createdAt are
// populated (raw casting left them undefined — e.g. system-role protection
// relies on isSystem).
const mapRoleFromRow = (d: any): Role => ({
  ...d,
  id: d.id,
  createdBy: d.created_by,
  isSystem: d.is_system,
  createdAt: d.created_at,
}) as unknown as Role;

export const getRole = async (roleId: string): Promise<Role | null> => {
  try {
    const { data, error } = await supabase.from('roles').select('*').eq('id', roleId).maybeSingle();
    if (error || !data) return null;
    return mapRoleFromRow(data);
  } catch (err: any) {
    console.warn('Gracefully handled getRole error:', err);
    return null;
  }
};

export const getAllRoles = async (): Promise<Role[]> => {
  try {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    return (data || []).map(mapRoleFromRow);
  } catch (err: any) {
    console.warn('Gracefully handled getAllRoles error:', err);
    return [];
  }
};

// roles columns: id, name, permissions, level, created_at, description, color,
// created_by, is_system. Map explicitly — spreading the camelCase Role leaked
// createdBy/isSystem (not columns) and 400'd create/update.
const roleToRow = (data: any): any => {
  const row: any = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.permissions !== undefined) row.permissions = data.permissions;
  if (data.level !== undefined) row.level = data.level;
  if (data.description !== undefined) row.description = data.description;
  if (data.color !== undefined) row.color = data.color;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.isSystem !== undefined) row.is_system = data.isSystem;
  return row;
};

export const createRole = async (data: Omit<Role, 'id'>): Promise<string> => {
  const { data: inserted, error } = await supabase.from('roles').insert([{ ...roleToRow(data), id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select('id').single();
  if (error) throw error;
  return inserted.id;
};

export const updateRole = async (roleId: string, data: Partial<Role>): Promise<void> => {
  const { error } = await supabase.from('roles').update(roleToRow(data)).eq('id', roleId);
  if (error) throw error;
};

export const deleteRole = async (roleId: string): Promise<void> => {
  const { error } = await supabase.from('roles').delete().eq('id', roleId);
  if (error) throw error;
};
