import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:task_pilot/data/services/offline_sync_service.dart';

void main() {
  group('OfflineSyncService — queue operations', () {
    setUp(() {
      // Initialize SharedPreferences with empty values for testing
      SharedPreferences.setMockInitialValues({});
    });

    test('getPendingActions returns empty list when queue is empty', () async {
      final service = OfflineSyncService();
      final pending = await service.getPendingActions();
      expect(pending, isEmpty);
    });

    test('queueAction adds action to the queue', () async {
      final service = OfflineSyncService();

      await service.queueAction({
        'type': SyncActions.createTask,
        'collection': 'tasks',
        'data': {'title': 'Test task'},
      });

      final pending = await service.getPendingActions();
      expect(pending.length, 1);
      expect(pending.first['type'], SyncActions.createTask);
      expect(pending.first['data']['title'], 'Test task');
      expect(pending.first['queuedAt'], isNotNull);
    });

    test('multiple queueAction calls accumulate', () async {
      final service = OfflineSyncService();

      await service.queueAction({
        'type': SyncActions.createTask,
        'collection': 'tasks',
        'data': {'title': 'Task 1'},
      });
      await service.queueAction({
        'type': SyncActions.updateTask,
        'collection': 'tasks',
        'docId': 'task-1',
        'data': {'status': 'done'},
      });

      final pending = await service.getPendingActions();
      expect(pending.length, 2);
      expect(pending[0]['type'], SyncActions.createTask);
      expect(pending[1]['type'], SyncActions.updateTask);
    });

    test('clearQueue removes all pending actions', () async {
      final service = OfflineSyncService();

      await service.queueAction({
        'type': SyncActions.addComment,
        'collection': 'comments',
        'data': {'text': 'Hello'},
      });

      expect((await service.getPendingActions()).length, 1);

      await service.clearQueue();

      expect((await service.getPendingActions()).length, 0);
    });

    test('queueAction adds timestamp', () async {
      final service = OfflineSyncService();
      final before = DateTime.now();

      await service.queueAction({
        'type': SyncActions.toggleSubtask,
        'collection': 'subtasks',
        'data': {'isDone': true},
      });

      final pending = await service.getPendingActions();
      final queuedAt = DateTime.parse(pending.first['queuedAt'] as String);
      final after = DateTime.now();

      expect(
        queuedAt.isAfter(before.subtract(const Duration(seconds: 1))),
        true,
      );
      expect(
        queuedAt.isBefore(after.add(const Duration(seconds: 1))),
        true,
      );
    });
  });

  group('SyncActions constants', () {
    test('action constants have expected values', () {
      expect(SyncActions.createTask, 'create_task');
      expect(SyncActions.updateTask, 'update_task');
      expect(SyncActions.createDiary, 'create_diary');
      expect(SyncActions.addComment, 'add_comment');
      expect(SyncActions.toggleSubtask, 'toggle_subtask');
      expect(SyncActions.updateStatus, 'update_status');
    });
  });

  group('OfflineSyncService — persistence', () {
    test('queue survives service re-instantiation', () async {
      SharedPreferences.setMockInitialValues({});

      final service1 = OfflineSyncService();
      await service1.queueAction({
        'type': SyncActions.createTask,
        'collection': 'tasks',
        'data': {'title': 'Persisted task'},
      });

      // Simulate a new service instance (same SharedPreferences backend)
      final service2 = OfflineSyncService();
      final pending = await service2.getPendingActions();
      expect(pending.length, 1);
      expect(pending.first['data']['title'], 'Persisted task');
    });

    test('handles corrupted queue data gracefully', () async {
      SharedPreferences.setMockInitialValues({
        'offline_queue': 'not-valid-json',
      });

      final service = OfflineSyncService();
      final pending = await service.getPendingActions();
      expect(pending, isEmpty);
    });
  });
}
