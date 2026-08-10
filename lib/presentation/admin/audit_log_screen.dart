import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/repositories/admin_repository.dart';
import '../../data/services/audit_service.dart';
import '../../providers/admin_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

/// Discord-style audit log: a live, filterable activity trail with actor
/// avatars, relative timestamps, per-category filtering, actor filtering and
/// expandable before → after change diffs.
class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  String _category = 'all';
  String _search = '';
  String? _actorId; // null == all actors

  @override
  Widget build(BuildContext context) {
    final logsAsync = ref.watch(auditLogsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Audit Log'),
        actions: [
          // Actor filter — only meaningful once we have data to populate it.
          logsAsync.maybeWhen(
            data: (logs) => _ActorFilterButton(
              logs: logs,
              selectedActorId: _actorId,
              onSelected: (id) => setState(() => _actorId = id),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(auditLogsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search + category filter strip ───────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(
              children: [
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search by member, action or detail…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    isDense: true,
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
                  onChanged: (v) => setState(() => _search = v.toLowerCase().trim()),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _CategoryChip(
                        label: 'All',
                        icon: Icons.dashboard_rounded,
                        selected: _category == 'all',
                        onTap: () => setState(() => _category = 'all'),
                      ),
                      for (final c in AuditCategory.all)
                        _CategoryChip(
                          label: AuditCategory.label(c),
                          icon: _AuditVisual.icon('$c.'),
                          selected: _category == c,
                          onTap: () => setState(() => _category = c),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Live log list ────────────────────────────────────────────────
          Expanded(
            child: logsAsync.when(
              loading: () => const ShimmerList(),
              error: (e, _) => AppErrorWidget(
                message: e.toString(),
                onRetry: () => ref.invalidate(auditLogsProvider),
              ),
              data: (logs) => _buildList(logs),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<AuditLogEntry> logs) {
    final filtered = logs.where((log) {
      final matchCat = _category == 'all' || log.targetType == _category;
      final matchActor = _actorId == null || log.actorId == _actorId;
      final matchSearch =
          _search.isEmpty ||
          log.actorName.toLowerCase().contains(_search) ||
          log.description.toLowerCase().contains(_search) ||
          log.targetName.toLowerCase().contains(_search) ||
          log.action.toLowerCase().contains(_search);
      return matchCat && matchActor && matchSearch;
    }).toList();

    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.history_rounded, size: 48, color: AppTheme.textLight),
            const SizedBox(height: 12),
            Text(
              logs.isEmpty ? 'No activity recorded yet' : 'No entries match your filters',
              style: const TextStyle(color: AppTheme.textMuted),
            ),
          ],
        ),
      );
    }

    // Group by day using human-friendly headers (Today / Yesterday / date).
    final grouped = <String, List<AuditLogEntry>>{};
    for (final log in filtered) {
      grouped.putIfAbsent(_dayHeader(log.timestamp), () => []).add(log);
    }

    final canLoadMore = logs.length >= ref.watch(auditLogLimitProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(auditLogsProvider),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: grouped.length + 1,
        itemBuilder: (_, i) {
          if (i == grouped.length) {
            return _Footer(
              count: filtered.length,
              canLoadMore: canLoadMore,
              onLoadMore: () => ref
                  .read(auditLogLimitProvider.notifier)
                  .update((v) => v + 80),
            );
          }
          final date = grouped.keys.elementAt(i);
          final entries = grouped[date]!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.only(bottom: 10, top: i > 0 ? 20 : 0),
                child: Row(
                  children: [
                    Text(
                      date,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textMuted,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceAlt,
                        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                      ),
                      child: Text(
                        '${entries.length}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textLight,
                        ),
                      ),
                    ),
                  ],
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
                  children: [
                    for (var j = 0; j < entries.length; j++)
                      _LogEntryTile(
                        entry: entries[j],
                        isLast: j == entries.length - 1,
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  static String _dayHeader(DateTime ts) {
    final now = DateTime.now();
    final d = DateTime(ts.year, ts.month, ts.day);
    final today = DateTime(now.year, now.month, now.day);
    final diff = today.difference(d).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    return DateFormat('d MMMM yyyy').format(ts);
  }
}

// ─── Actor filter (appbar popup) ──────────────────────────────────────────────

class _ActorFilterButton extends StatelessWidget {
  final List<AuditLogEntry> logs;
  final String? selectedActorId;
  final ValueChanged<String?> onSelected;

  const _ActorFilterButton({
    required this.logs,
    required this.selectedActorId,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    // Distinct actors present in the current window, most-recent first.
    final seen = <String>{};
    final actors = <MapEntry<String, String>>[];
    for (final l in logs) {
      if (l.actorId.isEmpty || seen.contains(l.actorId)) continue;
      seen.add(l.actorId);
      actors.add(MapEntry(l.actorId, l.actorName));
    }

    return PopupMenuButton<String>(
      tooltip: 'Filter by member',
      icon: Icon(
        selectedActorId == null
            ? Icons.person_search_rounded
            : Icons.person_rounded,
        color: selectedActorId == null ? null : AppTheme.accent,
      ),
      onSelected: (v) => onSelected(v == '__all__' ? null : v),
      itemBuilder: (_) => [
        const PopupMenuItem(value: '__all__', child: Text('All members')),
        const PopupMenuDivider(),
        for (final a in actors)
          PopupMenuItem(
            value: a.key,
            child: Row(
              children: [
                _Avatar(name: a.value, url: '', size: 22),
                const SizedBox(width: 8),
                Flexible(child: Text(a.value, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
      ],
    );
  }
}

// ─── Category chip ────────────────────────────────────────────────────────────

class _CategoryChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        avatar: Icon(
          icon,
          size: 14,
          color: selected ? AppTheme.primary : AppTheme.textMuted,
        ),
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        selectedColor: AppTheme.primary.withValues(alpha: 0.08),
        backgroundColor: AppTheme.surfaceAlt,
        side: BorderSide(
          color: selected ? AppTheme.primary.withValues(alpha: 0.3) : AppTheme.divider,
        ),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? AppTheme.primary : AppTheme.textMuted,
        ),
        onSelected: (_) => onTap(),
      ),
    );
  }
}

// ─── Footer (count + load more) ───────────────────────────────────────────────

class _Footer extends StatelessWidget {
  final int count;
  final bool canLoadMore;
  final VoidCallback onLoadMore;

  const _Footer({
    required this.count,
    required this.canLoadMore,
    required this.onLoadMore,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        children: [
          if (canLoadMore)
            OutlinedButton.icon(
              onPressed: onLoadMore,
              icon: const Icon(Icons.expand_more_rounded, size: 18),
              label: const Text('Load older activity'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.textMuted,
                side: const BorderSide(color: AppTheme.divider),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
              ),
            ),
          const SizedBox(height: 12),
          Text(
            'Showing $count ${count == 1 ? 'entry' : 'entries'}',
            style: const TextStyle(fontSize: 11, color: AppTheme.textLight),
          ),
        ],
      ),
    );
  }
}

// ─── Log entry tile (expandable) ──────────────────────────────────────────────

class _LogEntryTile extends StatefulWidget {
  final AuditLogEntry entry;
  final bool isLast;

  const _LogEntryTile({required this.entry, required this.isLast});

  @override
  State<_LogEntryTile> createState() => _LogEntryTileState();
}

class _LogEntryTileState extends State<_LogEntryTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final e = widget.entry;
    final color = _AuditVisual.color(e.action, e.severity);
    final icon = _AuditVisual.icon(e.action);
    final hasDetails = e.changes.isNotEmpty || e.targetName.isNotEmpty || e.meta.isNotEmpty;

    return Column(
      children: [
        InkWell(
          onTap: hasDetails ? () => setState(() => _expanded = !_expanded) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Actor avatar with a small action badge in the corner.
                SizedBox(
                  width: 40,
                  height: 40,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      _Avatar(name: e.actorName, url: e.actorAvatar, size: 36),
                      Positioned(
                        right: -2,
                        bottom: -2,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: Icon(icon, color: Colors.white, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        _describe(e),
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.35,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              e.actorName.isEmpty ? 'System' : e.actorName,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textMuted,
                              ),
                            ),
                          ),
                          const _Dot(),
                          Text(
                            _relative(e.timestamp),
                            style: const TextStyle(fontSize: 11, color: AppTheme.textLight),
                          ),
                          if (hasDetails) ...[
                            const _Dot(),
                            Icon(
                              _expanded
                                  ? Icons.expand_less_rounded
                                  : Icons.expand_more_rounded,
                              size: 15,
                              color: AppTheme.textLight,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: Text(
                    e.action,
                    style: TextStyle(
                      fontSize: 9,
                      color: color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_expanded) _DetailPanel(entry: e),
        if (!widget.isLast) const Divider(height: 1, indent: 66),
      ],
    );
  }

  /// Rich description: bolds the target name inside the sentence when present.
  InlineSpan _describe(AuditLogEntry e) {
    final desc = e.description.isEmpty ? e.action : e.description;
    if (e.targetName.isNotEmpty && desc.contains(e.targetName)) {
      final idx = desc.indexOf(e.targetName);
      return TextSpan(
        children: [
          TextSpan(text: desc.substring(0, idx)),
          TextSpan(
            text: e.targetName,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: desc.substring(idx + e.targetName.length)),
        ],
      );
    }
    return TextSpan(text: desc, style: const TextStyle(fontWeight: FontWeight.w500));
  }

  static String _relative(DateTime ts) {
    final diff = DateTime.now().difference(ts);
    if (diff.inSeconds < 45) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('HH:mm').format(ts);
  }
}

// ─── Expandable detail panel (change diffs + meta) ────────────────────────────

class _DetailPanel extends StatelessWidget {
  final AuditLogEntry entry;
  const _DetailPanel({required this.entry});

  @override
  Widget build(BuildContext context) {
    final meta = entry.meta.entries
        .where((m) => m.value != null && m.value.toString().isNotEmpty)
        .toList();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(66, 0, 14, 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceAlt,
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (entry.targetName.isNotEmpty) ...[
            _kv('Target', entry.targetName),
            if (entry.changes.isNotEmpty || meta.isNotEmpty) const SizedBox(height: 8),
          ],
          if (entry.changes.isNotEmpty) ...[
            const Text(
              'CHANGES',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: AppTheme.textLight,
              ),
            ),
            const SizedBox(height: 6),
            for (final c in entry.changes) _ChangeRow(change: c),
          ],
          if (meta.isNotEmpty) ...[
            if (entry.changes.isNotEmpty) const SizedBox(height: 8),
            for (final m in meta) _kv(_humanizeKey(m.key), m.value.toString()),
          ],
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
    padding: const EdgeInsets.only(bottom: 3),
    child: RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
        children: [
          TextSpan(
            text: '$k: ',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: v),
        ],
      ),
    ),
  );

  static String _humanizeKey(String k) {
    if (k.isEmpty) return k;
    final spaced = k
        .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
        .replaceAll('_', ' ');
    return spaced[0].toUpperCase() + spaced.substring(1);
  }
}

class _ChangeRow extends StatelessWidget {
  final AuditChange change;
  const _ChangeRow({required this.change});

  @override
  Widget build(BuildContext context) {
    final from = (change.from ?? '').isEmpty ? '—' : change.from!;
    final to = (change.to ?? '').isEmpty ? '—' : change.to!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 84,
            child: Text(
              change.label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              runSpacing: 2,
              children: [
                _pill(from, AppTheme.error),
                const Icon(Icons.arrow_right_alt_rounded, size: 14, color: AppTheme.textLight),
                _pill(to, AppTheme.success),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(
      text,
      style: TextStyle(fontSize: 10.5, color: color, fontWeight: FontWeight.w600),
    ),
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final String name;
  final String url;
  final double size;

  const _Avatar({required this.name, required this.url, this.size = 36});

  @override
  Widget build(BuildContext context) {
    if (url.isNotEmpty) {
      return CircleAvatar(radius: size / 2, backgroundImage: NetworkImage(url));
    }
    final initials = _initials(name);
    final color = _colorFor(name);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        shape: BoxShape.circle,
      ),
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.36,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  static Color _colorFor(String seed) {
    const palette = [
      Color(0xFF3B82F6),
      Color(0xFF8B5CF6),
      Color(0xFF10B981),
      Color(0xFFF59E0B),
      Color(0xFFEF4444),
      Color(0xFF06B6D4),
      Color(0xFFEC4899),
      Color(0xFF6366F1),
    ];
    if (seed.isEmpty) return palette.first;
    return palette[seed.codeUnits.fold(0, (a, b) => a + b) % palette.length];
  }
}

class _Dot extends StatelessWidget {
  const _Dot();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 5),
    child: Text('·', style: TextStyle(fontSize: 11, color: AppTheme.textLight)),
  );
}

// ─── Action → icon/color mapping ──────────────────────────────────────────────

class _AuditVisual {
  static const _iconMap = <String, IconData>{
    'user.created': Icons.person_add_rounded,
    'user.updated': Icons.manage_accounts_rounded,
    'user.deactivated': Icons.person_off_outlined,
    'user.activated': Icons.how_to_reg_rounded,
    'user.deleted': Icons.person_remove_rounded,
    'user.role_changed': Icons.swap_horiz_rounded,
    'user.password_reset': Icons.password_rounded,
    'role.created': Icons.add_moderator_rounded,
    'role.updated': Icons.security_rounded,
    'role.deleted': Icons.remove_moderator_rounded,
    'project.created': Icons.add_business_rounded,
    'project.updated': Icons.edit_note_rounded,
    'project.deleted': Icons.delete_outline_rounded,
    'project.member_added': Icons.group_add_rounded,
    'project.member_removed': Icons.group_remove_rounded,
    'task.created': Icons.add_task_rounded,
    'task.updated': Icons.edit_rounded,
    'task.assigned': Icons.assignment_ind_rounded,
    'task.status_changed': Icons.published_with_changes_rounded,
    'task.deleted': Icons.delete_sweep_rounded,
    'attendance.checked_in': Icons.login_rounded,
    'attendance.checked_out': Icons.logout_rounded,
    'attendance.updated': Icons.edit_calendar_rounded,
    'attendance.auto_checkout': Icons.timer_off_rounded,
    'document.uploaded': Icons.upload_file_rounded,
    'document.deleted': Icons.delete_outline_rounded,
    'site_diary.created': Icons.note_add_rounded,
    'site_diary.deleted': Icons.delete_outline_rounded,
    'settings.updated': Icons.settings_rounded,
    'notification.sent': Icons.campaign_rounded,
    'auth.login': Icons.login_rounded,
    'auth.logout': Icons.logout_rounded,
  };

  static const _categoryFallback = <String, IconData>{
    'user': Icons.person_outline_rounded,
    'role': Icons.shield_outlined,
    'project': Icons.business_outlined,
    'task': Icons.check_circle_outline_rounded,
    'attendance': Icons.access_time_rounded,
    'document': Icons.description_outlined,
    'site_diary': Icons.menu_book_outlined,
    'settings': Icons.settings_outlined,
    'notification': Icons.notifications_outlined,
    'auth': Icons.vpn_key_outlined,
  };

  static IconData icon(String action) {
    final exact = _iconMap[action];
    if (exact != null) return exact;
    final category = action.contains('.') ? action.split('.').first : action;
    return _categoryFallback[category] ?? Icons.history_rounded;
  }

  static Color color(String action, String severity) {
    if (severity == 'critical') return AppTheme.error;
    if (severity == 'warning') return AppTheme.warning;
    final verb = action.contains('.') ? action.split('.').last : action;
    if (verb.contains('delet') || verb.contains('deactivat') || verb.contains('reject')) {
      return AppTheme.error;
    }
    if (verb.contains('creat') ||
        verb.contains('activat') ||
        verb.contains('approve') ||
        verb.contains('added') ||
        verb.contains('checked_in')) {
      return AppTheme.success;
    }
    if (verb.contains('updat') || verb.contains('changed') || verb.contains('assigned')) {
      return AppTheme.info;
    }
    return AppTheme.textMuted;
  }
}
