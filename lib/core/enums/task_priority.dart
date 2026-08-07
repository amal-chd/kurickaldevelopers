import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

enum TaskPriority {
  critical(
    'critical',
    'Critical',
    AppColors.priorityCritical,
    Icons.flag_rounded,
  ),
  high('high', 'High', AppColors.priorityHigh, Icons.flag_rounded),
  medium('medium', 'Medium', AppColors.priorityMedium, Icons.flag_rounded),
  low('low', 'Low', AppColors.priorityLow, Icons.flag_rounded);

  final String value;
  final String label;
  final Color color;
  final IconData icon;

  const TaskPriority(this.value, this.label, this.color, this.icon);

  static TaskPriority fromString(String value) {
    return TaskPriority.values.firstWhere(
      (e) => e.value == value,
      orElse: () => TaskPriority.medium,
    );
  }
}

extension TaskPriorityX on TaskPriority {
  static TaskPriority fromString(String value) =>
      TaskPriority.fromString(value);
}
