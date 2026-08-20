import 'package:uuid/uuid.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/document_model.dart';
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
  
  if (data['uploaded_at'] != null && data['uploaded_at'] is String) map['uploadedAt'] = Timestamp.fromDate(DateTime.parse(data['uploaded_at']));
  if (data['created_at'] != null && data['created_at'] is String) map['createdAt'] = Timestamp.fromDate(DateTime.parse(data['created_at']));
  
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    
    if (key == 'fileUrl') {
      map['url'] = value;
      return;
    }
    if (key == 'fileSize') {
      map['size'] = value;
      return;
    }
    if (key == 'tags') {
      map['labels'] = value;
      return;
    }
    if (['taskId', 'mimeType', 'version', 'previousVersionIds'].contains(key)) return;

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

class DocumentRepository {
  final _supabase = Supabase.instance.client;
  String get _table => 'documents';

  Stream<List<DocumentModel>> watchProjectDocuments(String projectId) {
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('project_id', projectId).order('uploaded_at', ascending: false)
        .map((list) => list.map((data) => DocumentModel.fromMap(_toCamelCase(data), data['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<DocumentModel?> getDocument(String documentId) async {
    try {
      final data = await _supabase.from(_table).select().eq('id', documentId).maybeSingle();
      if (data == null) return null;
      return DocumentModel.fromMap(_toCamelCase(data), data['id']);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<DocumentModel?> watchDocument(String documentId) {
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('id', documentId)
        .map((list) => list.isEmpty ? null : DocumentModel.fromMap(_toCamelCase(list.first), list.first['id']))
        .handleError((e) => throw ErrorTranslator.translate(e));
  }


  Future<String> createDocument(DocumentModel document) async {
    try {
      var map = _toSnakeCase(document.toFirestore()); map['id'] = const Uuid().v4(); final data = await _supabase.from(_table).insert(map).select('id').single();
      return data['id'];
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateDocument(String documentId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_table).update(_toSnakeCase(data)).eq('id', documentId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteDocument(String documentId) async {
    try {
      await _supabase.from(_table).delete().eq('id', documentId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<List<DocumentModel>> getDocumentsForTask(String taskId) async {
    try {
      final data = await _supabase.from(_table).select().eq('task_id', taskId);
      return data.map((d) => DocumentModel.fromMap(_toCamelCase(d), d['id'])).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
