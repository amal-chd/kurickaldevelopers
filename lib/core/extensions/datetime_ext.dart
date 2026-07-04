import 'package:intl/intl.dart';

extension DateTimeExt on DateTime {
  String get formatted => DateFormat('dd MMM yyyy').format(this);
  String get formattedWithTime =>
      DateFormat('dd MMM yyyy, hh:mm a').format(this);
  String get dayMonth => DateFormat('dd MMM').format(this);
  String get timeOnly => DateFormat('hh:mm a').format(this);

  bool get isToday {
    final now = DateTime.now();
    return year == now.year && month == now.month && day == now.day;
  }

  bool get isTomorrow {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return year == tomorrow.year &&
        month == tomorrow.month &&
        day == tomorrow.day;
  }

  bool get isYesterday {
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    return year == yesterday.year &&
        month == yesterday.month &&
        day == yesterday.day;
  }

  bool get isOverdue => isBefore(DateTime.now()) && !isToday;

  bool get isThisWeek {
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final endOfWeek = startOfWeek.add(const Duration(days: 6));
    return isAfter(startOfWeek.subtract(const Duration(days: 1))) &&
        isBefore(endOfWeek.add(const Duration(days: 1)));
  }

  String get relativeLabel {
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    if (isThisWeek) return 'This week';
    if (isOverdue) return 'Overdue';
    return 'Later';
  }
}
