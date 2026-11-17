import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthInit } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/layout/AppLayout';

import { usePermissions } from './hooks/usePermissions';
import { useTenantStore } from './lib/tenant';

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
const AssetsPage = React.lazy(() => import('./pages/assets/AssetsPage'));
const AssetDetailPage = React.lazy(() => import('./pages/assets/AssetDetailPage'));
const LeavePage = React.lazy(() => import('./pages/leave/LeavePage'));
const SalaryPage = React.lazy(() => import('./pages/salary/SalaryPage'));
const ExpensePage = React.lazy(() => import('./pages/expenses/ExpensePage'));
const AdminPage = React.lazy(() => import('./pages/admin/AdminPage'));
const UserManagementPage = React.lazy(() => import('./pages/admin/UserManagementPage'));
const RoleManagementPage = React.lazy(() => import('./pages/admin/RoleManagementPage'));
const TaskAssignmentSettingsPage = React.lazy(() => import('./pages/admin/TaskAssignmentSettingsPage'));
const AuditLogPage = React.lazy(() => import('./pages/admin/AuditLogPage'));
const NotificationAdminPage = React.lazy(() => import('./pages/admin/NotificationAdminPage'));
const AttendanceDashboardPage = React.lazy(() => import('./pages/admin/AttendanceDashboardPage'));
const ContactInquiriesPage = React.lazy(() => import('./pages/admin/ContactInquiriesPage'));
const ProfilePage = React.lazy(() => import('./pages/profile/ProfilePage'));
const FieldManualPage = React.lazy(() => import('./pages/manual/FieldManualPage'));
// SaaS
const ProductHomePage = React.lazy(() => import('./pages/saas/marketing/ProductHomePage'));
const PricingPage = React.lazy(() => import('./pages/saas/marketing/PricingPage'));
const FeaturesPage = React.lazy(() => import('./pages/saas/marketing/FeaturesPage').then((m) => ({ default: m.FeaturesPage })));
const IndustryPage = React.lazy(() => import('./pages/saas/marketing/FeaturesPage').then((m) => ({ default: m.IndustryPage })));
const ContactSalesPage = React.lazy(() => import('./pages/saas/marketing/ContactSalesPage'));
const RegisterPage = React.lazy(() => import('./pages/saas/RegisterPage'));
const InvitePage = React.lazy(() => import('./pages/saas/InvitePage'));
const BillingPage = React.lazy(() => import('./pages/saas/BillingPage'));
const InvoicePage = React.lazy(() => import('./pages/saas/BillingPage').then((m) => ({ default: m.InvoicePage })));
const OrganizationPage = React.lazy(() => import('./pages/saas/OrganizationPage'));
const SupportPage = React.lazy(() => import('./pages/saas/SupportPage'));
const BoqPage = React.lazy(() => import('./pages/construction/BoqPage'));
const MaterialsPage = React.lazy(() => import('./pages/construction/MaterialsPage'));
const LabourPage = React.lazy(() => import('./pages/construction/LabourPage'));
const InspectionsPage = React.lazy(() => import('./pages/construction/InspectionsPage'));
const TimelinePage = React.lazy(() => import('./pages/construction/TimelinePage'));
const NotFoundPage = React.lazy(() => import('./pages/misc/NotFoundPage'));
const PlatformConsole = React.lazy(() => import('./pages/platform/PlatformConsole'));

// The company website stays at "/" unless this deployment is the SaaS site.
const SITE_IS_SAAS = import.meta.env.VITE_SITE_MODE === 'saas';
import Spinner from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// ─── Director Gate ────────────────────────────────────────────────────────────
// The admin panel (and every /app/admin/* page) is restricted to the top-level
// role (Director, level 100). Gating on role LEVEL survives role renames and
// custom role setups without hardcoding a role id.
const DirectorGate = () => {
  const { role } = useAuthStore();
  const { canAny } = usePermissions();

  const hasAccess =
    (role?.level ?? 0) >= 100 ||
    canAny(
      'settings_manage',
      'roles_manage',
      'notifications_manage',
      'attendance_view_all',
      'contact_view',
      'team_manage'
    );

  if (hasAccess) return <Outlet />;
  return <Navigate to="/app/dashboard" replace />;
};

// Generic per-permission route guard. Blocks direct-URL access to a feature page
// when the user lacks its permission, mirroring the sidebar gating so hiding a
// nav item and blocking the route can never drift apart.
const RequirePerm = ({ perm, children }: { perm: string; children: React.ReactNode }) => {
  const { can } = usePermissions();
  const { role, loading } = useAuthStore();
  // While the role is still resolving, don't bounce an authorized user.
  if (loading || role === undefined) return <>{children}</>;
  return can(perm as any) ? <>{children}</> : <Navigate to="/app/dashboard" replace />;
};

// Organisation settings & billing: owner/director or settings/team managers.
const OrgAdminGate = ({ children }: { children: React.ReactNode }) => {
  const { role } = useAuthStore();
  const { canAny } = usePermissions();
  const ctx = useTenantStore((s) => s.context);
  const isOwner = ctx?.org.owner_uid && ctx.org.owner_uid === useAuthStore.getState().firebaseUser?.uid;
  if (isOwner || (role?.level ?? 0) >= 100 || canAny('settings_manage', 'team_manage')) return <>{children}</>;
  return <Navigate to="/app/dashboard" replace />;
};

