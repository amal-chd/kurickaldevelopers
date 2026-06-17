import React from 'react';
import { Menu, Bell, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../ui/Avatar';
import { useChannels } from '../../hooks/useChat';
import { format } from 'date-fns';

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
  '/app/admin/org-settings': ['Admin', 'Org Settings'],
  '/app/admin/audit-log': ['Admin', 'Audit Log'],
  '/app/admin/notifications': ['Admin', 'Notifications'],
  '/app/admin/attendance': ['Admin', 'Attendance'],
  '/app/admin/contact': ['Admin', 'Contact Inquiries'],
  '/app/profile': ['Profile'],
};

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { appUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { channels } = useChannels();

  const totalUnread = channels.reduce((sum, ch) => {
    if (!appUser) return sum;
    return sum + (ch.unreadCounts?.[appUser.id] ?? 0);
  }, 0);

  // Resolve dynamic routes (e.g. /app/tasks/:id, /app/tasks/:taskId/edit)
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

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 flex-shrink-0 z-20">
      {/* Mobile hamburger */}
      <button
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-gray-900 truncate' : 'text-gray-400 hidden sm:inline'}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1" />

      {/* Date */}
      <span className="text-xs text-gray-400 font-medium hidden md:block flex-shrink-0">{today}</span>

      {/* Notifications bell */}
      <button
        onClick={() => navigate('/app/notifications')}
        className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Avatar */}
      {appUser && (
        <button
          onClick={() => navigate('/app/profile')}
          className="flex items-center gap-2 pl-1 rounded-xl hover:bg-gray-50 pr-2 py-1 transition-colors"
        >
          <Avatar name={appUser.name} src={appUser.avatarUrl} size="sm" />
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{appUser.name.split(' ')[0]}</p>
          </div>
        </button>
      )}
    </header>
  );
};

export default TopBar;
