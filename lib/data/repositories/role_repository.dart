import 'package:uuid/uuid.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/role_model.dart';
import '../../core/utils/error_translator.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp;


class RoleRepository {
  final _supabase = Supabase.instance.client;
  String get _table => 'roles';

  Map<String, dynamic> _toCamelCase(Map<String, dynamic> data) {
    final map = <String, dynamic>{};
    data.forEach((key, value) {
      if (key == 'is_system') map['isSystem'] = value;
      else if (key == 'created_by') map['createdBy'] = value;
      else if (key == 'created_at') {
        map['createdAt'] = value != null ? Timestamp.fromDate(DateTime.parse(value)) : null;
      }
      else map[key] = value;
    });
    return map;
  }

  Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
    final map = <String, dynamic>{};
    data.forEach((key, value) {
      if (key == 'isSystem') map['is_system'] = value;
      else if (key == 'createdBy') map['created_by'] = value;
      else if (key == 'createdAt') {
        if (value is Timestamp) {
          map['created_at'] = value.toDate().toUtc().toIso8601String();
        } else if (value is DateTime) {
          map['created_at'] = value.toUtc().toIso8601String();
        }
      }
      else map[key] = value;
    });
    return map;
  }

  Stream<List<RoleModel>> watchAllRoles([int attempt = 0]) async* {
    try {
      yield* _supabase.from(_table).stream(primaryKey: ['id']).map((list) {
        return list.map((data) {
          return RoleModel.fromMap(_toCamelCase(data), data['id']);
        }).toList();
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<RoleModel?> watchRole(String roleId, [int attempt = 0]) async* {
    try {
      yield* _supabase.from(_table).stream(primaryKey: ['id']).eq('id', roleId).map((list) {
        if (list.isEmpty) return null;
        final data = list.first;
        return RoleModel.fromMap(_toCamelCase(data), data['id']);
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<RoleModel?> getRole(String roleId) async {
    try {
      final data = await _supabase.from(_table).select().eq('id', roleId).maybeSingle();
      if (data == null) return null;
      return RoleModel.fromMap(_toCamelCase(data), data['id']);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createRole(RoleModel role) async {
    try {
      var data = role.toFirestore();
      data = _toSnakeCase(data);
      // Supabase auto-generates uuid usually, but if we need to return it:
      data['id'] = const Uuid().v4(); final result = await _supabase.from(_table).insert(data).select('id').single();
      return result['id'] as String;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateRole(String roleId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_table).update(_toSnakeCase(data)).eq('id', roleId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteRole(String roleId) async {
    try {
      await _supabase.from(_table).delete().eq('id', roleId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
