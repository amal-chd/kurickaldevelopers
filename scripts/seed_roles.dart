// ignore_for_file: avoid_print
/// Run with: dart run scripts/seed_roles.dart
/// Seeds the default system roles into Firestore for Kurickal TMS.
///
/// Requires the Firebase Admin SDK or a service account credential.
/// For development, you can use the FlutterFire CLI or copy these role maps
/// directly into the Firestore console under the `roles` collection.
library;

import 'dart:convert';

void main() {
  final roles = _buildRoles();
  print(
    'Copy the following role documents into Firestore → roles collection:\n',
  );
  for (final r in roles) {
    print('ID: ${r['id']}');
    print(const JsonEncoder.withIndent('  ').convert(r));
    print('---');
  }
}

List<Map<String, dynamic>> _buildRoles() {
  final now = DateTime.now().toIso8601String();

  return [
    // ── Director / Owner ── Full access
    {
      'id': 'director',
      'name': 'Director / Owner',
      'description': 'Full access to all features and settings',
      'color': '#1A3A5C',
      'isSystem': true,
      'createdBy': 'system',
      'createdAt': now,
      'level': 100,
      'permissions': _allPermissions(true),
    },
  ];
}

Map<String, bool> _allPermissions(bool value) => {
  'tasks_view': value,
  'tasks_create': value,
  'tasks_edit': value,
  'tasks_delete': value,
  'tasks_approve': value,
  'projects_view': value,
  'projects_create': value,
  'projects_edit': value,
  'projects_delete': value,
  'docs_view': value,
  'docs_upload': value,
  'docs_approve': value,
  'team_view': value,
  'team_manage': value,
  'team_delete': value,
  'reports_view': value,
  'reports_export': value,
  'time_log': value,
  'time_view_all': value,
  'roles_manage': value,
  'settings_manage': value,
  'notifications_manage': value,
  'chat_view': value,
  'chat_send': value,
  'chat_create_group': value,
  'chat_announce': value,
  'chat_moderate': value,
  'attendance_view_all': value,
};
