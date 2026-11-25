import React, { useState } from 'react';
import { Bell, CheckCheck, Info, AlertCircle, Megaphone, Clock, CalendarDays, Wallet, Receipt, Trophy, Layers } from 'lucide-react';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { markNotificationRead, markAllNotificationsRead } from '../../lib/firestore';
import { formatTimeAgo } from '../../lib/utils';
import { isToday, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useNotifications, StackedNotification } from '../../hooks/useNotifications';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
  task:         { icon: <CheckCheck className="w-4 h-4 text-blue-600" />,    bg: 'bg-blue-50',   border: 'border-blue-100' },
  alert:        { icon: <AlertCircle className="w-4 h-4 text-red-500" />,    bg: 'bg-red-50',    border: 'border-red-100' },
  announcement: { icon: <Megaphone className="w-4 h-4 text-purple-600" />,   bg: 'bg-purple-50', border: 'border-purple-100' },
  reminder:     { icon: <Clock className="w-4 h-4 text-amber-600" />,        bg: 'bg-amber-50',  border: 'border-amber-100' },
  update:       { icon: <Info className="w-4 h-4 text-emerald-600" />,       bg: 'bg-emerald-50',border: 'border-emerald-100' },
  leave:        { icon: <CalendarDays className="w-4 h-4 text-sky-600" />,    bg: 'bg-sky-50',    border: 'border-sky-100' },
  salary:       { icon: <Wallet className="w-4 h-4 text-emerald-600" />,      bg: 'bg-emerald-50',border: 'border-emerald-100' },
  expense:      { icon: <Receipt className="w-4 h-4 text-orange-600" />,      bg: 'bg-orange-50', border: 'border-orange-100' },
  milestone:    { icon: <Trophy className="w-4 h-4 text-amber-600" />,        bg: 'bg-amber-50',  border: 'border-amber-100' },
  default:      { icon: <Bell className="w-4 h-4 text-slate-500" />,          bg: 'bg-slate-50',   border: 'border-slate-100' },
};

const NotificationsPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const { stackedNotifications, notifications, unreadCount } = useNotifications();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const displayed = tab === 'unread' ? stackedNotifications.filter(s => s.hasUnread) : stackedNotifications;

  const handleMarkRead = async (stack: StackedNotification) => {
    if (!appUser) return;
    if (stack.count === 1) {
      await markNotificationRead(stack.allIds[0], appUser.id);
    } else {
      await markAllNotificationsRead(stack.allIds, appUser.id);
    }
  };

  const handleMarkAll = async () => {
    if (!appUser) return;
    const unreadIds = notifications.filter(n => !n.isRead?.[appUser.id]).map(n => n.id);
    if (unreadIds.length > 0) {
      await markAllNotificationsRead(unreadIds, appUser.id);
    }
  };

  const handleNotifClick = async (stack: StackedNotification) => {
    if (!appUser) return;
    if (stack.hasUnread) {
      await handleMarkRead(stack);
    }
    const n = stack.latest;
    if (n.type === 'announcement' || n.type === 'chat_message' || n.type === 'chat') {
      if (n.relatedId) navigate(`/app/chat/${n.relatedId}`);
    } else if (n.type === 'task' || n.type === 'task_assigned' || n.type === 'task_updated') {
      if (n.relatedId) navigate(`/app/tasks/${n.relatedId}`);
    } else if (n.type === 'projectUpdate' || n.type === 'project') {
      if (n.relatedId) navigate(`/app/projects/${n.relatedId}`);
    } else if (n.type === 'diaryEntry') {
      navigate('/app/site-diary');
    } else if (n.type === 'documentUploaded') {
      navigate('/app/documents');
    } else if (n.type === 'leave') {
      navigate('/app/leave');
    } else if (n.type === 'salary') {
      navigate('/app/salary');
    } else if (n.type === 'expense') {
      navigate('/app/expenses');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" leftIcon={<CheckCheck className="w-4 h-4" />} onClick={handleMarkAll}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'all' ? `All (${stackedNotifications.length})` : `Unread (${stackedNotifications.filter(s => s.hasUnread).length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={tab === 'unread' ? "You're all caught up!" : 'Notifications will appear here.'}
        />
      ) : (
        <div className="space-y-2">
          {(() => {
            const todayList: StackedNotification[] = [];
            const yesterdayList: StackedNotification[] = [];
            const earlierList: StackedNotification[] = [];

            displayed.forEach(n => {
              const date = n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt as any);
              if (isToday(date)) {
                todayList.push(n);
              } else if (isYesterday(date)) {
                yesterdayList.push(n);
              } else {
                earlierList.push(n);
              }
            });

            const groups = [];
            if (todayList.length > 0) groups.push({ label: 'Today', items: todayList });
            if (yesterdayList.length > 0) groups.push({ label: 'Yesterday', items: yesterdayList });
            if (earlierList.length > 0) groups.push({ label: 'Earlier', items: earlierList });

            return groups.map(group => (
              <div key={group.label} className="mb-6 last:mb-0">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((stack) => {
                    const read = !stack.hasUnread;
                    const n = stack.latest;
                    const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
                    return (
                      <div
                        key={stack.id}
                        onClick={() => handleNotifClick(stack)}
                        className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-slate-50/50 hover:border-slate-200 ${
                          !read
                            ? 'bg-primary/[0.03] border-primary/15 shadow-sm'
                            : 'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-2 h-2 rounded-full mt-1 ${!read ? 'bg-primary' : 'bg-transparent'}`} />
                        </div>
                        <div className={`p-2 rounded-xl border flex-shrink-0 ${cfg.bg} ${cfg.border}`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold leading-snug ${!read ? 'text-slate-900' : 'text-slate-700'}`}>
                              {stack.isStacked ? `Updates to: ${n.title.replace('New Comment on ', '').replace('Task Status Updated on ', '')}` : n.title}
                            </p>
                            {stack.isStacked && (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                <Layers className="w-3 h-3" />
                                {stack.count}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                            {stack.isStacked ? `Latest: ${n.body}` : n.body}
                          </p>
                          <p className="text-xs text-slate-400 mt-1.5">{formatTimeAgo(n.createdAt)}</p>
                        </div>
                        {!read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkRead(stack);
                            }}
                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Mark as read"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
