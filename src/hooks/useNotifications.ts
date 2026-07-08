import { useState, useEffect } from 'react';
import { subscribeNotifications } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { AppNotification } from '../types';

/**
 * Live notifications for the current user (targeted + broadcast), with the
 * unread count derived from the per-user `isRead` map. Used by the TopBar bell
 * so its badge reflects unread NOTIFICATIONS (not chat unread, which has its
 * own indicator on the sidebar).
 */
export function useNotifications() {
  const { appUser } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!appUser?.id) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeNotifications(appUser.id, setNotifications);
    return () => unsub();
  }, [appUser?.id]);

  const uid = appUser?.id ?? '';
  const unreadCount = notifications.filter((n) => !n.isRead?.[uid]).length;

  return { notifications, unreadCount };
}
