import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/theme.dart';
import '../../data/models/chat_channel_model.dart';
import '../../data/models/chat_message_model.dart';
import '../../data/models/user_model.dart';
import '../../data/services/storage_service.dart';
import '../../providers/chat_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/user_provider.dart';
import '../../providers/role_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';

class ChatRoomScreen extends ConsumerStatefulWidget {
  final String channelId;
  const ChatRoomScreen({super.key, required this.channelId});

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();
  ProviderSubscription<AsyncValue<List<ChatMessageModel>>>? _messagesSub;

  ChatMessageModel? _replyingTo;
  ChatMessageModel? _editingMsg;
  bool _isSending = false;

  // @mention state
  String? _mentionQuery;
  final List<String> _mentionedUserIds = [];

  // Typing debounce
  Timer? _typingTimer;
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    _textCtrl.addListener(_onTextChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());

    _messagesSub = ref.listenManual<AsyncValue<List<ChatMessageModel>>>(
      channelMessagesProvider(widget.channelId),
      (_, next) {
        if (next.hasValue && (next.value?.isNotEmpty ?? false)) {
          _markRead();
        }
      },
    );

    // Self-correcting read receipts if we are actively in the channel
    ref.listenManual<AsyncValue<ChatChannelModel?>>(
      channelProvider(widget.channelId),
      (_, next) {
        final channel = next.value;
        final uid = ref.read(currentUserProvider).value?.uid;
        if (uid != null &&
            channel != null &&
            (channel.unreadCounts[uid] ?? 0) > 0) {
          _markRead();
        }
      },
    );
  }

  @override
  void dispose() {
    _clearTyping();
    _typingTimer?.cancel();
    _messagesSub?.close();
    _textCtrl.removeListener(_onTextChanged);
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // ── Text listener ──────────────────────────────────────────────────────────

  void _onTextChanged() {
    _detectMention();
    _updateTypingIndicator();
  }

  void _detectMention() {
    final text = _textCtrl.text;
    final selection = _textCtrl.selection;
    if (!selection.isValid || !selection.isCollapsed) {
      if (_mentionQuery != null) setState(() => _mentionQuery = null);
      return;
    }
    final pos = selection.baseOffset.clamp(0, text.length);
    final before = text.substring(0, pos);
    final atIdx = before.lastIndexOf('@');

    String? query;
    if (atIdx >= 0) {
      final segment = before.substring(atIdx + 1);
      if (!segment.contains(' ') && !segment.contains('\n')) {
        query = segment;
      }
    }
    if (query != _mentionQuery) setState(() => _mentionQuery = query);
  }

  void _updateTypingIndicator() {
    final user = ref.read(currentUserProvider).value;
    if (user == null) return;
    final hasText = _textCtrl.text.trim().isNotEmpty;

    if (hasText) {
      if (!_isTyping) {
        _isTyping = true;
        ref
            .read(chatRepositoryProvider)
            .updateTyping(
              widget.channelId,
              user.uid,
              user.name.split(' ').first,
              true,
            );
      }
      _typingTimer?.cancel();
      _typingTimer = Timer(const Duration(seconds: 3), _clearTyping);
    } else {
      _clearTyping();
    }
  }

  void _clearTyping() {
    _typingTimer?.cancel();
    if (!_isTyping) return;
    _isTyping = false;
    final user = ref.read(currentUserProvider).value;
    if (user != null) {
      ref
          .read(chatRepositoryProvider)
          .updateTyping(widget.channelId, user.uid, user.name, false);
    }
  }

  void _markRead() {
    final uid = ref.read(currentUserProvider).value?.uid;
    if (uid != null) {
      ref
          .read(chatRepositoryProvider)
          .markAsReadWithTimestamp(widget.channelId, uid);
    }
  }

  // ── Mention select ─────────────────────────────────────────────────────────

  void _selectMention(UserModel user) {
    final text = _textCtrl.text;
    final selection = _textCtrl.selection;
    final pos = selection.baseOffset.clamp(0, text.length);
    final before = text.substring(0, pos);
    final atIdx = before.lastIndexOf('@');
    if (atIdx < 0) return;

    final after = text.substring(pos);
    final insert = '@${user.name} ';
    final newText = '${text.substring(0, atIdx)}$insert$after';
    _textCtrl.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: atIdx + insert.length),
    );
    if (!_mentionedUserIds.contains(user.uid)) {
      _mentionedUserIds.add(user.uid);
    }
    setState(() => _mentionQuery = null);
    _focusNode.requestFocus();
  }

  // ── Send / edit ────────────────────────────────────────────────────────────

  Future<void> _send() async {
    final text = _textCtrl.text.trim();
    // Block send/edit on empty text in both cases
    if (text.isEmpty) return;

    final user = ref.read(currentUserProvider).value;
    final channel = ref.read(channelProvider(widget.channelId)).value;
    if (user == null || channel == null) return;

    setState(() => _isSending = true);
    _clearTyping();
    _typingTimer?.cancel();

    try {
      if (_editingMsg != null) {
        await ref
            .read(chatRepositoryProvider)
            .editMessage(widget.channelId, _editingMsg!.id, text);
        setState(() {
          _editingMsg = null;
        });
      } else {
        final msg = ChatMessageModel(
          id: '',
          channelId: widget.channelId,
          senderId: user.uid,
          text: text,
          type: MessageType.text,
          replyToId: _replyingTo?.id,
          replyToText: _replyingTo?.text,
          replyToSenderId: _replyingTo?.senderId,
          replyToSenderName: _replyingTo != null
              ? (ref.read(userProvider(_replyingTo!.senderId)).value?.name ?? 'Unknown')
              : null,
          mentionedUserIds: List.from(_mentionedUserIds),
          createdAt: DateTime.now(),
        );
        await ref
            .read(chatRepositoryProvider)
            .sendMessage(
              channelId: widget.channelId,
              message: msg,
              channelMemberIds: channel.memberIds,
            );
        setState(() {
          _replyingTo = null;
        });
        _mentionedUserIds.clear();
        _scrollToBottom();
      }
      _textCtrl.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send message: $e'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _startReply(ChatMessageModel msg) {
    setState(() {
      _replyingTo = msg;
      _editingMsg = null;
    });
    _focusNode.requestFocus();
  }

  void _startEdit(ChatMessageModel msg) {
    setState(() {
      _editingMsg = msg;
      _replyingTo = null;
    });
    _textCtrl.text = msg.text;
    _focusNode.requestFocus();
  }

  void _cancelCompose() {
    setState(() {
      _replyingTo = null;
      _editingMsg = null;
    });
    _textCtrl.clear();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final channelAsync = ref.watch(channelProvider(widget.channelId));
    final messagesAsync = ref.watch(channelMessagesProvider(widget.channelId));
    final currentUser = ref.watch(currentUserProvider).value;
    final canSend = ref.watch(hasPermissionProvider('chat_send'));
    final canModerate = ref.watch(hasPermissionProvider('chat_moderate'));
    final canAnnounce = ref.watch(hasPermissionProvider('chat_announce'));
    final canViewTasks = ref.watch(hasPermissionProvider('tasks_view'));

    final typingAsync = ref.watch(
      typingNamesProvider((
        channelId: widget.channelId,
        myUid: currentUser?.uid ?? '',
      )),
    );
    final typingNames = typingAsync.value ?? [];

    return channelAsync.when(
      loading: () => const Scaffold(body: LoadingWidget()),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(channelProvider(widget.channelId)),
        ),
      ),
      data: (channel) {
        if (channel == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Channel not found')),
          );
        }
        final isAnnouncement = channel.type == ChannelType.announcement;
        final isDirect = channel.type == ChannelType.direct;
        final isProject = channel.type == ChannelType.project;
        // Members of project and direct channels can always post, mirroring the
        // Firestore rules — they don't need the global chat_send permission.
        final isMember = channel.memberIds.contains(currentUser?.uid ?? '');
        final canPost = ((isDirect || isProject) && isMember) ||
            (canSend && (!isAnnouncement || canAnnounce));

        // Seen indicator for DMs: if last message is from me & peer unread = 0
        String? seenLabel;
        if (channel.type == ChannelType.direct) {
          final peerUid = channel.dmPeerUid(currentUser?.uid ?? '');
          if (peerUid != null &&
              (channel.unreadCounts[peerUid] ?? 0) == 0 &&
              channel.lastMessageBy == currentUser?.uid) {
            seenLabel = 'Seen';
          }
        }

        return Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          appBar: AppBar(
            backgroundColor: Colors.white,
            foregroundColor: AppTheme.primary,
            elevation: 0.5,
            title: _AppBarTitle(
              channel: channel,
              currentUid: currentUser?.uid ?? '',
            ),
            actions: [
              Builder(
                builder: (context) {
                  final myUid = currentUser?.uid ?? '';
                  // Who may delete a conversation:
                  //  • either party in a DM
                  //  • the channel creator or a channel admin
                  //  • anyone with the chat_moderate permission
                  final canDelete = channel.type == ChannelType.direct ||
                      channel.createdBy == myUid ||
                      channel.adminIds.contains(myUid) ||
                      canModerate;
                  return PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded),
                    onSelected: (val) {
                      if (val == 'info') {
                        _showChannelInfo(context, channel);
                      } else if (val == 'delete') {
                        _confirmDeleteChannel(context, channel);
                      }
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(
                        value: 'info',
                        child: Row(
                          children: [
                            Icon(Icons.info_outline_rounded, size: 20),
                            SizedBox(width: 10),
                            Text('Conversation info'),
                          ],
                        ),
                      ),
                      if (canDelete)
                        const PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Icons.delete_outline_rounded,
                                  size: 20, color: AppTheme.error),
                              SizedBox(width: 10),
                              Text('Delete conversation',
                                  style: TextStyle(color: AppTheme.error)),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
          body: Column(
            children: [
              // Announcement banner
              if (isAnnouncement && !canPost)
                Container(
                  padding: const EdgeInsets.symmetric(
                    vertical: 8,
                    horizontal: 16,
                  ),
                  color: const Color(0xFFFFF7ED),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.lock_outline_rounded,
                        size: 14,
                        color: AppTheme.accent,
                      ),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Only admins can post in announcement channels.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Message list
              Expanded(
                child: messagesAsync.when(
                  loading: () => const LoadingWidget(),
                  error: (e, _) => AppErrorWidget(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(
                      channelMessagesProvider(widget.channelId),
                    ),
                  ),
                  data: (messages) {
                    if (messages.isEmpty) {
                      return _EmptyMessages(
                        channel: channel,
                        currentUid: currentUser?.uid ?? '',
                      );
                    }
                    return GestureDetector(
                      onTap: () => _focusNode.unfocus(),
                      child: ListView.builder(
                        controller: _scrollCtrl,
                        reverse: true,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 8,
                        ),
                        itemCount:
                            messages.length + (seenLabel != null ? 1 : 0),
                        itemBuilder: (_, i) {
                          // "Seen" row at the very top (index 0 in reversed list = after last msg)
                          if (seenLabel != null && i == 0) {
                            return Align(
                              alignment: Alignment.centerRight,
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  right: 16,
                                  bottom: 2,
                                ),
                                child: Text(
                                  '✓ $seenLabel',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            );
                          }
                          final msgIdx = seenLabel != null ? i - 1 : i;
                          final msg = messages[msgIdx];
                          // In a reversed list, index+1 is the chronologically
                          // earlier message (shown above), index-1 is the later one.
                          final olderMsg = msgIdx < messages.length - 1
                              ? messages[msgIdx + 1]
                              : null;
                          final newerMsg = msgIdx > 0
                              ? messages[msgIdx - 1]
                              : null;
                          final isMe = msg.senderId == currentUser?.uid;
                          final showDay = olderMsg == null ||
                              !_sameDay(msg.createdAt, olderMsg.createdAt);

                          // Avatar & sender name shown only when sender changes
                          // compared to the message shown above (olderMsg).
                          final showAvatar = !isMe &&
                              (olderMsg == null ||
                                  olderMsg.senderId != msg.senderId ||
                                  olderMsg.type == MessageType.system ||
                                  showDay);
                          // Hide name when the next (newer) message in the list
                          // is from the same sender — keep name at top of group.
                          final showSenderName = !isMe &&
                              (newerMsg == null ||
                                  newerMsg.senderId != msg.senderId ||
                                  newerMsg.type == MessageType.system);

                          return Column(
                            children: [
                              if (showDay) _DaySeparator(date: msg.createdAt),
                              _SwipeableMessage(
                                isMe: isMe,
                                onReply: () => _startReply(msg),
                                child: _MessageBubble(
                                  message: msg,
                                  isMe: isMe,
                                  currentUid: currentUser?.uid ?? '',
                                  canModerate: canModerate,
                                  showAvatar: showAvatar,
                                  showSenderName: showSenderName,
                                  onReply: () => _startReply(msg),
                                  onEdit: isMe ? () => _startEdit(msg) : null,
                                  onDelete: (isMe || canModerate)
                                      ? () => _confirmDelete(context, msg)
                                      : null,
                                  onReact: (emoji) => ref
                                      .read(chatRepositoryProvider)
                                      .toggleReaction(
                                        channelId: widget.channelId,
                                        messageId: msg.id,
                                        emoji: emoji,
                                        uid: currentUser?.uid ?? '',
                                        currentlyReacted: msg.hasReacted(
                                          emoji,
                                          currentUser?.uid ?? '',
                                        ),
                                      ),
                                  onTaskTap: (taskId) =>
                                      context.push('/tasks/$taskId'),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    );
                  },
                ),
              ),

              // Typing indicator
              if (typingNames.isNotEmpty) _TypingIndicator(names: typingNames),

              // Compose area
              if (canPost) ...[
                // @mention picker
                if (_mentionQuery != null)
                  _MentionPicker(
                    query: _mentionQuery!,
                    channelMemberIds:
                        ref
                            .watch(channelProvider(widget.channelId))
                            .value
                            ?.memberIds ??
                        [],
                    currentUid: currentUser?.uid ?? '',
                    onSelect: _selectMention,
                  ),

                _ComposeBar(
                  controller: _textCtrl,
                  focusNode: _focusNode,
                  isSending: _isSending,
                  replyingTo: _replyingTo,
                  editingMsg: _editingMsg,
                  canShareTask: canViewTasks,
                  onCancel: _cancelCompose,
                  onSend: _send,
                  onImage: _sendImage,
                  onShareTask: () =>
                      _showTaskPicker(context, channel, currentUser?.uid ?? ''),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  // Pick a file (image or document), upload it to Supabase Storage, and send
  // it as a chat message. Images render inline; other files show as a chip.
  Future<void> _sendImage() async {
    final user = ref.read(currentUserProvider).value;
    final channel = ref.read(channelProvider(widget.channelId)).value;
    if (user == null || channel == null) return;

    final result = await FilePicker.platform.pickFiles(withData: false);
    if (result == null || result.files.single.path == null) return;
    final picked = result.files.single;

    if (picked.size > 25 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File too large (max 25 MB).')),
        );
      }
      return;
    }

    final file = File(picked.path!);
    final ext = (picked.extension ?? '').toLowerCase();
    final isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].contains(ext);
    final mime = _mimeForExt(ext);

    setState(() => _isSending = true);
    try {
      final url = await StorageService().uploadChatFile(
        channelId: widget.channelId,
        file: file,
        mimeType: mime,
      );
      final msg = ChatMessageModel(
        id: '',
        channelId: widget.channelId,
        senderId: user.uid,
        text: picked.name,
        type: isImage ? MessageType.image : MessageType.file,
        attachmentUrl: url,
        attachmentName: picked.name,
        attachmentMimeType: mime,
        attachmentSize: picked.size,
        createdAt: DateTime.now(),
      );
      await ref.read(chatRepositoryProvider).sendMessage(
            channelId: widget.channelId,
            message: msg,
            channelMemberIds: channel.memberIds,
          );
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send file: $e'),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  String _mimeForExt(String ext) {
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      default:
        return 'application/octet-stream';
    }
  }

  void _confirmDelete(BuildContext context, ChatMessageModel msg) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Message'),
        content: const Text('This message will be removed for everyone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            onPressed: () {
              Navigator.pop(ctx);
              ref
                  .read(chatRepositoryProvider)
                  .deleteMessage(widget.channelId, msg.id);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showChannelInfo(BuildContext context, ChatChannelModel channel) {
    final uid = ref.read(currentUserProvider).value?.uid ?? '';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
      ),
      builder: (_) => _ChannelInfoSheet(channel: channel, currentUid: uid),
    );
  }

  void _confirmDeleteChannel(BuildContext context, ChatChannelModel channel) {
    final isDm = channel.type == ChannelType.direct;
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(isDm ? 'Delete conversation' : 'Delete channel'),
        content: Text(
          isDm
              ? 'This conversation will be removed from your chat list. This cannot be undone.'
              : 'This channel will be removed from everyone\'s chat list. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppTheme.error),
            onPressed: () async {
              Navigator.of(dialogCtx).pop();
              final router = GoRouter.of(context);
              final messenger = ScaffoldMessenger.of(context);
              try {
                await ref
                    .read(chatRepositoryProvider)
                    .archiveChannel(channel.id);
                HapticFeedback.mediumImpact();
                if (router.canPop()) {
                  router.pop();
                } else {
                  router.go('/chat');
                }
                messenger.showSnackBar(
                  const SnackBar(content: Text('Conversation deleted')),
                );
              } catch (e) {
                messenger.showSnackBar(
                  SnackBar(content: Text('Failed to delete: $e')),
                );
              }
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showTaskPicker(
    BuildContext context,
    ChatChannelModel channel,
    String senderUid,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
      ),
      builder: (_) => _TaskPickerSheet(
        channelId: widget.channelId,
        senderUid: senderUid,
        channelMemberIds: channel.memberIds,
      ),
    );
  }
}

// ── Swipeable Message (swipe right to reply) ───────────────────────────────────
class _SwipeableMessage extends StatefulWidget {
  final Widget child;
  final bool isMe;
  final VoidCallback onReply;
  const _SwipeableMessage({
    required this.child,
    required this.isMe,
    required this.onReply,
  });

  @override
  State<_SwipeableMessage> createState() => _SwipeableMessageState();
}

class _SwipeableMessageState extends State<_SwipeableMessage>
    with SingleTickerProviderStateMixin {
  double _dragOffset = 0;
  bool _triggered = false;
  late AnimationController _snapCtrl;
  late Animation<double> _snapAnim;

  @override
  void initState() {
    super.initState();
    _snapCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  void dispose() {
    _snapCtrl.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails d) {
    // Allow rightward swipe for both sides (natural thumb gesture)
    final delta = d.delta.dx;
    if (delta < 0 && _dragOffset <= 0) return; // block leftward
    final newOff = (_dragOffset + delta).clamp(0.0, 72.0);
    setState(() => _dragOffset = newOff);
    if (newOff >= 60 && !_triggered) {
      _triggered = true;
      HapticFeedback.mediumImpact();
      widget.onReply();
    }
  }

  void _onDragEnd(DragEndDetails _) {
    _snapAnim = Tween<double>(begin: _dragOffset, end: 0).animate(
      CurvedAnimation(parent: _snapCtrl, curve: Curves.easeOut),
    )..addListener(() => setState(() => _dragOffset = _snapAnim.value));
    _snapCtrl.forward(from: 0);
    setState(() {
      _triggered = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragUpdate: _onDragUpdate,
      onHorizontalDragEnd: _onDragEnd,
      child: Stack(
        children: [
          // Reply icon hint that appears as you swipe
          if (_dragOffset > 8)
            Positioned(
              left: 6,
              top: 0,
              bottom: 0,
              child: Center(
                child: Opacity(
                  opacity: (_dragOffset / 60).clamp(0.0, 1.0),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.reply_rounded,
                      size: 18,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ),
            ),
          Transform.translate(
            offset: Offset(_dragOffset, 0),
            child: widget.child,
          ),
        ],
      ),
    );
  }
}

// ── App Bar Title ──────────────────────────────────────────────────────────────
class _AppBarTitle extends ConsumerWidget {
  final ChatChannelModel channel;
  final String currentUid;
  const _AppBarTitle({required this.channel, required this.currentUid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (channel.type == ChannelType.direct) {
      final peerUid = channel.dmPeerUid(currentUid) ?? '';
      final peerAsync = ref.watch(userProvider(peerUid));
      return peerAsync.when(
        loading: () => const Text('…'),
        error: (_, __) => const Text('Direct Message'),
        data: (peer) => Row(
          children: [
            AvatarWidget(
              name: peer?.name ?? '',
              imageUrl: peer?.avatarUrl,
              size: 32,
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  peer?.name ?? '',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
                Text(
                  peer?.isActive == true ? '🟢 Active Now' : 'Offline',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: peer?.isActive == true
                        ? AppTheme.success
                        : AppTheme.textLight,
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
          ),
          child: Center(
            child: Text(
              channel.iconEmoji ?? channel.type.emoji,
              style: const TextStyle(fontSize: 16),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                channel.name,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.primary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '${channel.memberIds.length} members',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Typing Indicator ───────────────────────────────────────────────────────────
class _TypingIndicator extends StatefulWidget {
  final List<String> names;
  const _TypingIndicator({required this.names});

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _dotCtrl;

  @override
  void initState() {
    super.initState();
    _dotCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _dotCtrl.dispose();
    super.dispose();
  }

  String get _label {
    if (widget.names.length == 1) return '${widget.names.first} is typing…';
    if (widget.names.length == 2) {
      return '${widget.names[0]} and ${widget.names[1]} are typing…';
    }
    return 'Several people are typing…';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white.withValues(alpha: 0.78),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _dotCtrl,
            builder: (_, __) {
              return Row(
                children: List.generate(3, (i) {
                  final progress = (_dotCtrl.value * 3 - i).clamp(0.0, 1.0);
                  final opacity =
                      (progress < 0.5 ? progress * 2 : (1 - progress) * 2)
                          .clamp(0.2, 1.0);
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 1.5),
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: opacity),
                      shape: BoxShape.circle,
                    ),
                  );
                }),
              );
            },
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _label,
              style: const TextStyle(
                fontSize: 12,
                color: AppTheme.textMuted,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── @Mention Picker ────────────────────────────────────────────────────────────
class _MentionPicker extends ConsumerWidget {
  final String query;
  final List<String> channelMemberIds;
  final String currentUid;
  final void Function(UserModel) onSelect;

  const _MentionPicker({
    required this.query,
    required this.channelMemberIds,
    required this.currentUid,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allUsersAsync = ref.watch(allUsersProvider);
    final members =
        allUsersAsync.value
            ?.where(
              (u) =>
                  u.uid != currentUid &&
                  channelMemberIds.contains(u.uid) &&
                  (query.isEmpty ||
                      u.name.toLowerCase().contains(query.toLowerCase())),
            )
            .take(5)
            .toList() ??
        [];

    if (members.isEmpty) return const SizedBox.shrink();

    return Container(
      constraints: const BoxConstraints(maxHeight: 220),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: members.length,
        itemBuilder: (_, i) {
          final u = members[i];
          return ListTile(
            dense: true,
            leading: AvatarWidget(
              name: u.name,
              imageUrl: u.avatarUrl,
              size: 32,
            ),
            title: Text(
              u.name,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              u.email,
              style: const TextStyle(fontSize: 11, color: AppTheme.textLight),
            ),
            onTap: () => onSelect(u),
          );
        },
      ),
    );
  }
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
class _MessageBubble extends ConsumerWidget {
  final ChatMessageModel message;
  final bool isMe;
  final String currentUid;
  final bool canModerate;
  final bool showAvatar;
  final bool showSenderName;
  final VoidCallback onReply;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final void Function(String emoji) onReact;
  final void Function(String taskId) onTaskTap;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.currentUid,
    required this.canModerate,
    required this.onReply,
    required this.onReact,
    required this.onTaskTap,
    this.showAvatar = true,
    this.showSenderName = true,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.type == MessageType.system) {
      return _SystemMessage(text: message.text);
    }

    final senderAsync = ref.watch(userProvider(message.senderId));
    final senderName = senderAsync.value?.name ?? '…';
    final senderAvatar = senderAsync.value?.avatarUrl;

    return GestureDetector(
      onLongPress: () => _showActions(context),
      child: Padding(
        padding: EdgeInsets.only(
          top: showSenderName ? 6 : 1,
          bottom: 1,
          left: isMe ? 60 : 0,
          right: isMe ? 0 : 60,
        ),
        child: Row(
          mainAxisAlignment: isMe
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMe) ...[
              showAvatar
                  ? AvatarWidget(name: senderName, imageUrl: senderAvatar, size: 28)
                  : const SizedBox(width: 28),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Column(
                crossAxisAlignment: isMe
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (!isMe && showSenderName)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 2),
                      child: Text(
                        senderName,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ),
                  Container(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.72,
                    ),
                    decoration: BoxDecoration(
                      color: message.isDeleted
                          ? Colors.grey.shade200
                          : isMe
                          ? AppTheme.primary
                          : Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(AppTheme.radiusSm),
                        topRight: const Radius.circular(AppTheme.radiusSm),
                        bottomLeft: Radius.circular(isMe ? AppTheme.radiusSm : 4),
                        bottomRight: Radius.circular(isMe ? 4 : AppTheme.radiusSm),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(AppTheme.radiusSm),
                        topRight: const Radius.circular(AppTheme.radiusSm),
                        bottomLeft: Radius.circular(isMe ? AppTheme.radiusSm : 4),
                        bottomRight: Radius.circular(isMe ? 4 : AppTheme.radiusSm),
                      ),
                      child: _BubbleContent(
                        message: message,
                        isMe: isMe,
                        onTaskTap: onTaskTap,
                      ),
                    ),
                  ),
                  if (message.hasReactions && !message.isDeleted)
                    _ReactionsRow(
                      reactions: message.reactions,
                      currentUid: currentUid,
                      onReact: onReact,
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2, left: 4, right: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          DateFormat('HH:mm').format(message.createdAt),
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppTheme.textLight,
                          ),
                        ),
                        if (message.editedAt != null) ...[
                          const SizedBox(width: 4),
                          const Text(
                            'edited',
                            style: TextStyle(
                              fontSize: 10,
                              color: AppTheme.textLight,
                            ),
                          ),
                        ],
                        if (isMe && !message.isDeleted) ...[
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.done_all_rounded,
                            size: 14,
                            color: AppTheme.primary,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (isMe) const SizedBox(width: 6),
          ],
        ),
      ),
    );
  }

  void _showActions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusSm)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!message.isDeleted) ...[
              // Quick reaction bar
              Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: ['👍', '❤️', '😂', '😮', '🙏', '✅']
                      .map(
                        (emoji) => GestureDetector(
                          onTap: () {
                            Navigator.pop(ctx);
                            onReact(emoji);
                          },
                          child: Text(
                            emoji,
                            style: const TextStyle(fontSize: 30),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.reply_rounded),
                title: const Text('Reply'),
                onTap: () {
                  Navigator.pop(ctx);
                  onReply();
                },
              ),
              ListTile(
                leading: const Icon(Icons.copy_rounded),
                title: const Text('Copy text'),
                onTap: () {
                  Navigator.pop(ctx);
                  Clipboard.setData(ClipboardData(text: message.text));
                  HapticFeedback.lightImpact();
                },
              ),
              if (onEdit != null)
                ListTile(
                  leading: const Icon(Icons.edit_rounded),
                  title: const Text('Edit message'),
                  onTap: () {
                    Navigator.pop(ctx);
                    onEdit!();
                  },
                ),
            ],
            if (onDelete != null)
              ListTile(
                leading: const Icon(
                  Icons.delete_outline_rounded,
                  color: AppTheme.error,
                ),
                title: const Text(
                  'Delete',
                  style: TextStyle(color: AppTheme.error),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  onDelete!();
                },
              ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }
}

// ── Bubble Content ─────────────────────────────────────────────────────────────
class _BubbleContent extends StatelessWidget {
  final ChatMessageModel message;
  final bool isMe;
  final void Function(String taskId) onTaskTap;
  const _BubbleContent({
    required this.message,
    required this.isMe,
    required this.onTaskTap,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isDeleted) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Text(
          '🗑️ Message deleted',
          style: TextStyle(
            fontStyle: FontStyle.italic,
            color: Colors.grey.shade500,
            fontSize: 13,
          ),
        ),
      );
    }

    final textColor = isMe ? Colors.white : AppTheme.onSurface;
    final subtleColor = isMe ? Colors.white70 : AppTheme.textMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Reply preview
        if (message.replyToId != null)
          Container(
            margin: const EdgeInsets.fromLTRB(4, 4, 4, 0),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isMe
                  ? Colors.white.withValues(alpha: 0.12)
                  : AppTheme.background,
              borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              border: Border(
                left: BorderSide(
                  color: isMe ? Colors.white54 : AppTheme.primary,
                  width: 3,
                ),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message.replyToSenderName ?? 'Unknown',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isMe ? Colors.white : AppTheme.primary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message.replyToText ?? '',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: subtleColor),
                ),
              ],
            ),
          ),

        // Image
        if (message.type == MessageType.image && message.attachmentUrl != null)
          GestureDetector(
            onTap: () async {
              final uri = Uri.tryParse(message.attachmentUrl!);
              if (uri != null && await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: Stack(
              children: [
                Image.network(
                  message.attachmentUrl!,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: 200,
                  loadingBuilder: (_, child, progress) => progress == null
                      ? child
                      : Container(
                          height: 200,
                          color: Colors.grey.shade200,
                          child: const Center(child: CircularProgressIndicator()),
                        ),
                  errorBuilder: (_, __, ___) => Container(
                    height: 80,
                    color: Colors.grey.shade200,
                    child: const Icon(Icons.broken_image_rounded),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: Colors.black45,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.download_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),

        // File attachment (non-image)
        if (message.type == MessageType.file && message.attachmentUrl != null)
          GestureDetector(
            onTap: () async {
              final uri = Uri.tryParse(message.attachmentUrl!);
              if (uri != null && await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: Container(
              margin: const EdgeInsets.all(4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isMe ? Colors.white.withValues(alpha: 0.15) : AppTheme.surfaceAlt,
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.insert_drive_file_rounded,
                      size: 22, color: isMe ? Colors.white : AppTheme.primary),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          message.attachmentName ?? 'File',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: isMe ? Colors.white : AppTheme.onSurface,
                          ),
                        ),
                        Text(
                          'Tap to download',
                          style: TextStyle(
                            fontSize: 11,
                            color: isMe
                                ? Colors.white.withValues(alpha: 0.7)
                                : AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Icon(
                    Icons.download_rounded,
                    size: 20,
                    color: isMe
                        ? Colors.white70
                        : AppTheme.primary.withValues(alpha: 0.7),
                  ),
                ],
              ),
            ),
          ),

        // Task card
        if (message.type == MessageType.taskRef && message.taskId != null)
          GestureDetector(
            onTap: () => onTaskTap(message.taskId!),
            child: Container(
              margin: const EdgeInsets.fromLTRB(4, 4, 4, 0),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isMe
                    ? Colors.white.withValues(alpha: 0.12)
                    : AppTheme.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                border: Border.all(
                  color: isMe
                      ? Colors.white30
                      : AppTheme.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: isMe
                          ? Colors.white30
                          : AppTheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    ),
                    child: Icon(
                      Icons.task_alt_rounded,
                      size: 16,
                      color: isMe ? Colors.white : AppTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Task',
                          style: TextStyle(
                            fontSize: 10,
                            color: subtleColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          message.taskTitle ?? 'View Task',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: textColor,
                          ),
                        ),
                        if (message.taskStatus != null)
                          Text(
                            message.taskStatus!,
                            style: TextStyle(fontSize: 11, color: subtleColor),
                          ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: subtleColor,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),

        // Text with @mention highlighting
        if (message.text.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: _MentionText(
              text: message.text,
              isMe: isMe,
              baseColor: textColor,
            ),
          )
        else
          const SizedBox(height: 6),
      ],
    );
  }
}

// ── Mention-aware Rich Text ────────────────────────────────────────────────────
class _MentionText extends StatelessWidget {
  final String text;
  final bool isMe;
  final Color baseColor;
  const _MentionText({
    required this.text,
    required this.isMe,
    required this.baseColor,
  });

  @override
  Widget build(BuildContext context) {
    final pattern = RegExp(r'@[\w]+(?: [\w]+)?');
    final matches = pattern.allMatches(text).toList();
    if (matches.isEmpty) {
      return Text(
        text,
        style: TextStyle(color: baseColor, fontSize: 14, height: 1.4),
      );
    }

    final spans = <TextSpan>[];
    int last = 0;
    for (final m in matches) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      spans.add(
        TextSpan(
          text: m.group(0),
          style: TextStyle(
            color: isMe ? Colors.lightBlueAccent : AppTheme.primary,
            fontWeight: FontWeight.bold,
          ),
        ),
      );
      last = m.end;
    }
    if (last < text.length) {
      spans.add(TextSpan(text: text.substring(last)));
    }

    return RichText(
      text: TextSpan(
        style: TextStyle(color: baseColor, fontSize: 14, height: 1.4),
        children: spans,
      ),
    );
  }
}

// ── Reactions Row ──────────────────────────────────────────────────────────────
class _ReactionsRow extends StatelessWidget {
  final Map<String, List<String>> reactions;
  final String currentUid;
  final void Function(String emoji) onReact;
  const _ReactionsRow({
    required this.reactions,
    required this.currentUid,
    required this.onReact,
  });

  @override
  Widget build(BuildContext context) {
    final nonEmpty = reactions.entries
        .where((e) => e.value.isNotEmpty)
        .toList();
    if (nonEmpty.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: nonEmpty.map((e) {
          final reacted = e.value.contains(currentUid);
          return GestureDetector(
            onTap: () => onReact(e.key),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: reacted
                    ? AppTheme.primary.withValues(alpha: 0.1)
                    : Colors.white,
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                border: Border.all(
                  color: reacted ? AppTheme.primary : AppTheme.divider,
                ),
              ),
              child: Text(
                '${e.key} ${e.value.length}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Day Separator ──────────────────────────────────────────────────────────────
class _DaySeparator extends StatelessWidget {
  final DateTime date;
  const _DaySeparator({required this.date});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(date.year, date.month, date.day);
    final isToday = dateOnly == today;
    final isYesterday = dateOnly == today.subtract(const Duration(days: 1));
    final label = isToday
        ? 'Today'
        : isYesterday
        ? 'Yesterday'
        : DateFormat('EEEE, d MMMM').format(date);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Expanded(child: Divider()),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppTheme.textMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          const Expanded(child: Divider()),
        ],
      ),
    );
  }
}

// ── System Message ─────────────────────────────────────────────────────────────
class _SystemMessage extends StatelessWidget {
  final String text;
  const _SystemMessage({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          ),
          child: Text(
            text,
            style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
          ),
        ),
      ),
    );
  }
}

// ── Empty Messages ─────────────────────────────────────────────────────────────
class _EmptyMessages extends ConsumerWidget {
  final ChatChannelModel channel;
  final String currentUid;
  const _EmptyMessages({
    required this.channel,
    required this.currentUid,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // For DMs, resolve the peer's display name so we can personalise the hint
    String title;
    String subtitle;

    if (channel.type == ChannelType.direct) {
      final peerUid = channel.dmPeerUid(currentUid) ?? '';
      final peerName = peerUid.isNotEmpty
          ? (ref.watch(userProvider(peerUid)).value?.name ?? '…')
          : '…';
      title = 'Say hello to $peerName 👋';
      subtitle = 'This is the beginning of your direct message history.';
    } else {
      final displayName =
          channel.name.isNotEmpty ? '#${channel.name}' : 'this channel';
      title = 'Welcome to $displayName 👋';
      subtitle = 'Send the first message!';
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              channel.type == ChannelType.direct ? '💬' : '👋',
              style: const TextStyle(fontSize: 48),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: const TextStyle(color: AppTheme.textMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Compose Bar ────────────────────────────────────────────────────────────────
class _ComposeBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isSending;
  final bool canShareTask;
  final ChatMessageModel? replyingTo;
  final ChatMessageModel? editingMsg;
  final VoidCallback onCancel;
  final VoidCallback onSend;
  final VoidCallback onImage;
  final VoidCallback onShareTask;

  const _ComposeBar({
    required this.controller,
    required this.focusNode,
    required this.isSending,
    required this.onCancel,
    required this.onSend,
    required this.onImage,
    required this.onShareTask,
    this.canShareTask = false,
    this.replyingTo,
    this.editingMsg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Reply / Edit banner
            if (replyingTo != null || editingMsg != null)
              Container(
                padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
                decoration: const BoxDecoration(
                  color: AppTheme.background,
                  border: Border(top: BorderSide(color: AppTheme.divider)),
                ),
                child: Row(
                  children: [
                    Icon(
                      editingMsg != null
                          ? Icons.edit_rounded
                          : Icons.reply_rounded,
                      size: 16,
                      color: AppTheme.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            editingMsg != null ? 'Editing message' : 'Replying',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primary,
                            ),
                          ),
                          Text(
                            editingMsg?.text ?? replyingTo?.text ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      onPressed: onCancel,
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),

            // Input row
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Attachment picker
                  PopupMenuButton<String>(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.background,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      ),
                      child: const Icon(
                        Icons.add_rounded,
                        size: 20,
                        color: AppTheme.textMuted,
                      ),
                    ),
                    onSelected: (val) {
                      if (val == 'image') onImage();
                      if (val == 'task') onShareTask();
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(
                        value: 'image',
                        child: Row(
                          children: [
                            Icon(Icons.image_rounded, size: 18),
                            SizedBox(width: 8),
                            Text('Photo / Image'),
                          ],
                        ),
                      ),
                      if (canShareTask)
                        const PopupMenuItem(
                          value: 'task',
                          child: Row(
                            children: [
                              Icon(Icons.task_alt_rounded, size: 18),
                              SizedBox(width: 8),
                              Text('Share a Task'),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 6),

                  // Text field
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppTheme.background,
                        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                      ),
                      child: TextField(
                        controller: controller,
                        focusNode: focusNode,
                        minLines: 1,
                        maxLines: 6,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          hintText: 'Type a message…  (@mention, #task)',
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          isDense: true,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),

                  // Send button
                  GestureDetector(
                    onTap: isSending ? null : onSend,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isSending
                            ? Colors.grey.shade300
                            : AppTheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: isSending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Channel Info Sheet ─────────────────────────────────────────────────────────
class _ChannelInfoSheet extends ConsumerWidget {
  final ChatChannelModel channel;
  final String currentUid;
  const _ChannelInfoSheet({
    required this.channel,
    required this.currentUid,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // For DMs, render a peer-focused info sheet instead of a generic channel view
    if (channel.type == ChannelType.direct) {
      final peerUid = channel.dmPeerUid(currentUid) ?? '';
      return _DmInfoSheet(peerUid: peerUid);
    }

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.92,
      minChildSize: 0.4,
      expand: false,
      builder: (_, sc) => ListView(
        controller: sc,
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Center(
                child: Text(
                  channel.iconEmoji ?? channel.type.emoji,
                  style: const TextStyle(fontSize: 28),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              channel.name,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ),
          if (channel.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Center(
              child: Text(
                channel.description,
                style: const TextStyle(color: AppTheme.textMuted),
                textAlign: TextAlign.center,
              ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            children: [
              const Icon(
                Icons.group_rounded,
                size: 16,
                color: AppTheme.textLight,
              ),
              const SizedBox(width: 6),
              Text(
                '${channel.memberIds.length} Members',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...channel.memberIds.map(
            (uid) => _MemberListTile(
              uid: uid,
              isAdmin: channel.adminIds.contains(uid),
            ),
          ),
        ],
      ),
    );
  }
}

// ── DM Info Sheet (peer-focused) ───────────────────────────────────────────────
class _DmInfoSheet extends ConsumerWidget {
  final String peerUid;
  const _DmInfoSheet({required this.peerUid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (peerUid.isEmpty) return const SizedBox.shrink();
    final peerAsync = ref.watch(userProvider(peerUid));

    return peerAsync.when(
      loading: () => const SizedBox(
        height: 200,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => const SizedBox(
        height: 200,
        child: Center(child: Text('Could not load contact info')),
      ),
      data: (peer) {
        if (peer == null) {
          return const SizedBox(
            height: 200,
            child: Center(child: Text('User not found')),
          );
        }
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                AvatarWidget(
                  name: peer.name,
                  imageUrl: peer.avatarUrl,
                  size: 72,
                ),
                const SizedBox(height: 12),
                Text(
                  peer.name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: peer.isActive ? AppTheme.success : Colors.grey,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      peer.isActive ? 'Active' : 'Inactive',
                      style: TextStyle(
                        fontSize: 13,
                        color: peer.isActive ? AppTheme.success : AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),
                _InfoRow(icon: Icons.email_outlined, text: peer.email),
                if (peer.phone.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _InfoRow(icon: Icons.phone_outlined, text: peer.phone),
                ],
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppTheme.textLight),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _MemberListTile extends ConsumerWidget {
  final String uid;
  final bool isAdmin;
  const _MemberListTile({required this.uid, required this.isAdmin});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userProvider(uid));
    return userAsync.when(
      loading: () => const SizedBox(height: 48),
      error: (_, __) => const SizedBox.shrink(),
      data: (user) {
        if (user == null) return const SizedBox.shrink();
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: AvatarWidget(
            name: user.name,
            imageUrl: user.avatarUrl,
            size: 36,
          ),
          title: Text(user.name),
          subtitle: Text(user.email, style: const TextStyle(fontSize: 12)),
          trailing: isAdmin
              ? Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: const Text(
                    'Admin',
                    style: TextStyle(
                      fontSize: 10,
                      color: AppTheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              : null,
        );
      },
    );
  }
}

// ── Task Picker Sheet ──────────────────────────────────────────────────────────
class _TaskPickerSheet extends ConsumerStatefulWidget {
  final String channelId;
  final String senderUid;
  final List<String> channelMemberIds;
  const _TaskPickerSheet({
    required this.channelId,
    required this.senderUid,
    required this.channelMemberIds,
  });

  @override
  ConsumerState<_TaskPickerSheet> createState() => _TaskPickerSheetState();
}

class _TaskPickerSheetState extends ConsumerState<_TaskPickerSheet> {
  final _search = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(allTasksProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      maxChildSize: 0.92,
      minChildSize: 0.4,
      expand: false,
      builder: (_, sc) => Column(
        children: [
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Share a Task',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(
                hintText: 'Search tasks…',
                prefixIcon: Icon(Icons.search_rounded),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: tasksAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) =>
                  const Center(child: Text('Failed to load tasks')),
              data: (tasks) {
                final filtered = _search.text.isEmpty
                    ? tasks
                    : tasks
                          .where(
                            (t) => t.title.toLowerCase().contains(
                              _search.text.toLowerCase(),
                            ),
                          )
                          .toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text('No tasks found'));
                }
                return ListView.builder(
                  controller: sc,
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final task = filtered[i];
                    return ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: task.status.color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                        ),
                        child: Icon(
                          Icons.task_alt_rounded,
                          size: 18,
                          color: task.status.color,
                        ),
                      ),
                      title: Text(
                        task.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        task.status.label,
                        style: TextStyle(
                          fontSize: 12,
                          color: task.status.color,
                        ),
                      ),
                      onTap: () async {
                        Navigator.pop(context);
                        final msg = ChatMessageModel(
                          id: '',
                          channelId: widget.channelId,
                          senderId: widget.senderUid,
                          text: '📌 ${task.title}',
                          type: MessageType.taskRef,
                          taskId: task.id,
                          taskTitle: task.title,
                          taskProjectId: task.projectId,
                          taskStatus: task.status.label,
                          createdAt: DateTime.now(),
                        );
                        await ref
                            .read(chatRepositoryProvider)
                            .sendMessage(
                              channelId: widget.channelId,
                              message: msg,
                              channelMemberIds: widget.channelMemberIds,
                            );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
