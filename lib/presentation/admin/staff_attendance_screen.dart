import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:csv/csv.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../../app/theme.dart';
import '../../core/utils/date_utils.dart';
import '../../data/models/attendance_model.dart';
import '../../data/models/user_model.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/empty_state_widget.dart';

// ─── Staff Attendance Dashboard ───────────────────────────────────────────────

class StaffAttendanceScreen extends ConsumerStatefulWidget {
  const StaffAttendanceScreen({super.key});

  @override
  ConsumerState<StaffAttendanceScreen> createState() =>
      _StaffAttendanceScreenState();
}

class _StaffAttendanceScreenState extends ConsumerState<StaffAttendanceScreen>
    with TickerProviderStateMixin {
  DateTime _selectedDate = DateTime.now();
  String? _selectedRoleId;

  late TabController _tabController;
  DateTime _overtimeMonth = DateTime.now();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String get _dateKey => AppDateUtils.toYMD(_selectedDate);
  bool get _isToday {
    final now = DateTime.now();
    return _selectedDate.year == now.year &&
        _selectedDate.month == now.month &&
        _selectedDate.day == now.day;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppTheme.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null && mounted) setState(() => _selectedDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    // Wait for role before evaluating permissions — prevents false denial flash.
    final roleAsync = ref.watch(currentRoleProvider);
    if (roleAsync.isLoading) {
      return const Scaffold(body: LoadingWidget());
    }

    // Permission gate: only users with team_manage or attendance_view_all
    // can see other people's attendance.
    final canView =
        ref.watch(hasPermissionProvider('team_manage')) ||
            ref.watch(hasPermissionProvider('attendance_view_all'));
    if (!canView) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(title: const Text('Staff Attendance')),
        body: const EmptyStateWidget(
          icon: Icons.lock_outline_rounded,
          title: 'No permission',
          subtitle:
              "You don't have access to view staff attendance.",
        ),
      );
    }

    final attendanceAsync = ref.watch(allAttendanceDateProvider(_dateKey));
    final usersAsync = ref.watch(allUsersProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Staff Attendance'),
        actions: [
          ListenableBuilder(
            listenable: _tabController,
            builder: (context, _) {
              if (_tabController.index != 0) return const SizedBox.shrink();
              return Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.download_rounded),
                    tooltip: 'Export CSV',
                    onPressed: () => _exportCsv(context, ref),
                  ),
                  // Date chip
                  GestureDetector(
                    onTap: _pickDate,
                    child: Container(
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.calendar_today_rounded,
                            size: 14,
                            color: AppTheme.primary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _isToday
                                ? 'Today'
                                : DateFormat('d MMM').format(_selectedDate),
                            style: const TextStyle(
                              color: AppTheme.primary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textMuted,
          indicatorColor: AppTheme.primary,
          tabs: const [
            Tab(text: 'Daily'),
            Tab(text: 'Overtime'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          usersAsync.when(
            loading: () => const LoadingWidget(),
            error: (e, _) => Center(child: Text('Failed to load staff: $e')),
            data: (users) => attendanceAsync.when(
              loading: () => const LoadingWidget(),
              error: (e, _) => Center(child: Text('Failed to load attendance: $e')),
              data: (records) => _buildBody(context, users, records),
            ),
          ),
          _buildOvertimeTab(),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    List<UserModel> users,
    List<AttendanceModel> records,
  ) {
    // Build a map: userId → latest record for the day
    final Map<String, AttendanceModel> recordByUser = {};
    for (final r in records) {
      final existing = recordByUser[r.userId];
      if (existing == null || r.checkInTime.isAfter(existing.checkInTime)) {
        recordByUser[r.userId] = r;
      }
    }

    // Filter users by role if selected
    Iterable<UserModel> filteredUsers = users;
    if (_selectedRoleId != null) {
      filteredUsers = users.where((u) => u.roleId == _selectedRoleId);
    }

    // Partition users
    final onSite = <UserModel>[];
    final checkedOut = <UserModel>[];
    final absent = <UserModel>[];

    for (final u in filteredUsers) {
      if (!u.isActive) continue;
      final rec = recordByUser[u.uid];
      if (rec == null) {
        absent.add(u);
      } else if (rec.isOnSite) {
        onSite.add(u);
      } else {
        checkedOut.add(u);
      }
    }

    if (filteredUsers.where((u) => u.isActive).isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.people_outline_rounded,
        title: 'No staff found',
        subtitle: 'Add team members in User Management.',
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(allAttendanceDateProvider(_dateKey));
        ref.invalidate(allUsersProvider);
      },
      child: CustomScrollView(
        slivers: [
          // ── Filter & Summary strip ──────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _RoleFilterDropdown(
                selectedRoleId: _selectedRoleId,
                onChanged: (val) {
                  if (mounted) {
                    setState(() => _selectedRoleId = val);
                  }
                },
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: _SummaryStrip(
              onSite: onSite.length,
              checkedOut: checkedOut.length,
              absent: absent.length,
              isToday: _isToday,
            ),
          ),

          // ── On-Site section ─────────────────────────────────────────────
          if (onSite.isNotEmpty) ...[
            _sectionHeader(
              _isToday ? 'On Site Now' : 'Checked In',
              onSite.length,
              AppTheme.success,
              Icons.location_on_rounded,
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _StaffAttendanceCard(
                  user: onSite[i],
                  record: recordByUser[onSite[i].uid],
                  isToday: _isToday,
                  onViewHistory: () => _showHistory(context, onSite[i]),
                ),
                childCount: onSite.length,
              ),
            ),
          ],

          // ── Checked-Out section ─────────────────────────────────────────
          if (checkedOut.isNotEmpty) ...[
            _sectionHeader(
              'Checked Out',
              checkedOut.length,
              AppTheme.info,
              Icons.logout_rounded,
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _StaffAttendanceCard(
                  user: checkedOut[i],
                  record: recordByUser[checkedOut[i].uid],
                  isToday: _isToday,
                  onViewHistory: () => _showHistory(context, checkedOut[i]),
                ),
                childCount: checkedOut.length,
              ),
            ),
          ],

          // ── Absent section ──────────────────────────────────────────────
          if (absent.isNotEmpty) ...[
            _sectionHeader(
              'Not Checked In',
              absent.length,
              AppTheme.textMuted,
              Icons.person_off_rounded,
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              sliver: SliverGrid.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.85,
                ),
                itemCount: absent.length,
                itemBuilder: (_, i) => _AbsentCard(
                  user: absent[i],
                  onViewHistory: () => _showHistory(context, absent[i]),
                ),
              ),
            ),
          ],

          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  SliverToBoxAdapter _sectionHeader(
    String label,
    int count,
    Color color,
    IconData icon,
  ) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              ),
              child: Icon(icon, size: 14, color: color),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
                letterSpacing: 0.4,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showHistory(BuildContext context, UserModel user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _UserHistorySheet(user: user),
    );
  }

  Future<void> _exportCsv(BuildContext context, WidgetRef ref) async {
    final usersAsync = ref.read(allUsersProvider);
    final recordsAsync = ref.read(allAttendanceDateProvider(_dateKey));

    if (usersAsync.value == null || recordsAsync.value == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Data is still loading, please wait.')),
      );
      return;
    }

    final users = usersAsync.value!;
    final records = recordsAsync.value!;

    final Map<String, AttendanceModel> recordByUser = {};
    for (final r in records) {
      final existing = recordByUser[r.userId];
      if (existing == null || r.checkInTime.isAfter(existing.checkInTime)) {
        recordByUser[r.userId] = r;
      }
    }

    Iterable<UserModel> filteredUsers = users.where((u) => u.isActive);
    if (_selectedRoleId != null) {
      filteredUsers = filteredUsers.where((u) => u.roleId == _selectedRoleId);
    }

    final rows = <List<String>>[
      ['Name', 'Status', 'Check In', 'Check Out', 'Total Hours', 'Overtime Hours']
    ];

    for (final u in filteredUsers) {
      final r = recordByUser[u.uid];
      String status = 'Absent';
      String checkIn = '-';
      String checkOut = '-';
      String totalH = '0';
      String overH = '0';

      if (r != null) {
        status = r.isOnSite ? 'On Site' : 'Checked Out';
        checkIn = DateFormat('hh:mm a').format(r.checkInTime);
        if (r.checkOutTime != null) {
          checkOut = DateFormat('hh:mm a').format(r.checkOutTime!);
        }

        final tH = r.durationMinutes ~/ 60;
        final tM = r.durationMinutes % 60;
        totalH = '${tH}h ${tM}m';

        final oH = r.overtimeMinutes ~/ 60;
        final oM = r.overtimeMinutes % 60;
        overH = '${oH}h ${oM}m';
      }

      rows.add([
        u.name,
        status,
        checkIn,
        checkOut,
        totalH,
        overH,
      ]);
    }

    try {
      final csv = const ListToCsvConverter().convert(rows);
      final dir = await getApplicationDocumentsDirectory();
      final fileName = 'attendance_${_dateKey}.csv';
      final file = File('${dir.path}/$fileName');
      await file.writeAsString(csv);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Exported to ${file.path}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to export CSV: $e')),
        );
      }
    }
  }

  Widget _buildOvertimeTab() {
    final usersAsync = ref.watch(allUsersProvider);
    final month = DateFormat('yyyy-MM').format(_overtimeMonth);
    
    return usersAsync.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (users) {
        var activeUsers = users.where((u) => u.isActive).toList();
        if (_selectedRoleId != null) {
          activeUsers = activeUsers.where((u) => u.roleId == _selectedRoleId).toList();
        }
        
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Month selector
            _buildMonthSelector(),
            const SizedBox(height: 12),
            // Role filter
            _RoleFilterDropdown(
              selectedRoleId: _selectedRoleId,
              onChanged: (val) => setState(() => _selectedRoleId = val),
            ),
            const SizedBox(height: 16),
            // Staff overtime cards
            ...activeUsers.map((user) => _OvertimeStaffRow(
              user: user,
              month: month,
              onTap: () => _showHistory(context, user),
            )),
          ],
        );
      },
    );
  }

  Widget _buildMonthSelector() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left_rounded),
          onPressed: () => setState(() {
            _overtimeMonth = DateTime(_overtimeMonth.year, _overtimeMonth.month - 1);
          }),
        ),
        GestureDetector(
          onTap: () async {
            // Could add a month picker here
          },
          child: Text(
            DateFormat('MMMM yyyy').format(_overtimeMonth),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppTheme.primary,
            ),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.chevron_right_rounded),
          onPressed: () {
            final now = DateTime.now();
            if (_overtimeMonth.year < now.year || (_overtimeMonth.year == now.year && _overtimeMonth.month < now.month)) {
              setState(() {
                _overtimeMonth = DateTime(_overtimeMonth.year, _overtimeMonth.month + 1);
              });
            }
          },
        ),
      ],
    );
  }
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

