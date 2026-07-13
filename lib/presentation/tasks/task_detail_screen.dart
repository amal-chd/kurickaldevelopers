import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/task_status.dart';
import '../../core/enums/approval_status.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../data/models/task_model.dart';
import '../../data/models/user_model.dart';
import '../../data/models/subtask_model.dart';
import '../../providers/task_provider.dart';
import '../../providers/user_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/chat_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/avatar_widget.dart';
import 'widgets/subtask_item.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  final String taskId;
  const TaskDetailScreen({super.key, required this.taskId});

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen>
    with SingleTickerProviderStateMixin {
  final _newSubtaskCtrl = TextEditingController();
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _newSubtaskCtrl.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _changeStatus(
    BuildContext ctx,
    TaskModel task, {
    required bool canEditAll,
  }) async {
    // Employees: In Progress → Done
    // Managers: all 3 statuses
    final allowed = canEditAll
        ? TaskStatus.values
        : [TaskStatus.inProgress, TaskStatus.done];

    final result = await showModalBottomSheet<TaskStatus>(
      context: ctx,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 4),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(
                children: [
                  const Text(
                    'Update Status',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                  ),
                  const Spacer(),
                  if (!canEditAll)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.info.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Your actions',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppTheme.info,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            ...allowed.map(
              (s) => ListTile(
                leading: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: s.color,
                    shape: BoxShape.circle,
                  ),
                ),
                title: Text(
                  s.label,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                subtitle: _statusDescription(s),
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppTheme.textLight,
                ),
                onTap: () => Navigator.pop(sheetCtx, s),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (result != null && mounted) {
      final currentUser = ref.read(currentUserProvider).value;
      if (currentUser != null) {
        await ref.read(taskRepositoryProvider).updateStatus(task.id, result, currentUser.uid);
      }

      // Post system message to project channel when status changes
      if (task.projectId.isNotEmpty) {
        final user = ref.read(currentUserProvider).value;
        final userName = user?.name ?? 'Someone';
        final channelId = user == null
            ? null
            : await ref
                .read(chatRepositoryProvider)
                .findProjectChannelId(task.projectId, user.uid);
        if (channelId != null && mounted) {
          await ref
              .read(chatRepositoryProvider)
              .postSystemMessage(
                channelId: channelId,
                text: '📋 $userName changed "${task.title}" → ${result.label}',
                memberIds: [], // system messages don't increment unread counts
              );
        }
      }
    }
  }

  Widget? _statusDescription(TaskStatus s) {
    switch (s) {
      case TaskStatus.inProgress:
        return const Text(
          'Work has started on this task',
          style: TextStyle(fontSize: 11),
        );
      case TaskStatus.done:
        return const Text(
          'Mark as fully completed',
          style: TextStyle(fontSize: 11),
        );
    }
  }

  Future<void> _addSubtask(String taskId) async {
    final title = _newSubtaskCtrl.text.trim();
    if (title.isEmpty) return;
    final subtask = SubtaskModel(id: '', title: title);
    _newSubtaskCtrl.clear();
    await ref.read(taskRepositoryProvider).addSubtask(taskId, subtask);
  }

  @override
  Widget build(BuildContext context) {
    // Wait for role to resolve before computing permissions.
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    final taskAsync = ref.watch(taskProvider(widget.taskId));
    final subtasksAsync = ref.watch(subtasksProvider(widget.taskId));
    final currentUser = ref.watch(currentUserProvider).value;
    final canEdit = ref.watch(hasPermissionProvider('tasks_edit'));
    final canApprove = ref.watch(hasPermissionProvider('tasks_approve'));
    final canCreate = ref.watch(hasPermissionProvider('tasks_create'));
    final isManager = canEdit || canCreate;

    return taskAsync.when(
      loading: () => const Scaffold(body: LoadingWidget()),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Task Detail')),
        body: AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(taskProvider(widget.taskId)),
        ),
      ),
      data: (task) {
        if (task == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Task Detail')),
            body: const EmptyStateWidget(
              icon: Icons.task_alt_rounded,
              title: 'Task not found',
              subtitle: 'This task may have been deleted.',
            ),
          );
        }

        final displayStatus = isManager ? task.status : task.statusForUser(currentUser?.uid ?? '');
        final isOverdue = task.dueDate.isBefore(DateTime.now()) && displayStatus != TaskStatus.done;
        final dueDateColor = isOverdue
            ? AppTheme.error
            : task.dueDate.isToday
            ? AppTheme.accent
            : AppTheme.textMuted;

        return Scaffold(
          backgroundColor: AppTheme.background,
          body: NestedScrollView(
            headerSliverBuilder: (ctx, _) => [
              SliverAppBar(
                pinned: true,
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                expandedHeight: 0,
                title: Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 16),
                ),
                actions: [
                  if (isManager) ...[
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      tooltip: 'Edit task',
                      onPressed: () =>
                          context.push('/tasks/edit?taskId=${task.id}'),
                    ),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert),
                      onSelected: (v) {
                        if (v == 'delete') _confirmDelete(context, task.id);
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(
                                Icons.delete_outline_rounded,
                                color: AppTheme.error,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Delete task',
                                style: TextStyle(color: AppTheme.error),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
                bottom: TabBar(
                  controller: _tabController,
                  labelColor: Colors.white,
                  unselectedLabelColor: Colors.white54,
                  indicatorColor: AppTheme.accent,
                  tabs: const [
                    Tab(text: 'Details'),
                    Tab(text: 'Subtasks'),
                  ],
                ),
              ),
            ],
            body: TabBarView(
              controller: _tabController,
              children: [
                _buildDetailsTab(
                  task,
                  currentUser,
                  canApprove,
                  dueDateColor,
                  isOverdue,
                  isManager,
                  displayStatus,
                ),
                _buildSubtasksTab(task, subtasksAsync, currentUser, canEdit),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailsTab(
    TaskModel task,
    UserModel? currentUser,
    bool canApprove,
    Color dueDateColor,
    bool isOverdue,
    bool isManager,
    TaskStatus displayStatus,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Info banner for employees
          if (!isManager)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.info.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppTheme.info.withValues(alpha: 0.16),
                ),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: AppTheme.info,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Tap the status chip below to update your progress.',
                      style: TextStyle(fontSize: 12, color: AppTheme.info),
                    ),
                  ),
                ],
              ),
            ),

          // Status + Priority row
          Row(
            children: [
              GestureDetector(
                onTap: () =>
                    _changeStatus(context, task, canEditAll: isManager),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: displayStatus.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: displayStatus.color.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: displayStatus.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        displayStatus.label,
                        style: TextStyle(
                          color: displayStatus.color,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.expand_more_rounded,
                        size: 16,
                        color: displayStatus.color,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: task.priority.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.flag_rounded,
                      size: 14,
                      color: task.priority.color,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      task.priority.label,
                      style: TextStyle(
                        color: task.priority.color,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (isOverdue) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.warning_amber_rounded,
                        size: 14,
                        color: AppTheme.error,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Overdue',
                        style: TextStyle(
                          color: AppTheme.error,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),

          // Title + description
          Text(
            task.title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              height: 1.3,
              fontFamily: 'Plus Jakarta Sans',
            ),
          ),
          if (task.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              task.description,
              style: const TextStyle(color: AppTheme.textMuted, height: 1.5),
            ),
          ],

          const SizedBox(height: 20),

          // Info card
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppTheme.radiusXl),
              boxShadow: AppTheme.softShadow,
            ),
            child: Column(
              children: [
                _InfoRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Due Date',
                  value: task.dueDate.formatted,
                  valueColor: dueDateColor,
                ),
                const Divider(height: 1, indent: 44),
                _InfoRow(
                  icon: Icons.access_time_rounded,
                  label: 'Estimated',
                  value: '${task.estimatedHours}h',
                ),
                if (task.actualHours > 0) ...[
                  const Divider(height: 1, indent: 44),
                  _InfoRow(
                    icon: Icons.timer_outlined,
                    label: 'Logged',
                    value: '${task.actualHours.toStringAsFixed(1)}h',
                    valueColor: AppTheme.success,
                  ),
                ],
              ],
            ),
          ),

          // Assignees
          if (task.assigneeIds.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text(
              'Assigned To',
              style: TextStyle(
                fontWeight: FontWeight.w700, 
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
            const SizedBox(height: 10),
            _AssigneesRow(assigneeIds: task.assigneeIds),
          ],

          // Assigned Roles
          if (task.assignedRoleIds.isNotEmpty || (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty)) ...[
            const SizedBox(height: 20),
            const Text(
              'Assigned Roles / Teams',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                ...(() {
                  final rolesList = task.assignedRoleIds.isNotEmpty
                      ? task.assignedRoleIds
                      : [task.assignedRoleId!];
                  return rolesList.map((rid) {
                    return Consumer(
                      builder: (context, ref, child) {
                        final roleAsync = ref.watch(roleStreamProvider(rid));
                        return roleAsync.when(
                          loading: () => const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          error: (_, __) => const Text('Error loading role'),
                          data: (role) {
                            if (role == null) return const Text('Unknown Role');
                            final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: color.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.shield_outlined, color: color, size: 16),
                                  const SizedBox(width: 8),
                                  Text(
                                    role.name,
                                    style: TextStyle(
                                      color: color,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        );
                      },
                    );
                  });
                })()
              ],
            ),
          ],

          // Member Progress (Managers only)
          if (isManager) ...[
            const SizedBox(height: 20),
            const Text(
              'Member Progress',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
            const SizedBox(height: 10),
            Consumer(
              builder: (context, ref, child) {
                final usersAsync = ref.watch(allUsersProvider);
                return usersAsync.when(
                  loading: () => const LoadingWidget(),
                  error: (err, _) => Text('Error loading users: $err'),
                  data: (allUsers) {
                    final explicitUids = task.assigneeIds;
                    final roleUids = <String>[];
                    final rolesList = task.assignedRoleIds.isNotEmpty
                        ? task.assignedRoleIds
                        : (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty
                            ? [task.assignedRoleId!]
                            : <String>[]);
                    if (rolesList.isNotEmpty) {
                      allUsers
                          .where((u) => rolesList.contains(u.roleId) && u.isActive)
                          .forEach((u) => roleUids.add(u.uid));
                    }
                    final allAssigneeUids = {...explicitUids, ...roleUids}.toList();

                    if (allAssigneeUids.isEmpty) {
                      return const Text('No members assigned');
                    }

                    return Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                        boxShadow: AppTheme.softShadow,
                        border: Border.all(
                          color: AppTheme.divider.withValues(alpha: 0.3),
                        ),
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: allAssigneeUids.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (ctx, idx) {
                          final uid = allAssigneeUids[idx];
                          final user = allUsers.firstWhere(
                            (u) => u.uid == uid,
                            orElse: () => UserModel(
                              uid: uid,
                              name: 'Unknown ($uid)',
                              email: '',
                              phone: '',
                              roleId: '',
                              createdAt: DateTime.now(),
                              lastLoginAt: DateTime.now(),
                            ),
                          );
                          final prog = task.memberProgress[uid];
                          final uStatus = prog != null && prog is Map
                              ? TaskStatusX.fromString(prog['status'] as String? ?? 'created')
                              : TaskStatus.inProgress;

                          return ListTile(
                            leading: AvatarWidget(
                              name: user.name,
                              imageUrl: user.avatarUrl,
                              size: 32,
                            ),
                            title: Text(
                              user.name,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: uStatus.color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(100),
                                border: Border.all(
                                  color: uStatus.color.withValues(alpha: 0.2),
                                ),
                              ),
                              child: Text(
                                uStatus.label,
                                style: TextStyle(
                                  color: uStatus.color,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ],

          // Tags
          if (task.tags.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text(
              'Tags',
              style: TextStyle(
                fontWeight: FontWeight.w700, 
                fontSize: 15,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: task.tags
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: AppTheme.primary.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        tag,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],

          // Approval section
          if (canApprove) ...[
            const SizedBox(height: 20),
            _ApprovalSection(task: task, currentUserId: currentUser?.uid ?? ''),
          ],

          // Project Chat button
          if (task.projectId.isNotEmpty) ...[
            const SizedBox(height: 24),
            _ProjectChatButton(
              projectId: task.projectId,
              taskTitle: task.title,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSubtasksTab(
    TaskModel task,
    AsyncValue<List<SubtaskModel>> subtasksAsync,
    UserModel? currentUser,
    bool canEdit,
  ) {
    return subtasksAsync.when(
      loading: () => const LoadingWidget(),
      error: (_, __) => const Center(child: Text('Failed to load subtasks')),
      data: (subtasks) {
        final done = subtasks.where((s) => s.isDone).length;
        final total = subtasks.length;
        final progress = total == 0 ? 0.0 : done / total;

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (total > 0) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                  boxShadow: AppTheme.softShadow,
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Progress',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontFamily: 'Plus Jakarta Sans',
                          ),
                        ),
                        Text(
                          '$done / $total completed',
                          style: const TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        backgroundColor: AppTheme.divider,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          AppTheme.success,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            ...subtasks.map(
              (s) => SubtaskItem(
                subtask: s,
                onToggle: (v) => ref
                    .read(taskRepositoryProvider)
                    .toggleSubtask(task.id, s.id, v, currentUser?.uid ?? ''),
              ),
            ),

            if (canEdit) ...[
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                  boxShadow: AppTheme.softShadow,
                ),
                child: TextField(
                  controller: _newSubtaskCtrl,
                  decoration: InputDecoration(
                    hintText: 'Add a subtask…',
                    prefixIcon: const Icon(
                      Icons.add_circle_outline_rounded,
                      color: AppTheme.primary,
                    ),
                    suffixIcon: IconButton(
                      icon: const Icon(
                        Icons.send_rounded,
                        color: AppTheme.primary,
                      ),
                      onPressed: () => _addSubtask(task.id),
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                  onSubmitted: (_) => _addSubtask(task.id),
                ),
              ),
            ],

            if (subtasks.isEmpty && !canEdit)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Column(
                    children: [
                      Icon(
                        Icons.checklist_rounded,
                        size: 48,
                        color: AppTheme.divider,
                      ),
                      SizedBox(height: 12),
                      Text(
                        'No subtasks yet',
                        style: TextStyle(color: AppTheme.textLight),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 80),
          ],
        );
      },
    );
  }

  Future<void> _confirmDelete(BuildContext ctx, String taskId) async {
    final confirm = await showDialog<bool>(
      context: ctx,
      builder: (d) => AlertDialog(
        title: const Text('Delete Task?'),
        content: const Text(
          'This action cannot be undone. The task and all its data will be permanently deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(d, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      await ref.read(taskRepositoryProvider).deleteTask(taskId);
      if (mounted) context.pop();
    }
  }
}

// ── Project Chat Button ────────────────────────────────────────────────────────

class _ProjectChatButton extends ConsumerWidget {
  final String projectId;
  final String taskTitle;
  const _ProjectChatButton({required this.projectId, required this.taskTitle});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () async {
        final user = ref.read(currentUserProvider).value;
        if (user == null) return;
        final channelId = await ref
            .read(chatRepositoryProvider)
            .findProjectChannelId(projectId, user.uid);
        if (channelId != null && context.mounted) {
          context.push('/chat/$channelId');
        } else if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'No project channel found. Ask your admin to create one.',
              ),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.chat_rounded,
                color: AppTheme.primary,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Project Chat',
                    style: TextStyle(
                      fontWeight: FontWeight.w700, 
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Discuss this task with your team',
                    style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: AppTheme.textLight,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Widgets ────────────────────────────────────────────────────────────────────

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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.textLight),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 14),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.w600, color: valueColor),
          ),
        ],
      ),
    );
  }
}

class _AssigneesRow extends ConsumerWidget {
  final List<String> assigneeIds;
  const _AssigneesRow({required this.assigneeIds});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: assigneeIds.map((uid) {
        final userAsync = ref.watch(userProvider(uid));
        return userAsync.when(
          loading: () => const SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          error: (_, __) => const SizedBox.shrink(),
          data: (user) {
            if (user == null) return const SizedBox.shrink();
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                border: Border.all(
                  color: AppTheme.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AvatarWidget(
                    name: user.name,
                    imageUrl: user.avatarUrl,
                    size: 26,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    user.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primary,
                      fontFamily: 'Inter',
                    ),
                  ),
                ],
              ),
            );
          },
        );
      }).toList(),
    );
  }
}

class _ApprovalSection extends ConsumerWidget {
  final TaskModel task;
  final String currentUserId;
  const _ApprovalSection({required this.task, required this.currentUserId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.approval_rounded, size: 18, color: Color(0xFF9C27B0)),
              SizedBox(width: 8),
              Text(
                'Approval',
                style: TextStyle(
                  fontWeight: FontWeight.w700, 
                  fontSize: 15,
                  fontFamily: 'Plus Jakarta Sans',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (task.approvalStatus == ApprovalStatus.notRequired ||
              task.approvalStatus == ApprovalStatus.rejected) ...[
            if (task.approvalStatus == ApprovalStatus.rejected)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.error.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.error.withValues(alpha: 0.2),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.cancel_outlined,
                      color: AppTheme.error,
                      size: 16,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Previously rejected',
                      style: TextStyle(color: AppTheme.error, fontSize: 13),
                    ),
                  ],
                ),
              ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => ref.read(taskRepositoryProvider).updateTask(
                  task.id,
                  {'approvalStatus': ApprovalStatus.pending.value},
                ),
                icon: const Icon(Icons.send_rounded, size: 16),
                label: const Text(AppStrings.requestApproval),
              ),
            ),
          ] else if (task.approvalStatus == ApprovalStatus.pending) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF9C27B0).withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.pending_actions_rounded,
                    color: Color(0xFF9C27B0),
                    size: 16,
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Awaiting approval',
                    style: TextStyle(color: Color(0xFF9C27B0), fontSize: 13),
                  ),
                ],
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () =>
                        ref.read(taskRepositoryProvider).updateTask(task.id, {
                          'approvalStatus': 'approved',
                          'approvedBy': currentUserId,
                        }),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.success,
                    ),
                    child: const Text(AppStrings.approve),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => ref
                        .read(taskRepositoryProvider)
                        .updateTask(task.id, {'approvalStatus': 'rejected'}),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.error,
                      side: const BorderSide(color: AppTheme.error),
                    ),
                    child: const Text(AppStrings.reject),
                  ),
                ),
              ],
            ),
          ] else if (task.approvalStatus == ApprovalStatus.approved) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.success.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.check_circle_outline_rounded,
                    color: AppTheme.success,
                    size: 16,
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Approved',
                    style: TextStyle(
                      color: AppTheme.success,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
