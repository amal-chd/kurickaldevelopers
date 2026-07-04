import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum MilestonePhase { foundation, structure, mep, finishing, handover }

extension MilestonePhaseX on MilestonePhase {
  String get value => name;
  String get label => name[0].toUpperCase() + name.substring(1);

  static MilestonePhase fromString(String v) => MilestonePhase.values
      .firstWhere((e) => e.name == v, orElse: () => MilestonePhase.foundation);
}

enum MilestoneStatus { pending, inProgress, completed, delayed }

extension MilestoneStatusX on MilestoneStatus {
  String get value {
    switch (this) {
      case MilestoneStatus.pending:
        return 'pending';
      case MilestoneStatus.inProgress:
        return 'in_progress';
      case MilestoneStatus.completed:
        return 'completed';
      case MilestoneStatus.delayed:
        return 'delayed';
    }
  }

  static MilestoneStatus fromString(String v) => MilestoneStatus.values
      .firstWhere((e) => e.value == v, orElse: () => MilestoneStatus.pending);
}

class MilestoneModel {
  final String id;
  final String name;
  final MilestonePhase phase;
  final DateTime dueDate;
  final DateTime? completedAt;
  final MilestoneStatus status;
  final int progressPercent;

  const MilestoneModel({
    required this.id,
    required this.name,
    required this.phase,
    required this.dueDate,
    this.completedAt,
    required this.status,
    this.progressPercent = 0,
  });

  factory MilestoneModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return MilestoneModel(
      id: doc.id,
      name: data['name'] ?? '',
      phase: MilestonePhaseX.fromString(data['phase'] ?? 'foundation'),
      dueDate: AppDateUtils.fromTimestamp(data['dueDate']) ?? DateTime.now(),
      completedAt: AppDateUtils.fromTimestamp(data['completedAt']),
      status: MilestoneStatusX.fromString(data['status'] ?? 'pending'),
      progressPercent: data['progressPercent'] ?? 0,
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'phase': phase.value,
    'dueDate': AppDateUtils.toTimestamp(dueDate),
    'completedAt': completedAt != null
        ? AppDateUtils.toTimestamp(completedAt!)
        : null,
    'status': status.value,
    'progressPercent': progressPercent,
  };
}
