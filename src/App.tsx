import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthInit } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/layout/AppLayout';

const LandingPage = React.lazy(() => import('./pages/landing/LandingPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/landing/PrivacyPolicyPage'));
const TermsOfUsePage = React.lazy(() => import('./pages/landing/TermsOfUsePage'));
const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const SetupPage = React.lazy(() => import('./pages/auth/SetupPage'));
const TasksPage = React.lazy(() => import('./pages/tasks/TasksPage'));
const TaskDetailPage = React.lazy(() => import('./pages/tasks/TaskDetailPage'));
const CreateTaskPage = React.lazy(() => import('./pages/tasks/CreateTaskPage'));
const ProjectsPage = React.lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetailPage = React.lazy(() => import('./pages/projects/ProjectDetailPage'));
const CreateProjectPage = React.lazy(() => import('./pages/projects/CreateProjectPage'));
const TeamPage = React.lazy(() => import('./pages/team/TeamPage'));
const MemberDetailPage = React.lazy(() => import('./pages/team/MemberDetailPage'));
const DocumentsPage = React.lazy(() => import('./pages/documents/DocumentsPage'));
const ChatPage = React.lazy(() => import('./pages/chat/ChatPage'));
const SiteDiaryPage = React.lazy(() => import('./pages/site-diary/SiteDiaryPage'));
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'));
const NotificationsPage = React.lazy(() => import('./pages/notifications/NotificationsPage'));
const PerformancePage = React.lazy(() => import('./pages/performance/PerformancePage'));
const AdminPage = React.lazy(() => import('./pages/admin/AdminPage'));
const UserManagementPage = React.lazy(() => import('./pages/admin/UserManagementPage'));
const RoleManagementPage = React.lazy(() => import('./pages/admin/RoleManagementPage'));
const TaskAssignmentSettingsPage = React.lazy(() => import('./pages/admin/TaskAssignmentSettingsPage'));
const AuditLogPage = React.lazy(() => import('./pages/admin/AuditLogPage'));
const NotificationAdminPage = React.lazy(() => import('./pages/admin/NotificationAdminPage'));
const AttendanceDashboardPage = React.lazy(() => import('./pages/admin/AttendanceDashboardPage'));
const ContactInquiriesPage = React.lazy(() => import('./pages/admin/ContactInquiriesPage'));
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage'));
import Spinner from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// ─── Auth Guard ───────────────────────────────────────────────────────────────
// Sign-in only (mirrors the mobile app): once authenticated the user goes
// straight to the app. There is no onboarding flow — roles are assigned by an
// admin in User Management.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, loading, initialized } = useAuthStore();

  // Show spinner until auth is both initialized AND finished loading user data
  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading Task Pilot…</p>
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
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
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
              <Route path="tasks" element={<TasksPage />}>
                <Route path=":id" element={<TaskDetailPage />} />
              </Route>
              <Route path="tasks/create" element={<CreateTaskPage />} />
              <Route path="tasks/:taskId/edit" element={<CreateTaskPage />} />

              {/* Projects */}
              <Route path="projects" element={<ProjectsPage />}>
                <Route path=":id" element={<ProjectDetailPage />} />
              </Route>
              <Route path="projects/create" element={<CreateProjectPage />} />
              <Route path="projects/:projectId/edit" element={<CreateProjectPage />} />

              {/* Team */}
              <Route path="team" element={<TeamPage />}>
                <Route path=":id" element={<MemberDetailPage />} />
              </Route>

              {/* Other */}
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:channelId" element={<ChatPage />} />
              <Route path="site-diary" element={<SiteDiaryPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="performance" element={<PerformancePage />} />

              {/* Admin */}
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/users" element={<UserManagementPage />} />
              <Route path="admin/roles" element={<RoleManagementPage />} />
              <Route path="admin/task-assignment" element={<TaskAssignmentSettingsPage />} />
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
        </React.Suspense>
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
