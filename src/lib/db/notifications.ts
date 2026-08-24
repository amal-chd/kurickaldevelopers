import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { AppNotification } from '../../types';

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

// ─── Notifications ────────────────────────────────────────────────────────────
export const subscribeNotifications = (userId: string, cb: (notifs: AppNotification[]) => void) => {
  const results: Record<'broadcast' | 'targeted', AppNotification[]> = {
    broadcast: [],
    targeted: [],
  };

  const emit = () => {
    const merged = [...results.broadcast, ...results.targeted]
      .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) // deduplicate
      .sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 100);
    cb(merged);
  };

  const fetchInitial = async () => {
    try {
      const { data: broadcastData } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', '')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (broadcastData) {
        results.broadcast = broadcastData.map((d: any) => ({
          ...d,
          userId: d.user_id,
          isRead: d.is_read || {},
          createdAt: d.created_at ? Timestamp.fromDate(new Date(d.created_at)) : Timestamp.now(),
        } as AppNotification));
      }

      const { data: targetedData } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (targetedData) {
        results.targeted = targetedData.map((d: any) => ({
          ...d,
          userId: d.user_id,
          isRead: d.is_read || {},
          createdAt: d.created_at ? Timestamp.fromDate(new Date(d.created_at)) : Timestamp.now(),
        } as AppNotification));
      }
      
      emit();
    } catch (err) {
      console.warn('Gracefully handled notifications initial fetch error:', err);
    }
  };

  fetchInitial();

  const channel = supabase.channel('notifications_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, () => {
      fetchInitial();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const markNotificationRead = async (notifId: string, userId: string): Promise<void> => {
  const { data } = await supabase.from('app_notifications').select('is_read').eq('id', notifId).maybeSingle();
  const isRead = data?.is_read || {};
  isRead[userId] = true;

  const { error } = await supabase
    .from('app_notifications')
    .update({ is_read: isRead })
    .eq('id', notifId);
    
  if (error) logPermissionError('markNotificationRead', error, { notifId, userId });
};

export const markAllNotificationsRead = async (notifIds: string[], userId: string): Promise<void> => {
  for (const id of notifIds) {
    await markNotificationRead(id, userId);
  }
};

export const createNotification = async (data: Omit<AppNotification, 'id' | 'createdAt'> & { createdAt?: any }): Promise<void> => {
  const insertData = {
    ...data,
    id: crypto.randomUUID(),
    user_id: data.userId,
    is_read: data.isRead || {},
    created_at: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString()) : new Date().toISOString(),
  };
  delete (insertData as any).userId;
  delete (insertData as any).isRead;
  delete (insertData as any).createdAt;

  // Map the remaining camelCase fields to their snake_case columns so the
  // insert doesn't carry unknown columns.
  (insertData as any).related_id = (data as any).relatedId ?? null;
  (insertData as any).related_type = (data as any).relatedType ?? null;
  delete (insertData as any).relatedId;
  delete (insertData as any).relatedType;

  const { error } = await supabase.from('app_notifications').insert(insertData);
  if (error) logPermissionError('createNotification', error, { data });
};
