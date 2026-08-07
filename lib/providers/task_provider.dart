import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/task_model.dart';
import '../data/models/subtask_model.dart';
import '../data/models/comment_model.dart';
import '../data/repositories/task_repository.dart';
import 'role_provider.dart';
import 'user_provider.dart';

final taskRepositoryProvider = Provider<TaskRepository>(
  (ref) => TaskRepository(),
);

final userTasksProvider = StreamProvider<List<TaskModel>>((ref) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value([]);
  return ref.watch(taskRepositoryProvider).watchUserTasks(user.uid, roleId: user.roleId);
});

/// All tasks in the system — used by managers who assign tasks
/// to others and need to see the full picture.
final allTasksProvider = StreamProvider<List<TaskModel>>((ref) {
  return ref.watch(taskRepositoryProvider).watchAllTasks();
});

final projectTasksProvider = StreamProvider.family<List<TaskModel>, String>((
  ref,
  projectId,
) {
  // Visibility policy: staff see only THEIR tasks within a project (the raw
  // project-wide query would also be rejected by the Firestore rules for
  // them); roles with tasks_view_all see every task in the project.
  final canViewAll = ref.watch(hasPermissionProvider('tasks_view_all'));
  if (canViewAll) {
    return ref.watch(taskRepositoryProvider).watchTasksForProject(projectId);
  }
  final myTasks = ref.watch(userTasksProvider);
  return Stream.value(
    (myTasks.value ?? []).where((t) => t.projectId == projectId).toList(),
  );
});

final taskProvider = StreamProvider.family<TaskModel?, String>((ref, taskId) {
  return ref.watch(taskRepositoryProvider).watchTask(taskId);
});

final subtasksProvider = StreamProvider.family<List<SubtaskModel>, String>((
  ref,
  taskId,
) {
  return ref.watch(taskRepositoryProvider).watchSubtasks(taskId);
});

final commentsProvider = StreamProvider.family<List<CommentModel>, String>((
  ref,
  taskId,
) {
  return ref.watch(taskRepositoryProvider).watchComments(taskId);
});

// Derived: tasks grouped by status for kanban (3-column board)
final projectKanbanProvider =
    Provider.family<Map<String, List<TaskModel>>, String>((ref, projectId) {
      final tasks = ref.watch(projectTasksProvider(projectId)).value ?? [];
      final Map<String, List<TaskModel>> board = {
        'in_progress': [],
        'approved': [],
        'done': [],
      };
      for (final task in tasks) {
        // Legacy values already mapped by TaskStatus.fromString inside the model
        board[task.status.value]?.add(task);
      }
      return board;
    });
