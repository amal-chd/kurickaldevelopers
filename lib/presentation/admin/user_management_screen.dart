import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/utils/validators.dart';
import '../../data/models/user_model.dart';
import '../../data/models/role_model.dart';
import '../../providers/admin_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/permission_gate.dart';
import '../../data/services/push_sender.dart';

class UserManagementScreen extends ConsumerStatefulWidget {
  const UserManagementScreen({super.key});

  @override
  ConsumerState<UserManagementScreen> createState() =>
      _UserManagementScreenState();
}

class _UserManagementScreenState extends ConsumerState<UserManagementScreen> {
  String _search = '';
  String? _roleFilter;

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(allUsersProvider);
    final rolesAsync = ref.watch(allRolesProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('User Management'),
      ),
      body: Column(
        children: [
          // Search + Filter bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search users…',
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        size: 20,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        borderSide: const BorderSide(
                          color: AppTheme.divider,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        borderSide: const BorderSide(
                          color: AppTheme.divider,
                        ),
                      ),
                    ),
                    onChanged: (v) =>
                        setState(() => _search = v.toLowerCase()),
                  ),
                ),
                const SizedBox(width: 10),
                rolesAsync.when(
                  data: (roles) => _RoleFilterChip(
                    roles: roles,
                    selected: _roleFilter,
                    onChanged: (v) => setState(() => _roleFilter = v),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: usersAsync.when(
              loading: () => const ShimmerList(),
              error: (e, _) => AppErrorWidget(
                message: e.toString(),
                onRetry: () => ref.invalidate(allUsersProvider),
              ),
              data: (users) {
                var filtered = users.where((u) {
                  final matchSearch =
                      _search.isEmpty ||
                      u.name.toLowerCase().contains(_search) ||
                      u.email.toLowerCase().contains(_search) ||
                      u.phone.contains(_search);
                  final matchRole =
                      _roleFilter == null || u.roleId == _roleFilter;
                  return matchSearch && matchRole;
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.search_off_rounded,
                          size: 48,
                          color: AppTheme.textLight,
                        ),
                        SizedBox(height: 12),
                        Text(
                          'No users found',
                          style: TextStyle(color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _UserCard(
                    user: filtered[i],
                    roles: rolesAsync.value ?? [],
                    onRefresh: () => ref.invalidate(allUsersProvider),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: PermissionGate(
        permission: 'team_manage',
        child: FloatingActionButton.extended(
          onPressed: () => _showAddUserSheet(context, ref, rolesAsync.value ?? []),
          icon: const Icon(Icons.person_add_rounded),
          label: const Text('Add User'),
          backgroundColor: AppTheme.primary,
        ),
      ),
    );
  }

  void _showAddUserSheet(
    BuildContext context,
    WidgetRef ref,
    List<RoleModel> roles,
  ) {
    final myLevel = ref.read(currentRoleProvider).value?.level ?? 0;
    // Only allow assigning roles at or below caller's clearance
    final assignableRoles = roles.where((r) => r.level <= myLevel).toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
      ),
      builder: (_) => _AddUserSheet(roles: assignableRoles),
    );
  }
}

// ─── User Card ────────────────────────────────────────────────────────────────

class _UserCard extends ConsumerWidget {
  final UserModel user;
  final List<RoleModel> roles;
  final VoidCallback onRefresh;

  const _UserCard({
    required this.user,
    required this.roles,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = roles.firstWhere(
      (r) => r.id == user.roleId,
      orElse: () => RoleModel(
        id: '',
        name: 'No Role',
        description: '',
        color: '#94A3B8',
        createdBy: '',
        createdAt: DateTime.now(),
        permissions: const PermissionModel(),
      ),
    );
    final roleColor = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
    final canDelete = ref.watch(hasPermissionProvider('team_delete'));

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Stack(
                  children: [
                    AvatarWidget(
                      name: user.name,
                      imageUrl: user.avatarUrl,
                      size: 46,
                    ),
                    if (!user.isActive)
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: const Icon(
                            Icons.block_rounded,
                            size: 12,
                            color: AppTheme.error,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              user.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: user.isActive
                                  ? AppTheme.success.withValues(alpha: 0.08)
                                  : AppTheme.error.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                            ),
                            child: Text(
                              user.isActive ? 'Active' : 'Inactive',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: user.isActive
                                    ? AppTheme.success
                                    : AppTheme.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.email,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textMuted,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.phone,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textMuted,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: roleColor.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                          border: Border.all(
                            color: roleColor.withValues(alpha: 0.16),
                          ),
                        ),
                        child: Text(
                          role.name,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: roleColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Actions menu
                PopupMenuButton<String>(
                  icon: const Icon(
                    Icons.more_vert_rounded,
                    color: AppTheme.textMuted,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  onSelected: (action) => _handleAction(context, ref, action),
                  itemBuilder: (_) {
                    final items = <PopupMenuEntry<String>>[
                      const PopupMenuItem(
                        value: 'edit',
                        child: _PopupItem(
                          icon: Icons.edit_outlined,
                          label: 'Edit Details',
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'role',
                        child: _PopupItem(
                          icon: Icons.swap_horiz_rounded,
                          label: 'Change Role',
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'reset_password',
                        child: _PopupItem(
                          icon: Icons.lock_reset_rounded,
                          label: 'Reset Password',
                          color: AppTheme.warning,
                        ),
                      ),
                      PopupMenuItem(
                        value: 'toggle',
                        child: _PopupItem(
                          icon: user.isActive
                              ? Icons.block_rounded
                              : Icons.check_circle_outline_rounded,
                          label: user.isActive ? 'Deactivate' : 'Activate',
                          color: user.isActive
                              ? AppTheme.error
                              : AppTheme.success,
                        ),
                      ),
                    ];
                    if (canDelete) {
                      items.addAll([
                        const PopupMenuDivider(),
                        const PopupMenuItem(
                          value: 'delete',
                          child: _PopupItem(
                            icon: Icons.delete_outline_rounded,
                            label: 'Delete User',
                            color: AppTheme.error,
                          ),
                        ),
                      ]);
                    }
                    return items;
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    String action,
  ) async {
    final repo = ref.read(userRepositoryProvider);

    switch (action) {
      case 'edit':
        final saved = await showDialog<bool>(
          context: context,
          builder: (_) => _EditUserDialog(user: user),
        );
        if (saved == true) onRefresh();

      case 'role':
        _showRolePicker(context, ref);

      case 'reset_password':
        _showResetPasswordDialog(context, ref);

      case 'toggle':
        await repo.setUserActive(user.uid, !user.isActive);
        _writeAuditLog(
          ref,
          user.isActive ? 'user.deactivated' : 'user.activated',
          'User "${user.name}" was ${user.isActive ? 'deactivated' : 'activated'}',
        );

      case 'delete':
        final ok = await showDialog<bool>(
          context: context,
          builder: (dialogCtx) => AlertDialog(
            title: const Text('Delete User'),
            content: Text(
              'Permanently delete "${user.name}"? This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogCtx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogCtx, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.error,
                ),
                child: const Text('Delete'),
              ),
            ],
          ),
        );
        if (ok == true) {
          try {
            await repo.deleteUser(user.uid);
            _writeAuditLog(
              ref,
              'user.deleted',
              'User "${user.name}" was deleted',
            );
            onRefresh();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('User "${user.name}" deleted successfully'),
                  backgroundColor: AppTheme.success,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Failed to delete user: $e'),
                  backgroundColor: AppTheme.error,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          }
        }
    }
  }

  void _showRolePicker(BuildContext context, WidgetRef ref) {
    final myLevel = ref.read(currentRoleProvider).value?.level ?? 0;
    // Only allow assigning roles at or below caller's clearance, excluding current
    final others =
        roles.where((r) => r.id != user.roleId && r.level <= myLevel).toList()
          ..sort((a, b) => b.level.compareTo(a.level));

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
      ),
      builder: (ctx) {
        final maxHeight = MediaQuery.sizeOf(ctx).height * 0.75;
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                  child: Text(
                    'Change role for ${user.name}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Divider(height: 1),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        ...others.map((r) {
                          final c = Color(int.parse(r.color.replaceFirst('#', '0xFF')));
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: c,
                              radius: 18,
                              child: Text(
                                r.name[0].toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            title: Text(
                              r.name,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text('Level ${r.level}'),
                            onTap: () async {
                              Navigator.pop(ctx);
                              await ref
                                  .read(userRepositoryProvider)
                                  .changeUserRole(user.uid, r.id);
                              _writeAuditLog(
                                ref,
                                'user.role_changed',
                                'User "${user.name}" moved to role "${r.name}"',
                              );
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('${user.name} → ${r.name}'),
                                    behavior: SnackBarBehavior.floating,
                                    backgroundColor: AppTheme.success,
                                  ),
                                );
                              }
                            },
                          );
                        }),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showResetPasswordDialog(BuildContext context, WidgetRef ref) {
    final newCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool obscureNew = true;
    bool loading = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          ),
          title: Text(
            'Reset Password for ${user.name}',
            style: const TextStyle(
              color: AppTheme.onSurface,
              fontWeight: FontWeight.w800,
              fontSize: 18,
            ),
          ),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Set a new password for this user account.',
                    style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 16),
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
                backgroundColor: AppTheme.warning,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: loading
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setStateDialog(() => loading = true);
                      try {
                        await PushSender.instance.resetUserPassword(
                          targetUid: user.uid,
                          newPassword: newCtrl.text.trim(),
                        );
                        _writeAuditLog(
                          ref,
                          'user.password_reset',
                          'Admin reset password for user "${user.name}"',
                        );
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Password reset successfully for ${user.name}'),
                              backgroundColor: AppTheme.success,
                            ),
                          );
                        }
                      } catch (e) {
                        setStateDialog(() => loading = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(
                              content: Text(e.toString().replaceAll('Exception: ', '')),
                              backgroundColor: AppTheme.error,
                            ),
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
                  : const Text('Reset Password'),
            ),
          ],
        ),
      ),
    );
  }

  void _writeAuditLog(WidgetRef ref, String action, String description) {
    final currentUser = ref.read(currentUserProvider).value;
    ref
        .read(adminRepositoryProvider)
        .writeAuditLog(
          action: action,
          actorId: currentUser?.uid ?? '',
          actorName: currentUser?.name ?? '',
          targetId: user.uid,
          targetType: 'user',
          description: description,
        );
  }
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

class _EditUserDialog extends ConsumerStatefulWidget {
  final UserModel user;
  const _EditUserDialog({required this.user});

  @override
  ConsumerState<_EditUserDialog> createState() => _EditUserDialogState();
}

class _EditUserDialogState extends ConsumerState<_EditUserDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _phoneCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.user.name);
    _phoneCtrl = TextEditingController(text: widget.user.phone);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit User'),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusSm)),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Full Name',
                prefixIcon: Icon(Icons.person_outline_rounded),
              ),
              validator: (v) => Validators.required(v, field: 'Name'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(
                labelText: 'Phone',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(backgroundColor: AppTheme.primary),
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(userRepositoryProvider).updateUserDetails(
        widget.user.uid,
        {
          'name': _nameCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
        },
      );
      if (mounted) Navigator.pop(context, true); // true = saved
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update user: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }
}

