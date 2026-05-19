import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, FolderOpen, Users, FileText,
  MessageSquare, BookOpen, BarChart2, Bell, Shield, User, LogOut, X,
  Building2,
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
      { to: '/app/tasks', label: 'Tasks', icon: CheckSquare, perm: 'tasks_view' as const },
      { to: '/app/projects', label: 'Projects', icon: FolderOpen, perm: 'projects_view' as const },
      { to: '/app/site-diary', label: 'Site Diary', icon: BookOpen, always: true },
      { to: '/app/documents', label: 'Documents', icon: FileText, perm: 'docs_view' as const },
      { to: '/app/reports', label: 'Reports', icon: BarChart2, perm: 'reports_view' as const },
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
      { to: '/app/notifications', label: 'Notifications', icon: Bell, always: true, isNotifBadge: true },
      // Admin is visible to anyone with any admin sub-permission, not just settings_manage.
      {
        to: '/app/admin',
        label: 'Admin',
        icon: Shield,
        anyPerm: [
          'settings_manage',
          'roles_manage',
          'team_manage',
          'attendance_view_all',
          'notifications_manage',
          'contact_view',
          'contact_manage',
        ] as const,
      },
      { to: '/app/profile', label: 'Profile', icon: User, always: true },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { appUser } = useAuthStore();
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
  }) => {
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
          'bg-[#0f1f35] lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center justify-between flex-shrink-0 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight tracking-wide">Task Pilot</p>
              <p className="text-white/40 text-xs">Construction TMS</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
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
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 px-3 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative',
                          isActive
                            ? 'bg-white/12 text-white'
                            : 'text-white/55 hover:bg-white/8 hover:text-white/90'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
                          )}
                          <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-accent' : 'text-white/40 group-hover:text-white/70')} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {(item as any).isBadge && totalUnread > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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
          <div className="border-t border-white/8 p-3 flex-shrink-0">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/8 transition-colors group">
              <Avatar name={appUser.name} src={appUser.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{appUser.name}</p>
                <p className="text-xs text-white/40 truncate">{appUser.email || appUser.phone}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
