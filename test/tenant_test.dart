import 'package:flutter_test/flutter_test.dart';
import 'package:task_pilot/core/tenant/tenant.dart';

void main() {
  group('TenantContext.fromMe', () {
    test('no context → full access (never locks users out)', () {
      final t = TenantContext.fromMe({'context': null});
      expect(t.hasModule('salary'), isTrue);
      expect(t.isReadOnly, isFalse);
    });

    test('legacy workspace gets every module', () {
      final t = TenantContext.fromMe({
        'context': {'org': {'id': 'main', 'name': 'Kurickal', 'status': 'active', 'is_legacy': true}, 'features': ['*']},
      });
      expect(t.isLegacy, isTrue);
      expect(t.hasModule('boq'), isTrue);
    });

    test('SaaS tenant respects plan features and status', () {
      final t = TenantContext.fromMe({
        'context': {
          'org': {'id': 'acme', 'name': 'Acme', 'status': 'expired', 'is_legacy': false},
          'features': ['tasks', 'projects'],
        },
      });
      expect(t.hasModule('projects'), isTrue);
      expect(t.hasModule('salary'), isFalse);
      expect(t.isReadOnly, isTrue);
    });

    test('trial countdown and maintenance message', () {
      final ends = DateTime.now().add(const Duration(hours: 60)).toIso8601String();
      final t = TenantContext.fromMe({
        'context': {'org': {'id': 'acme', 'status': 'trialing', 'trial_ends_at': ends}, 'features': ['tasks']},
        'maintenance': {'enabled': true, 'message': ''},
      });
      expect(t.trialDaysLeft, 3);
      expect(t.maintenanceMessage, isNotNull);
    });
  });

  group('routing & scoping helpers', () {
    test('maps routes (incl. nested) to modules', () {
      expect(moduleForRoute('/projects'), 'projects');
      expect(moduleForRoute('/projects/abc/edit'), 'projects');
      expect(moduleForRoute('/projectsX'), isNull);
      expect(moduleForRoute('/dashboard'), isNull);
      expect(moduleForRoute('/admin/audit-log'), 'audit_log');
    });

    test('legacy org keeps original settings ids', () {
      expect(Tenant.orgId, Tenant.legacyOrgId);
      expect(Tenant.settingsId('task_assignment'), 'task_assignment');
    });

    test('rows without org_id belong to the legacy org', () {
      expect(Tenant.owns({'id': 1}), isTrue);
      expect(Tenant.owns({'org_id': 'main'}), isTrue);
      expect(Tenant.owns({'org_id': 'acme'}), isFalse);
    });

    test('tenantScoped() drops other organisations\' rows', () async {
      final rows = await Stream.value(<Map<String, dynamic>>[
        {'id': 1, 'org_id': 'main'},
        {'id': 2, 'org_id': 'acme'},
        {'id': 3},
      ]).tenantScoped().first;
      expect(rows.map((r) => r['id']), [1, 3]);
    });
  });
}
