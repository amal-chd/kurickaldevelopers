import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/enums/task_status.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../providers/user_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/chat_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/status_chip.dart';

class MemberDetailScreen extends ConsumerStatefulWidget {
  final String userId;
  const MemberDetailScreen({super.key, required this.userId});

  @override
  ConsumerState<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends ConsumerState<MemberDetailScreen> {
  bool _dmLoading = false;

  Future<void> _openDm(BuildContext context) async {
    final myUser = ref.read(currentUserProvider).value;
    if (myUser == null) return;
    if (myUser.uid == widget.userId) return; // can't DM yourself

    // Capture context-dependent refs before the async gap
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);

    setState(() => _dmLoading = true);
    try {
      final peer = ref.read(userProvider(widget.userId)).value;
      final channelId = await ref
          .read(chatRepositoryProvider)
          .getOrCreateDmChannel(
            myUid: myUser.uid,
            peerUid: widget.userId,
            myName: myUser.name,
            peerName: peer?.name ?? '',
          );
      if (mounted) router.push('/chat/$channelId');
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('Could not open chat: $e'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _dmLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(userProvider(widget.userId));
    final tasksAsync = ref.watch(allTasksProvider);
    final currentUser = ref.watch(currentUserProvider).value;

    return userAsync.when(
      loading: () => const Scaffold(body: LoadingWidget()),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(userProvider(widget.userId)),
        ),
      ),
      data: (user) {
        if (user == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyStateWidget(
              icon: Icons.person_off_rounded,
              title: 'User not found',
              subtitle: 'This team member no longer exists.',
            ),
          );
        }

        final roleAsync = ref.watch(roleStreamProvider(user.roleId));
        // Show "Message" button for all roles when looking at a different person
        final showDmButton =
            currentUser != null && currentUser.uid != widget.userId;

        return Scaffold(
          backgroundColor: AppTheme.background,
          body: CustomScrollView(
            slivers: [
              // ── Profile Header ──────────────────────────────────────────
              SliverAppBar(
                expandedHeight: 220,
                pinned: true,
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                actions: [
                  if (showDmButton)
                    _dmLoading
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            ),
                          )
                        : IconButton(
                            icon: const Icon(Icons.chat_bubble_outline_rounded),
                            tooltip: 'Send message',
                            onPressed: () => _openDm(context),
                          ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF0B1E3D), Color(0xFF1A3F7A)],
                      ),
                    ),
                    child: SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
                        child: Row(
                          children: [
                            AvatarWidget(
                              imageUrl: user.avatarUrl,
                              name: user.name,
                              size: 72,
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.12,
                              ),
                            ),
                            const SizedBox(width: 20),
                            Expanded(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  roleAsync.when(
                                    loading: () => const SizedBox.shrink(),
                                    error: (_, __) => const SizedBox.shrink(),
                                    data: (role) => role != null
                                        ? Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 3,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(
                                                alpha: 0.1,
                                              ),
                                              borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                                            ),
                                            child: Text(
                                              role.name,
                                              style: const TextStyle(
                                                color: Colors.white70,
                                                fontSize: 12,
                                              ),
                                            ),
                                          )
                                        : const SizedBox.shrink(),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.email_outlined,
                                        color: Colors.white38,
                                        size: 13,
                                      ),
                                      const SizedBox(width: 6),
                                      Flexible(
                                        child: Text(
                                          user.email,
                                          style: const TextStyle(
                                            color: Colors.white60,
                                            fontSize: 12,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (user.phone.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.phone_outlined,
                                          color: Colors.white38,
                                          size: 13,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          user.phone,
                                          style: const TextStyle(
                                            color: Colors.white60,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // ── Stats + Tasks ───────────────────────────────────────────
              SliverToBoxAdapter(
                child: tasksAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(24),
                    child: LoadingWidget(),
                  ),
                  error: (e, _) => AppErrorWidget(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(allTasksProvider),
                  ),
                  data: (allTasks) {
                    final tasks = allTasks
                        .where((t) => t.assigneeIds.contains(widget.userId))
                        .toList();
                    final done = tasks
                        .where((t) => t.status == TaskStatus.done)
                        .length;
                    final overdue = tasks.where((t) => t.isOverdue).length;

                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Stats row
                          Row(
                            children: [
                              _StatCard(
                                label: 'Assigned',
                                value: '${tasks.length}',
                                color: AppTheme.primary,
                              ),
                              const SizedBox(width: 10),
                              _StatCard(
                                label: 'Completed',
                                value: '$done',
                                color: AppTheme.success,
                              ),
                              const SizedBox(width: 10),
                              _StatCard(
                                label: 'Overdue',
                                value: '$overdue',
                                color: AppTheme.error,
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Tasks header
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Assigned Tasks',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: AppTheme.onSurface,
                                ),
                              ),
                              if (tasks.isNotEmpty)
                                Text(
                                  '${tasks.length} total',
                                  style: const TextStyle(
                                    color: AppTheme.textMuted,
                                    fontSize: 13,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Task list
                          if (tasks.isEmpty)
                            const EmptyStateWidget(
                              icon: Icons.task_alt_outlined,
                              title: 'No tasks assigned',
                              subtitle: 'This member has no tasks yet.',
                            )
                          else
                            ...tasks.map(
                              (task) => Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: AppTheme.surface,
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                  border: Border.all(color: AppTheme.divider),
                                  boxShadow: AppTheme.softShadow,
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                    onTap: () =>
                                        context.push('/tasks/${task.id}'),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 12,
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                task.title,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 14,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  const Icon(
                                                    Icons
                                                        .calendar_today_outlined,
                                                    size: 12,
                                                    color: AppTheme.textMuted,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    task.dueDate.formatted,
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      color: task.isOverdue
                                                          ? AppTheme.error
                                                          : AppTheme.textMuted,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        StatusChip.taskStatus(task.status),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 40),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: AppTheme.divider),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
