import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/utils/location_utils.dart';
import '../../data/models/attendance_model.dart';
import '../../data/models/project_model.dart';
import '../../data/models/user_model.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../../providers/project_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/empty_state_widget.dart';

class MyAttendanceScreen extends ConsumerStatefulWidget {
  const MyAttendanceScreen({super.key});

  @override
  ConsumerState<MyAttendanceScreen> createState() => _MyAttendanceScreenState();
}

class _MyAttendanceScreenState extends ConsumerState<MyAttendanceScreen> {
  bool _isCheckingIn = false;
  String? _selectedProjectId;

  // ─── Check-in / Check-out logic ────────────────────────────────────────────

  Future<void> _handleCheckInOut() async {
    setState(() => _isCheckingIn = true);
    try {
      // 1. Location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _showSnack(
          'Location permission is required to check in.',
          isError: true,
        );
        return;
      }

      // 2. Current position (Optimized for speed)
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium,
          timeLimit: const Duration(seconds: 4),
        );
      } catch (_) {
        position = await Geolocator.getLastKnownPosition();
      }

      if (position == null) {
        try {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.low,
            timeLimit: const Duration(seconds: 3),
          );
        } catch (_) {
          // Keep null if it fails again
        }
      }

      if (position == null) {
        _showSnack(
          'Could not retrieve GPS location. Please try again in an open area.',
          isError: true,
        );
        return;
      }

      // 3. Resolve user & project
      final user = ref.read(currentUserProvider).value;
      if (user == null) {
        _showSnack('User not found. Please sign in again.', isError: true);
        return;
      }

      final projects = ref.read(projectsProvider).value ?? [];
      if (projects.isEmpty) {
        _showSnack(
          'No project assigned. Contact your administrator.',
          isError: true,
        );
        return;
      }

      final projectId = _selectedProjectId ?? projects.first.id;
      final project = projects.firstWhere(
        (p) => p.id == projectId,
        orElse: () => projects.first,
      );

      final repo = ref.read(attendanceRepositoryProvider);
      final existing = await repo.getTodayAttendance(user.uid, project.id);
      final lat = position.latitude;
      final lng = position.longitude;

      if (existing != null && existing.checkOutTime == null) {
        // ── Check Out ──
        await repo.checkOut(existing.id, GeoPoint(lat, lng), DateTime.now());
        _showSnack('Checked out successfully.');
        // Async: reverse-geocode check-out location
        LocationUtils.getAddressFromCoords(lat, lng).then((addr) {
          if (addr != null) repo.updateCheckOutAddress(existing.id, addr);
        }).ignore();
      } else {
        // ── Check In ──
        double distanceMetres = double.infinity;
        if (project.siteCoordinates != null) {
          distanceMetres = Geolocator.distanceBetween(
            lat,
            lng,
            project.siteCoordinates!.latitude,
            project.siteCoordinates!.longitude,
          );
        }

        const double geofenceRadius = 200.0;
        final bool isWithin =
            project.siteCoordinates == null || distanceMetres <= geofenceRadius;

        if (!isWithin) {
          if (!mounted) return;
          final proceed = await _showGeofenceWarningSheet(distanceMetres);
          if (!proceed) return;
        }

        final now = DateTime.now();
        final record = AttendanceModel(
          id: '',
          userId: user.uid,
          projectId: project.id,
          checkInTime: now,
          checkInLocation: GeoPoint(lat, lng),
          isWithinGeofence: isWithin,
          date: DateFormat('yyyy-MM-dd').format(now),
        );

        final docId = await repo.checkIn(record);
        _showSnack('Checked in successfully.');
        // Async: reverse-geocode check-in location
        LocationUtils.getAddressFromCoords(lat, lng).then((addr) {
          if (addr != null) repo.updateCheckInAddress(docId, addr);
        }).ignore();
      }
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isCheckingIn = false);
    }
  }

  Future<bool> _showGeofenceWarningSheet(double distance) async {
    if (!mounted) return false;
    final result = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.divider,
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.location_off_rounded,
                size: 32,
                color: AppTheme.error,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Outside Site Boundary',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You are ${distance.toStringAsFixed(0)} m from the site '
              '(geofence limit: 200 m). Do you still want to check in?',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.error,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Check In Anyway'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    return result ?? false;
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.error : AppTheme.success,
      ),
    );
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final canViewAllAttendance = ref.watch(
      hasPermissionProvider('attendance_view_all'),
    );

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('My Attendance'),
        actions: [
          if (canViewAllAttendance)
            IconButton(
              icon: const Icon(Icons.admin_panel_settings_rounded),
              tooltip: 'Staff Attendance',
              onPressed: () => context.push('/admin/attendance'),
            ),
        ],
      ),
      body: _AttendanceBody(
        isCheckingIn: _isCheckingIn,
        selectedProjectId: _selectedProjectId,
        onProjectChanged: (id) => setState(() => _selectedProjectId = id),
        onCheckInOut: _handleCheckInOut,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Attendance Body
// ═══════════════════════════════════════════════════════════════════════════════

class _AttendanceBody extends ConsumerWidget {
  final bool isCheckingIn;
  final String? selectedProjectId;
  final ValueChanged<String?> onProjectChanged;
  final VoidCallback onCheckInOut;

  const _AttendanceBody({
    required this.isCheckingIn,
    required this.selectedProjectId,
    required this.onProjectChanged,
    required this.onCheckInOut,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectsAsync = ref.watch(projectsProvider);
    final currentUserAsync = ref.watch(currentUserProvider);

    return projectsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(projectsProvider),
      ),
      data: (projects) {
        final effectiveProjectId =
            selectedProjectId ??
            (projects.isNotEmpty ? projects.first.id : null);

        if (effectiveProjectId == null) {
          return const EmptyStateWidget(
            icon: Icons.construction_rounded,
            title: 'No Projects Assigned',
            subtitle:
                'You will be able to track attendance once assigned to a project.',
          );
        }

        final currentUser = currentUserAsync.value;

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            // ── Project Selector ──
            if (projects.length > 1) ...[
              _ProjectDropdown(
                projects: projects,
                selectedId: effectiveProjectId,
                onChanged: onProjectChanged,
              ),
              const SizedBox(height: 16),
            ],

            // ── My Check-In Card ──
            if (currentUser != null) ...[
              _MyCheckInCard(
                userId: currentUser.uid,
                projectId: effectiveProjectId,
                isLoading: isCheckingIn,
                onAction: onCheckInOut,
              ),
              const SizedBox(height: 20),
            ],

            // ── Today On Site ──
            _TodayOnSiteSection(projectId: effectiveProjectId),

            const SizedBox(height: 20),

            // ── Month Summary ──
            if (currentUser != null)
              _MonthSummarySection(userId: currentUser.uid),
          ],
        );
      },
    );
  }
}

