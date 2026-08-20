import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { SalarySlip } from '../../types';

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

export const createSalarySlip = async (
  data: Omit<SalarySlip, 'id' | 'createdAt'>,
): Promise<string> => {
  const insertData = toSnakeCase({ ...data, createdAt: new Date().toISOString() });
  const { data: result, error } = await supabase
    .from('salary_slips')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    logPermissionError('createSalarySlip', error, data);
    throw error;
  }
  return result.id;
};

export const getMySalarySlips = async (userId: string): Promise<SalarySlip[]> => {
  try {
    const { data, error } = await supabase
      .from('salary_slips')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      logPermissionError('getMySalarySlips', error, { userId });
      return [];
    }
    
    return (data || [])
      .map((d: any) => toCamelCase(d) as SalarySlip)
      .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  } catch (err: any) {
    console.warn('Gracefully handled getMySalarySlips error:', err);
    return [];
  }
};

export const getAllSalarySlips = async (): Promise<SalarySlip[]> => {
  try {
    const { data, error } = await supabase
      .from('salary_slips')
      .select('*');
      
    if (error) {
      logPermissionError('getAllSalarySlips', error);
      return [];
    }

    return (data || [])
      .map((d: any) => toCamelCase(d) as SalarySlip)
      .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  } catch (err: any) {
    console.warn('Gracefully handled getAllSalarySlips error:', err);
    return [];
  }
};

export const deleteSalarySlip = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('salary_slips')
    .delete()
    .eq('id', id);
    
  if (error) {
    logPermissionError('deleteSalarySlip', error, { id });
    throw error;
  }
};
