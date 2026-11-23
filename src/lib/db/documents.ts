import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Document as TDocument } from '../../types';
import { notifyPush } from '../push';
import { getProjects } from './projects';
import { Timestamp } from 'firebase/firestore'; // imported just for types or Timestamp mappings if still needed elsewhere

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


// ─── Documents ────────────────────────────────────────────────────────────────
export const getDocuments = async (projectId?: string): Promise<TDocument[]> => {
  try {
    const { firebaseUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;
    if (!uid) return [];

    const mapDoc = (d: any) => {
      const createdAt = d.created_at || d.uploaded_at || null;
      const url = d.url || d.file_url || '';
      const size = typeof d.size === 'number' ? d.size : (d.file_size || 0);
      
      // Simulate Firestore Timestamp for backward compatibility
      const timestampCreatedAt = createdAt ? Timestamp.fromDate(new Date(createdAt)) : null;

      return { 
        ...d,
        id: d.id,
        projectId: d.project_id,
        uploadedBy: d.uploaded_by,
        createdAt: timestampCreatedAt, 
        url, 
        size 
      } as TDocument;
    };

    const sortDocs = (docs: TDocument[]) => {
      return docs.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const timeB = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
    };

    if (permissions.docs_view_all) {
      let query = supabase.from('documents').select('*');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return sortDocs((data || []).map(mapDoc));
    }

    const docsMap = new Map<string, TDocument>();

    // Fetch my own uploads
    try {
      let query = supabase.from('documents').select('*').eq('uploaded_by', uid);
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      (data || []).forEach((d) => docsMap.set(d.id, mapDoc(d)));
    } catch (e) {
      logPermissionError('getDocuments (uploadedBy)', e);
    }

    // Fetch project docs
    if (projectId) {
      try {
        const { data, error } = await supabase.from('documents').select('*').eq('project_id', projectId);
        if (error) throw error;
        (data || []).forEach((d) => docsMap.set(d.id, mapDoc(d)));
      } catch (e) {
        logPermissionError('getDocuments (projectId)', e);
      }
    } else {
      // Need a replacement for getProjects() which is not imported here.
      // In original it was implicitly available or implicitly imported.
      // Assuming getProjects is available or we fallback to Supabase query for my projects.
      try {
        // We can fetch projects from Supabase if we want, but for now let's just 
        // ignore since getProjects() is not imported. 
        // @ts-ignore
        if (typeof getProjects !== 'undefined') {
          // @ts-ignore
          const myProjects = await getProjects();
          const myProjectIds = myProjects.map((p: any) => p.id);
          if (myProjectIds.length > 0) {
            const { data, error } = await supabase.from('documents').select('*').in('project_id', myProjectIds);
            if (!error && data) {
              data.forEach((d) => docsMap.set(d.id, mapDoc(d)));
            }
          }
        }
      } catch (e) {
        logPermissionError('getDocuments (projects chunk)', e);
      }
    }

    return sortDocs(Array.from(docsMap.values()));
  } catch (err: any) {
    console.warn('Gracefully handled getDocuments error:', err);
    return [];
  }
};

export const createDocument = async (data: Omit<TDocument, 'id'>): Promise<string> => {
  // documents columns: id, name, type, url, size, uploaded_by, project_id,
  // folder_id, labels, created_at, updated_at. Map explicitly — spreading
  // `...data` leaked camelCase keys (folderId, updatedAt, …) → 400.
  const d = data as any;
  const payload = {
    id: crypto.randomUUID(),
    name: d.name ?? '',
    type: d.type ?? 'other',
    url: d.url || '',
    size: d.size || 0,
    uploaded_by: d.uploadedBy ?? null,
    project_id: d.projectId ?? null,
    task_id: d.taskId ?? null,
    folder_id: d.folderId ?? d.folder ?? null,
    labels: d.labels ?? [],
  };

  const { data: inserted, error } = await supabase
    .from('documents')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return inserted.id;
};

export const updateDocument = async (id: string, data: Partial<TDocument>): Promise<void> => {
  // Explicit column map. The previous code spread `...data` (leaking camelCase
  // junk) AND set-then-deleted url/size, so those updates never persisted.
  const d = data as any;
  const updates: Record<string, any> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.type !== undefined) updates.type = d.type;
  if (d.url !== undefined) updates.url = d.url;
  if (d.size !== undefined) updates.size = d.size;
  if (d.uploadedBy !== undefined) updates.uploaded_by = d.uploadedBy;
  if (d.projectId !== undefined) updates.project_id = d.projectId;
  if (d.taskId !== undefined) updates.task_id = d.taskId;
  if (d.folderId !== undefined || d.folder !== undefined) updates.folder_id = d.folderId ?? d.folder;
  if (d.labels !== undefined) updates.labels = d.labels;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from('documents').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteDocument = async (id: string): Promise<void> => {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  const { data, error } = await supabase.storage.from('documents').upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
  return urlData.publicUrl;
};
