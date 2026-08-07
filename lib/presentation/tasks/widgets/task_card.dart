import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/theme.dart';
import '../../../core/extensions/datetime_ext.dart';
import '../../../data/models/task_model.dart';
import '../../../core/enums/task_status.dart';
import '../../../providers/role_provider.dart';
import '../../shared/widgets/status_chip.dart';

class TaskCard extends ConsumerWidget {
  final TaskModel task;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  const TaskCard({
    super.key,
    required this.task,
    required this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: () {
            if (task.status == TaskStatus.done) {
              if (task.completionStatus == 'completed_late') {
                return Border.all(color: AppTheme.error.withValues(alpha: 0.3), width: 1.0);
              }
              return Border.all(color: AppTheme.success.withValues(alpha: 0.3), width: 1.0);
            }
            final now = DateTime.now();
            final isSameDay = task.dueDate.year == now.year && task.dueDate.month == now.month && task.dueDate.day == now.day;
            if (now.isAfter(task.dueDate) && !isSameDay) {
              return Border.all(color: AppTheme.error.withValues(alpha: 0.3), width: 1.0);
            }
            if (isSameDay) {
              return Border.all(color: AppTheme.accent.withValues(alpha: 0.3), width: 1.0);
            }
            return null;
          }(),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      StatusChip.priority(task.priority),
                      StatusChip.completionStatus(
                        status: task.status,
                        completionStatus: task.completionStatus,
                        dueDate: task.dueDate,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 14,
                  color: AppTheme.textMuted.withValues(alpha: 0.3),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              task.title,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                color: AppTheme.onSurface,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const Spacer(),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.surfaceAlt,
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Row(
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
                      color: task.isOverdue ? AppTheme.error : AppTheme.textMuted,
                      fontFamily: 'Inter',
                    ),
                  ),
                  if (task.assigneeIds.isNotEmpty) ...[
                    const Spacer(),
                    Icon(
                      Icons.people_alt_rounded,
                      size: 14,
                      color: AppTheme.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${task.assigneeIds.length}',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textMuted,
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty) ...[
                    const Spacer(),
                    ref.watch(roleStreamProvider(task.assignedRoleId!)).when(
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
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                role.name,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: color,
                                  fontFamily: 'Inter',
                                ),
                              ),
                            );
                          },
                        ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
