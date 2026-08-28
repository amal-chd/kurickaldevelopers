import 'dart:io';
import 'package:image_picker/image_picker.dart';
import '../../data/services/storage_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/validators.dart';
import '../../data/models/site_diary_model.dart';
import '../../providers/project_provider.dart';
import '../../providers/site_diary_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/permission_gate.dart';

class SiteDiaryScreen extends ConsumerStatefulWidget {
  const SiteDiaryScreen({super.key});

  @override
  ConsumerState<SiteDiaryScreen> createState() => _SiteDiaryScreenState();
}

class _SiteDiaryScreenState extends ConsumerState<SiteDiaryScreen> {
  String? _selectedProjectId;

  @override
  Widget build(BuildContext context) {
    final projectsAsync = ref.watch(projectsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Site Diary')),
      body: Column(
        children: [
          // Project picker
          Padding(
            padding: const EdgeInsets.all(16),
            child: projectsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => const SizedBox.shrink(),
              data: (projects) => DropdownButtonFormField<String>(
                initialValue: _selectedProjectId,
                hint: const Text('Select project to view diary'),
                decoration: const InputDecoration(
                  labelText: 'Project',
                  prefixIcon: Icon(Icons.business_outlined),
                ),
                items: projects
                    .map(
                      (p) => DropdownMenuItem(value: p.id, child: Text(p.name)),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _selectedProjectId = v),
              ),
            ),
          ),

          if (_selectedProjectId == null)
            const Expanded(
              child: EmptyStateWidget(
                title: 'Select a project',
                subtitle:
                    'Choose a project to view and create daily site diary entries',
                icon: Icons.book_outlined,
              ),
            )
          else
            Expanded(child: _DiaryList(projectId: _selectedProjectId!)),
        ],
      ),
      floatingActionButton: _selectedProjectId != null
          ? PermissionGate(
              // Matches the firestore.rules update permission for site_diaries:
              // resource.data.authorId || projects_edit
              permission: 'projects_edit',
              child: FloatingActionButton.extended(
                onPressed: () => _openCreateEntry(context, _selectedProjectId!),
                icon: const Icon(Icons.add_rounded),
                label: const Text("Today's Entry"),
              ),
            )
          : null,
    );
  }

  Future<void> _openCreateEntry(BuildContext ctx, String projectId) async {
    final user = ref.read(currentUserProvider).value;
    if (user == null) return;
    final today = AppDateUtils.toYMD(DateTime.now());
    final existing = await ref
        .read(siteDiaryRepositoryProvider)
        .getDiaryForDate(projectId, DateTime.now());

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CreateDiaryEntrySheet(
        projectId: projectId,
        authorId: user.uid,
        existing: existing,
      ),
    );
  }
}

