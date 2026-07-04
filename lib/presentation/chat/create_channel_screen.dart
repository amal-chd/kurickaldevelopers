import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/models/chat_channel_model.dart';
import '../../data/models/user_model.dart';
import '../../providers/chat_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';

class CreateChannelScreen extends ConsumerStatefulWidget {
  const CreateChannelScreen({super.key});

  @override
  ConsumerState<CreateChannelScreen> createState() =>
      _CreateChannelScreenState();
}

class _CreateChannelScreenState extends ConsumerState<CreateChannelScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  ChannelType _type = ChannelType.group;
  String _iconEmoji = '👥';
  final List<String> _memberIds = [];
  bool _isLoading = false;

  static const _emojiOptions = [
    '👥',
    '🏗️',
    '📐',
    '🔨',
    '🏠',
    '📋',
    '💡',
    '🔑',
    '📊',
    '🛠️',
    '🚧',
    '🏢',
  ];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final user = ref.read(currentUserProvider).value;
    if (user == null) return;

    setState(() => _isLoading = true);
    try {
      final allMembers = [
        user.uid,
        ..._memberIds.where((id) => id != user.uid),
      ];
      final channel = ChatChannelModel(
        id: '',
        type: _type,
        name: _nameCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        iconEmoji: _iconEmoji,
        memberIds: allMembers,
        adminIds: [user.uid],
        createdBy: user.uid,
        createdAt: DateTime.now(),
      );
      final channelId = await ref
          .read(chatRepositoryProvider)
          .createChannel(channel);

      // Post a system welcome message
      await ref
          .read(chatRepositoryProvider)
          .postSystemMessage(
            channelId: channelId,
            text: '${user.name} created this channel.',
            memberIds: allMembers,
          );

      if (mounted) {
        context.pop();
        context.push('/chat/$channelId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickMembers(List<UserModel> allUsers) async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _MemberPickerSheet(
        allUsers: allUsers,
        selected: List.from(_memberIds),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _memberIds.clear();
        _memberIds.addAll(result);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Wait for role to fully resolve before evaluating permissions.
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    final canCreateGroup = ref.watch(
      hasPermissionProvider('chat_create_group'),
    );
    final canAnnounce = ref.watch(hasPermissionProvider('chat_announce'));
    final usersAsync = ref.watch(allUsersProvider);
    final currentUid = ref.watch(currentUserProvider).value?.uid ?? '';

    // ── Permission guard ──
    if (!canCreateGroup) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(title: const Text('New Channel')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppTheme.error.withValues(alpha: 0.05),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lock_outline_rounded,
                    size: 48,
                    color: AppTheme.error,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Permission required',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'You do not have permission to create channels. Contact an admin to request access.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textMuted),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => context.pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('New Channel'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _submit,
            child: _isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppTheme.primary,
                    ),
                  )
                : const Text(
                    'Create',
                    style: TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Channel type selector
            _card([
              _label('Channel Type'),
              const SizedBox(height: 8),
              ...ChannelType.values
                  .where(
                    (t) =>
                        t != ChannelType.direct &&
                        (t != ChannelType.announcement || canAnnounce),
                  )
                  .map((type) {
                    final isSelected = _type == type;
                    return GestureDetector(
                      onTap: () => setState(() => _type = type),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.primary.withValues(alpha: 0.05)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(
                            color: isSelected
                                ? AppTheme.primary
                                : AppTheme.divider,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(
                              type.emoji,
                              style: const TextStyle(fontSize: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    type.label,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: isSelected
                                          ? AppTheme.primary
                                          : null,
                                    ),
                                  ),
                                  Text(
                                    _typeDescription(type),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              const Icon(
                                Icons.check_circle_rounded,
                                color: AppTheme.primary,
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
            ]),
            const SizedBox(height: 16),

            // Icon & name
            _card([
              _label('Channel Icon'),
              const SizedBox(height: 8),
              SizedBox(
                height: 52,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: _emojiOptions
                      .map(
                        (e) => GestureDetector(
                          onTap: () => setState(() => _iconEmoji = e),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 120),
                            margin: const EdgeInsets.only(right: 8),
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: _iconEmoji == e
                                  ? AppTheme.primary.withValues(alpha: 0.1)
                                  : AppTheme.background,
                              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                              border: Border.all(
                                color: _iconEmoji == e
                                    ? AppTheme.primary
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                e,
                                style: const TextStyle(fontSize: 22),
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(height: 12),
              const Divider(),
              _label('Channel Name *'),
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  hintText: 'e.g. Site Engineers, Accounts…',
                  border: InputBorder.none,
                  isDense: true,
                ),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'Channel name is required'
                    : null,
              ),
              const Divider(),
              _label('Description (optional)'),
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  hintText: 'What is this channel about?',
                  border: InputBorder.none,
                  isDense: true,
                ),
                maxLines: 2,
              ),
            ]),
            const SizedBox(height: 16),

            // Members
            _card([
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _label('Add Members'),
                  usersAsync.when(
                    loading: () => const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    error: (err, _) => TextButton.icon(
                      onPressed: () => ref.invalidate(allUsersProvider),
                      icon: const Icon(Icons.refresh_rounded, size: 16, color: AppTheme.error),
                      label: const Text('Retry loading members', style: TextStyle(color: AppTheme.error)),
                    ),
                    data: (users) => TextButton.icon(
                      onPressed: () => _pickMembers(
                        users.where((u) => u.uid != currentUid).toList(),
                      ),
                      icon: const Icon(Icons.group_add_rounded, size: 16),
                      label: const Text('Add'),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ),
                ],
              ),
              if (_memberIds.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No members added yet (you will be added automatically)',
                    style: TextStyle(color: AppTheme.textLight, fontSize: 13),
                  ),
                )
              else
                usersAsync.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (allUsers) => Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: _memberIds.map((uid) {
                      final user = allUsers.firstWhere(
                        (u) => u.uid == uid,
                        orElse: () => UserModel(
                          uid: uid,
                          name: uid,
                          email: '',
                          phone: '',
                          roleId: '',
                          createdAt: DateTime.now(),
                          lastLoginAt: DateTime.now(),
                        ),
                      );
                      return Chip(
                        avatar: AvatarWidget(
                          name: user.name,
                          imageUrl: user.avatarUrl,
                          size: 22,
                        ),
                        label: Text(
                          user.name.split(' ').first,
                          style: const TextStyle(fontSize: 12),
                        ),
                        deleteIcon: const Icon(Icons.close_rounded, size: 14),
                        onDeleted: () => setState(() => _memberIds.remove(uid)),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      );
                    }).toList(),
                  ),
                ),
            ]),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  String _typeDescription(ChannelType type) {
    switch (type) {
      case ChannelType.group:
        return 'Team collaboration on any topic';
      case ChannelType.project:
        return 'Linked to a construction project';
      case ChannelType.announcement:
        return 'One-way broadcasts from management';
      default:
        return '';
    }
  }

  Widget _card(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppTheme.textMuted,
        ),
      ),
    );
  }
}

