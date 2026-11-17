import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/models/asset_model.dart';
import '../../providers/asset_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';

final _money =
    NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String _d(DateTime? d) => d == null ? '—' : DateFormat('d MMM yyyy').format(d);

class AssetDetailScreen extends ConsumerWidget {
  final String assetId;
  const AssetDetailScreen({super.key, required this.assetId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetAsync = ref.watch(assetProvider(assetId));
    final canManage = ref.watch(hasPermissionProvider('assets_manage'));
    final canAssign = ref.watch(hasPermissionProvider('assets_assign'));
    final canMaintain = ref.watch(hasPermissionProvider('assets_maintain'));

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Text('Asset',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800)),
        actions: [
          if (canManage)
            PopupMenuButton<String>(
              onSelected: (v) async {
                if (v == 'edit') context.push('/assets/$assetId/edit');
                if (v == 'delete') {
                  final ok = await _confirm(context, 'Delete this asset?');
                  if (ok) {
                    await ref
                        .read(assetRepositoryProvider)
                        .deleteAsset(assetId);
                    if (context.mounted) context.pop();
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Text('Edit')),
                PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
        ],
      ),
      body: assetAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load asset.\n$e')),
        data: (asset) {
          if (asset == null) {
            return const Center(child: Text('Asset not found.'));
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
            children: [
              _header(asset),
              const SizedBox(height: 14),
              _valuation(asset),
              const SizedBox(height: 14),
              _details(asset),
              const SizedBox(height: 14),
              _allocation(context, ref, asset, canAssign),
              const SizedBox(height: 14),
              _maintenance(context, ref, asset, canMaintain),
            ],
          );
        },
      ),
    );
  }

  // ── Header ──
  Widget _header(AssetModel a) {
    return _card(
      Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: a.status.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(a.category.icon, color: a.status.color, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(a.name,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.onSurface)),
                const SizedBox(height: 4),
                Text(
                    [a.category.label, if (a.code.isNotEmpty) a.code]
                        .join(' · '),
                    style: GoogleFonts.inter(
                        fontSize: 12.5, color: AppTheme.textMuted)),
                const SizedBox(height: 8),
                Row(children: [
                  _pill(a.status.label, a.status.color),
                  const SizedBox(width: 6),
                  _pill('Condition: ${a.condition.label}', AppTheme.textLight),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Valuation / depreciation ──
  Widget _valuation(AssetModel a) {
    final life = a.lifeUsedPercent / 100;
    return _card(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Valuation'),
        const SizedBox(height: 12),
        Row(children: [
          _stat('Purchase', _money.format(a.purchaseCost)),
          _stat('Book value', _money.format(a.bookValue),
              color: AppTheme.success),
          _stat('Salvage', _money.format(a.salvageValue)),
        ]),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Useful life used',
                style: GoogleFonts.inter(
                    fontSize: 12, color: AppTheme.textMuted)),
            Text('${a.lifeUsedPercent.toStringAsFixed(0)}%',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.onSurface)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(100),
          child: LinearProgressIndicator(
            value: life,
            minHeight: 8,
            backgroundColor: AppTheme.divider,
            valueColor: AlwaysStoppedAnimation(
                life > 0.85 ? AppTheme.error : AppTheme.primary),
          ),
        ),
        const SizedBox(height: 6),
        Text(
            '${a.usefulLifeYears.toStringAsFixed(0)} yr life · straight-line depreciation',
            style: GoogleFonts.inter(fontSize: 11, color: AppTheme.textLight)),
      ],
    ));
  }

