import 'package:uuid/uuid.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:rxdart/rxdart.dart';
import '../models/chat_channel_model.dart';
import '../models/chat_message_model.dart';
import '../services/push_sender.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show DocumentSnapshot, SnapshotMetadata, DocumentReference, Timestamp, GeoPoint;


Map<String, dynamic> _toCamelCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    if (key.contains('_')) {
      final parts = key.split('_');
      final camelKey = parts.first + parts.skip(1).map((w) => w.substring(0, 1).toUpperCase() + w.substring(1)).join('');
      map[camelKey] = value;
    } else {
      map[key] = value;
    }
  });

  final dateKeys = [
    'createdAt', 'updatedAt', 'lastMessageAt', 'editedAt', 'lastReadAt',
    'created_at', 'updated_at', 'last_message_at', 'edited_at', 'last_read_at'
  ];
  
  for (final k in dateKeys) {
    if (map.containsKey(k) && map[k] != null && map[k] is String) {
      try {
        map[k] = Timestamp.fromDate(DateTime.parse(map[k]));
      } catch (_) {}
    }
  }
  return map;
}

Map<String, dynamic> _toSnakeCase(Map<String, dynamic> data) {
  final map = <String, dynamic>{};
  data.forEach((key, value) {
    
    if (['description', 'projectId', 'iconEmoji', 'adminIds', 'createdBy'].contains(key)) return;

    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());
    if (value is Timestamp) {
      map[snakeKey] = value.toDate().toIso8601String();
    } else if (value is DateTime) {
      map[snakeKey] = value.toIso8601String();
    } else if (value != null && value.runtimeType.toString().contains('FieldValue')) {
      map[snakeKey] = DateTime.now().toIso8601String();
    } else {
      map[snakeKey] = value;
    }
  });
  return map;
}

class ChatRepository {
  final _supabase = Supabase.instance.client;

  ChatChannelModel _fromChannel(Map<String, dynamic> data) {
    return ChatChannelModel.fromMap(_toCamelCase(data), data['id']);
  }

  ChatMessageModel _fromMessage(Map<String, dynamic> data) {
    return ChatMessageModel.fromMap(_toCamelCase(data), data['id']);
  }

