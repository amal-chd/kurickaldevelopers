import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/asset_model.dart';
import '../data/repositories/asset_repository.dart';

final assetRepositoryProvider =
    Provider<AssetRepository>((ref) => AssetRepository());

final assetsProvider = StreamProvider<List<AssetModel>>((ref) {
  return ref.watch(assetRepositoryProvider).watchAssets();
});

final assetProvider =
    StreamProvider.family<AssetModel?, String>((ref, id) {
  return ref.watch(assetRepositoryProvider).watchAsset(id);
});

final assetMaintenanceProvider =
    StreamProvider.family<List<AssetMaintenanceModel>, String>((ref, assetId) {
  return ref.watch(assetRepositoryProvider).watchMaintenance(assetId);
});
