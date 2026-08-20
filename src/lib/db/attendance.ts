import { Timestamp } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { Attendance } from '../../types';

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

const convertRowToAttendance = (row: any): Attendance => {
  const attendance: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const camelKey = toCamelCase(key);
      if (row[key] !== null && (key === 'created_at' || key === 'updated_at' || key === 'timestamp' || (typeof row[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(row[key])))) {
        attendance[camelKey] = Timestamp.fromDate(new Date(row[key]));
      } else {
        attendance[camelKey] = row[key];
      }
    }
  }
  return attendance as Attendance;
};

const convertAttendanceToRow = (attendance: any): any => {
  const row: any = {};
  for (const key in attendance) {
    if (Object.prototype.hasOwnProperty.call(attendance, key)) {
      const snakeKey = toSnakeCase(key);
      if (attendance[key] instanceof Timestamp || (attendance[key] && typeof attendance[key].toDate === 'function')) {
        row[snakeKey] = attendance[key].toDate().toISOString();
      } else {
        row[snakeKey] = attendance[key];
      }
    }
  }
  return row;
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const getAttendance = async (date?: string, userId?: string): Promise<Attendance[]> => {
  try {
    let query = supabase.from('attendance').select('*');
    if (date) query = query.eq('date', date);
    if (userId) query = query.eq('user_id', userId);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(convertRowToAttendance);
  } catch (err: any) {
    console.warn('Gracefully handled getAttendance error:', err);
    return [];
  }
};

export const subscribeAttendance = (date: string, cb: (records: Attendance[]) => void) => {
  getAttendance(date).then(cb).catch(err => {
    logPermissionError('subscribeAttendance initial', err);
    cb([]);
  });

  const channel = supabase
    .channel(`public:attendance:${date}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `date=eq.${date}` }, () => {
      getAttendance(date).then(cb).catch(err => {
        logPermissionError('subscribeAttendance realtime', err);
        cb([]);
      });
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateAttendance = async (id: string, data: Partial<Attendance>): Promise<void> => {
  const rowData = convertAttendanceToRow(data);
  const { error } = await supabase.from('attendance').update(rowData).eq('id', id);
  if (error) throw error;
};

export const getUserAttendanceHistory = async (userId: string, limit2 = 30): Promise<Attendance[]> => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit2);
      
    if (error) throw error;
    
    return (data || []).map(convertRowToAttendance);
  } catch (err: any) {
    console.warn('Gracefully handled getUserAttendanceHistory error:', err);
    return [];
  }
};
