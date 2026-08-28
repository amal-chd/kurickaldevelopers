import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/approval_status.dart';
import '../shared/widgets/app_logo.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../core/utils/responsive.dart';
import '../../data/models/project_model.dart';
import '../../providers/user_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/notification_provider.dart';
import '../../providers/role_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/avatar_widget.dart';
import '../tasks/widgets/task_card.dart';
import '../../core/enums/task_status.dart';
import '../../core/utils/date_utils.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/task_model.dart';
import '../shared/widgets/error_widget.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  late final ScrollController _scrollCtrl;
  bool _headerCollapsed = false;

  static const double _collapseOffset = 80;

  @override
  void initState() {
    super.initState();
    _scrollCtrl = ScrollController()
      ..addListener(() {
        final collapsed = _scrollCtrl.offset > _collapseOffset;
        if (collapsed != _headerCollapsed) {
          setState(() => _headerCollapsed = collapsed);
        }
      });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(currentUserProvider);
    final roleAsync = ref.watch(currentRoleProvider);
    final tasksAsync = ref.watch(userTasksProvider);
    final projectsAsync = ref.watch(projectsProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final isWide = Responsive.isWide(context);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: userAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(currentUserProvider),
        ),
        data: (user) {
          if (user == null) return const ShimmerList();
          final roleName = roleAsync.value?.name ?? '';

          return RefreshIndicator(
            color: AppTheme.primary,
            onRefresh: () async {
              HapticFeedback.lightImpact();
              ref.invalidate(userTasksProvider);
              ref.invalidate(projectsProvider);
            },
            child: CustomScrollView(
              controller: _scrollCtrl,
              slivers: [
                // ── App Bar ────────────────────────────────────────────────
                SliverAppBar(
                  pinned: true,
                  backgroundColor: AppTheme.background.withValues(alpha: 0.9),
                  foregroundColor: AppTheme.onSurface,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  surfaceTintColor: Colors.transparent,
                  automaticallyImplyLeading: false,
                  centerTitle: false,
                  title: isWide
                      ? const SizedBox.shrink()
                      : AnimatedOpacity(
                          opacity: _headerCollapsed ? 1.0 : 0.0,
                          duration: const Duration(milliseconds: 200),
                          child: _CollapsedTitle(roleName: roleName),
                        ),
                  actions: [
                    // Notifications bell
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          margin: const EdgeInsets.only(top: 8, bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: AppTheme.softShadow,
                            border: Border.all(
                              color: AppTheme.divider.withValues(alpha: 0.3),
                            ),
                          ),
                          child: IconButton(
                            icon: const Icon(
                              Icons.notifications_outlined,
                              color: AppTheme.onSurface,
                              size: 22,
                            ),
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              context.push('/notifications');
                            },
                          ),
                        ),
                        if (unreadCount > 0)
                          Positioned(
                            right: -2,
                            top: 6,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: AppTheme.accent,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                              child: Text(
                                unreadCount > 99 ? '99+' : '$unreadCount',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.plusJakartaSans(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Padding(
                      padding: const EdgeInsets.only(right: 20),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          context.push('/profile');
                        },
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: AppTheme.softShadow,
                          ),
                          child: AvatarWidget(
                            imageUrl: user.avatarUrl,
                            name: user.name,
                            size: 40,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // ── Body ───────────────────────────────────────────────────
                SliverToBoxAdapter(
                  child: Builder(
                    builder: (context) {
                      // ── Permission flags ──
                      final canViewTasks = ref.watch(
                        hasPermissionProvider('tasks_view'),
                      );
                      final canApprove = ref.watch(
                        hasPermissionProvider('tasks_approve'),
                      );
                      final canViewProjects = ref.watch(
                        hasPermissionProvider('projects_view'),
                      );
                      final canViewTeam = ref.watch(
                        hasPermissionProvider('team_view'),
                      );
                      // Owner = Director/Owner role (level 100). Completion
                      // Analytics + Team Member Statistics are owner-only.
                      final isOwner =
                          (ref.watch(currentRoleProvider).value?.level ?? 0) >= 100;

                      return tasksAsync.when(
                        loading: () => const ShimmerList(count: 4),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (tasks) {
                          final today =
                              tasks.where((t) => t.dueDate.isToday).length;
                          final overdue =
                              tasks.where((t) => t.isOverdue).length;
                          final totalTasks = tasks.length;

                          return projectsAsync.when(
                            loading: () => const SizedBox.shrink(),
                            error: (_, __) => const SizedBox.shrink(),
                            data: (projects) {
                              final activeProjects = projects
                                  .where(
                                    (p) => p.status == ProjectStatus.active,
                                  )
                                  .toList();

                              // Calculate completed task metrics
                              final doneTasks = tasks.where((t) => t.status == TaskStatus.done).toList();
                              int onTimeCount = 0;
                              int lateCount = 0;
                              int delaySumSeconds = 0;

                              for (final t in doneTasks) {
                                final firstAssigneeId = t.assigneeIds.isNotEmpty ? t.assigneeIds.first : '';
                                final prog = t.memberProgress[firstAssigneeId];
                                if (prog != null && prog is Map) {
                                  final cStatus = prog['completionStatus'] as String?;
                                  if (cStatus != null) {
                                    if (cStatus == 'completed_on_time' || cStatus == 'completed') {
                                      onTimeCount++;
                                    } else if (cStatus == 'completed_late') {
                                      lateCount++;
                                      final dSecs = prog['delaySeconds'] as int?;
                                      if (dSecs != null) {
                                        delaySumSeconds += dSecs;
                                      }
                                    }
                                  } else {
                                    final uUpdate = AppDateUtils.fromTimestamp(prog['updatedAt']);
                                    if (uUpdate != null) {
                                      if (uUpdate.isAfter(t.dueDate)) {
                                        lateCount++;
                                        delaySumSeconds += uUpdate.difference(t.dueDate).inSeconds;
                                      } else {
                                        onTimeCount++;
                                      }
                                    } else {
                                      onTimeCount++;
                                    }
                                  }
                                } else {
                                  onTimeCount++;
                                }
                              }

                              final onTimeRate = doneTasks.isNotEmpty ? ((onTimeCount / doneTasks.length) * 100).round() : 100;
                              final lateRate = doneTasks.isNotEmpty ? ((lateCount / doneTasks.length) * 100).round() : 0;
                              final avgDelaySeconds = lateCount > 0 ? (delaySumSeconds ~/ lateCount) : 0;
                              final avgDelayText = lateCount > 0 ? AppDateUtils.formatDelay(avgDelaySeconds) : 'No delay';

                              // Build permission-aware KPI list
                              final kpiCards = <_KpiCardData>[
                                _KpiCardData(
                                  title: AppStrings.tasksDueToday,
                                  value: '$today',
                                  icon: Icons.today_rounded,
                                  color: AppTheme.pastelBlue,
                                  route: '/tasks',
                                  subtitle: 'Due today',
                                ),
                                _KpiCardData(
                                  title: AppStrings.overdueTasks,
                                  value: '$overdue',
                                  icon: Icons.warning_amber_rounded,
                                  color: overdue > 0
                                      ? AppTheme.pastelPink
                                      : AppTheme.pastelGreen,
                                  route: '/tasks',
                                  subtitle: overdue > 0
                                      ? 'Need attention'
                                      : 'All on track',
                                ),
                                _KpiCardData(
                                  title: 'Total Tasks',
                                  value: '$totalTasks',
                                  icon: Icons.assignment_rounded,
                                  color: AppTheme.pastelYellow,
                                  route: '/tasks',
                                  subtitle: 'All assigned tasks',
                                ),
                                if (canApprove)
                                  _KpiCardData(
                                    title: 'Awaiting Review',
                                    value:
                                        '${tasks.where((t) => t.status == TaskStatus.underReview).length}',
                                    icon: Icons.fact_check_rounded,
                                    color: AppTheme.pastelPurple,
                                    route: '/tasks',
                                    subtitle: 'Pending your approval',
                                  ),
                                if (canViewProjects)
                                  _KpiCardData(
                                    title: AppStrings.activeProjects,
                                    value: '${activeProjects.length}',
                                    icon: Icons.business_rounded,
                                    color: AppTheme.pastelPurple,
                                    route: '/projects',
                                    subtitle: 'Sites running',
                                  ),
                              ];

                              return Center(
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    maxWidth: Responsive.maxContentWidth(
                                      context,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      // ── Wide greeting bar (tablet/desktop) ──────
                                      if (isWide)
                                        _WideGreetingBar(
                                          user: user,
                                          roleName: roleName,
                                        )
                                      else
                                        _HeroGreeting(
                                          user: user,
                                          roleName: roleName,
                                        ),

                                      const SizedBox(height: 12),

                                      // ── KPI Cards ───────────────────────────────
                                      if (kpiCards.isNotEmpty)
                                        Padding(
                                          padding: Responsive.screenPadding(
                                            context,
                                          ).copyWith(top: 20, bottom: 0),
                                          child: _KpiGridDynamic(
                                            cards: kpiCards,
                                          ),
                                        ),

                                      // ── Site Diary CTA ──────────────────────────
                                      if (canViewProjects &&
                                          activeProjects.isNotEmpty)
                                        Padding(
                                          padding: Responsive.screenPadding(
                                            context,
                                          ).copyWith(top: 16, bottom: 0),
                                          child: _TodayDiaryCta(
                                            activeProjects: activeProjects,
                                          ),
                                        ),

                                      // ── Quick Actions ───────────────────────────
                                      _SectionHeader(title: 'Quick Actions'),
                                      Padding(
                                        padding: Responsive.screenPadding(
                                          context,
                                        ).copyWith(top: 0, bottom: 0),
                                        child: _QuickActionsRow(),
                                      ),

                                      // ── Completion Analytics + Team Member
                                      // Statistics (Owner/Director only) ─────────
                                      if (isOwner)
                                        _buildCompletionAnalyticsSection(
                                          context,
                                          ref,
                                          tasks,
                                          onTimeRate,
                                          lateRate,
                                          avgDelayText,
                                        ),

                                      // ── My Tasks (gated) ────────────────────────
                                      if (canViewTasks) ...[
                                        if (tasks.isNotEmpty) ...[
                                          _SectionHeader(
                                            title: AppStrings.myTasks,
                                            onSeeAll: () {
                                              HapticFeedback.lightImpact();
                                              context.go('/tasks');
                                            },
                                          ),
                                          SizedBox(
                                            height: 220,
                                            child: ListView.builder(
                                              scrollDirection: Axis.horizontal,
                                              padding: Responsive.screenPadding(
                                                context,
                                              ),
                                              itemCount: tasks.length > 6
                                                  ? 6
                                                  : tasks.length,
                                              itemBuilder: (_, i) => SizedBox(
                                                width: 230,
                                                child: Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        right: 12,
                                                      ),
                                                  child: TaskCard(
                                                    task: tasks[i],
                                                    onTap: () {
                                                      HapticFeedback.lightImpact();
                                                      context.push(
                                                        '/tasks/${tasks[i].id}',
                                                      );
                                                    },
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ] else ...[
                                          _SectionHeader(
                                            title: AppStrings.myTasks,
                                          ),
                                          Padding(
                                            padding: Responsive.screenPadding(
                                              context,
                                            ).copyWith(top: 0),
                                            child: _EmptyTasksCard(),
                                          ),
                                        ],
                                      ],

                                      // ── Team Summary (gated) ────────────────────
                                      if (canViewTeam)
                                        Padding(
                                          padding: Responsive.screenPadding(
                                            context,
                                          ).copyWith(top: 20, bottom: 0),
                                          child: const _TeamSummaryCard(),
                                        ),

                                      // ── Active Sites (gated) ────────────────────
                                      if (canViewProjects &&
                                          activeProjects.isNotEmpty) ...[
                                        _SectionHeader(
                                          title: AppStrings.activeSites,
                                          onSeeAll: () {
                                            HapticFeedback.lightImpact();
                                            context.go('/projects');
                                          },
                                        ),
                                        Padding(
                                          padding: Responsive.screenPadding(
                                            context,
                                          ).copyWith(top: 0),
                                          child: isWide
                                              ? _SiteGrid(
                                                  projects: activeProjects,
                                                )
                                              : _SiteList(
                                                  projects: activeProjects,
                                                ),
                                        ),
                                        if (activeProjects.length > 3)
                                          Padding(
                                            padding: Responsive.screenPadding(
                                              context,
                                            ),
                                            child: OutlinedButton.icon(
                                              onPressed: () {
                                                HapticFeedback.lightImpact();
                                                context.go('/projects');
                                              },
                                              icon: const Icon(
                                                Icons.arrow_forward_rounded,
                                                size: 16,
                                              ),
                                              label: Text(
                                                '+${activeProjects.length - 3} more projects',
                                                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
                                              ),
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor:
                                                    AppTheme.primary,
                                                side: const BorderSide(
                                                  color: AppTheme.primary,
                                                ),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                ),
                                              ),
                                            ),
                                          ),
                                      ],

                                      const SizedBox(height: 100),
                                    ],
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCompletionAnalyticsSection(
    BuildContext context,
    WidgetRef ref,
    List<TaskModel> allTasks,
    int onTimeRate,
    int lateRate,
    String avgDelayText,
  ) {
    final allUsersAsync = ref.watch(allUsersProvider);

    return Padding(
      padding: Responsive.screenPadding(context).copyWith(top: 20, bottom: 0),
      child: Card(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          side: BorderSide(color: AppTheme.divider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.trending_up_rounded, color: AppColors.accent),
                  const SizedBox(width: 8),
                  Text(
                    'Completion Analytics',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.onSurface,
                      fontFamily: 'Plus Jakarta Sans',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildMetricTile(
                      label: 'On-Time Rate',
                      value: '$onTimeRate%',
                      icon: Icons.check_circle_outline_rounded,
                      color: AppTheme.success,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Late Rate',
                      value: '$lateRate%',
                      icon: Icons.warning_amber_rounded,
                      color: AppTheme.error,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Avg Delay',
                      value: avgDelayText,
                      icon: Icons.access_time_rounded,
                      color: AppTheme.statusReview,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                'Team Member Statistics',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.onSurface,
                  fontFamily: 'Plus Jakarta Sans',
                ),
              ),
              const SizedBox(height: 8),
              allUsersAsync.when(
                loading: () => const SizedBox(
                  height: 60,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
                error: (e, _) => Text('Error loading team stats: $e'),
                data: (users) {
                  return ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: users.length,
                    separatorBuilder: (_, __) => Divider(color: AppTheme.divider.withValues(alpha: 0.3)),
                    itemBuilder: (ctx, index) {
                      final u = users[index];
                      final memberTasks = allTasks.where((t) => t.assigneeIds.contains(u.uid)).toList();
                      final memberDone = memberTasks.where((t) => t.status == TaskStatus.done).toList();

                      final memberOnTime = memberDone.where((t) {
                        final prog = t.memberProgress[u.uid];
                        if (prog != null && prog is Map) {
                          final cStatus = prog['completionStatus'] as String?;
                          if (cStatus != null) {
                            return cStatus == 'completed_on_time' || cStatus == 'completed';
                          }
                          final uUpdate = AppDateUtils.fromTimestamp(prog['updatedAt']);
                          if (uUpdate != null) {
                            return uUpdate.isBefore(t.dueDate) || uUpdate.isAtSameMomentAs(t.dueDate);
                          }
                        }
                        return true;
                      }).toList();

                      final memberLate = memberDone.where((t) {
                        final prog = t.memberProgress[u.uid];
                        if (prog != null && prog is Map) {
                          final cStatus = prog['completionStatus'] as String?;
                          if (cStatus != null) {
                            return cStatus == 'completed_late';
                          }
                          final uUpdate = AppDateUtils.fromTimestamp(prog['updatedAt']);
                          if (uUpdate != null) {
                            return uUpdate.isAfter(t.dueDate);
                          }
                        }
                        return false;
                      }).toList();

                      final mOnTimeRate = memberDone.isNotEmpty ? ((memberOnTime.length / memberDone.length) * 100).round() : 100;
                      final mLateRate = memberDone.isNotEmpty ? ((memberLate.length / memberDone.length) * 100).round() : 0;

                      int mDelaySum = 0;
                      int mLateCount = 0;
                      for (final t in memberLate) {
                        final prog = t.memberProgress[u.uid];
                        if (prog != null && prog is Map) {
                          final dSecs = prog['delaySeconds'] as int?;
                          if (dSecs != null) {
                            mDelaySum += dSecs;
                            mLateCount++;
                          } else {
                            final uUpdate = AppDateUtils.fromTimestamp(prog['updatedAt']);
                            if (uUpdate != null && uUpdate.isAfter(t.dueDate)) {
                              mDelaySum += uUpdate.difference(t.dueDate).inSeconds;
                              mLateCount++;
                            }
                          }
                        }
                      }

                      final mAvgDelay = mLateCount > 0 ? (mDelaySum ~/ mLateCount) : 0;
                      final mAvgDelayText = mLateCount > 0 ? AppDateUtils.formatDelay(mAvgDelay) : '—';

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            AvatarWidget(
                              name: u.name,
                              imageUrl: u.avatarUrl,
                              size: 32,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    u.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      fontFamily: 'Plus Jakarta Sans',
                                    ),
                                  ),
                                  Text(
                                    '${memberDone.length} completed',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      '$mOnTimeRate% on-time',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: mOnTimeRate >= 80 ? AppTheme.success : AppTheme.statusReview,
                                      ),
                                    ),
                                    if (mLateRate > 0) ...[
                                      const SizedBox(width: 6),
                                      Text(
                                        '($mLateRate% late)',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: AppTheme.error,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                if (mLateRate > 0)
                                  Text(
                                    'avg delay: $mAvgDelayText',
                                    style: TextStyle(
                                      fontSize: 9,
                                      color: AppTheme.error.withValues(alpha: 0.8),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: color,
              fontFamily: 'Plus Jakarta Sans',
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Greeting Icon Helper ────────────────────────────────────────────────────

IconData _getGreetingIcon() {
  final hour = DateTime.now().hour;
  if (hour < 6) return Icons.nights_stay_outlined;
  if (hour < 12) return Icons.wb_sunny_outlined;
  if (hour < 17) return Icons.light_mode_outlined;
  if (hour < 21) return Icons.wb_twilight_outlined;
  return Icons.nights_stay_outlined;
}

// ─── Collapsed Title ──────────────────────────────────────────────────────────

class _CollapsedTitle extends StatelessWidget {
  final String roleName;
  const _CollapsedTitle({required this.roleName});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppTheme.primary,
            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
            boxShadow: AppTheme.softShadow,
          ),
          child: const Center(
            child: AppLogo(size: 18, color: Colors.white),
          ),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              AppStrings.appName,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.onSurface,
                letterSpacing: -0.3,
              ),
            ),
            if (roleName.isNotEmpty)
              Text(
                roleName,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: AppTheme.textMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ─── Wide Greeting Bar (tablet / desktop) ─────────────────────────────────────

class _WideGreetingBar extends StatelessWidget {
  final dynamic user;
  final String roleName;
  const _WideGreetingBar({required this.user, required this.roleName});

  @override
  Widget build(BuildContext context) {
    final greetingIcon = _getGreetingIcon();
    final name = user.name.trim().split(' ').first;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (roleName.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      roleName,
                      style: GoogleFonts.inter(
                        color: AppTheme.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                Row(
                  children: [
                    Icon(
                      greetingIcon,
                      color: AppTheme.accent,
                      size: 26,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        AppStrings.greeting(name),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.onSurface,
                          height: 1.1,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      color: AppTheme.textLight,
                      size: 14,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          AvatarWidget(imageUrl: user.avatarUrl, name: user.name, size: 56),
        ],
      ),
    );
  }
}

// ─── Hero Greeting (Phone) ────────────────────────────────────────────────

class _HeroGreeting extends StatelessWidget {
  final dynamic user;
  final String roleName;
  const _HeroGreeting({required this.user, required this.roleName});

  @override
  Widget build(BuildContext context) {
    final greetingIcon = _getGreetingIcon();
    final greetingText = AppStrings.greeting(user.name.trim().split(' ').first);
    final commaIndex = greetingText.indexOf(',');
    final greetingPhrase = commaIndex != -1 ? greetingText.substring(0, commaIndex) : greetingText;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        Responsive.screenPadding(context).left,
        12,
        Responsive.screenPadding(context).right,
        8,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      color: AppTheme.primary,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      roleName,
                      style: GoogleFonts.inter(
                        color: AppTheme.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(
                greetingIcon,
                color: AppTheme.accent,
                size: 26,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$greetingPhrase,',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.onSurface,
                    height: 1.1,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
            ],
          ),
          Text(
            '${user.name.trim().split(' ').first}!',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
              height: 1.1,
              letterSpacing: -1.0,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
            style: GoogleFonts.inter(
              fontSize: 14,
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── KPI Grid Dynamic ──────────────────────────────────────────────────────────

class _KpiCardData {
  final String title, value, subtitle;
  final IconData icon;
  final Color color;
  final String route;
  const _KpiCardData({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.route,
  });
}

// ─── Site Diary CTA ───────────────────────────────────────────────────────────

class _TodayDiaryCta extends StatelessWidget {
  final List<ProjectModel> activeProjects;
  const _TodayDiaryCta({required this.activeProjects});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/site-diary');
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF10B981), Color(0xFF059669)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF10B981).withValues(alpha: 0.15),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: const Icon(
                Icons.edit_note_rounded,
                color: Colors.white,
                size: 26,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Today's Site Diary",
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('EEEE, d MMMM').format(DateTime.now()),
                    style: GoogleFonts.inter(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(100),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Log Now',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: Colors.white,
                    size: 12,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Quick Actions Row ────────────────────────────────────────────────────────

class _QuickActionsRow extends ConsumerWidget {
  const _QuickActionsRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    bool hasPerm(String p) => ref.watch(hasPermissionProvider(p));
    // Matches the web sidebar + More sheet: Director level OR any admin perm.
    final isAdminLike = (ref.watch(currentRoleLevelProvider) >= 100) ||
        hasPerm('roles_manage') ||
        hasPerm('settings_manage') ||
        hasPerm('notifications_manage') ||
        hasPerm('attendance_view_all') ||
        hasPerm('contact_view') ||
        hasPerm('team_manage');

    // Every action is gated to a destination the role can actually use, so the
    // row is a true reflection of what this user is allowed to do.
    final actions = <_QuickAction>[
      if (hasPerm('tasks_create'))
        const _QuickAction(
          icon: Icons.add_task_rounded,
          label: 'New Task',
          color: AppTheme.accent,
          route: '/tasks/create',
          isPush: true,
        ),
      // Attendance is a core action for every user (there is no gate on it).
      const _QuickAction(
        icon: Icons.fingerprint_rounded,
        label: 'Check In',
        color: AppTheme.success,
        route: '/my-attendance',
        isPush: true,
      ),
      if (hasPerm('time_log'))
        const _QuickAction(
          icon: Icons.book_rounded,
          label: 'Diary',
          color: AppTheme.statusReview,
          route: '/site-diary',
          isPush: true,
        ),
      if (hasPerm('chat_view'))
        const _QuickAction(
          icon: Icons.chat_bubble_rounded,
          label: 'Chat',
          color: AppTheme.info,
          route: '/chat',
          isPush: true,
        ),
      if (hasPerm('docs_view'))
        const _QuickAction(
          icon: Icons.folder_open_rounded,
          label: 'Docs',
          color: AppTheme.accent,
          route: '/documents',
          isPush: true,
        ),
      if (hasPerm('team_view'))
        const _QuickAction(
          icon: Icons.groups_rounded,
          label: 'Team',
          color: AppTheme.statusReview,
          route: '/team',
          isPush: true,
        ),
      if (hasPerm('projects_create'))
        const _QuickAction(
          icon: Icons.add_business_rounded,
          label: 'Project',
          color: AppTheme.statusReview,
          route: '/projects/create',
          isPush: true,
        ),
      if (hasPerm('reports_view'))
        const _QuickAction(
          icon: Icons.bar_chart_rounded,
          label: 'Reports',
          color: AppTheme.info,
          route: '/reports',
          isPush: true,
        ),
      if (isAdminLike)
        const _QuickAction(
          icon: Icons.admin_panel_settings_rounded,
          label: 'Admin',
          color: AppTheme.primary,
          route: '/admin',
          isPush: true,
        ),
    ];

    return SizedBox(
      height: 130,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: Responsive.screenPadding(context),
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, i) => _QuickActionTile(action: actions[i]),
      ),
    );
  }
}

class _QuickAction {
  final IconData icon;
  final String label, route;
  final Color color;
  final bool isPush;
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.route,
    required this.color,
    this.isPush = false,
  });
}

class _QuickActionTile extends StatelessWidget {
  final _QuickAction action;
  const _QuickActionTile({required this.action});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (action.isPush) {
          context.push(action.route);
        } else {
          context.go(action.route);
        }
      },
      child: Container(
        width: 100,
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: action.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Icon(action.icon, color: action.color, size: 24),
            ),
            const SizedBox(height: 10),
            Text(
              action.label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppTheme.onSurface,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Section Header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;
  const _SectionHeader({required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Responsive.screenPadding(context).left,
        24,
        Responsive.screenPadding(context).right,
        14,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
            ),
          ),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.primary,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'See all',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Empty Tasks ──────────────────────────────────────────────────────────────

class _EmptyTasksCard extends StatelessWidget {
  const _EmptyTasksCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.success.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_outline_rounded,
              color: AppTheme.success,
              size: 32,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'All clear!',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppTheme.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'No tasks assigned yet',
                  style: GoogleFonts.inter(
                    color: AppTheme.textMuted,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Site Grid (tablet/desktop) ───────────────────────────────────────────────

class _SiteGrid extends StatelessWidget {
  final List<ProjectModel> projects;
  const _SiteGrid({required this.projects});

  @override
  Widget build(BuildContext context) {
    final items = projects.take(6).toList();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 360,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.35,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) => _SiteCard(
        project: items[i],
        onTap: () => context.push('/projects/${items[i].id}'),
      ),
    );
  }
}

// ─── Site List (phone) ────────────────────────────────────────────────────────

class _SiteList extends StatelessWidget {
  final List<ProjectModel> projects;
  const _SiteList({required this.projects});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: projects.length > 3 ? 3 : projects.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _SiteCard(
        project: projects[i],
        onTap: () => context.push('/projects/${projects[i].id}'),
      ),
    );
  }
}

// ─── Site Card ────────────────────────────────────────────────────────────────

class _SiteCard extends StatelessWidget {
  final ProjectModel project;
  final VoidCallback onTap;
  const _SiteCard({required this.project, required this.onTap});

  Color get _healthColor {
    switch (project.healthStatus) {
      case HealthStatus.green:
        return AppTheme.success;
      case HealthStatus.amber:
        return AppTheme.accent;
      case HealthStatus.red:
        return AppTheme.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    final daysLeft = project.expectedEndDate.difference(DateTime.now()).inDays;
    final isOverdue = daysLeft < 0;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          boxShadow: AppTheme.softShadow,
          border: Border.all(
            color: AppTheme.divider.withValues(alpha: 0.8),
            width: 1.0,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          project.name,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            color: AppTheme.onSurface,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.location_on_outlined,
                                size: 16,
                                color: AppTheme.primary,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                project.siteAddress,
                                style: GoogleFonts.inter(
                                  color: AppTheme.textMuted,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: (isOverdue ? AppTheme.error : AppTheme.success)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      isOverdue
                          ? '${daysLeft.abs()}d late'
                          : '${daysLeft}d left',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: isOverdue ? AppTheme.error : AppTheme.success,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: _healthColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          project.healthStatus == HealthStatus.green
                              ? Icons.check_circle_rounded
                              : project.healthStatus == HealthStatus.amber
                              ? Icons.warning_rounded
                              : Icons.error_rounded,
                          color: _healthColor,
                          size: 14,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          project.healthStatus.name[0].toUpperCase() +
                              project.healthStatus.name.substring(1),
                          style: GoogleFonts.plusJakartaSans(
                            color: _healthColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Progress',
                          style: GoogleFonts.inter(
                            color: AppTheme.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(100),
                          child: LinearProgressIndicator(
                            value: project.progressPercent / 100,
                            minHeight: 8,
                            backgroundColor: AppTheme.divider,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              _healthColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '${project.progressPercent}%',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                      color: _healthColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── KPI Grid Dynamic ──────────────────────────────────────────────────────────

class _KpiGridDynamic extends StatelessWidget {
  final List<_KpiCardData> cards;

  const _KpiGridDynamic({required this.cards});

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();

    final isWide =
        Responsive.isDesktop(context) || Responsive.isTablet(context);

    if (isWide) {
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.6,
        ),
        itemCount: cards.length,
        itemBuilder: (_, i) => _buildCard(context, cards[i]),
      );
    }

    // Phone layout
    return Column(
      children: [
        for (int i = 0; i < cards.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: AspectRatio(
                    aspectRatio: 1.15,
                    child: _buildCard(context, cards[i]),
                  ),
                ),
                const SizedBox(width: 12),
                if (i + 1 < cards.length)
                  Expanded(
                    child: AspectRatio(
                      aspectRatio: 1.15,
                      child: _buildCard(context, cards[i + 1]),
                    ),
                  )
                else
                  const Spacer(),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildCard(BuildContext context, _KpiCardData card) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        context.go(card.route);
      },
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: card.color,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: card.color.withValues(alpha: 0.15),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(card.icon, color: AppTheme.onSurface.withValues(alpha: 0.8), size: 20),
                ),
                const Spacer(),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 12,
                  color: AppTheme.onSurface.withValues(alpha: 0.4),
                ),
              ],
            ),
            const Spacer(),
            Text(
              card.value,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: AppTheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              card.title,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.onSurface,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _TeamSummaryCard extends ConsumerWidget {
  const _TeamSummaryCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        context.go('/team');
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.primary.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.people_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Team & Attendance',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Manage staff on site today',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 16,
                  color: AppTheme.primary,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

