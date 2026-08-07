import 'package:flutter_test/flutter_test.dart';
import 'package:task_pilot/data/models/role_model.dart';

void main() {
  group('RoleModel', () {
    test('constructor with defaults', () {
      final now = DateTime.now();
      final role = RoleModel(
        id: 'role-1',
        name: 'Manager',
        description: 'Project manager role',
        color: '#2196F3',
        createdBy: 'admin',
        createdAt: now,
        permissions: const PermissionModel(),
      );

      expect(role.id, 'role-1');
      expect(role.name, 'Manager');
      expect(role.color, '#2196F3');
      expect(role.isSystem, false);
      expect(role.level, 50); // default level
    });

    test('constructor with custom level', () {
      final role = RoleModel(
        id: 'director',
        name: 'Director/Owner',
        description: 'Top-level role',
        color: '#FF5722',
        isSystem: true,
        createdBy: 'system',
        createdAt: DateTime.now(),
        permissions: const PermissionModel(),
        level: 100,
      );

      expect(role.level, 100);
      expect(role.isSystem, true);
    });

    test('hierarchy comparison works correctly', () {
      final director = RoleModel(
        id: 'd',
        name: 'Director',
        description: '',
        color: '',
        createdBy: '',
        createdAt: DateTime.now(),
        permissions: const PermissionModel(),
        level: 100,
      );

      final manager = RoleModel(
        id: 'm',
        name: 'Manager',
        description: '',
        color: '',
        createdBy: '',
        createdAt: DateTime.now(),
        permissions: const PermissionModel(),
        level: 70,
      );

      final labour = RoleModel(
        id: 'l',
        name: 'Labour',
        description: '',
        color: '',
        createdBy: '',
        createdAt: DateTime.now(),
        permissions: const PermissionModel(),
        level: 10,
      );

      // Director > Manager > Labour
      expect(director.level > manager.level, true);
      expect(manager.level > labour.level, true);
      expect(director.level > labour.level, true);
    });

    test('toFirestore produces correct map', () {
      final now = DateTime(2024, 6, 15);
      final role = RoleModel(
        id: 'test-role',
        name: 'Test Role',
        description: 'A test role',
        color: '#000000',
        isSystem: false,
        createdBy: 'user-1',
        createdAt: now,
        permissions: const PermissionModel(rolesManage: true),
        level: 80,
      );

      final map = role.toFirestore();

      expect(map['name'], 'Test Role');
      expect(map['description'], 'A test role');
      expect(map['color'], '#000000');
      expect(map['isSystem'], false);
      expect(map['level'], 80);
      expect(map['permissions'], isA<Map<String, dynamic>>());
      expect(map['permissions']['roles_manage'], true);
    });
  });
}
