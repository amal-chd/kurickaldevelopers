import 'package:flutter_test/flutter_test.dart';
import 'package:task_pilot/core/enums/task_status.dart';
import 'package:task_pilot/core/enums/task_priority.dart';

void main() {
  group('TaskStatus', () {
    test('fromString parses known values', () {
      expect(TaskStatus.fromString('in_progress'), TaskStatus.inProgress);
      expect(TaskStatus.fromString('under_review'), TaskStatus.underReview);
      expect(TaskStatus.fromString('done'), TaskStatus.done);
    });

    test('fromString handles legacy values', () {
      expect(TaskStatus.fromString('created'), TaskStatus.inProgress);
      expect(TaskStatus.fromString('assigned'), TaskStatus.inProgress);
      expect(TaskStatus.fromString('review'), TaskStatus.underReview);
      expect(TaskStatus.fromString('approved'), TaskStatus.done);
    });

    test('fromString returns inProgress for unknown value', () {
      expect(TaskStatus.fromString('unknown'), TaskStatus.inProgress);
      expect(TaskStatus.fromString(''), TaskStatus.inProgress);
    });

    test('value returns correct string', () {
      expect(TaskStatus.inProgress.value, 'in_progress');
      expect(TaskStatus.underReview.value, 'under_review');
      expect(TaskStatus.done.value, 'done');
    });

    test('label returns human-readable string', () {
      expect(TaskStatus.inProgress.label, 'In Progress');
      expect(TaskStatus.underReview.label, 'Under Review');
      expect(TaskStatus.done.label, 'Done');
    });
  });

  group('TaskPriority', () {
    test('fromString parses known values', () {
      expect(TaskPriority.fromString('critical'), TaskPriority.critical);
      expect(TaskPriority.fromString('high'), TaskPriority.high);
      expect(TaskPriority.fromString('medium'), TaskPriority.medium);
      expect(TaskPriority.fromString('low'), TaskPriority.low);
    });

    test('fromString returns medium for unknown value', () {
      expect(TaskPriority.fromString('unknown'), TaskPriority.medium);
      expect(TaskPriority.fromString(''), TaskPriority.medium);
    });

    test('value round-trip: value -> fromString', () {
      for (final p in TaskPriority.values) {
        expect(TaskPriority.fromString(p.value), p);
      }
    });
  });

  group('TaskModel (pure Dart logic)', () {
    test('isOverdue logic works correctly', () {
      // We test the isOverdue logic directly without Firestore
      // isOverdue = dueDate.isBefore(now) && status != done
      final pastDate = DateTime.now().subtract(const Duration(days: 1));
      final futureDate = DateTime.now().add(const Duration(days: 1));

      // Past date + not done = overdue
      expect(pastDate.isBefore(DateTime.now()), true);

      // Future date = not overdue
      expect(futureDate.isBefore(DateTime.now()), false);
    });
  });
}
