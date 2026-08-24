import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/attendance_model.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp, GeoPoint;


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

  if (data['check_in_time'] != null) map['checkInTime'] = Timestamp.fromDate(DateTime.parse(data['check_in_time']));
  if (data['check_out_time'] != null) map['checkOutTime'] = Timestamp.fromDate(DateTime.parse(data['check_out_time']));
  
  // Reconstruct GeoPoint from lat/lng columns
  if (data['check_in_lat'] != null && data['check_in_lng'] != null) {
    map['checkInLocation'] = GeoPoint((data['check_in_lat'] as num).toDouble(), (data['check_in_lng'] as num).toDouble());
  } else if (data['check_in_location'] is Map) {
    map['checkInLocation'] = GeoPoint((data['check_in_location']['lat'] as num).toDouble(), (data['check_in_location']['lng'] as num).toDouble());
  } else {
    map['checkInLocation'] = const GeoPoint(0, 0); // Safe fallback
  }

  if (data['check_out_lat'] != null && data['check_out_lng'] != null) {
    map['checkOutLocation'] = GeoPoint((data['check_out_lat'] as num).toDouble(), (data['check_out_lng'] as num).toDouble());
  } else if (data['check_out_location'] is Map) {
    map['checkOutLocation'] = GeoPoint((data['check_out_location']['lat'] as num).toDouble(), (data['check_out_location']['lng'] as num).toDouble());
  }

  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (value == null) {
      // Location fields map to lat/lng columns — never emit the non-existent
      // check_in_location / check_out_location columns (caused PGRST204).
      if (key == 'checkInLocation') { map['check_in_lat'] = null; map['check_in_lng'] = null; return; }
      if (key == 'checkOutLocation') { map['check_out_lat'] = null; map['check_out_lng'] = null; return; }
      map[key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase())] = null;
      return;
    }

    if (key == 'checkInLocation') {
      map['check_in_lat'] = (value as dynamic).latitude;
      map['check_in_lng'] = (value as dynamic).longitude;
      return;
    }
    if (key == 'checkOutLocation') {
      map['check_out_lat'] = (value as dynamic).latitude;
      map['check_out_lng'] = (value as dynamic).longitude;
      return;
    }

    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else if (value is GeoPoint) {
      // Should not hit here if we intercepted checkInLocation above, but just in case
      map[snakeKey + '_lat'] = value.latitude;
      map[snakeKey + '_lng'] = value.longitude;
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

class AttendanceRepository {
  final _supabase = Supabase.instance.client;
  String get _table => 'attendance';

  Future<AttendanceModel?> getTodayAttendance(String userId, String projectId) async {
    try {
      final today = AppDateUtils.toYMD(DateTime.now());
      final data = await _supabase.from(_table).select()
          .eq('user_id', userId)
          .eq('project_id', projectId)
          .eq('date', today)
          .limit(1)
          .maybeSingle();
      if (data == null) return null;
      return _fromSupabase(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<AttendanceModel?> watchTodayAttendance(String userId, String projectId) {
    final today = AppDateUtils.toYMD(DateTime.now());
    return _supabase.from(_table).stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((list) {
          final filtered = list.where((data) => data['project_id'] == projectId && data['date'] == today);
          return filtered.isEmpty ? null : _fromSupabase(filtered.first);
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<AttendanceModel>> watchMonthAttendance(String userId, String month) {
    return _supabase.from(_table).stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((list) => list.where((data) {
          final d = data['date'] as String;
          return d.compareTo('$month-01') >= 0 && d.compareTo('$month-31') <= 0;
        }).map(_fromSupabase).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> checkIn(AttendanceModel record) async {
    final id = '${record.userId}_${record.projectId}_${record.date}';
    try {
      final existing = await _supabase.from(_table).select().eq('id', id).maybeSingle();
      if (existing != null) {
        if (existing['check_out_time'] == null) return id;
        await _supabase.from(_table).update({
          'check_out_time': null,
          'check_out_lat': null,
          'check_out_lng': null,
          'check_out_address': null,
          
        }).eq('id', id);
        return id;
      }
      
      var data = _toSnakeCase(record.toFirestore());
      data['id'] = id;
      await _supabase.from(_table).insert(data);
      return id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> checkOut(String attendanceId, GeoPoint location, DateTime time) async {
    try {
      await _supabase.from(_table).update({
        'check_out_time': time.toIso8601String(),
        'check_out_lat': location.latitude, 'check_out_lng': location.longitude,
      }).eq('id', attendanceId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateCheckInAddress(String attendanceId, String address) async {
    try {
      await _supabase.from(_table).update({'check_in_address': address}).eq('id', attendanceId);
    } catch (_) {}
  }

  Future<void> updateCheckOutAddress(String attendanceId, String address) async {
    try {
      await _supabase.from(_table).update({'check_out_address': address}).eq('id', attendanceId);
    } catch (_) {}
  }

  Future<void> updateAttendance(String attendanceId, Map<String, dynamic> data) async {
    try {
      await _supabase.from(_table).update(_toSnakeCase(data)).eq('id', attendanceId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<AttendanceModel>> watchTodayProjectAttendance(String projectId) {
    final today = AppDateUtils.toYMD(DateTime.now());
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('project_id', projectId)
        .map((list) => list.where((data) => data['date'] == today).map(_fromSupabase).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  AttendanceModel _fromSupabase(Map<String, dynamic> data) {
    final record = AttendanceModel.fromMap(_toCamelCase(data), data['id']);
    if (record.checkOutTime == null) {
      final now = DateTime.now();
      final startOfToday = DateTime(now.year, now.month, now.day);
      if (record.checkInTime.isBefore(startOfToday)) {
        final autoOut = record.checkInTime.add(const Duration(hours: 8));
        _supabase.from(_table).update({
          'check_out_time': autoOut.toIso8601String(),
          
        }).eq('id', data['id']).then((_) {});
      }
    }
    return record;
  }

  Stream<List<AttendanceModel>> watchAllAttendanceForDate(String date) {
    return _supabase.from(_table).stream(primaryKey: ['id']).eq('date', date)
        .map((list) => list.map(_fromSupabase).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<AttendanceModel>> watchUserAttendanceRange(String userId, String startDate, String endDate) {
    return _supabase.from(_table).stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .map((list) {
          final filtered = list.where((data) {
            final d = data['date'] as String;
            return d.compareTo(startDate) >= 0 && d.compareTo(endDate) <= 0;
          });
          final models = filtered.map(_fromSupabase).toList();
          models.sort((a, b) => b.checkInTime.compareTo(a.checkInTime));
          return models;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }
}
