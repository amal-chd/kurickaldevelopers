import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/notification_model.dart';
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
  
  if (data['created_at'] != null && data['created_at'] is String) map['createdAt'] = Timestamp.fromDate(DateTime.parse(data['created_at']));
  if (data['read_at'] != null && data['read_at'] is String) map['readAt'] = Timestamp.fromDate(DateTime.parse(data['read_at']));
  
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toUtc().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toUtc().toIso8601String();
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

class NotificationRepository {
  final _supabase = Supabase.instance.client;
  String get _table => 'app_notifications';

  Stream<List<NotificationModel>> watchUserNotifications(String userId, [int attempt = 0]) async* {
    try {
      yield* _supabase.from(_table).stream(primaryKey: ['id']).eq('user_id', userId).order('created_at', ascending: false)
          .map((list) => list.map((data) => NotificationModel.fromMap(_toCamelCase(data), data['id'])).toList());
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<int> watchUnreadCount(String userId) {
    // `is_read` is a jsonb per-user map ({uid: true}); a notification is unread
    // for this user unless their entry is true.
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('user_id', userId)
        .map((list) => list.where((data) {
              final ir = data['is_read'];
              return !(ir is Map && ir[userId] == true);
            }).length)
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> markAsRead(String notificationId, String userId) async {
    try {
      final row = await _supabase
          .from(_table)
          .select('is_read')
          .eq('id', notificationId)
          .maybeSingle();
      final isRead = (row != null && row['is_read'] is Map)
          ? Map<String, dynamic>.from(row['is_read'] as Map)
          : <String, dynamic>{};
      isRead[userId] = true;
      await _supabase.from(_table).update({'is_read': isRead}).eq('id', notificationId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> markAllAsRead(String userId) async {
    try {
      final rows = await _supabase.from(_table).select('id, is_read').eq('user_id', userId);
      for (final row in (rows as List)) {
        final isRead = (row['is_read'] is Map)
            ? Map<String, dynamic>.from(row['is_read'] as Map)
            : <String, dynamic>{};
        if (isRead[userId] == true) continue;
        isRead[userId] = true;
        await _supabase.from(_table).update({'is_read': isRead}).eq('id', row['id']);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    try {
      await _supabase.from(_table).delete().eq('id', notificationId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> createNotification(NotificationModel notification) async {
    try {
      await _supabase.from(_table).insert(_toSnakeCase(notification.toFirestore()));
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
