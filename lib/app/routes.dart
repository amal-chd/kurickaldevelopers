import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/utils/navigator_key.dart';
import '../presentation/auth/splash_screen.dart';
import '../presentation/auth/login_screen.dart';
import '../presentation/auth/otp_screen.dart';
import '../presentation/auth/onboarding_screen.dart';
import '../presentation/dashboard/dashboard_screen.dart';
import '../presentation/tasks/task_board_screen.dart';
import '../presentation/tasks/task_detail_screen.dart';
import '../presentation/tasks/create_task_screen.dart';
import '../presentation/projects/projects_screen.dart';
import '../presentation/projects/project_detail_screen.dart';
import '../presentation/projects/create_project_screen.dart';
import '../presentation/team/team_screen.dart';
import '../presentation/attendance/my_attendance_screen.dart';
import '../presentation/team/member_detail_screen.dart';
import '../presentation/documents/documents_screen.dart';
import '../presentation/documents/document_viewer_screen.dart';
import '../presentation/reports/reports_screen.dart';
import '../presentation/notifications/notifications_screen.dart';
import '../presentation/performance/performance_screen.dart';
import '../presentation/admin/admin_panel_screen.dart';
import '../presentation/admin/role_management_screen.dart';
import '../presentation/admin/role_detail_screen.dart';
import '../presentation/admin/create_role_screen.dart';
import '../presentation/admin/user_management_screen.dart';
import '../presentation/admin/audit_log_screen.dart';
import '../presentation/admin/task_assignment_screen.dart';
import '../presentation/admin/notification_admin_screen.dart';
import '../presentation/admin/staff_attendance_screen.dart';
import '../presentation/site_diary/site_diary_screen.dart';
import '../presentation/profile/profile_screen.dart';
import '../presentation/chat/chat_list_screen.dart';
import '../presentation/chat/chat_room_screen.dart';
import '../presentation/chat/create_channel_screen.dart';
import '../presentation/shared/layouts/app_scaffold.dart';
import '../providers/auth_provider.dart';

final _shellNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    navigatorKey: appNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final isLoading = authState.isLoading;
      if (isLoading) return null;

      final isLoggedIn = authState.value != null;
      final isAuthRoute =
          state.matchedLocation == '/' ||
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/otp' ||
          state.matchedLocation == '/onboarding';

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && state.matchedLocation == '/login') return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/otp',
        builder: (_, s) => OtpScreen(phoneNumber: s.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (_, __) => const OnboardingScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AppScaffold(child: child),
        routes: [
          // Dashboard
          GoRoute(
            path: '/dashboard',
            builder: (_, __) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/performance',
            builder: (_, __) => const PerformanceScreen(),
          ),

          // Tasks
          GoRoute(path: '/tasks', builder: (_, __) => const TaskBoardScreen()),
          GoRoute(
            path: '/tasks/create',
            builder: (_, s) =>
                CreateTaskScreen(projectId: s.uri.queryParameters['projectId']),
          ),
          GoRoute(
            path: '/tasks/edit',
            builder: (_, s) => CreateTaskScreen(
              taskId: s.uri.queryParameters['taskId'],
              projectId: s.uri.queryParameters['projectId'],
            ),
          ),
          GoRoute(
            path: '/tasks/:taskId',
            builder: (_, s) =>
                TaskDetailScreen(taskId: s.pathParameters['taskId']!),
          ),

          // Projects
          GoRoute(
            path: '/projects',
            builder: (_, __) => const ProjectsScreen(),
          ),
          GoRoute(
            path: '/projects/create',
            builder: (_, __) => const CreateProjectScreen(),
          ),
          GoRoute(
            path: '/projects/:projectId',
            builder: (_, s) =>
                ProjectDetailScreen(projectId: s.pathParameters['projectId']!),
          ),
          GoRoute(
            path: '/projects/:projectId/edit',
            builder: (_, s) =>
                CreateProjectScreen(projectId: s.pathParameters['projectId']),
          ),

          // Team
          GoRoute(path: '/team', builder: (_, __) => const TeamScreen()),
          GoRoute(
            path: '/team/:userId',
            builder: (_, s) =>
                MemberDetailScreen(userId: s.pathParameters['userId']!),
          ),

          // My Attendance
          GoRoute(
            path: '/my-attendance',
            builder: (_, __) => const MyAttendanceScreen(),
          ),

          // Documents
          GoRoute(
            path: '/documents',
            builder: (_, __) => const DocumentsScreen(),
          ),
          GoRoute(
            path: '/documents/:docId',
            builder: (_, s) =>
                DocumentViewerScreen(docId: s.pathParameters['docId']!),
          ),

          // Reports
          GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),

          // Notifications
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsScreen(),
          ),

          // Chat
          GoRoute(path: '/chat', builder: (_, __) => const ChatListScreen()),
          GoRoute(
            path: '/chat/create',
            builder: (_, __) => const CreateChannelScreen(),
          ),
          GoRoute(
            path: '/chat/:channelId',
            builder: (_, s) =>
                ChatRoomScreen(channelId: s.pathParameters['channelId']!),
          ),

          // Site Diary
          GoRoute(
            path: '/site-diary',
            builder: (_, __) => const SiteDiaryScreen(),
          ),

          // Profile
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),

          // Admin — Hub
          GoRoute(path: '/admin', builder: (_, __) => const AdminPanelScreen()),

          // Admin — Role Management
          GoRoute(
            path: '/admin/roles',
            builder: (_, __) => const RoleManagementScreen(),
          ),
          GoRoute(
            path: '/admin/roles/create',
            builder: (_, __) => const CreateRoleScreen(),
          ),
          GoRoute(
            path: '/admin/roles/:roleId/edit',
            builder: (_, s) =>
                CreateRoleScreen(roleId: s.pathParameters['roleId']),
          ),
          GoRoute(
            path: '/admin/roles/:roleId',
            builder: (_, s) =>
                RoleDetailScreen(roleId: s.pathParameters['roleId']!),
          ),
          GoRoute(
            path: '/admin/task-assignment',
            builder: (_, __) => const TaskAssignmentScreen(),
          ),

          // Admin — User Management
          GoRoute(
            path: '/admin/users',
            builder: (_, __) => const UserManagementScreen(),
          ),



          // Admin — Audit Log
          GoRoute(
            path: '/admin/audit-log',
            builder: (_, __) => const AuditLogScreen(),
          ),

          // Admin — Notification Center
          GoRoute(
            path: '/admin/notifications',
            builder: (_, __) => const NotificationAdminScreen(),
          ),

          // Admin — Staff Attendance Dashboard
          GoRoute(
            path: '/admin/attendance',
            builder: (_, __) => const StaffAttendanceScreen(),
          ),
        ],
      ),
    ],
  );
});
