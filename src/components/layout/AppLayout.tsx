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
  '/app/admin/task-assignment': 'Task Assignment Rules',
  '/app/admin/audit-log': 'Audit Log',
  '/app/admin/notifications': 'Notification Center',
  '/app/admin/attendance': 'Attendance Dashboard',
  '/app/profile': 'Profile',
};

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] ?? 'Task Pilot';

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          {/* Keyed by route so every page navigation gets a smooth entrance.
              overflow-x-hidden + min-w-0 guard against accidental horizontal
              scroll on mobile from decorative/absolute elements. */}
          <div key={location.pathname} className="animate-fade-in min-h-full max-w-[1600px] mx-auto w-full min-w-0 flex flex-col overflow-x-hidden [&>*]:min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
