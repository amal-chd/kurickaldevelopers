import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class TimeLogModel {
  final String id;
  final String userId;
  final DateTime startTime;
  final DateTime? endTime;
  final int durationMinutes;
  final bool isBillable;
  final String notes;

  const TimeLogModel({
    required this.id,
    required this.userId,
    required this.startTime,
    this.endTime,
    this.durationMinutes = 0,
    this.isBillable = true,
    this.notes = '',
  });

  factory TimeLogModel.fromMap(Map<String, dynamic> data, String id) {
    
    return TimeLogModel(
      id: id,
      userId: data['userId'] ?? '',
      startTime:
          AppDateUtils.fromTimestamp(data['startTime']) ?? DateTime.now(),
      endTime: AppDateUtils.fromTimestamp(data['endTime']),
      durationMinutes: data['durationMinutes'] ?? 0,
      isBillable: data['isBillable'] ?? true,
      notes: data['notes'] ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
    'userId': userId,
    'startTime': AppDateUtils.toTimestamp(startTime),
    'endTime': endTime != null ? AppDateUtils.toTimestamp(endTime!) : null,
    'durationMinutes': durationMinutes,
    'isBillable': isBillable,
    'notes': notes,
  };
}