class _SummaryStrip extends StatelessWidget {
  final int onSite;
  final int checkedOut;
  final int absent;
  final bool isToday;

  const _SummaryStrip({
    required this.onSite,
    required this.checkedOut,
    required this.absent,
    required this.isToday,
  });

  @override
  Widget build(BuildContext context) {
    final total = onSite + checkedOut + absent;
    final present = onSite + checkedOut;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, AppTheme.primaryMid],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.24),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.groups_rounded, color: Colors.white70, size: 18),
              const SizedBox(width: 8),
              Text(
                isToday ? 'Today\'s Attendance' : 'Attendance Summary',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                '$present / $total',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 4),
              const Text(
                'present',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : present / total,
              minHeight: 6,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accent),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _StatPill(
                icon: Icons.location_on_rounded,
                label: isToday ? 'On Site' : 'Checked In',
                value: onSite,
                color: AppTheme.success,
              ),
              const SizedBox(width: 8),
              _StatPill(
                icon: Icons.logout_rounded,
                label: 'Left',
                value: checkedOut,
                color: AppTheme.info,
              ),
              const SizedBox(width: 8),
              _StatPill(
                icon: Icons.person_off_rounded,
                label: 'Absent',
                value: absent,
                color: Colors.white54,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final int value;
  final Color color;

  const _StatPill({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(height: 4),
            Text(
              '$value',
              style: TextStyle(
                color: color,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: Colors.white60, fontSize: 10),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Staff Attendance Card (On-Site / Checked-Out) ────────────────────────────

class _StaffAttendanceCard extends StatelessWidget {
  final UserModel user;
  final AttendanceModel? record;
  final bool isToday;
  final VoidCallback onViewHistory;

  const _StaffAttendanceCard({
    required this.user,
    required this.record,
    required this.isToday,
    required this.onViewHistory,
  });

  @override
  Widget build(BuildContext context) {
    final rec = record!;
    final isOnSite = rec.isOnSite;
    final statusColor = isOnSite ? AppTheme.success : AppTheme.info;
    final checkInStr = DateFormat('h:mm a').format(rec.checkInTime);
    final checkOutStr = rec.checkOutTime != null
        ? DateFormat('h:mm a').format(rec.checkOutTime!)
        : null;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          onTap: onViewHistory,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Avatar with status dot
                Stack(
                  children: [
                    AvatarWidget(
                      name: user.name,
                      imageUrl: user.avatarUrl,
                      size: 44,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: AppTheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 3),
                      // Time row
                      Row(
                        children: [
                          _TimeChip(
                            icon: Icons.login_rounded,
                            time: checkInStr,
                            color: AppTheme.success,
                          ),
                          if (checkOutStr != null) ...[
                            const SizedBox(width: 6),
                            _TimeChip(
                              icon: Icons.logout_rounded,
                              time: checkOutStr,
                              color: AppTheme.info,
                            ),
                          ],
                          if (isOnSite) ...[
                            const SizedBox(width: 6),
                            _LiveTimer(checkInTime: rec.checkInTime),
                          ],
                          if (!isOnSite) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.primary.withValues(alpha: 0.06),
                                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                              ),
                              child: Text(
                                rec.durationFormatted,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.primary,
                                ),
                              ),
                            ),
                          ],
                          if (rec.overtimeMinutes > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.warning.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                              ),
                              child: Text(
                                'OT: ${rec.overtimeFormatted}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.warning,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      // Location
                      if (rec.checkInAddress != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.login_rounded,
                              size: 11,
                              color: AppTheme.textMuted,
                            ),
                            const SizedBox(width: 3),
                            Flexible(
                              child: Text(
                                'In: ${rec.checkInAddress!}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textMuted,
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
                              Icons.login_rounded,
                              size: 11,
                              color: AppTheme.textLight,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              'In: ${_formatGeoPoint(rec.checkInLocation)}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.textLight,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (rec.checkOutTime != null) ...[
                        if (rec.checkOutAddress != null) ...[
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.logout_rounded,
                                size: 11,
                                color: AppTheme.textMuted,
                              ),
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text(
                                  'Out: ${rec.checkOutAddress!}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.textMuted,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ] else if (rec.checkOutLocation != null) ...[
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.logout_rounded,
                                size: 11,
                                color: AppTheme.textLight,
                              ),
                              const SizedBox(width: 3),
                              Text(
                                'Out: ${_formatGeoPoint(rec.checkOutLocation!)}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textLight,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                      // Out-of-geofence badge
                      if (!rec.isWithinGeofence) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.error.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                          ),
                          child: const Row(
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
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppTheme.textLight,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatGeoPoint(GeoPoint gp) =>
      '${gp.latitude.toStringAsFixed(4)}, ${gp.longitude.toStringAsFixed(4)}';
}

// ─── Role Filter Dropdown ─────────────────────────────────────────────────────

class _RoleFilterDropdown extends ConsumerWidget {
  final String? selectedRoleId;
  final ValueChanged<String?> onChanged;

  const _RoleFilterDropdown({
    required this.selectedRoleId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rolesAsync = ref.watch(allRolesProvider);

    return rolesAsync.when(
      data: (roles) {
        if (roles.isEmpty) return const SizedBox.shrink();
        return DropdownButtonFormField<String?>(
          value: selectedRoleId,
          decoration: InputDecoration(
            labelText: 'Filter by Role',
            prefixIcon: const Icon(Icons.badge_outlined),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              borderSide: const BorderSide(color: AppTheme.divider),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              borderSide: const BorderSide(color: AppTheme.divider),
            ),
          ),
          items: [
            const DropdownMenuItem<String?>(
              value: null,
              child: Text('All Roles'),
            ),
            ...roles.map((role) {
              return DropdownMenuItem<String?>(
                value: role.id,
                child: Text(role.name),
              );
            }),
          ],
          onChanged: onChanged,
        );
      },
      loading: () => const LinearProgressIndicator(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

// ─── Absent Card (grid) ───────────────────────────────────────────────────────

class _AbsentCard extends StatelessWidget {
  final UserModel user;
  final VoidCallback onViewHistory;

  const _AbsentCard({required this.user, required this.onViewHistory});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onViewHistory,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(color: AppTheme.divider),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ColorFiltered(
              colorFilter: const ColorFilter.matrix([
                0.2126,
                0.7152,
                0.0722,
                0,
                0,
                0.2126,
                0.7152,
                0.0722,
                0,
                0,
                0.2126,
                0.7152,
                0.0722,
                0,
                0,
                0,
                0,
                0,
                0.5,
                0,
              ]),
              child: AvatarWidget(
                name: user.name,
                imageUrl: user.avatarUrl,
                size: 40,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              user.name.split(' ').first,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.textMuted,
              ),
            ),
            const SizedBox(height: 2),
            const Text(
              'Absent',
              style: TextStyle(fontSize: 9, color: AppTheme.textLight),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Live Timer chip (ticks while user is on site today) ─────────────────────

class _LiveTimer extends StatefulWidget {
  final DateTime checkInTime;
  const _LiveTimer({required this.checkInTime});

  @override
  State<_LiveTimer> createState() => _LiveTimerState();
}

class _LiveTimerState extends State<_LiveTimer> {
  late final Stream<DateTime> _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Stream.periodic(
      const Duration(seconds: 30),
      (_) => DateTime.now(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DateTime>(
      stream: _ticker,
      initialData: DateTime.now(),
      builder: (_, snap) {
        final elapsed = snap.data!.difference(widget.checkInTime);
        final h = elapsed.inHours;
        final m = elapsed.inMinutes % 60;
        final label = h > 0 ? '${h}h ${m}m' : '${m}m';
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppTheme.success.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppTheme.radiusXs),
          ),
          child: Row(
            children: [
              Container(
                width: 5,
                height: 5,
                decoration: const BoxDecoration(
                  color: AppTheme.success,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.success,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Time Chip ────────────────────────────────────────────────────────────────

class _TimeChip extends StatelessWidget {
  final IconData icon;
  final String time;
  final Color color;
  const _TimeChip({
    required this.icon,
    required this.time,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 10, color: color),
        const SizedBox(width: 3),
        Text(
          time,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }
}

// ─── User History Bottom Sheet ────────────────────────────────────────────────

class _UserHistorySheet extends ConsumerStatefulWidget {
  final UserModel user;
  const _UserHistorySheet({required this.user});

  @override
  ConsumerState<_UserHistorySheet> createState() => _UserHistorySheetState();
}

class _UserHistorySheetState extends ConsumerState<_UserHistorySheet> {
  DateTime _month = DateTime.now();

  String get _startDate => '${DateFormat('yyyy-MM').format(_month)}-01';
  String get _endDate => '${DateFormat('yyyy-MM').format(_month)}-31';

  void _prevMonth() =>
      setState(() => _month = DateTime(_month.year, _month.month - 1));
  void _nextMonth() {
    final next = DateTime(_month.year, _month.month + 1);
    if (next.isAfter(DateTime.now())) return;
    setState(() => _month = next);
  }

  @override
  Widget build(BuildContext context) {
    final recordsAsync = ref.watch(
      userAttendanceRangeProvider((
        userId: widget.user.uid,
        startDate: _startDate,
        endDate: _endDate,
      )),
    );

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (_, sc) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
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
                  color: AppTheme.divider,
                  borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                ),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Row(
                children: [
                  AvatarWidget(
                    name: widget.user.name,
                    imageUrl: widget.user.avatarUrl,
                    size: 40,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.user.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          widget.user.email,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Month nav
                  Row(
                    children: [
                      IconButton(
                        onPressed: _prevMonth,
                        icon: const Icon(Icons.chevron_left_rounded),
                        iconSize: 20,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('MMM yyyy').format(_month),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        onPressed: _nextMonth,
                        icon: const Icon(Icons.chevron_right_rounded),
                        iconSize: 20,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        color:
                            DateTime(
                              _month.year,
                              _month.month + 1,
                            ).isAfter(DateTime.now())
                            ? AppTheme.textLight
                            : AppTheme.onSurface,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Content
            Expanded(
              child: recordsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Error: $e')),
                data: (records) => _buildHistoryContent(sc, records),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryContent(
    ScrollController sc,
    List<AttendanceModel> records,
  ) {
    // Stats
    final presentDays = records.length;
    final totalMinutes = records.fold<int>(
      0,
      (acc, r) => acc + r.durationMinutes,
    );
    final avgMinutes = presentDays == 0 ? 0 : totalMinutes ~/ presentDays;
    final totalHours = totalMinutes / 60;
    final totalOvertimeMins = records.fold<int>(
      0,
      (acc, r) => acc + r.overtimeMinutes,
    );
    final oH = totalOvertimeMins ~/ 60;
    final oM = totalOvertimeMins % 60;

    String formatMinutes(int minutes) {
      final h = minutes ~/ 60;
      final m = minutes % 60;
      if (h == 0) return '${m}m';
      if (m == 0) return '${h}h';
      return '${h}h ${m}m';
    }

    return ListView(
      controller: sc,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        // ── Monthly stats ──────────────────────────────────────────────
        Row(
          children: [
            _MonthStat(
              label: 'Days Present',
              value: '$presentDays',
              icon: Icons.calendar_month_rounded,
              color: AppTheme.success,
            ),
            const SizedBox(width: 8),
            _MonthStat(
              label: 'Avg Hours',
              value: formatMinutes(avgMinutes),
              icon: Icons.access_time_rounded,
              color: AppTheme.primary,
            ),
            const SizedBox(width: 8),
            _MonthStat(
              label: 'Total Hours',
              value: '${totalHours.toStringAsFixed(1)}h',
              icon: Icons.timer_rounded,
              color: AppTheme.accent,
            ),
            const SizedBox(width: 8),
            _MonthStat(
              label: 'Total Overtime',
              value: '${oH}h ${oM}m',
              icon: Icons.more_time_rounded,
              color: totalOvertimeMins > 0 ? AppTheme.warning : AppTheme.textMuted,
            ),
          ],
        ),

        const SizedBox(height: 16),

        // ── Calendar grid ──────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: AppTheme.divider),
          ),
          child: _AttendanceCalendar(month: _month, records: records),
        ),

        const SizedBox(height: 16),

        // ── Daily records list ─────────────────────────────────────────
        if (records.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text(
                'No attendance records this month.',
                style: TextStyle(color: AppTheme.textMuted),
              ),
            ),
          )
        else
          ...records.map((r) => _AttendanceDayTile(record: r, user: widget.user)),
      ],
    );
  }
}

class _MonthStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MonthStat({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(color: AppTheme.divider),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Attendance Calendar Grid ─────────────────────────────────────────────────

class _AttendanceCalendar extends StatelessWidget {
  final DateTime month;
  final List<AttendanceModel> records;

  const _AttendanceCalendar({required this.month, required this.records});

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final startOffset = (firstDay.weekday - 1) % 7;
    final today = DateTime.now();

    final Map<String, AttendanceModel> byDate = {
      for (final r in records) r.date: r,
    };

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Column(
      children: [
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

            Color bgColor;
            Color textColor;
            Border? border;

            if (isToday) {
              bgColor = AppTheme.brand.withValues(alpha: 0.16);
              textColor = AppTheme.brand;
              border = Border.all(color: AppTheme.brand, width: 1.5);
            } else if (isFuture || record == null) {
              bgColor = AppTheme.background;
              textColor = isFuture ? AppTheme.textLight : AppTheme.textMuted;
              border = null;
            } else if (record.checkOutTime != null) {
              bgColor = AppTheme.success.withValues(alpha: 0.16);
              textColor = AppTheme.success;
              border = Border.all(
                color: AppTheme.success.withValues(alpha: 0.31),
              );
            } else {
              bgColor = AppTheme.accent.withValues(alpha: 0.16);
              textColor = AppTheme.accentDark;
              border = Border.all(
                color: AppTheme.accent.withValues(alpha: 0.31),
              );
            }

            return Container(
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                border: border,
              ),
              child: Stack(
                children: [
                  Center(
                    child: Text(
                      '$day',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
                        color: textColor,
                      ),
                    ),
                  ),
                  if (record != null && record.overtimeMinutes > 0)
                    Positioned(
                      bottom: 2,
                      right: 2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppTheme.warning,
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: const Text(
                          'OT',
                          style: TextStyle(
                            fontSize: 6,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        // Legend
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            _LegendDot(color: AppTheme.success, label: 'Full Day'),
            SizedBox(width: 14),
            _LegendDot(color: AppTheme.accent, label: 'Partial'),
            SizedBox(width: 14),
            _LegendDot(color: AppTheme.brand, label: 'Today'),
          ],
        ),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.31),
            borderRadius: BorderRadius.circular(2),
            border: Border.all(color: color.withValues(alpha: 0.55)),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
        ),
      ],
    );
  }
}

// ─── Attendance Day Tile ──────────────────────────────────────────────────────

class _AttendanceDayTile extends ConsumerWidget {
  final AttendanceModel record;
  final UserModel? user;
  const _AttendanceDayTile({required this.record, this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = DateFormat('EEE, d MMM').format(record.checkInTime);
    final inTime = DateFormat('h:mm a').format(record.checkInTime);
    final outTime = record.checkOutTime != null
        ? DateFormat('h:mm a').format(record.checkOutTime!)
        : null;
    final isComplete = outTime != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
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
              Container(
                width: 4,
                height: 36,
                decoration: BoxDecoration(
                  color: isComplete ? AppTheme.success : AppTheme.accent,
                  borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      date,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        _TimeChip(
                          icon: Icons.login_rounded,
                          time: inTime,
                          color: AppTheme.success,
                        ),
                        if (outTime != null) ...[
                          const SizedBox(width: 10),
                          _TimeChip(
                            icon: Icons.logout_rounded,
                            time: outTime,
                            color: AppTheme.info,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              // Duration, OT badge, & Edit Button
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: isComplete
                              ? AppTheme.success.withValues(alpha: 0.08)
                              : AppTheme.accent.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                        ),
                        child: Text(
                          isComplete ? record.durationFormatted : 'On Site',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isComplete ? AppTheme.success : AppTheme.accent,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 16, color: AppTheme.primary),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        tooltip: 'Edit Record & Overtime',
                        onPressed: () => _showEditAttendanceSheet(context, ref, record, user: user),
                      ),
                    ],
                  ),
                  if (record.overtimeMinutes > 0) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                      ),
                      child: Text(
                        record.overtimeOverrideMinutes != null
                            ? 'OT: ${record.overtimeFormatted} (Manual)'
                            : 'OT: ${record.overtimeFormatted}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.warning,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          // Locations
          if (record.checkInAddress != null ||
              record.checkOutAddress != null) ...[
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
            if (record.checkInAddress != null)
              _LocationRow(
                icon: Icons.login_rounded,
                label: 'In:',
                address: record.checkInAddress!,
                color: AppTheme.success,
              ),
            if (record.checkOutAddress != null) ...[
              const SizedBox(height: 4),
              _LocationRow(
                icon: Icons.logout_rounded,
                label: 'Out:',
                address: record.checkOutAddress!,
                color: AppTheme.info,
              ),
            ],
          ],
          // Geofence warning
          if (!record.isWithinGeofence) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.error.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    size: 11,
                    color: AppTheme.error,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Checked in outside geofence',
                    style: TextStyle(
                      fontSize: 10,
                      color: AppTheme.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

Future<void> _showEditAttendanceSheet(
  BuildContext context,
  WidgetRef ref,
  AttendanceModel record, {
  UserModel? user,
}) async {
  DateTime checkIn = record.checkInTime;
  DateTime? checkOut = record.checkOutTime;
  final otController = TextEditingController(
    text: record.overtimeOverrideMinutes?.toString() ?? '',
  );

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setSheetState) {
        final dateStr = DateFormat('EEE, dd MMM yyyy').format(record.checkInTime);
        final inTimeStr = DateFormat('hh:mm a').format(checkIn);
        final outTimeStr = checkOut != null ? DateFormat('hh:mm a').format(checkOut!) : 'Not set';

        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusMd)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppTheme.divider,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.edit_calendar_rounded, color: AppTheme.primary, size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'Edit Attendance & Overtime',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.onSurface,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  user != null ? '${user.name} • $dateStr' : dateStr,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
                const SizedBox(height: 20),
                // Check-in and Check-out time pickers
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showTimePicker(
                            context: ctx,
                            initialTime: TimeOfDay.fromDateTime(checkIn),
                          );
                          if (picked != null) {
                            setSheetState(() {
                              checkIn = DateTime(
                                checkIn.year,
                                checkIn.month,
                                checkIn.day,
                                picked.hour,
                                picked.minute,
                              );
                            });
                          }
                        },
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppTheme.divider),
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Check-In Time', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                              const SizedBox(height: 4),
                              Text(inTimeStr, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final initial = checkOut != null ? TimeOfDay.fromDateTime(checkOut!) : TimeOfDay.fromDateTime(checkIn.add(const Duration(hours: 8)));
                          final picked = await showTimePicker(
                            context: ctx,
                            initialTime: initial,
                          );
                          if (picked != null) {
                            setSheetState(() {
                              checkOut = DateTime(
                                checkIn.year,
                                checkIn.month,
                                checkIn.day,
                                picked.hour,
                                picked.minute,
                              );
                            });
                          }
                        },
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppTheme.divider),
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Check-Out Time', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                              const SizedBox(height: 4),
                              Text(outTimeStr, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Overtime Override
                const Text(
                  'Overtime Override (Minutes)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: otController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: 'e.g. 60 (leave empty for auto 8h calculation)',
                    hintStyle: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                    filled: true,
                    fillColor: AppTheme.surfaceAlt,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      borderSide: const BorderSide(color: AppTheme.divider),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    suffixIcon: otController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 16),
                            onPressed: () {
                              setSheetState(() {
                                otController.clear();
                              });
                            },
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          final updates = <String, dynamic>{
                            'checkInTime': AppDateUtils.toTimestamp(checkIn),
                          };
                          if (checkOut != null) {
                            updates['checkOutTime'] = AppDateUtils.toTimestamp(checkOut!);
                          }
                          if (otController.text.trim().isNotEmpty) {
                            final ot = int.tryParse(otController.text.trim());
                            if (ot != null) {
                              updates['overtimeOverrideMinutes'] = ot;
                            }
                          } else {
                            // Supabase clears a column with null (FieldValue is
                            // a Firestore-only construct and can't be encoded).
                            updates['overtimeOverrideMinutes'] = null;
                          }

                          try {
                            await ref.read(attendanceRepositoryProvider).updateAttendance(record.id, updates);
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Attendance and overtime updated')),
                              );
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to update: $e')),
                              );
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                        ),
                        child: const Text('Save Changes'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _LocationRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String address;
  final Color color;
  const _LocationRow({
    required this.icon,
    required this.label,
    required this.address,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            address,
            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _OvertimeStaffRow extends ConsumerWidget {
  final UserModel user;
  final String month;
  final VoidCallback? onTap;

  const _OvertimeStaffRow({
    required this.user,
    required this.month,
    this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(
      userMonthAttendanceProvider((userId: user.uid, month: month)),
    );

    return attendanceAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (records) {
        int totalOvertimeMins = 0;
        int daysWithOt = 0;
        for (final r in records) {
          if (r.overtimeMinutes > 0) {
            totalOvertimeMins += r.overtimeMinutes;
            daysWithOt++;
          }
        }

        // Don't show staff with zero overtime
        if (totalOvertimeMins == 0) return const SizedBox.shrink();

        final oH = totalOvertimeMins ~/ 60;
        final oM = totalOvertimeMins % 60;

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: AppTheme.divider),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            child: InkWell(
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    AvatarWidget(
                      name: user.name,
                      imageUrl: user.avatarUrl,
                      size: 40,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: AppTheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$daysWithOt day${daysWithOt == 1 ? '' : 's'} with overtime',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                      ),
                      child: Text(
                        '${oH}h ${oM}m',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.warning,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: AppTheme.textLight,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
