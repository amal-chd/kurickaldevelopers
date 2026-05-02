import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const pageTitles: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/tasks': 'Tasks',
  '/app/tasks/create': 'Create Task',
  '/app/projects': 'Projects',
  '/app/projects/create': 'Create Project',
  '/app/team': 'Team',
  '/app/documents': 'Documents',
  '/app/chat': 'Chat',
  '/app/site-diary': 'Site Diary',
  '/app/reports': 'Reports & Analytics',
  '/app/notifications': 'Notifications',
  '/app/admin': 'Admin Panel',
  '/app/admin/users': 'User Management',
  '/app/admin/roles': 'Role Management',
  '/app/admin/org-settings': 'Org Settings',
  '/app/admin/audit-log': 'Audit Log',
  '/app/admin/notifications': 'Notification Center',
  '/app/admin/attendance': 'Attendance Dashboard',
  '/app/profile': 'Profile',
};

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] ?? 'Kurickal TMS';

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
