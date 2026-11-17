import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/tenant_provider.dart';

/// Workspace status strip for SaaS organisations: maintenance notices,
/// read-only (expired / suspended / cancelled), payment overdue and trial
/// countdown. Renders nothing for the legacy workspace or while loading.
class TenantStatusBanner extends ConsumerWidget {
  const TenantStatusBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tenantProvider);

    String? text;
    Color color = const Color(0xFF4F46E5);
    IconData icon = Icons.info_outline_rounded;

    if (t.maintenanceMessage != null) {
      text = t.maintenanceMessage;
      color = const Color(0xFF0F172A);
      icon = Icons.build_rounded;
    } else if (t.isLegacy) {
      return const SizedBox.shrink();
    } else if (t.isReadOnly) {
      text = t.status == 'expired'
          ? 'Your free trial has ended — the workspace is read-only. Choose a plan on the web app.'
          : 'This workspace is ${t.status} and read-only. Renew the subscription on the web app.';
      color = const Color(0xFFDC2626);
      icon = Icons.lock_rounded;
    } else if (t.isPastDue) {
      text = "We couldn't process the last payment. Please update billing on the web app.";
      color = const Color(0xFFD97706);
      icon = Icons.warning_amber_rounded;
    } else if (t.trialDaysLeft != null) {
      final d = t.trialDaysLeft!;
      text = d == 0 ? 'Your free trial ends today.' : '$d day${d == 1 ? '' : 's'} left in your free trial.';
    }

    if (text == null) return const SizedBox.shrink();
    return Material(
      color: color,
      child: SafeArea(
        bottom: false,
        child: Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            child: Row(
              children: [
                Icon(icon, size: 16, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
