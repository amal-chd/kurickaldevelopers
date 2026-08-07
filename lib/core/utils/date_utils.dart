import 'package:cloud_firestore/cloud_firestore.dart';

class CompletionDetails {
  final String completionStatus;
  final int delaySeconds;

  const CompletionDetails(this.completionStatus, this.delaySeconds);
}

class AppDateUtils {
  static DateTime? fromTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }

  static Timestamp toTimestamp(DateTime date) => Timestamp.fromDate(date);

  static String toYMD(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  static int daysBetween(DateTime from, DateTime to) {
    final f = DateTime(from.year, from.month, from.day);
    final t = DateTime(to.year, to.month, to.day);
    return t.difference(f).inDays;
  }

  static CompletionDetails calculateCompletionDetails(DateTime completedAt, DateTime? dueDate) {
    if (dueDate == null) {
      return const CompletionDetails('completed', 0);
    }

    final compTime = completedAt.millisecondsSinceEpoch;
    final dueTime = dueDate.millisecondsSinceEpoch;

    final isSameDay = completedAt.year == dueDate.year &&
        completedAt.month == dueDate.month &&
        completedAt.day == dueDate.day;

    final isMidnight = dueDate.hour == 0 && dueDate.minute == 0 && dueDate.second == 0;

    if (isMidnight) {
      final compStart = DateTime(completedAt.year, completedAt.month, completedAt.day);
      final dueStart = DateTime(dueDate.year, dueDate.month, dueDate.day);

      if (compStart.isBefore(dueStart)) {
        return const CompletionDetails('completed', 0);
      } else if (compStart.isAtSameMomentAs(dueStart)) {
        return const CompletionDetails('completed_on_time', 0);
      } else {
        final endOfDueDay = dueDate.add(const Duration(days: 1)).subtract(const Duration(seconds: 1));
        final delayMs = compTime - endOfDueDay.millisecondsSinceEpoch;
        return CompletionDetails('completed_late', delayMs > 0 ? (delayMs ~/ 1000) : 0);
      }
    } else {
      if (completedAt.isAfter(dueDate)) {
        final delayMs = compTime - dueTime;
        return CompletionDetails('completed_late', delayMs > 0 ? (delayMs ~/ 1000) : 0);
      } else {
        if (isSameDay) {
          return const CompletionDetails('completed_on_time', 0);
        } else {
          return const CompletionDetails('completed', 0);
        }
      }
    }
  }

  static String formatDelay(int delaySeconds) {
    if (delaySeconds <= 0) return '';
    final hours = (delaySeconds / 3600).ceil();
    if (hours < 24) {
      return '$hours hour${hours == 1 ? '' : 's'} late';
    }
    final days = (delaySeconds / (24 * 3600)).ceil();
    return '$days day${days == 1 ? '' : 's'} late';
  }
}
