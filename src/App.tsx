import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthInit } from './hooks/useAuth';
import LandingPage from './pages/landing/LandingPage';
import PrivacyPolicyPage from './pages/landing/PrivacyPolicyPage';
import TermsOfUsePage from './pages/landing/TermsOfUsePage';
import { useAuthStore } from './store/authStore';

import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import LoginPage from './pages/auth/LoginPage';
import SetupPage from './pages/auth/SetupPage';

import TasksPage from './pages/tasks/TasksPage';
import TaskDetailPage from './pages/tasks/TaskDetailPage';
import CreateTaskPage from './pages/tasks/CreateTaskPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import CreateProjectPage from './pages/projects/CreateProjectPage';
import TeamPage from './pages/team/TeamPage';
import MemberDetailPage from './pages/team/MemberDetailPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import ChatPage from './pages/chat/ChatPage';
import SiteDiaryPage from './pages/site-diary/SiteDiaryPage';
import ReportsPage from './pages/reports/ReportsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import AdminPage from './pages/admin/AdminPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import RoleManagementPage from './pages/admin/RoleManagementPage';
import OrgSettingsPage from './pages/admin/OrgSettingsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import NotificationAdminPage from './pages/admin/NotificationAdminPage';
import AttendanceDashboardPage from './pages/admin/AttendanceDashboardPage';
import ContactInquiriesPage from './pages/admin/ContactInquiriesPage';
import ProfilePage from './pages/profile/ProfilePage';
import Spinner from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// ─── Auth Guard ───────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, appUser, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading Task Master Pro…</p>
        </div>
      </div>
    );
  }

  // Not logged in → Login
  if (!firebaseUser) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  useAuthInit();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/policy" element={<PrivacyPolicyPage />} />
          <Route path="/privacy-policy" element={<Navigate to="/policy" replace />} />
          <Route path="/terms" element={<TermsOfUsePage />} />

          {/* Protected App */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Tasks */}
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/create" element={<CreateTaskPage />} />
            <Route path="tasks/:id" element={<TaskDetailPage />} />
            <Route path="tasks/:taskId/edit" element={<CreateTaskPage />} />

            {/* Projects */}
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/create" element={<CreateProjectPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="projects/:projectId/edit" element={<CreateProjectPage />} />

            {/* Team */}
            <Route path="team" element={<TeamPage />} />
            <Route path="team/:id" element={<MemberDetailPage />} />

            {/* Other */}
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:channelId" element={<ChatPage />} />
            <Route path="site-diary" element={<SiteDiaryPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />

            {/* Admin */}
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="admin/roles" element={<RoleManagementPage />} />
            <Route path="admin/org-settings" element={<OrgSettingsPage />} />
            <Route path="admin/audit-log" element={<AuditLogPage />} />
            <Route path="admin/notifications" element={<NotificationAdminPage />} />
            <Route path="admin/attendance" element={<AttendanceDashboardPage />} />
            <Route path="admin/contact" element={<ContactInquiriesPage />} />

            {/* Profile */}
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '14px' },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
