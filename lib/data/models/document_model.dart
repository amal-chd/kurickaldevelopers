import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/enums/approval_status.dart';
import '../../core/utils/date_utils.dart';

enum DocumentType { drawing, contract, boq, report, photo, other }

extension DocumentTypeX on DocumentType {
  String get value => name;
  String get label => name[0].toUpperCase() + name.substring(1);

  static DocumentType fromString(String v) => DocumentType.values.firstWhere(
    (e) => e.name == v,
    orElse: () => DocumentType.other,
  );
}

class DocumentModel {
  final String id;
  final String projectId;
  final String? taskId;
  final String name;
  final DocumentType type;
  final String fileUrl;
  final int fileSize;
  final String mimeType;
  final int version;
  final List<String> previousVersionIds;
  final List<String> tags;
  final String folder;
  final String uploadedBy;
  final ApprovalStatus approvalStatus;
  final String? approvedBy;
  final DateTime uploadedAt;

  const DocumentModel({
    required this.id,
    required this.projectId,
    this.taskId,
    required this.name,
    required this.type,
    required this.fileUrl,
    this.fileSize = 0,
    required this.mimeType,
    this.version = 1,
    this.previousVersionIds = const [],
    this.tags = const [],
    this.folder = '',
    required this.uploadedBy,
    this.approvalStatus = ApprovalStatus.notRequired,
    this.approvedBy,
    required this.uploadedAt,
  });

  factory DocumentModel.fromMap(Map<String, dynamic> data, String id) {
    
    return DocumentModel(
      id: id,
      projectId: data['projectId'] ?? '',
      taskId: data['taskId'],
      name: data['name'] ?? '',
      type: DocumentTypeX.fromString(data['type'] ?? 'other'),
      fileUrl: data['fileUrl'] ?? '',
      fileSize: (data['fileSize'] as num?)?.toInt() ?? 0,
      mimeType: data['mimeType'] ?? '',
      version: (data['version'] as num?)?.toInt() ?? 1,
      previousVersionIds: List<String>.from(data['previousVersionIds'] ?? []),
      tags: List<String>.from(data['tags'] ?? []),
      folder: data['folder'] ?? '',
      uploadedBy: data['uploadedBy'] ?? '',
      approvalStatus: ApprovalStatusX.fromString(
        data['approvalStatus'] ?? 'not_required',
      ),
      approvedBy: data['approvedBy'],
      uploadedAt:
          AppDateUtils.fromTimestamp(data['uploadedAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'projectId': projectId,
    'taskId': taskId,
    'name': name,
    'type': type.value,
    'fileUrl': fileUrl,
    'fileSize': fileSize,
    'mimeType': mimeType,
    'version': version,
    'previousVersionIds': previousVersionIds,
    'tags': tags,
    'folder': folder,
    'uploadedBy': uploadedBy,
    'approvalStatus': approvalStatus.value,
    'approvedBy': approvedBy,
    'uploadedAt': AppDateUtils.toTimestamp(uploadedAt),
  };
}
