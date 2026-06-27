import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, Settings, FileText, Bell, Clock, ChevronRight, Inbox, UserCheck,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { usePermissions } from '../../hooks/usePermissions';
import { getContactInquiries } from '../../lib/firestore';

const BASE_ADMIN_ITEMS = [
  { to: '/app/admin/users',        label: 'User Management',      desc: 'Add, edit, and manage users',                  icon: Users,   perm: 'settings_manage' as const },
  { to: '/app/admin/roles',        label: 'Role Management',       desc: 'Create roles and assign permissions',           icon: Shield,  perm: 'roles_manage' as const },
  { to: '/app/admin/task-assignment', label: 'Task Assignment Rules', desc: 'Decide who can assign tasks to whom',         icon: UserCheck, perm: 'roles_manage' as const },
  { to: '/app/admin/audit-log',    label: 'Audit Log',             desc: 'Track admin actions and system events',         icon: FileText,perm: 'roles_manage' as const },
  { to: '/app/admin/notifications',label: 'Notification Center',   desc: 'Send broadcasts to all users',                 icon: Bell,    perm: 'notifications_manage' as const },
  { to: '/app/admin/attendance',   label: 'Attendance Dashboard',  desc: 'View staff check-in/out records',              icon: Clock,   perm: 'attendance_view_all' as const },
  { to: '/app/admin/contact',      label: 'Contact Inquiries',     desc: 'Manage website & app enquiries',               icon: Inbox,   perm: 'contact_view' as const },
];

const AdminPage: React.FC = () => {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [newInquiries, setNewInquiries] = useState(0);

  useEffect(() => {
    // Runs once on mount. Permissions are guaranteed loaded here because
    // ProtectedRoute blocks rendering until auth finishes initialising.
    if (can('contact_view') || can('contact_manage')) {
      getContactInquiries()
        .then((list) => setNewInquiries(list.filter((q) => q.status === 'new').length))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasAnyAccess =
    can('settings_manage') || can('roles_manage') ||
    can('attendance_view_all') || can('notifications_manage') ||
    can('contact_view') || can('contact_manage');

  if (!hasAnyAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="Access Denied"
          description="You don't have admin access."
        />
      </div>
    );
  }

  const visibleItems = BASE_ADMIN_ITEMS.filter((item) => can(item.perm));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Panel</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleItems.map((item) => (
          <Card
            key={item.to}
            hover
            onClick={() => navigate(item.to)}
            className="flex items-center gap-4"
          >
            <div className="p-3 bg-primary/10 rounded-xl relative">
              <item.icon className="w-5 h-5 text-primary" />
              {item.to === '/app/admin/contact' && newInquiries > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {newInquiries}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminPage;
