import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum NotificationType {
  taskAssigned,
  taskDue,
  taskOverdue,
  approvalNeeded,
  mention,
  slaBreach,
  dailyDigest,
  chatMessage,
  projectUpdate,
  diaryEntry,
  documentUploaded,
  announcement,
}

extension NotificationTypeX on NotificationType {
  String get value {
    switch (this) {
      case NotificationType.taskAssigned:
        return 'task_assigned';
      case NotificationType.taskDue:
        return 'task_due';
      case NotificationType.taskOverdue:
        return 'task_overdue';
      case NotificationType.approvalNeeded:
        return 'approval_needed';
      case NotificationType.mention:
        return 'mention';
      case NotificationType.slaBreach:
        return 'sla_breach';
      case NotificationType.dailyDigest:
        return 'daily_digest';
      case NotificationType.chatMessage:
        return 'chat_message';
      case NotificationType.projectUpdate:
        return 'project_update';
      case NotificationType.diaryEntry:
        return 'diary_entry';
      case NotificationType.documentUploaded:
        return 'document_uploaded';
      case NotificationType.announcement:
        return 'announcement';
    }
  }

  static NotificationType fromString(String v) =>
      NotificationType.values.firstWhere(
        (e) => e.value == v,
        orElse: () => NotificationType.taskAssigned,
      );
}

class NotificationModel {
  final String id;
  final String userId; // recipient uid, or '' for a broadcast
  final NotificationType type;
  final String title;
  final String body;
  final String relatedId;
  final String relatedType;
  final bool isRead; // resolved for the current user at read time
  final DateTime createdAt;

  const NotificationModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.body,
    required this.relatedId,
    required this.relatedType,
    this.isRead = false,
    required this.createdAt,
  });

  /// Resolve the read state from either schema:
  ///  • web/unified: a map { uid: true }
  ///  • legacy mobile: a plain bool
  static bool _resolveRead(dynamic raw, String currentUid) {
    if (raw is bool) return raw;
    if (raw is Map) return raw[currentUid] == true;
    return false;
  }

  factory NotificationModel.fromFirestore(
    DocumentSnapshot doc, [
    String currentUid = '',
  ]) {
    final data = doc.data() as Map<String, dynamic>;
    return NotificationModel(
      id: doc.id,
      // Prefer the unified `userId`; fall back to the legacy `recipientId`.
      userId: (data['userId'] ?? data['recipientId'] ?? '') as String,
      type: NotificationTypeX.fromString(data['type'] ?? 'task_assigned'),
      title: data['title'] ?? '',
      body: data['body'] ?? '',
      relatedId: data['relatedId'] ?? '',
      relatedType: data['relatedType'] ?? '',
      isRead: _resolveRead(data['isRead'], currentUid),
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
    );
  }

  /// New notifications are unread by everyone, so `isRead` is an empty map.
  Map<String, dynamic> toFirestore() => {
    'userId': userId,
    'type': type.value,
    'title': title,
    'body': body,
    'relatedId': relatedId,
    'relatedType': relatedType,
    'isRead': <String, bool>{},
    'createdAt': AppDateUtils.toTimestamp(createdAt),
  };
}
