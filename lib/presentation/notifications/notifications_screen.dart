import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../core/extensions/datetime_ext.dart';
import '../../data/models/notification_model.dart';
import '../../providers/notification_provider.dart';
import '../../providers/user_provider.dart';
import '../../app/theme.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifsAsync = ref.watch(notificationsProvider);
    final repo = ref.watch(notificationRepositoryProvider);
    final currentUid = ref.watch(currentUserProvider).value?.uid ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              final uid = ref.read(currentUserProvider).value?.uid;
              if (uid != null) {
                await repo.markAllAsRead(uid);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('All notifications marked as read'),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 2),
                    ),
                  );
                }
              }
            },
            child: const Text(
              'Mark all read',
              style: TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: notifsAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
        data: (notifs) {
          if (notifs.isEmpty) {
            return const EmptyStateWidget(
              title: 'No notifications',
              subtitle: "You're all caught up!",
              icon: Icons.notifications_none_rounded,
            );
          }

          final todayList = <NotificationModel>[];
          final yesterdayList = <NotificationModel>[];
          final earlierList = <NotificationModel>[];
          for (final n in notifs) {
            if (n.createdAt.isToday) {
              todayList.add(n);
            } else if (n.createdAt.isYesterday) {
              yesterdayList.add(n);
            } else {
              earlierList.add(n);
            }
          }
          final groups = <String, List<NotificationModel>>{
            if (todayList.isNotEmpty) 'Today': todayList,
            if (yesterdayList.isNotEmpty) 'Yesterday': yesterdayList,
            if (earlierList.isNotEmpty) 'Earlier': earlierList,
          };

          return ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: groups.entries.length,
            itemBuilder: (context, groupIdx) {
              final entry = groups.entries.elementAt(groupIdx);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      entry.key.toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        letterSpacing: 1.1,
                        color: AppTheme.textLight,
                        fontFamily: 'Plus Jakarta Sans',
                      ),
                    ),
                  ),
                  ...entry.value.map((n) {
                    return Dismissible(
                      key: Key(n.id),
                      background: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.success.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        ),
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.only(left: 20),
                        child: const Row(
                          children: [
                            Icon(Icons.done_all_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Mark Read',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                fontFamily: 'Plus Jakarta Sans',
                              ),
                            ),
                          ],
                        ),
                      ),
                      secondaryBackground: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.error.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        ),
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 20),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text(
                              'Delete',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                fontFamily: 'Plus Jakarta Sans',
                              ),
                            ),
                            SizedBox(width: 8),
                            Icon(Icons.delete_outline_rounded, color: Colors.white, size: 20),
                          ],
                        ),
                      ),
                      onDismissed: (direction) {
                        if (direction == DismissDirection.startToEnd) {
                          repo.markAsRead(n.id, currentUid);
                        } else {
                          repo.deleteNotification(n.id);
                        }
                      },
                      child: _NotificationTile(
                        notification: n,
                        onTap: () {
                          repo.markAsRead(n.id, currentUid);
                          _navigate(context, n);
                        },
                      ),
                    );
                  }),
                ],
              );
            },
          );
        },
        ),
      ),
    );
  }

  void _navigate(BuildContext context, NotificationModel n) {
    switch (n.type) {
      case NotificationType.taskAssigned:
      case NotificationType.taskDue:
      case NotificationType.taskOverdue:
      case NotificationType.approvalNeeded:
      case NotificationType.mention:
      case NotificationType.slaBreach:
        if (n.relatedId.isNotEmpty) context.push('/tasks/${n.relatedId}');
        break;
      case NotificationType.chatMessage:
      case NotificationType.announcement:
        if (n.relatedId.isNotEmpty) context.push('/chat/${n.relatedId}');
        break;
      case NotificationType.projectUpdate:
        if (n.relatedId.isNotEmpty) context.push('/projects/${n.relatedId}');
        break;
      case NotificationType.diaryEntry:
        context.go('/site-diary');
        break;
      case NotificationType.documentUploaded:
        context.go('/documents');
        break;
      case NotificationType.dailyDigest:
        context.go('/dashboard');
        break;
    }
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel notification;
  final VoidCallback onTap;
  const _NotificationTile({required this.notification, required this.onTap});

  IconData get _icon {
    switch (notification.type) {
      case NotificationType.taskAssigned:
        return Icons.assignment_ind_rounded;
      case NotificationType.taskDue:
        return Icons.access_time_rounded;
      case NotificationType.taskOverdue:
        return Icons.warning_rounded;
      case NotificationType.approvalNeeded:
        return Icons.approval_rounded;
      case NotificationType.mention:
        return Icons.alternate_email_rounded;
      case NotificationType.slaBreach:
        return Icons.timer_off_rounded;
      case NotificationType.dailyDigest:
        return Icons.summarize_rounded;
      case NotificationType.chatMessage:
        return Icons.chat_bubble_rounded;
      case NotificationType.projectUpdate:
        return Icons.business_rounded;
      case NotificationType.diaryEntry:
        return Icons.menu_book_rounded;
      case NotificationType.documentUploaded:
        return Icons.description_rounded;
      case NotificationType.announcement:
        return Icons.campaign_rounded;
    }
  }

  Color get _iconColor {
    switch (notification.type) {
      case NotificationType.taskOverdue:
      case NotificationType.slaBreach:
        return AppTheme.error;
      case NotificationType.announcement:
        return const Color(0xFF9333EA); // Purple
      case NotificationType.approvalNeeded:
        return const Color(0xFF8B5CF6);
      case NotificationType.mention:
        return AppTheme.info;
      case NotificationType.taskAssigned:
      case NotificationType.taskDue:
        return AppTheme.primary;
      default:
        return AppTheme.brand;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isUnread = !notification.isRead;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: isUnread
            ? AppTheme.primary.withValues(alpha: 0.02)
            : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: isUnread
              ? AppTheme.primary.withValues(alpha: 0.12)
              : AppTheme.divider.withValues(alpha: 0.3),
        ),
        boxShadow: AppTheme.softShadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left color indicator bar
              Container(
                width: 5,
                color: _iconColor,
              ),
              Expanded(
                child: InkWell(
                  onTap: onTap,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Icon bubble
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: _iconColor.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _icon,
                            color: _iconColor,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 14),
                        // Text contents
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                notification.title,
                                style: TextStyle(
                                  fontWeight: isUnread ? FontWeight.w700 : FontWeight.w600,
                                  fontSize: 14,
                                  color: AppTheme.onSurface,
                                  fontFamily: 'Plus Jakarta Sans',
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                notification.body,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isUnread ? AppTheme.onSurface.withValues(alpha: 0.8) : AppTheme.textMuted,
                                  fontFamily: 'Inter',
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(
                                    Icons.access_time_rounded,
                                    size: 12,
                                    color: AppTheme.textLight.withValues(alpha: 0.7),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    timeago.format(notification.createdAt),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppTheme.textLight,
                                      fontFamily: 'Inter',
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Unread pulse dot or arrow
                        if (isUnread)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppTheme.accent,
                              shape: BoxShape.circle,
                            ),
                          )
                        else
                          Icon(
                            Icons.keyboard_arrow_right_rounded,
                            color: AppTheme.textLight.withValues(alpha: 0.4),
                            size: 18,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
