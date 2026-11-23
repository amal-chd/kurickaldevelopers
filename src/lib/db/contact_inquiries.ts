import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { ContactInquiry } from '../../types';

class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }
  static now() {
    return Timestamp.fromDate(new Date());
  }
  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
  }
  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1000000;
  }
}

// Helper to log detailed, production-grade diagnostic information for permission/authorization errors
const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.message?.includes('permission') || error?.message?.includes('policy') || error?.message?.includes('denied');
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

// ─── Contact Inquiries ────────────────────────────────────────────────────────
export const createContactInquiry = async (
  data: Omit<ContactInquiry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  // Map camelCase → real columns (project_type, assigned_to). Spreading `...data`
  // sent projectType/assignedTo which are not columns → 400.
  const d = data as any;
  const { data: result, error } = await supabase
    .from('contact_inquiries')
    .insert({
      id: crypto.randomUUID(),
      name: d.name,
      phone: d.phone,
      email: d.email ?? null,
      project_type: d.projectType ?? null,
      message: d.message ?? '',
      status: d.status ?? 'new',
      source: d.source ?? 'website',
      assigned_to: d.assignedTo ?? null,
      notes: d.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    logPermissionError('createContactInquiry', error, { data });
    throw error;
  }
  return result.id;
};

export const getContactInquiries = async (): Promise<ContactInquiry[]> => {
  try {
    const { data, error } = await supabase
      .from('contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      email: d.email,
      projectType: d.project_type,
      message: d.message,
      status: d.status,
      source: d.source,
      assignedTo: d.assigned_to,
      notes: d.notes,
      createdAt: d.created_at ? Timestamp.fromDate(new Date(d.created_at)) : Timestamp.now(),
      updatedAt: d.updated_at ? Timestamp.fromDate(new Date(d.updated_at)) : Timestamp.now(),
    })) as ContactInquiry[];
  } catch (err: any) {
    console.warn('Gracefully handled getContactInquiries error:', err);
    return [];
  }
};

export const updateContactInquiry = async (
  id: string,
  data: Partial<ContactInquiry>
): Promise<void> => {
  // Explicit column map — the camelCase Partial can't be spread into the row.
  const d = data as any;
  const updateData: any = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) updateData.name = d.name;
  if (d.phone !== undefined) updateData.phone = d.phone;
  if (d.email !== undefined) updateData.email = d.email;
  if (d.projectType !== undefined) updateData.project_type = d.projectType;
  if (d.message !== undefined) updateData.message = d.message;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.source !== undefined) updateData.source = d.source;
  if (d.assignedTo !== undefined) updateData.assigned_to = d.assignedTo;
  if (d.notes !== undefined) updateData.notes = d.notes;

  const { error } = await supabase
    .from('contact_inquiries')
    .update(updateData)
    .eq('id', id);
    
  if (error) {
    logPermissionError('updateContactInquiry', error, { id, data });
    throw error;
  }
};

export const deleteContactInquiry = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('contact_inquiries')
    .delete()
    .eq('id', id);
    
  if (error) {
    logPermissionError('deleteContactInquiry', error, { id });
    throw error;
  }
};
