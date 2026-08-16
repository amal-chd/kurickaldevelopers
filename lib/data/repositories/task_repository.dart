import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:rxdart/rxdart.dart';
import '../models/task_model.dart';
import '../models/subtask_model.dart';
import '../models/comment_model.dart';
import '../models/time_log_model.dart';
import '../models/user_model.dart';
import '../services/push_sender.dart';
import '../../core/enums/task_status.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';

class TaskRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _tasks => _db.collection('tasks');

  Stream<List<TaskModel>> watchTasksForProject(String projectId, [int attempt = 0]) async* {
    try {
      await for (final s in _tasks.where('projectId', isEqualTo: projectId).orderBy('createdAt', descending: true).snapshots()) {
        yield s.docs.map(TaskModel.fromFirestore).toList();
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchTasksForProject(projectId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  void _logStreamError(String streamName, Object error, String userId, {String? roleId}) {
    // debugPrint is a no-op in release builds, so these diagnostics never
    // reach production logs (unlike print()).
    if (error is FirebaseException) {
      debugPrint('[AUTHORIZATION ERROR] Mobile TaskRepository stream "$streamName" failed: '
            'code=${error.code}, message=${error.message}, userId=$userId, roleId=$roleId');
    } else {
      debugPrint('[API ERROR] Mobile TaskRepository stream "$streamName" failed: $error, userId=$userId, roleId=$roleId');
    }
  }

  Stream<List<TaskModel>> watchUserTasks(String userId, {String? roleId, int attempt = 0}) {
    final userTasksStream = _tasks
        .where('assigneeIds', arrayContains: userId)
        .snapshots()
        .map((s) => s.docs.map(TaskModel.fromFirestore).toList())
        .handleError((e) {
          _logStreamError('userTasksStream', e, userId, roleId: roleId);
          throw ErrorTranslator.translate(e);
        });

    if (roleId == null || roleId.isEmpty) {
      return userTasksStream.map((list) {
        list.sort((a, b) => a.dueDate.compareTo(b.dueDate));
        return list;
      });
    }

    final roleTasksStream = _tasks
        .where('assignedRoleIds', arrayContains: roleId)
        .snapshots()
        .map((s) => s.docs.map(TaskModel.fromFirestore).toList())
        .handleError((e) {
          _logStreamError('roleTasksStream', e, userId, roleId: roleId);
          throw ErrorTranslator.translate(e);
        });

    return Rx.combineLatest2<List<TaskModel>, List<TaskModel>, List<TaskModel>>(
      userTasksStream,
      roleTasksStream,
      (userTasks, roleTasks) {
        final Map<String, TaskModel> merged = {};
        for (final t in userTasks) {
          merged[t.id] = t;
        }
        for (final t in roleTasks) {
          merged[t.id] = t;
        }
        final list = merged.values.toList();
        list.sort((a, b) => a.dueDate.compareTo(b.dueDate));
        return list;
      },
    );
  }

  /// All tasks in the system — for manager / admin views.
  /// Capped at 200 to prevent unbounded reads.
  ///
  /// NOTE: ordered by createdAt (always present) — ordering by dueDate would
  /// silently EXCLUDE legacy tasks that were created without the field
  /// (Firestore drops docs missing the orderBy field). Due-date ordering for
  /// display is done client-side.
  Stream<List<TaskModel>> watchAllTasks([int attempt = 0]) async* {
    try {
      await for (final s
          in _tasks.orderBy('createdAt', descending: true).limit(200).snapshots()) {
        final list = s.docs.map(TaskModel.fromFirestore).toList()
          ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
        yield list;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchAllTasks(attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Paginated fetch for "load more" pattern.
  /// Returns [pageSize] tasks starting after [lastDocument].
  Future<List<TaskModel>> fetchTasksPage({
    int pageSize = 50,
    DocumentSnapshot? lastDocument,
  }) async {
    try {
      // createdAt is always present; dueDate is not (legacy docs) — see note
      // on watchAllTasks.
      Query query =
          _tasks.orderBy('createdAt', descending: true).limit(pageSize);
      if (lastDocument != null) {
        query = query.startAfterDocument(lastDocument);
      }
      final snap = await query.get();
      return snap.docs.map(TaskModel.fromFirestore).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<TaskModel?> watchTask(String taskId, [int attempt = 0]) async* {
    try {
      await for (final doc in _tasks.doc(taskId).snapshots()) {
        if (!doc.exists) {
          yield null;
        } else {
          yield TaskModel.fromFirestore(doc);
        }
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchTask(taskId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<TaskModel?> getTask(String taskId) async {
    try {
      final doc = await _tasks.doc(taskId).get();
      if (!doc.exists) return null;
      return TaskModel.fromFirestore(doc);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createTask(TaskModel task) async {
    try {
      final doc = await _tasks.add(task.toFirestore());
      if (task.assigneeIds.isNotEmpty) {
        // Push (best-effort) + in-app notification for each assignee.
        PushSender.instance.task(taskId: doc.id, kind: 'assigned');
        for (final uid in task.assigneeIds.toSet()) {
          if (uid == task.createdBy) continue;
          await _writeNotif(
            userId: uid,
            type: 'task_assigned',
            title: 'New Task Assigned',
            body: 'You have been assigned to: ${task.title}',
            relatedId: doc.id,
          );
        }
      }
      if (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty) {
        try {
          final usersSnap = await _db.collection('users')
              .where('roleId', isEqualTo: task.assignedRoleId)
              .where('isActive', isEqualTo: true)
              .get();
          final roleUsers = usersSnap.docs.map(UserModel.fromFirestore).toList();
          for (final u in roleUsers) {
            if (u.uid == task.createdBy) continue;
            await _writeNotif(
              userId: u.uid,
              type: 'task_assigned',
              title: 'New Role Task Assigned',
              body: 'A task has been assigned to your role: ${task.title}',
              relatedId: doc.id,
            );
          }
        } catch (_) {
          // ignore notification failure
        }
      }
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // Writes an in-app notification document (best-effort; never blocks the task
  // action). Schema matches the web app: userId-targeted with an isRead map.
  Future<void> _writeNotif({
    required String userId,
    required String type,
    required String title,
    required String body,
    String relatedId = '',
  }) async {
    if (userId.isEmpty) return;
    try {
      await _db.collection('notifications').add({
        'userId': userId,
        'type': type,
        'title': title,
        'body': body,
        'relatedId': relatedId,
        'relatedType': 'task',
        'isRead': <String, bool>{},
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      // Ignore — notification delivery must not break task creation/updates.
    }
  }

  Future<void> updateTask(String taskId, Map<String, dynamic> data) async {
    try {
      data['updatedAt'] = AppDateUtils.toTimestamp(DateTime.now());

      // Fetch the old task to compare assignees
      final doc = await _tasks.doc(taskId).get();
      final oldAssignees = List<String>.from((doc.data() as Map?)?['assigneeIds'] ?? []);
      final oldRoleId = (doc.data() as Map?)?['assignedRoleId'] as String?;

      await _tasks.doc(taskId).update(data);

      if (data.containsKey('assigneeIds')) {
        final newAssignees = List<String>.from(data['assigneeIds'] ?? []);
        final added = newAssignees.where((id) => !oldAssignees.contains(id)).toList();

        if (added.isNotEmpty) {
          PushSender.instance.task(taskId: taskId, kind: 'assigned');
          final taskTitle = (data['title'] ?? (doc.data() as Map?)?['title'] ?? 'Task') as String;
          final createdBy = (doc.data() as Map?)?['createdBy'] as String? ?? '';
          for (final uid in added) {
            if (uid == createdBy) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_assigned',
              title: 'New Task Assigned',
              body: 'You have been assigned to: $taskTitle',
              relatedId: taskId,
            );
          }
        }
      }

      if (data.containsKey('assignedRoleId')) {
        final newRoleId = data['assignedRoleId'] as String?;
        if (newRoleId != null && newRoleId.isNotEmpty && newRoleId != oldRoleId) {
          final taskTitle = (data['title'] ?? (doc.data() as Map?)?['title'] ?? 'Task') as String;
          final createdBy = (doc.data() as Map?)?['createdBy'] as String? ?? '';
          try {
            final usersSnap = await _db.collection('users')
                .where('roleId', isEqualTo: newRoleId)
                .where('isActive', isEqualTo: true)
                .get();
            final roleUsers = usersSnap.docs.map(UserModel.fromFirestore).toList();
            for (final u in roleUsers) {
              if (u.uid == createdBy) continue;
              await _writeNotif(
                userId: u.uid,
                type: 'task_assigned',
                title: 'New Role Task Assigned',
                body: 'A task has been assigned to your role: $taskTitle',
                relatedId: taskId,
              );
            }
          } catch (_) {
            // ignore notification failure
          }
        }
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateStatus(String taskId, TaskStatus newStatus, String userId) async {
    try {
      final taskDoc = await _tasks.doc(taskId).get();
      if (!taskDoc.exists) return;
      final data = taskDoc.data() as Map<String, dynamic>;
      
      final dueDate = AppDateUtils.fromTimestamp(data['dueDate']);
      final memberProgress = Map<String, dynamic>.from(data['memberProgress'] ?? {});
      
      // Check if user is project manager, role approver/editor, or task creator
      final createdBy = (data['createdBy'] as String?) ?? '';
      final projectId = (data['projectId'] as String?) ?? '';
      bool isProjectManager = false;
      String? projectManagerId;
      if (projectId.isNotEmpty) {
        final projSnap = await _db.collection('projects').doc(projectId).get();
        if (projSnap.exists) {
          final projData = projSnap.data() as Map<String, dynamic>;
          projectManagerId = projData['projectManagerId'] as String? ?? projData['managerId'] as String?;
          isProjectManager = projectManagerId == userId;
        }
      }

      final userSnap = await _db.collection('users').doc(userId).get();
      String userName = 'Someone';
      bool isManager = false;
      if (userSnap.exists) {
        final userData = userSnap.data() as Map<String, dynamic>;
        userName = userData['name'] as String? ?? 'Someone';
        final roleId = userData['roleId'] as String? ?? '';
        if (roleId.isNotEmpty) {
          final roleSnap = await _db.collection('roles').doc(roleId).get();
          if (roleSnap.exists) {
            final roleData = roleSnap.data() as Map<String, dynamic>;
            final permissions = Map<String, dynamic>.from(roleData['permissions'] ?? {});
            final level = (roleData['level'] as num?)?.toInt() ?? 0;
            isManager = permissions['tasks_approve'] == true || permissions['tasks_edit'] == true || level >= 60;
          }
        }
      }

      final canMarkDone = isManager || isProjectManager || userId == createdBy;
      final actualStatus = (!canMarkDone && newStatus == TaskStatus.done)
          ? TaskStatus.underReview
          : newStatus;

      if (actualStatus == TaskStatus.done || actualStatus == TaskStatus.underReview) {
        final details = AppDateUtils.calculateCompletionDetails(DateTime.now(), dueDate);
        memberProgress[userId] = {
          'status': actualStatus.value,
          'updatedAt': FieldValue.serverTimestamp(),
          'completedAt': FieldValue.serverTimestamp(),
          'completionStatus': details.completionStatus,
          'delaySeconds': details.delaySeconds,
        };
      } else {
        memberProgress[userId] = {
          'status': actualStatus.value,
          'updatedAt': FieldValue.serverTimestamp(),
        };
      }

      final updates = <String, dynamic>{
        'memberProgress': memberProgress,
      };

      if (canMarkDone) {
        updates['status'] = actualStatus.value;
        if (actualStatus == TaskStatus.done) {
          final details = AppDateUtils.calculateCompletionDetails(DateTime.now(), dueDate);
          final explicitUids = List<String>.from(data['assigneeIds'] ?? []);
          final roleUids = <String>[];
          final assignedRoleIds = List<String>.from(data['assignedRoleIds'] ??
              (data['assignedRoleId'] != null ? [data['assignedRoleId']] : []));
          if (assignedRoleIds.isNotEmpty) {
            final usersSnap = await _db
                .collection('users')
                .where('roleId', whereIn: assignedRoleIds)
                .get();
            for (final uDoc in usersSnap.docs) {
              if (uDoc.exists) {
                final userData = uDoc.data();
                if (userData['isActive'] != false) {
                  roleUids.add(uDoc.id);
                }
              }
            }
          }
          final allAssigneeUids = {...explicitUids, ...roleUids};
          for (final uid in allAssigneeUids) {
            memberProgress[uid] = {
              'status': TaskStatus.done.value,
              'updatedAt': FieldValue.serverTimestamp(),
              'completedAt': FieldValue.serverTimestamp(),
              'completionStatus': details.completionStatus,
              'delaySeconds': details.delaySeconds,
            };
          }
          updates['memberProgress'] = memberProgress;
          updates['completedAt'] = FieldValue.serverTimestamp();
          updates['completionStatus'] = details.completionStatus;
          updates['delaySeconds'] = details.delaySeconds;
        } else if (actualStatus == TaskStatus.underReview) {
          updates['completedAt'] = FieldValue.delete();
          updates['completionStatus'] = FieldValue.delete();
          updates['delaySeconds'] = FieldValue.delete();
        } else {
          updates['completedAt'] = FieldValue.delete();
          updates['completionStatus'] = FieldValue.delete();
          updates['delaySeconds'] = FieldValue.delete();
        }
      } else {
        // Employee/Assignee workflow
        if (actualStatus == TaskStatus.underReview) {
          updates['status'] = TaskStatus.underReview.value;
          updates['completedAt'] = FieldValue.delete();
          updates['completionStatus'] = FieldValue.delete();
          updates['delaySeconds'] = FieldValue.delete();
        } else {
          updates['status'] = TaskStatus.inProgress.value;
          updates['completedAt'] = FieldValue.delete();
          updates['completionStatus'] = FieldValue.delete();
          updates['delaySeconds'] = FieldValue.delete();
        }
      }

      await updateTask(taskId, updates);
      PushSender.instance.task(taskId: taskId, kind: 'status');

      // Notify relevant parties based on status change
      try {
        final title = (data['title'] as String?) ?? 'Task';
        if (actualStatus == TaskStatus.underReview && !canMarkDone) {
          // Assignee raised/submitted task for review -> notify Assigner and Project Manager
          if (createdBy.isNotEmpty && createdBy != userId) {
            await _writeNotif(
              userId: createdBy,
              type: 'task_updated',
              title: 'Verification Required',
              body: '$userName raised task "$title" for review.',
              relatedId: taskId,
            );
          }
          if (projectManagerId != null && projectManagerId.isNotEmpty && projectManagerId != userId && projectManagerId != createdBy) {
            await _writeNotif(
              userId: projectManagerId,
              type: 'task_updated',
              title: 'Verification Required',
              body: '$userName submitted task "$title" for verification.',
              relatedId: taskId,
            );
          }
        } else if (actualStatus == TaskStatus.done && canMarkDone) {
          // Verified and marked done -> notify assignees and assigner
          final explicitUids = List<String>.from(data['assigneeIds'] ?? []);
          final notifyUids = <String>{...explicitUids, if (createdBy.isNotEmpty) createdBy};
          for (final uid in notifyUids) {
            if (uid == userId) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_updated',
              title: 'Task Verified & Completed',
              body: 'Task "$title" has been verified and marked as Done by $userName.',
              relatedId: taskId,
            );
          }
        } else {
          // General status update -> notify creator if changed by someone else
          if (createdBy.isNotEmpty && createdBy != userId) {
            await _writeNotif(
              userId: createdBy,
              type: 'task_updated',
              title: 'Task Status Updated',
              body: 'Task "$title" is now ${actualStatus.label}',
              relatedId: taskId,
            );
          }
        }
      } catch (_) {}
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteTask(String taskId) async {
    try {
      await _tasks.doc(taskId).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // Subtasks
  CollectionReference _subtasks(String taskId) =>
      _tasks.doc(taskId).collection('subtasks');

  Stream<List<SubtaskModel>> watchSubtasks(String taskId) {
    // Sort client-side by title for stable ordering — the model has no createdAt.
    return _subtasks(taskId)
        .snapshots()
        .map((s) {
          final list = s.docs.map(SubtaskModel.fromFirestore).toList();
          list.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
          return list;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> addSubtask(String taskId, SubtaskModel subtask, {String? addedByUid}) async {
    try {
      await _subtasks(taskId).add(subtask.toFirestore());

      // Notify assignees about the new subtask (best-effort).
      if (addedByUid != null) {
        try {
          final taskDoc = await _tasks.doc(taskId).get();
          if (taskDoc.exists) {
            final data = taskDoc.data() as Map<String, dynamic>;
            final assigneeIds = List<String>.from(data['assigneeIds'] ?? []);
            final title = data['title'] as String? ?? 'Task';

            PushSender.instance.task(taskId: taskId, kind: 'subtask_added');

            for (final uid in assigneeIds.toSet()) {
              if (uid == addedByUid) continue;
              await _writeNotif(
                userId: uid,
                type: 'task_updated',
                title: 'New Subtask Added',
                body: 'A subtask "${subtask.title}" was added to: $title',
                relatedId: taskId,
              );
            }
          }
        } catch (_) {
          // Notification delivery must not break subtask creation.
        }
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> toggleSubtask(
    String taskId,
    String subtaskId,
    bool isDone,
    String userId,
  ) async {
    try {
      await _subtasks(taskId).doc(subtaskId).update({
        'isDone': isDone,
        'doneAt': isDone ? AppDateUtils.toTimestamp(DateTime.now()) : null,
        'doneBy': isDone ? userId : null,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // Comments
  CollectionReference _comments(String taskId) =>
      _tasks.doc(taskId).collection('comments');

  Stream<List<CommentModel>> watchComments(String taskId) {
    return _comments(taskId)
        .orderBy('createdAt')
        .snapshots()
        .map((s) => s.docs.map(CommentModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> addComment(String taskId, CommentModel comment) async {
    try {
      await _comments(taskId).add(comment.toFirestore());

      // Notify assignees + creator about the new comment (best-effort).
      try {
        final taskDoc = await _tasks.doc(taskId).get();
        if (taskDoc.exists) {
          final data = taskDoc.data() as Map<String, dynamic>;
          final assigneeIds = List<String>.from(data['assigneeIds'] ?? []);
          final createdBy = data['createdBy'] as String? ?? '';
          final title = data['title'] as String? ?? 'Task';

          // Push (FCM) to assignees + creator — recipients/message are rebuilt
          // server-side from the task; the author is excluded there too.
          PushSender.instance.task(taskId: taskId, kind: 'comment_added');

          final notifySet = <String>{...assigneeIds, if (createdBy.isNotEmpty) createdBy};
          for (final uid in notifySet) {
            if (uid == comment.authorId || uid.isEmpty) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_updated',
              title: 'New Comment on Task',
              body: 'New comment on "$title"',
              relatedId: taskId,
            );
          }
        }
      } catch (_) {
        // Notification delivery must not break comment creation.
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // Time logs
  CollectionReference _timeLogs(String taskId) =>
      _tasks.doc(taskId).collection('timeLogs');

  Stream<List<TimeLogModel>> watchTimeLogs(String taskId) {
    return _timeLogs(taskId)
        .orderBy('startTime', descending: true)
        .snapshots()
        .map((s) => s.docs.map(TimeLogModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> startTimer(String taskId, TimeLogModel log) async {
    try {
      final doc = await _timeLogs(taskId).add(log.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> stopTimer(
    String taskId,
    String logId,
    DateTime endTime,
    int durationMinutes,
  ) async {
    try {
      await _timeLogs(taskId).doc(logId).update({
        'endTime': AppDateUtils.toTimestamp(endTime),
        'durationMinutes': durationMinutes,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
