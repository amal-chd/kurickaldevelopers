import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../providers/admin_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';

class AdminPanelScreen extends ConsumerWidget {
  const AdminPanelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    // Director-only: gate on the top role level (100) rather than a permission
    // so the panel stays restricted regardless of custom role grids.
    final isDirector = ref.watch(currentRoleLevelProvider) >= 100;
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: isDirector ? _AdminHub() : _AccessDenied(),
    );
  }
}

// ─── Access Denied ────────────────────────────────────────────────────────────

class _AccessDenied extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Panel')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.06),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.lock_rounded,
                size: 64,
                color: AppTheme.error,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Access Restricted',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'You need Admin permissions to view this panel.',
              style: TextStyle(color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Admin Hub ────────────────────────────────────────────────────────────────

class _AdminHub extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(adminStatsProvider);
    final currentUser = ref.watch(currentUserProvider).value;

    return CustomScrollView(
      slivers: [
        // ── Elegant Top Header ───────────────────────────────────────────────
        SliverAppBar(
          pinned: true,
          expandedHeight: 180,
          backgroundColor: AppTheme.primary,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
          elevation: 0,
          title: const Text(
            'Admin Console',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 18,
            ),
          ),
          flexibleSpace: FlexibleSpaceBar(
            collapseMode: CollapseMode.parallax,
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFF0F172A), // Slate Midnight
                    Color(0xFF1E293B),
                    Color(0xFF334155),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            ),
                            child: const Icon(
                              Icons.bolt_rounded,
                              color: Color(0xFFF59E0B),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'System Administrator',
                                  style: TextStyle(
                                    color: Colors.white60,
                                    fontSize: 12,
                                    fontFamily: 'Inter',
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  currentUser?.name ?? 'Admin Portal',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontFamily: 'Plus Jakarta Sans',
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Sleek Stats Bar ────────────────────────────────────────────
              statsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (stats) => _StatsBar(stats: stats),
              ),

              const SizedBox(height: 12),

              // ── Group: Access Control & Users ──────────────────────────────
              _SectionHeader(title: 'Access Control & Users'),
              _GroupCard(
                children: [
                  _AdminRow(
                    icon: Icons.manage_accounts_rounded,
                    title: 'User Management',
                    subtitle: 'Add, edit, or deactivate team members',
                    iconColor: const Color(0xFF3B82F6),
                    badge: statsAsync.value?['totalUsers']?.toString(),
                    onTap: () => context.push('/admin/users'),
                  ),
                  const _RowDivider(),
                  _AdminRow(
                    icon: Icons.admin_panel_settings_rounded,
                    title: 'Role Management',
                    subtitle: 'Define custom roles, permissions & hierarchy',
                    iconColor: const Color(0xFF8B5CF6),
                    onTap: () => context.push('/admin/roles'),
                  ),
                  const _RowDivider(),
                  _AdminRow(
                    icon: Icons.assignment_ind_rounded,
                    title: 'Task Assignment Rules',
                    subtitle: 'Determine task assignment paths & permissions',
                    iconColor: const Color(0xFF0EA5E9),
                    onTap: () => context.push('/admin/task-assignment'),
                  ),
                ],
              ),

              // ── Group: Operations & Monitoring ─────────────────────────────
              _SectionHeader(title: 'Operations & Monitoring'),
              _GroupCard(
                children: [
                  _AdminRow(
                    icon: Icons.fact_check_rounded,
                    title: 'Staff Attendance Log',
                    subtitle: 'Track live check-ins, hours & GPS locations',
                    iconColor: const Color(0xFF10B981),
                    badge: statsAsync.value?['activeUsers']?.toString(),
                    onTap: () => context.push('/admin/attendance'),
                  ),
                  const _RowDivider(),
                  _AdminRow(
                    icon: Icons.campaign_rounded,
                    title: 'Broadcast Notifications',
                    subtitle: 'Send push alerts & broad announcements',
                    iconColor: const Color(0xFFEF4444),
                    onTap: () => context.push('/admin/notifications'),
                  ),
                ],
              ),

              // ── Group: Logs & Analytics ────────────────────────────────────
              _SectionHeader(title: 'Logs & Analytics'),
              _GroupCard(
                children: [
                  _AdminRow(
                    icon: Icons.bar_chart_rounded,
                    title: 'Reports & Analytics',
                    subtitle: 'Inspect team workload & project completion stats',
                    iconColor: const Color(0xFFEC4899),
                    onTap: () => context.go('/reports'),
                  ),
                  const _RowDivider(),
                  _AdminRow(
                    icon: Icons.history_rounded,
                    title: 'System Audit Log',
                    subtitle: 'Trace administrative actions & system alterations',
                    iconColor: const Color(0xFF64748B),
                    onTap: () => context.push('/admin/audit-log'),
                  ),
                ],
              ),

              const SizedBox(height: 28),

              // ── Sign Out Option ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(
                      color: AppTheme.error.withValues(alpha: 0.15),
                      width: 1,
                    ),
                    boxShadow: AppTheme.softShadow,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    child: InkWell(
                      onTap: () => _confirmSignOut(context, ref),
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.error.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                              ),
                              child: const Icon(
                                Icons.logout_rounded,
                                color: AppTheme.error,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 14),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Sign Out',
                                    style: TextStyle(
                                      color: AppTheme.error,
                                      fontWeight: FontWeight.w700,
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    'Log out of the administrator portal',
                                    style: TextStyle(
                                      color: AppTheme.textMuted,
                                      fontSize: 11,
                                      fontFamily: 'Inter',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: AppTheme.error,
                              size: 20,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of the Admin Console?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await ref.read(authRepositoryProvider).signOut();
    }
  }
}

// ─── Premium Section Header ──────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppTheme.textLight,
          letterSpacing: 1.1,
          fontFamily: 'Plus Jakarta Sans',
        ),
      ),
    );
  }
}

