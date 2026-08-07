import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../data/models/role_model.dart';
import '../data/repositories/role_repository.dart';
import 'user_provider.dart';

final roleRepositoryProvider = Provider<RoleRepository>(
  (ref) => RoleRepository(),
);

final allRolesProvider = StreamProvider<List<RoleModel>>((ref) {
  return ref.watch(roleRepositoryProvider).watchAllRoles();
});

final currentRoleProvider = StreamProvider<RoleModel?>((ref) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null || user.roleId.isEmpty) return Stream.value(null);
  return ref.watch(roleRepositoryProvider).watchRole(user.roleId);
});

/// Resolved permissions map. Falls back to cached permissions if the role
/// stream hasn't loaded yet (e.g. when offline).
///
/// Key guarantee: returns cached permissions during loading so that screens
/// which watched this provider never briefly show "no permission" on startup.
final permissionsProvider = Provider<Map<String, bool>>((ref) {
  final roleAsync = ref.watch(currentRoleProvider);

  return roleAsync.when(
    data: (role) {
      if (role == null) {
        // User has no role — return cached (might have something) or empty.
        return ref.read(_cachedPermissionsProvider).value ?? {};
      }
      final map =
          role.permissions.toMap().map((k, v) => MapEntry(k, v as bool));
      // Cache permissions for offline access and fast startup.
      _cachePermissionsAsync(map);
      return map;
    },
    loading: () {
      // Role stream is still loading — serve cached permissions so that
      // permission-gated screens don't flash "Access Denied" on startup.
      // The cached value may itself still be loading (FutureProvider); in
      // that case we fall through to {} and the isLoading guards in each
      // screen show a spinner instead of a denial page.
      return ref.read(_cachedPermissionsProvider).value ?? {};
    },
    error: (_, __) {
      return ref.read(_cachedPermissionsProvider).value ?? {};
    },
  );
});

/// Cached permissions from SharedPreferences — used as a fallback when offline.
final _cachedPermissionsProvider = FutureProvider<Map<String, bool>>((
  ref,
) async {
  return getCachedPermissions();
});

final hasPermissionProvider = Provider.family<bool, String>((
  ref,
  permissionKey,
) {
  final permissions = ref.watch(permissionsProvider);
  return permissions[permissionKey] ?? false;
});

final roleStreamProvider = StreamProvider.family<RoleModel?, String>((
  ref,
  roleId,
) {
  return ref.watch(roleRepositoryProvider).watchRole(roleId);
});

/// The current user's role level (0 if not yet loaded).
/// Higher level = more authority (Director = 100, Labour = ~10).
final currentRoleLevelProvider = Provider<int>((ref) {
  return ref.watch(currentRoleProvider).value?.level ?? 0;
});

// ── Permission caching for offline access ─────────────────────────────────

void _cachePermissionsAsync(Map<String, bool> permissions) {
  // Fire-and-forget — we don't await this in the provider
  cachePermissions(permissions);
}

Future<void> cachePermissions(Map<String, dynamic> permissions) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('cached_permissions', jsonEncode(permissions));
}

Future<Map<String, bool>> getCachedPermissions() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString('cached_permissions');
  if (raw == null) return {};
  try {
    final map = jsonDecode(raw) as Map<String, dynamic>;
    return map.map((k, v) => MapEntry(k, v as bool));
  } catch (_) {
    return {};
  }
}
