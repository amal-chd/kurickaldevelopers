import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/models/chat_channel_model.dart';
import '../../providers/chat_provider.dart';
import '../../providers/user_provider.dart';
import '../../providers/role_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

/// A conversation is shown in the list only when it has a real last message.
/// Channels whose last message was deleted (stored as 'Message deleted' or an
/// empty string) or that have never had a visible message are hidden.
///
/// Direct message channels are always shown if started (document exists).
bool _hasContent(ChatChannelModel c) {
  if (c.type == ChannelType.direct) return true;
  final text = c.lastMessageText.trim();
  if (text.isEmpty) return false;
  if (text.toLowerCase() == 'message deleted') return false;
  return true;
}

class ChatListScreen extends ConsumerStatefulWidget {
  const ChatListScreen({super.key});

  @override
  ConsumerState<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends ConsumerState<ChatListScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Wait for role to fully load before evaluating permissions.
    // Without this guard, hasPermissionProvider returns false while the role
    // stream is still loading → users briefly see "no permission" on first open.
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    final channelsAsync = ref.watch(userChannelsProvider);
    final canCreateGroup = ref.watch(
      hasPermissionProvider('chat_create_group'),
    );
    final currentUser = ref.watch(currentUserProvider).value;
    // Used to resolve DM peer names during search
    final allUsers = ref.watch(allUsersProvider).value ?? [];

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'New',
            onSelected: (val) {
              if (val == 'group') context.push('/chat/create');
              if (val == 'dm') {
                _showNewDmSheet(context, currentUser?.uid ?? '');
              }
            },
            itemBuilder: (_) => [
              if (canCreateGroup)
                const PopupMenuItem(
                  value: 'group',
                  child: Row(
                    children: [
                      Icon(Icons.group_add_rounded, size: 20),
                      SizedBox(width: 8),
                      Text('New Group Channel'),
                    ],
                  ),
                ),
              const PopupMenuItem(
                value: 'dm',
                child: Row(
                  children: [
                    Icon(Icons.chat_rounded, size: 20),
                    SizedBox(width: 8),
                    Text('New Direct Message'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: channelsAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(userChannelsProvider),
        ),
        data: (allChannels) {
          final query = _query.toLowerCase();
          final myUid = currentUser?.uid ?? '';

          // Hide conversations with no real content — channels whose last
          // message was deleted (or that never had a visible message). This
          // keeps "Message deleted" / empty rows out of the chat list.
          final channels = allChannels.where(_hasContent).toList();

          final filtered = query.isEmpty
              ? channels
              : channels.where((c) {
                  if (c.name.toLowerCase().contains(query)) return true;
                  if (c.lastMessageText.toLowerCase().contains(query)) {
                    return true;
                  }
                  // DMs have empty name — match by resolving the peer's name
                  if (c.type == ChannelType.direct) {
                    final peerUid = c.dmPeerUid(myUid) ?? '';
                    if (peerUid.isNotEmpty) {
                      final peer = allUsers
                          .where((u) => u.uid == peerUid)
                          .firstOrNull;
                      if (peer != null &&
                          peer.name.toLowerCase().contains(query)) {
                        return true;
                      }
                    }
                  }
                  return false;
                }).toList();

          // Group channels
          final announcements = filtered
              .where((c) => c.type == ChannelType.announcement)
              .toList();
          final projects = filtered
              .where((c) => c.type == ChannelType.project)
              .toList();
          final groups = filtered
              .where((c) => c.type == ChannelType.group)
              .toList();
          final dms = filtered
              .where((c) => c.type == ChannelType.direct)
              .toList();

          return Column(
            children: [
              // Search bar
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search channels & messages…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                          )
                        : null,
                  ),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),

              Expanded(
                child: (filtered.isEmpty && channels.isNotEmpty)
                    ? Center(
                        child: Text(
                          'No results for "$_query"',
                          style: const TextStyle(color: AppTheme.textLight),
                        ),
                      )
                    : channels.isEmpty
                    ? _EmptyChatsState(
                        canCreate: canCreateGroup,
                        onCreateGroup: () => context.push('/chat/create'),
                      )
                    : ListView(
                        padding: const EdgeInsets.only(bottom: 80),
                        children: [
                          if (announcements.isNotEmpty)
                            _ChannelSection(
                              title: '📢  Announcements',
                              channels: announcements,
                              currentUid: currentUser?.uid ?? '',
                            ),
                          if (projects.isNotEmpty)
                            _ChannelSection(
                              title: '🏗️  Projects',
                              channels: projects,
                              currentUid: currentUser?.uid ?? '',
                            ),
                          if (groups.isNotEmpty)
                            _ChannelSection(
                              title: '👥  Groups',
                              channels: groups,
                              currentUid: currentUser?.uid ?? '',
                            ),
                          if (dms.isNotEmpty)
                            _DmSection(
                              dms: dms,
                              currentUid: currentUser?.uid ?? '',
                            ),
                        ],
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showNewDmSheet(BuildContext context, String myUid) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _NewDmSheet(myUid: myUid),
    );
  }
}

// ── Channel Section ───────────────────────────────────────────────────────────
class _ChannelSection extends StatelessWidget {
  final String title;
  final List<ChatChannelModel> channels;
  final String currentUid;
  const _ChannelSection({
    required this.title,
    required this.channels,
    required this.currentUid,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppTheme.textLight,
              letterSpacing: 1.2,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              boxShadow: AppTheme.softShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              child: Column(
                children: List.generate(channels.length * 2 - 1, (index) {
                  if (index.isOdd) {
                    return const Divider(height: 1, indent: 78, endIndent: 20);
                  }
                  final ch = channels[index ~/ 2];
                  return _ChannelTile(channel: ch, currentUid: currentUid);
                }),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── DM Section (shows peer user info) ────────────────────────────────────────
class _DmSection extends ConsumerWidget {
  final List<ChatChannelModel> dms;
  final String currentUid;
  const _DmSection({required this.dms, required this.currentUid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 10),
          child: Text(
            '💬  DIRECT MESSAGES',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppTheme.textLight,
              letterSpacing: 1.2,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              boxShadow: AppTheme.softShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              child: Column(
                children: List.generate(dms.length * 2 - 1, (index) {
                  if (index.isOdd) {
                    return const Divider(height: 1, indent: 78, endIndent: 20);
                  }
                  final dm = dms[index ~/ 2];
                  return _DmTile(channel: dm, currentUid: currentUid);
                }),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Channel Tile ──────────────────────────────────────────────────────────────
class _ChannelTile extends StatelessWidget {
  final ChatChannelModel channel;
  final String currentUid;
  const _ChannelTile({required this.channel, required this.currentUid});

  @override
  Widget build(BuildContext context) {
    final unread = channel.unreadFor(currentUid);
    return ListTile(
      onTap: () => context.push('/chat/${channel.id}'),
      leading: _ChannelAvatar(channel: channel),
      title: Text(
        channel.name,
        style: TextStyle(
          fontWeight: unread > 0 ? FontWeight.bold : FontWeight.w500,
        ),
      ),
      subtitle: channel.lastMessageText.isEmpty
          ? const Text(
              'No messages yet',
              style: TextStyle(color: AppTheme.textLight, fontSize: 12),
            )
          : Text(
              channel.lastMessageText,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                color: unread > 0 ? AppTheme.onSurface : AppTheme.textMuted,
                fontWeight: unread > 0 ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
      trailing: _TrailingTimeBadge(
        lastMessageAt: channel.lastMessageAt,
        unread: unread,
      ),
    );
  }
}

// ── DM Tile (shows peer avatar + name) ───────────────────────────────────────
class _DmTile extends ConsumerWidget {
  final ChatChannelModel channel;
  final String currentUid;
  const _DmTile({required this.channel, required this.currentUid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peerUid = channel.dmPeerUid(currentUid) ?? '';
    // Guard: corrupted channel with fewer than 2 members would give an empty uid
    if (peerUid.isEmpty) return const SizedBox.shrink();

    final peerAsync = ref.watch(userProvider(peerUid));
    final unread = channel.unreadFor(currentUid);

    return peerAsync.when(
      loading: () => const SizedBox(height: 72),
      error: (_, __) => const SizedBox.shrink(),
      data: (peer) {
        if (peer == null) return const SizedBox.shrink();
        // Some user docs have a blank name — fall back to email so the DM never
        // renders with an empty title / icon-only row.
        final displayName = peer.name.trim().isNotEmpty
            ? peer.name
            : (peer.email.trim().isNotEmpty ? peer.email : 'Unknown user');
        return ListTile(
          onTap: () => context.push('/chat/${channel.id}'),
          leading: Stack(
            children: [
              AvatarWidget(name: displayName, imageUrl: peer.avatarUrl, size: 46),
              // Online indicator (placeholder — real presence needs extra infra)
              if (peer.isActive)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppTheme.success,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          title: Text(
            displayName,
            style: TextStyle(
              fontWeight: unread > 0 ? FontWeight.bold : FontWeight.w500,
            ),
          ),
          subtitle: channel.lastMessageText.isEmpty
              ? const Text(
                  'Say hello 👋',
                  style: TextStyle(color: AppTheme.textLight, fontSize: 12),
                )
              : Text(
                  channel.lastMessageText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    color: unread > 0 ? AppTheme.onSurface : AppTheme.textMuted,
                    fontWeight: unread > 0
                        ? FontWeight.w500
                        : FontWeight.normal,
                  ),
                ),
          trailing: _TrailingTimeBadge(
            lastMessageAt: channel.lastMessageAt,
            unread: unread,
          ),
        );
      },
    );
  }
}

// ── Channel Avatar ────────────────────────────────────────────────────────────
class _ChannelAvatar extends StatelessWidget {
  final ChatChannelModel channel;
  const _ChannelAvatar({required this.channel});

  @override
  Widget build(BuildContext context) {
    final emoji = channel.iconEmoji ?? channel.type.emoji;
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: _bgColor(channel.type),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Center(child: Text(emoji, style: const TextStyle(fontSize: 20))),
    );
  }

  Color _bgColor(ChannelType type) {
    switch (type) {
      case ChannelType.announcement:
        return AppTheme.pastelYellow;
      case ChannelType.project:
        return AppTheme.pastelBlue;
      case ChannelType.group:
        return AppTheme.pastelGreen;
      case ChannelType.direct:
        return AppTheme.pastelPurple;
    }
  }
}

// ── Shared trailing widget (timestamp + unread badge) ─────────────────────────
class _TrailingTimeBadge extends StatelessWidget {
  final DateTime? lastMessageAt;
  final int unread;
  const _TrailingTimeBadge({required this.lastMessageAt, required this.unread});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (lastMessageAt != null)
          Text(
            _formatTime(lastMessageAt!),
            style: TextStyle(
              fontSize: 11,
              color: unread > 0 ? AppTheme.primary : AppTheme.textLight,
            ),
          ),
        if (unread > 0) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(AppTheme.radiusPill),
            ),
            child: Text(
              unread > 99 ? '99+' : '$unread',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ],
    );
  }

  static String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(dt.year, dt.month, dt.day);
    if (dateOnly == today) return DateFormat('HH:mm').format(dt);
    if (today.difference(dateOnly).inDays < 7) {
      return DateFormat('EEE').format(dt);
    }
    return DateFormat('dd/MM').format(dt);
  }
}

// ── Empty State ───────────────────────────────────────────────────────────────
class _EmptyChatsState extends StatelessWidget {
  final bool canCreate;
  final VoidCallback onCreateGroup;
  const _EmptyChatsState({
    required this.canCreate,
    required this.onCreateGroup,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                size: 48,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No conversations yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Start a direct message or join a project channel to collaborate with your team.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textMuted),
            ),
            if (canCreate) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onCreateGroup,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Create a Channel'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── New DM Sheet ──────────────────────────────────────────────────────────────
class _NewDmSheet extends ConsumerStatefulWidget {
  final String myUid;
  const _NewDmSheet({required this.myUid});

  @override
  ConsumerState<_NewDmSheet> createState() => _NewDmSheetState();
}

class _NewDmSheetState extends ConsumerState<_NewDmSheet> {
  final _search = TextEditingController();
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final allUsersAsync = ref.watch(allUsersProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
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
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Text(
              'New Message',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(
                hintText: 'Search team members…',
                prefixIcon: Icon(Icons.search_rounded),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: allUsersAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => AppErrorWidget(
                message: 'Failed to load users: $err',
                onRetry: () => ref.invalidate(allUsersProvider),
              ),
              data: (users) {
                final filtered = users
                    .where(
                      (u) => u.uid != widget.myUid && u.isActive,
                    )
                    .where(
                      (u) =>
                          _search.text.isEmpty ||
                          u.name.toLowerCase().contains(
                            _search.text.toLowerCase(),
                          ) ||
                          u.email.toLowerCase().contains(
                            _search.text.toLowerCase(),
                          ),
                    )
                    .toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _search.text.isEmpty
                            ? 'No other team members found'
                            : 'No results for "${_search.text}"',
                        style: const TextStyle(color: Color(0xFF94A3B8)),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  );
                }

                return ListView.builder(
                  controller: sc,
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final u = filtered[i];
                    return ListTile(
                      leading: AvatarWidget(
                        name: u.name,
                        imageUrl: u.avatarUrl,
                        size: 40,
                      ),
                      title: Text(u.name),
                      subtitle: Text(
                        u.email,
                        style: const TextStyle(fontSize: 12),
                      ),
                      onTap: _loading
                          ? null
                          : () async {
                              final myUser =
                                  ref.read(currentUserProvider).value;
                              if (myUser == null) return;
                              // Capture context-dependent refs before the async gap
                              final nav = Navigator.of(context);
                              final router = GoRouter.of(context);
                              final messenger = ScaffoldMessenger.of(context);
                              setState(() => _loading = true);
                              try {
                                final channelId = await ref
                                    .read(chatRepositoryProvider)
                                    .getOrCreateDmChannel(
                                      myUid: widget.myUid,
                                      peerUid: u.uid,
                                      myName: myUser.name,
                                      peerName: u.name,
                                    );
                                if (mounted) {
                                  nav.pop();
                                  router.push('/chat/$channelId');
                                }
                              } catch (e) {
                                if (mounted) {
                                  messenger.showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Could not open chat: $e',
                                      ),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted) setState(() => _loading = false);
                              }
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
