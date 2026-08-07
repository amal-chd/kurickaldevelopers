import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/error_translator.dart';
import 'package:rxdart/rxdart.dart';

// ─── Org Settings Model ────────────────────────────────────────────────────────

class OrgSettings {
  final String companyName;
  final String? logoUrl;
  final String address;
  final String phone;
  final String email;
  final String timezone;
  final String currency;
  final String workStartTime;
  final String workEndTime;
  final List<String> workDays;
  final int maxUsers;
  final int maxProjects;

  const OrgSettings({
    this.companyName = '',
    this.logoUrl,
    this.address = '',
    this.phone = '',
    this.email = '',
    this.timezone = 'Asia/Kolkata',
    this.currency = 'INR',
    this.workStartTime = '09:00',
    this.workEndTime = '18:00',
    this.workDays = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    this.maxUsers = 50,
    this.maxProjects = 20,
  });

  factory OrgSettings.fromMap(Map<String, dynamic> m) => OrgSettings(
    companyName: m['companyName'] ?? '',
    logoUrl: m['logoUrl'],
    address: m['address'] ?? '',
    phone: m['phone'] ?? '',
    email: m['email'] ?? '',
    timezone: m['timezone'] ?? 'Asia/Kolkata',
    currency: m['currency'] ?? 'INR',
    workStartTime: m['workStartTime'] ?? '09:00',
    workEndTime: m['workEndTime'] ?? '18:00',
    workDays: List<String>.from(
      m['workDays'] ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ),
    maxUsers: (m['maxUsers'] as num?)?.toInt() ?? 50,
    maxProjects: (m['maxProjects'] as num?)?.toInt() ?? 20,
  );

  Map<String, dynamic> toMap() => {
    'companyName': companyName,
    'logoUrl': logoUrl,
    'address': address,
    'phone': phone,
    'email': email,
    'timezone': timezone,
    'currency': currency,
    'workStartTime': workStartTime,
    'workEndTime': workEndTime,
    'workDays': workDays,
    'maxUsers': maxUsers,
    'maxProjects': maxProjects,
  };

  OrgSettings copyWith({
    String? companyName,
    String? logoUrl,
    String? address,
    String? phone,
    String? email,
    String? timezone,
    String? currency,
    String? workStartTime,
    String? workEndTime,
    List<String>? workDays,
  }) => OrgSettings(
    companyName: companyName ?? this.companyName,
    logoUrl: logoUrl ?? this.logoUrl,
    address: address ?? this.address,
    phone: phone ?? this.phone,
    email: email ?? this.email,
    timezone: timezone ?? this.timezone,
    currency: currency ?? this.currency,
    workStartTime: workStartTime ?? this.workStartTime,
    workEndTime: workEndTime ?? this.workEndTime,
    workDays: workDays ?? this.workDays,
    maxUsers: maxUsers,
    maxProjects: maxProjects,
  );
}

// ─── Task Assignment Config Model ──────────────────────────────────────────────

/// Configured by the Director: controls which roles a given role is allowed to
/// assign tasks to. When [enabled] is false (or the doc is missing) anyone who
/// can create tasks may assign to anyone — the historical behaviour.
///
/// [matrix] maps a creator roleId to the list of roleIds it may assign to.
class TaskAssignmentConfig {
  final bool enabled;
  final Map<String, List<String>> matrix;

  const TaskAssignmentConfig({this.enabled = false, this.matrix = const {}});

  factory TaskAssignmentConfig.fromMap(Map<String, dynamic> m) {
    final rawMatrix = (m['matrix'] as Map<String, dynamic>?) ?? {};
    return TaskAssignmentConfig(
      enabled: m['enabled'] == true,
      matrix: rawMatrix.map(
        (k, v) => MapEntry(k, List<String>.from(v as List? ?? const [])),
      ),
    );
  }

  Map<String, dynamic> toMap() => {
    'enabled': enabled,
    'matrix': matrix,
  };

