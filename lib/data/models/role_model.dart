import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class PermissionModel {
  final bool tasksView;
  final bool tasksViewAll;
  final bool tasksCreate;
  final bool tasksEdit;
  final bool tasksDelete;
  final bool tasksApprove;
  final bool projectsView;
  final bool projectsViewAll;
  final bool projectsCreate;
  final bool projectsEdit;
  final bool projectsDelete;
  final bool docsView;
  final bool docsViewAll;
  final bool docsUpload;
  final bool docsApprove;
  final bool teamView;
  final bool teamManage;
  final bool teamDelete;
  final bool reportsView;
  final bool reportsExport;
  final bool rolesManage;
  final bool settingsManage;
  final bool timeLog;
  final bool timeViewAll;
  final bool notificationsManage;
  // Chat permissions
  final bool chatView; // can view & read channels
  final bool chatSend; // can send messages
  final bool chatCreateGroup; // can create group channels
  final bool chatAnnounce; // can post in Announcement channel
  final bool chatModerate; // can delete any message / mute users
  // Attendance permissions
  final bool
  attendanceViewAll; // can view all staff attendance records (admin/director)
  // Contact-inquiry permissions (kept in sync with the web app so role edits
  // on mobile never drop them).
  final bool contactView;
  final bool contactManage;
  // Performance permissions (referenced by the Firestore rules; kept here so
  // role edits on mobile never drop them).
  final bool performanceView;
  final bool performanceManage;

  const PermissionModel({
    this.tasksView = true,
    this.tasksViewAll = false,
    this.tasksCreate = true,
    this.tasksEdit = true,
    this.tasksDelete = false,
    this.tasksApprove = false,
    this.projectsView = true,
    this.projectsViewAll = false,
    this.projectsCreate = false,
    this.projectsEdit = false,
    this.projectsDelete = false,
    this.docsView = true,
    this.docsViewAll = false,
    this.docsUpload = true,
    this.docsApprove = false,
    this.teamView = true,
    this.teamManage = false,
    this.teamDelete = false,
    this.reportsView = false,
    this.reportsExport = false,
    this.rolesManage = false,
    this.settingsManage = false,
    this.timeLog = true,
    this.timeViewAll = false,
    this.notificationsManage = false,
    this.chatView = true,
    this.chatSend = true,
    this.chatCreateGroup = false,
    this.chatAnnounce = false,
    this.chatModerate = false,
    this.attendanceViewAll = false,
    this.contactView = false,
    this.contactManage = false,
    this.performanceView = false,
    this.performanceManage = false,
  });

  factory PermissionModel.fromMap(Map<String, dynamic> map) => PermissionModel(
    tasksView: map['tasks_view'] ?? true,
    tasksViewAll: map['tasks_view_all'] ?? false,
    tasksCreate: map['tasks_create'] ?? true,
    tasksEdit: map['tasks_edit'] ?? true,
    tasksDelete: map['tasks_delete'] ?? false,
    tasksApprove: map['tasks_approve'] ?? false,
    projectsView: map['projects_view'] ?? true,
    projectsViewAll: map['projects_view_all'] ?? false,
    projectsCreate: map['projects_create'] ?? false,
    projectsEdit: map['projects_edit'] ?? false,
    projectsDelete: map['projects_delete'] ?? false,
    docsView: map['docs_view'] ?? true,
    docsViewAll: map['docs_view_all'] ?? false,
    docsUpload: map['docs_upload'] ?? true,
    docsApprove: map['docs_approve'] ?? false,
    teamView: map['team_view'] ?? true,
    teamManage: map['team_manage'] ?? false,
    teamDelete: map['team_delete'] ?? false,
    reportsView: map['reports_view'] ?? false,
    reportsExport: map['reports_export'] ?? false,
    rolesManage: map['roles_manage'] ?? false,
    settingsManage: map['settings_manage'] ?? false,
    timeLog: map['time_log'] ?? true,
    timeViewAll: map['time_view_all'] ?? false,
    notificationsManage: map['notifications_manage'] ?? false,
    chatView: map['chat_view'] ?? true,
    chatSend: map['chat_send'] ?? true,
    chatCreateGroup: map['chat_create_group'] ?? false,
    chatAnnounce: map['chat_announce'] ?? false,
    chatModerate: map['chat_moderate'] ?? false,
    attendanceViewAll: map['attendance_view_all'] ?? false,
    contactView: map['contact_view'] ?? false,
    contactManage: map['contact_manage'] ?? false,
    performanceView: map['performance_view'] ?? false,
    performanceManage: map['performance_manage'] ?? false,
  );

  Map<String, dynamic> toMap() => {
    'tasks_view': tasksView,
    'tasks_view_all': tasksViewAll,
    'tasks_create': tasksCreate,
    'tasks_edit': tasksEdit,
    'tasks_delete': tasksDelete,
    'tasks_approve': tasksApprove,
    'projects_view': projectsView,
    'projects_view_all': projectsViewAll,
    'projects_create': projectsCreate,
    'projects_edit': projectsEdit,
    'projects_delete': projectsDelete,
    'docs_view': docsView,
    'docs_view_all': docsViewAll,
    'docs_upload': docsUpload,
    'docs_approve': docsApprove,
    'team_view': teamView,
    'team_manage': teamManage,
    'team_delete': teamDelete,
    'reports_view': reportsView,
    'reports_export': reportsExport,
    'roles_manage': rolesManage,
    'settings_manage': settingsManage,
    'time_log': timeLog,
    'time_view_all': timeViewAll,
    'notifications_manage': notificationsManage,
    'chat_view': chatView,
    'chat_send': chatSend,
    'chat_create_group': chatCreateGroup,
    'chat_announce': chatAnnounce,
    'chat_moderate': chatModerate,
    'attendance_view_all': attendanceViewAll,
    'contact_view': contactView,
    'contact_manage': contactManage,
    'performance_view': performanceView,
    'performance_manage': performanceManage,
  };

  bool hasPermission(String key) {
    final map = toMap();
    return map[key] == true;
  }
}

class RoleModel {
  final String id;
  final String name;
  final String description;
  final String color;
  final bool isSystem;
  final String createdBy;
  final DateTime createdAt;
  final PermissionModel permissions;

  /// Hierarchy level: 1 (lowest, e.g. Labour) → 100 (highest, e.g. Director).
  /// Higher-level roles can manage lower-level roles.
  final int level;

  const RoleModel({
    required this.id,
    required this.name,
    required this.description,
    required this.color,
    this.isSystem = false,
    required this.createdBy,
    required this.createdAt,
    required this.permissions,
    this.level = 50,
  });

  factory RoleModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return RoleModel(
      id: doc.id,
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      color: data['color'] ?? '#1A3A5C',
      isSystem: data['isSystem'] ?? false,
      createdBy: data['createdBy'] ?? '',
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      permissions: PermissionModel.fromMap(
        Map<String, dynamic>.from(data['permissions'] ?? {}),
      ),
      level: (data['level'] as num?)?.toInt() ?? 50,
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'description': description,
    'color': color,
    'isSystem': isSystem,
    'createdBy': createdBy,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'permissions': permissions.toMap(),
    'level': level,
  };
}