// ── Member Picker Sheet ───────────────────────────────────────────────────────
class _MemberPickerSheet extends StatefulWidget {
  final List<UserModel> allUsers;
  final List<String> selected;
  const _MemberPickerSheet({required this.allUsers, required this.selected});

  @override
  State<_MemberPickerSheet> createState() => _MemberPickerSheetState();
}

class _MemberPickerSheetState extends State<_MemberPickerSheet> {
  late List<String> _picked;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _picked = List.from(widget.selected);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _search.text.isEmpty
        ? widget.allUsers
        : widget.allUsers
              .where(
                (u) =>
                    u.name.toLowerCase().contains(_search.text.toLowerCase()),
              )
              .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (ctx, sc) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: Column(
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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Add Members',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, _picked),
                  child: const Text('Done'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(
                hintText: 'Search…',
                prefixIcon: Icon(Icons.search_rounded),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              controller: sc,
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final u = filtered[i];
                final sel = _picked.contains(u.uid);
                return CheckboxListTile(
                  value: sel,
                  onChanged: (v) => setState(
                    () =>
                        v == true ? _picked.add(u.uid) : _picked.remove(u.uid),
                  ),
                  secondary: AvatarWidget(
                    name: u.name,
                    imageUrl: u.avatarUrl,
                    size: 40,
                  ),
                  title: Text(
                    u.name,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(u.email, style: const TextStyle(fontSize: 12)),
                  activeColor: AppTheme.primary,
                );
              },
            ),
          ),
        ],
        ),
      ),
    );
  }
}
