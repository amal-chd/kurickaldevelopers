import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class CommentModel {
  final String id;
  final String authorId;
  final String text;
  final List<String> mentions;
  final List<String> attachmentUrls;
  final DateTime createdAt;
  final DateTime? editedAt;

  const CommentModel({
    required this.id,
    required this.authorId,
    required this.text,
    this.mentions = const [],
    this.attachmentUrls = const [],
    required this.createdAt,
    this.editedAt,
  });

  factory CommentModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return CommentModel(
      id: doc.id,
      authorId: data['authorId'] ?? '',
      text: data['text'] ?? '',
      mentions: List<String>.from(data['mentions'] ?? []),
      attachmentUrls: List<String>.from(data['attachmentUrls'] ?? []),
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      editedAt: AppDateUtils.fromTimestamp(data['editedAt']),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'authorId': authorId,
    'text': text,
    'mentions': mentions,
    'attachmentUrls': attachmentUrls,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'editedAt': editedAt != null ? AppDateUtils.toTimestamp(editedAt!) : null,
  };
}
