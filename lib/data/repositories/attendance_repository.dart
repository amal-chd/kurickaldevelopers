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
      return _fromFirestore(snap.docs.first);
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
              : _fromFirestore(s.docs.first),
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
        .map((s) => s.docs.map(_fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ─── Check-in / Check-out ─────────────────────────────────────────────────

  Future<String> checkIn(AttendanceModel record) async {
    // A deterministic per-day document id makes check-in idempotent: a rapid
    // double-tap, or two devices at once, can never create a second attendance
    // record for the same user+project+day. The transaction also decides what a
    // repeat check-in means:
    //   • already checked in & on site → no-op (returns the same record)
    //   • checked out earlier today     → re-open the SAME record (continued
    //     session; keeps the original check-in time, clears the check-out)
    final id = '${record.userId}_${record.projectId}_${record.date}';
    final ref = _attendance.doc(id);
    try {
      await _db.runTransaction((txn) async {
        final snap = await txn.get(ref);
        if (snap.exists) {
          final data = snap.data() as Map<String, dynamic>?;
          if (data != null && data['checkOutTime'] == null) {
            return; // already on site — nothing to do
          }
          txn.update(ref, {
            'checkOutTime': FieldValue.delete(),
            'checkOutLocation': FieldValue.delete(),
            'checkOutAddress': FieldValue.delete(),
            'autoCheckout': FieldValue.delete(),
          });
          return;
        }
        txn.set(ref, record.toFirestore());
      });
      return id;
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

  /// Update attendance fields directly (e.g. check-in/out times, overtime override).
  Future<void> updateAttendance(
    String attendanceId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _attendance.doc(attendanceId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ─── Project "today" feed ─────────────────────────────────────────────────

  Stream<List<AttendanceModel>> watchTodayProjectAttendance(String projectId) {
    final today = AppDateUtils.toYMD(DateTime.now());
    return _attendance
        .where('projectId', isEqualTo: projectId)
        .where('date', isEqualTo: today)
        .snapshots()
        .map((s) => s.docs.map(_fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ─── Internal Auto-Checkout Logic ─────────────────────────────────────────

  AttendanceModel _fromFirestore(DocumentSnapshot doc) {
    final record = AttendanceModel.fromFirestore(doc);
    if (record.checkOutTime == null) {
      final now = DateTime.now();
      final startOfToday = DateTime(now.year, now.month, now.day);
      // Only auto-close a FORGOTTEN check-in from a PREVIOUS day. Today's open
      // sessions are left running so the real check-out time — and any overtime
      // beyond 8h — is preserved. (Auto-closing every record at exactly 8h used
      // to cap everyone at 8h, making overtime impossible to accrue.)
      if (record.checkInTime.isBefore(startOfToday)) {
        final autoOut = record.checkInTime.add(const Duration(hours: 8));
        doc.reference.update({
          'checkOutTime': AppDateUtils.toTimestamp(autoOut),
          'autoCheckout': true,
        }).ignore();
      }
    }
    return record;
  }

  // ─── Admin queries ────────────────────────────────────────────────────────

  /// All staff attendance records for a specific date (any project).
  /// Requires composite Firestore index: date ASC.
  Stream<List<AttendanceModel>> watchAllAttendanceForDate(String date) {
    return _attendance
        .where('date', isEqualTo: date)
        .snapshots()
        .map((s) => s.docs.map(_fromFirestore).toList())
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
          final list = s.docs.map(_fromFirestore).toList();
          list.sort((a, b) => b.date.compareTo(a.date)); // newest first
          return list;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }
}
