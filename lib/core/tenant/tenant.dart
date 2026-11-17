import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/supabase_config.dart';

/// ─────────────────────────────────────────────────────────────────────────
///  Multi-tenancy (mirrors the web app's `src/lib/tenant.ts`)
///
///  Every user belongs to one organisation (`users/{uid}.orgId`). Pre-SaaS
///  users belong to the legacy organisation `main` (Kurickal Developers).
///  The org id travels on every Supabase request as `x-org-id`; the database
///  RLS scopes all tenant tables to it. Without the header the database
///  assumes `main`, so the org MUST be resolved before any data request —
///  [TenantHttpClient] guarantees that by awaiting [Tenant.ensureResolved].
/// ─────────────────────────────────────────────────────────────────────────
class Tenant {
  Tenant._();

  static const String legacyOrgId = 'main';

  static String? _uid;
  static String _orgId = legacyOrgId;
  static Future<String>? _pending;

  /// The resolved org of the signed-in user (legacy org until resolved).
  static String get orgId => _orgId;
  static bool get isLegacy => _orgId == legacyOrgId;

  /// Resolves (and caches per signed-in user) the current organisation id.
  static Future<String> ensureResolved() {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      _uid = null;
      _orgId = legacyOrgId;
      _pending = null;
      return Future.value(legacyOrgId);
    }
    if (_uid == uid && _pending != null) return _pending!;
    _uid = uid;
    _pending = _load(uid);
    return _pending!;
  }

  static Future<String> _load(String uid) async {
    try {
      final snap = await FirebaseFirestore.instance.collection('users').doc(uid).get();
      final org = (snap.data()?['orgId'] as String?)?.trim();
      _orgId = (org == null || org.isEmpty) ? legacyOrgId : org;
    } catch (e) {
      debugPrint('[tenant] could not resolve org, using legacy: $e');
      _orgId = legacyOrgId;
      // Retry on the next call instead of caching a failure.
      final resolved = _orgId;
      _pending = null;
      return resolved;
    }
    return _orgId;
  }

  /// Call on sign-out so the next user re-resolves.
  static void reset() {
    _uid = null;
    _orgId = legacyOrgId;
    _pending = null;
    TenantContextService.instance.clear();
  }

  /// Per-tenant id for singleton rows in the `settings` table. The legacy
  /// org keeps its original ids so existing data is untouched.
  static String settingsId(String key) => isLegacy ? key : '$_orgId:$key';

  /// True when a row belongs to the current org (rows without org_id are legacy).
  static bool owns(Map<String, dynamic> row) =>
      ((row['org_id'] as String?) ?? legacyOrgId) == _orgId;
}

/// Adds `x-org-id` to every Supabase HTTP request (REST, storage, functions),
/// after making sure the org is resolved.
class TenantHttpClient extends http.BaseClient {
  TenantHttpClient([http.Client? inner]) : _inner = inner ?? http.Client();
  final http.Client _inner;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final org = await Tenant.ensureResolved();
    request.headers['x-org-id'] = org;
    return _inner.send(request);
  }

  @override
  void close() => _inner.close();
}

/// Realtime change events can't be scoped per tenant by the server until
/// Firebase is enabled as a Supabase Third-Party Auth provider, so every
/// `.stream()` drops rows that belong to another organisation.
extension TenantStreamScope on Stream<List<Map<String, dynamic>>> {
  Stream<List<Map<String, dynamic>>> tenantScoped() =>
      map((rows) => rows.where(Tenant.owns).toList());
}

/// Firestore helper: scope a `users` query to the current organisation.
extension TenantUsersQuery on Query<Map<String, dynamic>> {
  Query<Map<String, dynamic>> whereSameOrg() =>
      where('orgId', isEqualTo: Tenant.orgId);
}

