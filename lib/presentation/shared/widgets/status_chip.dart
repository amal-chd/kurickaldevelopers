import 'package:flutter/material.dart';
import '../../../app/theme.dart';
import '../../../core/enums/task_status.dart';
import '../../../core/enums/task_priority.dart';

class StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  final double fontSize;

  const StatusChip({
    super.key,
    required this.label,
    required this.color,
    this.fontSize = 12,
  });

  factory StatusChip.taskStatus(TaskStatus status) {
    return StatusChip(label: status.label, color: status.color);
  }

  factory StatusChip.completionStatus({
    required TaskStatus status,
    String? completionStatus,
    DateTime? dueDate,
  }) {
    if (status == TaskStatus.done) {
      if (completionStatus == 'completed_on_time') {
        return const StatusChip(
          label: 'Completed On Time',
          color: AppTheme.success,
        );
      }
      if (completionStatus == 'completed_late') {
        return const StatusChip(
          label: 'Completed Late',
          color: AppTheme.error,
        );
      }
      return const StatusChip(
        label: 'Completed',
        color: AppTheme.success,
      );
    }

    if (dueDate != null) {
      final now = DateTime.now();
      final isSameDay = dueDate.year == now.year && dueDate.month == now.month && dueDate.day == now.day;
      if (now.isAfter(dueDate) && !isSameDay) {
        return const StatusChip(
          label: 'Late (Overdue)',
          color: AppTheme.error,
        );
      }
      if (isSameDay) {
        return const StatusChip(
          label: 'Due Today',
          color: AppTheme.accent,
        );
      }
    }

    return const StatusChip(
      label: 'In Progress',
      color: AppTheme.primary,
    );
  }

  factory StatusChip.priority(TaskPriority priority) {
    return StatusChip(label: priority.label, color: priority.color);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          fontFamily: 'Inter',
        ),
      ),
    );
  }
}

class HealthDot extends StatelessWidget {
  final String status; // green, amber, red

  const HealthDot({super.key, required this.status});

  Color get color {
    switch (status) {
      case 'green':
        return AppTheme.success;
      case 'amber':
        return AppTheme.accent;
      case 'red':
        return AppTheme.error;
      default:
        return const Color(0xFF9E9E9E);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