// ─── Group Card Layout ────────────────────────────────────────────────────────

class _GroupCard extends StatelessWidget {
  final List<Widget> children;
  const _GroupCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: AppTheme.divider.withValues(alpha: 0.6),
            width: 1,
          ),
          boxShadow: AppTheme.softShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          child: Column(children: children),
        ),
      ),
    );
  }
}

// ─── Admin Row Widget ─────────────────────────────────────────────────────────

class _AdminRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color iconColor;
  final String? badge;
  final VoidCallback onTap;

  const _AdminRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.iconColor,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.onSurface,
                        fontFamily: 'Plus Jakarta Sans',
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppTheme.textMuted,
                        fontFamily: 'Inter',
                      ),
                    ),
                  ],
                ),
              ),
              if (badge != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: Text(
                    badge!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: iconColor,
                      fontFamily: 'Plus Jakarta Sans',
                    ),
                  ),
                ),
              ],
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppTheme.textLight,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      color: AppTheme.divider,
      indent: 60,
    );
  }
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

class _StatsBar extends StatelessWidget {
  final Map<String, int> stats;
  const _StatsBar({required this.stats});

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        Icons.group_rounded,
        '${stats['activeUsers']}/${stats['totalUsers']}',
        'Users',
        const Color(0xFF3B82F6),
      ),
      (
        Icons.business_rounded,
        '${stats['totalProjects']}',
        'Projects',
        const Color(0xFF10B981),
      ),
      (
        Icons.task_alt_rounded,
        '${stats['totalTasks']}',
        'Tasks',
        const Color(0xFFF59E0B),
      ),
      (
        Icons.shield_rounded,
        '${stats['totalRoles']}',
        'Roles',
        const Color(0xFF8B5CF6),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Row(
        children: items.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final (icon, value, label, color) = item;
          final isLast = index == items.length - 1;

          return Expanded(
            child: Container(
              margin: isLast
                  ? EdgeInsets.zero
                  : const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                boxShadow: AppTheme.softShadow,
                border: Border.all(
                  color: AppTheme.divider.withValues(alpha: 0.5),
                ),
              ),
              child: Column(
                children: [
                  Icon(icon, color: color.withValues(alpha: 0.8), size: 18),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: color,
                      fontFamily: 'Plus Jakarta Sans',
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppTheme.textMuted,
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