class _DiaryList extends ConsumerWidget {
  final String projectId;
  const _DiaryList({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diariesAsync = ref.watch(projectDiariesProvider(projectId));

    return diariesAsync.when(
      loading: () => const ShimmerList(),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(projectDiariesProvider(projectId)),
      ),
      data: (entries) {
        if (entries.isEmpty) {
          return const EmptyStateWidget(
            title: 'No diary entries yet',
            subtitle: 'Tap the button below to create today\'s entry',
            icon: Icons.book_outlined,
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: entries.length,
          itemBuilder: (_, i) => _DiaryCard(entry: entries[i]),
        );
      },
    );
  }
}

class _DiaryCard extends StatelessWidget {
  final SiteDiaryModel entry;
  const _DiaryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final date = DateFormat(
      'EEEE, dd MMM yyyy',
    ).format(DateTime.parse(entry.date));
    final isToday = entry.date == AppDateUtils.toYMD(DateTime.now());

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        boxShadow: AppTheme.softShadow,
        border: Border.all(
          color: isToday
              ? AppTheme.accent.withValues(alpha: 0.4)
              : Colors.transparent,
          width: isToday ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isToday
                  ? AppTheme.accent.withValues(alpha: 0.08)
                  : AppTheme.surfaceAlt.withValues(alpha: 0.5),
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppTheme.radiusMd - 1),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isToday)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          margin: const EdgeInsets.only(bottom: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accent,
                            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                          ),
                          child: const Text(
                            'TODAY',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      Text(
                        date,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: AppTheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Text(entry.weather.emoji, style: const TextStyle(fontSize: 22)),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${entry.workerCount}',
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: AppTheme.primary,
                        ),
                      ),
                      const Text(
                        'workers',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textLight,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Notes
          if (entry.progressNotes.isNotEmpty)
            _NoteSection(
              icon: Icons.construction_rounded,
              color: AppTheme.primary,
              label: 'Progress',
              text: entry.progressNotes,
            ),

          if (entry.issuesNotes.isNotEmpty)
            _NoteSection(
              icon: Icons.warning_amber_rounded,
              color: const Color(0xFFD97706),
              label: 'Issues',
              text: entry.issuesNotes,
            ),

          if (entry.safetyNotes.isNotEmpty)
            _NoteSection(
              icon: Icons.health_and_safety_outlined,
              color: AppTheme.success,
              label: 'Safety',
              text: entry.safetyNotes,
            ),

          // Photos
          if (entry.photoUrls.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              child: SizedBox(
                height: 80,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: entry.photoUrls.length,
                  itemBuilder: (_, i) => Container(
                    width: 80,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      image: DecorationImage(
                        image: NetworkImage(entry.photoUrls[i]),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
            )
          else
            const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _NoteSection extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String text;
  const _NoteSection({
    required this.icon,
    required this.color,
    required this.label,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: color.withValues(alpha: 0.12),
            width: 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 14, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: color,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    text,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF334155),
                      fontWeight: FontWeight.w500,
                    ),
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

// ── Create/Edit Entry Bottom Sheet ────────────────────────────────────────────

class _CreateDiaryEntrySheet extends ConsumerStatefulWidget {
  final String projectId;
  final String authorId;
  final SiteDiaryModel? existing;

  const _CreateDiaryEntrySheet({
    required this.projectId,
    required this.authorId,
    this.existing,
  });

  @override
  ConsumerState<_CreateDiaryEntrySheet> createState() =>
      _CreateDiaryEntrySheetState();
}

class _CreateDiaryEntrySheetState
    extends ConsumerState<_CreateDiaryEntrySheet> {
  final _progressCtrl = TextEditingController();
  final _issuesCtrl = TextEditingController();
  final _safetyCtrl = TextEditingController();
  WeatherCondition _weather = WeatherCondition.sunny;
  int _workerCount = 0;
  final List<String> _photoUrls = [];
  bool _isLoading = false;
  // ignore: prefer_final_fields — will be set to true during upload once Storage is wired
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      _progressCtrl.text = widget.existing!.progressNotes;
      _issuesCtrl.text = widget.existing!.issuesNotes;
      _safetyCtrl.text = widget.existing!.safetyNotes;
      _weather = widget.existing!.weather;
      _workerCount = widget.existing!.workerCount;
      _photoUrls.addAll(widget.existing!.photoUrls);
    }
  }

  @override
  void dispose() {
    _progressCtrl.dispose();
    _issuesCtrl.dispose();
    _safetyCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    if (_isUploadingPhoto) return;
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
      if (picked == null) return;
      
      setState(() => _isUploadingPhoto = true);
      
      final storage = StorageService();
      final url = await storage.uploadPhoto(
        projectId: widget.projectId,
        file: File(picked.path),
      );
      
      if (mounted) {
        setState(() {
          _photoUrls.add(url);
          _isUploadingPhoto = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload photo: $e')),
        );
      }
    }
  }

  Future<void> _save() async {
    final err = Validators.minLength(
      _progressCtrl.text,
      field: 'Progress notes',
      min: 10,
    );
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    setState(() => _isLoading = true);
    try {
      final repo = ref.read(siteDiaryRepositoryProvider);
      final today = AppDateUtils.toYMD(DateTime.now());

      if (widget.existing != null) {
        await repo.updateDiary(widget.existing!.id, {
          'weather': _weather.value,
          'workerCount': _workerCount,
          'progressNotes': _progressCtrl.text.trim(),
          'issuesNotes': _issuesCtrl.text.trim(),
          'safetyNotes': _safetyCtrl.text.trim(),
          'photoUrls': _photoUrls,
        });
      } else {
        final entry = SiteDiaryModel(
          id: '',
          projectId: widget.projectId,
          authorId: widget.authorId,
          date: today,
          weather: _weather,
          workerCount: _workerCount,
          progressNotes: _progressCtrl.text.trim(),
          issuesNotes: _issuesCtrl.text.trim(),
          safetyNotes: _safetyCtrl.text.trim(),
          photoUrls: _photoUrls,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
        await repo.createDiary(entry);
      }
      if (mounted) Navigator.pop(context);
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
    final isEdit = widget.existing != null;

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      maxChildSize: 0.97,
      minChildSize: 0.5,
      expand: false,
      builder: (ctx, sc) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(ctx).bottom,
        ),
        child: Column(
        children: [
          // Handle + header
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isEdit ? 'Update Diary Entry' : "Today's Site Diary",
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      DateFormat('EEEE, dd MMM yyyy').format(DateTime.now()),
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
                ElevatedButton(
                  onPressed: _isLoading ? null : _save,
                  child: _isLoading
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
          ),
          const Divider(),

          Expanded(
            child: SingleChildScrollView(
              controller: sc,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Weather + Workers
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Weather',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: WeatherCondition.values
                                    .map(
                                      (w) => GestureDetector(
                                        onTap: () =>
                                            setState(() => _weather = w),
                                        child: AnimatedContainer(
                                          duration: const Duration(
                                            milliseconds: 150,
                                          ),
                                          margin: const EdgeInsets.only(
                                            right: 8,
                                          ),
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 8,
                                          ),
                                          decoration: BoxDecoration(
                                            color: _weather == w
                                                ? AppTheme.primary.withValues(
                                                    alpha: 0.1,
                                                  )
                                                : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(
                                              20,
                                            ),
                                            border: Border.all(
                                              color: _weather == w
                                                  ? AppTheme.primary
                                                  : Colors.transparent,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              Text(w.emoji),
                                              const SizedBox(width: 6),
                                              Text(
                                                w.label,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: _weather == w
                                                      ? FontWeight.w600
                                                      : FontWeight.normal,
                                                  color: _weather == w
                                                      ? AppTheme.primary
                                                      : AppTheme.textMuted,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Worker count
                  const Text(
                    'Workers on Site',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => setState(
                          () => _workerCount = (_workerCount - 1).clamp(0, 500),
                        ),
                        icon: const Icon(Icons.remove_circle_outline_rounded),
                        color: AppTheme.primary,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.divider),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$_workerCount',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => setState(
                          () => _workerCount = (_workerCount + 1).clamp(0, 500),
                        ),
                        icon: const Icon(Icons.add_circle_outline_rounded),
                        color: AppTheme.primary,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'workers',
                        style: TextStyle(color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  _TextAreaField(
                    controller: _progressCtrl,
                    label: 'Work Progress *',
                    hint: 'Describe what was accomplished today...',
                    icon: Icons.construction_rounded,
                    iconColor: AppTheme.primary,
                  ),
                  const SizedBox(height: 16),

                  _TextAreaField(
                    controller: _issuesCtrl,
                    label: 'Issues & Blockers',
                    hint: 'Any problems, delays or blockers encountered...',
                    icon: Icons.warning_amber_rounded,
                    iconColor: const Color(0xFFF59E0B),
                  ),
                  const SizedBox(height: 16),

                  _TextAreaField(
                    controller: _safetyCtrl,
                    label: 'Safety Observations',
                    hint:
                        'Safety incidents, near-misses, or PPE compliance notes...',
                    icon: Icons.health_and_safety_outlined,
                    iconColor: AppTheme.success,
                  ),
                  const SizedBox(height: 20),

                  // Photos
                  const Text(
                    'Site Photos',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ..._photoUrls.map(
                        (url) => Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                url,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: GestureDetector(
                                onTap: () =>
                                    setState(() => _photoUrls.remove(url)),
                                child: Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(
                                    color: Colors.black54,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Icon(
                                    Icons.close_rounded,
                                    color: Colors.white,
                                    size: 14,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: _isUploadingPhoto ? null : _pickPhoto,
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppTheme.divider,
                              style: BorderStyle.solid,
                            ),
                          ),
                          child: _isUploadingPhoto
                              ? const Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                )
                              : const Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.camera_alt_outlined,
                                      color: AppTheme.textLight,
                                    ),
                                    SizedBox(height: 4),
                                    Text(
                                      'Add',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: AppTheme.textLight,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }
}

class _TextAreaField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final Color iconColor;

  const _TextAreaField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: iconColor),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: iconColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
          ),
          maxLines: 3,
        ),
      ],
    );
  }
}
