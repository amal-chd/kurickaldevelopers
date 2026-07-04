import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../app/theme.dart';
import '../../data/repositories/admin_repository.dart';
import '../../providers/admin_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

/// Director-only screen: configure which roles may assign tasks to which roles.
class TaskAssignmentScreen extends ConsumerStatefulWidget {
  const TaskAssignmentScreen({super.key});

  @override
  ConsumerState<TaskAssignmentScreen> createState() =>
      _TaskAssignmentScreenState();
}

class _TaskAssignmentScreenState extends ConsumerState<TaskAssignmentScreen> {
  bool _enabled = false;
  Map<String, List<String>> _matrix = {};
  bool _loaded = false;
  bool _saving = false;

  void _seedFrom(TaskAssignmentConfig config) {
    if (_loaded) return;
    _enabled = config.enabled;
    _matrix = {
      for (final e in config.matrix.entries) e.key: List<String>.from(e.value),
    };
    _loaded = true;
  }

  bool _isAllowed(String from, String to) =>
      _matrix[from]?.contains(to) ?? false;

  void _toggle(String from, String to) {
    setState(() {
      final list = _matrix[from] ?? <String>[];
      if (list.contains(to)) {
        list.remove(to);
      } else {
        list.add(to);
      }
      _matrix[from] = list;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final uid = ref.read(currentUserProvider).value?.uid ?? '';
      await ref.read(adminRepositoryProvider).saveTaskAssignmentConfig(
            TaskAssignmentConfig(enabled: _enabled, matrix: _matrix),
            uid,
          );
      if (mounted) {
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assignment rules saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rolesAsync = ref.watch(allRolesProvider);
    final configAsync = ref.watch(taskAssignmentConfigProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('Task Assignment Rules')),
      body: rolesAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => AppErrorWidget(message: e.toString()),
        data: (roles) {
          return configAsync.when(
            loading: () => const LoadingWidget(),
            error: (e, _) => AppErrorWidget(message: e.toString()),
            data: (config) {
              _seedFrom(config);
              // Highest authority first
              final sorted = [...roles]
                ..sort((a, b) => b.level.compareTo(a.level));

              return Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // Enable switch
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: AppTheme.softShadow,
                          ),
                          child: SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _enabled,
                            onChanged: (v) => setState(() => _enabled = v),
                            title: Text(
                              'Enforce assignment rules',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                            subtitle: Text(
                              'When off, anyone who can create tasks may assign to anyone.',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: AppTheme.textMuted,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'For each role, choose which roles it may assign tasks to.',
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: AppTheme.textMuted,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // One expandable card per creator role
                        ...sorted.map((from) {
                          final count = _matrix[from.id]?.length ?? 0;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: AppTheme.softShadow,
                            ),
                            child: Theme(
                              data: Theme.of(context)
                                  .copyWith(dividerColor: Colors.transparent),
                              child: ExpansionTile(
                                shape: const Border(),
                                leading: CircleAvatar(
                                  radius: 6,
                                  backgroundColor: _colorFor(from.color),
                                ),
                                title: Text(
                                  from.name,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                                subtitle: Text(
                                  count == 0
                                      ? 'Not configured — uses default'
                                      : 'Can assign to $count role(s)',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: AppTheme.textMuted,
                                  ),
                                ),
                                children: sorted.map((to) {
                                  return CheckboxListTile(
                                    dense: true,
                                    value: _isAllowed(from.id, to.id),
                                    onChanged: (_) => _toggle(from.id, to.id),
                                    title: Text(
                                      to.name,
                                      style: GoogleFonts.inter(fontSize: 14),
                                    ),
                                    secondary: CircleAvatar(
                                      radius: 5,
                                      backgroundColor: _colorFor(to.color),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),

                  // Save bar
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _save,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: _saving
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : Text(
                                  'Save Rules',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Color _colorFor(String hex) {
    try {
      var h = hex.replaceFirst('#', '');
      if (h.length == 6) h = 'FF$h';
      return Color(int.parse(h, radix: 16));
    } catch (_) {
      return AppTheme.primary;
    }
  }
}
