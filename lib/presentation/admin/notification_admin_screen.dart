import 'package:uuid/uuid.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/models/role_model.dart';
import '../../data/models/notification_model.dart';
import '../../data/repositories/notification_repository.dart';
import '../../data/services/push_sender.dart';
import '../../providers/admin_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../../core/utils/validators.dart';

class NotificationAdminScreen extends ConsumerStatefulWidget {
  const NotificationAdminScreen({super.key});

  @override
  ConsumerState<NotificationAdminScreen> createState() =>
      _NotificationAdminScreenState();
}

class _NotificationAdminScreenState
    extends ConsumerState<NotificationAdminScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rolesAsync = ref.watch(allRolesProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Notification Center'),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.accent,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textMuted,
          tabs: const [
            Tab(icon: Icon(Icons.send_rounded, size: 16), text: 'Send'),
            Tab(icon: Icon(Icons.history_rounded, size: 16), text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          // ── Compose Tab ───────────────────────────────────────────────────
          _ComposeTab(roles: rolesAsync.value ?? []),

          // ── History Tab ───────────────────────────────────────────────────
          const _HistoryTab(),
        ],
      ),
    );
  }
}

// ─── Compose Tab ─────────────────────────────────────────────────────────────

class _ComposeTab extends ConsumerStatefulWidget {
  final List<RoleModel> roles;
  const _ComposeTab({required this.roles});

  @override
  ConsumerState<_ComposeTab> createState() => _ComposeTabState();
}

class _ComposeTabState extends ConsumerState<_ComposeTab> {
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  String? _targetRole; // null = all users
  bool _sending = false;

  static const _templates = [
    (
      'Safety Alert',
      'Please ensure all safety equipment is worn on site at all times.',
    ),
    (
      'Meeting Reminder',
      'Team meeting scheduled for today. Please be on time.',
    ),
    ('Work Update', 'Please update your task status by end of day.'),
    (
      'Holiday Notice',
      'Office will be closed tomorrow. Please plan accordingly.',
    ),
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final recipientCount = _getRecipientCount();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Recipient ──────────────────────────────────────────────────────
        _SectionCard(
          title: 'Recipients',
          icon: Icons.group_rounded,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Send to:',
                style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _AudienceChip(
                    label: 'Everyone',
                    icon: Icons.public_rounded,
                    selected: _targetRole == null,
                    color: AppTheme.primary,
                    onTap: () => setState(() => _targetRole = null),
                  ),
                  ...widget.roles.map((r) {
                    final c = Color(
                      int.parse(r.color.replaceFirst('#', '0xFF')),
                    );
                    return _AudienceChip(
                      label: r.name,
                      icon: Icons.shield_outlined,
                      selected: _targetRole == r.id,
                      color: c,
                      onTap: () => setState(() => _targetRole = r.id),
                    );
                  }),
                ],
              ),
              if (recipientCount != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.info.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.info_outline_rounded,
                        size: 14,
                        color: AppTheme.info,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Sending to ~$recipientCount users',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.info,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 12),

        // ── Templates ──────────────────────────────────────────────────────
        _SectionCard(
          title: 'Quick Templates',
          icon: Icons.auto_awesome_rounded,
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _templates.map((t) {
              final (name, body) = t;
              return ActionChip(
                label: Text(name, style: const TextStyle(fontSize: 12)),
                onPressed: () => setState(() {
                  _titleCtrl.text = name;
                  _bodyCtrl.text = body;
                }),
                backgroundColor: AppTheme.accent.withValues(alpha: 0.06),
                labelStyle: const TextStyle(
                  color: AppTheme.accent,
                  fontWeight: FontWeight.w500,
                ),
              );
            }).toList(),
          ),
        ),

        const SizedBox(height: 12),

