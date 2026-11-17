import 'package:flutter/material.dart';

// ─── Enums ────────────────────────────────────────────────────────────────────

enum AssetCategory { equipment, vehicle, tool, machinery, material, other }

extension AssetCategoryX on AssetCategory {
  String get value => name;
  String get label => switch (this) {
        AssetCategory.equipment => 'Equipment',
        AssetCategory.vehicle => 'Vehicle',
        AssetCategory.tool => 'Tool',
        AssetCategory.machinery => 'Machinery',
        AssetCategory.material => 'Material',
        AssetCategory.other => 'Other',
      };
  IconData get icon => switch (this) {
        AssetCategory.equipment => Icons.construction_rounded,
        AssetCategory.vehicle => Icons.local_shipping_rounded,
        AssetCategory.tool => Icons.handyman_rounded,
        AssetCategory.machinery => Icons.precision_manufacturing_rounded,
        AssetCategory.material => Icons.inventory_2_rounded,
        AssetCategory.other => Icons.category_rounded,
      };
  static AssetCategory fromString(String? v) => AssetCategory.values.firstWhere(
        (e) => e.name == v,
        orElse: () => AssetCategory.equipment,
      );
}

enum AssetStatus { available, inUse, maintenance, retired }

extension AssetStatusX on AssetStatus {
  String get value => switch (this) {
        AssetStatus.available => 'available',
        AssetStatus.inUse => 'in_use',
        AssetStatus.maintenance => 'maintenance',
        AssetStatus.retired => 'retired',
      };
  String get label => switch (this) {
        AssetStatus.available => 'Available',
        AssetStatus.inUse => 'In Use',
        AssetStatus.maintenance => 'Maintenance',
        AssetStatus.retired => 'Retired',
      };
  Color get color => switch (this) {
        AssetStatus.available => const Color(0xFF2E9E6B),
        AssetStatus.inUse => const Color(0xFF2F6DA6),
        AssetStatus.maintenance => const Color(0xFFD98A16),
        AssetStatus.retired => const Color(0xFF8A92A0),
      };
  static AssetStatus fromString(String? v) => AssetStatus.values.firstWhere(
        (e) => e.value == v,
        orElse: () => AssetStatus.available,
      );
}

enum AssetCondition { brandNew, good, fair, poor }

extension AssetConditionX on AssetCondition {
  String get value => switch (this) {
        AssetCondition.brandNew => 'new',
        AssetCondition.good => 'good',
        AssetCondition.fair => 'fair',
        AssetCondition.poor => 'poor',
      };
  String get label => switch (this) {
        AssetCondition.brandNew => 'New',
        AssetCondition.good => 'Good',
        AssetCondition.fair => 'Fair',
        AssetCondition.poor => 'Poor',
      };
  static AssetCondition fromString(String? v) => AssetCondition.values.firstWhere(
        (e) => e.value == v,
        orElse: () => AssetCondition.good,
      );
}

// ─── Asset ────────────────────────────────────────────────────────────────────

class AssetModel {
  final String id;
  final String name;
  final String code;
  final AssetCategory category;
  final String serialNumber;
  final String manufacturer;
  final String model;
  final AssetStatus status;
  final AssetCondition condition;
  final DateTime? purchaseDate;
  final double purchaseCost;
  final double salvageValue;
  final double usefulLifeYears;
  final String? projectId;
  final String? assignedTo;
  final String location;
  final List<String> photoUrls;
  final List<String> documentUrls;
  final DateTime? warrantyExpiry;
  final String supplier;
  final String notes;
  final String createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const AssetModel({
    required this.id,
    required this.name,
    this.code = '',
    this.category = AssetCategory.equipment,
    this.serialNumber = '',
    this.manufacturer = '',
    this.model = '',
    this.status = AssetStatus.available,
    this.condition = AssetCondition.good,
    this.purchaseDate,
    this.purchaseCost = 0,
    this.salvageValue = 0,
    this.usefulLifeYears = 5,
    this.projectId,
    this.assignedTo,
    this.location = '',
    this.photoUrls = const [],
    this.documentUrls = const [],
    this.warrantyExpiry,
    this.supplier = '',
    this.notes = '',
    this.createdBy = '',
    this.createdAt,
    this.updatedAt,
  });

  /// Straight-line book value: cost minus accumulated depreciation, floored at
  /// the salvage value. `(cost - salvage) / usefulLifeYears` per year.
  double get bookValue {
    if (purchaseDate == null || usefulLifeYears <= 0) return purchaseCost;
    final years = DateTime.now().difference(purchaseDate!).inDays / 365.25;
    final depreciable = (purchaseCost - salvageValue).clamp(0, double.infinity);
    final depreciated = depreciable * (years / usefulLifeYears);
    final value = purchaseCost - depreciated;
    return value < salvageValue ? salvageValue : value;
  }

  /// 0–100 % of useful life elapsed.
  double get lifeUsedPercent {
    if (purchaseDate == null || usefulLifeYears <= 0) return 0;
    final years = DateTime.now().difference(purchaseDate!).inDays / 365.25;
    return (years / usefulLifeYears * 100).clamp(0, 100).toDouble();
  }

  bool get warrantyActive =>
      warrantyExpiry != null && warrantyExpiry!.isAfter(DateTime.now());

