import 'package:flutter/material.dart';
import '../../../app/theme.dart';
import '../../../data/models/subtask_model.dart';

class SubtaskItem extends StatelessWidget {
  final SubtaskModel subtask;
  final void Function(bool) onToggle;

  const SubtaskItem({super.key, required this.subtask, required this.onToggle});

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
      dense: true,
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
    );
  }
}
