import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/task_status.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../data/models/task_model.dart';
import '../../data/services/audit_service.dart';
import '../../providers/role_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/permission_gate.dart';
import '../shared/widgets/status_chip.dart';
import 'widgets/kanban_column.dart';

class TaskBoardScreen extends ConsumerStatefulWidget {
  const TaskBoardScreen({super.key});

  @override
  ConsumerState<TaskBoardScreen> createState() => _TaskBoardScreenState();
}

class _TaskBoardScreenState extends ConsumerState<TaskBoardScreen>
    with SingleTickerProviderStateMixin {
  bool _isKanban = false;
  String? _selectedProjectId;
  late TabController _tabController;

  // Employee filter tabs
  static const _employeeTabs = [
    'All',
    'In Progress',
    'Approved',
    'Done',
    'Overdue',
  ];

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

  @override
  Widget build(BuildContext context) {
    // Wait for role to load before deciding which view to show.
    // Without this guard, hasPermissionProvider returns false during loading,
    // causing managers to briefly see the employee "My Tasks" view.
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    // Only roles that approve tasks (Director / Admin / PM) oversee ALL tasks.
    // Field staff who can merely create/edit (Engineer, Foreman) still see only
    // the tasks assigned to them.
    // Only roles with tasks_view_all (Director / PM / Admin by default) see
    // the full board; everyone else sees only their own / role's tasks.
    final isManager = ref.watch(hasPermissionProvider('tasks_view_all'));

    return isManager ? _buildManagerView(context) : _buildEmployeeView(context);
  }

  // ─── Manager View ───────────────────────────────────────────────────────────

  Widget _buildManagerView(BuildContext context) {
    // Managers see ALL tasks (they assign to others; userTasksProvider only
    // returns tasks where the user is an assignee, which is wrong for managers).
    final tasksAsync = ref.watch(allTasksProvider);
    final projectsAsync = ref.watch(projectsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text(AppStrings.tasks),
        actions: [
          IconButton(
            icon: Icon(
              _isKanban ? Icons.view_list_rounded : Icons.view_kanban_rounded,
            ),
            tooltip: _isKanban ? 'List view' : 'Kanban view',
            onPressed: () => setState(() => _isKanban = !_isKanban),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: projectsAsync.when(
            loading: () => const SizedBox(height: 56),
            error: (_, __) => const SizedBox(height: 56),
            data: (projects) => Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                height: 38,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _ProjectChip(
                      label: 'All Projects',
                      selected: _selectedProjectId == null,
                      onTap: () => setState(() => _selectedProjectId = null),
                    ),
                    ...projects.map(
                      (p) => _ProjectChip(
                        label: p.name,
                        selected: _selectedProjectId == p.id,
                        onTap: () => setState(() => _selectedProjectId = p.id),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
      body: tasksAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(allTasksProvider),
        ),
        data: (allTasks) {
          final tasks = _selectedProjectId == null
              ? allTasks
              : allTasks
                    .where((t) => t.projectId == _selectedProjectId)
                    .toList();

          if (tasks.isEmpty) {
            return EmptyStateWidget(
              icon: Icons.task_outlined,
              title: 'No tasks found',
              subtitle: _selectedProjectId == null
                  ? 'Create a task to get started'
                  : 'No tasks for this project yet',
            );
          }

          return RefreshIndicator(
            color: AppTheme.primary,
            onRefresh: () async => ref.invalidate(allTasksProvider),
            child: _isKanban ? _buildKanban(tasks) : _buildManagerList(tasks),
          );
        },
      ),
      floatingActionButton: PermissionGate(
        permission: 'tasks_create',
        child: FloatingActionButton.extended(
          onPressed: () => _selectedProjectId != null
              ? context.push('/tasks/create?projectId=$_selectedProjectId')
              : context.push('/tasks/create'),
          backgroundColor: AppTheme.primary,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_rounded),
          label: const Text(
            'Assign Task',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }

  Widget _buildKanban(List<TaskModel> tasks) {
    final kanban = <String, List<TaskModel>>{};
    for (final status in TaskStatus.values) {
      kanban[status.value] = tasks.where((t) => t.status == status).toList();
    }
    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(16),
      itemCount: TaskStatus.values.length,
      itemBuilder: (_, i) {
        final status = TaskStatus.values[i];
        return KanbanColumn(
          status: status,
          tasks: kanban[status.value] ?? [],
          onTaskTap: (task) => context.push('/tasks/${task.id}'),
        );
      },
    );
  }

  Widget _buildManagerList(List<TaskModel> tasks) {
    // Separate active tasks from completed ones
    final active = tasks.where((t) => t.status != TaskStatus.done).toList();
    final done = tasks.where((t) => t.status == TaskStatus.done).toList();

    // Group active tasks: Overdue → Today → This Week → Later
    final overdue = active.where((t) => t.isOverdue).toList();
    final today = active
        .where((t) => t.dueDate.isToday && !t.isOverdue)
        .toList();
    final upcoming = active
        .where(
          (t) => t.dueDate.isThisWeek && !t.dueDate.isToday && !t.isOverdue,
        )
        .toList();
    final later = active
        .where((t) => !t.isOverdue && !t.dueDate.isThisWeek)
        .toList();

    final groups = <_TaskGroup>[
      if (overdue.isNotEmpty)
        _TaskGroup(
          'Overdue',
          overdue,
          AppTheme.error,
          Icons.warning_amber_rounded,
        ),
      if (today.isNotEmpty)
        _TaskGroup('Due Today', today, AppTheme.accent, Icons.today_rounded),
      if (upcoming.isNotEmpty)
        _TaskGroup(
          'This Week',
          upcoming,
          AppTheme.info,
          Icons.date_range_rounded,
        ),
      if (later.isNotEmpty)
        _TaskGroup('Later', later, AppTheme.primary, Icons.schedule_rounded),
      if (done.isNotEmpty)
        _TaskGroup(
          'Completed',
          done,
          AppTheme.success,
          Icons.check_circle_rounded,
        ),
    ];

    if (groups.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.task_alt_rounded, size: 56, color: AppTheme.divider),
            SizedBox(height: 12),
            Text(
              'No tasks',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: groups.length,
      itemBuilder: (_, i) {
        final g = groups[i];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 10, top: 4),
              child: Row(
                children: [
                  Icon(g.icon, size: 14, color: g.color),
                  const SizedBox(width: 6),
                  Text(
                    g.label,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: g.color,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: g.color.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${g.tasks.length}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: g.color,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ...g.tasks.map(
              (task) => _ManagerTaskRow(
                task: task,
                onTap: () => context.push('/tasks/${task.id}'),
              ),
            ),
            const SizedBox(height: 16),
          ],
        );
      },
    );
  }

  // ─── Employee View ──────────────────────────────────────────────────────────

  Widget _buildEmployeeView(BuildContext context) {
    final tasksAsync = ref.watch(userTasksProvider);
    final currentUser = ref.watch(currentUserProvider).value;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('My Tasks'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(58),
          child: Container(
            alignment: Alignment.centerLeft,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelPadding: const EdgeInsets.symmetric(horizontal: 16),
              labelColor: AppTheme.primary,
              unselectedLabelColor: AppTheme.textMuted,
              indicator: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              labelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                fontFamily: 'Plus Jakarta Sans',
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                fontFamily: 'Inter',
              ),
              tabs: _employeeTabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
        ),
      ),
      body: tasksAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(userTasksProvider),
        ),
        data: (allTasks) {
          // Only show tasks the current user is assigned to (directly or via roles)
          final myTasks = allTasks.where((t) {
            final isExplicitAssignee = t.assigneeIds.contains(currentUser?.uid);
            final isRoleAssignee = currentUser?.roleId != null && t.assignedRoleIds.contains(currentUser!.roleId);
            return isExplicitAssignee || isRoleAssignee;
          }).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              // All
              _buildEmployeeList(myTasks, null),
              // In Progress
              _buildEmployeeList(
                myTasks
                    .where((t) => t.statusForUser(currentUser?.uid ?? '') == TaskStatus.inProgress)
                    .toList(),
                null,
              ),
              // Done
              _buildEmployeeList(
                myTasks.where((t) => t.status == TaskStatus.done).toList(),
                null,
              ),
              // Overdue
              _buildEmployeeList(
                myTasks.where((t) => t.isOverdue).toList(),
                'overdue',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildEmployeeList(List<TaskModel> tasks, String? variant) {
    if (tasks.isEmpty) {
      return EmptyStateWidget(
        icon: variant == 'overdue'
            ? Icons.check_circle_outline_rounded
            : Icons.task_outlined,
        title: variant == 'overdue' ? 'No overdue tasks!' : 'No tasks here',
        subtitle: variant == 'overdue'
            ? 'You\'re all caught up.'
            : 'Tasks assigned to you will appear here.',
      );
    }

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () async => ref.invalidate(userTasksProvider),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        itemCount: tasks.length,
        itemBuilder: (_, i) => _EmployeeTaskCard(
          task: tasks[i],
          onTap: () => context.push('/tasks/${tasks[i].id}'),
          onStatusUpdate: (status) async {
            final uid = ref.read(currentUserProvider).value?.uid ?? '';
            final prev = tasks[i].status;
            await ref
                .read(taskRepositoryProvider)
                .updateStatus(tasks[i].id, status, uid);
            ref.read(auditServiceProvider).log(
              action: 'task.status_changed',
              category: AuditCategory.task,
              targetId: tasks[i].id,
              targetName: tasks[i].title,
              description: 'Moved "${tasks[i].title}" to ${status.label}',
              changes: [
                AuditChange(field: 'status', label: 'Status', from: prev.label, to: status.label),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ─── Project Filter Chip (Manager) ───────────────────────────────────────────

class _ProjectChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ProjectChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primary : AppTheme.surfaceAlt,
            borderRadius: BorderRadius.circular(AppTheme.radiusPill),
            border: Border.all(
              color: selected ? AppTheme.primary : AppTheme.divider.withValues(alpha: 0.5),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                const Icon(Icons.check_rounded, size: 13, color: Colors.white),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? Colors.white : AppTheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Manager Task Row ─────────────────────────────────────────────────────────

class _ManagerTaskRow extends StatelessWidget {
  final TaskModel task;
  final VoidCallback onTap;
  const _ManagerTaskRow({required this.task, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: task.isOverdue
              ? Border.all(color: AppTheme.error.withValues(alpha: 0.3))
              : null,
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      StatusChip.taskStatus(task.status),
                      const SizedBox(width: 8),
                      StatusChip.priority(task.priority),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    task.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      fontFamily: 'Plus Jakarta Sans',
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceAlt,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          size: 14,
                          color: task.isOverdue
                              ? AppTheme.error
                              : AppTheme.textMuted,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          task.dueDate.formatted,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: task.isOverdue
                                ? AppTheme.error
                                : AppTheme.textMuted,
                            fontFamily: 'Inter',
                          ),
                        ),
                        if (task.assigneeIds.isNotEmpty) ...[
                          const SizedBox(width: 12),
                          const Icon(
                            Icons.people_alt_rounded,
                            size: 14,
                            color: AppTheme.textMuted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${task.assigneeIds.length}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textMuted,
                              fontFamily: 'Inter',
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Icon(
              Icons.arrow_forward_ios_rounded,
              color: AppTheme.textMuted.withValues(alpha: 0.3),
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Employee Task Card ───────────────────────────────────────────────────────

class _EmployeeTaskCard extends ConsumerWidget {
  final TaskModel task;
  final VoidCallback onTap;
  final Future<void> Function(TaskStatus) onStatusUpdate;

  const _EmployeeTaskCard({
    required this.task,
    required this.onTap,
    required this.onStatusUpdate,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider).value;
    final displayStatus = task.statusForUser(currentUser?.uid ?? '');
    final isDone = displayStatus == TaskStatus.done;
    final isInProgress = displayStatus == TaskStatus.inProgress;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: task.isOverdue
              ? Border.all(color: AppTheme.error.withValues(alpha: 0.3))
              : null,
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StatusChip.taskStatus(displayStatus),
                const Spacer(),
                if (task.isOverdue)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.warning_rounded,
                          color: AppTheme.error,
                          size: 12,
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          'Overdue',
                          style: TextStyle(
                            color: AppTheme.error,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'Plus Jakarta Sans',
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  StatusChip.priority(task.priority),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              task.title,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: isDone ? AppTheme.textMuted : AppTheme.onSurface,
                decoration: isDone ? TextDecoration.lineThrough : null,
                fontFamily: 'Plus Jakarta Sans',
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                task.description,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textMuted,
                  height: 1.4,
                  fontFamily: 'Inter',
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceAlt,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 14,
                        color: task.isOverdue ? AppTheme.error : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        task.dueDate.formatted,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color:
                              task.isOverdue ? AppTheme.error : AppTheme.textMuted,
                          fontFamily: 'Inter',
                        ),
                      ),
                    ],
                  ),
                ),
                if (task.assignedRoleIds.isNotEmpty || (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty)) ...[
                  const Spacer(),
                  ...(() {
                    final rolesList = task.assignedRoleIds.isNotEmpty
                        ? task.assignedRoleIds
                        : [task.assignedRoleId!];
                    return rolesList.map((rid) {
                      return Consumer(
                        builder: (context, ref, child) {
                          return ref.watch(roleStreamProvider(rid)).when(
                                loading: () => const SizedBox(
                                  width: 12,
                                  height: 12,
                                  child: CircularProgressIndicator(strokeWidth: 1.5),
                                ),
                                error: (_, __) => const Icon(
                                  Icons.shield_outlined,
                                  size: 14,
                                  color: AppTheme.textMuted,
                                ),
                                data: (role) {
                                  if (role == null) return const SizedBox.shrink();
                                  final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
                                  return Container(
                                    margin: const EdgeInsets.only(left: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      role.name,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: color,
                                        fontFamily: 'Inter',
                                      ),
                                    ),
                                  );
                                },
                              );
                        },
                      );
                    });
                  })()
                ],
              ],
            ),
            // Action buttons
            if (!isDone) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  if (!isInProgress)
                    Expanded(
                      child: _ActionButton(
                        label: 'Start Task',
                        icon: Icons.play_arrow_rounded,
                        color: AppTheme.info,
                        onTap: () => onStatusUpdate(TaskStatus.inProgress),
                      ),
                    ),
                  if (!isInProgress) const SizedBox(width: 10),
                  Expanded(
                    child: _ActionButton(
                      label: 'Mark Done',
                      icon: Icons.check_circle_rounded,
                      color: AppTheme.success,
                      filled: true,
                      onTap: () => onStatusUpdate(TaskStatus.done),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    color: AppTheme.success,
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Completed · ${DateFormat('d MMM').format(task.updatedAt)}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.success,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'Inter',
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Task Group Data ──────────────────────────────────────────────────────────

class _TaskGroup {
  final String label;
  final List<TaskModel> tasks;
  final Color color;
  final IconData icon;
  const _TaskGroup(this.label, this.tasks, this.color, this.icon);
}

// ─── Action Button ─────────────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool filled;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: filled ? color : color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          border: filled ? null : Border.all(
            color: color.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: filled ? Colors.white : color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: filled ? Colors.white : color,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
