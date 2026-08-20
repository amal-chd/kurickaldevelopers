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
  const project: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const camelKey = toCamelCase(key);
      if (row[key] !== null && (key === 'created_at' || key === 'updated_at' || key === 'start_date' || key === 'end_date' || (typeof row[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(row[key])))) {
        project[camelKey] = Timestamp.fromDate(new Date(row[key]));
      } else {
        project[camelKey] = row[key];
      }
    }
  }
  return project as Project;
};

const convertProjectToRow = (project: any): any => {
  const row: any = {};
  for (const key in project) {
    if (Object.prototype.hasOwnProperty.call(project, key)) {
      const snakeKey = toSnakeCase(key);
      if (project[key] instanceof Timestamp || (project[key] && typeof project[key].toDate === 'function')) {
        row[snakeKey] = project[key].toDate().toISOString();
      } else {
        row[snakeKey] = project[key];
      }
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
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
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
    .channel('public:projects')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
      // Re-fetch on change
      getProjects().then(cb);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
