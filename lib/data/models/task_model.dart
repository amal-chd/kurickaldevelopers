import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/enums/task_status.dart';
import '../../core/enums/task_priority.dart';
import '../../core/enums/approval_status.dart';
import '../../core/utils/date_utils.dart';

class TaskModel {
  final String id;
  final String title;
  final String description;
  final String projectId;
  final String? milestoneId;
  final List<String> assigneeIds;
  final String? assignedRoleId;
  final List<String> assignedRoleIds;
  final String createdBy;
  final TaskStatus status;
  final TaskPriority priority;
  final DateTime dueDate;
  final int estimatedHours;
  final int actualHours;
  final List<String> tags;
  final List<String> dependsOn;
  final bool isRecurring;
  final String? recurrenceRule;
  final bool isTemplate;
  final List<String> attachmentUrls;
  final List<String> photoUrls;
  final ApprovalStatus approvalStatus;
  final String? approvedBy;
  final DateTime? approvedAt;
  final DateTime? slaDeadline;
  final bool slaBreached;
  final Map<String, dynamic> memberProgress;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  // New Intelligent Completion Status fields
  final DateTime? completedAt;
  final String? completionStatus;
  final int? delaySeconds;

  const TaskModel({
    required this.id,
    required this.title,
    this.description = '',
    required this.projectId,
    this.milestoneId,
    this.assigneeIds = const [],
    this.assignedRoleId,
    this.assignedRoleIds = const [],
    required this.createdBy,
    this.status = TaskStatus.inProgress,
    this.priority = TaskPriority.medium,
    required this.dueDate,
    this.estimatedHours = 0,
    this.actualHours = 0,
    this.tags = const [],
    this.dependsOn = const [],
    this.isRecurring = false,
    this.recurrenceRule,
    this.isTemplate = false,
    this.attachmentUrls = const [],
    this.photoUrls = const [],
    this.approvalStatus = ApprovalStatus.notRequired,
    this.approvedBy,
    this.approvedAt,
    this.slaDeadline,
    this.slaBreached = false,
    this.memberProgress = const {},
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    this.completionStatus,
    this.delaySeconds,
  });