  /// Whether a user with [creatorRoleId] may assign tasks to [targetRoleId].
  bool allows(String creatorRoleId, String targetRoleId) {
    if (!enabled) return true;
    final allowed = matrix[creatorRoleId];
    if (allowed == null) return true; // role not configured → unrestricted
    return allowed.contains(targetRoleId);
  }

  /// Whether [creatorRoleId] has any explicit restriction configured.
  bool isRestricted(String creatorRoleId) =>
      enabled && matrix[creatorRoleId] != null;
}

// ─── Audit Log Model ───────────────────────────────────────────────────────────

class AuditLogEntry {
  final String id;
  final String action; // e.g. 'user.created', 'role.deleted'
  final String actorId;
  final String actorName;
  final String targetId;
  final String targetType; // 'user', 'role', 'project', 'settings'
  final String description;
  final Map<String, dynamic> meta;
  final DateTime timestamp;

  const AuditLogEntry({
    required this.id,
    required this.action,
    required this.actorId,
    required this.actorName,
    required this.targetId,
    required this.targetType,
    required this.description,
    this.meta = const {},
    required this.timestamp,
  });

  factory AuditLogEntry.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return AuditLogEntry(
      id: doc.id,
      action: d['action'] ?? '',
      actorId: d['actorId'] ?? '',
      actorName: d['actorName'] ?? '',
      targetId: d['targetId'] ?? '',
      targetType: d['targetType'] ?? '',
      description: d['description'] ?? '',
      meta: Map<String, dynamic>.from(d['meta'] ?? {}),
      timestamp: (d['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}

// ─── Invitation Model ──────────────────────────────────────────────────────────

class UserInvitation {
  final String id;
  final String email;
  final String name;
  final String phone;
  final String roleId;
  final String invitedBy;
  final DateTime invitedAt;
  final String status; // 'pending' | 'accepted' | 'expired'

  const UserInvitation({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    required this.roleId,
    required this.invitedBy,
    required this.invitedAt,
    this.status = 'pending',
  });

  factory UserInvitation.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return UserInvitation(
      id: doc.id,
      email: d['email'] ?? '',
      name: d['name'] ?? '',
      phone: d['phone'] ?? '',
      roleId: d['roleId'] ?? '',
      invitedBy: d['invitedBy'] ?? '',
      invitedAt: (d['invitedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      status: d['status'] ?? 'pending',
    );
  }

  Map<String, dynamic> toMap() => {
    'email': email,
    'name': name,
    'phone': phone,
    'roleId': roleId,
    'invitedBy': invitedBy,
    'invitedAt': Timestamp.fromDate(invitedAt),
    'status': status,
  };
}

// ─── Admin Repository ──────────────────────────────────────────────────────────

class AdminRepository {
  final _db = FirebaseFirestore.instance;

  // ── Org Settings ─────────────────────────────────────────────────────────────

  Stream<OrgSettings> watchOrgSettings() {
    return _db
        .collection('settings')
        .doc('org')
        .snapshots()
        .map(
          (snap) => snap.exists
              ? OrgSettings.fromMap(snap.data()!)
              : const OrgSettings(),
        )
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<OrgSettings> getOrgSettings() async {
    try {
      final doc = await _db.collection('settings').doc('org').get();
      if (!doc.exists) return const OrgSettings();
      return OrgSettings.fromMap(doc.data()!);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> saveOrgSettings(OrgSettings settings) async {
    try {
      await _db
          .collection('settings')
          .doc('org')
          .set(settings.toMap(), SetOptions(merge: true));
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Task Assignment Config ────────────────────────────────────────────────────

  Stream<TaskAssignmentConfig> watchTaskAssignmentConfig() {
    return _db
        .collection('settings')
        .doc('task_assignment')
        .snapshots()
        .map(
          (snap) => snap.exists
              ? TaskAssignmentConfig.fromMap(snap.data()!)
              : const TaskAssignmentConfig(),
        )
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<TaskAssignmentConfig> getTaskAssignmentConfig() async {
    try {
      final doc =
          await _db.collection('settings').doc('task_assignment').get();
      if (!doc.exists) return const TaskAssignmentConfig();
      return TaskAssignmentConfig.fromMap(doc.data()!);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> saveTaskAssignmentConfig(
    TaskAssignmentConfig config,
    String updatedBy,
  ) async {
    try {
      await _db.collection('settings').doc('task_assignment').set({
        ...config.toMap(),
        'updatedBy': updatedBy,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────────

  Future<void> writeAuditLog({
    required String action,
    required String actorId,
    required String actorName,
    String targetId = '',
    String targetType = '',
    required String description,
    Map<String, dynamic> meta = const {},
  }) async {
    try {
      await _db.collection('audit_logs').add({
        'action': action,
        'actorId': actorId,
        'actorName': actorName,
        'targetId': targetId,
        'targetType': targetType,
        'description': description,
        'meta': meta,
        'timestamp': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<AuditLogEntry>> watchAuditLogs({int limit = 100}) {
    return _db
        .collection('audit_logs')
        .orderBy('timestamp', descending: true)
        .limit(limit)
        .snapshots()
        .map((s) => s.docs.map(AuditLogEntry.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<AuditLogEntry>> watchAuditLogsByType(String targetType) {
    return _db
        .collection('audit_logs')
        .where('targetType', isEqualTo: targetType)
        .orderBy('timestamp', descending: true)
        .limit(50)
        .snapshots()
        .map((s) => s.docs.map(AuditLogEntry.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ── Invitations ───────────────────────────────────────────────────────────────

  Future<String> createInvitation(UserInvitation inv) async {
    try {
      final doc = await _db.collection('invitations').add(inv.toMap());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<UserInvitation>> watchInvitations() {
    return _db
        .collection('invitations')
        .where('status', isEqualTo: 'pending')
        .orderBy('invitedAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(UserInvitation.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> cancelInvitation(String invId) async {
    try {
      await _db.collection('invitations').doc(invId).update({
        'status': 'cancelled',
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Push Notifications (via Firestore trigger or FCM REST) ────────────────────

  Future<void> sendBroadcastNotification({
    required String title,
    required String body,
    String? targetRoleId,
    Map<String, dynamic> data = const {},
  }) async {
    try {
      await _db.collection('broadcast_notifications').add({
        'title': title,
        'body': body,
        'targetRoleId': targetRoleId,
        'data': data,
        'sentAt': FieldValue.serverTimestamp(),
        'status': 'queued',
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<Map<String, dynamic>>> watchBroadcastHistory({int limit = 30}) {
    return _db
        .collection('broadcast_notifications')
        .orderBy('sentAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((s) => s.docs.map((d) => {'id': d.id, ...d.data()}).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  Stream<Map<String, int>> watchAdminStats() {
    return Rx.combineLatest5<
          QuerySnapshot<Map<String, dynamic>>,
          QuerySnapshot<Map<String, dynamic>>,
          QuerySnapshot<Map<String, dynamic>>,
          QuerySnapshot<Map<String, dynamic>>,
          QuerySnapshot<Map<String, dynamic>>,
          Map<String, int>
        >(
          _db.collection('users').snapshots(),
          _db
              .collection('users')
              .where('isActive', isEqualTo: true)
              .snapshots(),
          _db.collection('projects').snapshots(),
          _db.collection('tasks').snapshots(),
          _db.collection('roles').snapshots(),
          (users, activeUsers, projects, tasks, roles) {
            return {
              'totalUsers': users.docs.length,
              'activeUsers': activeUsers.docs.length,
              'totalProjects': projects.docs.length,
              'totalTasks': tasks.docs.length,
              'totalRoles': roles.docs.length,
            };
          },
        )
        .handleError((e) => throw ErrorTranslator.translate(e));
  }
}
