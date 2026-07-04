import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class SubtaskModel {
  final String id;
  final String title;
  final bool isDone;
  final DateTime? doneAt;
  final String? doneBy;

  const SubtaskModel({
    required this.id,
    required this.title,
    this.isDone = false,
    this.doneAt,
    this.doneBy,
  });

  factory SubtaskModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return SubtaskModel(
      id: doc.id,
      title: data['title'] ?? '',
      isDone: data['isDone'] ?? false,
      doneAt: AppDateUtils.fromTimestamp(data['doneAt']),
      doneBy: data['doneBy'],
    );
  }

  Map<String, dynamic> toFirestore() => {
    'title': title,
    'isDone': isDone,
    'doneAt': doneAt != null ? AppDateUtils.toTimestamp(doneAt!) : null,
    'doneBy': doneBy,
  };

  SubtaskModel copyWith({bool? isDone, DateTime? doneAt, String? doneBy}) {
    return SubtaskModel(
      id: id,
      title: title,
      isDone: isDone ?? this.isDone,
      doneAt: doneAt ?? this.doneAt,
      doneBy: doneBy ?? this.doneBy,
    );
  }
}
