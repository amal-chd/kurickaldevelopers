import 'package:flutter/material.dart';
import '../../../core/enums/task_priority.dart';

class PriorityBadge extends StatelessWidget {
  final TaskPriority priority;

  const PriorityBadge({super.key, required this.priority});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.flag_rounded, color: priority.color, size: 14),
        const SizedBox(width: 4),
        Text(
          priority.label,
          style: TextStyle(
            color: priority.color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
