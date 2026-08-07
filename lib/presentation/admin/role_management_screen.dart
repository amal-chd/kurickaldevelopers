import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/models/role_model.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/permission_gate.dart';

class RoleManagementScreen extends ConsumerWidget {
  const RoleManagementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rolesAsync = ref.watch(allRolesProvider);
    final repo = ref.watch(roleRepositoryProvider);
    final myRole = ref.watch(currentRoleProvider).value;
    final myLevel = myRole?.level ?? 0;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Role Hierarchy'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              'Tap a role to view members and permissions',
              style: TextStyle(
                color: AppTheme.textMuted,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
      body: rolesAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(allRolesProvider),
        ),
        data: (roles) {
          // Sort by level descending (highest authority first)
          final sorted = [...roles]..sort((a, b) => b.level.compareTo(a.level));

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: sorted.length + 1, // +1 for header
            itemBuilder: (_, i) {
              if (i == 0) {
                return _HierarchyLegend(roles: sorted);
              }
              final role = sorted[i - 1];
              // Can manage roles below your level OR you are an Admin (Level 100)
              final canManage = role.level < myLevel || myLevel >= 100;
              return _RoleHierarchyCard(
                role: role,
                onEdit: (!role.isSystem && canManage)
                    ? () => context.push('/admin/roles/${role.id}/edit')
                    : null,
                onDelete: (!role.isSystem && canManage)
                    ? () => _confirmDelete(context, ref, repo, role)
                    : null,
                onTap: () => context.push('/admin/roles/${role.id}'),
              );
            },
          );
        },
      ),
      floatingActionButton: PermissionGate(
        permission: 'roles_manage',
        child: FloatingActionButton.extended(
          onPressed: () => context.push('/admin/roles/create'),
          icon: const Icon(Icons.add),
          label: const Text('Create Role'),
          backgroundColor: AppTheme.primary,
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    dynamic repo,
    RoleModel role,
  ) async {
    // Check if role has members first
    final users = await ref.read(userRepositoryProvider).getAllUsers();
    final memberCount = users.where((u) => u.roleId == role.id).length;

    if (!context.mounted) return;
    if (memberCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Cannot delete "${role.name}" — $memberCount member(s) assigned to this role. Reassign them first.',
          ),
          backgroundColor: AppTheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Role'),
        content: Text('Delete "${role.name}"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await repo.deleteRole(role.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Role "${role.name}" deleted'),
              backgroundColor: AppTheme.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete role: ${e.toString()}'),
              backgroundColor: AppTheme.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }
}

class _HierarchyLegend extends StatelessWidget {
  final List<RoleModel> roles;
  const _HierarchyLegend({required this.roles});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.account_tree_rounded,
                size: 18,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 8),
              const Text(
                'Hierarchy Overview',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const Spacer(),
              Text(
                '${roles.length} roles',
                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...roles.map((r) {
            final color = Color(int.parse(r.color.replaceFirst('#', '0xFF')));
            final barWidth = (r.level / 100.0);
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  SizedBox(
                    width: 100,
                    child: Text(
                      r.name,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                      child: LinearProgressIndicator(
                        value: barWidth,
                        backgroundColor: color.withValues(alpha: 0.12),
                        valueColor: AlwaysStoppedAnimation(color),
                        minHeight: 8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Lv.${r.level}',
                    style: TextStyle(
                      fontSize: 10,
                      color: color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _RoleHierarchyCard extends ConsumerWidget {
  final RoleModel role;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback onTap;

  const _RoleHierarchyCard({
    required this.role,
    required this.onEdit,
    required this.onDelete,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
    final membersAsync = ref.watch(usersByRoleProvider(role.id));
    final memberCount = membersAsync.value?.length ?? 0;
    final permCount = role.permissions
        .toMap()
        .values
        .where((v) => v == true)
        .length;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border.all(color: AppTheme.divider),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          children: [
            // Level indicator bar at top
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppTheme.radiusLg),
              ),
              child: LinearProgressIndicator(
                value: role.level / 100.0,
                backgroundColor: color.withValues(alpha: 0.08),
                valueColor: AlwaysStoppedAnimation(color),
                minHeight: 4,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  // Avatar circle
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        role.name[0].toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
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
                                role.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                            if (role.isSystem) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.textMuted.withValues(
                                    alpha: 0.08,
                                  ),
                                  borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                                ),
                                child: const Text(
                                  'System',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: AppTheme.textMuted,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            _Badge(
                              icon: Icons.military_tech_rounded,
                              label: 'Lv.${role.level}',
                              color: color,
                            ),
                            const SizedBox(width: 6),
                            _Badge(
                              icon: Icons.people_outline_rounded,
                              label:
                                  '$memberCount member${memberCount == 1 ? '' : 's'}',
                              color: const Color(0xFF0EA5E9),
                            ),
                            const SizedBox(width: 6),
                            _Badge(
                              icon: Icons.lock_open_outlined,
                              label: '$permCount perms',
                              color: const Color(0xFF10B981),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Actions
                  Column(
                    children: [
                      if (onEdit != null)
                        InkWell(
                          onTap: onEdit,
                          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.edit_outlined,
                              size: 20,
                              color: AppTheme.textMuted,
                            ),
                          ),
                        ),
                      if (onDelete != null)
                        InkWell(
                          onTap: onDelete,
                          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.delete_outline_rounded,
                              size: 20,
                              color: AppTheme.error,
                            ),
                          ),
                        ),
                      if (role.isSystem)
                        const Padding(
                          padding: EdgeInsets.all(6),
                          child: Icon(
                            Icons.lock_rounded,
                            size: 20,
                            color: AppTheme.textLight,
                          ),
                        ),
                    ],
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppTheme.divider,
                    size: 20,
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

class _Badge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _Badge({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