// Signed-in user without a workspace: create one (or open the platform console).
const OnboardingRoute = () => {
  const { firebaseUser, appUser, initialized, loading } = useAuthStore();
  if (!initialized || loading) return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  if (!firebaseUser) return <Navigate to="/register" replace />;
  if (appUser) return <Navigate to="/app/dashboard" replace />;
  return <RegisterPage onboardingOnly />;
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────
// Sign-in only (mirrors the mobile app): once authenticated the user goes
// straight to the app. There is no onboarding flow — roles are assigned by an
// admin in User Management.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { firebaseUser, appUser, loading, initialized } = useAuthStore();

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

  // Signed in but not part of any workspace (new SaaS sign-up) → onboarding.
  if (!appUser) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  useAuthInit();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
          <Routes>
            {/* Landing — company site by default; SaaS home on the SaaS domain */}
            <Route path="/" element={SITE_IS_SAAS ? <ProductHomePage /> : <LandingPage />} />
            <Route path="/company" element={<LandingPage />} />

            {/* SaaS marketing & onboarding */}
            <Route path="/product" element={<ProductHomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/industries/:slug" element={<IndustryPage />} />
            <Route path="/contact-sales" element={<ContactSalesPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/signup" element={<Navigate to="/register" replace />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/platform/*" element={<PlatformConsole />} />

            {/* Public Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/policy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<Navigate to="/policy" replace />} />
            <Route path="/terms" element={<TermsOfUsePage />} />
            <Route path="/manual" element={<FieldManualPage />} />
            <Route path="/field-manual" element={<Navigate to="/manual" replace />} />

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

              {/* Tasks — list/detail open to all with tasks_view (default);
                  create/edit guarded so the URL can't bypass the button gate. */}
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="tasks/create" element={<RequirePerm perm="tasks_create"><CreateTaskPage /></RequirePerm>} />
              <Route path="tasks/:taskId/edit" element={<RequirePerm perm="tasks_edit"><CreateTaskPage /></RequirePerm>} />

              {/* Projects */}
              <Route path="projects" element={<RequirePerm perm="projects_view"><ProjectsPage /></RequirePerm>} />
              <Route path="projects/:id" element={<RequirePerm perm="projects_view"><ProjectDetailPage /></RequirePerm>} />
              <Route path="projects/create" element={<RequirePerm perm="projects_create"><CreateProjectPage /></RequirePerm>} />
              <Route path="projects/:projectId/edit" element={<RequirePerm perm="projects_edit"><CreateProjectPage /></RequirePerm>} />

              {/* Team */}
              <Route path="team" element={<RequirePerm perm="team_view"><TeamPage /></RequirePerm>} />
              <Route path="team/:id" element={<RequirePerm perm="team_view"><MemberDetailPage /></RequirePerm>} />

              {/* Other */}
              <Route path="documents" element={<RequirePerm perm="docs_view"><DocumentsPage /></RequirePerm>} />
              <Route path="chat" element={<RequirePerm perm="chat_view"><ChatPage /></RequirePerm>} />
              <Route path="chat/:channelId" element={<RequirePerm perm="chat_view"><ChatPage /></RequirePerm>} />
              <Route path="site-diary" element={<SiteDiaryPage />} />
              <Route path="reports" element={<RequirePerm perm="reports_view"><ReportsPage /></RequirePerm>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="performance" element={<PerformancePage />} />

              {/* Assets */}
              <Route path="assets" element={<RequirePerm perm="assets_view"><AssetsPage /></RequirePerm>} />
              <Route path="assets/:id" element={<RequirePerm perm="assets_view"><AssetDetailPage /></RequirePerm>} />

              {/* HR & Finance */}
              <Route path="leave" element={<LeavePage />} />
              <Route path="salary" element={<SalaryPage />} />
              <Route path="expenses" element={<ExpensePage />} />

              {/* Admin */}
              {/* Admin panel — Director-only (top role level ≥ 100) */}
              <Route element={<DirectorGate />}>
                <Route path="admin" element={<AdminPage />} />
                <Route path="admin/users" element={<UserManagementPage />} />
                <Route path="admin/roles" element={<RoleManagementPage />} />
                <Route path="admin/task-assignment" element={<TaskAssignmentSettingsPage />} />
                <Route path="admin/audit-log" element={<AuditLogPage />} />
                <Route path="admin/notifications" element={<NotificationAdminPage />} />
                <Route path="admin/attendance" element={<AttendanceDashboardPage />} />
                <Route path="admin/contact" element={<ContactInquiriesPage />} />
              </Route>

              {/* Construction suite (plan-gated by ModuleGate) */}
              <Route path="timeline" element={<RequirePerm perm="projects_view"><TimelinePage /></RequirePerm>} />
              <Route path="inspections" element={<RequirePerm perm="projects_view"><InspectionsPage /></RequirePerm>} />
              <Route path="materials" element={<RequirePerm perm="projects_view"><MaterialsPage /></RequirePerm>} />
              <Route path="labour" element={<RequirePerm perm="projects_view"><LabourPage /></RequirePerm>} />
              <Route path="boq" element={<RequirePerm perm="projects_view"><BoqPage /></RequirePerm>} />

              {/* Organisation, billing & support */}
              <Route path="organization" element={<OrgAdminGate><OrganizationPage /></OrgAdminGate>} />
              <Route path="billing" element={<OrgAdminGate><BillingPage /></OrgAdminGate>} />
              <Route path="billing/invoice/:id" element={<OrgAdminGate><InvoicePage /></OrgAdminGate>} />
              <Route path="support" element={<SupportPage />} />

              {/* Profile & Help */}
              <Route path="profile" element={<ProfilePage />} />
              <Route path="manual" element={<FieldManualPage />} />
              <Route path="field-manual" element={<Navigate to="/app/manual" replace />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
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
