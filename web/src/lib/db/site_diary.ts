import { Timestamp } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { SiteDiaryEntry } from '../../types';

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

const mapSiteDiaryFromDB = (data: any): SiteDiaryEntry => {
  return {
    id: data.id,
    projectId: data.project_id,
    date: data.date,
    weather: data.weather,
    progressNotes: data.progress_notes || data.work_done || '',
    workerCount: data.worker_count ?? data.manpower ?? 0,
    issuesNotes: data.issues_notes || '',
    safetyNotes: data.safety_notes || data.remarks || '',
    temperature: data.temperature ?? null,
    photoUrls: data.photo_urls ?? [],
    authorId: data.author_id || data.created_by || "",
    createdAt: data.created_at ? Timestamp.fromDate(new Date(data.created_at)) : null,
    updatedAt: data.updated_at ? Timestamp.fromDate(new Date(data.updated_at)) : null,
    
    // Fallbacks for legacy fields for compatibility
    workDone: data.progress_notes || data.work_done || '',
    manpower: data.worker_count ?? data.manpower ?? 0,
    remarks: data.safety_notes || data.remarks || '',
  } as unknown as SiteDiaryEntry;
};

export const getSiteDiary = async (projectId?: string): Promise<SiteDiaryEntry[]> => {
  try {
    let query = supabase.from('site_diaries').select('*');
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    return data.map(mapSiteDiaryFromDB).sort((a, b) => {
      return (b.date || '').localeCompare(a.date || '');
    });
  } catch (err: any) {
    console.warn('Gracefully handled getSiteDiary error:', err);
    return [];
  }
};

export const createSiteDiary = async (data: Omit<SiteDiaryEntry, 'id'>): Promise<string> => {
  const payload = {
    id: crypto.randomUUID(),
    project_id: data.projectId,
    date: data.date,
    weather: data.weather,
    author_id: data.authorId || (data as any).createdBy || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    progress_notes: data.progressNotes || '',
    worker_count: data.workerCount ?? 0,
    issues_notes: data.issuesNotes || '',
    safety_notes: data.safetyNotes || '',
    temperature: data.temperature,
    photo_urls: data.photoUrls,
    // Also write legacy fields
    work_done: data.progressNotes || '',
    manpower: data.workerCount ?? 0,
    remarks: data.safetyNotes || '',
  };
  
  const { data: res, error } = await supabase.from('site_diaries').insert(payload).select('id').single();
  if (error) throw error;
  return res.id;
};

export const updateSiteDiary = async (id: string, data: Partial<SiteDiaryEntry>): Promise<void> => {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  
  if (data.projectId !== undefined) updates.project_id = data.projectId;
  if (data.date !== undefined) updates.date = data.date;
  if (data.weather !== undefined) updates.weather = data.weather;
  if (data.progressNotes !== undefined) {
    updates.progress_notes = data.progressNotes;
    updates.work_done = data.progressNotes;
  }
  if (data.workerCount !== undefined) {
    updates.worker_count = data.workerCount;
    updates.manpower = data.workerCount;
  }
  if (data.issuesNotes !== undefined) updates.issues_notes = data.issuesNotes;
  if (data.safetyNotes !== undefined) {
    updates.safety_notes = data.safetyNotes;
    updates.remarks = data.safetyNotes;
  }
  if (data.temperature !== undefined) updates.temperature = data.temperature;
  if (data.photoUrls !== undefined) updates.photo_urls = data.photoUrls;

  const { error } = await supabase.from('site_diaries').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteSiteDiary = async (id: string): Promise<void> => {
  const { error } = await supabase.from('site_diaries').delete().eq('id', id);
  if (error) throw error;
};
