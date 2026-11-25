import { Timestamp } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Project } from '../../types';

const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.code === '42501' || error?.message?.includes('permission') || error?.message?.includes('denied');
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

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const convertRowToProject = (row: any): Project => {
  return {
    ...row,
    id: row.id,
    name: row.name,
    description: row.description,
    siteAddress: row.location || row.site_address,
    clientName: row.client_name,
    status: row.status,
    startDate: row.start_date ? Timestamp.fromDate(new Date(row.start_date)) : null,
    expectedEndDate: row.end_date ? Timestamp.fromDate(new Date(row.end_date)) : null,
    actualEndDate: row.actual_end_date ? Timestamp.fromDate(new Date(row.actual_end_date)) : undefined,
    memberIds: row.member_ids || [],
    projectManagerId: row.manager_id,
    progressPercent: row.progress_percent || 0,
    healthStatus: row.health_status || 'on_track',
    budget: row.budget,
    createdAt: row.created_at ? Timestamp.fromDate(new Date(row.created_at)) : null,
    siteCoordinates: row.site_coordinates,
  } as unknown as Project;
};

const isoOrRaw = (v: any) => (v?.toDate ? v.toDate().toISOString() : v);

// camelCase model key → [snake column, value transform].
const PROJECT_COLUMNS: Record<string, [string, (v: any) => any]> = {
  name: ['name', (v) => v],
  description: ['description', (v) => v],
  siteAddress: ['location', (v) => v],
  clientName: ['client_name', (v) => v],
  status: ['status', (v) => v],
  startDate: ['start_date', isoOrRaw],
  expectedEndDate: ['end_date', isoOrRaw],
  actualEndDate: ['actual_end_date', isoOrRaw],
  memberIds: ['member_ids', (v) => v || []],
  projectManagerId: ['manager_id', (v) => v],
  progressPercent: ['progress_percent', (v) => v || 0],
  healthStatus: ['health_status', (v) => v || 'on_track'],
  budget: ['budget', (v) => v],
  siteCoordinates: ['site_coordinates', (v) => v],
};

// Maps ONLY the keys present, so a partial update can never reset members,
// progress or health to defaults. Do not spread `...project` either —
// camelCase keys are not columns and 400 the whole write.
const convertProjectToRow = (project: any): any => {
  const row: Record<string, any> = {};
  for (const [key, [column, transform]] of Object.entries(PROJECT_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(project, key) && project[key] !== undefined) {
      row[column] = transform(project[key]);
    }
  }
  return row;
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const getProjects = async (): Promise<Project[]> => {
  try {
    const { firebaseUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;

    if (!uid) return [];

    let query = supabase.from('projects').select('*');
    
    if (permissions.projects_view_all) {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.contains('member_ids', [uid]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const projects = (data || []).map(convertRowToProject);

    if (!permissions.projects_view_all) {
      projects.sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
        return tb - ta;
      });
    }

    return projects;
  } catch (err: any) {
    console.warn('Gracefully handled getProjects error:', err);
    return [];
  }
};

export const getProject = async (id: string): Promise<Project | null> => {
  try {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return convertRowToProject(data);
  } catch (err: any) {
    console.warn('Gracefully handled getProject error:', err);
    return null;
  }
};

export const createProject = async (data: Omit<Project, 'id'>): Promise<string> => {
  const rowData = convertProjectToRow(data);
  rowData.id = crypto.randomUUID();
  rowData.created_at = new Date().toISOString();
  
  const { data: insertedData, error } = await supabase
    .from('projects')
    .insert([rowData])
    .select('id')
    .single();
    
  if (error) throw error;
  return insertedData.id;
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<void> => {
  const rowData = convertProjectToRow(data);
  
  const { error } = await supabase
    .from('projects')
    .update(rowData)
    .eq('id', id);
    
  if (error) throw error;
};

export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
};

export const subscribeProjects = (cb: (projects: Project[]) => void) => {
  const { firebaseUser, permissions } = useAuthStore.getState();
  const uid = firebaseUser?.uid;

  if (!uid) {
    cb([]);
    return () => {};
  }

  // Initial fetch
  getProjects().then(cb);

  const channel = supabase
    .channel(`public:projects_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
      // Re-fetch on change
      getProjects().then(cb);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
