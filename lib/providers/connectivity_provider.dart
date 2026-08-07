import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/services/offline_sync_service.dart';

/// Singleton instance — shared across all providers so the queue is consistent.
final offlineSyncServiceProvider = Provider<OfflineSyncService>(
  (ref) => OfflineSyncService(),
);

/// Stream of connectivity changes.
final connectivityStreamProvider =
    StreamProvider<List<ConnectivityResult>>((ref) {
  return Connectivity().onConnectivityChanged;
});

/// Whether the device currently has network access.
final isOnlineProvider = Provider<bool>((ref) {
  final connectivity = ref.watch(connectivityStreamProvider);
  return connectivity.when(
    data: (results) => !results.contains(ConnectivityResult.none),
    loading: () => true, // assume online until proven otherwise
    error: (_, __) => true,
  );
});

/// Number of queued offline write actions waiting to be synced.
final pendingSyncCountProvider = FutureProvider<int>((ref) async {
  // Re-evaluate whenever connectivity changes
  ref.watch(connectivityStreamProvider);
  final service = ref.read(offlineSyncServiceProvider);
  final pending = await service.getPendingActions();
  return pending.length;
});
