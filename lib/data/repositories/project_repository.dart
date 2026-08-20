import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/project_model.dart';
import '../models/milestone_model.dart';
import '../../core/utils/error_translator.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp;


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
  
  // Specific date conversions
  if (data['created_at'] != null) map['createdAt'] = Timestamp.fromDate(DateTime.parse(data['created_at']));
  if (data['updated_at'] != null) map['updatedAt'] = Timestamp.fromDate(DateTime.parse(data['updated_at']));
  if (data['due_date'] != null) map['dueDate'] = Timestamp.fromDate(DateTime.parse(data['due_date']));
  
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

class ProjectRepository {
  final _supabase = Supabase.instance.client;
  String get _projects => 'projects';
  String get _milestones => 'milestones';

  Stream<List<ProjectModel>> watchUserProjects(List<String> projectIds) {
    if (projectIds.isEmpty) return Stream.value([]);
    return _supabase.from(_projects).stream(primaryKey: ['id']).inFilter('id', projectIds)
        .map((list) => list.map((data) => ProjectModel.fromMap(_toCamelCase(data), data['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<ProjectModel>> watchMyProjects(String uid, [int attempt = 0]) async* {
    try {
      yield* _supabase.from(_projects).stream(primaryKey: ['id'])
          .map((list) {
            final models = list
                .where((data) => (data['member_ids'] as List<dynamic>?)?.contains(uid) ?? false)
                .map((data) => ProjectModel.fromMap(_toCamelCase(data), data['id']))
                .toList();
            models.sort((x, y) => y.createdAt.compareTo(x.createdAt));
            return models;
          });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<ProjectModel>> watchAllProjects([int attempt = 0]) async* {
    try {
      yield* _supabase.from(_projects).stream(primaryKey: ['id']).order('created_at', ascending: false)
          .map((list) => list.map((data) => ProjectModel.fromMap(_toCamelCase(data), data['id'])).toList());
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<ProjectModel?> watchProject(String projectId, [int attempt = 0]) async* {
    try {
      yield* _supabase.from(_projects).stream(primaryKey: ['id']).eq('id', projectId).map((list) {
        if (list.isEmpty) return null;
        return ProjectModel.fromMap(_toCamelCase(list.first), list.first['id']);
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<ProjectModel?> getProject(String projectId) async {
    try {
      final data = await _supabase.from(_projects).select().eq('id', projectId).maybeSingle();
      if (data == null) return null;
      return ProjectModel.fromMap(_toCamelCase(data), data['id']);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createProject(ProjectModel project) async {
    try {
      final data = await _supabase.from(_projects).insert(_toSnakeCase(project.toFirestore())).select('id').single();
      return data['id'];
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateProject(String projectId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_projects).update(_toSnakeCase(data)).eq('id', projectId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<MilestoneModel>> watchMilestones(String projectId) {
    return _supabase.from(_milestones).stream(primaryKey: ['id']).eq('project_id', projectId).order('due_date')
        .map((list) => list.map((data) => MilestoneModel.fromMap(_toCamelCase(data), data['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createMilestone(String projectId, MilestoneModel milestone) async {
    try {
      var map = _toSnakeCase(milestone.toFirestore());
      map['project_id'] = projectId;
      final data = await _supabase.from(_milestones).insert(map).select('id').single();
      return data['id'];
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateMilestone(String projectId, String milestoneId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_milestones).update(_toSnakeCase(data)).eq('id', milestoneId).eq('project_id', projectId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteProject(String projectId) async {
    try {
      try {
        await _supabase.from(_milestones).delete().eq('project_id', projectId);
      } catch (_) {}
      await _supabase.from(_projects).delete().eq('id', projectId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
