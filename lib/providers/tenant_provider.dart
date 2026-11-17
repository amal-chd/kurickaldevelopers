import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/tenant/tenant.dart';
import 'auth_provider.dart';

/// The signed-in user's organisation plan / feature / subscription context.
/// Falls back to full access on any error — we never lock users out because
/// the plan service is unreachable.
final tenantContextProvider = FutureProvider<TenantContext>((ref) async {
  final user = ref.watch(currentFirebaseUserProvider);
  if (user == null) return TenantContext.all;
  await Tenant.ensureResolved();
  return TenantContextService.instance.load();
});

/// Synchronous view for widgets: full access until the context has loaded.
final tenantProvider = Provider<TenantContext>((ref) {
  return ref.watch(tenantContextProvider).valueOrNull ?? TenantContext.all;
});

/// Whether the current plan includes [module] (route-agnostic module key).
final hasModuleProvider = Provider.family<bool, String>((ref, module) {
  return ref.watch(tenantProvider).hasModule(module);
});