// ── Project Dropdown ──────────────────────────────────────────────────────────

class _ProjectDropdown extends StatelessWidget {
  final List<ProjectModel> projects;
  final String selectedId;
  final ValueChanged<String?> onChanged;

  const _ProjectDropdown({
    required this.projects,
    required this.selectedId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: selectedId,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Active Project',
        prefixIcon: Icon(Icons.business_outlined),
      ),
      items: projects.map<DropdownMenuItem<String>>((p) {
        return DropdownMenuItem<String>(
          value: p.id,
          child: Text(p.name, overflow: TextOverflow.ellipsis),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }
}

// ── My Check-In Card ──────────────────────────────────────────────────────────

class _MyCheckInCard extends ConsumerWidget {
  final String userId;
  final String projectId;
  final bool isLoading;
  final VoidCallback onAction;

  const _MyCheckInCard({
    required this.userId,
    required this.projectId,
    required this.isLoading,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(
      todayAttendanceProvider((userId: userId, projectId: projectId)),
    );

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, AppTheme.primaryMid],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.softShadow,
      ),
      padding: const EdgeInsets.all(20),
      child: attendanceAsync.when(
        loading: () => const SizedBox(
          height: 72,
          child: Center(
            child: CircularProgressIndicator(color: Colors.white54),
          ),
        ),
        error: (e, _) => Text(
          'Could not load attendance: $e',
          style: const TextStyle(color: Colors.white70, fontSize: 12),
        ),
        data: (record) {
          final isCheckedIn = record != null && record.checkOutTime == null;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _StatusPill(isCheckedIn: isCheckedIn),
                  const Spacer(),
                  Text(
                    DateFormat('EEE, d MMM').format(DateTime.now()),
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                isCheckedIn ? 'Checked In' : 'Not Checked In',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (isCheckedIn) ...[
                const SizedBox(height: 4),
                Text(
                  'Since ${DateFormat('h:mm a').format(record.checkInTime)}',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                if (record.checkInAddress != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_rounded,
                        size: 12,
                        color: Colors.white54,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          record.checkInAddress!,
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 11,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_searching_rounded,
                        size: 12,
                        color: Colors.white38,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${record.checkInLocation.latitude.toStringAsFixed(4)}, '
                        '${record.checkInLocation.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(
                          color: Colors.white38,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
                if (!record.isWithinGeofence) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withValues(alpha: 0.31),
                      borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.warning_amber_rounded,
                          size: 11,
                          color: Colors.white,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Outside site boundary — recorded anyway',
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: isLoading ? null : onAction,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isCheckedIn
                        ? AppTheme.error
                        : AppTheme.accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.white24,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    ),
                  ),
                  icon: isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Icon(
                          isCheckedIn
                              ? Icons.logout_rounded
                              : Icons.login_rounded,
                          size: 18,
                        ),
                  label: Text(
                    isLoading
                        ? 'Please wait…'
                        : isCheckedIn
                        ? AppStrings.checkOut
                        : AppStrings.checkIn,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool isCheckedIn;

  const _StatusPill({required this.isCheckedIn});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isCheckedIn
            ? AppTheme.success.withValues(alpha: 0.2)
            : Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        border: Border.all(
          color: isCheckedIn
              ? AppTheme.success.withValues(alpha: 0.47)
              : Colors.white30,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: isCheckedIn ? AppTheme.success : Colors.white54,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            isCheckedIn ? 'On Site' : 'Off Site',
            style: TextStyle(
              color: isCheckedIn ? AppTheme.success : Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Today On Site Section ─────────────────────────────────────────────────────

class _TodayOnSiteSection extends ConsumerWidget {
  final String projectId;

  const _TodayOnSiteSection({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(
      todayProjectAttendanceProvider(projectId),
    );
    final usersAsync = ref.watch(allUsersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.people_rounded, size: 18, color: AppTheme.brand),
            const SizedBox(width: 6),
            const Text(
              'Today On Site',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.onSurface,
              ),
            ),
            const Spacer(),
            attendanceAsync.when(
              data: (list) {
                final onSite = list.where((a) => a.checkOutTime == null).length;
                return _CountBadge(count: onSite, color: AppTheme.success);
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            border: Border.all(color: AppTheme.divider),
            boxShadow: AppTheme.softShadow,
          ),
          child: attendanceAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Could not load attendance: $e',
                style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
              ),
            ),
            data: (records) {
              if (records.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                  child: Center(
                    child: Text(
                      'Nobody has checked in yet today.',
                      style: TextStyle(color: AppTheme.textMuted),
                    ),
                  ),
                );
              }

              return usersAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, __) => const SizedBox.shrink(),
                data: (users) {
                  return ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: records.length,
                    separatorBuilder: (_, __) => const Divider(
                      height: 1,
                      indent: 16,
                      endIndent: 16,
                      color: AppTheme.divider,
                    ),
                    itemBuilder: (_, i) {
                      final record = records[i];
                      final matchingUsers = users
                          .where((u) => u.uid == record.userId)
                          .toList();
                      final user = matchingUsers.isNotEmpty
                          ? matchingUsers.first
                          : null;
                      return _AttendanceRow(record: record, user: user);
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  final AttendanceModel record;
  final UserModel? user;

  const _AttendanceRow({required this.record, required this.user});

  @override
  Widget build(BuildContext context) {
    final isOnSite = record.checkOutTime == null;
    final checkInStr = DateFormat('h:mm a').format(record.checkInTime);
    final checkOutStr = record.checkOutTime != null
        ? DateFormat('h:mm a').format(record.checkOutTime!)
        : null;
    final displayName = user?.name ?? 'Unknown';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          // Avatar with status dot
          Stack(
            children: [
              AvatarWidget(
                imageUrl: user?.avatarUrl,
                name: displayName,
                size: 38,
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: isOnSite ? AppTheme.success : AppTheme.info,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: AppTheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      'In: $checkInStr',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppTheme.success,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (checkOutStr != null) ...[
                      const Text(
                        ' · ',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.textLight,
                        ),
                      ),
                      Text(
                        'Out: $checkOutStr',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.info,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                    if (!isOnSite && record.durationMinutes > 0) ...[
                      const Text(
                        ' · ',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.textLight,
                        ),
                      ),
                      Text(
                        record.durationFormatted,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ],
                ),
                // Location address
                if (record.checkInAddress != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_rounded,
                        size: 10,
                        color: AppTheme.textLight,
                      ),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          record.checkInAddress!,
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppTheme.textLight,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                // Out-of-geofence
                if (!record.isWithinGeofence) ...[
                  const SizedBox(height: 2),
                  const Row(
                    children: [
                      Icon(
                        Icons.warning_amber_rounded,
                        size: 10,
                        color: AppTheme.error,
                      ),
                      SizedBox(width: 3),
                      Text(
                        'Outside geofence',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppTheme.error,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isOnSite)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                border: Border.all(
                  color: AppTheme.success.withValues(alpha: 0.31),
                ),
              ),
              child: const Text(
                'On Site',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.success,
                ),
              ),
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'Left',
                  style: TextStyle(fontSize: 10, color: AppTheme.textLight),
                ),
                Text(
                  checkOutStr ?? '–',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _CountBadge extends StatelessWidget {
  final int count;
  final Color color;

  const _CountBadge({required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Text(
        '$count on site',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

// ── Month Summary Section ─────────────────────────────────────────────────────

class _MonthSummarySection extends ConsumerWidget {
  final String userId;

  const _MonthSummarySection({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final monthKey = DateFormat('yyyy-MM').format(now);
    final attendanceAsync = ref.watch(
      userMonthAttendanceProvider((userId: userId, month: monthKey)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.calendar_month_rounded,
              size: 18,
              color: AppTheme.brand,
            ),
            const SizedBox(width: 6),
            Text(
              DateFormat('MMMM yyyy').format(now),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.onSurface,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            border: Border.all(color: AppTheme.divider),
            boxShadow: AppTheme.softShadow,
          ),
          padding: const EdgeInsets.all(16),
          child: attendanceAsync.when(
            loading: () => const SizedBox(
              height: 80,
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Text(
              'Could not load month data: $e',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            data: (records) => _MonthCalendar(month: now, records: records),
          ),
        ),
        const SizedBox(height: 12),
        const _CalendarLegend(),
      ],
    );
  }
}

class _MonthCalendar extends StatelessWidget {
  final DateTime month;
  final List<AttendanceModel> records;

  const _MonthCalendar({required this.month, required this.records});

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Monday-based offset: weekday 1 = Mon (offset 0) … 7 = Sun (offset 6)
    final startOffset = (firstDay.weekday - 1) % 7;
    final today = DateTime.now();

    final Map<String, AttendanceModel> byDate = {
      for (final r in records) r.date: r,
    };

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Column(
      children: [
        // Day-of-week headers
        Row(
          children: dayLabels
              .map(
                (d) => Expanded(
                  child: Center(
                    child: Text(
                      d,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        // Date cells
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 1,
          ),
          itemCount: startOffset + daysInMonth,
          itemBuilder: (_, index) {
            if (index < startOffset) return const SizedBox.shrink();

            final day = index - startOffset + 1;
            final date = DateTime(month.year, month.month, day);
            final dateStr = DateFormat('yyyy-MM-dd').format(date);
            final record = byDate[dateStr];
            final isToday =
                date.year == today.year &&
                date.month == today.month &&
                date.day == today.day;
            final isFuture = date.isAfter(
              DateTime(today.year, today.month, today.day),
            );

            return _CalendarDay(
              day: day,
              record: record,
              isToday: isToday,
              isFuture: isFuture,
            );
          },
        ),
      ],
    );
  }
}

class _CalendarDay extends StatelessWidget {
  final int day;
  final AttendanceModel? record;
  final bool isToday;
  final bool isFuture;

  const _CalendarDay({
    required this.day,
    required this.record,
    required this.isToday,
    required this.isFuture,
  });

  @override
  Widget build(BuildContext context) {
    final Color bgColor;
    final Color textColor;
    final Border? border;

    if (isToday) {
      bgColor = AppTheme.brand.withValues(alpha: 0.16);
      textColor = AppTheme.brand;
      border = Border.all(color: AppTheme.brand, width: 1.5);
    } else if (isFuture || record == null) {
      bgColor = AppTheme.background;
      textColor = isFuture ? AppTheme.textLight : AppTheme.textMuted;
      border = null;
    } else if (record!.checkOutTime != null) {
      // Fully attended: checked in and out
      bgColor = AppTheme.success.withValues(alpha: 0.16);
      textColor = AppTheme.success;
      border = Border.all(color: AppTheme.success.withValues(alpha: 0.31));
    } else {
      // Checked in but not out
      bgColor = AppTheme.accent.withValues(alpha: 0.16);
      textColor = AppTheme.accentDark;
      border = Border.all(color: AppTheme.accent.withValues(alpha: 0.31));
    }

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        border: border,
      ),
      child: Center(
        child: Text(
          '$day',
          style: TextStyle(
            fontSize: 11,
            fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
            color: textColor,
          ),
        ),
      ),
    );
  }
}

class _CalendarLegend extends StatelessWidget {
  const _CalendarLegend();

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 6,
      children: const [
        _LegendItem(color: AppTheme.success, label: 'Present'),
        _LegendItem(color: AppTheme.accent, label: 'In only'),
        _LegendItem(color: AppTheme.brand, label: 'Today'),
        _LegendItem(color: AppTheme.background, label: 'No record'),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.31),
            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
            border: Border.all(color: color.withValues(alpha: 0.55)),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
        ),
      ],
    );
  }
}
