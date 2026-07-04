import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/models/task_model.dart';
import '../../app/theme.dart';
import '../../core/enums/task_status.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../core/utils/file_utils.dart';
import '../../data/models/attendance_model.dart';
import '../../data/models/document_model.dart';
import '../../data/models/project_model.dart';
import '../../data/models/site_diary_model.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/document_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/site_diary_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/permission_gate.dart';
import '../shared/widgets/status_chip.dart';
import 'gantt_chart_widget.dart';

class ProjectDetailScreen extends ConsumerStatefulWidget {
  final String projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  ConsumerState<ProjectDetailScreen> createState() =>
      _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _deleteProject() async {
    final confirmed =
        await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Project?'),
            content: const Text(
              'This will permanently remove the project and its milestones. This action cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.error,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed) return;

    try {
      await ref.read(projectRepositoryProvider).deleteProject(widget.projectId);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  Color _statusColor(ProjectStatus status) {
    switch (status) {
      case ProjectStatus.active:
        return AppTheme.success;
      case ProjectStatus.onHold:
        return AppTheme.accent;
      case ProjectStatus.completed:
        return AppTheme.info;
    }
  }

  Color _healthColor(HealthStatus health) {
    switch (health) {
      case HealthStatus.green:
        return AppTheme.healthGreen;
      case HealthStatus.amber:
        return AppTheme.healthAmber;
      case HealthStatus.red:
        return AppTheme.healthRed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final projectAsync = ref.watch(projectProvider(widget.projectId));
    final canEdit = ref.watch(hasPermissionProvider('projects_edit'));
    final canDelete = ref.watch(hasPermissionProvider('projects_delete'));

    return projectAsync.when(
      loading: () => const Scaffold(body: LoadingWidget()),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Project Detail')),
        body: AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(projectProvider(widget.projectId)),
        ),
      ),
      data: (project) {
        if (project == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Project Detail')),
            body: const EmptyStateWidget(
              icon: Icons.folder_off_rounded,
              title: 'Project not found',
              subtitle: 'This project may have been deleted.',
            ),
          );
        }

        final now = DateTime.now();
        final daysLeft = project.expectedEndDate.difference(now).inDays;
        final isOverdue =
            daysLeft < 0 && project.status != ProjectStatus.completed;
        final statusColor = _statusColor(project.status);
        final healthColor = _healthColor(project.healthStatus);

        return Scaffold(
          backgroundColor: AppTheme.background,
          body: NestedScrollView(
            headerSliverBuilder: (context, _) => [
              SliverAppBar(
                expandedHeight: 292,
                pinned: true,
                backgroundColor: Colors.white,
                foregroundColor: AppTheme.onSurface,
                elevation: 0,
                scrolledUnderElevation: 2,
                surfaceTintColor: Colors.transparent,
                title: Text(
                  project.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppTheme.onSurface,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                    fontFamily: 'Plus Jakarta Sans',
                  ),
                ),
                actions: [
                  if (canEdit || canDelete)
                    PopupMenuButton<String>(
                      onSelected: (val) {
                        if (val == 'edit') {
                          context.push('/projects/${widget.projectId}/edit');
                        } else if (val == 'delete') {
                          _deleteProject();
                        }
                      },
                      itemBuilder: (ctx) => [
                        if (canEdit)
                          const PopupMenuItem(
                            value: 'edit',
                            child: Row(
                              children: [
                                Icon(
                                  Icons.edit_outlined,
                                  size: 20,
                                  color: AppTheme.onSurface,
                                ),
                                SizedBox(width: 10),
                                Text(
                                  'Edit Project',
                                  style: TextStyle(color: AppTheme.onSurface),
                                ),
                              ],
                            ),
                          ),
                        if (canDelete)
                          const PopupMenuItem(
                            value: 'delete',
                            child: Row(
                              children: [
                                Icon(
                                  Icons.delete_outline_rounded,
                                  size: 20,
                                  color: AppTheme.error,
                                ),
                                SizedBox(width: 10),
                                Text(
                                  'Delete Project',
                                  style: TextStyle(color: AppTheme.error),
                                ),
                              ],
                            ),
                          ),
                      ],
                      icon: const Icon(
                        Icons.more_vert_rounded,
                        color: AppTheme.onSurface,
                      ),
                    ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.fromLTRB(20, 100, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        // Status chip + health dot
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(100),
                                border: Border.all(
                                  color: statusColor.withValues(alpha: 0.35),
                                  width: 1.5,
                                ),
                              ),
                              child: Text(
                                project.status.label,
                                style: TextStyle(
                                  color: statusColor,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  fontFamily: 'Inter',
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: healthColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              project.healthStatus.name[0].toUpperCase() +
                                  project.healthStatus.name.substring(1),
                              style: TextStyle(
                                color: healthColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                fontFamily: 'Inter',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // Client
                        Row(
                          children: [
                            Icon(
                              Icons.person_outline_rounded,
                              color: AppTheme.textMuted,
                              size: 14,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              project.clientName,
                              style: TextStyle(
                                color: AppTheme.textMuted,
                                fontSize: 13,
                                fontFamily: 'Inter',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // Site address
                        Row(
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              color: AppTheme.textMuted,
                              size: 14,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                project.siteAddress,
                                style: TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 13,
                                  fontFamily: 'Inter',
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // Progress bar + days badge
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text(
                                        'Progress',
                                        style: TextStyle(
                                          color: AppTheme.textMuted,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                          fontFamily: 'Inter',
                                        ),
                                      ),
                                      Text(
                                        '${project.progressPercent}%',
                                        style: TextStyle(
                                          color: AppTheme.onSurface,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14,
                                          fontFamily: 'Plus Jakarta Sans',
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(100),
                                    child: LinearProgressIndicator(
                                      value: project.progressPercent / 100,
                                      minHeight: 8,
                                      backgroundColor: AppTheme.divider,
                                      valueColor:
                                          const AlwaysStoppedAnimation<Color>(
                                            AppTheme.primary,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: isOverdue
                                    ? AppTheme.error.withValues(alpha: 0.12)
                                    : AppTheme.success.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(
                                  AppTheme.radiusPill,
                                ),
                                border: Border.all(
                                  color: isOverdue
                                      ? AppTheme.error.withValues(alpha: 0.35)
                                      : AppTheme.success.withValues(
                                          alpha: 0.35,
                                        ),
                                  width: 1.5,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    isOverdue
                                        ? '${daysLeft.abs()}d overdue'
                                        : '${daysLeft}d left',
                                    style: TextStyle(
                                      color: isOverdue
                                          ? AppTheme.error
                                          : AppTheme.success,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      fontFamily: 'Plus Jakarta Sans',
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    DateFormat(
                                      'dd MMM yy',
                                    ).format(project.expectedEndDate),
                                    style: TextStyle(
                                      color: AppTheme.textMuted,
                                      fontSize: 12,
                                      fontFamily: 'Inter',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(54),
                  child: Container(
                    width: double.infinity,
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
                    child: TabBar(
                      controller: _tabController,
                      labelColor: AppTheme.primary,
                      unselectedLabelColor: AppTheme.textMuted,
                      indicatorColor: AppTheme.primary,
                      indicatorWeight: 3,
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      labelPadding: const EdgeInsets.symmetric(horizontal: 14),
                      labelStyle: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans',
                      ),
                      unselectedLabelStyle: const TextStyle(
                        fontSize: 14,
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w500,
                      ),
                      tabs: const [
                        Tab(text: 'Overview'),
                        Tab(text: 'Tasks'),
                        Tab(text: 'Team'),
                        Tab(text: 'Documents'),
                        Tab(text: 'Diary'),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                // Overview tab
                _ProjectOverviewTab(
                  project: project,
                  daysLeft: daysLeft,
                  isOverdue: isOverdue,
                  onViewTeam: () => _tabController.animateTo(2),
                ),
                // Tasks tab
                _ProjectTasksTab(projectId: widget.projectId),
                // Team tab
                _ProjectTeamTab(
                  projectId: widget.projectId,
                  memberIds: project.memberIds,
                  projectManagerId: project.projectManagerId,
                ),
                // Documents tab
                _ProjectDocumentsTab(projectId: widget.projectId),
                // Diary tab
                _ProjectDiaryTab(projectId: widget.projectId),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────────────────────
class _ProjectOverviewTab extends ConsumerWidget {
  final ProjectModel project;
  final int daysLeft;
  final bool isOverdue;
  final VoidCallback onViewTeam;

  const _ProjectOverviewTab({
    required this.project,
    required this.daysLeft,
    required this.isOverdue,
    required this.onViewTeam,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(projectTasksProvider(project.id));
    final currentUser = ref.watch(currentUserProvider).value;
    final milestonesAsync = ref.watch(milestonesProvider(project.id));

    final tasks = tasksAsync.value ?? [];
    final overdueTasks = tasks.where((t) => t.isOverdue).length;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(projectTasksProvider(project.id));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Metrics row
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'Tasks',
                  value: '${tasks.length}',
                  icon: Icons.task_alt_rounded,
                  iconColor: AppTheme.info,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  label: 'Overdue',
                  value: '$overdueTasks',
                  icon: Icons.warning_amber_rounded,
                  iconColor: overdueTasks > 0
                      ? AppTheme.error
                      : AppTheme.textLight,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  label: isOverdue ? 'Overdue' : 'Days Left',
                  value: '${daysLeft.abs()}',
                  icon: Icons.schedule_rounded,
                  iconColor: isOverdue ? AppTheme.error : AppTheme.success,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  label: 'Progress',
                  value: '${project.progressPercent}%',
                  icon: Icons.pie_chart_rounded,
                  iconColor: AppTheme.accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Project info card
          _SectionCard(
            title: 'Project Details',
            child: Column(
              children: [
                _InfoRow(
                  icon: Icons.calendar_today_rounded,
                  label: 'Start Date',
                  value: DateFormat('dd MMM yyyy').format(project.startDate),
                ),
                const _Divider(),
                _InfoRow(
                  icon: Icons.event_rounded,
                  label: 'End Date',
                  value: DateFormat(
                    'dd MMM yyyy',
                  ).format(project.expectedEndDate),
                  valueColor: isOverdue ? AppTheme.error : null,
                ),
                const _Divider(),
                _InfoRow(
                  icon: Icons.person_outline_rounded,
                  label: 'Client',
                  value: project.clientName,
                ),
                const _Divider(),
                _InfoRow(
                  icon: Icons.flag_outlined,
                  label: 'Status',
                  value: project.status.label,
                ),
                if (project.description.isNotEmpty) ...[
                  const _Divider(),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.notes_rounded,
                          size: 16,
                          color: AppTheme.textMuted,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            project.description,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Site address card
          _SectionCard(
            title: 'Site Location',
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.location_on_rounded,
                    color: AppTheme.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    project.siteAddress,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Project Roadmap Card
          milestonesAsync.when(
            data: (milestones) => _SectionCard(
              title: 'Project Roadmap',
              child: GanttChartWidget(
                milestones: milestones,
                startDate: project.startDate,
                endDate: project.expectedEndDate,
              ),
            ),
            loading: () => const _SectionCard(
              title: 'Project Roadmap',
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              ),
            ),
            error: (err, _) => _SectionCard(
              title: 'Project Roadmap',
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'Failed to load milestones timeline',
                  style: const TextStyle(color: AppTheme.error, fontSize: 13),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Action buttons
          _SectionCard(
            title: 'Quick Actions',
            child: Column(
              children: [
                // Open in Chat
                _ActionButton(
                  icon: Icons.chat_bubble_outline_rounded,
                  label: 'Open in Chat',
                  subtitle: 'View project channel',
                  color: AppTheme.info,
                  onTap: () async {
                    if (currentUser == null) return;
                    try {
                      final channelId = await ref
                          .read(chatRepositoryProvider)
                          .getOrCreateProjectChannel(
                            projectId: project.id,
                            projectName: project.name,
                            memberIds: {
                              ...project.memberIds,
                              if (project.projectManagerId.isNotEmpty)
                                project.projectManagerId,
                            }.toList(),
                            createdBy: currentUser.uid,
                          );
                      if (context.mounted) {
                        context.push('/chat/$channelId');
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(e.toString()),
                            backgroundColor: AppTheme.error,
                          ),
                        );
                      }
                    }
                  },
                ),
                const _Divider(),
                // View Team
                _ActionButton(
                  icon: Icons.group_outlined,
                  label: 'View Team',
                  subtitle:
                      '${project.memberIds.length} member${project.memberIds.length == 1 ? '' : 's'}',
                  color: AppTheme.primary,
                  onTap: onViewTeam,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: AppTheme.divider.withValues(alpha: 0.5)),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: AppTheme.divider.withValues(alpha: 0.5)),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppTheme.textLight,
                letterSpacing: 1,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textMuted),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor ?? AppTheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, color: AppTheme.divider);
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppTheme.textLight),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks tab
// ─────────────────────────────────────────────────────────────────────────────
class _ProjectTasksTab extends ConsumerWidget {
  final String projectId;
  const _ProjectTasksTab({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(projectTasksProvider(projectId));
    return tasksAsync.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(projectTasksProvider(projectId)),
      ),
      data: (tasks) {
        if (tasks.isEmpty) {
          return EmptyStateWidget(
            icon: Icons.task_alt_rounded,
            title: 'No tasks yet',
            subtitle: 'Create the first task for this project',
            actionLabel: ref.watch(hasPermissionProvider('tasks_create')) ? 'Create Task' : null,
            onAction: ref.watch(hasPermissionProvider('tasks_create')) ? () => context.push('/tasks/create?projectId=$projectId') : null,
          );
        }

        final isManager = ref.watch(hasPermissionProvider('tasks_approve'));
        final currentUser = ref.watch(currentUserProvider).value;

        // Group by status
        final overdue = tasks.where((t) {
          final displayStatus = isManager ? t.status : t.statusForUser(currentUser?.uid ?? '');
          return t.dueDate.isBefore(DateTime.now()) && displayStatus != TaskStatus.done;
        }).toList();
        final inProgress = tasks.where((t) {
          final displayStatus = isManager ? t.status : t.statusForUser(currentUser?.uid ?? '');
          final isOverdue = t.dueDate.isBefore(DateTime.now()) && displayStatus != TaskStatus.done;
          return !isOverdue && displayStatus == TaskStatus.inProgress;
        }).toList();
        final review = tasks.where((t) {
          final displayStatus = isManager ? t.status : t.statusForUser(currentUser?.uid ?? '');
          final isOverdue = t.dueDate.isBefore(DateTime.now()) && displayStatus != TaskStatus.done;
          return !isOverdue && displayStatus == TaskStatus.approved;
        }).toList();
        final done = tasks.where((t) {
          final displayStatus = isManager ? t.status : t.statusForUser(currentUser?.uid ?? '');
          return displayStatus == TaskStatus.done;
        }).toList();

        // Summary chips
        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(projectTasksProvider(projectId)),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              // Status summary chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    if (overdue.isNotEmpty)
                      _StatusSummaryChip(
                        label: 'Overdue',
                        count: overdue.length,
                        color: AppTheme.error,
                      ),
                    _StatusSummaryChip(
                      label: 'In Progress',
                      count: inProgress.length,
                      color: AppTheme.accent,
                    ),
                    _StatusSummaryChip(
                      label: 'Approved',
                      count: review.length,
                      color: AppTheme.info,
                    ),
                    _StatusSummaryChip(
                      label: 'Done',
                      count: done.length,
                      color: AppTheme.success,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              if (overdue.isNotEmpty) ...[
                _TaskGroupHeader(label: 'Overdue', color: AppTheme.error),
                ...overdue.map((t) => _TaskCard(task: t)),
                const SizedBox(height: 8),
              ],
              if (inProgress.isNotEmpty) ...[
                _TaskGroupHeader(label: 'In Progress', color: AppTheme.accent),
                ...inProgress.map((t) => _TaskCard(task: t)),
                const SizedBox(height: 8),
              ],
              if (review.isNotEmpty) ...[
                _TaskGroupHeader(label: 'Approved', color: AppTheme.info),
                ...review.map((t) => _TaskCard(task: t)),
                const SizedBox(height: 8),
              ],
              if (done.isNotEmpty) ...[
                _TaskGroupHeader(label: 'Done', color: AppTheme.success),
                ...done.map((t) => _TaskCard(task: t)),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _StatusSummaryChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _StatusSummaryChip({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                fontSize: 10,
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskGroupHeader extends StatelessWidget {
  final String label;
  final Color color;

  const _TaskGroupHeader({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskCard extends ConsumerWidget {
  final TaskModel task;
  const _TaskCard({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider).value;
    final isManager = ref.watch(hasPermissionProvider('tasks_approve'));
    final displayStatus = isManager ? task.status : task.statusForUser(currentUser?.uid ?? '');
    final isOverdue = task.dueDate.isBefore(DateTime.now()) && displayStatus != TaskStatus.done;
    final priorityColor = task.priority.color;

    return GestureDetector(
      onTap: () => context.push('/tasks/${task.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
          boxShadow: AppTheme.softShadow,
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Priority left border
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: priorityColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    bottomLeft: Radius.circular(12),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              task.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.calendar_today_rounded,
                                  size: 11,
                                  color: isOverdue
                                      ? AppTheme.error
                                      : AppTheme.textLight,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  task.dueDate.formatted,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isOverdue
                                        ? AppTheme.error
                                        : AppTheme.textMuted,
                                    fontWeight: isOverdue
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusChip.taskStatus(displayStatus),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Team tab
// ─────────────────────────────────────────────────────────────────────────────
class _ProjectTeamTab extends ConsumerWidget {
  final String projectId;
  final List<String> memberIds;
  final String projectManagerId;

  const _ProjectTeamTab({
    required this.projectId,
    required this.memberIds,
    required this.projectManagerId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(
      todayProjectAttendanceProvider(projectId),
    );

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(todayProjectAttendanceProvider(projectId));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Today on-site section
          attendanceAsync.when(
            loading: () => const SizedBox(
              height: 60,
              child: Center(child: LinearProgressIndicator()),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (attendance) {
              if (attendance.isEmpty) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.divider),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppTheme.textLight.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.location_off_outlined,
                          color: AppTheme.textLight,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Nobody on site today',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'No check-ins recorded yet',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }

              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: AppTheme.success,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  '${attendance.length} on site',
                                  style: const TextStyle(
                                    color: AppTheme.success,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Today',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: AppTheme.divider),
                    ...attendance.map((a) => _AttendanceTile(attendance: a)),
                  ],
                ),
              );
            },
          ),

          // Team members header
          if (memberIds.isEmpty)
            EmptyStateWidget(
              icon: Icons.group_outlined,
              title: 'No team members',
              subtitle: ref.watch(hasPermissionProvider('projects_edit')) ? 'Add members via Edit Project' : 'No members have been assigned to this project.',
              actionLabel: ref.watch(hasPermissionProvider('projects_edit')) ? 'Edit Project' : null,
              onAction: ref.watch(hasPermissionProvider('projects_edit')) ? () => context.push('/projects/$projectId/edit') : null,
            )
          else ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.group_rounded,
                    color: AppTheme.primary,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${memberIds.length} team member${memberIds.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  PermissionGate(
                    permission: 'projects_edit',
                    child: TextButton.icon(
                      onPressed: () =>
                          context.push('/projects/$projectId/edit'),
                      icon: const Icon(Icons.edit_outlined, size: 14),
                      label: const Text('Manage'),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            ...memberIds.map(
              (uid) => _TeamMemberTile(
                uid: uid,
                isProjectManager: uid == projectManagerId,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AttendanceTile extends ConsumerWidget {
  final AttendanceModel attendance;
  const _AttendanceTile({required this.attendance});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userProvider(attendance.userId));
    return userAsync.when(
      loading: () => const SizedBox(
        height: 50,
        child: Center(child: LinearProgressIndicator()),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (user) {
        if (user == null) return const SizedBox.shrink();
        final checkInStr = DateFormat('HH:mm').format(attendance.checkInTime);
        final checkOutStr = attendance.checkOutTime != null
            ? DateFormat('HH:mm').format(attendance.checkOutTime!)
            : null;

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              AvatarWidget(name: user.name, imageUrl: user.avatarUrl, size: 36),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      checkOutStr != null
                          ? 'In $checkInStr · Out $checkOutStr'
                          : 'Checked in at $checkInStr',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: attendance.checkOutTime != null
                      ? AppTheme.textLight.withValues(alpha: 0.1)
                      : AppTheme.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  attendance.checkOutTime != null ? 'Left' : 'On site',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: attendance.checkOutTime != null
                        ? AppTheme.textMuted
                        : AppTheme.success,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TeamMemberTile extends ConsumerWidget {
  final String uid;
  final bool isProjectManager;
  const _TeamMemberTile({required this.uid, required this.isProjectManager});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userProvider(uid));
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
        boxShadow: AppTheme.softShadow,
      ),
      child: userAsync.when(
        loading: () => const SizedBox(
          height: 48,
          child: Center(child: LinearProgressIndicator()),
        ),
        error: (e, _) => Text(
          'Error loading $uid',
          style: const TextStyle(color: AppTheme.error, fontSize: 11),
        ),
        data: (user) {
          if (user == null) return const SizedBox.shrink();
          return Row(
            children: [
              AvatarWidget(name: user.name, imageUrl: user.avatarUrl, size: 46),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          user.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        if (isProjectManager) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'PM',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppTheme.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: const TextStyle(
                        color: AppTheme.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: user.isActive ? AppTheme.success : AppTheme.textLight,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents tab
// ─────────────────────────────────────────────────────────────────────────────
class _ProjectDocumentsTab extends ConsumerWidget {
  final String projectId;
  const _ProjectDocumentsTab({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(projectDocumentsProvider(projectId));
    return docsAsync.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(projectDocumentsProvider(projectId)),
      ),
      data: (docs) {
        final canUpload = ref.watch(hasPermissionProvider('docs_upload'));
        return Stack(
          children: [
            docs.isEmpty
                ? EmptyStateWidget(
                    icon: Icons.folder_open_rounded,
                    title: 'No documents yet',
                    subtitle: 'Upload drawings, specs and reports here',
                    actionLabel: canUpload ? 'Go to Documents' : null,
                    onAction: canUpload ? () => context.push('/documents') : null,
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    children: DocumentType.values.map((type) {
                      final typeDocs =
                          docs.where((d) => d.type == type).toList();
                      if (typeDocs.isEmpty) return const SizedBox.shrink();
                      return _DocumentSection(
                        type: type,
                        docs: typeDocs,
                        projectId: projectId,
                      );
                    }).toList(),
                  ),
            if (canUpload)
              Positioned(
                bottom: 16,
                right: 16,
                child: FloatingActionButton.extended(
                  heroTag: 'docs_fab',
                  onPressed: () => context.push('/documents'),
                  icon: const Icon(Icons.upload_rounded),
                  label: const Text('Upload'),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DocumentSection extends StatelessWidget {
  final DocumentType type;
  final List<DocumentModel> docs;
  final String projectId;
  const _DocumentSection({
    required this.type,
    required this.docs,
    required this.projectId,
  });

  @override
  Widget build(BuildContext context) {
    if (docs.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            type.label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppTheme.textLight,
              letterSpacing: 1,
            ),
          ),
        ),
        ...docs.map(
          (doc) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusXl),
              border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
              boxShadow: AppTheme.softShadow,
            ),
            child: ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: FileUtils.colorForMimeType(
                    doc.mimeType,
                  ).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  FileUtils.iconForMimeType(doc.mimeType),
                  color: FileUtils.colorForMimeType(doc.mimeType),
                  size: 20,
                ),
              ),
              title: Text(
                doc.name,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${doc.uploadedAt.formatted} · v${doc.version}',
                style: const TextStyle(fontSize: 11),
              ),
              trailing: const Icon(
                Icons.chevron_right_rounded,
                color: AppTheme.textLight,
              ),
              onTap: () => context.push('/documents/${doc.id}'),
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Site Diary tab
// ─────────────────────────────────────────────────────────────────────────────
class _ProjectDiaryTab extends ConsumerWidget {
  final String projectId;
  const _ProjectDiaryTab({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diariesAsync = ref.watch(projectDiariesProvider(projectId));

    final canLog = ref.watch(hasPermissionProvider('time_log'));
    return Stack(
      children: [
        diariesAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(projectDiariesProvider(projectId)),
        ),
        data: (diaries) {
          if (diaries.isEmpty) {
            return EmptyStateWidget(
              icon: Icons.book_outlined,
              title: 'No diary entries yet',
              subtitle: 'Start logging daily site progress',
              actionLabel: canLog ? 'Create First Entry' : null,
              onAction: canLog ? () => context.push('/site-diary') : null,
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            itemCount: diaries.length,
            itemBuilder: (_, i) {
              final entry = diaries[i];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                  border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
                  boxShadow: AppTheme.softShadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          entry.weather.emoji,
                          style: const TextStyle(fontSize: 22),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                DateFormat(
                                  'EEEE, d MMM yyyy',
                                ).format(DateTime.parse(entry.date)),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                '${entry.weather.label} · ${entry.workerCount} workers on site',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (entry.photoUrls.isNotEmpty)
                          Row(
                            children: [
                              const Icon(
                                Icons.photo_library_outlined,
                                size: 14,
                                color: AppTheme.textLight,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${entry.photoUrls.length}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textLight,
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                    if (entry.progressNotes.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        entry.progressNotes,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.onSurface,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              );
            },
          );
        },
        ),
        if (canLog)
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton.extended(
              heroTag: 'diary_fab',
              onPressed: () => context.push('/site-diary'),
              icon: const Icon(Icons.book_rounded),
              label: const Text('New Entry'),
            ),
          ),
      ],
    );
  }
}