  static double _toDouble(dynamic v) =>
      v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

  static DateTime? _toDate(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse('$v');
  }

  static List<String> _toList(dynamic v) {
    if (v is List) return v.map((e) => '$e').toList();
    return const [];
  }

  factory AssetModel.fromRow(Map<String, dynamic> r) => AssetModel(
        id: '${r['id']}',
        name: r['name'] ?? '',
        code: r['code'] ?? '',
        category: AssetCategoryX.fromString(r['category']),
        serialNumber: r['serial_number'] ?? '',
        manufacturer: r['manufacturer'] ?? '',
        model: r['model'] ?? '',
        status: AssetStatusX.fromString(r['status']),
        condition: AssetConditionX.fromString(r['condition']),
        purchaseDate: _toDate(r['purchase_date']),
        purchaseCost: _toDouble(r['purchase_cost']),
        salvageValue: _toDouble(r['salvage_value']),
        usefulLifeYears: _toDouble(r['useful_life_years']),
        projectId: r['project_id'],
        assignedTo: r['assigned_to'],
        location: r['location'] ?? '',
        photoUrls: _toList(r['photo_urls']),
        documentUrls: _toList(r['document_urls']),
        warrantyExpiry: _toDate(r['warranty_expiry']),
        supplier: r['supplier'] ?? '',
        notes: r['notes'] ?? '',
        createdBy: r['created_by'] ?? '',
        createdAt: _toDate(r['created_at']),
        updatedAt: _toDate(r['updated_at']),
      );

  /// Supabase-ready snake_case row (no id — the repository supplies it).
  Map<String, dynamic> toRow() => {
        'name': name,
        'code': code,
        'category': category.value,
        'serial_number': serialNumber,
        'manufacturer': manufacturer,
        'model': model,
        'status': status.value,
        'condition': condition.value,
        'purchase_date': purchaseDate?.toIso8601String().split('T').first,
        'purchase_cost': purchaseCost,
        'salvage_value': salvageValue,
        'useful_life_years': usefulLifeYears,
        'project_id': projectId,
        'assigned_to': assignedTo,
        'location': location,
        'photo_urls': photoUrls,
        'document_urls': documentUrls,
        'warranty_expiry': warrantyExpiry?.toIso8601String().split('T').first,
        'supplier': supplier,
        'notes': notes,
      };

  AssetModel copyWith({
    String? name,
    AssetStatus? status,
    AssetCondition? condition,
    String? projectId,
    String? assignedTo,
    String? location,
  }) =>
      AssetModel(
        id: id,
        name: name ?? this.name,
        code: code,
        category: category,
        serialNumber: serialNumber,
        manufacturer: manufacturer,
        model: model,
        status: status ?? this.status,
        condition: condition ?? this.condition,
        purchaseDate: purchaseDate,
        purchaseCost: purchaseCost,
        salvageValue: salvageValue,
        usefulLifeYears: usefulLifeYears,
        projectId: projectId ?? this.projectId,
        assignedTo: assignedTo ?? this.assignedTo,
        location: location ?? this.location,
        photoUrls: photoUrls,
        documentUrls: documentUrls,
        warrantyExpiry: warrantyExpiry,
        supplier: supplier,
        notes: notes,
        createdBy: createdBy,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

// ─── Maintenance log ──────────────────────────────────────────────────────────

class AssetMaintenanceModel {
  final String id;
  final String assetId;
  final String type; // routine | repair | inspection
  final String status; // scheduled | in_progress | completed
  final DateTime? scheduledDate;
  final DateTime? completedDate;
  final double cost;
  final String performedBy;
  final String vendor;
  final String notes;
  final DateTime? nextDueDate;
  final DateTime? createdAt;

  const AssetMaintenanceModel({
    required this.id,
    required this.assetId,
    this.type = 'routine',
    this.status = 'completed',
    this.scheduledDate,
    this.completedDate,
    this.cost = 0,
    this.performedBy = '',
    this.vendor = '',
    this.notes = '',
    this.nextDueDate,
    this.createdAt,
  });

  factory AssetMaintenanceModel.fromRow(Map<String, dynamic> r) =>
      AssetMaintenanceModel(
        id: '${r['id']}',
        assetId: '${r['asset_id']}',
        type: r['type'] ?? 'routine',
        status: r['status'] ?? 'completed',
        scheduledDate: AssetModel._toDate(r['scheduled_date']),
        completedDate: AssetModel._toDate(r['completed_date']),
        cost: AssetModel._toDouble(r['cost']),
        performedBy: r['performed_by'] ?? '',
        vendor: r['vendor'] ?? '',
        notes: r['notes'] ?? '',
        nextDueDate: AssetModel._toDate(r['next_due_date']),
        createdAt: AssetModel._toDate(r['created_at']),
      );

  Map<String, dynamic> toRow() => {
        'asset_id': assetId,
        'type': type,
        'status': status,
        'scheduled_date': scheduledDate?.toIso8601String().split('T').first,
        'completed_date': completedDate?.toIso8601String().split('T').first,
        'cost': cost,
        'performed_by': performedBy,
        'vendor': vendor,
        'notes': notes,
        'next_due_date': nextDueDate?.toIso8601String().split('T').first,
      };
}
