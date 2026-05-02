import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, Settings, FileText, Bell, Clock, ChevronRight,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { usePermissions } from '../../hooks/usePermissions';

const adminItems = [
  { to: '/app/admin/users', label: 'User Management', desc: 'Add, edit, and manage users', icon: Users },
  { to: '/app/admin/roles', label: 'Role Management', desc: 'Create roles and assign permissions', icon: Shield },
  { to: '/app/admin/org-settings', label: 'Org Settings', desc: 'Company info, working hours, geofence', icon: Settings },
  { to: '/app/admin/audit-log', label: 'Audit Log', desc: 'Track admin actions and system events', icon: FileText },
  { to: '/app/admin/notifications', label: 'Notification Center', desc: 'Send broadcasts to all users', icon: Bell },
  { to: '/app/admin/attendance', label: 'Attendance Dashboard', desc: 'View staff check-in/out records', icon: Clock },
];

const AdminPage: React.FC = () => {
  const { can } = usePermissions();
  const navigate = useNavigate();

  if (!can('settings_manage') && !can('roles_manage') && !can('attendance_view_all')) {
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminItems.map((item) => (
          <Card
            key={item.to}
            hover
            onClick={() => navigate(item.to)}
            className="flex items-center gap-4"
          >
            <div className="p-3 bg-primary/10 rounded-xl">
              <item.icon className="w-5 h-5 text-primary" />
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
