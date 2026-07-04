import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/attendance_model.dart';
import '../data/repositories/attendance_repository.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>(
  (ref) => AttendanceRepository(),
);

// ─── Personal providers ───────────────────────────────────────────────────────

final todayAttendanceProvider =
    StreamProvider.family<
      AttendanceModel?,
      ({String userId, String projectId})
    >((ref, arg) {
      return ref
          .watch(attendanceRepositoryProvider)
          .watchTodayAttendance(arg.userId, arg.projectId);
    });

final todayProjectAttendanceProvider =
    StreamProvider.family<List<AttendanceModel>, String>((ref, projectId) {
      return ref
          .watch(attendanceRepositoryProvider)
          .watchTodayProjectAttendance(projectId);
    });

final userMonthAttendanceProvider =
    StreamProvider.family<
      List<AttendanceModel>,
      ({String userId, String month})
    >((ref, arg) {
      return ref
          .watch(attendanceRepositoryProvider)
          .watchMonthAttendance(arg.userId, arg.month);
    });

// ─── Admin providers ──────────────────────────────────────────────────────────

/// All staff attendance for a specific date ("yyyy-MM-dd").
/// Used by admin/director attendance dashboard.
final allAttendanceDateProvider =
    StreamProvider.family<List<AttendanceModel>, String>((ref, date) {
      return ref
          .watch(attendanceRepositoryProvider)
          .watchAllAttendanceForDate(date);
    });

/// A user's attendance records for a date range (admin drill-down).
final userAttendanceRangeProvider =
    StreamProvider.family<
      List<AttendanceModel>,
      ({String userId, String startDate, String endDate})
    >((ref, arg) {
      return ref
          .watch(attendanceRepositoryProvider)
          .watchUserAttendanceRange(arg.userId, arg.startDate, arg.endDate);
    });
