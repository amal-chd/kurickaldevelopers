import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/task_priority.dart';
import '../../core/enums/task_status.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/validators.dart';
import '../../data/models/role_model.dart';
import '../../data/models/task_model.dart';
import '../../data/models/user_model.dart';
import '../../data/services/audit_service.dart';
import '../../providers/admin_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/task_provider.dart';
import '../../providers/user_provider.dart';
import '../../data/services/storage_service.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';

class CreateTaskScreen extends ConsumerStatefulWidget {
  final String? projectId;
  final String? taskId; // set when editing
  const CreateTaskScreen({super.key, this.projectId, this.taskId});

  @override
  ConsumerState<CreateTaskScreen> createState() => _CreateTaskScreenState();
}

class _CreateTaskScreenState extends ConsumerState<CreateTaskScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _tagsCtrl = TextEditingController();
  // _isFullForm removed — always show full form for professional TMS
  String? _selectedProjectId;
  String? _selectedMilestoneId;
  final List<String> _selectedAssigneeIds = [];
  String? _selectedRoleId;
  final List<String> _selectedRoleIds = [];
  TaskPriority _priority = TaskPriority.medium;
  DateTime _dueDate = DateTime.now().add(const Duration(days: 3));
  int _estimatedHours = 4;
  bool _isLoading = false;
  bool _isLoadingEdit = false;
  bool _isRecurring = false;
  final List<String> _tags = [];
  final List<PlatformFile> _selectedFiles = [];
  final List<String> _existingAttachmentUrls = [];
  bool get _isEditMode => widget.taskId != null;

  @override
  void initState() {
    super.initState();
    _selectedProjectId = widget.projectId;
    if (_isEditMode) _loadTaskForEdit();
  }

  Future<void> _loadTaskForEdit() async {
    setState(() => _isLoadingEdit = true);
    final task = await ref.read(taskRepositoryProvider).getTask(widget.taskId!);
    if (task != null && mounted) {
      setState(() {
        _titleCtrl.text = task.title;
        _descCtrl.text = task.description;
        _selectedProjectId = task.projectId;
        _selectedMilestoneId = task.milestoneId;
        _selectedAssigneeIds.addAll(task.assigneeIds);
        _selectedRoleId = task.assignedRoleId;
        _selectedRoleIds.addAll(task.assignedRoleIds);
        _priority = task.priority;
        _dueDate = task.dueDate;
        _estimatedHours = task.estimatedHours;
        _isRecurring = task.isRecurring;
        _tags.addAll(task.tags);
        _existingAttachmentUrls.addAll(task.attachmentUrls);
        _isLoadingEdit = false;
      });
    } else if (mounted) {
      setState(() => _isLoadingEdit = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _tagsCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null && mounted) setState(() => _dueDate = picked);
  }

  Future<void> _pickAssignees(List<UserModel> allUsers) async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _AssigneePicker(
        allUsers: allUsers,
        selected: List.from(_selectedAssigneeIds),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _selectedAssigneeIds
          ..clear()
          ..addAll(result);
      });
    }
  }

  Future<void> _pickRoles(List<RoleModel> allRoles) async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _RolePicker(
        allRoles: allRoles,
        selected: List.from(_selectedRoleIds),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _selectedRoleIds
          ..clear()
          ..addAll(result);
      });
    }
  }

  void _addTag(String tag) {
    final clean = tag.trim();
    final err = Validators.alphanumeric(clean, field: 'Tag');
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    if (clean.isNotEmpty && !_tags.contains(clean)) {
      setState(() => _tags.add(clean));
    }
    _tagsCtrl.clear();
  }

  Future<void> _pickFiles() async {
    // withData loads the bytes up front — the reliable way to read iOS files.
    final result = await FilePicker.platform.pickFiles(allowMultiple: true, withData: true);
    if (result != null && mounted) {
      setState(() {
        _selectedFiles.addAll(result.files);
      });
    }
  }

  /// Uploads the picked files, returning their URLs. Names any files that fail
  /// (upload is best-effort, but failures are surfaced, never swallowed).
  Future<List<String>> _uploadSelectedFiles(String taskId) async {
    final uploadedUrls = <String>[];
    final failed = <String>[];
    for (final pf in _selectedFiles) {
      try {
        Uint8List? bytes = pf.bytes;
        if (bytes == null && pf.path != null) {
          bytes = await File(pf.path!).readAsBytes();
        }
        if (bytes == null) {
          failed.add(pf.name);
          continue;
        }
        final url = await StorageService().uploadTaskAttachmentData(
          taskId: taskId,
          fileName: pf.name,
          bytes: bytes,
        );
        uploadedUrls.add(url);
      } catch (e) {
        failed.add(pf.name);
        debugPrint('Attachment upload failed for ${pf.name}: $e');
      }
    }
    if (failed.isNotEmpty && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Could not upload: ${failed.join(', ')}'),
        backgroundColor: Colors.red,
      ));
    }
    return uploadedUrls;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedProjectId == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please select a project')));
      return;
    }
    setState(() => _isLoading = true);
    try {
      final user = ref.read(currentUserProvider).value!;
      final repo = ref.read(taskRepositoryProvider);

      if (_isEditMode) {
        final uploadedUrls = await _uploadSelectedFiles(widget.taskId!);

        // When editing, if assignees are added and status is still 'created',
        // automatically advance it to 'assigned'.
        final Map<String, dynamic> updates = {
          'title': _titleCtrl.text.trim(),
          'description': _descCtrl.text.trim(),
          'projectId': _selectedProjectId!,
          'milestoneId': _selectedMilestoneId,
          'assigneeIds': _selectedAssigneeIds,
          'assignedRoleId': _selectedRoleId,
          'assignedRoleIds': _selectedRoleIds,
          'priority': _priority.value,
          'dueDate': AppDateUtils.toTimestamp(_dueDate),
          'estimatedHours': _estimatedHours,
          'isRecurring': _isRecurring,
          'tags': _tags,
          'attachmentUrls': [..._existingAttachmentUrls, ...uploadedUrls],
        };
        await repo.updateTask(widget.taskId!, updates);
        ref.read(auditServiceProvider).log(
          action: 'task.updated',
          category: AuditCategory.task,
          targetId: widget.taskId!,
          targetName: _titleCtrl.text.trim(),
          description: 'Updated task "${_titleCtrl.text.trim()}"',
          meta: {'assignees': _selectedAssigneeIds.length},
        );
      } else {
        // Create a temporary task ID to use for storage prefix
        final tempTaskId = DateTime.now().millisecondsSinceEpoch.toString();
        final uploadedUrls = await _uploadSelectedFiles(tempTaskId);

        // New tasks start as 'In Progress' once assigned
        final task = TaskModel(
          id: '',
          title: _titleCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          projectId: _selectedProjectId!,
          milestoneId: _selectedMilestoneId,
          assigneeIds: _selectedAssigneeIds,
          assignedRoleId: _selectedRoleId,
          assignedRoleIds: _selectedRoleIds,
          createdBy: user.uid,
          status: TaskStatus.inProgress,
          priority: _priority,
          dueDate: _dueDate,
          estimatedHours: _estimatedHours,
          isRecurring: _isRecurring,
          tags: _tags,
          attachmentUrls: uploadedUrls,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
        final newTaskId = await repo.createTask(task);
        ref.read(auditServiceProvider).log(
          action: 'task.created',
          category: AuditCategory.task,
          targetId: newTaskId,
          targetName: task.title,
          description: 'Created task "${task.title}"',
          meta: {
            'priority': _priority.value,
            'assignees': _selectedAssigneeIds.length,
          },
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
    if (_isLoadingEdit) return const Scaffold(body: LoadingWidget());

    final projectsAsync = ref.watch(projectsProvider);
    final usersAsync = ref.watch(allUsersProvider);
    final allRoles = ref.watch(allRolesProvider).value ?? [];
    final myLevel = ref.watch(currentRoleLevelProvider);
    final myRoleId = ref.watch(currentUserProvider).value?.roleId ?? '';
    final assignConfig = ref.watch(taskAssignmentConfigProvider).value;
    // Build roleId → level map
    final roleLevelMap = {for (final r in allRoles) r.id: r.level};
    // Eligible assignees:
    //  • If the Director has configured assignment rules for my role, those are
    //    authoritative — I can assign only to the roles they allow.
    //  • Otherwise fall back to the authority-level rule (lower level than mine).
    final eligibleUsers =
        usersAsync.value?.where((u) {
          if (assignConfig != null && assignConfig.isRestricted(myRoleId)) {
            return assignConfig.allows(myRoleId, u.roleId);
          }
          return (roleLevelMap[u.roleId] ?? 0) < myLevel;
        }).toList() ??
        [];

    final eligibleRoles =
        allRoles.where((r) {
          if (assignConfig != null && assignConfig.isRestricted(myRoleId)) {
            return assignConfig.allows(myRoleId, r.id);
          }
          return r.level < myLevel;
        }).toList();

    final milestones = _selectedProjectId != null
        ? (ref.watch(milestonesProvider(_selectedProjectId!)).value ?? [])
        : <dynamic>[];

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Task' : AppStrings.createTask),
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
                    _isEditMode ? 'Update' : 'Save',
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
            // Section: Basic Info
            _sectionCard([
              _SectionLabel(label: 'Task Title'),
              TextFormField(
                controller: _titleCtrl,
                decoration: const InputDecoration(
                  hintText: 'e.g. Pour foundation slab – Block B',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 0,
                    vertical: 4,
                  ),
                ),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Plus Jakarta Sans',
                ),
                validator: (v) =>
                    Validators.minLength(v, field: 'Task title', min: 3),
                maxLength: 100,
                autofocus: !_isEditMode,
                maxLines: 2,
              ),
              const Divider(),
              _SectionLabel(label: 'Description (optional)'),
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  hintText: 'Add more context about this task...',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 0,
                    vertical: 4,
                  ),
                ),
                maxLines: 3,
              ),
            ]),
            const SizedBox(height: 16),

            // Section: Project & Milestone
            _sectionCard([
              _SectionLabel(label: 'Project *'),
              projectsAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (_, __) => const Text(
                  'Failed to load projects',
                  style: TextStyle(color: AppTheme.error),
                ),
                data: (projects) => DropdownButtonFormField<String>(
                  initialValue: _selectedProjectId,
                  hint: const Text('Select project'),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  items: projects
                      .map(
                        (p) =>
                            DropdownMenuItem(value: p.id, child: Text(p.name)),
                      )
                      .toList(),
                  onChanged: (v) => setState(() {
                    _selectedProjectId = v;
                    _selectedMilestoneId = null;
                  }),
                  validator: (v) =>
                      v == null ? 'Please select a project' : null,
                ),
              ),
              if (milestones.isNotEmpty) ...[
                const Divider(),
                _SectionLabel(label: 'Milestone (optional)'),
                DropdownButtonFormField<String?>(
                  initialValue: _selectedMilestoneId,
                  hint: const Text('Link to milestone'),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('None'),
                    ),
                    ...milestones.map<DropdownMenuItem<String?>>(
                      (m) => DropdownMenuItem(
                        value: m.id as String?,
                        child: Text(m.name as String),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _selectedMilestoneId = v),
                ),
              ],
            ]),
            const SizedBox(height: 16),

            // Section: Priority, Due Date, Hours
            _sectionCard([
              _SectionLabel(label: 'Priority'),
              const SizedBox(height: 8),
              Row(
                children: TaskPriority.values
                    .map(
                      (p) => Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => setState(() => _priority = p),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _priority == p
                                    ? p.color
                                    : p.color.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: _priority == p
                                      ? p.color
                                      : Colors.transparent,
                                ),
                              ),
                              child: Column(
                                children: [
                                  Icon(
                                    Icons.flag_rounded,
                                    color: _priority == p
                                        ? Colors.white
                                        : p.color,
                                    size: 18,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    p.label,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _priority == p
                                          ? Colors.white
                                          : p.color,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
              const Divider(height: 24),
              _SectionLabel(label: 'Due Date'),
              InkWell(
                onTap: _pickDueDate,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_outlined,
                        size: 18,
                        color: AppTheme.textMuted,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        DateFormat('EEE, dd MMM yyyy').format(_dueDate),
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppTheme.textLight,
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(height: 24),
              _SectionLabel(label: 'Estimated Hours'),
              Row(
                children: [
                  const Icon(
                    Icons.access_time_rounded,
                    size: 18,
                    color: AppTheme.textMuted,
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: () => setState(
                      () =>
                          _estimatedHours = (_estimatedHours - 1).clamp(1, 200),
                    ),
                    icon: const Icon(Icons.remove_circle_outline_rounded),
                    color: AppTheme.primary,
                    padding: EdgeInsets.zero,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$_estimatedHours h',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    onPressed: () => setState(
                      () =>
                          _estimatedHours = (_estimatedHours + 1).clamp(1, 200),
                    ),
                    icon: const Icon(Icons.add_circle_outline_rounded),
                    color: AppTheme.primary,
                    padding: EdgeInsets.zero,
                  ),
                ],
              ),
            ]),
            const SizedBox(height: 16),

            // Section: Role Assignment
            _sectionCard([
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const _SectionLabel(label: 'Assign to Roles / Teams'),
                  TextButton.icon(
                    onPressed: eligibleRoles.isEmpty
                        ? null
                        : () => _pickRoles(eligibleRoles),
                    icon: const Icon(Icons.shield_outlined, size: 16),
                    label: const Text('Add'),
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
              if (_selectedRoleIds.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Tap "Add" to assign roles / teams',
                    style: TextStyle(color: AppTheme.textLight, fontSize: 13),
                  ),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: _selectedRoleIds.map((rid) {
                    final role = eligibleRoles.firstWhere(
                      (r) => r.id == rid,
                      orElse: () => RoleModel(
                        id: rid,
                        name: rid,
                        description: '',
                        color: '#1A3A5C',
                        createdBy: '',
                        createdAt: DateTime.now(),
                        permissions: const PermissionModel(),
                        level: 0,
                      ),
                    );
                    final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
                    return Chip(
                      avatar: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      label: Text(
                        role.name,
                        style: const TextStyle(fontSize: 12),
                      ),
                      deleteIcon: const Icon(Icons.close_rounded, size: 14),
                      onDeleted: () =>
                          setState(() => _selectedRoleIds.remove(rid)),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    );
                  }).toList(),
                ),
            ]),
            const SizedBox(height: 16),

            // Section: Assignees (only users below your authority level)
            _sectionCard([
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const _SectionLabel(label: 'Assign To'),
                  TextButton.icon(
                    onPressed: eligibleUsers.isEmpty
                        ? null
                        : () => _pickAssignees(eligibleUsers),
                    icon: const Icon(Icons.person_add_outlined, size: 16),
                    label: const Text('Add'),
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
              if (eligibleUsers.isEmpty &&
                  (usersAsync.value?.isNotEmpty ?? false))
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        size: 14,
                        color: AppTheme.accent,
                      ),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'No subordinates found. You can only assign tasks to team members with a lower authority level.',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else if (_selectedAssigneeIds.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Tap "Add" to assign team members',
                    style: TextStyle(color: AppTheme.textLight, fontSize: 13),
                  ),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: _selectedAssigneeIds.map((uid) {
                    final user = eligibleUsers.firstWhere(
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
                      onDeleted: () =>
                          setState(() => _selectedAssigneeIds.remove(uid)),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    );
                  }).toList(),
                ),
            ]),
            const SizedBox(height: 16),

            // Section: Tags
            _sectionCard([
              _SectionLabel(label: 'Tags'),
              if (_tags.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8, bottom: 8),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: _tags
                        .map(
                          (t) => Chip(
                            label: Text(
                              t,
                              style: const TextStyle(fontSize: 12),
                            ),
                            deleteIcon: const Icon(
                              Icons.close_rounded,
                              size: 14,
                            ),
                            onDeleted: () => setState(() => _tags.remove(t)),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                            backgroundColor: AppTheme.primary.withValues(
                              alpha: 0.05,
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              TextField(
                controller: _tagsCtrl,
                decoration: const InputDecoration(
                  hintText:
                      'Type tag and press Enter (e.g. structural, safety)',
                  border: InputBorder.none,
                  isDense: true,
                  prefixIcon: Icon(
                    Icons.label_outline_rounded,
                    size: 18,
                    color: AppTheme.textLight,
                  ),
                ),
                onSubmitted: _addTag,
              ),
            ]),
            const SizedBox(height: 16),

            // Section: Attachments
            _sectionCard([
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const _SectionLabel(label: 'Attachments'),
                  TextButton.icon(
                    onPressed: _pickFiles,
                    icon: const Icon(Icons.attach_file_rounded, size: 16),
                    label: const Text('Add Files'),
                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
              if (_existingAttachmentUrls.isEmpty && _selectedFiles.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'No files attached',
                    style: TextStyle(color: AppTheme.textLight, fontSize: 13),
                  ),
                ),
              if (_existingAttachmentUrls.isNotEmpty || _selectedFiles.isNotEmpty)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ..._existingAttachmentUrls.asMap().entries.map((entry) {
                      final i = entry.key;
                      final url = entry.value;
                      final filename = url.split('/').last.split('?').first;
                      final decoded = Uri.decodeComponent(filename);
                      return Chip(
                        avatar: const Icon(Icons.insert_drive_file_outlined, size: 16, color: AppTheme.primary),
                        label: Text(
                          decoded,
                          style: const TextStyle(fontSize: 12),
                        ),
                        deleteIcon: const Icon(Icons.close_rounded, size: 14),
                        onDeleted: () => setState(() => _existingAttachmentUrls.removeAt(i)),
                        backgroundColor: AppTheme.primary.withValues(alpha: 0.05),
                      );
                    }),
                    ..._selectedFiles.asMap().entries.map((entry) {
                      final i = entry.key;
                      final file = entry.value;
                      final filename = file.name;
                      return Chip(
                        avatar: const Icon(Icons.file_upload_outlined, size: 16, color: Colors.green),
                        label: Text(
                          filename,
                          style: const TextStyle(fontSize: 12),
                        ),
                        deleteIcon: const Icon(Icons.close_rounded, size: 14),
                        onDeleted: () => setState(() => _selectedFiles.removeAt(i)),
                        backgroundColor: Colors.green.withValues(alpha: 0.05),
                      );
                    }),
                  ],
                ),
            ]),
            const SizedBox(height: 16),

            // Section: Options
            _sectionCard([
              SwitchListTile(
                value: _isRecurring,
                onChanged: (v) => setState(() => _isRecurring = v),
                title: const Text('Recurring Task'),
                subtitle: const Text('Repeats on the same schedule'),
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppTheme.primary,
              ),
            ]),
            const SizedBox(height: 32),
          ],
        ),
      ),
      ),
    );
  }

  Widget _sectionCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.divider.withValues(alpha: 0.8)),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppTheme.textMuted,
          letterSpacing: 0.5,
          fontFamily: 'Plus Jakarta Sans',
        ),
      ),
    );
  }
}

