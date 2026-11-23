import { useState, useEffect } from 'react';
import { subscribeNotifications } from '../lib/firestore';
import { useAuthStore } from '../store/authStore';
import { AppNotification } from '../types';

export interface StackedNotification {
  id: string; // id of the latest notification in the stack
  isStacked: boolean;
  count: number;
  hasUnread: boolean;
  allIds: string[];
  latest: AppNotification;
  children: AppNotification[];
  createdAt: Date | any;
  relatedId?: string;
}

export function stackNotifications(notifications: AppNotification[], currentUserId: string): StackedNotification[] {
  const stacks: StackedNotification[] = [];
  const map = new Map<string, StackedNotification>();

  for (const n of notifications) {
    const isRead = !!n.isRead?.[currentUserId];
    
    if (n.relatedId) {
      if (map.has(n.relatedId)) {
        const stack = map.get(n.relatedId)!;
        stack.count += 1;
        stack.allIds.push(n.id);
        stack.children.push(n);
        if (!isRead) {
          stack.hasUnread = true;
        }
      } else {
        const newStack: StackedNotification = {
          id: n.id,
          isStacked: false,
          count: 1,
          hasUnread: !isRead,
          allIds: [n.id],
          latest: n,
          children: [n],
          createdAt: n.createdAt,
          relatedId: n.relatedId,
        };
        stacks.push(newStack);
        map.set(n.relatedId, newStack);
      }
    } else {
      stacks.push({
        id: n.id,
        isStacked: false,
        count: 1,
        hasUnread: !isRead,
        allIds: [n.id],
        latest: n,
        children: [n],
        createdAt: n.createdAt,
      });
    }
  }

  for (const stack of stacks) {
    if (stack.count > 1) {
      stack.isStacked = true;
    }
  }

  return stacks;
}

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
  
  const stackedNotifications = stackNotifications(notifications, uid);

  return { notifications, stackedNotifications, unreadCount };
}
