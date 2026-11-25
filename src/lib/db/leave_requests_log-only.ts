import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { LeaveRequest } from '../../types';

const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === '42501' || error?.message?.includes('permission') || error?.message?.includes('denied');
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

function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
}
const serverTimestamp = () => new Date().toISOString();

export const createLeaveRequest = async (
  data: Omit<LeaveRequest, 'id' | 'createdAt'>,
): Promise<string> => {
  const insertData = toSnakeCase({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  //({ ...data, createdAt: new Date().toISOString() });
  const { data: result, error } = await supabase
    .from('leave_requests')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    logPermissionError('createLeaveRequest', error, data);
    throw error;
  }
  return result.id;
};

export const getMyLeaveRequests = async (userId: string): Promise<LeaveRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      logPermissionError('getMyLeaveRequests', error, { userId });
      return [];
    }
    
    return (data || [])
      .map((d: any) => toCamelCase(d) as LeaveRequest)
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  } catch (err: any) {
    console.warn('Gracefully handled getMyLeaveRequests error:', err);
    return [];
  }
};

export const getAllLeaveRequests = async (): Promise<LeaveRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*');
      
    if (error) {
      logPermissionError('getAllLeaveRequests', error);
      return [];
    }

    return (data || [])
      .map((d: any) => toCamelCase(d) as LeaveRequest)
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  } catch (err: any) {
    console.warn('Gracefully handled getAllLeaveRequests error:', err);
    return [];
  }
};

export const deleteLeaveRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id);
    
  if (error) {
    logPermissionError('deleteLeaveRequest', error, { id });
    throw error;
  }
};
