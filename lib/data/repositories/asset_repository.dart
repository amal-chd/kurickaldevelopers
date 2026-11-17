import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/asset_model.dart';
import '../../core/utils/error_translator.dart';
import '../../core/tenant/tenant.dart';

class AssetRepository {
  final _supabase = Supabase.instance.client;
  static const _uuid = Uuid();

  // ── Assets ─────────────────────────────────────────────────────────────────

  Stream<List<AssetModel>> watchAssets() {
    return _supabase
        .from('assets')
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .tenantScoped().map((rows) => rows.map(AssetModel.fromRow).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<AssetModel?> watchAsset(String id) {
    return _supabase
        .from('assets')
        .stream(primaryKey: ['id'])
        .eq('id', id)
        .tenantScoped().map((rows) => rows.isEmpty ? null : AssetModel.fromRow(rows.first))
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createAsset(AssetModel asset, String createdBy) async {
    try {
      final row = asset.toRow();
      row['id'] = _uuid.v4();
      row['created_by'] = createdBy;
      row['created_at'] = DateTime.now().toUtc().toIso8601String();
      row['updated_at'] = DateTime.now().toUtc().toIso8601String();
      final res =
          await _supabase.from('assets').insert(row).select('id').single();
      return res['id'] as String;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateAsset(String id, Map<String, dynamic> patch) async {
    try {
      patch['updated_at'] = DateTime.now().toUtc().toIso8601String();
      await _supabase.from('assets').update(patch).eq('id', id);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteAsset(String id) async {
    try {
      await _supabase.from('assets').delete().eq('id', id);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Allocation ───────────────────────────────────────────────────────────────

  /// Allocate an asset to a project and/or person, close any open allocation,
  /// open a new one and flip the asset to In Use.
  Future<void> assignAsset({
    required String assetId,
    String? projectId,
    String? assignedTo,
    required String assignedBy,
    DateTime? expectedReturn,
    String notes = '',
  }) async {
    try {
      // Close any currently-open allocation.
      await _supabase
          .from('asset_assignments')
          .update({'checkin_at': DateTime.now().toUtc().toIso8601String()})
          .eq('asset_id', assetId)
          .isFilter('checkin_at', null);

      await _supabase.from('asset_assignments').insert({
        'id': _uuid.v4(),
        'asset_id': assetId,
        'project_id': projectId,
        'assigned_to': assignedTo,
        'assigned_by': assignedBy,
        'checkout_at': DateTime.now().toUtc().toIso8601String(),
        'expected_return': expectedReturn?.toIso8601String().split('T').first,
        'notes': notes,
      });

      await updateAsset(assetId, {
        'project_id': projectId,
        'assigned_to': assignedTo,
        'status': AssetStatus.inUse.value,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Return an asset — close the open allocation and mark it Available.
  Future<void> returnAsset(String assetId) async {
    try {
      await _supabase
          .from('asset_assignments')
          .update({'checkin_at': DateTime.now().toUtc().toIso8601String()})
          .eq('asset_id', assetId)
          .isFilter('checkin_at', null);
      await updateAsset(assetId, {
        'project_id': null,
        'assigned_to': null,
        'status': AssetStatus.available.value,
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Maintenance ──────────────────────────────────────────────────────────────

  Stream<List<AssetMaintenanceModel>> watchMaintenance(String assetId) {
    return _supabase
        .from('asset_maintenance')
        .stream(primaryKey: ['id'])
        .eq('asset_id', assetId)
        .order('created_at', ascending: false)
        .tenantScoped().map((rows) => rows.map(AssetMaintenanceModel.fromRow).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> logMaintenance(
      AssetMaintenanceModel log, String createdBy) async {
    try {
      final row = log.toRow();
      row['id'] = _uuid.v4();
      row['created_by'] = createdBy;
      row['created_at'] = DateTime.now().toUtc().toIso8601String();
      await _supabase.from('asset_maintenance').insert(row);

      // A scheduled/in-progress repair puts the asset into Maintenance;
      // a completed one returns it to Available.
      if (log.status == 'completed') {
        await updateAsset(log.assetId, {'status': AssetStatus.available.value});
      } else {
        await updateAsset(log.assetId, {'status': AssetStatus.maintenance.value});
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