/// Plan, feature and subscription state from the `saas-api` edge function.
class TenantContext {
  const TenantContext({
    required this.orgId,
    required this.orgName,
    required this.status,
    required this.features,
    required this.isLegacy,
    this.trialEndsAt,
    this.maintenanceMessage,
  });

  final String orgId;
  final String orgName;
  final String status; // trialing | active | past_due | suspended | cancelled | expired
  final List<String> features;
  final bool isLegacy;
  final DateTime? trialEndsAt;
  final String? maintenanceMessage;

  static const all = TenantContext(
    orgId: Tenant.legacyOrgId, orgName: '', status: 'active', features: ['*'], isLegacy: true,
  );

  bool hasModule(String key) => features.contains('*') || features.contains(key);
  bool get isReadOnly => status == 'suspended' || status == 'cancelled' || status == 'expired';
  bool get isPastDue => status == 'past_due';

  int? get trialDaysLeft {
    if (status != 'trialing' || trialEndsAt == null) return null;
    final d = trialEndsAt!.difference(DateTime.now()).inHours / 24;
    return d < 0 ? 0 : d.ceil();
  }

  factory TenantContext.fromMe(Map<String, dynamic> me) {
    final ctx = me['context'] as Map<String, dynamic>?;
    final org = ctx?['org'] as Map<String, dynamic>?;
    final maint = me['maintenance'] as Map<String, dynamic>?;
    if (ctx == null || org == null) return all;
    return TenantContext(
      orgId: org['id'] as String? ?? Tenant.legacyOrgId,
      orgName: org['name'] as String? ?? '',
      status: org['status'] as String? ?? 'active',
      features: ((ctx['features'] as List?) ?? const ['*']).map((e) => '$e').toList(),
      isLegacy: org['is_legacy'] == true,
      trialEndsAt: DateTime.tryParse(org['trial_ends_at'] as String? ?? ''),
      maintenanceMessage: maint?['enabled'] == true
          ? ((maint?['message'] as String?)?.trim().isNotEmpty == true
              ? maint!['message'] as String
              : 'Scheduled maintenance in progress — some features may be briefly unavailable.')
          : null,
    );
  }
}

class TenantContextService {
  TenantContextService._();
  static final instance = TenantContextService._();

  TenantContext? _cached;
  String? _cachedFor;

  void clear() {
    _cached = null;
    _cachedFor = null;
  }

  /// Never throws: on any failure the user keeps full access (we never lock
  /// people out because the plan service is unreachable).
  Future<TenantContext> load({bool force = false}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return TenantContext.all;
    if (!force && _cached != null && _cachedFor == user.uid) return _cached!;
    try {
      final token = await user.getIdToken();
      final res = await http
          .post(
            Uri.parse('${SupabaseConfig.url}/functions/v1/saas-api'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
              'apikey': SupabaseConfig.anonKey,
            },
            body: jsonEncode({'action': 'me'}),
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return _cached ?? TenantContext.all;
      final ctx = TenantContext.fromMe(jsonDecode(res.body) as Map<String, dynamic>);
      _cached = ctx;
      _cachedFor = user.uid;
      return ctx;
    } catch (e) {
      debugPrint('[tenant] plan context unavailable (non-fatal): $e');
      return _cached ?? TenantContext.all;
    }
  }
}

/// Route prefix → module key (same keys as the web app's ROUTE_MODULES).
const Map<String, String> kRouteModules = {
  '/projects': 'projects',
  '/documents': 'documents',
  '/chat': 'chat',
  '/site-diary': 'site_diary',
  '/reports': 'reports',
  '/performance': 'performance',
  '/assets': 'assets',
  '/leave': 'leave',
  '/salary': 'salary',
  '/expenses': 'expenses',
  '/admin/attendance': 'attendance',
  '/admin/audit-log': 'audit_log',
};

String? moduleForRoute(String path) {
  for (final e in kRouteModules.entries) {
    if (path == e.key || path.startsWith('${e.key}/')) return e.value;
  }
  return null;
}
