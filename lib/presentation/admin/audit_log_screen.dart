import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/repositories/admin_repository.dart';
import '../../providers/admin_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  String _filter = 'all';
  String _search = '';

  static const _filters = [
    ('all', 'All', Icons.list_rounded),
    ('user', 'Users', Icons.person_outline_rounded),
    ('role', 'Roles', Icons.shield_outlined),
    ('settings', 'Settings', Icons.settings_outlined),
    ('project', 'Projects', Icons.business_outlined),
  ];

  static const _actionMeta = {
    'user.created': (Icons.person_add_rounded, AppTheme.success),
    'user.deactivated': (Icons.person_off_outlined, AppTheme.error),
    'user.activated': (Icons.how_to_reg_rounded, AppTheme.success),
    'user.deleted': (Icons.delete_forever_rounded, AppTheme.error),
    'user.role_changed': (Icons.swap_horiz_rounded, Color(0xFF3B82F6)),
    'role.created': (Icons.add_circle_outline_rounded, Color(0xFF8B5CF6)),
    'role.updated': (Icons.edit_outlined, Color(0xFF8B5CF6)),
    'role.deleted': (Icons.delete_outline_rounded, AppTheme.error),
    'settings.updated': (Icons.settings_outlined, Color(0xFFF59E0B)),
    'project.created': (Icons.add_business_rounded, Color(0xFF059669)),
    'project.deleted': (Icons.delete_outline_rounded, AppTheme.error),
  };

  @override
  Widget build(BuildContext context) {
    final logsAsync = ref.watch(auditLogsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Audit Log'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(auditLogsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Filter Strip ─────────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                // Search
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search by user or action…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      borderSide: const BorderSide(color: AppTheme.divider),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      borderSide: const BorderSide(color: AppTheme.divider),
                    ),
                  ),
                  onChanged: (v) => setState(() => _search = v.toLowerCase()),
                ),
                const SizedBox(height: 10),
                // Filter chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _filters.map((f) {
                      final (key, label, icon) = f;
                      final selected = _filter == key;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          avatar: Icon(
                            icon,
                            size: 14,
                            color: selected
                                ? AppTheme.primary
                                : AppTheme.textMuted,
                          ),
                          label: Text(label),
                          selected: selected,
                          selectedColor: AppTheme.primary.withValues(
                            alpha: 0.08,
                          ),
                          checkmarkColor: AppTheme.primary,
                          labelStyle: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: selected
                                ? AppTheme.primary
                                : AppTheme.textMuted,
                          ),
                          onSelected: (_) => setState(() => _filter = key),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Log List ─────────────────────────────────────────────────────
          Expanded(
            child: logsAsync.when(
              loading: () => const ShimmerList(),
              error: (e, _) => AppErrorWidget(
                message: e.toString(),
                onRetry: () => ref.invalidate(auditLogsProvider),
              ),
              data: (logs) {
                var filtered = logs.where((log) {
                  final matchType =
                      _filter == 'all' || log.targetType == _filter;
                  final matchSearch =
                      _search.isEmpty ||
                      log.actorName.toLowerCase().contains(_search) ||
                      log.description.toLowerCase().contains(_search) ||
                      log.action.toLowerCase().contains(_search);
                  return matchType && matchSearch;
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.history_rounded,
                          size: 48,
                          color: AppTheme.textLight,
                        ),
                        SizedBox(height: 12),
                        Text(
                          'No audit entries found',
                          style: TextStyle(color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  );
                }

                // Group by date
                final grouped = <String, List<AuditLogEntry>>{};
                for (final log in filtered) {
                  final dateKey = DateFormat(
                    'd MMMM yyyy',
                  ).format(log.timestamp);
                  grouped.putIfAbsent(dateKey, () => []).add(log);
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: grouped.length,
                  itemBuilder: (_, i) {
                    final date = grouped.keys.elementAt(i);
                    final entries = grouped[date]!;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(
                            bottom: 10,
                            top: i > 0 ? 20.0 : 0.0,
                          ),
                          child: Text(
                            date,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.02),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            children: entries.asMap().entries.map((e) {
                              final isLast = e.key == entries.length - 1;
                              return _LogEntryTile(
                                entry: e.value,
                                isLast: isLast,
                                actionMeta: _actionMeta,
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Log Entry Tile ───────────────────────────────────────────────────────────

class _LogEntryTile extends StatelessWidget {
  final AuditLogEntry entry;
  final bool isLast;
  final Map<String, (IconData, Color)> actionMeta;

  const _LogEntryTile({
    required this.entry,
    required this.isLast,
    required this.actionMeta,
  });

  @override
  Widget build(BuildContext context) {
    final meta = actionMeta[entry.action];
    final icon = meta?.$1 ?? Icons.history_rounded;
    final color = meta?.$2 ?? AppTheme.textMuted;
    final time = DateFormat('HH:mm').format(entry.timestamp);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.07),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 16),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.description,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          Icons.person_outline_rounded,
                          size: 11,
                          color: AppTheme.textLight,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          entry.actorName.isEmpty ? 'System' : entry.actorName,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    time,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppTheme.textLight,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    ),
                    child: Text(
                      entry.action,
                      style: TextStyle(
                        fontSize: 9,
                        color: color,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (!isLast) const Divider(height: 1, indent: 52),
      ],
    );
  }
}