  Stream<List<ChatChannelModel>> watchUserChannels(String uid, [int attempt = 0]) {
    final mine = _supabase.from('chat_channels').stream(primaryKey: ['id'])
        .map((list) => list.where((data) => (data['member_ids'] as List<dynamic>?)?.contains(uid) ?? false).map(_fromChannel).toList());

    final announcements = _supabase.from('chat_channels').stream(primaryKey: ['id'])
        .eq('type', 'announcement')
        .map((list) => list.map(_fromChannel).toList())
        .onErrorReturn(<ChatChannelModel>[]);

    final combined = Rx.combineLatest2<List<ChatChannelModel>, List<ChatChannelModel>, List<ChatChannelModel>>(
      mine, announcements, (a, b) {
      final byId = <String, ChatChannelModel>{};
      for (final c in [...a, ...b]) {
        if (!c.isArchived) byId[c.id] = c;
      }
      final list = byId.values.toList()
        ..sort((x, y) {
          final ax = x.lastMessageAt;
          final ay = y.lastMessageAt;
          if (ax == null && ay == null) return 0;
          if (ax == null) return 1;
          if (ay == null) return -1;
          return ay.compareTo(ax);
        });
      return list;
    });

    return combined.handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<ChatChannelModel?> watchChannel(String channelId, [int attempt = 0]) {
    return _supabase.from('chat_channels').stream(primaryKey: ['id'])
        .eq('id', channelId)
        .map((list) => list.isEmpty ? null : _fromChannel(list.first))
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createChannel(ChatChannelModel channel) async {
    try {
      final data = _toSnakeCase(channel.copyWith().toFirestore());
      final res = await _supabase.from('chat_channels').insert(data).select().single();
      return res['id'] as String;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  static String projectChannelId(String projectId) => 'project_\$projectId';

  Future<String> getOrCreateProjectChannel({
    required String projectId,
    required String projectName,
    required List<String> memberIds,
    required String createdBy,
  }) async {
    try {
      final id = projectChannelId(projectId);
      final snap = await _supabase.from('chat_channels').select().eq('id', id).maybeSingle();
      if (snap != null) return id;

      final seededMembers = {...memberIds, createdBy}.where((e) => e.isNotEmpty).toList();

      final channel = ChatChannelModel(
        id: id,
        type: ChannelType.project,
        name: projectName,
        description: 'Project channel for \$projectName',
        projectId: projectId,
        iconEmoji: '🏗️',
        memberIds: seededMembers,
        adminIds: [createdBy],
        createdBy: createdBy,
        createdAt: DateTime.now(),
        lastMessageText: 'Channel created',
        lastMessageAt: DateTime.now(),
      );

      var data = _toSnakeCase(channel.toFirestore());
      data['id'] = id;
      await _supabase.from('chat_channels').insert(data);
      return id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> getOrCreateDmChannel({
    required String myUid,
    required String peerUid,
    required String myName,
    required String peerName,
  }) async {
    try {
      final sortedIds = [myUid, peerUid]..sort();
      final dmId = 'dm_\${sortedIds[0]}_\${sortedIds[1]}';

      final snap = await _supabase.from('chat_channels').select().eq('id', dmId).maybeSingle();
      if (snap != null) return dmId;

      await _supabase.from('chat_channels').insert({
        'id': dmId,
        'type': 'direct',
        'name': '',
        'description': '',
        'project_id': null,
        'icon_emoji': null,
        'member_ids': sortedIds,
        'admin_ids': [],
        'created_by': myUid,
        'created_at': DateTime.now().toIso8601String(),
        'last_message_text': '',
        'last_message_at': null,
        'last_message_by': null,
        'is_archived': false,
        'unread_counts': {},
      });
      return dmId;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> addMember(String channelId, String uid) async {
    try {
      final doc = await _supabase.from('chat_channels').select('member_ids').eq('id', channelId).single();
      final members = List<String>.from(doc['member_ids'] ?? []);
      if (!members.contains(uid)) {
        members.add(uid);
        await _supabase.from('chat_channels').update({'member_ids': members}).eq('id', channelId);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> removeMember(String channelId, String uid) async {
    try {
      final doc = await _supabase.from('chat_channels').select('member_ids').eq('id', channelId).single();
      final members = List<String>.from(doc['member_ids'] ?? []);
      if (members.contains(uid)) {
        members.remove(uid);
        await _supabase.from('chat_channels').update({'member_ids': members}).eq('id', channelId);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateChannel(String channelId, Map<String, dynamic> data) async {
    try {
      await _supabase.from('chat_channels').update(_toSnakeCase(data)).eq('id', channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> archiveChannel(String channelId) async {
    try {
      await _supabase.from('chat_channels').update({'is_archived': true}).eq('id', channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<ChatMessageModel>> watchMessages(String channelId, {int limit = 50, int attempt = 0}) {
    return _supabase.from('chat_messages').stream(primaryKey: ['id'])
        .eq('channel_id', channelId)
        .order('created_at', ascending: false)
        .limit(limit)
        .map((list) => list.map(_fromMessage).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<List<ChatMessageModel>> loadOlderMessages(String channelId, {required DocumentSnapshot lastDoc, int limit = 30}) async {
    try {
      final lastData = _toSnakeCase(lastDoc.data() as Map<String, dynamic>);
      final snap = await _supabase.from('chat_messages').select()
          .eq('channel_id', channelId)
          .lt('created_at', lastData['created_at'])
          .order('created_at', ascending: false)
          .limit(limit);
      return snap.map(_fromMessage).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> sendMessage({
    required String channelId,
    required ChatMessageModel message,
    required List<String> channelMemberIds,
  }) async {
    try {
      final channelSnap = await _supabase.from('chat_channels').select().eq('id', channelId).maybeSingle();
      final channelData = channelSnap ?? {};
      final unreadCounts = Map<String, dynamic>.from(channelData['unread_counts'] ?? {});
      for (final uid in channelMemberIds) {
        if (uid != message.senderId) {
          unreadCounts[uid] = (unreadCounts[uid] as num? ?? 0) + 1;
        }
      }

      final msgData = _toSnakeCase(message.toFirestore());
      msgData['channel_id'] = channelId;
      msgData['created_at'] = DateTime.now().toIso8601String();
      msgData['id'] = const Uuid().v4();
      final msgRef = await _supabase.from('chat_messages').insert(msgData).select().single();
      final msgId = msgRef['id'] as String;

      final channelUpdate = <String, dynamic>{
        'last_message_text': message.isDeleted ? '' : _previewText(message),
        'last_message_at': DateTime.now().toIso8601String(),
        'last_message_by': message.senderId,
        'unread_counts': unreadCounts,
      };
      await _supabase.from('chat_channels').update(channelUpdate).eq('id', channelId);

      final channelType = channelData['type'] as String? ?? 'group';
      final channelName = channelData['name'] as String? ?? 'Group';

      PushSender.instance.chatMessage(channelId: channelId, messageId: msgId);

      _writeChatNotifications(
        channelId: channelId,
        channelType: channelType,
        channelName: channelName,
        senderId: message.senderId,
        memberIds: channelMemberIds,
        previewText: message.isDeleted ? '' : _previewText(message),
      );

      return msgId;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> markAsRead(String channelId, String uid) async {
    try {
      final doc = await _supabase.from('chat_channels').select('unread_counts').eq('id', channelId).single();
      final unreadCounts = Map<String, dynamic>.from(doc['unread_counts'] ?? {});
      unreadCounts[uid] = 0;
      await _supabase.from('chat_channels').update({'unread_counts': unreadCounts}).eq('id', channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> editMessage(String channelId, String messageId, String newText) async {
    try {
      await _supabase.from('chat_messages').update({
        'text': newText,
        'edited_at': DateTime.now().toIso8601String(),
      }).eq('id', messageId);
      await _syncChannelPreview(channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteMessage(String channelId, String messageId) async {
    try {
      await _supabase.from('chat_messages').update({'is_deleted': true, 'text': ''}).eq('id', messageId);
      await _syncChannelPreview(channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> toggleReaction({
    required String channelId,
    required String messageId,
    required String emoji,
    required String uid,
    required bool currentlyReacted,
  }) async {
    try {
      final doc = await _supabase.from('chat_messages').select('reactions').eq('id', messageId).single();
      final reactions = Map<String, dynamic>.from(doc['reactions'] ?? {});
      final users = List<String>.from(reactions[emoji] ?? []);
      
      if (currentlyReacted) {
        users.remove(uid);
      } else {
        if (!users.contains(uid)) users.add(uid);
      }
      reactions[emoji] = users;
      
      await _supabase.from('chat_messages').update({'reactions': reactions}).eq('id', messageId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> postSystemMessage({
    required String channelId,
    required String text,
    String? taskId,
    String? taskTitle,
    List<String> memberIds = const [],
  }) async {
    final msg = ChatMessageModel(
      id: '',
      channelId: channelId,
      senderId: 'system',
      text: text,
      type: taskId != null ? MessageType.taskRef : MessageType.system,
      taskId: taskId,
      taskTitle: taskTitle,
      createdAt: DateTime.now(),
    );
    await sendMessage(
      channelId: channelId,
      message: msg,
      channelMemberIds: memberIds,
    );
  }

  Future<void> updateTyping(String channelId, String uid, String displayName, bool isTyping) async {
    try {
      if (isTyping) {
        await _supabase.from('chat_typing').upsert({
          'channel_id': channelId,
          'user_id': uid,
          'name': displayName,
          'updated_at': DateTime.now().toIso8601String(),
        });
      } else {
        await _supabase.from('chat_typing').delete().eq('channel_id', channelId).eq('user_id', uid);
      }
    } catch (_) {}
  }

  Stream<List<String>> watchTypingNames(String channelId, String myUid, [int attempt = 0]) {
    return _supabase.from('chat_typing').stream(primaryKey: ['channel_id', 'user_id'])
        .eq('channel_id', channelId)
        .map((list) => list.where((d) => d['user_id'] != myUid).map((d) => (d['name'] as String?) ?? '').where((n) => n.isNotEmpty).toSet().toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> markAsReadWithTimestamp(String channelId, String uid) async {
    try {
      final doc = await _supabase.from('chat_channels').select().eq('id', channelId).single();
      final unreadCounts = Map<String, dynamic>.from(doc['unread_counts'] ?? {});
      final lastReadAt = Map<String, dynamic>.from(doc['last_read_at'] ?? {});
      
      unreadCounts[uid] = 0;
      lastReadAt[uid] = DateTime.now().toIso8601String();
      
      await _supabase.from('chat_channels').update({
        'unread_counts': unreadCounts,
        'last_read_at': lastReadAt,
      }).eq('id', channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String?> findProjectChannelId(String projectId, String uid) async {
    try {
      final id = projectChannelId(projectId);
      final snap = await _supabase.from('chat_channels').select().eq('id', id).maybeSingle();
      if (snap == null) return null;
      final members = List<String>.from(snap['member_ids'] ?? const []);
      return members.contains(uid) ? id : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> syncProjectChannel({
    required String projectId,
    required String projectName,
    required List<String> memberIds,
    required String managerId,
  }) async {
    try {
      final id = projectChannelId(projectId);
      final members = {
        ...memberIds,
        if (managerId.isNotEmpty) managerId,
      }.where((e) => e.isNotEmpty).toList();
      
      final snap = await _supabase.from('chat_channels').select().eq('id', id).maybeSingle();
      if (snap != null) {
        await _supabase.from('chat_channels').update({'name': projectName, 'member_ids': members}).eq('id', id);
      } else {
        final channel = ChatChannelModel(
          id: id,
          type: ChannelType.project,
          name: projectName,
          description: 'Project channel for \$projectName',
          projectId: projectId,
          iconEmoji: '🏗️',
          memberIds: members,
          adminIds: managerId.isNotEmpty ? [managerId] : const [],
          createdBy: managerId,
          createdAt: DateTime.now(),
          lastMessageText: 'Project channel created',
          lastMessageAt: DateTime.now(),
        );
        var data = _toSnakeCase(channel.toFirestore());
        data['id'] = id;
        await _supabase.from('chat_channels').insert(data);
      }
    } catch (_) {}
  }

  String _previewText(ChatMessageModel msg) {
    switch (msg.type) {
      case MessageType.image:
        return '📷 Photo';
      case MessageType.file:
        return '📎 ${msg.attachmentName ?? "File"}';
      case MessageType.taskRef:
        return '📌 ${msg.taskTitle ?? "Task"}';
      case MessageType.system:
        return msg.text;
      case MessageType.text:
        return msg.text.length > 80 ? '\${msg.text.substring(0, 80)}…' : msg.text;
    }
  }

  Future<void> _syncChannelPreview(String channelId) async {
    final recent = await _supabase.from('chat_messages').select()
        .eq('channel_id', channelId)
        .order('created_at', ascending: false)
        .limit(20);

    ChatMessageModel? lastVisible;
    for (final doc in recent) {
      final msg = _fromMessage(doc);
      if (!msg.isDeleted) {
        lastVisible = msg;
        break;
      }
    }

    if (lastVisible == null) {
      await _supabase.from('chat_channels').update({
        'last_message_text': '',
        'last_message_by': null,
        'last_message_at': null,
      }).eq('id', channelId);
      return;
    }

    await _supabase.from('chat_channels').update({
      'last_message_text': _previewText(lastVisible),
      'last_message_by': lastVisible.senderId,
      'last_message_at': lastVisible.createdAt.toIso8601String(),
    }).eq('id', channelId);
  }

  Stream<int> watchTotalUnread(String uid, [int attempt = 0]) {
    return _supabase.from('chat_channels').stream(primaryKey: ['id'])
        .map((list) {
          final filtered = list.where((data) => ((data['member_ids'] as List<dynamic>?)?.contains(uid) ?? false) && data['is_archived'] == false);
          int total = 0;
          for (final doc in filtered) {
            final channel = _fromChannel(doc);
            total += channel.unreadFor(uid);
          }
          return total;
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<void> _writeChatNotifications({
    required String channelId,
    required String channelType,
    required String channelName,
    required String senderId,
    required List<String> memberIds,
    required String previewText,
  }) async {
    try {
      String senderName = 'Someone';
      try {
        final senderSnap = await FirebaseFirestore.instance.collection('users').doc(senderId).get().then((d) => d.exists ? (d.data()!..['id'] = d.id) : null);
        if (senderSnap != null) senderName = senderSnap['name'] as String? ?? 'Someone';
      } catch (_) {}

      final isAnnouncement = channelType == 'announcement';

      for (final uid in memberIds) {
        if (uid == senderId) continue;

        try {
          final userSnap = await FirebaseFirestore.instance.collection('users').doc(uid).get().then((d) => d.exists ? (d.data()!..['id'] = d.id) : null);
          if (userSnap != null) {
            final rawPrefs = userSnap['preferences'] as Map<String, dynamic>? ?? {};
            final announcementsEnabled = rawPrefs['announcements'] as bool? ?? true;
            final chatsEnabled = rawPrefs['chats'] as bool? ?? true;

            if (isAnnouncement && !announcementsEnabled) continue;
            if (!isAnnouncement && !chatsEnabled) continue;
          }
        } catch (_) {}

        await _supabase.from('app_notifications').insert({
        'id': const Uuid().v4(),
          'user_id': uid,
          'type': isAnnouncement ? 'announcement' : 'chat_message',
          'title': isAnnouncement ? 'Announcement in \$channelName' : 'New Message',
          'body': isAnnouncement
              ? '\$senderName: \$previewText'
              : (previewText.isNotEmpty ? previewText : 'You have a new message'),
          'related_id': channelId,
          'related_type': 'chat',
          'is_read': {},
          'created_at': DateTime.now().toIso8601String(),
        });
      }
    } catch (_) {}
  }
}