/// Bottom sheet for picking assignees
class _AssigneePicker extends StatefulWidget {
  final List<UserModel> allUsers;
  final List<String> selected;

  const _AssigneePicker({required this.allUsers, required this.selected});

  @override
  State<_AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends State<_AssigneePicker> {
  late List<String> _picked;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _picked = List.from(widget.selected);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _searchCtrl.text.isEmpty
        ? widget.allUsers
        : widget.allUsers
              .where(
                (u) => u.name.toLowerCase().contains(
                  _searchCtrl.text.toLowerCase(),
                ),
              )
              .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (ctx, sc) => Padding(
        // Lift the sheet above the keyboard when it opens
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: Column(
        children: [
          // Handle
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
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Assign Team Members',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Plus Jakarta Sans',
                      ),
                    ),
                    Text(
                      '${widget.allUsers.length} eligible member(s)',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
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
              controller: _searchCtrl,
              decoration: const InputDecoration(
                hintText: 'Search members...',
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
                final user = filtered[i];
                final selected = _picked.contains(user.uid);
                return CheckboxListTile(
                  value: selected,
                  onChanged: (v) => setState(() {
                    if (v == true) {
                      _picked.add(user.uid);
                    } else {
                      _picked.remove(user.uid);
                    }
                  }),
                  secondary: AvatarWidget(
                    name: user.name,
                    imageUrl: user.avatarUrl,
                    size: 40,
                  ),
                  title: Text(
                    user.name,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    user.email,
                    style: const TextStyle(fontSize: 12),
                  ),
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

class _RolePicker extends StatefulWidget {
  final List<RoleModel> allRoles;
  final List<String> selected;

  const _RolePicker({required this.allRoles, required this.selected});

  @override
  State<_RolePicker> createState() => _RolePickerState();
}

class _RolePickerState extends State<_RolePicker> {
  late List<String> _picked;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _picked = List.from(widget.selected);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _searchCtrl.text.isEmpty
        ? widget.allRoles
        : widget.allRoles
              .where(
                (r) => r.name.toLowerCase().contains(
                  _searchCtrl.text.toLowerCase(),
                ),
              )
              .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Assign Roles / Teams',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'Plus Jakarta Sans',
                        ),
                      ),
                      Text(
                        '${widget.allRoles.length} eligible role(s)',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
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
                controller: _searchCtrl,
                decoration: const InputDecoration(
                  hintText: 'Search roles...',
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
                  final role = filtered[i];
                  final selected = _picked.contains(role.id);
                  final color = Color(int.parse(role.color.replaceFirst('#', '0xFF')));
                  return CheckboxListTile(
                    value: selected,
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _picked.add(role.id);
                      } else {
                        _picked.remove(role.id);
                      }
                    }),
                    secondary: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    title: Text(
                      role.name,
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
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
