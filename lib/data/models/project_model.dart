import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum ProjectStatus { active, onHold, completed }

extension ProjectStatusX on ProjectStatus {
  String get value {
    switch (this) {
      case ProjectStatus.active:
        return 'active';
      case ProjectStatus.onHold:
        return 'on_hold';
      case ProjectStatus.completed:
        return 'completed';
    }
  }

  String get label {
    switch (this) {
      case ProjectStatus.active:
        return 'Active';
      case ProjectStatus.onHold:
        return 'On Hold';
      case ProjectStatus.completed:
        return 'Completed';
    }
  }

  static ProjectStatus fromString(String v) => ProjectStatus.values.firstWhere(
    (e) => e.value == v,
    orElse: () => ProjectStatus.active,
  );
}

enum HealthStatus { green, amber, red }

extension HealthStatusX on HealthStatus {
  static HealthStatus fromString(String v) => HealthStatus.values.firstWhere(
    (e) => e.name == v,
    orElse: () => HealthStatus.green,
  );
}

class ProjectModel {
  final String id;
  final String name;
  final String description;
  final String siteAddress;
  final String clientName;
  final String projectManagerId;
  final List<String> memberIds;
  final ProjectStatus status;
  final DateTime startDate;
  final DateTime expectedEndDate;
  final DateTime? actualEndDate;
  final int progressPercent;
  final HealthStatus healthStatus;
  final DateTime createdAt;
  final GeoPoint? siteCoordinates;

  const ProjectModel({
    required this.id,
    required this.name,
    required this.description,
    required this.siteAddress,
    required this.clientName,
    required this.projectManagerId,
    this.memberIds = const [],
    this.status = ProjectStatus.active,
    required this.startDate,
    required this.expectedEndDate,
    this.actualEndDate,
    this.progressPercent = 0,
    this.healthStatus = HealthStatus.green,
    required this.createdAt,
    this.siteCoordinates,
  });

  factory ProjectModel.fromMap(Map<String, dynamic> data, String id) {
    
    return ProjectModel(
      id: id,
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      siteAddress: data['siteAddress'] ?? '',
      clientName: data['clientName'] ?? '',
      projectManagerId: data['projectManagerId'] ?? '',
      memberIds: List<String>.from(data['memberIds'] ?? []),
      status: ProjectStatusX.fromString(data['status'] ?? 'active'),
      startDate:
          AppDateUtils.fromTimestamp(data['startDate']) ?? DateTime.now(),
      expectedEndDate:
          AppDateUtils.fromTimestamp(data['expectedEndDate']) ?? DateTime.now(),
      actualEndDate: AppDateUtils.fromTimestamp(data['actualEndDate']),
      progressPercent: (data['progressPercent'] as num?)?.toInt() ?? 0,
      healthStatus: HealthStatusX.fromString(data['healthStatus'] ?? 'green'),
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      // site_coordinates is jsonb {lat,lng} from Supabase (or a GeoPoint from
      // legacy Firestore). Never cast a Map straight to GeoPoint — it crashes.
      siteCoordinates: data['siteCoordinates'] is GeoPoint
          ? data['siteCoordinates'] as GeoPoint
          : (data['siteCoordinates'] is Map
              ? GeoPoint(
                  ((data['siteCoordinates']['lat'] ?? 0) as num).toDouble(),
                  ((data['siteCoordinates']['lng'] ?? 0) as num).toDouble(),
                )
              : null),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'description': description,
    'siteAddress': siteAddress,
    'clientName': clientName,
    'projectManagerId': projectManagerId,
    'memberIds': memberIds,
    'status': status.value,
    'startDate': AppDateUtils.toTimestamp(startDate),
    'expectedEndDate': AppDateUtils.toTimestamp(expectedEndDate),
    'actualEndDate': actualEndDate != null
        ? AppDateUtils.toTimestamp(actualEndDate!)
        : null,
    'progressPercent': progressPercent,
    'healthStatus': healthStatus.name,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    // Serialize GeoPoint as jsonb {lat,lng} — a raw GeoPoint is not
    // JSON-encodable and makes the Supabase write throw.
    'siteCoordinates': siteCoordinates != null
        ? {'lat': siteCoordinates!.latitude, 'lng': siteCoordinates!.longitude}
        : null,
  };
}
