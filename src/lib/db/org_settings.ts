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
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'org').maybeSingle();
    if (error || !data) return null;
    return {
      companyName: data.company_name,
      companyLogo: data.company_logo,
      timezone: data.timezone,
      workStartTime: data.work_start_time,
      workEndTime: data.work_end_time,
      geofenceRadius: data.geofence_radius,
      geofenceLat: data.geofence_lat,
      geofenceLng: data.geofence_lng,
                                        } as OrgSettings;
  } catch (err: any) {
    console.warn('Gracefully handled getOrgSettings error:', err);
    return null;
  }
};

export const updateOrgSettings = async (data: Partial<OrgSettings>): Promise<void> => {
  const payload: any = { id: 'org' };
  if (data.companyName !== undefined) payload.company_name = data.companyName;
  if (data.companyLogo !== undefined) payload.company_logo = data.companyLogo;
  if (data.timezone !== undefined) payload.timezone = data.timezone;
  if (data.workStartTime !== undefined) payload.work_start_time = data.workStartTime;
  if (data.workEndTime !== undefined) payload.work_end_time = data.workEndTime;
  if (data.geofenceRadius !== undefined) payload.geofence_radius = data.geofenceRadius;
  if (data.geofenceLat !== undefined) payload.geofence_lat = data.geofenceLat;
  if (data.geofenceLng !== undefined) payload.geofence_lng = data.geofenceLng;
            
  const { error } = await supabase.from('settings').upsert(payload);
  if (error) {
    logPermissionError('updateOrgSettings', error);
  }
};
