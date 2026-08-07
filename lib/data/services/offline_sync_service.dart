import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:async';

import '../../core/utils/date_utils.dart';

/// Typed action constants for the offline queue.
class SyncActions {
  static const createTask = 'create_task';
  static const updateTask = 'update_task';
  static const createDiary = 'create_diary';
  static const addComment = 'add_comment';
  static const toggleSubtask = 'toggle_subtask';
  static const updateStatus = 'update_status';
}

class OfflineSyncService {
  static const _queueKey = 'offline_queue';

  final _connectivity = Connectivity();

  /// Lazy — only accessed when actually syncing, not at construction time.
  FirebaseFirestore get _db => FirebaseFirestore.instance;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  Stream<bool> get isOnline => _connectivity.onConnectivityChanged.map(
    (results) => !results.contains(ConnectivityResult.none),
  );

  Future<bool> get currentlyOnline async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  // ── Queue Management ─────────────────────────────────────────────────────

  /// Enqueue a write action for later sync.
  ///
  /// [action] should include:
  /// - `type`: one of [SyncActions] constants
  /// - `collection`: Firestore collection path
  /// - `docId`: (optional) document ID for updates
  /// - `data`: the payload map
  /// - `queuedAt`: ISO8601 timestamp
  Future<void> queueAction(Map<String, dynamic> action) async {
    action['queuedAt'] = DateTime.now().toIso8601String();
    final prefs = await SharedPreferences.getInstance();
    final queue = _getQueue(prefs);
    queue.add(action);
    await prefs.setString(_queueKey, jsonEncode(queue));
  }

  Future<List<Map<String, dynamic>>> getPendingActions() async {
    final prefs = await SharedPreferences.getInstance();
    return _getQueue(prefs);
  }

  Future<void> clearQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_queueKey);
  }

  List<Map<String, dynamic>> _getQueue(SharedPreferences prefs) {
    final raw = prefs.getString(_queueKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  // ── Auto-Sync on Reconnect ───────────────────────────────────────────────

  /// Start listening for connectivity changes and auto-flush when online.
  void startAutoSync() {
    _connectivitySub?.cancel();
    _connectivitySub = _connectivity.onConnectivityChanged.listen((
      results,
    ) async {
      if (!results.contains(ConnectivityResult.none)) {
        await syncPendingActions();
      }
    });
  }

  /// Stop listening for connectivity changes.
  void stopAutoSync() {
    _connectivitySub?.cancel();
    _connectivitySub = null;
  }

  /// Replay all queued write operations against Firestore.
  ///
  /// Actions are processed in FIFO order. Successfully synced actions are
  /// removed from the queue; failed ones remain for the next attempt.
  Future<int> syncPendingActions() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = _getQueue(prefs);
    if (queue.isEmpty) return 0;

    final failed = <Map<String, dynamic>>[];
    int synced = 0;

    for (final action in queue) {
      try {
        await _replayAction(action);
        synced++;
      } catch (_) {
        // Keep failed actions in the queue for retry
        failed.add(action);
      }
    }

    // Persist only failed actions
    if (failed.isEmpty) {
      await prefs.remove(_queueKey);
    } else {
      await prefs.setString(_queueKey, jsonEncode(failed));
    }

    return synced;
  }

  /// Execute a single queued action against Firestore.
  Future<void> _replayAction(Map<String, dynamic> action) async {
    final type = action['type'] as String?;
    final collection = action['collection'] as String?;
    final docId = action['docId'] as String?;
    final data = Map<String, dynamic>.from(action['data'] ?? {});

    if (collection == null || collection.isEmpty) return;

    switch (type) {
      case SyncActions.createTask:
      case SyncActions.createDiary:
      case SyncActions.addComment:
        await _db.collection(collection).add(data);
        break;

      case SyncActions.updateTask:
      case SyncActions.updateStatus:
      case SyncActions.toggleSubtask:
        if (docId != null && docId.isNotEmpty) {
          data['updatedAt'] = AppDateUtils.toTimestamp(DateTime.now());
          await _db.collection(collection).doc(docId).update(data);
        }
        break;

      default:
        // Unknown action type — skip silently
        break;
    }
  }
}
