import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:rxdart/rxdart.dart';
import '../models/chat_channel_model.dart';
import '../models/chat_message_model.dart';
import '../services/push_sender.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';

class ChatRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _channels => _db.collection('chats');

  CollectionReference _messages(String channelId) =>
      _channels.doc(channelId).collection('messages');

  // ── Channels ──────────────────────────────────────────────────────────────

  /// Watch the channels visible to [uid]: every channel they are a member of,
  /// PLUS all company announcement channels (which all staff can read via the
  /// chat_view permission) — so company announcements always show in chat.
  ///
  /// Single-field queries only (no composite index needed); archived-filtering
  /// and sorting happen client-side.
  Stream<List<ChatChannelModel>> watchUserChannels(String uid, [int attempt = 0]) async* {
    try {
      List<ChatChannelModel> parse(QuerySnapshot s) =>
          s.docs.map(ChatChannelModel.fromFirestore).toList();

      final mine =
          _channels.where('memberIds', arrayContains: uid).snapshots().map(parse);

      // Announcement channels are readable by all staff; tolerate a permission
      // error (e.g. a custom role without chat_view) by falling back to none.
      final announcements = _channels
          .where('type', isEqualTo: 'announcement')
          .snapshots()
          .map(parse)
          .onErrorReturn(<ChatChannelModel>[]);

      final combined = Rx.combineLatest2<List<ChatChannelModel>, List<ChatChannelModel>,
          List<ChatChannelModel>>(mine, announcements, (a, b) {
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

      await for (final list in combined) {
        yield list;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchUserChannels(uid, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      if (e is FirebaseException) {
        if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
          await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
          yield* watchUserChannels(uid, attempt + 1);
          return;
        }
      }
      throw ErrorTranslator.translate(e);
    }
  }

  /// Watch a single channel
  Stream<ChatChannelModel?> watchChannel(String channelId, [int attempt = 0]) async* {
    try {
      await for (final doc in _channels.doc(channelId).snapshots()) {
        if (!doc.exists) {
          yield null;
        } else {
          yield ChatChannelModel.fromFirestore(doc);
        }
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchChannel(channelId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Create a new channel (group or announcement)
  Future<String> createChannel(ChatChannelModel channel) async {
    try {
      final doc = _channels.doc();
      await doc.set(channel.copyWith().toFirestore()..['id'] = doc.id);
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Deterministic project-channel id so web + mobile share one channel.
  static String projectChannelId(String projectId) => 'project_$projectId';

  /// Create or fetch the project's chat channel (deterministic id).
  Future<String> getOrCreateProjectChannel({
    required String projectId,
    required String projectName,
    required List<String> memberIds,
    required String createdBy,
  }) async {
    try {
      final id = projectChannelId(projectId);
      final ref = _channels.doc(id);
      final snap = await ref.get();
      if (snap.exists) return id;

      // Seed with the project membership, plus the creator so they can
      // immediately read the channel they just created.
      final seededMembers =
          {...memberIds, createdBy}.where((e) => e.isNotEmpty).toList();

      final channel = ChatChannelModel(
        id: id,
        type: ChannelType.project,
        name: projectName,
        description: 'Project channel for $projectName',
        projectId: projectId,
        iconEmoji: '🏗️',
        memberIds: seededMembers,
        adminIds: [createdBy],
        createdBy: createdBy,
        createdAt: DateTime.now(),
        lastMessageText: 'Channel created',
        lastMessageAt: DateTime.now(),
      );

      final data = channel.toFirestore();
      data['id'] = id;
      await ref.set(data);
      return id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Create or fetch DM channel between two users
  Future<String> getOrCreateDmChannel({
    required String myUid,
    required String peerUid,
    required String myName,
    required String peerName,
  }) async {
    try {
      // DM channel id is deterministic: sorted uids joined
      final sortedIds = [myUid, peerUid]..sort();
      final dmId = 'dm_${sortedIds[0]}_${sortedIds[1]}';

      final doc = _channels.doc(dmId);
      final snap = await doc.get();
      if (snap.exists) return dmId;

      await doc.set({
        'id': dmId,
        'type': 'direct',
        'name': '', // derived from peer name in UI
        'description': '',
        'projectId': null,
        'iconEmoji': null,
        'memberIds': sortedIds,
        'adminIds': [],
        'createdBy': myUid,
        'createdAt': AppDateUtils.toTimestamp(DateTime.now()),
        'lastMessageText': '',
        'lastMessageAt': null, // null until first message — avoids fake ordering
        'lastMessageBy': null,
        'isArchived': false,
        'unreadCounts': {},
      });
      return dmId;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Add a member to a channel
  Future<void> addMember(String channelId, String uid) async {
    try {
      await _channels.doc(channelId).update({
        'memberIds': FieldValue.arrayUnion([uid]),
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Remove a member from a channel
  Future<void> removeMember(String channelId, String uid) async {
    try {
      await _channels.doc(channelId).update({
        'memberIds': FieldValue.arrayRemove([uid]),
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Update channel metadata
  Future<void> updateChannel(
    String channelId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _channels.doc(channelId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Soft-delete a conversation: archived channels are hidden from every
  /// member's chat list (watchUserChannels filters out isArchived == true).
  Future<void> archiveChannel(String channelId) async {
    try {
      await _channels.doc(channelId).update({'isArchived': true});
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  /// Watch latest N messages in a channel (real-time)
  Stream<List<ChatMessageModel>> watchMessages(
    String channelId, {
    int limit = 50,
    int attempt = 0,
  }) async* {
    try {
      await for (final s in _messages(channelId)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .snapshots()) {
        yield s.docs.map(ChatMessageModel.fromFirestore).toList();
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchMessages(channelId, limit: limit, attempt: attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Paginate older messages
  Future<List<ChatMessageModel>> loadOlderMessages(
    String channelId, {
    required DocumentSnapshot lastDoc,
    int limit = 30,
  }) async {
    try {
      final snap = await _messages(channelId)
          .orderBy('createdAt', descending: true)
          .startAfterDocument(lastDoc)
          .limit(limit)
          .get();
      return snap.docs.map(ChatMessageModel.fromFirestore).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Send a message and update channel last-message metadata + unread counts
  Future<String> sendMessage({
    required String channelId,
    required ChatMessageModel message,
    required List<String> channelMemberIds,
  }) async {
    try {
      final batch = _db.batch();

      // Write message
      final msgRef = _messages(channelId).doc();
      final data = message.toFirestore();
      data['channelId'] = channelId;
      data['createdAt'] = FieldValue.serverTimestamp();
      batch.set(msgRef, data);

      // Increment unread counts for all members except sender
      final unreadUpdate = <String, dynamic>{};
      for (final uid in channelMemberIds) {
        if (uid != message.senderId) {
          unreadUpdate['unreadCounts.$uid'] = FieldValue.increment(1);
        }
      }

      // Update channel denormalized fields
      final channelUpdate = <String, dynamic>{
        'lastMessageText': message.isDeleted ? '' : _previewText(message),
        'lastMessageAt': FieldValue.serverTimestamp(),
        'lastMessageBy': message.senderId,
        ...unreadUpdate,
      };
      batch.update(_channels.doc(channelId), channelUpdate);

      // Fetch channel details to know type & name
      final channelSnap = await _channels.doc(channelId).get();
      final channelData = channelSnap.exists ? (channelSnap.data() as Map<String, dynamic>?) : null;
      final channelType = channelData?['type'] as String? ?? 'group';
      final channelName = channelData?['name'] as String? ?? 'Group';

      await batch.commit();

      // Fire push to the other channel members (best-effort, non-blocking).
      PushSender.instance.chatMessage(channelId: channelId, messageId: msgRef.id);

      // Also create in-app notification docs for the other members so messages
      // appear in the Notifications screen (best-effort, non-blocking).
      _writeChatNotifications(
        channelId: channelId,
        channelType: channelType,
        channelName: channelName,
        senderId: message.senderId,
        memberIds: channelMemberIds,
        previewText: message.isDeleted ? '' : _previewText(message),
      );

      return msgRef.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Mark channel as read for a user (clear unread count)
  Future<void> markAsRead(String channelId, String uid) async {
    try {
      await _channels.doc(channelId).update({'unreadCounts.$uid': 0});
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Edit a message
  Future<void> editMessage(
    String channelId,
    String messageId,
    String newText,
  ) async {
    try {
      await _messages(channelId).doc(messageId).update({
        'text': newText,
        'editedAt': AppDateUtils.toTimestamp(DateTime.now()),
      });
      await _syncChannelPreview(channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Soft-delete a message
  Future<void> deleteMessage(String channelId, String messageId) async {
    try {
      await _messages(
        channelId,
      ).doc(messageId).update({'isDeleted': true, 'text': ''});
      await _syncChannelPreview(channelId);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Toggle emoji reaction
  Future<void> toggleReaction({
    required String channelId,
    required String messageId,
    required String emoji,
    required String uid,
    required bool currentlyReacted,
  }) async {
    try {
      final ref = _messages(channelId).doc(messageId);
      if (currentlyReacted) {
        await ref.update({
          'reactions.$emoji': FieldValue.arrayRemove([uid]),
        });
      } else {
        await ref.update({
          'reactions.$emoji': FieldValue.arrayUnion([uid]),
        });
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── System Messages ───────────────────────────────────────────────────────

  /// Post a system message (task created, status changed, etc.)
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

  // ── Typing Indicators ────────────────────────────────────────────────────

  /// Set (or clear) this user's typing status in a channel
  Future<void> updateTyping(
    String channelId,
    String uid,
    String displayName,
    bool isTyping,
  ) async {
    final ref = _channels.doc(channelId).collection('typing').doc(uid);
    if (isTyping) {
      await ref.set({'name': displayName, 'at': FieldValue.serverTimestamp()});
    } else {
      await ref.delete().catchError((_) {});
    }
  }

  /// Stream the names of users currently typing (excluding self)
  Stream<List<String>> watchTypingNames(String channelId, String myUid, [int attempt = 0]) async* {
    try {
      await for (final snap in _channels
          .doc(channelId)
          .collection('typing')
          .snapshots()) {
        yield snap.docs
            .where((d) => d.id != myUid)
            .map((d) => (d.data()['name'] as String?) ?? '')
            .where((n) => n.isNotEmpty)
            .toSet()
            .toList();
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchTypingNames(channelId, myUid, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Read Receipts ─────────────────────────────────────────────────────────

  /// Store a per-user "last read" timestamp so we can show seen indicators
  Future<void> markAsReadWithTimestamp(String channelId, String uid) async {
    try {
      await _db.runTransaction((tx) async {
        final docRef = _channels.doc(channelId);
        final doc = await tx.get(docRef);
        if (!doc.exists) return;

        tx.update(docRef, {
          'unreadCounts.$uid': 0,
          'lastReadAt.$uid': FieldValue.serverTimestamp(),
        });
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── Project Channel Discovery ─────────────────────────────────────────────

  /// Return the channelId of the project's chat channel if it exists and the
  /// user is a member; null otherwise. Uses the deterministic id.
  Future<String?> findProjectChannelId(String projectId, String uid) async {
    try {
      final id = projectChannelId(projectId);
      final snap = await _channels.doc(id).get();
      if (!snap.exists) return null;
      final data = snap.data() as Map<String, dynamic>;
      final members = List<String>.from(data['memberIds'] ?? const []);
      return members.contains(uid) ? id : null;
    } catch (_) {
      return null;
    }
  }

  /// Keep a project's chat channel membership in sync with the project.
  /// Creates the channel on first call, then upserts memberIds (project members
  /// + manager) on every project edit — so adding a member to a project adds
  /// them to the chat too. Best-effort: never throws.
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
      final ref = _channels.doc(id);
      final snap = await ref.get();
      if (snap.exists) {
        await ref.update({'name': projectName, 'memberIds': members});
      } else {
        final channel = ChatChannelModel(
          id: id,
          type: ChannelType.project,
          name: projectName,
          description: 'Project channel for $projectName',
          projectId: projectId,
          iconEmoji: '🏗️',
          memberIds: members,
          adminIds: managerId.isNotEmpty ? [managerId] : const [],
          createdBy: managerId,
          createdAt: DateTime.now(),
          lastMessageText: 'Project channel created',
          lastMessageAt: DateTime.now(),
        );
        final data = channel.toFirestore();
        data['id'] = id;
        await ref.set(data);
      }
    } catch (_) {
      // best-effort — chat sync must not block saving the project
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String _previewText(ChatMessageModel msg) {
    switch (msg.type) {
      case MessageType.image:
        return '📷 Photo';
      case MessageType.file:
        return '📎 ${msg.attachmentName ?? 'File'}';
      case MessageType.taskRef:
        return '📌 ${msg.taskTitle ?? 'Task'}';
      case MessageType.system:
        return msg.text;
      case MessageType.text:
        return msg.text.length > 80
            ? '${msg.text.substring(0, 80)}…'
            : msg.text;
    }
  }

  Future<void> _syncChannelPreview(String channelId) async {
    // Pull the most recent messages and use the latest one that is NOT deleted
    // as the channel preview. This keeps deleted messages from showing up as
    // "Message deleted" in the chat list — the preview reflects real content.
    final recent = await _messages(
      channelId,
    ).orderBy('createdAt', descending: true).limit(20).get();

    ChatMessageModel? lastVisible;
    for (final doc in recent.docs) {
      final msg = ChatMessageModel.fromFirestore(doc);
      if (!msg.isDeleted) {
        lastVisible = msg;
        break;
      }
    }

    if (lastVisible == null) {
      // No visible messages left (channel empty or all messages deleted).
      await _channels.doc(channelId).update({
        'lastMessageText': '',
        'lastMessageBy': null,
        'lastMessageAt': null,
      });
      return;
    }

    await _channels.doc(channelId).update({
      'lastMessageText': _previewText(lastVisible),
      'lastMessageBy': lastVisible.senderId,
      'lastMessageAt': AppDateUtils.toTimestamp(lastVisible.createdAt),
    });
  }

  Stream<int> watchTotalUnread(String uid, [int attempt = 0]) async* {
    try {
      await for (final snap in _channels
          .where('memberIds', arrayContains: uid)
          .where('isArchived', isEqualTo: false)
          .snapshots()) {
        int total = 0;
        for (final doc in snap.docs) {
          final channel = ChatChannelModel.fromFirestore(doc);
          total += channel.unreadFor(uid);
        }
        yield total;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchTotalUnread(uid, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // ── In-app notification for chat messages ─────────────────────────────
  // Best-effort, fire-and-forget. Never blocks the send flow.
  Future<void> _writeChatNotifications({
    required String channelId,
    required String channelType,
    required String channelName,
    required String senderId,
    required List<String> memberIds,
    required String previewText,
  }) async {
    try {
      final notifCollection = _db.collection('notifications');

      // Fetch sender name
      String senderName = 'Someone';
      try {
        final senderSnap = await _db.collection('users').doc(senderId).get();
        if (senderSnap.exists) {
          senderName = (senderSnap.data() as Map<String, dynamic>)['name'] as String? ?? 'Someone';
        }
      } catch (_) {}

      final isAnnouncement = channelType == 'announcement';

      for (final uid in memberIds) {
        if (uid == senderId) continue;

        // Check user preferences
        try {
          final userSnap = await _db.collection('users').doc(uid).get();
          if (userSnap.exists) {
            final userData = userSnap.data() as Map<String, dynamic>;
            final rawPrefs = userData['preferences'] as Map<String, dynamic>? ?? {};
            final announcementsEnabled = rawPrefs['announcements'] as bool? ?? true;
            final chatsEnabled = rawPrefs['chats'] as bool? ?? true;

            if (isAnnouncement && !announcementsEnabled) {
              continue;
            }
            if (!isAnnouncement && !chatsEnabled) {
              continue;
            }
          }
        } catch (_) {}

        await notifCollection.add({
          'userId': uid,
          'type': isAnnouncement ? 'announcement' : 'chat_message',
          'title': isAnnouncement ? 'Announcement in $channelName' : 'New Message',
          'body': isAnnouncement
              ? '$senderName: $previewText'
              : (previewText.isNotEmpty ? previewText : 'You have a new message'),
          'relatedId': channelId,
          'relatedType': 'chat',
          'isRead': <String, bool>{},
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
    } catch (_) {
      // Ignore — notification delivery must not break chat messaging.
    }
  }
}
