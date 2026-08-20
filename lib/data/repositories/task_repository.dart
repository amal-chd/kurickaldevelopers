import 'package:uuid/uuid.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
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
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp, GeoPoint, FieldValue;


Map<String, dynamic> _toCamelCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (key.contains('_')) {
      final parts = key.split('_');
      final camelKey = parts.first + parts.skip(1).map((w) => w.substring(0, 1).toUpperCase() + w.substring(1)).join('');
      map[camelKey] = value;
    } else {
      map[key] = value;
    }
  });

  final dateKeys = [
    'createdAt', 'updatedAt', 'completedAt', 'dueDate', 
    'approvedAt', 'slaDeadline', 'startTime', 'endTime',
    'lastMessageAt', 'doneAt', 'done_at', 'created_at', 'updated_at', 'completed_at', 'due_date', 'approved_at', 'sla_deadline', 'start_time', 'end_time', 'last_message_at'
  ];
  
  for (final k in dateKeys) {
    if (map.containsKey(k) && map[k] != null && map[k] is String) {
      try {
        map[k] = Timestamp.fromDate(DateTime.parse(map[k]));
      } catch (_) {}
    }
  }
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    
    if (key == 'tags') {
      map['labels'] = value;
      return;
    }
    if (key == 'attachmentUrls') {
      map['attachments'] = value;
      return;
    }
    // Drop fields not in Supabase schema
    if (['photoUrls', 'approvalStatus', 'approvedBy', 'approvedAt', 'slaDeadline', 'slaBreached', 'memberProgress', 'completionStatus', 'delaySeconds'].contains(key)) {
      return;
    }

    
    if (key == 'doneAt') return;
    if (key == 'doneBy') {
      map['completed_by'] = value;
      return;
    }

    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else if (value is GeoPoint) {
      map[snakeKey] = {'lat': value.latitude, 'lng': value.longitude};
    } else if (value != null && value.runtimeType.toString().contains('FieldValue')) {
      map[snakeKey] = DateTime.now().toIso8601String();
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

class TaskRepository {
  final _supabase = Supabase.instance.client;

  TaskModel _fromSupabase(Map<String, dynamic> data) {
    return TaskModel.fromMap(_toCamelCase(data), data['id']);
  }

  Stream<List<TaskModel>> watchTasksForProject(String projectId, [int attempt = 0]) {
    return _supabase.from('tasks').stream(primaryKey: ['id'])
        .eq('project_id', projectId)
        .order('created_at', ascending: false)
        .map((list) => list.map(_fromSupabase).toList())
        .handleError((e) {
          throw ErrorTranslator.translate(e);
        });
  }

  void _logStreamError(String streamName, Object error, String userId, {String? roleId}) {
    debugPrint('[API ERROR] Mobile TaskRepository stream "\$streamName" failed: \$error, userId=\$userId, roleId=\$roleId');
  }


  Stream<List<TaskModel>> watchUserTasks(String userId, {String? roleId, int attempt = 0}) {
    final allTasksStream = _supabase.from('tasks').stream(primaryKey: ['id'])
        .handleError((e) {
          _logStreamError('watchUserTasks', e, userId, roleId: roleId);
          throw ErrorTranslator.translate(e);
        });

    return allTasksStream.map((list) {
      final filtered = list.where((data) {
        final assignees = List<String>.from(data['assignee_ids'] ?? []);
        final assignedRoles = List<String>.from(data['assigned_role_ids'] ?? 
            (data['assigned_role_id'] != null ? [data['assigned_role_id']] : []));
        
        final isAssignee = assignees.contains(userId);
        final isRole = roleId != null && roleId.isNotEmpty && assignedRoles.contains(roleId);
        return isAssignee || isRole;
      }).map(_fromSupabase).toList();
      
      filtered.sort((a, b) => a.dueDate.compareTo(b.dueDate));
      return filtered;
    });
  }

  Stream<List<TaskModel>> watchAllTasks([int attempt = 0]) {
    return _supabase.from('tasks').stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .limit(200)
        .map((list) {
          final result = list.map(_fromSupabase).toList();
          result.sort((a, b) => a.dueDate.compareTo(b.dueDate));
          return result;
        })
        .handleError((e) {
          throw ErrorTranslator.translate(e);
        });
  }

  Future<List<TaskModel>> fetchTasksPage({
    int pageSize = 50,
    DocumentSnapshot? lastDocument,
  }) async {
    try {
      var query = _supabase.from('tasks').select();
      if (lastDocument != null) {
        final lastData = _toSnakeCase(lastDocument.data() as Map<String, dynamic>);
        if (lastData['created_at'] != null) {
          query = query.lt('created_at', lastData['created_at']);
        }
      }
      final data = await query.order('created_at', ascending: false).limit(pageSize);
      return data.map((d) => _fromSupabase(d)).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<TaskModel?> watchTask(String taskId, [int attempt = 0]) {
    return _supabase.from('tasks').stream(primaryKey: ['id'])
        .eq('id', taskId)
        .map((list) => list.isEmpty ? null : _fromSupabase(list.first))
        .handleError((e) {
          throw ErrorTranslator.translate(e);
        });
  }

  Future<TaskModel?> getTask(String taskId) async {
    try {
      final data = await _supabase.from('tasks').select().eq('id', taskId).maybeSingle();
      if (data == null) return null;
      return _fromSupabase(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createTask(TaskModel task) async {
    try {
      final data = _toSnakeCase(task.toFirestore());
      data['id'] = const Uuid().v4();
      final result = await _supabase.from('tasks').insert(data).select().single();
      final id = result['id'] as String;
      
      if (task.assigneeIds.isNotEmpty) {
        PushSender.instance.task(taskId: id, kind: 'assigned');
        for (final uid in task.assigneeIds.toSet()) {
          if (uid == task.createdBy) continue;
          await _writeNotif(
            userId: uid,
            type: 'task_assigned',
            title: 'New Task Assigned',
            body: 'You have been assigned to: \${task.title}',
            relatedId: id,
          );
        }
      }
      if (task.assignedRoleId != null && task.assignedRoleId!.isNotEmpty) {
        try {
          final usersData = (await FirebaseFirestore.instance.collection('users').where('roleId', isEqualTo: task.assignedRoleId!).where('isActive', isEqualTo: true).get()).docs.map((d) => d.data()..['id'] = d.id).toList();
          for (final u in usersData) {
            final uid = u['id'] as String? ?? u['uid'] as String? ?? '';
            if (uid.isEmpty || uid == task.createdBy) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_assigned',
              title: 'New Role Task Assigned',
              body: 'A task has been assigned to your role: \${task.title}',
              relatedId: id,
            );
          }
        } catch (_) {}
      }
      return id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> _writeNotif({
    required String userId,
    required String type,
    required String title,
    required String body,
    String relatedId = '',
  }) async {
    if (userId.isEmpty) return;
    try {
      await _supabase.from('app_notifications').insert({
        'id': const Uuid().v4(),
        'user_id': userId,
        'type': type,
        'title': title,
        'body': body,
        'related_id': relatedId,
        'related_type': 'task',
        'is_read': {},
        'created_at': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  Future<void> updateTask(String taskId, Map<String, dynamic> updates) async {
    try {
      updates['updatedAt'] = AppDateUtils.toTimestamp(DateTime.now());

      final doc = await _supabase.from('tasks').select().eq('id', taskId).maybeSingle();
      if (doc == null) return;
      
      final oldAssignees = List<String>.from(doc['assignee_ids'] ?? []);
      final oldRoleId = doc['assigned_role_id'] as String?;

      await _supabase.from('tasks').update(_toSnakeCase(updates)).eq('id', taskId);

      if (updates.containsKey('assigneeIds')) {
        final newAssignees = List<String>.from(updates['assigneeIds'] ?? []);
        final added = newAssignees.where((id) => !oldAssignees.contains(id)).toList();

        if (added.isNotEmpty) {
          PushSender.instance.task(taskId: taskId, kind: 'assigned');
          final taskTitle = (updates['title'] ?? doc['title'] ?? 'Task') as String;
          final createdBy = doc['created_by'] as String? ?? '';
          for (final uid in added) {
            if (uid == createdBy) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_assigned',
              title: 'New Task Assigned',
              body: 'You have been assigned to: \$taskTitle',
              relatedId: taskId,
            );
          }
        }
      }

      if (updates.containsKey('assignedRoleId')) {
        final newRoleId = updates['assignedRoleId'] as String?;
        if (newRoleId != null && newRoleId.isNotEmpty && newRoleId != oldRoleId) {
          final taskTitle = (updates['title'] ?? doc['title'] ?? 'Task') as String;
          final createdBy = doc['created_by'] as String? ?? '';
          try {
            final usersData = (await FirebaseFirestore.instance.collection('users').where('roleId', isEqualTo: newRoleId).where('isActive', isEqualTo: true).get()).docs.map((d) => d.data()..['id'] = d.id).toList();
            for (final u in usersData) {
              final uid = u['id'] as String? ?? u['uid'] as String? ?? '';
              if (uid.isEmpty || uid == createdBy) continue;
              await _writeNotif(
                userId: uid,
                type: 'task_assigned',
                title: 'New Role Task Assigned',
                body: 'A task has been assigned to your role: \$taskTitle',
                relatedId: taskId,
              );
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateStatus(String taskId, TaskStatus newStatus, String userId) async {
    try {
      final data = await _supabase.from('tasks').select().eq('id', taskId).maybeSingle();
      if (data == null) return;
      
      final dueDateStr = data['due_date'];
      final dueDate = dueDateStr != null ? DateTime.tryParse(dueDateStr) : null;
      final memberProgress = Map<String, dynamic>.from(data['member_progress'] ?? {});
      
      final createdBy = (data['created_by'] as String?) ?? '';
      final projectId = (data['project_id'] as String?) ?? '';
      bool isProjectManager = false;
      String? projectManagerId;
      if (projectId.isNotEmpty) {
        final projData = await _supabase.from('projects').select().eq('id', projectId).maybeSingle();
        if (projData != null) {
          projectManagerId = projData['project_manager_id'] as String? ?? projData['manager_id'] as String?;
          isProjectManager = projectManagerId == userId;
        }
      }

      final userSnap = await FirebaseFirestore.instance.collection('users').doc(userId).get().then((d) => d.exists ? (d.data()!..['id'] = d.id) : null);
      String userName = 'Someone';
      bool isManager = false;
      if (userSnap != null) {
        userName = userSnap['name'] as String? ?? 'Someone';
        final roleId = userSnap['role_id'] as String? ?? '';
        if (roleId.isNotEmpty) {
          final roleData = await _supabase.from('roles').select().eq('id', roleId).maybeSingle();
          if (roleData != null) {
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
          'updatedAt': DateTime.now().toIso8601String(),
          'completedAt': DateTime.now().toIso8601String(),
          'completionStatus': details.completionStatus,
          'delaySeconds': details.delaySeconds,
        };
      } else {
        memberProgress[userId] = {
          'status': actualStatus.value,
          'updatedAt': DateTime.now().toIso8601String(),
        };
      }

      final updates = <String, dynamic>{
        'memberProgress': memberProgress,
      };

      if (canMarkDone) {
        updates['status'] = actualStatus.value;
        if (actualStatus == TaskStatus.done) {
          final details = AppDateUtils.calculateCompletionDetails(DateTime.now(), dueDate);
          final explicitUids = List<String>.from(data['assignee_ids'] ?? []);
          final roleUids = <String>[];
          final assignedRoleIds = List<String>.from(data['assigned_role_ids'] ??
              (data['assigned_role_id'] != null ? [data['assigned_role_id']] : []));
          if (assignedRoleIds.isNotEmpty) {
            final usersSnap = (await FirebaseFirestore.instance.collection('users').where('roleId', whereIn: assignedRoleIds).get()).docs.map((d) => d.data()..['id'] = d.id).toList();
            for (final uData in usersSnap) {
              if (uData['is_active'] != false) {
                final uid = uData['id'] as String? ?? uData['uid'] as String? ?? '';
                if (uid.isNotEmpty) roleUids.add(uid);
              }
            }
          }
          final allAssigneeUids = {...explicitUids, ...roleUids};
          for (final uid in allAssigneeUids) {
            memberProgress[uid] = {
              'status': TaskStatus.done.value,
              'updatedAt': DateTime.now().toIso8601String(),
              'completedAt': DateTime.now().toIso8601String(),
              'completionStatus': details.completionStatus,
              'delaySeconds': details.delaySeconds,
            };
          }
          updates['memberProgress'] = memberProgress;
          updates['completedAt'] = DateTime.now().toIso8601String();
          updates['completionStatus'] = details.completionStatus;
          updates['delaySeconds'] = details.delaySeconds;
        } else if (actualStatus == TaskStatus.underReview) {
          updates['completedAt'] = null;
          updates['completionStatus'] = null;
          updates['delaySeconds'] = null;
        } else {
          updates['completedAt'] = null;
          updates['completionStatus'] = null;
          updates['delaySeconds'] = null;
        }
      } else {
        if (actualStatus == TaskStatus.underReview) {
          updates['status'] = TaskStatus.underReview.value;
          updates['completedAt'] = null;
          updates['completionStatus'] = null;
          updates['delaySeconds'] = null;
        } else {
          updates['status'] = TaskStatus.inProgress.value;
          updates['completedAt'] = null;
          updates['completionStatus'] = null;
          updates['delaySeconds'] = null;
        }
      }

      await updateTask(taskId, updates);
      PushSender.instance.task(taskId: taskId, kind: 'status');

      try {
        final title = (data['title'] as String?) ?? 'Task';
        if (actualStatus == TaskStatus.underReview && !canMarkDone) {
          if (createdBy.isNotEmpty && createdBy != userId) {
            await _writeNotif(
              userId: createdBy,
              type: 'task_updated',
              title: 'Verification Required',
              body: '\$userName raised task "\$title" for review.',
              relatedId: taskId,
            );
          }
          if (projectManagerId != null && projectManagerId.isNotEmpty && projectManagerId != userId && projectManagerId != createdBy) {
            await _writeNotif(
              userId: projectManagerId,
              type: 'task_updated',
              title: 'Verification Required',
              body: '\$userName submitted task "\$title" for verification.',
              relatedId: taskId,
            );
          }
        } else if (actualStatus == TaskStatus.done && canMarkDone) {
          final explicitUids = List<String>.from(data['assignee_ids'] ?? []);
          final notifyUids = <String>{...explicitUids, if (createdBy.isNotEmpty) createdBy};
          for (final uid in notifyUids) {
            if (uid == userId) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_updated',
              title: 'Task Verified & Completed',
              body: 'Task "\$title" has been verified and marked as Done by \$userName.',
              relatedId: taskId,
            );
          }
        } else {
          if (createdBy.isNotEmpty && createdBy != userId) {
            await _writeNotif(
              userId: createdBy,
              type: 'task_updated',
              title: 'Task Status Updated',
              body: 'Task "\$title" is now \${actualStatus.label}',
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
      await _supabase.from('tasks').delete().eq('id', taskId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  SubtaskModel _fromSubtask(Map<String, dynamic> data) {
    return SubtaskModel.fromMap(_toCamelCase(data), data['id']);
  }

  Stream<List<SubtaskModel>> watchSubtasks(String taskId) {
    return _supabase.from('subtasks').stream(primaryKey: ['id']).eq('task_id', taskId)
        .map((list) {
          final result = list.map(_fromSubtask).toList();
          result.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
          return result;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> addSubtask(String taskId, SubtaskModel subtask, {String? addedByUid}) async {
    try {
      final data = _toSnakeCase(subtask.toFirestore());
      data['task_id'] = taskId;
      data['id'] = const Uuid().v4();
      await _supabase.from('subtasks').insert(data);

      if (addedByUid != null) {
        try {
          final taskData = await _supabase.from('tasks').select().eq('id', taskId).maybeSingle();
          if (taskData != null) {
            final assigneeIds = List<String>.from(taskData['assignee_ids'] ?? []);
            final title = taskData['title'] as String? ?? 'Task';

            PushSender.instance.task(taskId: taskId, kind: 'subtask_added');

            for (final uid in assigneeIds.toSet()) {
              if (uid == addedByUid) continue;
              await _writeNotif(
                userId: uid,
                type: 'task_updated',
                title: 'New Subtask Added',
                body: 'A subtask "\${subtask.title}" was added to: \$title',
                relatedId: taskId,
              );
            }
          }
        } catch (_) {}
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
      await _supabase.from('subtasks').update({
        'is_done': isDone,
        'done_at': isDone ? DateTime.now().toIso8601String() : null,
        'done_by': isDone ? userId : null,
      }).eq('id', subtaskId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  CommentModel _fromComment(Map<String, dynamic> data) {
    return CommentModel.fromMap(_toCamelCase(data), data['id']);
  }

  Stream<List<CommentModel>> watchComments(String taskId) {
    return _supabase.from('comments').stream(primaryKey: ['id']).eq('task_id', taskId)
        .order('created_at', ascending: true)
        .map((list) => list.map(_fromComment).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> addComment(String taskId, CommentModel comment) async {
    try {
      final data = _toSnakeCase(comment.toFirestore());
      data['task_id'] = taskId;
      data['id'] = const Uuid().v4();
      await _supabase.from('comments').insert(data);

      try {
        final taskData = await _supabase.from('tasks').select().eq('id', taskId).maybeSingle();
        if (taskData != null) {
          final assigneeIds = List<String>.from(taskData['assignee_ids'] ?? []);
          final createdBy = taskData['created_by'] as String? ?? '';
          final title = taskData['title'] as String? ?? 'Task';

          PushSender.instance.task(taskId: taskId, kind: 'comment_added');

          final notifySet = <String>{...assigneeIds, if (createdBy.isNotEmpty) createdBy};
          for (final uid in notifySet) {
            if (uid == comment.authorId || uid.isEmpty) continue;
            await _writeNotif(
              userId: uid,
              type: 'task_updated',
              title: 'New Comment on Task',
              body: 'New comment on "\$title"',
              relatedId: taskId,
            );
          }
        }
      } catch (_) {}
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  TimeLogModel _fromTimeLog(Map<String, dynamic> data) {
    return TimeLogModel.fromMap(_toCamelCase(data), data['id']);
  }

  Stream<List<TimeLogModel>> watchTimeLogs(String taskId) {
    return _supabase.from('time_logs').stream(primaryKey: ['id']).eq('task_id', taskId)
        .order('start_time', ascending: false)
        .map((list) => list.map(_fromTimeLog).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> startTimer(String taskId, TimeLogModel log) async {
    try {
      final data = _toSnakeCase(log.toFirestore());
      data['task_id'] = taskId;
      final result = await FirebaseFirestore.instance.collection('tasks').doc(data['task_id']).collection('timeLogs').add(data); data['id'] = result.id;
      return result.id;
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
      await FirebaseFirestore.instance.collection('tasks').doc(taskId).collection('timeLogs').doc(logId).update({
        'end_time': endTime.toIso8601String(),
        'duration_minutes': durationMinutes,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
