import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/utils/responsive.dart';
import '../../../providers/connectivity_provider.dart';
import '../../../providers/notification_provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../providers/role_provider.dart';
import '../widgets/app_logo.dart';

// ─── Nav Item Definition ──────────────────────────────────────────────────────

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;

  /// Permission key required to show this tab. Null = always visible.
  final String? permissionKey;

  /// Whether this item opens a sheet instead of navigating.
  final bool isSheet;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
    this.permissionKey,
    this.isSheet = false,
  });
}

// ─── All possible tabs (unfiltered) ─────────────────────────────────────────

const _allTabs = [
  _NavItem(
    icon: Icons.dashboard_outlined,
    activeIcon: Icons.dashboard_rounded,
    label: 'Home',
    route: '/dashboard',
  ),
  _NavItem(
    icon: Icons.task_alt_outlined,
    activeIcon: Icons.task_alt_rounded,
    label: 'Tasks',
    route: '/tasks',
  ),
  _NavItem(
    icon: Icons.business_outlined,
    activeIcon: Icons.business_rounded,
    label: 'Projects',
    route: '/projects',
    permissionKey: 'projects_view',
  ),
  _NavItem(
    icon: Icons.chat_bubble_outline_rounded,
    activeIcon: Icons.chat_bubble_rounded,
    label: 'Chat',
    route: '/chat',
    permissionKey: 'chat_view',
  ),
  _NavItem(
    icon: Icons.grid_view_outlined,
    activeIcon: Icons.grid_view_rounded,
    label: 'More',
    route: '/more',
    isSheet: true,
  ),
];

// ─── AppScaffold ─────────────────────────────────────────────────────────────

class AppScaffold extends ConsumerWidget {
  final Widget child;
  const AppScaffold({super.key, required this.child});

  /// Build the filtered list of tabs based on user permissions.
  /// During initial role load we show all tabs to avoid a jarring
  /// disappear → reappear flash once the role resolves.
  List<_NavItem> _filteredTabs(WidgetRef ref) {
    final isRoleLoading = ref.watch(currentRoleProvider).isLoading;
    return _allTabs.where((tab) {
      if (tab.permissionKey == null) return true;
      if (isRoleLoading) return true; // show everything while loading
      return ref.watch(hasPermissionProvider(tab.permissionKey!));
    }).toList();
  }

  /// Get the full current URI path from the router delegate.
  /// Unlike GoRouterState.of(context).matchedLocation (which can return the
  /// ShellRoute's matched segment, not the leaf route), this always returns
  /// the complete path e.g. "/chat/room123".
  String _currentPath(BuildContext context) {
    return GoRouter.of(context)
        .routerDelegate
        .currentConfiguration
        .uri
        .path;
  }

  int _currentIndex(BuildContext context, List<_NavItem> tabs) {
    final location = _currentPath(context);

    // Check each non-sheet tab
    for (int i = 0; i < tabs.length; i++) {
      if (!tabs[i].isSheet && location.startsWith(tabs[i].route)) return i;
    }

    // Routes that map to "More" tab
    if (location.startsWith('/team') ||
        location.startsWith('/my-attendance') ||
        location.startsWith('/documents') ||
        location.startsWith('/reports') ||
        location.startsWith('/notifications') ||
        location.startsWith('/admin') ||
        location.startsWith('/site-diary') ||
        location.startsWith('/performance') ||
        location.startsWith('/profile')) {
      // Return index of the More tab (always the last)
      return tabs.length - 1;
    }

    return 0;
  }