  // ── Details ──
  Widget _details(AssetModel a) {
    return _card(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Details'),
        const SizedBox(height: 6),
        _kv('Serial no.', a.serialNumber),
        _kv('Manufacturer', a.manufacturer),
        _kv('Model', a.model),
        _kv('Supplier', a.supplier),
        _kv('Purchased', _d(a.purchaseDate)),
        _kv('Warranty',
            a.warrantyExpiry == null
                ? '—'
                : '${_d(a.warrantyExpiry)}${a.warrantyActive ? ' (active)' : ' (expired)'}'),
        if (a.notes.isNotEmpty) _kv('Notes', a.notes),
      ],
    ));
  }

  // ── Allocation ──
  Widget _allocation(
      BuildContext context, WidgetRef ref, AssetModel a, bool canAssign) {
    final projects = ref.watch(projectsProvider).value ?? [];
    final users = ref.watch(allUsersProvider).value ?? [];
    final projName = projects
        .where((p) => p.id == a.projectId)
        .map((p) => p.name)
        .firstOrNull;
    final holder = users
        .where((u) => u.uid == a.assignedTo)
        .map((u) => u.name)
        .firstOrNull;

    return _card(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Allocation'),
        const SizedBox(height: 6),
        _kv('Site / project', projName ?? '—'),
        _kv('Holder', holder ?? '—'),
        if (canAssign) ...[
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _assignSheet(context, ref, a),
                icon: const Icon(Icons.person_add_alt_rounded, size: 18),
                label: const Text('Assign'),
              ),
            ),
            if (a.assignedTo != null || a.projectId != null) ...[
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await ref.read(assetRepositoryProvider).returnAsset(a.id);
                    _toast(context, 'Asset returned');
                  },
                  icon: const Icon(Icons.assignment_return_rounded, size: 18),
                  label: const Text('Return'),
                ),
              ),
            ],
          ]),
        ],
      ],
    ));
  }

  // ── Maintenance ──
  Widget _maintenance(
      BuildContext context, WidgetRef ref, AssetModel a, bool canMaintain) {
    final logsAsync = ref.watch(assetMaintenanceProvider(a.id));
    return _card(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _sectionTitle('Maintenance'),
            if (canMaintain)
              TextButton.icon(
                onPressed: () => _maintSheet(context, ref, a),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Log'),
              ),
          ],
        ),
        logsAsync.when(
          loading: () => const Padding(
              padding: EdgeInsets.all(8),
              child: Center(child: CircularProgressIndicator())),
          error: (_, __) => const Text('Could not load logs'),
          data: (logs) {
            if (logs.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('No maintenance logged yet.',
                    style: GoogleFonts.inter(
                        fontSize: 12.5, color: AppTheme.textLight)),
              );
            }
            return Column(
              children: [
                for (final m in logs) _maintRow(m),
              ],
            );
          },
        ),
      ],
    ));
  }

  Widget _maintRow(AssetMaintenanceModel m) {
    final c = m.type == 'repair'
        ? AppTheme.error
        : m.type == 'inspection'
            ? AppTheme.info
            : AppTheme.success;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 3),
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: c, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    '${m.type[0].toUpperCase()}${m.type.substring(1)} · ${m.status}',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.onSurface)),
                if (m.notes.isNotEmpty)
                  Text(m.notes,
                      style: GoogleFonts.inter(
                          fontSize: 12, color: AppTheme.textMuted)),
                Text(
                    [
                      _d(m.completedDate ?? m.scheduledDate ?? m.createdAt),
                      if (m.cost > 0) _money.format(m.cost),
                      if (m.vendor.isNotEmpty) m.vendor,
                      if (m.nextDueDate != null)
                        'next: ${_d(m.nextDueDate)}',
                    ].join(' · '),
                    style: GoogleFonts.inter(
                        fontSize: 11, color: AppTheme.textLight)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Assign sheet ──
  void _assignSheet(BuildContext context, WidgetRef ref, AssetModel a) {
    String? projectId = a.projectId;
    String? userId = a.assignedTo;
    final projects = ref.read(projectsProvider).value ?? [];
    final users = ref.read(allUsersProvider).value ?? [];
    final me = ref.read(currentUserProvider).value?.uid ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => Padding(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Assign asset',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: projectId,
                isExpanded: true,
                decoration: const InputDecoration(
                    labelText: 'Site / project',
                    border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('None')),
                  for (final p in projects)
                    DropdownMenuItem(value: p.id, child: Text(p.name)),
                ],
                onChanged: (v) => setSt(() => projectId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: userId,
                isExpanded: true,
                decoration: const InputDecoration(
                    labelText: 'Holder', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Unassigned')),
                  for (final u in users)
                    DropdownMenuItem(value: u.uid, child: Text(u.name)),
                ],
                onChanged: (v) => setSt(() => userId = v),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14)),
                  onPressed: () async {
                    await ref.read(assetRepositoryProvider).assignAsset(
                          assetId: a.id,
                          projectId: projectId,
                          assignedTo: userId,
                          assignedBy: me,
                        );
                    if (ctx.mounted) Navigator.pop(ctx);
                    _toast(context, 'Asset assigned');
                  },
                  child: const Text('Save allocation'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Maintenance sheet ──
  void _maintSheet(BuildContext context, WidgetRef ref, AssetModel a) {
    String type = 'routine';
    String status = 'completed';
    final costCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final vendorCtrl = TextEditingController();
    DateTime? nextDue;
    final me = ref.read(currentUserProvider).value?.uid ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => Padding(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Log maintenance',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                Wrap(spacing: 8, children: [
                  for (final t in ['routine', 'repair', 'inspection'])
                    ChoiceChip(
                      label: Text(t[0].toUpperCase() + t.substring(1)),
                      selected: type == t,
                      onSelected: (_) => setSt(() => type = t),
                    ),
                ]),
                const SizedBox(height: 12),
                Wrap(spacing: 8, children: [
                  for (final s in ['completed', 'scheduled', 'in_progress'])
                    ChoiceChip(
                      label: Text(s.replaceAll('_', ' ')),
                      selected: status == s,
                      onSelected: (_) => setSt(() => status = s),
                    ),
                ]),
                const SizedBox(height: 12),
                TextField(
                  controller: costCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Cost (₹)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: vendorCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Vendor (optional)',
                      border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                      labelText: 'Notes', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.event_rounded, size: 18),
                  label: Text(nextDue == null
                      ? 'Set next-due date (optional)'
                      : 'Next due: ${_d(nextDue)}'),
                  onPressed: () async {
                    final d = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (d != null) setSt(() => nextDue = d);
                  },
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14)),
                    onPressed: () async {
                      await ref
                          .read(assetRepositoryProvider)
                          .logMaintenance(
                            AssetMaintenanceModel(
                              id: '',
                              assetId: a.id,
                              type: type,
                              status: status,
                              completedDate: status == 'completed'
                                  ? DateTime.now()
                                  : null,
                              scheduledDate: status != 'completed'
                                  ? DateTime.now()
                                  : null,
                              cost: double.tryParse(costCtrl.text) ?? 0,
                              vendor: vendorCtrl.text.trim(),
                              notes: notesCtrl.text.trim(),
                              nextDueDate: nextDue,
                            ),
                            me,
                          );
                      if (ctx.mounted) Navigator.pop(ctx);
                      _toast(context, 'Maintenance logged');
                    },
                    child: const Text('Save log'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── small helpers ──
  Widget _card(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: AppTheme.softShadow,
        ),
        child: child,
      );

  Widget _sectionTitle(String t) => Text(t,
      style: GoogleFonts.plusJakartaSans(
          fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.onSurface));

  Widget _stat(String label, String value, {Color? color}) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: color ?? AppTheme.onSurface)),
            ),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 11, color: AppTheme.textMuted)),
          ],
        ),
      );

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 110,
                child: Text(k,
                    style: GoogleFonts.inter(
                        fontSize: 12.5, color: AppTheme.textMuted))),
            Expanded(
                child: Text(v.isEmpty ? '—' : v,
                    style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurface))),
          ],
        ),
      );

  Widget _pill(String t, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: c.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(100)),
        child: Text(t,
            style: GoogleFonts.inter(
                fontSize: 10.5, fontWeight: FontWeight.w700, color: c)),
      );

  void _toast(BuildContext context, String msg) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<bool> _confirm(BuildContext context, String msg) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            content: Text(msg),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Confirm')),
            ],
          ),
        ) ??
        false;
  }
}
