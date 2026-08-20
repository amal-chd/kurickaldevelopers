import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum MessageType { text, image, file, taskRef, system }

extension MessageTypeX on MessageType {
  String get value {
    switch (this) {
      case MessageType.text:
        return 'text';
      case MessageType.image:
        return 'image';
      case MessageType.file:
        return 'file';
      case MessageType.taskRef:
        return 'task_ref';
      case MessageType.system:
        return 'system';
    }
  }

  static MessageType fromString(String v) => MessageType.values.firstWhere(
    (e) => e.value == v,
    orElse: () => MessageType.text,
  );
}

class ChatMessageModel {
  final String id;
  final String channelId;
  final String senderId;
  final String text;
  final MessageType type;

  // Attachments (image or file)
  final String? attachmentUrl;
  final String? attachmentName;
  final String? attachmentMimeType;
  final int? attachmentSize;

  // Task reference
  final String? taskId;
  final String? taskTitle;
  final String? taskProjectId;
  final String? taskStatus;

  // Threading (reply-to)
  final String? replyToId;
  final String? replyToText;
  final String? replyToSenderId;
  final String? replyToSenderName;

  // Reactions: emoji → list of uids who reacted
  final Map<String, List<String>> reactions;

  // @mentions: list of user IDs mentioned in this message
  final List<String> mentionedUserIds;

  final DateTime? editedAt;
  final bool isDeleted;
  final DateTime createdAt;

  const ChatMessageModel({
    required this.id,
    required this.channelId,
    required this.senderId,
    required this.text,
    this.type = MessageType.text,
    this.attachmentUrl,
    this.attachmentName,
    this.attachmentMimeType,
    this.attachmentSize,
    this.taskId,
    this.taskTitle,
    this.taskProjectId,
    this.taskStatus,
    this.replyToId,
    this.replyToText,
    this.replyToSenderId,
    this.replyToSenderName,
    this.reactions = const {},
    this.mentionedUserIds = const [],
    this.editedAt,
    this.isDeleted = false,
    required this.createdAt,
  });

  bool get hasReactions => reactions.isNotEmpty;

  int reactionCount(String emoji) => reactions[emoji]?.length ?? 0;

  bool hasReacted(String emoji, String uid) =>
      reactions[emoji]?.contains(uid) ?? false;

  factory ChatMessageModel.fromMap(Map<String, dynamic> data, String id) {
    
    final rawReactions = data['reactions'] as Map<String, dynamic>? ?? {};
    return ChatMessageModel(
      id: id,
      channelId: data['channelId'] ?? '',
      senderId: data['senderId'] ?? '',
      text: data['text'] ?? '',
      type: MessageTypeX.fromString(data['type'] ?? 'text'),
      attachmentUrl: data['attachmentUrl'],
      attachmentName: data['attachmentName'],
      attachmentMimeType: data['attachmentMimeType'],
      attachmentSize: data['attachmentSize'],
      taskId: data['taskId'],
      taskTitle: data['taskTitle'],
      taskProjectId: data['taskProjectId'],
      taskStatus: data['taskStatus'],
      replyToId: data['replyToId'],
      replyToText: data['replyToText'],
      replyToSenderId: data['replyToSenderId'],
      replyToSenderName: data['replyToSenderName'],
      reactions: rawReactions.map(
        (emoji, uids) => MapEntry(emoji, List<String>.from(uids as List)),
      ),
      mentionedUserIds: List<String>.from(data['mentionedUserIds'] ?? []),
      editedAt: AppDateUtils.fromTimestamp(data['editedAt']),
      isDeleted: data['isDeleted'] ?? false,
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'channelId': channelId,
    'senderId': senderId,
    'text': text,
    'type': type.value,
    'attachmentUrl': attachmentUrl,
    'attachmentName': attachmentName,
    'attachmentMimeType': attachmentMimeType,
    'attachmentSize': attachmentSize,
    'taskId': taskId,
    'taskTitle': taskTitle,
    'taskProjectId': taskProjectId,
    'taskStatus': taskStatus,
    'replyToId': replyToId,
    'replyToText': replyToText,
    'replyToSenderId': replyToSenderId,
    'replyToSenderName': replyToSenderName,
    'reactions': reactions.map((k, v) => MapEntry(k, v)),
    'mentionedUserIds': mentionedUserIds,
    'editedAt': editedAt != null ? AppDateUtils.toTimestamp(editedAt!) : null,
    'isDeleted': isDeleted,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
  };
}