        // ── Message ────────────────────────────────────────────────────────
        _SectionCard(
          title: 'Message',
          icon: Icons.message_outlined,
          child: Column(
            children: [
              TextField(
                controller: _titleCtrl,
                decoration: InputDecoration(
                  labelText: 'Title',
                  hintText: 'e.g. Site Update',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    borderSide: const BorderSide(color: AppTheme.divider),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _bodyCtrl,
                decoration: InputDecoration(
                  labelText: 'Body',
                  hintText: 'Enter your notification message…',
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    borderSide: const BorderSide(color: AppTheme.divider),
                  ),
                ),
                maxLines: 4,
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Send Button ────────────────────────────────────────────────────
        SizedBox(
          height: 52,
          child: ElevatedButton.icon(
            icon: _sending
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.send_rounded),
            label: const Text(
              'Send Notification',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
            ),
            onPressed: _sending ? null : _send,
          ),
        ),
      ],
    );
  }

  int? _getRecipientCount() {
    // Could wire to actual user count per role. Using placeholder.
    return null;
  }

  Future<void> _send() async {
    final title = _titleCtrl.text.trim();
    final body = _bodyCtrl.text.trim();

    final titleErr = Validators.minLength(title, field: 'Title', min: 3);
    if (titleErr != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(titleErr), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    final bodyErr = Validators.minLength(body, field: 'Body', min: 10);
    if (bodyErr != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(bodyErr), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    setState(() => _sending = true);

    try {
      // 1. Write audit trail to broadcast_notifications collection.
      await ref
          .read(adminRepositoryProvider)
          .sendBroadcastNotification(
            title: title,
            body: body,
            targetRoleId: _targetRole,
          );

      final me = ref.read(currentUserProvider).value;
      await ref
          .read(adminRepositoryProvider)
          .writeAuditLog(
            action: 'notification.sent',
            actorId: me?.uid ?? '',
            actorName: me?.name ?? '',
            targetType: 'notification',
            description: 'Broadcast notification sent: "$title"',
          );

      // 2. Create an in-app notification doc (shows in users' notification screens).
      await NotificationRepository().createNotification(
        NotificationModel(
          id: const Uuid().v4(),
          userId: '', // empty = broadcast to all users
          type: NotificationType.dailyDigest, // closest match for admin broadcast
          title: title,
          body: body,
          createdAt: DateTime.now(),
          relatedId: '',
          relatedType: '',
        ),
      );

      // 3. Trigger OS push notification delivery via Vercel.
      PushSender.instance.broadcast(
        title: title,
        body: body,
        targetRoleId: _targetRole,
      );

      if (mounted) {
        _titleCtrl.clear();
        _bodyCtrl.clear();
        setState(() {
          _sending = false;
          _targetRole = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Notification queued for delivery'),
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      setState(() => _sending = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }
}

// ─── History Tab ──────────────────────────────────────────────────────────────

class _HistoryTab extends ConsumerWidget {
  const _HistoryTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final histAsync = ref.watch(broadcastHistoryProvider);

    return histAsync.when(
      loading: () => const ShimmerList(),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(broadcastHistoryProvider),
      ),
      data: (history) {
        if (history.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.notifications_off_outlined,
                  size: 48,
                  color: AppTheme.textLight,
                ),
                SizedBox(height: 12),
                Text(
                  'No notifications sent yet',
                  style: TextStyle(color: AppTheme.textMuted),
                ),
              ],
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: history.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final n = history[i];
            final sentAt = n['sentAt'];
            final dateStr = sentAt != null
                ? DateFormat(
                    'd MMM, HH:mm',
                  ).format((sentAt as dynamic).toDate())
                : '—';

            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.06),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications_rounded,
                      color: AppTheme.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          n['title'] ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          n['body'] ?? '',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(
                              Icons.access_time_rounded,
                              size: 11,
                              color: AppTheme.textLight,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              dateStr,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.textMuted,
                              ),
                            ),
                            if (n['targetRoleId'] != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.info.withValues(alpha: 0.07),
                                  borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                                ),
                                child: const Text(
                                  'Role-specific',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: AppTheme.info,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ] else ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.success.withValues(
                                    alpha: 0.07,
                                  ),
                                  borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                                ),
                                child: const Text(
                                  'All users',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: AppTheme.success,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: AppTheme.primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          child,
        ],
      ),
    );
  }
}

class _AudienceChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final Color color;
  final VoidCallback onTap;
  const _AudienceChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? color.withValues(alpha: 0.08)
              : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: selected ? color : Colors.transparent),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: selected ? color : AppTheme.textMuted),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? color : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
