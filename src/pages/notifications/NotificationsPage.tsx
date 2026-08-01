import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Info, AlertCircle, Megaphone, Clock, CalendarDays, Wallet, Receipt, Trophy } from 'lucide-react';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/firestore';
import { AppNotification } from '../../types';
import { formatTimeAgo } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (!appUser) { setLoading(false); return; }
    const unsub = subscribeNotifications(appUser.id, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return unsub;
  }, [appUser]);

  const isRead = (n: AppNotification) => !!(n.isRead?.[appUser?.id ?? '']);
  const unreadList = notifications.filter((n) => !isRead(n));
  const displayed = tab === 'unread' ? unreadList : notifications;

  const handleMarkRead = async (id: string) => {
    if (!appUser) return;
    await markNotificationRead(id, appUser.id);
  };

  const handleMarkAll = async () => {
    if (!appUser || unreadList.length === 0) return;
    await markAllNotificationsRead(unreadList.map((n) => n.id), appUser.id);
  };

  const handleNotifClick = async (n: AppNotification) => {
    if (!appUser) return;
    if (!isRead(n)) {
      await markNotificationRead(n.id, appUser.id);
    }
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadList.length > 0 ? `${unreadList.length} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadList.length > 0 && (
          <Button variant="outline" size="sm" leftIcon={<CheckCheck className="w-4 h-4" />} onClick={handleMarkAll}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'all' ? `All (${notifications.length})` : `Unread (${unreadList.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={tab === 'unread' ? "You're all caught up!" : 'Notifications will appear here.'}
        />
      ) : (
        <div className="space-y-2">
          {displayed.map((n) => {
            const read = isRead(n);
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
            return (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-slate-50/50 hover:border-slate-200 ${
                  !read
                    ? 'bg-primary/[0.03] border-primary/15 shadow-sm'
                    : 'bg-white border-slate-100'
                }`}
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-2 h-2 rounded-full mt-1 ${!read ? 'bg-primary' : 'bg-transparent'}`} />
                </div>

                {/* Icon */}
                <div className={`p-2 rounded-xl border flex-shrink-0 ${cfg.bg} ${cfg.border}`}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${!read ? 'text-slate-900' : 'text-slate-700'}`}>
                    {n.title}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{formatTimeAgo(n.createdAt)}</p>
                </div>

                {/* Actions */}
                {!read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(n.id);
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
      )}
    </div>
  );
};

export default NotificationsPage;
