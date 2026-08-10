import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/user_provider.dart';

/// ─────────────────────────────────────────────────────────────────────────────
///  Audit logging — a Discord-style, best-effort activity trail.
///
///  Every meaningful mutation in the app funnels through [AuditService.log].
///  Writes are FIRE-AND-FORGET: a failed audit write must NEVER surface as a
///  failure of the primary operation (a failed log once made a *successful*
///  user creation report "Failed" and triggered duplicate-email retries).
///
///  The document schema is shared with the web dashboard. Both clients read
///  and write the SAME canonical shape, plus legacy aliases so entries written
///  by an older build still render correctly.
/// ─────────────────────────────────────────────────────────────────────────────

/// Top-level buckets used for filtering in the audit log UI.
class AuditCategory {
  static const user = 'user';
  static const role = 'role';
  static const project = 'project';
  static const task = 'task';
  static const attendance = 'attendance';
  static const document = 'document';
  static const siteDiary = 'site_diary';
  static const settings = 'settings';
  static const notification = 'notification';
  static const auth = 'auth';

  /// Categories shown as quick-filter chips, in display order.
  static const all = <String>[
    user,
    role,
    project,
    task,
    attendance,
    document,
    siteDiary,
    settings,
    notification,
    auth,
  ];

  static String label(String c) => switch (c) {
    user => 'Users',
    role => 'Roles',
    project => 'Projects',
    task => 'Tasks',
    attendance => 'Attendance',
    document => 'Documents',
    siteDiary => 'Site Diary',
    settings => 'Settings',
    notification => 'Notifications',
    auth => 'Auth',
    _ => c.isEmpty ? 'Other' : c[0].toUpperCase() + c.substring(1),
  };
}

/// A single before → after field change, rendered as an expandable diff row.
class AuditChange {
  final String field;
  final String label;
  final String? from;
  final String? to;

  AuditChange({required this.field, String? label, Object? from, Object? to})
    : label = label ?? _humanize(field),
      from = from?.toString(),
      to = to?.toString();

  Map<String, dynamic> toMap() => {
    'field': field,
    'label': label,
    'from': from,
    'to': to,
  };

  factory AuditChange.fromMap(Map<String, dynamic> m) => AuditChange(
    field: (m['field'] ?? '').toString(),
    label: m['label']?.toString(),
    from: m['from'],
    to: m['to'],
  );

  static String _humanize(String field) {
    if (field.isEmpty) return field;
    final spaced = field
        .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
        .replaceAll('_', ' ');
    return spaced[0].toUpperCase() + spaced.substring(1);
  }
}

/// Snapshot of who performed an action, captured at log time.
class AuditActor {
  final String id;
  final String name;
  final String role;
  final String avatarUrl;

  const AuditActor({
    required this.id,
    required this.name,
    this.role = '',
    this.avatarUrl = '',
  });
}

/// Builds the canonical Firestore document shared by mobile + web.
///
/// Writes the modern field names AND legacy aliases (`userId`, `userName`,
/// `details`, `createdAt`) so a not-yet-upgraded reader still shows the entry.
Map<String, dynamic> buildAuditDoc({
  required String action,
  required String category,
  required String actorId,
  required String actorName,
  String actorRole = '',
  String actorAvatar = '',
  String targetId = '',
  String targetName = '',
  required String description,
  List<AuditChange> changes = const [],
  Map<String, dynamic> meta = const {},
  String severity = 'info',
}) {
  final now = FieldValue.serverTimestamp();
  final safeActorName = actorName.trim().isEmpty ? 'System' : actorName.trim();
  return {
    'action': action,
    'category': category,
    'targetType': category, // keep in sync so legacy type-filters still work
    'actorId': actorId,
    'actorName': safeActorName,
    'actorRole': actorRole,
    'actorAvatar': actorAvatar,
    'targetId': targetId,
    'targetName': targetName,
    'description': description,
    'changes': changes.map((c) => c.toMap()).toList(),
    'meta': meta,
    'severity': severity,
    'timestamp': now,
    'createdAt': now,
    // ── legacy aliases (older web build reads these) ──
    'userId': actorId,
    'userName': safeActorName,
    'details': description,
  };
}

class AuditService {
  final FirebaseFirestore _db;
  final AuditActor? actor;

  AuditService({required this.actor, FirebaseFirestore? db})
    : _db = db ?? FirebaseFirestore.instance;

  /// Records an audit entry. Never throws — logging must not break the caller.
  Future<void> log({
    required String action,
    required String category,
    String targetId = '',
    String targetName = '',
    required String description,
    List<AuditChange> changes = const [],
    Map<String, dynamic> meta = const {},
    String severity = 'info',
  }) async {
    try {
      await _db.collection('audit_logs').add(
        buildAuditDoc(
          action: action,
          category: category,
          actorId: actor?.id ?? '',
          actorName: actor?.name ?? 'System',
          actorRole: actor?.role ?? '',
          actorAvatar: actor?.avatarUrl ?? '',
          targetId: targetId,
          targetName: targetName,
          description: description,
          changes: changes,
          meta: meta,
          severity: severity,
        ),
      );
    } catch (_) {
      // Best-effort: swallow. The primary operation has already succeeded.
    }
  }
}

/// Actor is captured from the signed-in user. Any screen/controller with a
/// [WidgetRef] can call `ref.read(auditServiceProvider).log(...)`.
final auditServiceProvider = Provider<AuditService>((ref) {
  final user = ref.watch(currentUserProvider).value;
  return AuditService(
    actor: user == null
        ? null
        : AuditActor(
            id: user.uid,
            name: user.name,
            role: user.roleId,
            avatarUrl: user.avatarUrl ?? '',
          ),
  );
});
