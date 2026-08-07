import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/models/role_model.dart';
import '../../data/models/user_model.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

class RoleDetailScreen extends ConsumerWidget {
  final String roleId;
  const RoleDetailScreen({super.key, required this.roleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleAsync = ref.watch(roleStreamProvider(roleId));
    final membersAsync = ref.watch(usersByRoleProvider(roleId));
    final allRolesAsync = ref.watch(allRolesProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: roleAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(roleStreamProvider(roleId)),
        ),
        data: (role) {
          if (role == null) {
            return const CustomScrollView(
              slivers: [
                SliverAppBar(title: Text('Role Detail'), pinned: true),
                SliverFillRemaining(
                  child: Center(
                    child: Text(
                      'Role not found',
                      style: TextStyle(color: AppTheme.textMuted),
                    ),
                  ),
                ),
              ],
            );
          }
          final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));

          return CustomScrollView(
            slivers: [
              // Header
              SliverAppBar(
                expandedHeight: 160,
                pinned: true,
                backgroundColor: color,
                foregroundColor: Colors.white,
                actions: [
                  if (_canEdit(ref, role))
                    IconButton(
                      icon: const Icon(Icons.edit_rounded),
                      tooltip: 'Edit Role',
                      onPressed: () =>
                          context.push('/admin/roles/${role.id}/edit'),
                    ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [color, color.withValues(alpha: 0.71)],
                      ),
                    ),
                    child: SafeArea(
                      bottom: false,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                role.name[0].toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            role.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (role.description.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 32,
                              ),
                              child: Text(
                                role.description,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.78),
                                  fontSize: 12,
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Stats row
                      Row(
                        children: [
                          _StatChip(
                            icon: Icons.military_tech_rounded,
                            label: 'Level ${role.level}',
                            color: color,
                          ),
                          const SizedBox(width: 8),
                          _StatChip(
                            icon: Icons.lock_open_outlined,
                            label:
                                '${role.permissions.toMap().values.where((v) => v == true).length} permissions',
                            color: AppTheme.success,
                          ),
                          if (role.isSystem) ...[
                            const SizedBox(width: 8),
                            _StatChip(
                              icon: Icons.lock_rounded,
                              label: 'System',
                              color: AppTheme.textMuted,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Members section
                      _SectionHeader(
                        title: 'Team Members',
                        trailing: membersAsync.value != null
                            ? '${membersAsync.value!.length} total'
                            : null,
                      ),
                      const SizedBox(height: 8),
                      membersAsync.when(
                        loading: () => const ShimmerList(),
                        error: (e, _) => AppErrorWidget(
                          message: e.toString(),
                          onRetry: () =>
                              ref.invalidate(usersByRoleProvider(roleId)),
                        ),
                        data: (members) => members.isEmpty
                            ? _EmptyMembers(roleName: role.name)
                            : Column(
                                children: members
                                    .map(
                                      (u) => _MemberTile(
                                        user: u,
                                        role: role,
                                        allRoles: allRolesAsync.value ?? [],
                                        onRoleChange: (newRoleId) async {
                                          try {
                                            await ref
                                                .read(userRepositoryProvider)
                                                .changeUserRole(
                                                  u.uid,
                                                  newRoleId,
                                                );
                                            if (context.mounted) {
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                const SnackBar(
                                                  content: Text(
                                                    'User moved to new role',
                                                  ),
                                                  behavior:
                                                      SnackBarBehavior.floating,
                                                  backgroundColor:
                                                      AppTheme.success,
                                                ),
                                              );
                                            }
                                          } catch (e) {
                                            if (context.mounted) {
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                SnackBar(
                                                  content: Text(
                                                    'Failed to move user: ${e.toString()}',
                                                  ),
                                                  behavior:
                                                      SnackBarBehavior.floating,
                                                  backgroundColor:
                                                      AppTheme.error,
                                                ),
                                              );
                                            }
                                          }
                                        },
                                      ),
                                    )
                                    .toList(),
                              ),
                      ),
                      const SizedBox(height: 20),

                      // Add member button
                      _AddMemberButton(
                        currentRole: role,
                        allRoles: allRolesAsync.value ?? [],
                        currentMembers: membersAsync.value ?? [],
                      ),
                      const SizedBox(height: 20),

                      // Permissions section
                      const _SectionHeader(title: 'Permissions'),
                      const SizedBox(height: 8),
                      _PermissionsCard(permissions: role.permissions),
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

  bool _canEdit(WidgetRef ref, RoleModel role) {
    if (role.isSystem) return false;
    final myRole = ref.watch(currentRoleProvider).value;
    if (myRole == null) return false;
    // Admins (Lv 100) can edit all non-system roles
    if (myRole.level >= 100) return true;
    // Others can only edit roles below them
    return role.level < myRole.level;
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        border: Border.all(color: color.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? trailing;
  const _SectionHeader({required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const Spacer(),
        if (trailing != null)
          Text(
            trailing!,
            style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
          ),
      ],
    );
  }
}

class _MemberTile extends StatelessWidget {
  final UserModel user;
  final RoleModel role;
  final List<RoleModel> allRoles;
  final Future<void> Function(String newRoleId) onRoleChange;
  const _MemberTile({
    required this.user,
    required this.role,
    required this.allRoles,
    required this.onRoleChange,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Row(
        children: [
          AvatarWidget(name: user.name, imageUrl: user.avatarUrl, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  user.email,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          // Reassign role button
          TextButton.icon(
            icon: const Icon(Icons.swap_horiz_rounded, size: 16),
            label: const Text('Move', style: TextStyle(fontSize: 12)),
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => _showRolePicker(context),
          ),
        ],
      ),
    );
  }

  void _showRolePicker(BuildContext context) {
    final others = allRoles.where((r) => r.id != role.id).toList()
      ..sort((a, b) => b.level.compareTo(a.level));

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
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
                    'Move ${user.name} to…',
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
                            subtitle: Text(
                              'Level ${r.level}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: const Icon(
                              Icons.chevron_right_rounded,
                              color: Color(0xFFCBD5E1),
                            ),
                            onTap: () {
                              Navigator.pop(ctx);
                              onRoleChange(r.id);
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

class _EmptyMembers extends StatelessWidget {
  final String roleName;
  const _EmptyMembers({required this.roleName});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        children: [
          Icon(
            Icons.people_outline_rounded,
            size: 36,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 8),
          Text(
            'No members with $roleName role',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 4),
          Text(
            'Use "Add Member" below to assign users',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
          ),
        ],
      ),
    );
  }
}

class _AddMemberButton extends ConsumerWidget {
  final RoleModel currentRole;
  final List<RoleModel> allRoles;
  final List<UserModel> currentMembers;

  const _AddMemberButton({
    required this.currentRole,
    required this.allRoles,
    required this.currentMembers,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        icon: const Icon(Icons.person_add_outlined),
        label: const Text('Add Member to This Role'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppTheme.primary,
          side: const BorderSide(color: AppTheme.primary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onPressed: () => _showUserPicker(context, ref),
      ),
    );
  }

  void _showUserPicker(BuildContext ctx, WidgetRef ref) async {
    final allUsers = await ref.read(userRepositoryProvider).getAllUsers();
    // Show users NOT already in this role
    final eligibleUsers =
        allUsers.where((u) => u.roleId != currentRole.id && u.isActive).toList()
          ..sort((a, b) => a.name.compareTo(b.name));

    if (!ctx.mounted) return;
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
      ),
      builder: (sheetCtx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, controller) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Text(
                'Assign to "${currentRole.name}"',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Select a user to assign to this role',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
            ),
            const Divider(height: 20),
            Expanded(
              child: eligibleUsers.isEmpty
                  ? const Center(
                      child: Text('All active users are already in this role'),
                    )
                  : ListView.builder(
                      controller: controller,
                      itemCount: eligibleUsers.length,
                      itemBuilder: (_, i) {
                        final u = eligibleUsers[i];
                        // Find current role name
                        final currentRoleName = allRoles
                            .firstWhere(
                              (r) => r.id == u.roleId,
                              orElse: () => RoleModel(
                                id: '',
                                name: 'No role',
                                description: '',
                                color: '#999',
                                createdBy: '',
                                createdAt: DateTime.now(),
                                permissions: const PermissionModel(),
                              ),
                            )
                            .name;

                        return ListTile(
                          leading: AvatarWidget(
                            name: u.name,
                            imageUrl: u.avatarUrl,
                            size: 40,
                          ),
                          title: Text(
                            u.name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            'Currently: $currentRoleName',
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: const Icon(
                            Icons.add_circle_outline,
                            color: AppTheme.primary,
                          ),
                          onTap: () async {
                            Navigator.pop(sheetCtx);
                            await ref
                                .read(userRepositoryProvider)
                                .changeUserRole(u.uid, currentRole.id);
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '${u.name} assigned to ${currentRole.name}',
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                  backgroundColor: AppTheme.success,
                                ),
                              );
                            }
                          },
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

class _PermissionsCard extends StatelessWidget {
  final PermissionModel permissions;
  const _PermissionsCard({required this.permissions});

  static const _groups = [
    {
      'title': 'Tasks',
      'keys': [
        'tasks_view',
        'tasks_view_all',
        'tasks_create',
        'tasks_edit',
        'tasks_delete',
        'tasks_approve',
      ],
    },
    {
      'title': 'Projects',
      'keys': [
        'projects_view',
        'projects_view_all',
        'projects_create',
        'projects_edit',
        'projects_delete',
      ],
    },
    {
      'title': 'Documents',
      'keys': ['docs_view', 'docs_view_all', 'docs_upload', 'docs_approve'],
    },
    {
      'title': 'Team',
      'keys': ['team_view', 'team_manage', 'team_delete'],
    },
    {
      'title': 'Reports',
      'keys': ['reports_view', 'reports_export'],
    },
    {
      'title': 'Time',
      'keys': ['time_log', 'time_view_all'],
    },
    {
      'title': 'Admin',
      'keys': ['roles_manage', 'settings_manage', 'notifications_manage'],
    },
    {
      'title': 'Chat',
      'keys': [
        'chat_view',
        'chat_send',
        'chat_create_group',
        'chat_announce',
        'chat_moderate',
      ],
    },
    {
      'title': 'Attendance',
      'keys': ['attendance_view_all'],
    },
  ];

  static const _labels = {
    'tasks_view': 'View tasks',
    'tasks_view_all': 'View all tasks globally',
    'tasks_create': 'Create tasks',
    'tasks_edit': 'Edit tasks',
    'tasks_delete': 'Delete tasks',
    'tasks_approve': 'Approve tasks',
    'projects_view': 'View projects',
    'projects_view_all': 'View all projects globally',
    'projects_create': 'Create projects',
    'projects_edit': 'Edit projects',
    'projects_delete': 'Delete projects',
    'docs_view': 'View documents',
    'docs_view_all': 'View all documents globally',
    'docs_upload': 'Upload documents',
    'docs_approve': 'Approve documents',
    'team_view': 'View team',
    'team_manage': 'Manage team',
    'team_delete': 'Delete team members',
    'reports_view': 'View reports',
    'reports_export': 'Export reports',
    'time_log': 'Log time',
    'time_view_all': 'View all timesheets',
    'roles_manage': 'Manage roles',
    'settings_manage': 'App settings',
    'notifications_manage': 'Manage notifications',
    'chat_view': 'View channels',
    'chat_send': 'Send messages',
    'chat_create_group': 'Create groups',
    'chat_announce': 'Post announcements',
    'chat_moderate': 'Moderate chat',
    'attendance_view_all': 'View all staff attendance',
  };

  @override
  Widget build(BuildContext context) {
    final permMap = permissions.toMap();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        children: _groups.map((group) {
          final keys = (group['keys'] as List).cast<String>();
          final enabledCount = keys.where((k) => permMap[k] == true).length;

          return ExpansionTile(
            title: Row(
              children: [
                Text(
                  group['title'] as String,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: enabledCount > 0
                        ? AppTheme.success.withValues(alpha: 0.08)
                        : Colors.grey.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: Text(
                    '$enabledCount/${keys.length}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: enabledCount > 0 ? AppTheme.success : Colors.grey,
                    ),
                  ),
                ),
              ],
            ),
            children: keys.map((k) {
              final enabled = permMap[k] == true;
              return ListTile(
                dense: true,
                leading: Icon(
                  enabled ? Icons.check_circle_rounded : Icons.cancel_rounded,
                  size: 18,
                  color: enabled ? AppTheme.success : Colors.grey.shade300,
                ),
                title: Text(
                  _labels[k] ?? k,
                  style: TextStyle(
                    fontSize: 13,
                    color: enabled ? AppTheme.onSurface : AppTheme.textLight,
                    decoration: enabled ? null : TextDecoration.lineThrough,
                  ),
                ),
              );
            }).toList(),
          );
        }).toList(),
      ),
    );
  }
}
