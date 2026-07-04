import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

enum TaskStatus {
  inProgress('in_progress', 'In Progress', AppColors.statusInProgress),
  approved('approved', 'Approved', AppColors.statusApproved),
  done('done', 'Done', AppColors.statusDone);

  final String value;
  final String label;
  final Color color;

  const TaskStatus(this.value, this.label, this.color);

  // Legacy migration map — old 6-status values gracefully fall through
  static const _legacyMap = {
    'created': 'in_progress',
    'assigned': 'in_progress',
    'review': 'approved',
  };

  static TaskStatus fromString(String value) {
    final mapped = _legacyMap[value] ?? value;
    return TaskStatus.values.firstWhere(
      (e) => e.value == mapped,
      orElse: () => TaskStatus.inProgress,
    );
  }
}

extension TaskStatusX on TaskStatus {
  static TaskStatus fromString(String value) => TaskStatus.fromString(value);
}