// ─── Role Filter Chip ─────────────────────────────────────────────────────────

class _RoleFilterChip extends StatelessWidget {
  final List<RoleModel> roles;
  final String? selected;
  final ValueChanged<String?> onChanged;

  const _RoleFilterChip({
    required this.roles,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected != null
              ? AppTheme.primary.withValues(alpha: 0.06)
              : Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: selected != null ? AppTheme.primary : AppTheme.divider,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.filter_list_rounded,
              size: 16,
              color: selected != null ? AppTheme.primary : AppTheme.textMuted,
            ),
            const SizedBox(width: 4),
            Text(
              selected != null
                  ? roles
                        .firstWhere(
                          (r) => r.id == selected,
                          orElse: () => roles.first,
                        )
                        .name
                  : 'All Roles',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: selected != null ? AppTheme.primary : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
      ),
      builder: (ctx) {
        final maxHeight = MediaQuery.sizeOf(ctx).height * 0.75;
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Filter by Role',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const Divider(height: 1),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(Icons.group_rounded),
                          title: const Text('All Roles'),
                          trailing: selected == null
                              ? const Icon(Icons.check_rounded, color: AppTheme.primary)
                              : null,
                          onTap: () {
                            Navigator.pop(ctx);
                            onChanged(null);
                          },
                        ),
                        ...roles.map((r) {
                          final c = Color(int.parse(r.color.replaceFirst('#', '0xFF')));
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: c,
                              radius: 14,
                              child: Text(
                                r.name[0],
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ),
                            title: Text(r.name),
                            trailing: selected == r.id
                                ? const Icon(Icons.check_rounded, color: AppTheme.primary)
                                : null,
                            onTap: () {
                              Navigator.pop(ctx);
                              onChanged(r.id);
                            },
                          );
                        }),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── Add User Sheet ─────────────────────────────────────────────────────────

class _AddUserSheet extends ConsumerStatefulWidget {
  final List<RoleModel> roles;
  const _AddUserSheet({required this.roles});

