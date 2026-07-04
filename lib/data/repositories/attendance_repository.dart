import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/attendance_model.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';

class AttendanceRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _attendance => _db.collection('attendance');

  // ─── Personal queries ─────────────────────────────────────────────────────

  Future<AttendanceModel?> getTodayAttendance(
    String userId,
    String projectId,
  ) async {
    try {
      final today = AppDateUtils.toYMD(DateTime.now());
      final snap = await _attendance
          .where('userId', isEqualTo: userId)
          .where('projectId', isEqualTo: projectId)
          .where('date', isEqualTo: today)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return null;
      return AttendanceModel.fromFirestore(snap.docs.first);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<AttendanceModel?> watchTodayAttendance(
    String userId,
    String projectId,
  ) {
    final today = AppDateUtils.toYMD(DateTime.now());
    return _attendance
        .where('userId', isEqualTo: userId)
        .where('projectId', isEqualTo: projectId)
        .where('date', isEqualTo: today)
        .limit(1)
        .snapshots()
        .map(
          (s) => s.docs.isEmpty
              ? null
              : AttendanceModel.fromFirestore(s.docs.first),
        )
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<AttendanceModel>> watchMonthAttendance(
    String userId,
    String month,
  ) {
    return _attendance
        .where('userId', isEqualTo: userId)
        .where('date', isGreaterThanOrEqualTo: '$month-01')
        .where('date', isLessThanOrEqualTo: '$month-31')
        .snapshots()
        .map((s) => s.docs.map(AttendanceModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ─── Check-in / Check-out ─────────────────────────────────────────────────

  Future<String> checkIn(AttendanceModel record) async {
    try {
      final doc = await _attendance.add(record.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> checkOut(
    String attendanceId,
    GeoPoint location,
    DateTime time,
  ) async {
    try {
      await _attendance.doc(attendanceId).update({
        'checkOutTime': AppDateUtils.toTimestamp(time),
        'checkOutLocation': location,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ─── Address patch (called asynchronously after GPS + reverse-geocode) ────

  Future<void> updateCheckInAddress(String attendanceId, String address) async {
    try {
      await _attendance.doc(attendanceId).update({'checkInAddress': address});
    } catch (_) {} // best-effort; ignore if record was deleted
  }

  Future<void> updateCheckOutAddress(
    String attendanceId,
    String address,
  ) async {
    try {
      await _attendance.doc(attendanceId).update({'checkOutAddress': address});
    } catch (_) {}
  }

  // ─── Project "today" feed ─────────────────────────────────────────────────

  Stream<List<AttendanceModel>> watchTodayProjectAttendance(String projectId) {
    final today = AppDateUtils.toYMD(DateTime.now());
    return _attendance
        .where('projectId', isEqualTo: projectId)
        .where('date', isEqualTo: today)
        .snapshots()
        .map((s) => s.docs.map(AttendanceModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ─── Admin queries ────────────────────────────────────────────────────────

  /// All staff attendance records for a specific date (any project).
  /// Requires composite Firestore index: date ASC.
  Stream<List<AttendanceModel>> watchAllAttendanceForDate(String date) {
    return _attendance
        .where('date', isEqualTo: date)
        .snapshots()
        .map((s) => s.docs.map(AttendanceModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  /// A specific user's attendance records between two date strings (inclusive).
  /// Requires composite Firestore index: userId + date.
  Stream<List<AttendanceModel>> watchUserAttendanceRange(
    String userId,
    String startDate, // "yyyy-MM-dd"
    String endDate, // "yyyy-MM-dd"
  ) {
    return _attendance
        .where('userId', isEqualTo: userId)
        .where('date', isGreaterThanOrEqualTo: startDate)
        .where('date', isLessThanOrEqualTo: endDate)
        .snapshots()
        .map((s) {
          final list = s.docs.map(AttendanceModel.fromFirestore).toList();
          list.sort((a, b) => b.date.compareTo(a.date)); // newest first
          return list;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }
}
