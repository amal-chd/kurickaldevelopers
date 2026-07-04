import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum ChannelType { announcement, project, group, direct }

extension ChannelTypeX on ChannelType {
  String get value {
    switch (this) {
      case ChannelType.announcement:
        return 'announcement';
      case ChannelType.project:
        return 'project';
      case ChannelType.group:
        return 'group';
      case ChannelType.direct:
        return 'direct';
    }
  }

  String get label {
    switch (this) {
      case ChannelType.announcement:
        return 'Announcements';
      case ChannelType.project:
        return 'Project';
      case ChannelType.group:
        return 'Group';
      case ChannelType.direct:
        return 'Direct';
    }
  }

  String get emoji {
    switch (this) {
      case ChannelType.announcement:
        return '📢';
      case ChannelType.project:
        return '🏗️';
      case ChannelType.group:
        return '👥';
      case ChannelType.direct:
        return '💬';
    }
  }

  static ChannelType fromString(String v) => ChannelType.values.firstWhere(
    (e) => e.value == v,
    orElse: () => ChannelType.group,
  );
}

class ChatChannelModel {
  final String id;
  final ChannelType type;
  final String name;
  final String description;
  final String? projectId; // for project channels
  final String? iconEmoji;
  final List<String> memberIds;
  final List<String> adminIds;
  final String createdBy;
  final DateTime createdAt;
  final String lastMessageText;
  final DateTime? lastMessageAt;
  final String? lastMessageBy; // uid of last sender
  final bool isArchived;
  // unread counts per user: { uid: count }
  final Map<String, int> unreadCounts;

  const ChatChannelModel({
    required this.id,
    required this.type,
    required this.name,
    this.description = '',
    this.projectId,
    this.iconEmoji,
    this.memberIds = const [],
    this.adminIds = const [],
    required this.createdBy,
    required this.createdAt,
    this.lastMessageText = '',
    this.lastMessageAt,
    this.lastMessageBy,
    this.isArchived = false,
    this.unreadCounts = const {},
  });

  int unreadFor(String uid) => unreadCounts[uid] ?? 0;

  /// For DM channels, returns the other user's id
  String? dmPeerUid(String myUid) {
    if (type != ChannelType.direct) return null;
    return memberIds.firstWhere((id) => id != myUid, orElse: () => '');
  }

  factory ChatChannelModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ChatChannelModel(
      id: doc.id,
      type: ChannelTypeX.fromString(data['type'] ?? 'group'),
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      projectId: data['projectId'],
      iconEmoji: data['iconEmoji'],
      memberIds: List<String>.from(data['memberIds'] ?? []),
      adminIds: List<String>.from(data['adminIds'] ?? []),
      createdBy: data['createdBy'] ?? '',
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      lastMessageText: data['lastMessageText'] ?? '',
      lastMessageAt: AppDateUtils.fromTimestamp(data['lastMessageAt']),
      lastMessageBy: data['lastMessageBy'],
      isArchived: data['isArchived'] ?? false,
      unreadCounts: Map<String, int>.from(
        (data['unreadCounts'] as Map<String, dynamic>? ?? {}).map(
          (k, v) => MapEntry(k, (v as num).toInt()),
        ),
      ),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'type': type.value,
    'name': name,
    'description': description,
    'projectId': projectId,
    'iconEmoji': iconEmoji,
    'memberIds': memberIds,
    'adminIds': adminIds,
    'createdBy': createdBy,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'lastMessageText': lastMessageText,
    'lastMessageAt': lastMessageAt != null
        ? AppDateUtils.toTimestamp(lastMessageAt!)
        : null,
    'lastMessageBy': lastMessageBy,
    'isArchived': isArchived,
    'unreadCounts': unreadCounts,
  };

  ChatChannelModel copyWith({
    String? name,
    String? description,
    String? iconEmoji,
    List<String>? memberIds,
    List<String>? adminIds,
    String? lastMessageText,
    DateTime? lastMessageAt,
    String? lastMessageBy,
    bool? isArchived,
    Map<String, int>? unreadCounts,
  }) {
    return ChatChannelModel(
      id: id,
      type: type,
      name: name ?? this.name,
      description: description ?? this.description,
      projectId: projectId,
      iconEmoji: iconEmoji ?? this.iconEmoji,
      memberIds: memberIds ?? this.memberIds,
      adminIds: adminIds ?? this.adminIds,
      createdBy: createdBy,
      createdAt: createdAt,
      lastMessageText: lastMessageText ?? this.lastMessageText,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      lastMessageBy: lastMessageBy ?? this.lastMessageBy,
      isArchived: isArchived ?? this.isArchived,
      unreadCounts: unreadCounts ?? this.unreadCounts,
    );
  }
}