  @override
  ConsumerState<_AddUserSheet> createState() => _AddUserSheetState();
}

class _AddUserSheetState extends ConsumerState<_AddUserSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  String? _selectedRole;
  bool _saving = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Add New User',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Directly create a user account and assign their role.',
                  style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: (v) => Validators.required(v, field: 'Name'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => Validators.email(v),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Initial Password',
                    prefixIcon: const Icon(Icons.lock_outlined),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () {
                        HapticFeedback.selectionClick();
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                    ),
                  ),
                  validator: (v) => Validators.password(v),
                ),
                const SizedBox(height: 12),
                // Role picker
                DropdownButtonFormField<String>(
                  initialValue: _selectedRole,
                  decoration: const InputDecoration(
                    labelText: 'Assign Role',
                    prefixIcon: Icon(Icons.shield_outlined),
                  ),
                  items: widget.roles.map((r) {
                    final c = Color(
                      int.parse(r.color.replaceFirst('#', '0xFF')),
                    );
                    return DropdownMenuItem(
                      value: r.id,
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: c,
                            radius: 10,
                            child: Text(
                              r.name[0],
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(r.name),
                        ],
                      ),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedRole = v),
                  validator: (v) => v == null ? 'Please select a role' : null,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.person_add_alt_1_rounded),
                    label: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Add User Account'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      ),
                    ),
                    onPressed: _saving ? null : _addUser,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _addUser() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      final name = _nameCtrl.text.trim();
      final email = _emailCtrl.text.trim();
      final phone = _phoneCtrl.text.trim();
      final password = _passwordCtrl.text;
      final roleId = _selectedRole!;

      // Create the account server-side via the Admin SDK (see PushSender). This
      // keeps the admin signed in AND writes the profile with the admin-assigned
      // role. The old client-side path created the account AS the new user, whose
      // profile write the `roleAllowedForSelf` rule rejected — leaving a ghost
      // Auth account and "email already in use" on the next attempt.
      final uid = await PushSender.instance.createUser(
        name: name,
        email: email,
        phone: phone,
        password: password,
        roleId: roleId,
      );

      // Best-effort audit log — must never fail the creation.
      try {
        final currentUser = ref.read(currentUserProvider).value;
        await ref.read(adminRepositoryProvider).writeAuditLog(
          action: 'user.created',
          actorId: currentUser?.uid ?? '',
          actorName: currentUser?.name ?? '',
          targetId: uid,
          targetType: 'user',
          description: 'Created user "$name" with role "$roleId"',
        );
      } catch (_) {}

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('User "$name" added successfully'),
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _PopupItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  const _PopupItem({required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color ?? AppTheme.onSurface),
        const SizedBox(width: 10),
        Text(label, style: TextStyle(color: color)),
      ],
    );
  }
}
