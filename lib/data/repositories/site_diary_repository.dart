import 'package:uuid/uuid.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/site_diary_model.dart';
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
  
  if (data['date'] != null && data['date'] is String) map['date'] = Timestamp.fromDate(DateTime.parse(data['date']));
  if (data['created_at'] != null && data['created_at'] is String) map['createdAt'] = Timestamp.fromDate(DateTime.parse(data['created_at']));
  if (data['updated_at'] != null && data['updated_at'] is String) map['updatedAt'] = Timestamp.fromDate(DateTime.parse(data['updated_at']));
  
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    
    if (key == 'weather') return;

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

class SiteDiaryRepository {
  final _supabase = Supabase.instance.client;
  String get _table => 'site_diaries';

  Stream<List<SiteDiaryModel>> watchProjectDiaries(String projectId) {
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('project_id', projectId).order('date', ascending: false)
        .map((list) => list.map((data) => SiteDiaryModel.fromMap(_toCamelCase(data), data['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<SiteDiaryModel?> getDiaryForDate(String projectId, DateTime date) async {
    try {
      final startOfDay = DateTime(date.year, date.month, date.day).toIso8601String();
      final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59).toIso8601String();

      final data = await _supabase.from(_table).select()
          .eq('project_id', projectId)
          .gte('date', startOfDay)
          .lte('date', endOfDay)
          .maybeSingle();
      if (data == null) return null;
      return SiteDiaryModel.fromMap(_toCamelCase(data), data['id']);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createDiary(SiteDiaryModel diary) async {
    try {
      var map = _toSnakeCase(diary.toFirestore()); map['id'] = const Uuid().v4(); final data = await _supabase.from(_table).insert(map).select('id').single();
      return data['id'];
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateDiary(String diaryId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_table).update(_toSnakeCase(data)).eq('id', diaryId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteDiary(String diaryId) async {
    try {
      await _supabase.from(_table).delete().eq('id', diaryId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
