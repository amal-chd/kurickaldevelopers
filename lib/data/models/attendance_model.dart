import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class AttendanceModel {
  final String id;
  final String userId;
  final String projectId;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final GeoPoint checkInLocation;
  final GeoPoint? checkOutLocation;

  /// Reverse-geocoded address fetched asynchronously after check-in.
  final String? checkInAddress;

  /// Reverse-geocoded address fetched asynchronously after check-out.
  final String? checkOutAddress;
  final bool isWithinGeofence;

  /// ISO date string: "yyyy-MM-dd" — used for range queries in Firestore.
  final String date;

  /// Optional manual override for overtime minutes set by an admin.
  final int? overtimeOverrideMinutes;

  const AttendanceModel({
    required this.id,
    required this.userId,
    required this.projectId,
    required this.checkInTime,
    this.checkOutTime,
    required this.checkInLocation,
    this.checkOutLocation,
    this.checkInAddress,
    this.checkOutAddress,
    required this.isWithinGeofence,
    required this.date,
    this.overtimeOverrideMinutes,
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  bool get isOnSite => checkOutTime == null;

  /// Total logged minutes (0 if still on site).
  int get durationMinutes {
    if (checkOutTime == null) return 0;
    return checkOutTime!.difference(checkInTime).inMinutes;
  }

  /// E.g. "8h 30m" or "45m" or "—" when still on site.
  String get durationFormatted {
    final total = durationMinutes;
    if (total == 0) return isOnSite ? '—' : '< 1m';
    final h = total ~/ 60;
    final m = total % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  /// Returns minutes worked beyond 8 hours (480 minutes), or manual override if set. Returns 0 if under 8 hours.
  int get overtimeMinutes {
    if (overtimeOverrideMinutes != null) {
      return overtimeOverrideMinutes!;
    }
    final total = durationMinutes;
    const standardMinutes = 480; // 8 hours
    if (total > standardMinutes) {
      return total - standardMinutes;
    }
    return 0;
  }

  /// Formatted overtime string, e.g. "1h 30m". Returns empty string if no overtime.
  String get overtimeFormatted {
    final ot = overtimeMinutes;
    if (ot == 0) return '';
    final h = ot ~/ 60;
    final m = ot % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  // ── Firestore ─────────────────────────────────────────────────────────────

  factory AttendanceModel.fromMap(Map<String, dynamic> data, String id) {
    
    return AttendanceModel(
      id: id,
      userId: data['userId'] ?? '',
      projectId: data['projectId'] ?? '',
      checkInTime:
          AppDateUtils.fromTimestamp(data['checkInTime']) ?? DateTime.now(),
      checkOutTime: AppDateUtils.fromTimestamp(data['checkOutTime']),
      checkInLocation: data['checkInLocation'] as GeoPoint,
      checkOutLocation: data['checkOutLocation'] as GeoPoint?,
      checkInAddress: data['checkInAddress'] as String?,
      checkOutAddress: data['checkOutAddress'] as String?,
      isWithinGeofence: data['isWithinGeofence'] ?? true,
      date: data['date'] ?? '',
      overtimeOverrideMinutes: data['overtimeOverrideMinutes'] as int?,
    );
  }

  Map<String, dynamic> toFirestore() => {
    'userId': userId,
    'projectId': projectId,
    'checkInTime': AppDateUtils.toTimestamp(checkInTime),
    'checkOutTime': checkOutTime != null
        ? AppDateUtils.toTimestamp(checkOutTime!)
        : null,
    'checkInLocation': checkInLocation,
    'checkOutLocation': checkOutLocation,
    'checkInAddress': checkInAddress,
    'checkOutAddress': checkOutAddress,
    'isWithinGeofence': isWithinGeofence,
    'date': date,
    if (overtimeOverrideMinutes != null)
      'overtimeOverrideMinutes': overtimeOverrideMinutes,
  };
}
