import 'package:flutter_test/flutter_test.dart';
import 'package:task_pilot/data/models/role_model.dart';

void main() {
  group('PermissionModel', () {
    test('default constructor has expected defaults', () {
      const model = PermissionModel();

      expect(model.tasksView, true);
      expect(model.tasksCreate, true);
      expect(model.tasksEdit, true);
      expect(model.tasksDelete, false);
      expect(model.tasksApprove, false);
      expect(model.projectsView, true);
      expect(model.projectsCreate, false);
      expect(model.projectsEdit, false);
      expect(model.projectsDelete, false);
      expect(model.docsView, true);
      expect(model.docsUpload, true);
      expect(model.docsApprove, false);
      expect(model.teamView, true);
      expect(model.teamManage, false);
      expect(model.teamDelete, false);
      expect(model.reportsView, false);
      expect(model.reportsExport, false);
      expect(model.rolesManage, false);
      expect(model.settingsManage, false);
      expect(model.timeLog, true);
      expect(model.timeViewAll, false);
      expect(model.notificationsManage, false);
      expect(model.chatView, true);
      expect(model.chatSend, true);
      expect(model.chatCreateGroup, false);
      expect(model.chatAnnounce, false);
      expect(model.chatModerate, false);
      expect(model.attendanceViewAll, false);
    });

    test('fromMap parses all keys correctly', () {
      final map = {
        'tasks_view': true,
        'tasks_create': false,
        'tasks_edit': true,
        'tasks_delete': true,
        'tasks_approve': true,
        'projects_view': false,
        'projects_create': true,
        'projects_edit': true,
        'projects_delete': true,
        'docs_view': false,
        'docs_upload': false,
        'docs_approve': true,
        'team_view': false,
        'team_manage': true,
        'team_delete': true,
        'reports_view': true,
        'reports_export': true,
        'roles_manage': true,
        'settings_manage': true,
        'time_log': false,
        'time_view_all': true,
        'notifications_manage': true,
        'chat_view': false,
        'chat_send': false,
        'chat_create_group': true,
        'chat_announce': true,
        'chat_moderate': true,
        'attendance_view_all': true,
      };

      final model = PermissionModel.fromMap(map);

      expect(model.tasksView, true);
      expect(model.tasksCreate, false);
      expect(model.tasksDelete, true);
      expect(model.projectsView, false);
      expect(model.projectsCreate, true);
      expect(model.docsView, false);
      expect(model.docsApprove, true);
      expect(model.teamView, false);
      expect(model.rolesManage, true);
      expect(model.chatView, false);
      expect(model.chatModerate, true);
      expect(model.attendanceViewAll, true);
    });

    test('fromMap handles empty map with defaults', () {
      final model = PermissionModel.fromMap({});

      expect(model.tasksView, true);
      expect(model.tasksDelete, false);
      expect(model.rolesManage, false);
      expect(model.chatView, true);
    });

    test('toMap produces correct keys and values', () {
      const model = PermissionModel(
        tasksView: true,
        tasksCreate: false,
        rolesManage: true,
        chatModerate: true,
      );

      final map = model.toMap();

      expect(map['tasks_view'], true);
      expect(map['tasks_create'], false);
      expect(map['roles_manage'], true);
      expect(map['chat_moderate'], true);
      // Guard against silent key drops: 28 base + 3 *_view_all + 2 contact_*
      // + 2 performance_* = 35. Update this when adding permission keys.
      expect(map.length, 35);
    });

    test('toMap/fromMap round-trip preserves values', () {
      const original = PermissionModel(
        tasksView: false,
        tasksCreate: true,
        projectsDelete: true,
        chatAnnounce: true,
        attendanceViewAll: true,
      );

      final roundTripped = PermissionModel.fromMap(original.toMap());

      expect(roundTripped.tasksView, original.tasksView);
      expect(roundTripped.tasksCreate, original.tasksCreate);
      expect(roundTripped.projectsDelete, original.projectsDelete);
      expect(roundTripped.chatAnnounce, original.chatAnnounce);
      expect(roundTripped.attendanceViewAll, original.attendanceViewAll);
    });

    test('hasPermission returns correct values', () {
      const model = PermissionModel(
        tasksView: true,
        tasksDelete: false,
        rolesManage: true,
      );

      expect(model.hasPermission('tasks_view'), true);
      expect(model.hasPermission('tasks_delete'), false);
      expect(model.hasPermission('roles_manage'), true);
    });

    test('hasPermission returns false for unknown keys', () {
      const model = PermissionModel();
      expect(model.hasPermission('nonexistent_key'), false);
    });
  });
}
