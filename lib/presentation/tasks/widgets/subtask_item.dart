import 'package:flutter/material.dart';
import '../../../app/theme.dart';
import '../../../data/models/subtask_model.dart';

class SubtaskItem extends StatelessWidget {
  final SubtaskModel subtask;
  final void Function(bool) onToggle;
  final VoidCallback? onDelete;

  const SubtaskItem({
    super.key,
    required this.subtask,
    required this.onToggle,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return CheckboxListTile(
      value: subtask.isDone,
      onChanged: (v) => onToggle(v ?? false),
      title: Text(
        subtask.title,
        style: TextStyle(
          decoration: subtask.isDone ? TextDecoration.lineThrough : null,
          color: subtask.isDone ? AppTheme.textMuted : AppTheme.onSurface,
        ),
      ),
      secondary: onDelete != null
          ? IconButton(
              icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppTheme.textLight),
              onPressed: onDelete,
              tooltip: 'Delete subtask',
            )
          : null,
      dense: true,
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
    );
  }
}