  /// Returns true for chat sub-pages (rooms, create-channel) where the
  /// bottom nav should be hidden. The main chat list (/chat) is excluded.
  bool _shouldHideBottomNav(BuildContext context) {
    final location = _currentPath(context);
    // Hide on any /chat/<sub-route> — DMs, announcements, groups, project channels
    return location.startsWith('/chat/');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabs = _filteredTabs(ref);
    final currentIndex = _currentIndex(context, tabs);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final canViewChat = ref.watch(hasPermissionProvider('chat_view'));
    final unreadChat = canViewChat
        ? (ref.watch(totalUnreadChatProvider).value ?? 0)
        : 0;
    final isWide = Responsive.isWide(context);
    final hideBottomNav = _shouldHideBottomNav(context);

    return Builder(
      builder: (context) {
        final isOffline = !ref.watch(isOnlineProvider);
        final pendingCount =
            ref.watch(pendingSyncCountProvider).value ?? 0;

        return Scaffold(
          body: Column(
            children: [
              // ── Offline Banner ──────────────────────────────────────────
              AnimatedSize(
                duration: const Duration(milliseconds: 300),
                child: isOffline
                    ? Material(
                        color: const Color(0xFFDC2626),
                        child: SafeArea(
                          bottom: false,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              vertical: 6,
                              horizontal: 16,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.wifi_off_rounded,
                                  color: Colors.white,
                                  size: 14,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  pendingCount > 0
                                      ? 'Offline — $pendingCount change${pendingCount == 1 ? '' : 's'} pending sync'
                                      : 'You\'re offline — showing cached data',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),

              // ── Main Layout ─────────────────────────────────────────────
              Expanded(
                child: isWide
                    ? _WideLayout(
                        tabs: tabs,
                        currentIndex: currentIndex,
                        unreadChat: unreadChat,
                        unreadCount: unreadCount,
                        onTap: (i, ctx) => _handleNavTap(i, ctx, ref, tabs),
                        child: child,
                      )
                    : child,
              ),
            ],
          ),

          // ── Bottom Nav (phone only; hidden on chat rooms) ───────────────
          bottomNavigationBar: isWide || hideBottomNav
              ? null
              : _buildBottomNav(
                  context,
                  ref,
                  tabs,
                  currentIndex,
                  unreadCount,
                  unreadChat,
                ),
        );
      },
    );
  }

  // ── Bottom Navigation Bar ─────────────────────────────────────────────────

  Widget _buildBottomNav(
    BuildContext context,
    WidgetRef ref,
    List<_NavItem> tabs,
    int currentIndex,
    int unreadCount,
    int unreadChat,
  ) {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        top: false,
        child: Container(
          margin: const EdgeInsets.fromLTRB(20, 4, 20, 2),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.primary, // Brand navy — matches the rest of the app
            borderRadius: BorderRadius.circular(100),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primary.withValues(alpha: 0.28),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.08),
              width: 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(tabs.length, (i) {
              final tab = tabs[i];
              final isSelected = currentIndex == i;
              
              Widget icon = Icon(
                isSelected ? tab.activeIcon : tab.icon,
                color: isSelected ? AppTheme.accent : Colors.white60,
                size: 24,
              );

              // Add badge for Chat tab
              if (tab.route == '/chat' && unreadChat > 0) {
                icon = Badge(
                  label: Text(
                    unreadChat > 99 ? '99+' : '$unreadChat',
                    style: const TextStyle(fontSize: 10),
                  ),
                  child: icon,
                );
              }



              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _handleNavTap(i, context, ref, tabs);
                  },
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedScale(
                    scale: isSelected ? 1.05 : 1.0,
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutBack,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOutCubic,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppTheme.accent.withValues(alpha: 0.18)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          icon,
                          if (isSelected) ...[
                            const SizedBox(height: 2),
                            Text(
                              tab.label,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.accent,
                              ),
                            ),
                          ]
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  // ── Navigation Handler ────────────────────────────────────────────────────

  void _handleNavTap(
    int i,
    BuildContext context,
    WidgetRef ref,
    List<_NavItem> tabs,
  ) {
    if (tabs[i].isSheet) {
      _showMoreSheet(context, ref);
      return;
    }
    context.go(tabs[i].route);
  }

  // ── More Sheet ────────────────────────────────────────────────────────────

  void _showMoreSheet(BuildContext context, WidgetRef ref) {
    bool hasPerm(String p) => ref.read(hasPermissionProvider(p));

    final canViewTeam = hasPerm('team_view');
    final canViewDocs = hasPerm('docs_view');
    final canViewReports = hasPerm('reports_view');
    // Admin panel: top-level role (Director, level 100) OR any admin-type
    // permission — matches the web sidebar so access reflects permissions, not
    // just role level.
    final canManageRoles = ref.read(currentRoleLevelProvider) >= 100 ||
        hasPerm('roles_manage') ||
        hasPerm('settings_manage') ||
        hasPerm('notifications_manage') ||
        hasPerm('attendance_view_all') ||
        hasPerm('contact_view') ||
        hasPerm('team_manage');
    final canViewProjects = hasPerm('projects_view');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (_, sc) => Container(
          decoration: const BoxDecoration(
            color: AppTheme.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: Column(
            children: [
              // Handle bar
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 48,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppTheme.divider,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: sc,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    const SizedBox(height: 12),

                    // Workspace section
                    const _SheetSectionLabel(label: 'Workspace'),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.divider),
                      ),
                      child: Column(
                        children: [
                          _SheetListItem(
                            icon: Icons.access_time_rounded,
                            label: 'My Attendance',
                            color: AppTheme.success,
                            isFirst: true,
                            isLast: false,
                            onTap: () {
                              Navigator.pop(ctx);
                              context.go('/my-attendance');
                            },
                          ),
                          if (canViewTeam)
                            _SheetListItem(
                              icon: Icons.group_rounded,
                              label: 'Team',
                              color: AppTheme.info,
                              isFirst: false,
                              isLast: false,
                              onTap: () {
                                Navigator.pop(ctx);
                                context.go('/team');
                              },
                            ),
                          if (canViewDocs)
                            _SheetListItem(
                              icon: Icons.folder_rounded,
                              label: 'Documents',
                              color: AppTheme.accent,
                              isFirst: false,
                              isLast: false,
                              onTap: () {
                                Navigator.pop(ctx);
                                context.go('/documents');
                              },
                            ),
                          if (canViewProjects)
                            _SheetListItem(
                              icon: Icons.book_rounded,
                              label: 'Site Diary',
                              color: AppTheme.success,
                              isFirst: false,
                              isLast: false,
                              onTap: () {
                                Navigator.pop(ctx);
                                context.go('/site-diary');
                              },
                            ),
                          if (canViewReports)
                            _SheetListItem(
                              icon: Icons.bar_chart_rounded,
                              label: 'Reports',
                              color: AppTheme.statusReview,
                              isFirst: false,
                              isLast: false,
                              onTap: () {
                                Navigator.pop(ctx);
                                context.go('/reports');
                              },
                            ),
                          _SheetListItem(
                            icon: Icons.emoji_events_rounded,
                            label: 'Performance & Points',
                            color: AppTheme.accent,
                            isFirst: false,
                            isLast: true,
                            onTap: () {
                              Navigator.pop(ctx);
                              context.go('/performance');
                            },
                          ),
                        ],
                      ),
                    ),

                    if (canManageRoles) ...[
                      const SizedBox(height: 24),

                      // Account section
                      const _SheetSectionLabel(label: 'Account'),
                      const SizedBox(height: 8),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppTheme.divider),
                        ),
                        child: Column(
                          children: [
                            _SheetListItem(
                              icon: Icons.admin_panel_settings_rounded,
                              label: 'Admin Panel',
                              color: AppTheme.statusReview,
                              isFirst: true,
                              isLast: true,
                              onTap: () {
                                Navigator.pop(ctx);
                                context.go('/admin');
                              },
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 32),

                    // Sign Out
                    Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        onTap: () async {
                          Navigator.pop(ctx);
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (dialogCtx) => AlertDialog(
                              backgroundColor: Colors.white,
                              surfaceTintColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                              ),
                              title: const Text(
                                'Sign Out?',
                                style: TextStyle(
                                  color: AppTheme.onSurface,
                                  fontWeight: FontWeight.w800,
                                  fontFamily: 'Plus Jakarta Sans',
                                ),
                              ),
                              content: const Text(
                                'You will be logged out of your account.',
                                style: TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 14,
                                ),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(dialogCtx, false),
                                  child: const Text(
                                    'Cancel',
                                    style: TextStyle(
                                      color: AppTheme.textMuted,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.pop(dialogCtx, true),
                                  child: const Text(
                                    'Sign Out',
                                    style: TextStyle(
                                      color: AppTheme.error,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            await ref.read(authRepositoryProvider).signOut();
                          }
                        },
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppTheme.error.withValues(alpha: 0.3)),
                            borderRadius: BorderRadius.circular(16),
                            color: AppTheme.error.withValues(alpha: 0.05),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.logout_rounded, color: AppTheme.error),
                              const SizedBox(width: 8),
                              const Text(
                                'Sign Out',
                                style: TextStyle(
                                  color: AppTheme.error,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Wide Layout (Tablet / Desktop) ──────────────────────────────────────────

class _WideLayout extends ConsumerWidget {
  final Widget child;
  final List<_NavItem> tabs;
  final int currentIndex;
  final int unreadChat;
  final int unreadCount;
  final void Function(int, BuildContext) onTap;

  const _WideLayout({
    required this.tabs,
    required this.currentIndex,
    required this.unreadChat,
    required this.unreadCount,
    required this.onTap,
    required this.child,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDesktop = Responsive.isDesktop(context);

    return Row(
      children: [
        // ── Navigation Rail ─────────────────────────────────────────────
        NavigationRail(
          selectedIndex: currentIndex,
          extended: isDesktop,
          minWidth: 72,
          minExtendedWidth: 220,
          backgroundColor: Colors.white,
          indicatorColor: AppTheme.primary.withValues(alpha: 0.09),
          selectedIconTheme: const IconThemeData(color: AppTheme.primary),
          unselectedIconTheme: IconThemeData(color: Colors.grey.shade600),
          selectedLabelTextStyle: const TextStyle(
            color: AppTheme.primary,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          unselectedLabelTextStyle: TextStyle(
            color: Colors.grey.shade600,
            fontSize: 13,
          ),
          onDestinationSelected: (i) => onTap(i, context),
          leading: Padding(
            padding: EdgeInsets.symmetric(
              vertical: 20,
              horizontal: isDesktop ? 16 : 0,
            ),
            child: isDesktop
                ? Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.brand.withValues(alpha: 0.16),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: Center(
                          child: AppLogo(size: 24, color: AppTheme.brand),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Task Pilot',
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F2448),
                          letterSpacing: -0.3,
                        ),
                      ),
                    ],
                  )
                : Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.brand.withValues(alpha: 0.16),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: Center(
                      child: AppLogo(size: 24, color: AppTheme.brand),
                    ),
                  ),
          ),
          destinations: tabs.map((tab) {
            Widget icon = Icon(tab.icon);

            // Add badge for Chat tab
            if (tab.route == '/chat' && unreadChat > 0) {
              icon = Badge(
                label: Text(
                  '$unreadChat',
                  style: const TextStyle(fontSize: 10),
                ),
                child: Icon(tab.icon),
              );
            }



            return NavigationRailDestination(
              icon: icon,
              selectedIcon: Icon(tab.activeIcon),
              label: Text(tab.label),
            );
          }).toList(),
        ),

        const VerticalDivider(width: 1),

        // ── Page Content ────────────────────────────────────────────────
        Expanded(child: child),
      ],
    );
  }
}

// ─── Sheet Helper Widgets ─────────────────────────────────────────────────────

/// Grey uppercase section label (e.g. "WORKSPACE", "ACCOUNT")
class _SheetSectionLabel extends StatelessWidget {
  final String label;
  const _SheetSectionLabel({required this.label});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 2),
    child: Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppTheme.textMuted,
        letterSpacing: 0.8,
      ),
    ),
  );
}

class _SheetListItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool isFirst;
  final bool isLast;

  const _SheetListItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    required this.isFirst,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    final radius = Radius.circular(20);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.only(
            topLeft: isFirst ? radius : Radius.zero,
            topRight: isFirst ? radius : Radius.zero,
            bottomLeft: isLast ? radius : Radius.zero,
            bottomRight: isLast ? radius : Radius.zero,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.onSurface,
                    ),
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppTheme.textLight,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
        if (!isLast)
          const Divider(height: 1, indent: 70, color: AppTheme.divider),
      ],
    );
  }
}
