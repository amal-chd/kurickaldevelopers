import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/models/asset_model.dart';
import '../../providers/asset_provider.dart';
import '../../providers/role_provider.dart';

final _money = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

class AssetsListScreen extends ConsumerStatefulWidget {
  const AssetsListScreen({super.key});
  @override
  ConsumerState<AssetsListScreen> createState() => _AssetsListScreenState();
}

class _AssetsListScreenState extends ConsumerState<AssetsListScreen> {
  String _query = '';
  AssetStatus? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final assetsAsync = ref.watch(assetsProvider);
    final canManage = ref.watch(hasPermissionProvider('assets_manage'));

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text('Assets',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800)),
        backgroundColor: AppTheme.background,
        elevation: 0,
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/assets/create'),
              backgroundColor: AppTheme.primary,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: Text('Add Asset',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w700, color: Colors.white)),
            )
          : null,
      body: assetsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Could not load assets.\n$e',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(color: AppTheme.textMuted)))),
        data: (all) {
          final filtered = all.where((a) {
            final q = _query.trim().toLowerCase();
            final matchesQuery = q.isEmpty ||
                a.name.toLowerCase().contains(q) ||
                a.code.toLowerCase().contains(q) ||
                a.manufacturer.toLowerCase().contains(q);
            final matchesStatus =
                _statusFilter == null || a.status == _statusFilter;
            return matchesQuery && matchesStatus;
          }).toList();

          final totalValue =
              all.fold<double>(0, (s, a) => s + a.bookValue);
          final inUse =
              all.where((a) => a.status == AssetStatus.inUse).length;
          final maint = all
              .where((a) => a.status == AssetStatus.maintenance)
              .length;

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                  child: Row(
                    children: [
                      _summary('Assets', '${all.length}',
                          Icons.inventory_2_rounded, AppTheme.primary),
                      const SizedBox(width: 10),
                      _summary('Book Value', _money.format(totalValue),
                          Icons.savings_rounded, AppTheme.success),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: Row(
                    children: [
                      _summary('In Use', '$inUse',
                          Icons.engineering_rounded, AppTheme.info),
                      const SizedBox(width: 10),
                      _summary('Maintenance', '$maint',
                          Icons.build_rounded, AppTheme.error),
                    ],
                  ),
                ),
              ),
              // Search
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search assets…',
                      prefixIcon: const Icon(Icons.search_rounded),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: AppTheme.divider),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: AppTheme.divider),
                      ),
                    ),
                  ),
                ),
              ),
              // Status filters
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    children: [
                      _chip('All', _statusFilter == null,
                          () => setState(() => _statusFilter = null)),
                      for (final s in AssetStatus.values)
                        _chip(s.label, _statusFilter == s,
                            () => setState(() => _statusFilter = s),
                            color: s.color),
                    ],
                  ),
                ),
              ),
              if (filtered.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.inventory_2_outlined,
                            size: 48, color: AppTheme.textLight),
                        const SizedBox(height: 12),
                        Text('No assets found',
                            style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textMuted)),
                      ],
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  sliver: SliverList.builder(
                    itemCount: filtered.length,
                    itemBuilder: (_, i) => _AssetRow(asset: filtered[i]),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _summary(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 17, color: color),
            ),
            const SizedBox(height: 10),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.onSurface)),
            ),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textMuted)),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool active, VoidCallback onTap, {Color? color}) {
    final c = color ?? AppTheme.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: active ? c : Colors.white,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: active ? c : AppTheme.divider),
          ),
          child: Text(label,
              style: GoogleFonts.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppTheme.textMuted)),
        ),
      ),
    );
  }
}

class _AssetRow extends StatelessWidget {
  final AssetModel asset;
  const _AssetRow({required this.asset});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/assets/${asset.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: asset.status.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(asset.category.icon,
                  color: asset.status.color, size: 22),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(asset.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.onSurface)),
                  const SizedBox(height: 3),
                  Text(
                      [
                        if (asset.code.isNotEmpty) asset.code,
                        asset.category.label,
                        if (asset.location.isNotEmpty) asset.location,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.textMuted)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: asset.status.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(asset.status.label,
                      style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: asset.status.color)),
                ),
                const SizedBox(height: 5),
                Text(_money.format(asset.bookValue),
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.onSurface)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
