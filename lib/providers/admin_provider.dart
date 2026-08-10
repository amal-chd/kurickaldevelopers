import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repositories/admin_repository.dart';

final adminRepositoryProvider = Provider<AdminRepository>(
  (ref) => AdminRepository(),
);

// ── Org Settings ──────────────────────────────────────────────────────────────

final orgSettingsProvider = StreamProvider<OrgSettings>((ref) {
  return ref.watch(adminRepositoryProvider).watchOrgSettings();
});

// ── Task Assignment Config ──────────────────────────────────────────────────

final taskAssignmentConfigProvider = StreamProvider<TaskAssignmentConfig>((ref) {
  return ref.watch(adminRepositoryProvider).watchTaskAssignmentConfig();
});

// ── Audit Logs ────────────────────────────────────────────────────────────────

/// How many audit entries to fetch. Bumped by the "Load more" action so the
/// stream widens without losing its live-update behaviour.
final auditLogLimitProvider = StateProvider<int>((_) => 80);

final auditLogsProvider = StreamProvider<List<AuditLogEntry>>((ref) {
  final limit = ref.watch(auditLogLimitProvider);
  return ref.watch(adminRepositoryProvider).watchAuditLogs(limit: limit);
});

final auditLogsByTypeProvider =
    StreamProvider.family<List<AuditLogEntry>, String>((ref, type) {
      return ref.watch(adminRepositoryProvider).watchAuditLogsByType(type);
    });

// ── Invitations ────────────────────────────────────────────────────────────────

final invitationsProvider = StreamProvider<List<UserInvitation>>((ref) {
  return ref.watch(adminRepositoryProvider).watchInvitations();
});

// ── Admin Stats ───────────────────────────────────────────────────────────────

final adminStatsProvider = StreamProvider<Map<String, int>>((ref) {
  return ref.watch(adminRepositoryProvider).watchAdminStats();
});

// ── Broadcast History ─────────────────────────────────────────────────────────

final broadcastHistoryProvider = StreamProvider<List<Map<String, dynamic>>>((
  ref,
) {
  return ref.watch(adminRepositoryProvider).watchBroadcastHistory();
});
