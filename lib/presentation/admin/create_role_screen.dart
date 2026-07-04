import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/utils/validators.dart';
import '../../data/models/role_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/role_provider.dart';

class CreateRoleScreen extends ConsumerStatefulWidget {
  final String? roleId;
  const CreateRoleScreen({super.key, this.roleId});

  @override
  ConsumerState<CreateRoleScreen> createState() => _CreateRoleScreenState();
}

class _CreateRoleScreenState extends ConsumerState<CreateRoleScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _selectedColor = '#1A3A5C';
  bool _isLoading = false;
  late PermissionModel _permissions;
  int _level = 50;

  static const _presetColors = [
    '#1A3A5C',
    '#F59E0B',
    '#EF4444',
    '#22C55E',
    '#9C27B0',
    '#2196F3',
  ];

  @override
  void initState() {
    super.initState();
    _permissions = const PermissionModel();
    if (widget.roleId != null) _loadRole();
  }

  Future<void> _loadRole() async {
    try {
      final role = await ref
          .read(roleRepositoryProvider)
          .getRole(widget.roleId!);
      if (role != null && mounted) {
        setState(() {
          _nameCtrl.text = role.name;
          _descCtrl.text = role.description;
          _selectedColor = role.color;
          _permissions = role.permissions;
          _level = role.level;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load role: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final userId = ref.read(authRepositoryProvider).currentUser?.uid ?? '';
      final repo = ref.read(roleRepositoryProvider);

      if (widget.roleId != null) {
        await repo.updateRole(widget.roleId!, {
          'name': _nameCtrl.text.trim(),
          'description': _descCtrl.text.trim(),
          'color': _selectedColor,
          'permissions': _permissions.toMap(),
          'level': _level,
        });
      } else {
        final role = RoleModel(
          id: '',
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          color: _selectedColor,
          createdBy: userId,
          createdAt: DateTime.now(),
          permissions: _permissions,
          level: _level,
        );
        await repo.createRole(role);
      }
      if (mounted) context.pop();
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

  void _togglePermission(String key, bool value) {
    // Director/Owner level has all permissions force-enabled
    if (_level >= 90) return;
    final map = _permissions.toMap();
    map[key] = value;
    setState(() => _permissions = PermissionModel.fromMap(map));
  }

  /// Force-enable every permission (used when level >= 90 Director/Owner).
  void _enableAllPermissions() {
    final map = _permissions.toMap();
    for (final key in map.keys) {
      map[key] = true;
    }
    setState(() => _permissions = PermissionModel.fromMap(map));
  }

  String _levelLabel(int level) {
    if (level >= 90) return 'Director / Owner';
    if (level >= 70) return 'Senior Manager';
    if (level >= 50) return 'Manager';
    if (level >= 30) return 'Supervisor';
    if (level >= 10) return 'Staff';
    return 'Junior';
  }

  @override
  Widget build(BuildContext context) {
    // Cap creation to strictly below caller's level (custom roles max out at 99)
    final myLevel = ref.watch(currentRoleProvider).value?.level ?? 100;
    // Admins (Lv 100) can manage up to Lv 100
    final maxLevel = myLevel >= 100 ? 100 : (myLevel - 1).clamp(1, 99);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.roleId != null ? 'Edit Role' : 'Create Role'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _save,
            child: const Text(
              'Save',
              style: TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Role Name'),
              validator: (v) {
                final req = Validators.required(v, field: 'Role name');
                if (req != null) return req;
                return Validators.minLength(v, field: 'Role name', min: 3);
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 2,
              validator: (v) =>
                  Validators.minLength(v, field: 'Description', min: 10),
            ),
            const SizedBox(height: 16),

            // Color picker
            const Text('Color', style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(height: 8),
            Row(
              children: _presetColors.map((c) {
                final color = Color(int.parse(c.replaceFirst('#', '0xFF')));
                return Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedColor = c),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _selectedColor == c
                              ? Colors.black
                              : Colors.transparent,
                          width: 3,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Hierarchy level
            const Text(
              'Hierarchy Level',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'Higher level = more authority. Senior roles can manage roles below them.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Text(
                  'Junior',
                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
                Expanded(
                  child: Slider(
                    value: _level.clamp(1, maxLevel).toDouble(),
                    min: 1,
                    max: maxLevel.toDouble(),
                    divisions: maxLevel > 1 ? maxLevel - 1 : 1,
                    activeColor: AppTheme.primary,
                    label: _levelLabel(_level),
                    onChanged: (v) {
                      final newLevel = v.round();
                      setState(() => _level = newLevel);
                      // Auto-enable all permissions at Director/Owner level
                      if (newLevel >= 90) _enableAllPermissions();
                    },
                  ),
                ),
                const Text(
                  'Senior',
                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                border: Border.all(
                  color: AppTheme.primary.withValues(alpha: 0.16),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.military_tech_rounded,
                    color: AppTheme.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Level $_level — ${_levelLabel(_level)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Permission builder
            const Text(
              'Permissions',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'Control exactly what this role can see and do in the app.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            // Director/Owner banner
            if (_level >= 90) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.success.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(
                    color: AppTheme.success.withValues(alpha: 0.24),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      color: AppTheme.success,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Director / Owner level — all permissions are enabled automatically.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            ..._buildPermissionGroups(),
          ],
        ),
        ),
      ),
    );
  }

  List<Widget> _buildPermissionGroups() {
    final groups = [
      {
        'title': 'Tasks',
        'permissions': [
          {'key': 'tasks_view', 'label': 'View tasks'},
          {'key': 'tasks_view_all', 'label': 'View all tasks globally'},
          {'key': 'tasks_create', 'label': 'Create tasks'},
          {'key': 'tasks_edit', 'label': 'Edit tasks'},
          {'key': 'tasks_delete', 'label': 'Delete tasks'},
          {'key': 'tasks_approve', 'label': 'Approve tasks'},
        ],
      },
      {
        'title': 'Projects',
        'permissions': [
          {'key': 'projects_view', 'label': 'View projects'},
          {'key': 'projects_view_all', 'label': 'View all projects globally'},
          {'key': 'projects_create', 'label': 'Create projects'},
          {'key': 'projects_edit', 'label': 'Edit projects'},
          {'key': 'projects_delete', 'label': 'Delete projects'},
        ],
      },
      {
        'title': 'Documents',
        'permissions': [
          {'key': 'docs_view', 'label': 'View documents'},
          {'key': 'docs_view_all', 'label': 'View all documents globally'},
          {'key': 'docs_upload', 'label': 'Upload documents'},
          {'key': 'docs_approve', 'label': 'Approve documents'},
        ],
      },
      {
        'title': 'Team',
        'permissions': [
          {'key': 'team_view', 'label': 'View team'},
          {'key': 'team_manage', 'label': 'Manage team'},
          {'key': 'team_delete', 'label': 'Delete team members'},
        ],
      },
      {
        'title': 'Reports',
        'permissions': [
          {'key': 'reports_view', 'label': 'View reports'},
          {'key': 'reports_export', 'label': 'Export reports'},
        ],
      },
      {
        'title': 'Time',
        'permissions': [
          {'key': 'time_log', 'label': 'Log time'},
          {'key': 'time_view_all', 'label': 'View all timesheets'},
        ],
      },
      {
        'title': 'Admin',
        'permissions': [
          {'key': 'roles_manage', 'label': 'Manage roles & team assignments'},
          {'key': 'settings_manage', 'label': 'App settings'},
          {'key': 'notifications_manage', 'label': 'Manage notifications'},
        ],
      },
      {
        'title': 'Chat',
        'permissions': [
          {'key': 'chat_view', 'label': 'View channels & messages'},
          {'key': 'chat_send', 'label': 'Send messages'},
          {'key': 'chat_create_group', 'label': 'Create group channels'},
          {'key': 'chat_announce', 'label': 'Post announcements'},
          {
            'key': 'chat_moderate',
            'label': 'Moderate (delete messages / mute users)',
          },
        ],
      },
      {
        'title': 'Attendance',
        'permissions': [
          {
            'key': 'attendance_view_all',
            'label':
                'View all staff attendance records & locations (Admin / Director)',
          },
        ],
      },
    ];

    return groups.map((group) {
      final perms = group['permissions'] as List;
      final allSelected = perms.every(
        (p) => _permissions.hasPermission(p['key']!),
      );

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                group['title'] as String,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Checkbox(
                value: allSelected,
                onChanged: (v) {
                  for (final p in perms) {
                    _togglePermission(p['key']!, v ?? false);
                  }
                },
                tristate: true,
              ),
              const Text('All', style: TextStyle(fontSize: 12)),
            ],
          ),
          ...perms.map(
            (p) => SwitchListTile(
              value: _permissions.hasPermission(p['key']!),
              onChanged: (v) => _togglePermission(p['key']!, v),
              title: Text(p['label']!, style: const TextStyle(fontSize: 14)),
              dense: true,
              contentPadding: const EdgeInsets.only(left: 16),
            ),
          ),
          const Divider(),
        ],
      );
    }).toList();
  }
}
