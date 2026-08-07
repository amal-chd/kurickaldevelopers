import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../data/models/project_model.dart';
import '../../providers/project_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/permission_gate.dart';

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key});

  @override
  ConsumerState<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends ConsumerState<ProjectsScreen> {
  ProjectStatus? _filterStatus;

  @override
  Widget build(BuildContext context) {
    final projectsAsync = ref.watch(projectsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text(
          AppStrings.projects,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontFamily: 'Plus Jakarta Sans',
          ),
        ),
        actions: [
          PermissionGate(
            permission: 'projects_create',
            child: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                ),
                child: const Icon(Icons.add_rounded, color: AppTheme.primary),
              ),
              tooltip: 'New Project',
              onPressed: () => context.push('/projects/create'),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(
                    selected: _filterStatus == null,
                    label: 'All',
                    onTap: () => setState(() => _filterStatus = null),
                  ),
                  const SizedBox(width: 10),
                  _FilterChip(
                    selected: _filterStatus == ProjectStatus.active,
                    label: 'Active',
                    onTap: () =>
                        setState(() => _filterStatus = ProjectStatus.active),
                    color: AppTheme.success,
                  ),
                  const SizedBox(width: 10),
                  _FilterChip(
                    selected: _filterStatus == ProjectStatus.onHold,
                    label: 'On Hold',
                    onTap: () =>
                        setState(() => _filterStatus = ProjectStatus.onHold),
                    color: AppTheme.accent,
                  ),
                  const SizedBox(width: 10),
                  _FilterChip(
                    selected: _filterStatus == ProjectStatus.completed,
                    label: 'Done',
                    onTap: () =>
                        setState(() => _filterStatus = ProjectStatus.completed),
                    color: AppTheme.primary,
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: projectsAsync.when(
              loading: () => const ShimmerList(),
              error: (e, _) => AppErrorWidget(
                message: e.toString(),
                onRetry: () => ref.invalidate(projectsProvider),
              ),
              data: (all) {
                final projects = _filterStatus == null
                    ? all
                    : all.where((p) => p.status == _filterStatus).toList();
                if (projects.isEmpty) {
                  return EmptyStateWidget(
                    title: 'No projects found',
                    subtitle: _filterStatus == null
                        ? 'You don\'t have any projects yet. Ask your admin to add you.'
                        : 'No ${_filterStatus!.label.toLowerCase()} projects.',
                    icon: Icons.business_outlined,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(projectsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                    itemCount: projects.length,
                    itemBuilder: (_, i) => _ProjectCard(
                      project: projects[i],
                      onTap: () => context.push('/projects/${projects[i].id}'),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final bool selected;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  const _FilterChip({
    required this.selected,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppTheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? chipColor.withValues(alpha: 0.12) : Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          border: Border.all(color: selected ? chipColor : AppTheme.divider.withValues(alpha: 0.5)),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: chipColor.withValues(alpha: 0.15),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? chipColor : AppTheme.textMuted,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final ProjectModel project;
  final VoidCallback onTap;
  const _ProjectCard({required this.project, required this.onTap});

  Color get _healthColor {
    switch (project.healthStatus) {
      case HealthStatus.green:
        return AppTheme.success;
      case HealthStatus.amber:
        return AppTheme.accent;
      case HealthStatus.red:
        return AppTheme.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    final daysRemaining = project.expectedEndDate
        .difference(DateTime.now())
        .inDays;
    final isOverdue =
        daysRemaining < 0 && project.status != ProjectStatus.completed;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(18),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Health indicator
                    Container(
                      width: 5,
                      decoration: BoxDecoration(
                        color: _healthColor,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            project.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              fontFamily: 'Plus Jakarta Sans',
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            project.clientName,
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 13,
                              fontFamily: 'Inter',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _StatusBadge(status: project.status),
                        const SizedBox(height: 6),
                        Text(
                          isOverdue
                              ? '${daysRemaining.abs()}d overdue'
                              : '${daysRemaining}d left',
                          style: TextStyle(
                            fontSize: 12,
                            color: isOverdue
                                ? AppTheme.error
                                : AppTheme.textMuted,
                            fontWeight: isOverdue
                                ? FontWeight.w700
                                : FontWeight.w600,
                            fontFamily: 'Inter',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            // Progress bar + address
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 14,
                        color: AppTheme.textMuted,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          project.siteAddress,
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                            fontFamily: 'Inter',
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: project.progressPercent / 100,
                            minHeight: 8,
                            backgroundColor: AppTheme.divider,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              project.progressPercent >= 80
                                  ? AppTheme.success
                                  : project.progressPercent >= 40
                                  ? AppTheme.accent
                                  : AppTheme.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${project.progressPercent}%',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          fontFamily: 'Plus Jakarta Sans',
                        ),
                      ),
                    ],
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

class _StatusBadge extends StatelessWidget {
  final ProjectStatus status;
  const _StatusBadge({required this.status});

  Color get _color {
    switch (status) {
      case ProjectStatus.active:
        return AppTheme.success;
      case ProjectStatus.onHold:
        return AppTheme.accent;
      case ProjectStatus.completed:
        return AppTheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: _color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
          fontFamily: 'Inter',
        ),
      ),
    );
  }
}
