import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;

import '../../app/theme.dart';
import '../../core/enums/task_status.dart';
import '../../providers/auth_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(currentUserProvider);
    final tasksAsync = ref.watch(userTasksProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: userAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(currentUserProvider),
        ),
        data: (user) {
          if (user == null) {
            return Scaffold(
              appBar: AppBar(title: const Text('Profile')),
              body: const EmptyStateWidget(
                icon: Icons.person_off_rounded,
                title: 'Not logged in',
                subtitle: 'Please sign in to view your profile.',
              ),
            );
          }
          final roleAsync = ref.watch(currentRoleProvider);

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 220,
                pinned: true,
                backgroundColor: Colors.white,
                foregroundColor: AppTheme.onSurface,
                elevation: 0,
                scrolledUnderElevation: 2,
                surfaceTintColor: Colors.transparent,
                title: const Text('Profile'),
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    color: Colors.white,
                    child: SafeArea(
                      bottom: false,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [AppTheme.primary, AppTheme.primaryMid],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                                boxShadow: AppTheme.mediumShadow,
                              ),
                              child: Row(
                                children: [
                                  AvatarWidget(
                                    name: user.name,
                                    imageUrl: user.avatarUrl,
                                    size: 76,
                                  ),
                                  const SizedBox(width: 18),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          user.name,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 22,
                                            fontWeight: FontWeight.w800,
                                            fontFamily: 'Plus Jakarta Sans',
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        roleAsync.when(
                                          loading: () =>
                                              const SizedBox.shrink(),
                                          error: (_, __) =>
                                              const SizedBox.shrink(),
                                          data: (role) => role != null
                                              ? Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 12,
                                                        vertical: 6,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.accent.withValues(
                                                      alpha: 0.15,
                                                    ),
                                                    borderRadius:
                                                        BorderRadius.circular(AppTheme.radiusPill),
                                                    border: Border.all(
                                                      color: AppTheme.accent.withValues(
                                                        alpha: 0.25,
                                                      ),
                                                    ),
                                                  ),
                                                  child: Text(
                                                    role.name,
                                                    style: const TextStyle(
                                                      color: AppTheme.accent,
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      fontFamily:
                                                          'Plus Jakarta Sans',
                                                    ),
                                                  ),
                                                )
                                              : const SizedBox.shrink(),
                                        ),
                                        const SizedBox(height: 10),
                                        Text(
                                          user.email,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: Colors.white.withValues(
                                              alpha: 0.7,
                                            ),
                                            fontSize: 14,
                                            fontFamily: 'Inter',
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      tasksAsync.when(
                        loading: () => const SizedBox.shrink(),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (tasks) {
                          final mine = tasks
                              .where((t) => t.assigneeIds.contains(user.uid))
                              .toList();
                          final done = mine
                              .where((t) => t.status == TaskStatus.done)
                              .length;
                          final overdue = mine.where((t) => t.isOverdue).length;

                          return Row(
                            children: [
                              _StatCard(
                                label: 'Assigned',
                                value: '${mine.length}',
                                color: AppTheme.primary,
                              ),
                              const SizedBox(width: 12),
                              _StatCard(
                                label: 'Done',
                                value: '$done',
                                color: AppTheme.success,
                              ),
                              const SizedBox(width: 12),
                              _StatCard(
                                label: 'Overdue',
                                value: '$overdue',
                                color: overdue > 0
                                    ? AppTheme.error
                                    : AppTheme.success,
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 24),

                      _SectionCard(
                        title: 'Account Details',
                        children: [
                          _InfoTile(
                            icon: Icons.email_outlined,
                            label: 'Email',
                            value: user.email,
                          ),
                          if (user.phone.isNotEmpty)
                            _InfoTile(
                              icon: Icons.phone_outlined,
                              label: 'Phone',
                              value: user.phone,
                            ),
                          roleAsync.when(
                            loading: () => const SizedBox.shrink(),
                            error: (_, __) => const SizedBox.shrink(),
                            data: (role) => role == null
                                ? const SizedBox.shrink()
                                : _InfoTile(
                                    icon: Icons.badge_outlined,
                                    label: 'Role',
                                    value: role.name,
                                  ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      _SectionCard(
                        title: 'Notification Settings',
                        children: [
                          _NotificationToggleTile(
                            icon: Icons.campaign_rounded,
                            label: 'Group Announcements',
                            subtitle: 'Broad updates and group notifications',
                            value: user.preferences['announcements'] ?? true,
                            onChanged: (val) => _updatePreference(user.uid, user.preferences, 'announcements', val),
                          ),
                          _NotificationToggleTile(
                            icon: Icons.chat_bubble_outline_rounded,
                            label: 'Chat Messages',
                            subtitle: 'Push alerts for direct & group messages',
                            value: user.preferences['chats'] ?? true,
                            onChanged: (val) => _updatePreference(user.uid, user.preferences, 'chats', val),
                          ),
                          _NotificationToggleTile(
                            icon: Icons.task_alt_rounded,
                            label: 'Task Assignments',
                            subtitle: 'Reminders for assignments & status',
                            value: user.preferences['tasks'] ?? true,
                            onChanged: (val) => _updatePreference(user.uid, user.preferences, 'tasks', val),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      _SectionCard(
                        title: 'Account Security',
                        children: [
                          ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.warning.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                              ),
                              child: const Icon(Icons.lock_outline_rounded, color: AppTheme.warning, size: 20),
                            ),
                            title: const Text(
                              'Change Password',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: AppTheme.onSurface,
                              ),
                            ),
                            subtitle: const Text(
                              'Update your password for enhanced security',
                              style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                            ),
                            trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted),
                            onTap: () => _showChangePasswordDialog(context, user.email),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () => _signOut(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.error,
                            side: BorderSide(
                              color: AppTheme.error.withValues(alpha: 0.4),
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.logout_rounded, size: 18),
                              SizedBox(width: 8),
                              Text(
                                'Sign Out',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _updatePreference(
    String uid,
    Map<String, bool> currentPrefs,
    String key,
    bool val,
  ) async {
    final updated = Map<String, bool>.from(currentPrefs);
    updated[key] = val;
    try {
      await ref.read(userRepositoryProvider).updateUser(uid, {'preferences': updated});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update notification settings: $e')),
        );
      }
    }
  }

  void _signOut(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        ),
        title: const Text(
          'Sign Out?',
          style: TextStyle(
            color: AppTheme.onSurface,
            fontWeight: FontWeight.w800,
            fontFamily: 'Plus Jakarta Sans',
          ),
        ),
        content: const Text(
          'You will be logged out of your account.',
          style: TextStyle(
            color: AppTheme.textMuted,
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Cancel',
              style: TextStyle(
                color: AppTheme.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Sign Out',
              style: TextStyle(
                color: AppTheme.error,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      await ref.read(authRepositoryProvider).signOut();
    }
  }

  void _showChangePasswordDialog(BuildContext context, String email) {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool loading = false;
    bool obscureCurrent = true;
    bool obscureNew = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          ),
          title: const Text(
            'Change Password',
            style: TextStyle(
              color: AppTheme.onSurface,
              fontWeight: FontWeight.w800,
              fontFamily: 'Plus Jakarta Sans',
            ),
          ),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Enter your current password and choose a new password.',
                    style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: currentCtrl,
                    obscureText: obscureCurrent,
                    decoration: InputDecoration(
                      labelText: 'Current Password',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      suffixIcon: IconButton(
                        icon: Icon(obscureCurrent ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setStateDialog(() => obscureCurrent = !obscureCurrent),
                      ),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Enter current password' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: newCtrl,
                    obscureText: obscureNew,
                    decoration: InputDecoration(
                      labelText: 'New Password',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      suffixIcon: IconButton(
                        icon: Icon(obscureNew ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setStateDialog(() => obscureNew = !obscureNew),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Enter new password';
                      if (v.length < 6) return 'Must be at least 6 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: confirmCtrl,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Confirm New Password',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    validator: (v) {
                      if (v != newCtrl.text) return 'Passwords do not match';
                      return null;
                    },
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: loading ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: loading
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setStateDialog(() => loading = true);
                      try {
                        final user = fb_auth.FirebaseAuth.instance.currentUser;
                        if (user != null) {
                          final cred = fb_auth.EmailAuthProvider.credential(
                            email: email,
                            password: currentCtrl.text.trim(),
                          );
                          await user.reauthenticateWithCredential(cred);
                          await user.updatePassword(newCtrl.text.trim());
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Password updated successfully!'),
                                backgroundColor: AppTheme.success,
                              ),
                            );
                          }
                        }
                      } on fb_auth.FirebaseAuthException catch (e) {
                        setStateDialog(() => loading = false);
                        String msg = 'Failed to update password';
                        if (e.code == 'wrong-password' || e.code == 'invalid-credential') {
                          msg = 'Current password is incorrect';
                        } else if (e.code == 'weak-password') {
                          msg = 'New password is too weak';
                        } else {
                          msg = e.message ?? msg;
                        }
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text(msg), backgroundColor: AppTheme.error),
                          );
                        }
                      } catch (e) {
                        setStateDialog(() => loading = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.error),
                          );
                        }
                      }
                    },
              child: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: color,
                fontFamily: 'Plus Jakarta Sans',
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SectionCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final listItems = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      listItems.add(children[i]);
      if (i < children.length - 1) {
        listItems.add(
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Divider(height: 1, thickness: 0.5),
          ),
        );
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppTheme.textMuted,
                fontFamily: 'Plus Jakarta Sans',
                letterSpacing: 0.5,
              ),
            ),
          ),
          ...listItems,
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppTheme.primary.withValues(alpha: 0.05),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: AppTheme.primary),
      ),
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          color: AppTheme.textMuted,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        value,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.onSurface,
        ),
      ),
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
    );
  }
}

class _NotificationToggleTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _NotificationToggleTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      value: value,
      onChanged: onChanged,
      activeTrackColor: AppTheme.primary,
      secondary: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppTheme.primary.withValues(alpha: 0.05),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: AppTheme.primary),
      ),
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppTheme.onSurface,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontSize: 11,
          color: AppTheme.textMuted,
          fontWeight: FontWeight.w500,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
    );
  }
}
