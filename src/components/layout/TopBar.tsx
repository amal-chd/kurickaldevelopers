import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronRight, Layers } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../ui/Avatar';
import { useNotifications, StackedNotification } from '../../hooks/useNotifications';
import { format } from 'date-fns';
import { formatTimeAgo } from '../../lib/utils';
import { markNotificationRead, markAllNotificationsRead } from '../../lib/firestore';

interface TopBarProps {
  onMenuClick: () => void;
  title?: string;
}

const BREADCRUMBS: Record<string, string[]> = {
  '/app/dashboard': ['Dashboard'],
  '/app/tasks': ['Tasks'],
  '/app/tasks/create': ['Tasks', 'Create Task'],
  '/app/projects': ['Projects'],
  '/app/projects/create': ['Projects', 'Create Project'],
  '/app/team': ['People', 'Team'],
  '/app/documents': ['Workspace', 'Documents'],
  '/app/chat': ['People', 'Chat'],
  '/app/site-diary': ['Workspace', 'Site Diary'],
  '/app/reports': ['Workspace', 'Reports'],
  '/app/notifications': ['Notifications'],
  '/app/admin': ['Admin'],
  '/app/admin/users': ['Admin', 'Users'],
  '/app/admin/roles': ['Admin', 'Roles'],
  '/app/admin/task-assignment': ['Admin', 'Task Assignment'],
  '/app/admin/audit-log': ['Admin', 'Audit Log'],
  '/app/admin/notifications': ['Admin', 'Notifications'],
  '/app/admin/attendance': ['Admin', 'Attendance'],
  '/app/admin/contact': ['Admin', 'Contact Inquiries'],
  '/app/profile': ['Profile'],
  '/app/manual': ['Workspace', 'Field Manual'],
};

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { appUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, stackedNotifications, unreadCount } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolveCrumbs = (path: string): string[] => {
    if (BREADCRUMBS[path]) return BREADCRUMBS[path];
    if (/^\/app\/tasks\/[^/]+\/edit$/.test(path)) return ['Tasks', 'Edit Task'];
    if (/^\/app\/tasks\/[^/]+$/.test(path))        return ['Tasks', 'Task Detail'];
    if (/^\/app\/projects\/[^/]+\/edit$/.test(path)) return ['Projects', 'Edit Project'];
    if (/^\/app\/projects\/[^/]+$/.test(path))     return ['Projects', 'Project Detail'];
    if (/^\/app\/team\/[^/]+$/.test(path))         return ['People', 'Team', 'Member'];
    if (/^\/app\/chat\/.+$/.test(path))            return ['People', 'Chat'];
    return ['Task Pilot'];
  };
  const crumbs = resolveCrumbs(location.pathname);
  const today = format(new Date(), 'EEE, dd MMM');

  const handleNotifClick = async (stack: StackedNotification) => {
    setShowDropdown(false);
    if (stack.hasUnread && appUser) {
      if (stack.count === 1) {
        await markNotificationRead(stack.allIds[0], appUser.id);
      } else {
        await markAllNotificationsRead(stack.allIds, appUser.id);
      }
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
    <header className="h-16 bg-white/85 backdrop-blur-md border-b border-slate-200/60 flex items-center px-4 sm:px-5 gap-3 flex-shrink-0 z-20 sticky top-0">
      <button
        className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-slate-900 truncate tracking-tight' : 'text-slate-400 hidden sm:inline font-medium'}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1" />

      <span className="text-xs text-slate-400 font-medium hidden md:block flex-shrink-0 mr-1">{today}</span>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`relative p-2 rounded-xl transition-colors flex-shrink-0 ${showDropdown ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-2 origin-top-right z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      if (appUser) {
                        const unreadIds = notifications.filter(n => !n.isRead?.[appUser.id]).map(n => n.id);
                        await markAllNotificationsRead(unreadIds, appUser.id);
                      }
                    }}
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/app/notifications');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  View all
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {stackedNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  You're all caught up!
                </div>
              ) : (
                stackedNotifications.slice(0, 8).map((stack) => {
                  const read = !stack.hasUnread;
                  const n = stack.latest;
                  return (
                    <div
                      key={stack.id}
                      onClick={() => handleNotifClick(stack)}
                      className={`p-3 rounded-xl cursor-pointer flex gap-3 transition-colors ${
                        !read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-2 h-2 rounded-full ${!read ? 'bg-primary' : 'bg-transparent'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium leading-snug ${!read ? 'text-slate-900' : 'text-slate-600'}`}>
                            {stack.isStacked ? `Updates to: ${n.title.replace('New Comment on ', '').replace('Task Status Updated on ', '')}` : n.title}
                          </p>
                          {stack.isStacked && (
                            <span className="inline-flex items-center gap-0.5 bg-slate-200/60 text-slate-600 text-[9px] font-bold px-1 py-0.5 rounded shrink-0">
                              <Layers className="w-2.5 h-2.5" />
                              {stack.count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {stack.isStacked ? `Latest: ${n.body}` : n.body}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {stackedNotifications.length > 8 && (
              <div
                onClick={() => {
                  setShowDropdown(false);
                  navigate('/app/notifications');
                }}
                className="p-3 text-center text-xs font-semibold text-slate-500 hover:bg-slate-50 border-t border-slate-100 cursor-pointer transition-colors"
              >
                View all notifications
              </div>
            )}
          </div>
        )}
      </div>

      {appUser && (
        <button
          onClick={() => navigate('/app/profile')}
          className="flex items-center gap-2 pl-1 rounded-xl hover:bg-slate-100 pr-2 py-1 transition-colors ml-0.5"
        >
          <Avatar name={appUser.name} src={appUser.avatarUrl} size="sm" />
          <div className="hidden sm:block text-left pr-0.5">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{(appUser.name || appUser.email || 'User').split(' ')[0]}</p>
          </div>
        </button>
      )}
    </header>
  );
};

export default TopBar;
