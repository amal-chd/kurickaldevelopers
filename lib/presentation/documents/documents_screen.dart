import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/approval_status.dart';
import '../../core/extensions/datetime_ext.dart';
import '../../core/utils/file_utils.dart';
import '../../data/models/document_model.dart';
import '../../data/services/storage_service.dart';
import '../../providers/document_provider.dart';
import '../../providers/project_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/permission_gate.dart';

class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key});

  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  String? _selectedProjectId;
  DocumentType? _filterType;
  bool _uploading = false;

  void _snack(String message, {Color? color}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // Pick a file and upload it to Supabase Storage, then record it in Firestore.
  Future<void> _uploadDocument() async {
    if (_uploading) return;
    if (_selectedProjectId == null) {
      _snack('Select a project first', color: AppTheme.warning);
      return;
    }

    final result = await FilePicker.platform.pickFiles(withData: false);
    if (result == null || result.files.single.path == null) return;

    final picked = result.files.single;
    final file = File(picked.path!);
    final ext = (picked.extension ?? '').toLowerCase();

    setState(() => _uploading = true);
    try {
      final storage = StorageService();
      final url = await storage.uploadDocument(
        projectId: _selectedProjectId!,
        fileName: picked.name,
        file: file,
        mimeType: _mimeFor(ext),
        onProgress: (_) {},
      );

      final uploaderId = ref.read(currentUserProvider).value?.uid ?? '';
      final doc = DocumentModel(
        id: '',
        projectId: _selectedProjectId!,
        name: picked.name,
        type: _docTypeFor(ext),
        fileUrl: url,
        fileSize: picked.size,
        mimeType: _mimeFor(ext),
        uploadedBy: uploaderId,
        approvalStatus: ApprovalStatus.pending,
        uploadedAt: DateTime.now(),
      );
      await ref.read(documentRepositoryProvider).createDocument(doc);
      _snack('Document uploaded', color: AppTheme.success);
    } catch (e) {
      _snack('Upload failed: $e', color: AppTheme.error);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String _mimeFor(String ext) {
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      default:
        return 'application/octet-stream';
    }
  }

  DocumentType _docTypeFor(String ext) {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].contains(ext)) {
      return DocumentType.photo;
    }
    if (ext == 'pdf') return DocumentType.report;
    return DocumentType.other;
  }

  @override
  Widget build(BuildContext context) {
    final projectsAsync = ref.watch(projectsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.documents)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: projectsAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (projects) => Container(
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  border: Border.all(color: AppTheme.divider),
                  boxShadow: AppTheme.softShadow,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedProjectId,
                    hint: const Text('Select Project'),
                    isExpanded: true,
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.textMuted),
                    items: projects
                        .map(
                          (p) => DropdownMenuItem(value: p.id, child: Text(p.name)),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _selectedProjectId = v),
                  ),
                ),
              ),
            ),
          ),

          // Type filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _TypeChip(
                  selected: _filterType == null,
                  label: 'All',
                  onTap: () => setState(() => _filterType = null),
                ),
                ...DocumentType.values.map(
                  (t) => _TypeChip(
                    selected: _filterType == t,
                    label: t.label,
                    onTap: () => setState(() => _filterType = t),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          Expanded(
            child: _selectedProjectId == null
                ? const EmptyStateWidget(
                    title: 'Select a project',
                    subtitle: 'Choose a project to view its documents',
                    icon: Icons.folder_outlined,
                  )
                : Consumer(
                    builder: (_, ref, __) {
                      final docsAsync = ref.watch(
                        projectDocumentsProvider(_selectedProjectId!),
                      );
                      return docsAsync.when(
                        loading: () => const ShimmerList(),
                        error: (e, _) => AppErrorWidget(
                          message: e.toString(),
                          onRetry: () => ref.invalidate(
                            projectDocumentsProvider(_selectedProjectId!),
                          ),
                        ),
                        data: (all) {
                          final docs = _filterType == null
                              ? all
                              : all
                                    .where((d) => d.type == _filterType)
                                    .toList();
                          if (docs.isEmpty) {
                            return const EmptyStateWidget(
                              title: 'No documents',
                              icon: Icons.folder_open_rounded,
                            );
                          }
                          return ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: docs.length,
                            itemBuilder: (_, i) => _DocumentRow(
                              doc: docs[i],
                              onTap: () =>
                                  context.push('/documents/${docs[i].id}'),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: PermissionGate(
        permission: 'docs_upload',
        child: FloatingActionButton.extended(
          onPressed: _uploading ? null : _uploadDocument,
          icon: _uploading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.upload_rounded),
          label: Text(_uploading ? 'Uploading…' : AppStrings.uploadDocument),
        ),
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final bool selected;
  final String label;
  final VoidCallback onTap;
  const _TypeChip({
    required this.selected,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: FilterChip(
        label: Text(
          label,
          overflow: TextOverflow.visible,
          style: TextStyle(
            color: selected ? Colors.white : AppTheme.onSurface,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        selectedColor: AppTheme.primary,
        backgroundColor: AppTheme.surface,
        side: BorderSide(
          color: selected ? AppTheme.primary : AppTheme.divider,
          width: 1.2,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusPill)),
      ),
    );
  }
}

class _DocumentRow extends StatelessWidget {
  final DocumentModel doc;
  final VoidCallback onTap;
  const _DocumentRow({required this.doc, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.divider),
        boxShadow: AppTheme.softShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: onTap,
          child: ListTile(
            leading: Icon(
              FileUtils.iconForMimeType(doc.mimeType),
              color: FileUtils.colorForMimeType(doc.mimeType),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    doc.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.divider,
                    borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                  ),
                  child: Text(
                    'Rev ${doc.version.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              ],
            ),
            subtitle: Text(
              '${doc.uploadedAt.formatted} • ${FileUtils.formatFileSize(doc.fileSize)}',
            ),
            trailing: const Icon(Icons.chevron_right_rounded),
          ),
        ),
      ),
    );
  }
}
