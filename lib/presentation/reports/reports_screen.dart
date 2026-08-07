import 'dart:io';

import 'package:csv/csv.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/enums/task_priority.dart';
import '../../core/enums/task_status.dart';
import '../../data/models/project_model.dart';
import '../../providers/project_provider.dart';
import '../../providers/task_provider.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/permission_gate.dart';

// ─── Filter Enum ──────────────────────────────────────────────────────────────

enum _Period { week, month, quarter, all }

extension _PeriodLabel on _Period {
  String get label {
    switch (this) {
      case _Period.week:
        return '7 Days';
      case _Period.month:
        return '30 Days';
      case _Period.quarter:
        return '90 Days';
      case _Period.all:
        return 'All time';
    }
  }

  DateTime? get cutoff {
    final now = DateTime.now();
    switch (this) {
      case _Period.week:
        return now.subtract(const Duration(days: 7));
      case _Period.month:
        return now.subtract(const Duration(days: 30));
      case _Period.quarter:
        return now.subtract(const Duration(days: 90));
      case _Period.all:
        return null;
    }
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  _Period _period = _Period.month;
  int? _touchedIndex;

  @override
  Widget build(BuildContext context) {
    // Managers should see reports for all tasks, not just their assigned ones.
    final tasksAsync = ref.watch(allTasksProvider);
    final projectsAsync = ref.watch(projectsProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text(AppStrings.reports),
        actions: [
          PermissionGate(
            permission: 'reports_export',
            child: tasksAsync.maybeWhen(
              data: (tasks) => IconButton(
                icon: const Icon(Icons.download_rounded),
                tooltip: 'Export CSV',
                onPressed: () => _exportCsv(context, tasks),
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ),
        ],
      ),
      body: tasksAsync.when(
        loading: () => const ShimmerList(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(allTasksProvider),
        ),
        data: (allTasks) {
          // Period filter
          final cutoff = _period.cutoff;
          final tasks = cutoff == null
              ? allTasks
              : allTasks.where((t) => t.createdAt.isAfter(cutoff)).toList();

          if (allTasks.isEmpty) {
            return const EmptyStateWidget(
              icon: Icons.insights_rounded,
              title: 'No tasks yet',
              subtitle: 'Reports will appear here once tasks are created.',
            );
          }

          // Compute stats
          final total = tasks.length;
          final completed = tasks
              .where((t) => t.status == TaskStatus.done)
              .length;
          final overdue = tasks.where((t) => t.isOverdue).length;
          final inProgress = tasks
              .where((t) => t.status == TaskStatus.inProgress)
              .length;
          final rate = total == 0 ? 0.0 : (completed / total * 100);

          final statusMap = {
            for (final s in TaskStatus.values)
              s: tasks.where((t) => t.status == s).length,
          };

          final priorityMap = {
            for (final p in TaskPriority.values)
              p: tasks.where((t) => t.priority == p).length,
          };

          return RefreshIndicator(
            color: AppTheme.primary,
            onRefresh: () async {
              ref.invalidate(allTasksProvider);
              ref.invalidate(projectsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Period filter chips ────────────────────────────────────
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: _Period.values.map((p) {
                      final selected = p == _period;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(p.label),
                          selected: selected,
                          onSelected: (_) => setState(() => _period = p),
                          backgroundColor: AppTheme.surface,
                          selectedColor: AppTheme.primary.withValues(
                            alpha: 0.07,
                          ),
                          checkmarkColor: AppTheme.primary,
                          labelStyle: TextStyle(
                            color: selected
                                ? AppTheme.primary
                                : AppTheme.textMuted,
                            fontWeight: selected
                                ? FontWeight.w600
                                : FontWeight.normal,
                            fontSize: 12,
                          ),
                          side: BorderSide(
                            color: selected
                                ? AppTheme.primary
                                : AppTheme.divider,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),

                const SizedBox(height: 16),

                // ── KPI Cards ─────────────────────────────────────────────
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.7,
                  children: [
                    _KpiCard(
                      label: 'Completion Rate',
                      value: '${rate.toStringAsFixed(0)}%',
                      icon: Icons.donut_large_rounded,
                      color: AppTheme.success,
                      sub: '$completed / $total tasks',
                    ),
                    _KpiCard(
                      label: 'In Progress',
                      value: '$inProgress',
                      icon: Icons.pending_outlined,
                      color: AppTheme.info,
                      sub: 'Active tasks',
                    ),
                    _KpiCard(
                      label: 'Overdue',
                      value: '$overdue',
                      icon: Icons.alarm_off_rounded,
                      color: overdue > 0 ? AppTheme.error : AppTheme.success,
                      sub: overdue > 0 ? 'Need attention' : 'All on track',
                    ),
                    _KpiCard(
                      label: 'Total Tasks',
                      value: '$total',
                      icon: Icons.task_alt_rounded,
                      color: AppTheme.primary,
                      sub: _period.label,
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // ── Completion progress bar ────────────────────────────────
                _SectionCard(
                  title: 'Overall Progress',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '$completed of $total completed',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.textMuted,
                            ),
                          ),
                          Text(
                            '${rate.toStringAsFixed(1)}%',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.success,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                        child: LinearProgressIndicator(
                          value: total == 0 ? 0.0 : rate / 100,
                          minHeight: 10,
                          backgroundColor: AppTheme.divider,
                          valueColor: const AlwaysStoppedAnimation(
                            AppTheme.success,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Mini breakdown
                      Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        children: TaskStatus.values
                            .where((s) => (statusMap[s] ?? 0) > 0)
                            .map(
                              (s) => _MiniLegend(
                                color: s.color,
                                label: s.label,
                                count: statusMap[s] ?? 0,
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Status distribution pie chart ──────────────────────────
                _SectionCard(
                  title: 'Status Distribution',
                  child: Row(
                    children: [
                      // Pie chart
                      SizedBox(
                        width: 150,
                        height: 150,
                        child: PieChart(
                          PieChartData(
                            sectionsSpace: 2,
                            centerSpaceRadius: 36,
                            pieTouchData: PieTouchData(
                              touchCallback: (event, response) {
                                setState(() {
                                  if (!event.isInterestedForInteractions ||
                                      response == null ||
                                      response.touchedSection == null) {
                                    _touchedIndex = null;
                                    return;
                                  }
                                  _touchedIndex = response
                                      .touchedSection!
                                      .touchedSectionIndex;
                                });
                              },
                            ),
                            sections: () {
                              final visible = TaskStatus.values
                                  .where((s) => (statusMap[s] ?? 0) > 0)
                                  .toList();
                              return List.generate(visible.length, (i) {
                                final s = visible[i];
                                final count = statusMap[s] ?? 0;
                                final isTouched = _touchedIndex == i;
                                return PieChartSectionData(
                                  value: count.toDouble(),
                                  color: s.color,
                                  title: isTouched
                                      ? '${(count / total * 100).toStringAsFixed(0)}%'
                                      : '',
                                  radius: isTouched ? 52 : 44,
                                  titleStyle: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                );
                              });
                            }(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 20),
                      // Legend
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: TaskStatus.values
                              .where((s) => (statusMap[s] ?? 0) > 0)
                              .map((s) {
                                final count = statusMap[s] ?? 0;
                                final pct = total == 0
                                    ? 0.0
                                    : count / total * 100;
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 10,
                                        height: 10,
                                        decoration: BoxDecoration(
                                          color: s.color,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          s.label,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.textMuted,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '$count',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '(${pct.toStringAsFixed(0)}%)',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: AppTheme.textLight,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              })
                              .toList(),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Priority breakdown bar chart ───────────────────────────
                _SectionCard(
                  title: 'Priority Breakdown',
                  child: Column(
                    children: TaskPriority.values.map((p) {
                      final count = priorityMap[p] ?? 0;
                      final fraction = total == 0 ? 0.0 : count / total;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 70,
                              child: Text(
                                p.label,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                                child: LinearProgressIndicator(
                                  value: fraction,
                                  minHeight: 8,
                                  backgroundColor: AppTheme.divider,
                                  valueColor: AlwaysStoppedAnimation(p.color),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            SizedBox(
                              width: 28,
                              child: Text(
                                '$count',
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),

                const SizedBox(height: 16),

                // ── Project summary ────────────────────────────────────────
                projectsAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (projects) {
                    if (projects.isEmpty) return const SizedBox.shrink();
                    return _SectionCard(
                      title: 'Project Health',
                      child: Column(
                        children: projects.take(5).map((proj) {
                          final projTasks = allTasks
                              .where((t) => t.projectId == proj.id)
                              .toList();
                          final projDone = projTasks
                              .where((t) => t.status == TaskStatus.done)
                              .length;
                          final projTotal = projTasks.length;
                          final projRate = projTotal == 0
                              ? 0.0
                              : projDone / projTotal;
                          final healthColor = switch (proj.healthStatus) {
                            HealthStatus.green => AppTheme.success,
                            HealthStatus.amber => AppTheme.accent,
                            HealthStatus.red => AppTheme.error,
                          };

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: healthColor,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        proj.name,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Text(
                                      '$projDone/$projTotal tasks',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppTheme.textLight,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                                  child: LinearProgressIndicator(
                                    value: projRate,
                                    minHeight: 6,
                                    backgroundColor: AppTheme.divider,
                                    valueColor: AlwaysStoppedAnimation(
                                      healthColor,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 16),

                // ── Export button ──────────────────────────────────────────
                PermissionGate(
                  permission: 'reports_export',
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _exportCsv(context, allTasks),
                      icon: const Icon(Icons.table_chart_rounded, size: 18),
                      label: const Text('Export Full Report as CSV'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        foregroundColor: AppTheme.primary,
                        side: const BorderSide(color: AppTheme.primary),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _exportCsv(BuildContext context, List tasks) async {
    try {
      final rows = <List<String>>[
        [
          'Title',
          'Status',
          'Priority',
          'Created',
          'Due Date',
          'Est. Hours',
          'Actual Hours',
        ],
        ...tasks.map<List<String>>(
          (t) => [
            t.title.toString(),
            t.status.label.toString(),
            t.priority.label.toString(),
            DateFormat('yyyy-MM-dd').format(t.createdAt),
            DateFormat('yyyy-MM-dd').format(t.dueDate),
            t.estimatedHours.toString(),
            t.actualHours.toString(),
          ],
        ),
      ];
      final csv = const ListToCsvConverter().convert(rows);
      final dir = await getApplicationDocumentsDirectory();
      final fileName =
          'kurickal_report_${DateFormat('yyyyMMdd_HHmm').format(DateTime.now())}.csv';
      final file = File('${dir.path}/$fileName');
      await file.writeAsString(csv);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved: $fileName'),
          backgroundColor: AppTheme.success,
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Export failed: $e'),
          backgroundColor: AppTheme.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                ),
                child: Icon(icon, color: color, size: 16),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: color,
                  height: 1.0,
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.onSurface,
                ),
              ),
              Text(
                sub,
                style: const TextStyle(fontSize: 10, color: AppTheme.textLight),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

// ─── Mini Legend chip ─────────────────────────────────────────────────────────

class _MiniLegend extends StatelessWidget {
  final Color color;
  final String label;
  final int count;

  const _MiniLegend({
    required this.color,
    required this.label,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        border: Border.all(color: color.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            '$label ($count)',
            style: TextStyle(
              fontSize: 11,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
