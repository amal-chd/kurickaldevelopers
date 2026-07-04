import 'package:flutter_test/flutter_test.dart';
import 'package:task_pilot/data/models/notification_model.dart';

void main() {
  group('NotificationType', () {
    test('value returns correct snake_case string', () {
      expect(NotificationType.taskAssigned.value, 'task_assigned');
      expect(NotificationType.taskDue.value, 'task_due');
      expect(NotificationType.taskOverdue.value, 'task_overdue');
      expect(NotificationType.approvalNeeded.value, 'approval_needed');
      expect(NotificationType.mention.value, 'mention');
      expect(NotificationType.slaBreach.value, 'sla_breach');
      expect(NotificationType.dailyDigest.value, 'daily_digest');
      expect(NotificationType.chatMessage.value, 'chat_message');
      expect(NotificationType.projectUpdate.value, 'project_update');
      expect(NotificationType.diaryEntry.value, 'diary_entry');
      expect(NotificationType.documentUploaded.value, 'document_uploaded');
    });

    test('fromString parses all known types', () {
      expect(
        NotificationTypeX.fromString('task_assigned'),
        NotificationType.taskAssigned,
      );
      expect(
        NotificationTypeX.fromString('chat_message'),
        NotificationType.chatMessage,
      );
      expect(
        NotificationTypeX.fromString('project_update'),
        NotificationType.projectUpdate,
      );
      expect(
        NotificationTypeX.fromString('diary_entry'),
        NotificationType.diaryEntry,
      );
      expect(
        NotificationTypeX.fromString('document_uploaded'),
        NotificationType.documentUploaded,
      );
    });

    test('fromString returns taskAssigned for unknown type', () {
      expect(
        NotificationTypeX.fromString('unknown_type'),
        NotificationType.taskAssigned,
      );
      expect(
        NotificationTypeX.fromString(''),
        NotificationType.taskAssigned,
      );
    });

    test('round-trip: value -> fromString preserves type', () {
      for (final type in NotificationType.values) {
        expect(NotificationTypeX.fromString(type.value), type);
      }
    });
  });

  group('NotificationModel', () {
    test('constructor creates model with correct values', () {
      final now = DateTime.now();
      final model = NotificationModel(
        id: 'test-id',
        userId: 'user-1',
        type: NotificationType.chatMessage,
        title: 'New message',
        body: 'Hello world',
        relatedId: 'channel-1',
        relatedType: 'chat',
        isRead: false,
        createdAt: now,
      );

      expect(model.id, 'test-id');
      expect(model.userId, 'user-1');
      expect(model.type, NotificationType.chatMessage);
      expect(model.title, 'New message');
      expect(model.body, 'Hello world');
      expect(model.relatedId, 'channel-1');
      expect(model.relatedType, 'chat');
      expect(model.isRead, false);
      expect(model.createdAt, now);
    });

    test('isRead defaults to false', () {
      final model = NotificationModel(
        id: 'x',
        userId: 'u',
        type: NotificationType.taskAssigned,
        title: '',
        body: '',
        relatedId: '',
        relatedType: '',
        createdAt: DateTime.now(),
      );

      expect(model.isRead, false);
    });

    test('toFirestore produces correct map', () {
      final now = DateTime(2024, 6, 15, 10, 30);
      final model = NotificationModel(
        id: 'notif-1',
        userId: 'user-abc',
        type: NotificationType.projectUpdate,
        title: 'Project updated',
        body: 'The project was updated',
        relatedId: 'proj-1',
        relatedType: 'project',
        isRead: true,
        createdAt: now,
      );

      final map = model.toFirestore();

      expect(map['userId'], 'user-abc');
      expect(map['type'], 'project_update');
      expect(map['title'], 'Project updated');
      expect(map['body'], 'The project was updated');
      expect(map['relatedId'], 'proj-1');
      expect(map['relatedType'], 'project');
      // New notifications are unread by everyone → isRead is an empty map.
      expect(map['isRead'], isA<Map>());
      // createdAt should be serialized (non-null)
      expect(map['createdAt'], isNotNull);
    });
  });
}
