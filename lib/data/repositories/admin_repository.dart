
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp, FieldValue, QuerySnapshot;
import '../../core/utils/error_translator.dart';
import '../../core/utils/date_utils.dart';
import '../services/audit_service.dart';
import 'package:rxdart/rxdart.dart';

Map<String, dynamic> _toCamelCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (key.contains('_')) {
      final parts = key.split('_');
      final camelKey = parts.first + parts.skip(1).map((w) => w.substring(0, 1).toUpperCase() + w.substring(1)).join('');
      map[camelKey] = value;
    } else {
      map[key] = value;
    }
  });
  if (data['timestamp'] != null && data['timestamp'] is String) map['timestamp'] = Timestamp.fromDate(DateTime.parse(data['timestamp']));
  if (data['invited_at'] != null && data['invited_at'] is String) map['invitedAt'] = Timestamp.fromDate(DateTime.parse(data['invited_at']));
  if (data['sent_at'] != null && data['sent_at'] is String) map['sentAt'] = Timestamp.fromDate(DateTime.parse(data['sent_at']));
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

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
  final String actorRole;
  final String actorAvatar;
  final String targetId;
  final String targetType; // 'user', 'role', 'project', 'settings'
  final String targetName;
  final String description;
  final List<AuditChange> changes;
  final Map<String, dynamic> meta;
  final String severity; // 'info' | 'warning' | 'critical'
  final DateTime timestamp;

  const AuditLogEntry({
    required this.id,
    required this.action,
    required this.actorId,
    required this.actorName,
    this.actorRole = '',
    this.actorAvatar = '',
    required this.targetId,
    required this.targetType,
    this.targetName = '',
    required this.description,
    this.changes = const [],
    this.meta = const {},
    this.severity = 'info',
    required this.timestamp,
  });

  /// Tolerant of BOTH the modern schema and the legacy web schema
  /// (`userId` / `userName` / `details` / `createdAt`) so historical entries
  /// written by either client still render.
  factory AuditLogEntry.fromMap(Map<String, dynamic> d, String docId) {
    String pick(String a, String b) =>
        (d[a] ?? d[b] ?? '').toString();
    final rawChanges = (d['changes'] as List?) ?? const [];
    return AuditLogEntry(
      id: docId,
      action: d['action'] ?? '',
      actorId: pick('actorId', 'userId'),
      actorName: pick('actorName', 'userName'),
      actorRole: (d['actorRole'] ?? '').toString(),
      actorAvatar: (d['actorAvatar'] ?? '').toString(),
      targetId: (d['targetId'] ?? '').toString(),
      targetType: (d['targetType'] ?? d['category'] ?? '').toString(),
      targetName: (d['targetName'] ?? '').toString(),
      description: pick('description', 'details'),
      changes: rawChanges
          .whereType<Map>()
          .map((m) => AuditChange.fromMap(Map<String, dynamic>.from(m)))
          .toList(),
      meta: Map<String, dynamic>.from(d['meta'] ?? {}),
      severity: (d['severity'] ?? 'info').toString(),
      timestamp: AppDateUtils.fromTimestamp(d['timestamp']) ?? DateTime.now(),
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

  factory UserInvitation.fromMap(Map<String, dynamic> d, String docId) {
    return UserInvitation(
      id: docId,
      email: d['email'] ?? '',
      name: d['name'] ?? '',
      phone: d['phone'] ?? '',
      roleId: d['roleId'] ?? '',
      invitedBy: d['invitedBy'] ?? '',
      status: d['status'] ?? 'pending',
      invitedAt: AppDateUtils.fromTimestamp(d['invitedAt']) ?? DateTime.now(),
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
  final _supabase = Supabase.instance.client;

  Stream<OrgSettings> watchOrgSettings() {
    return _supabase.from('settings').stream(primaryKey: ['id']).eq('id', 'org').map((list) {
      if (list.isEmpty) return const OrgSettings();
      return OrgSettings.fromMap(_toCamelCase(list.first));
    }).handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<OrgSettings> getOrgSettings() async {
    try {
      final data = await _supabase.from('settings').select().eq('id', 'org').maybeSingle();
      if (data == null) return const OrgSettings();
      return OrgSettings.fromMap(_toCamelCase(data));
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> saveOrgSettings(OrgSettings settings) async {
    try {
      var data = _toSnakeCase(settings.toMap());
      data['id'] = 'org';
      await _supabase.from('settings').upsert(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<TaskAssignmentConfig> watchTaskAssignmentConfig() {
    return _supabase.from('settings').stream(primaryKey: ['id']).eq('id', 'task_assignment').map((list) {
      if (list.isEmpty) return const TaskAssignmentConfig();
      return TaskAssignmentConfig.fromMap(_toCamelCase(list.first));
    }).handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<TaskAssignmentConfig> getTaskAssignmentConfig() async {
    try {
      final data = await _supabase.from('settings').select().eq('id', 'task_assignment').maybeSingle();
      if (data == null) return const TaskAssignmentConfig();
      return TaskAssignmentConfig.fromMap(_toCamelCase(data));
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> saveTaskAssignmentConfig(TaskAssignmentConfig config, String updatedBy) async {
    try {
      var data = _toSnakeCase(config.toMap());
      data['id'] = 'task_assignment';
      data['updated_by'] = updatedBy;
      data['updated_at'] = DateTime.now().toIso8601String();
      await _supabase.from('settings').upsert(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> writeAuditLog({
    required String action,
    required String actorId,
    required String actorName,
    String actorRole = '',
    String actorAvatar = '',
    String targetId = '',
    String targetType = '',
    String targetName = '',
    required String description,
    List<AuditChange> changes = const [],
    Map<String, dynamic> meta = const {},
    String severity = 'info',
  }) async {
    try {
      final doc = buildAuditDoc(
        action: action,
        category: targetType,
        actorId: actorId,
        actorName: actorName,
        actorRole: actorRole,
        actorAvatar: actorAvatar,
        targetId: targetId,
        targetName: targetName,
        description: description,
        changes: changes,
        meta: meta,
        severity: severity,
      );
      await _supabase.from('audit_logs').insert(_toSnakeCase(doc));
    } catch (_) {}
  }

  Stream<List<AuditLogEntry>> watchAuditLogs({int limit = 100}) {
    return _supabase.from('audit_logs').stream(primaryKey: ['id']).order('timestamp', ascending: false).limit(limit)
        .map((list) => list.map((d) => AuditLogEntry.fromMap(_toCamelCase(d), d['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<List<AuditLogEntry>> watchAuditLogsByType(String targetType) {
    return _supabase.from('audit_logs').stream(primaryKey: ['id']).eq('target_type', targetType).order('timestamp', ascending: false).limit(50)
        .map((list) => list.map((d) => AuditLogEntry.fromMap(_toCamelCase(d), d['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createInvitation(UserInvitation inv) async {
    try {
      final data = await _supabase.from('invitations').insert(_toSnakeCase(inv.toMap())).select('id').single();
      return data['id'];
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<UserInvitation>> watchInvitations() {
    return _supabase.from('invitations').stream(primaryKey: ['id']).eq('status', 'pending').order('invited_at', ascending: false)
        .map((list) => list.map((d) => UserInvitation.fromMap(_toCamelCase(d), d['id'])).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> cancelInvitation(String invId) async {
    try {
      await _supabase.from('invitations').update({'status': 'cancelled'}).eq('id', invId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> sendBroadcastNotification({
    required String title,
    required String body,
    String? targetRoleId,
    Map<String, dynamic> data = const {},
  }) async {
    try {
      await _supabase.from('broadcast_notifications').insert({
        'title': title,
        'body': body,
        'target_role_id': targetRoleId,
        'data': data,
        'sent_at': DateTime.now().toIso8601String(),
        'status': 'queued',
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<Map<String, dynamic>>> watchBroadcastHistory({int limit = 30}) {
    return _supabase.from('broadcast_notifications').stream(primaryKey: ['id']).order('sent_at', ascending: false).limit(limit)
        .map((list) => list.map((d) => _toCamelCase(d)).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<Map<String, int>> watchAdminStats() {
    return Rx.combineLatest5<
      List<Map<String, dynamic>>,
      List<Map<String, dynamic>>,
      List<Map<String, dynamic>>,
      List<Map<String, dynamic>>,
      List<Map<String, dynamic>>,
      Map<String, int>
    >(
      _supabase.from('users').stream(primaryKey: ['id']),
      _supabase.from('users').stream(primaryKey: ['id']).eq('is_active', true),
      _supabase.from('projects').stream(primaryKey: ['id']),
      _supabase.from('tasks').stream(primaryKey: ['id']),
      _supabase.from('roles').stream(primaryKey: ['id']),
      (users, activeUsers, projects, tasks, roles) {
        return {
          'totalUsers': users.length,
          'activeUsers': activeUsers.length,
          'totalProjects': projects.length,
          'totalTasks': tasks.length,
          'totalRoles': roles.length,
        };
      },
    ).handleError((e) => throw ErrorTranslator.translate(e));
  }
}
