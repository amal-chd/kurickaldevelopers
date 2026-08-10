import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/validators.dart';
import '../../data/models/project_model.dart';
import '../../data/models/user_model.dart';
import '../../data/services/audit_service.dart';
import '../../providers/chat_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';

class CreateProjectScreen extends ConsumerStatefulWidget {
  final String? projectId;
  const CreateProjectScreen({super.key, this.projectId});

  @override
  ConsumerState<CreateProjectScreen> createState() =>
      _CreateProjectScreenState();
}

class _CreateProjectScreenState extends ConsumerState<CreateProjectScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _clientCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 180));
  String? _projectManagerId;
  final List<String> _memberIds = [];
  bool _isLoading = false;
  bool _isLoadingEdit = false;
  bool get _isEdit => widget.projectId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadProject();
  }

  Future<void> _loadProject() async {
    setState(() => _isLoadingEdit = true);
    try {
      // Load project and prefill
      final project = await ref
          .read(projectRepositoryProvider)
          .getProject(widget.projectId!);
      if (project != null && mounted) {
        setState(() {
          _nameCtrl.text = project.name;
          _descCtrl.text = project.description;
          _clientCtrl.text = project.clientName;
          _addressCtrl.text = project.siteAddress;
          _startDate = project.startDate;
          _endDate = project.expectedEndDate;
          _projectManagerId = project.projectManagerId;
          _memberIds
            ..clear()
            ..addAll(project.memberIds);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load project details.'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoadingEdit = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _clientCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final first = isStart
        ? DateTime.now().subtract(const Duration(days: 365))
        : _startDate;
    final last = DateTime.now().add(const Duration(days: 365 * 5));

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
    );
    if (picked != null && mounted) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(_startDate)) {
            _endDate = _startDate.add(const Duration(days: 90));
          }
        } else {
          _endDate = picked;
        }
      });
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
        _memberIds
          ..clear()
          ..addAll(result);
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final user = ref.read(currentUserProvider).value!;
      final repo = ref.read(projectRepositoryProvider);

      final chatRepo = ref.read(chatRepositoryProvider);
      final managerId = _projectManagerId ?? user.uid;

      if (_isEdit) {
        // Always keep the manager in the member list so they can read/see the
        // project (membership is the canonical access signal).
        final members = {..._memberIds, managerId}
            .where((e) => e.isNotEmpty)
            .toList();
        await repo.updateProject(widget.projectId!, {
          'name': _nameCtrl.text.trim(),
          'description': _descCtrl.text.trim(),
          'clientName': _clientCtrl.text.trim(),
          'siteAddress': _addressCtrl.text.trim(),
          'startDate': AppDateUtils.toTimestamp(_startDate),
          'expectedEndDate': AppDateUtils.toTimestamp(_endDate),
          'projectManagerId': managerId,
          'memberIds': members,
        });
        // Keep the project chat membership in sync with the project members.
        await chatRepo.syncProjectChannel(
          projectId: widget.projectId!,
          projectName: _nameCtrl.text.trim(),
          memberIds: members,
          managerId: managerId,
        );
        ref.read(auditServiceProvider).log(
          action: 'project.updated',
          category: AuditCategory.project,
          targetId: widget.projectId!,
          targetName: _nameCtrl.text.trim(),
          description: 'Updated project "${_nameCtrl.text.trim()}"',
          meta: {'members': members.length},
        );
      } else {
        // Include the manager and the creator so they always have access.
        final members = {..._memberIds, managerId, user.uid}
            .where((e) => e.isNotEmpty)
            .toList();
        final project = ProjectModel(
          id: '',
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          clientName: _clientCtrl.text.trim(),
          siteAddress: _addressCtrl.text.trim(),
          projectManagerId: managerId,
          memberIds: members,
          startDate: _startDate,
          expectedEndDate: _endDate,
          createdAt: DateTime.now(),
        );
        final newId = await repo.createProject(project);
        await chatRepo.syncProjectChannel(
          projectId: newId,
          projectName: project.name,
          memberIds: members,
          managerId: managerId,
        );
        ref.read(auditServiceProvider).log(
          action: 'project.created',
          category: AuditCategory.project,
          targetId: newId,
          targetName: project.name,
          description: 'Created project "${project.name}"',
          meta: {'client': project.clientName, 'members': members.length},
        );
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

  @override
  Widget build(BuildContext context) {
    if (_isLoadingEdit) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final usersAsync = ref.watch(allUsersProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Project' : 'New Project'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _submit,
            child: _isLoading
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(
                      color: AppTheme.primary,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    _isEdit ? 'Update' : 'Create',
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Project info
            _card([
              _label('Project Name *'),
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  hintText: 'e.g. Kurickal Residences Phase 2',
                  border: InputBorder.none,
                  isDense: true,
                ),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
                validator: (v) =>
                    Validators.minLength(v, field: 'Project name', min: 3),
                maxLength: 60,
              ),
              const Divider(),
              _label('Description (optional)'),
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  hintText: 'Brief description of this project...',
                  border: InputBorder.none,
                  isDense: true,
                ),
                maxLines: 3,
              ),
            ]),
            const SizedBox(height: 16),

            // Client & Site
            _card([
              _label('Client Name *'),
              TextFormField(
                controller: _clientCtrl,
                decoration: const InputDecoration(
                  hintText: 'e.g. Mr. Thomas Kurickal',
                  prefixIcon: Icon(Icons.person_outline_rounded, size: 18),
                  border: InputBorder.none,
                  isDense: true,
                ),
                validator: (v) =>
                    Validators.minLength(v, field: 'Client name', min: 3),
              ),
              const Divider(),
              _label('Site Address *'),
              TextFormField(
                controller: _addressCtrl,
                decoration: const InputDecoration(
                  hintText: 'e.g. Plot 24, Kakkanad, Kochi - 682030',
                  prefixIcon: Icon(Icons.location_on_outlined, size: 18),
                  border: InputBorder.none,
                  isDense: true,
                ),
                validator: (v) =>
                    Validators.minLength(v, field: 'Site address', min: 10),
                maxLines: 2,
              ),
            ]),
            const SizedBox(height: 16),

            // Dates
            _card([
              _label('Project Timeline'),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _DatePicker(
                      label: 'Start Date',
                      date: _startDate,
                      onTap: () => _pickDate(isStart: true),
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 50,
                    color: AppTheme.divider,
                    margin: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  Expanded(
                    child: _DatePicker(
                      label: 'End Date',
                      date: _endDate,
                      onTap: () => _pickDate(isStart: false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 16,
                      color: AppTheme.primary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${_endDate.difference(_startDate).inDays} days duration',
                      style: const TextStyle(
                        color: AppTheme.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 16),

            // Project Manager
            _card([
              _label('Project Manager'),
              usersAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (_, __) => const Text('Failed to load users'),
                data: (users) => DropdownButtonFormField<String>(
                  key: ValueKey(_projectManagerId),
                  initialValue: _projectManagerId,
                  hint: const Text('Select project manager'),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  items: users
                      .map(
                        (u) => DropdownMenuItem(
                          value: u.uid,
                          child: Row(
                            children: [
                              AvatarWidget(
                                name: u.name,
                                imageUrl: u.avatarUrl,
                                size: 28,
                              ),
                              const SizedBox(width: 8),
                              Text(u.name),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _projectManagerId = v),
                ),
              ),
            ]),
            const SizedBox(height: 16),

            // Team Members
            _card([
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _label('Team Members'),
                  usersAsync.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (users) => TextButton.icon(
                      onPressed: () => _pickMembers(users),
                      icon: const Icon(Icons.group_add_outlined, size: 16),
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
                    'No members added yet',
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
      ),
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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

class _DatePicker extends StatelessWidget {
  final String label;
  final DateTime date;
  final VoidCallback onTap;
  const _DatePicker({
    required this.label,
    required this.date,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppTheme.textLight,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            DateFormat('dd MMM yyyy').format(date),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

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
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Add Team Members',
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
                hintText: 'Search...',
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
