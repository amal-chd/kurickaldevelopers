import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, FolderOpen, Users, FileText,
  MessageSquare, BookOpen, BarChart2, Shield, LogOut, X, Award,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import Avatar from '../ui/Avatar';
import { logout } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useChannels } from '../../hooks/useChat';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, always: true },
      { to: '/app/tasks', label: 'Tasks', icon: CheckSquare, always: true },
      { to: '/app/projects', label: 'Projects', icon: FolderOpen, perm: 'projects_view' as const },
      { to: '/app/site-diary', label: 'Site Diary', icon: BookOpen, always: true },
      { to: '/app/documents', label: 'Documents', icon: FileText, perm: 'docs_view' as const },
      { to: '/app/reports', label: 'Reports', icon: BarChart2, perm: 'reports_view' as const },
      { to: '/app/performance', label: 'Performance & Points', icon: Award, always: true },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/app/team', label: 'Team', icon: Users, perm: 'team_view' as const },
      { to: '/app/chat', label: 'Chat', icon: MessageSquare, perm: 'chat_view' as const, isBadge: true },
    ],
  },
  {
    label: 'Account',
    items: [
      // Admin panel is restricted to the top-level role (Director, level 100).
      {
        to: '/app/admin',
        label: 'Admin',
        icon: Shield,
        minLevel: 100,
      },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const { channels } = useChannels();

  const totalUnread = channels.reduce((sum, ch) => {
    if (!appUser) return sum;
    return sum + (ch.unreadCounts?.[appUser.id] ?? 0);
  }, 0);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const isItemVisible = (item: {
    always?: boolean;
    perm?: keyof ReturnType<typeof usePermissions>['permissions'];
    anyPerm?: readonly string[];
    minLevel?: number;
  }) => {
    if (item.minLevel !== undefined) return (role?.level ?? 0) >= item.minLevel;
    if (item.always) return true;
    if (item.anyPerm && item.anyPerm.length > 0) {
      return item.anyPerm.some((p) => can(p as any));
    }
    if (item.perm) return can(item.perm as any);
    return true;
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-60 z-40 flex flex-col transition-transform duration-300 ease-in-out',
          'bg-slate-50/50 border-r border-slate-200/60 lg:translate-x-0 lg:static lg:z-auto backdrop-blur-md',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center justify-between flex-shrink-0 border-b border-slate-200/60">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Task Pilot" className="w-9 h-9 rounded-lg object-cover shadow-sm border border-slate-200/50" />
            <div>
              <p className="text-slate-900 font-bold text-sm leading-tight tracking-tight">Task Pilot</p>
              <p className="text-slate-500 text-xs font-medium">Construction TMS</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-white text-primary shadow-xs border border-slate-200/60'
                            : 'text-slate-600 hover:bg-slate-200/40 hover:text-slate-900 border border-transparent'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600')} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {(item as any).isBadge && totalUnread > 0 && (
                            <span className="bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {totalUnread > 99 ? '99+' : totalUnread}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        {appUser && (
          <div className="border-t border-slate-200/60 p-3 flex-shrink-0 bg-slate-50/80 backdrop-blur-sm flex flex-col gap-2">
            <div className="flex items-center gap-3 px-2 py-1 rounded-lg">
              <Avatar name={appUser.name} src={appUser.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight tracking-tight">{appUser.name}</p>
                <p className="text-xs text-slate-500 truncate">{appUser.email || appUser.phone}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-danger hover:bg-danger/10 transition-all border border-transparent hover:border-danger/20"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