  factory TaskModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TaskModel(
      id: doc.id,
      title: data['title'] ?? '',
      description: data['description'] ?? '',
      projectId: data['projectId'] ?? '',
      milestoneId: data['milestoneId'],
      assigneeIds: List<String>.from(data['assigneeIds'] ?? []),
      assignedRoleId: data['assignedRoleId'],
      assignedRoleIds: List<String>.from(data['assignedRoleIds'] ??
          (data['assignedRoleId'] != null ? [data['assignedRoleId']] : [])),
      createdBy: data['createdBy'] ?? '',
      status: TaskStatusX.fromString(data['status'] ?? 'created'),
      priority: TaskPriorityX.fromString(data['priority'] ?? 'medium'),
      dueDate: AppDateUtils.fromTimestamp(data['dueDate']) ?? DateTime.now(),
      estimatedHours: data['estimatedHours'] ?? 0,
      actualHours: data['actualHours'] ?? 0,
      tags: List<String>.from(data['tags'] ?? []),
      dependsOn: List<String>.from(data['dependsOn'] ?? []),
      isRecurring: data['isRecurring'] ?? false,
      recurrenceRule: data['recurrenceRule'],
      isTemplate: data['isTemplate'] ?? false,
      attachmentUrls: List<String>.from(data['attachmentUrls'] ?? []),
      photoUrls: List<String>.from(data['photoUrls'] ?? []),
      approvalStatus: ApprovalStatusX.fromString(
        data['approvalStatus'] ?? 'not_required',
      ),
      approvedBy: data['approvedBy'],
      approvedAt: AppDateUtils.fromTimestamp(data['approvedAt']),
      slaDeadline: AppDateUtils.fromTimestamp(data['slaDeadline']),
      slaBreached: data['slaBreached'] ?? false,
      memberProgress: Map<String, dynamic>.from(data['memberProgress'] ?? {}),
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      updatedAt:
          AppDateUtils.fromTimestamp(data['updatedAt']) ?? DateTime.now(),
      completedAt: AppDateUtils.fromTimestamp(data['completedAt']),
      completionStatus: data['completionStatus'],
      delaySeconds: data['delaySeconds'],
    );
  }

  Map<String, dynamic> toFirestore() => {
    'title': title,
    'description': description,
    'projectId': projectId,
    'milestoneId': milestoneId,
    'assigneeIds': assigneeIds,
    'assignedRoleId': assignedRoleId,
    'assignedRoleIds': assignedRoleIds,
    'createdBy': createdBy,
    'status': status.value,
    'priority': priority.value,
    'dueDate': AppDateUtils.toTimestamp(dueDate),
    'estimatedHours': estimatedHours,
    'actualHours': actualHours,
    'tags': tags,
    'dependsOn': dependsOn,
    'isRecurring': isRecurring,
    'recurrenceRule': recurrenceRule,
    'isTemplate': isTemplate,
    'attachmentUrls': attachmentUrls,
    'photoUrls': photoUrls,
    'approvalStatus': approvalStatus.value,
    'approvedBy': approvedBy,
    'approvedAt': approvedAt != null
        ? AppDateUtils.toTimestamp(approvedAt!)
        : null,
    'slaDeadline': slaDeadline != null
        ? AppDateUtils.toTimestamp(slaDeadline!)
        : null,
    'slaBreached': slaBreached,
    'memberProgress': memberProgress,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'updatedAt': AppDateUtils.toTimestamp(updatedAt),
    'completedAt': completedAt != null ? AppDateUtils.toTimestamp(completedAt!) : null,
    'completionStatus': completionStatus,
    'delaySeconds': delaySeconds,
  };

  bool get isOverdue =>
      dueDate.isBefore(DateTime.now()) && status != TaskStatus.done;

  TaskStatus statusForUser(String userId) {
    if (memberProgress.containsKey(userId)) {
      final progress = memberProgress[userId];
      if (progress is Map) {
        final statusStr = progress['status'] as String?;
        if (statusStr != null) {
          return TaskStatusX.fromString(statusStr);
        }
      }
    }
    return status;
  }

  TaskModel copyWith({
    String? title,
    String? description,
    String? milestoneId,
    List<String>? assigneeIds,
    String? assignedRoleId,
    List<String>? assignedRoleIds,
    TaskStatus? status,
    TaskPriority? priority,
    DateTime? dueDate,
    int? estimatedHours,
    List<String>? tags,
    List<String>? attachmentUrls,
    List<String>? photoUrls,
    ApprovalStatus? approvalStatus,
    String? approvedBy,
    DateTime? approvedAt,
    Map<String, dynamic>? memberProgress,
    DateTime? completedAt,
    String? completionStatus,
    int? delaySeconds,
  }) {
    return TaskModel(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      projectId: projectId,
      milestoneId: milestoneId ?? this.milestoneId,
      assigneeIds: assigneeIds ?? this.assigneeIds,
      assignedRoleId: assignedRoleId ?? this.assignedRoleId,
      assignedRoleIds: assignedRoleIds ?? this.assignedRoleIds,
      createdBy: createdBy,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      dueDate: dueDate ?? this.dueDate,
      estimatedHours: estimatedHours ?? this.estimatedHours,
      actualHours: actualHours,
      tags: tags ?? this.tags,
      dependsOn: dependsOn,
      isRecurring: isRecurring,
      recurrenceRule: recurrenceRule,
      isTemplate: isTemplate,
      attachmentUrls: attachmentUrls ?? this.attachmentUrls,
      photoUrls: photoUrls ?? this.photoUrls,
      approvalStatus: approvalStatus ?? this.approvalStatus,
      approvedBy: approvedBy ?? this.approvedBy,
      approvedAt: approvedAt ?? this.approvedAt,
      slaDeadline: slaDeadline,
      slaBreached: slaBreached,
      memberProgress: memberProgress ?? this.memberProgress,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
      completedAt: completedAt ?? this.completedAt,
      completionStatus: completionStatus ?? this.completionStatus,
      delaySeconds: delaySeconds ?? this.delaySeconds,
    );
  }
}
