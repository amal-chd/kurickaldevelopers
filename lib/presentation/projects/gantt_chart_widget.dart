import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../app/theme.dart';
import '../../core/utils/date_utils.dart';
import '../../data/models/milestone_model.dart';

class GanttChartWidget extends StatelessWidget {
  final List<MilestoneModel> milestones;
  final DateTime startDate;
  final DateTime endDate;

  const GanttChartWidget({
    super.key,
    required this.milestones,
    required this.startDate,
    required this.endDate,
  });

  @override
  Widget build(BuildContext context) {
    if (milestones.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.alt_route_rounded,
                color: AppTheme.primary,
                size: 32,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'No Milestones Defined',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppTheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Milestones help map the visual project timeline.',
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.textMuted,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    final totalDays = AppDateUtils.daysBetween(
      startDate,
      endDate,
    ).clamp(1, 9999).toDouble();

    final screenWidth = MediaQuery.of(context).size.width - 64.0;
    // Scale dynamically: expand if project duration is short, scroll horizontally if long
    final widthPerDay = (screenWidth / totalDays).clamp(14.0, 36.0);
    final canvasWidth = totalDays * widthPerDay;

    final now = DateTime.now();
    final todayOffset = AppDateUtils.daysBetween(
      startDate,
      now,
    ).clamp(0.0, totalDays);

    // Determine grid line interval (7 days for short projects, 14 for mid, 30 for long)
    final double gridInterval = totalDays <= 30
        ? 7.0
        : totalDays <= 90
            ? 14.0
            : 30.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Elegant Status Legend ─────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _buildLegendItem(AppTheme.success, 'Completed'),
              _buildLegendItem(AppTheme.accent, 'In Progress'),
              _buildLegendItem(AppTheme.error, 'Delayed'),
              _buildLegendItem(AppTheme.textLight, 'Pending'),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // ── Scrollable Timeline Canvas ────────────────────────────────────────
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: SizedBox(
            width: canvasWidth + 32.0, // padded width
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // 1. Background Grid Lines & Date Labels
                  Positioned.fill(
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: List.generate((totalDays / gridInterval).ceil() + 1, (index) {
                        final dayPos = index * gridInterval;
                        if (dayPos > totalDays) return const SizedBox.shrink();
                        
                        final leftOffset = dayPos * widthPerDay;
                        final dateAtPos = startDate.add(Duration(days: dayPos.toInt()));

                        return Positioned(
                          left: leftOffset,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            width: 1,
                            color: AppTheme.divider.withValues(alpha: 0.6),
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Positioned(
                                  top: -18,
                                  left: -24,
                                  right: -24,
                                  child: Text(
                                    DateFormat('dd MMM').format(dateAtPos),
                                    style: const TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textLight,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ),
                  ),

                  // 2. Cascade of Milestones
                  Padding(
                    padding: const EdgeInsets.only(top: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: List.generate(milestones.length, (index) {
                        final m = milestones[index];
                        
                        // Milestone waterfall bar calculation
                        final barEndDay = AppDateUtils.daysBetween(startDate, m.dueDate).clamp(0.0, totalDays);
                        // Approximate phase duration (e.g. 15% of total, min 5 days, max 30 days)
                        final milestoneDuration = (totalDays * 0.15).clamp(5.0, 30.0);
                        final barStartDay = (barEndDay - milestoneDuration).clamp(0.0, totalDays);
                        
                        final leftOffset = barStartDay * widthPerDay;
                        final barWidth = ((barEndDay - barStartDay) * widthPerDay).clamp(40.0, canvasWidth);

                        final color = _colorForMilestoneStatus(m.status);
                        final gradient = _gradientForMilestoneStatus(m.status);

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Text Title above the bar row
                              Row(
                                children: [
                                  Text(
                                    m.name,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: AppTheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      m.phase.label,
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: color,
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    'Due ${DateFormat('dd MMM').format(m.dueDate)}',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppTheme.textMuted,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              // Progress Track Stack
                              SizedBox(
                                height: 20,
                                child: Stack(
                                  children: [
                                    // Track bar (Background)
                                    Positioned(
                                      left: leftOffset,
                                      child: Container(
                                        width: barWidth,
                                        height: 20,
                                        decoration: BoxDecoration(
                                          color: AppTheme.divider.withValues(alpha: 0.4),
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                      ),
                                    ),
                                    // Progress bar (Filled)
                                    Positioned(
                                      left: leftOffset,
                                      child: Container(
                                        width: barWidth * (m.progressPercent / 100.0).clamp(0.0, 1.0),
                                        height: 20,
                                        decoration: BoxDecoration(
                                          gradient: gradient,
                                          borderRadius: BorderRadius.circular(10),
                                          boxShadow: [
                                            BoxShadow(
                                              color: color.withValues(alpha: 0.2),
                                              blurRadius: 6,
                                              offset: const Offset(0, 2),
                                            ),
                                          ],
                                        ),
                                        alignment: Alignment.centerRight,
                                        padding: const EdgeInsets.only(right: 8),
                                        child: m.progressPercent >= 20
                                            ? Text(
                                                '${m.progressPercent}%',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              )
                                            : null,
                                      ),
                                    ),
                                    // Outside percentage indicator if too small to fit inside
                                    if (m.progressPercent < 20)
                                      Positioned(
                                        left: leftOffset + (barWidth * (m.progressPercent / 100.0)) + 6,
                                        top: 0,
                                        bottom: 0,
                                        child: Center(
                                          child: Text(
                                            '${m.progressPercent}%',
                                            style: TextStyle(
                                              color: color,
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ),
                  ),

                  // 3. Living "Today" Vertical Indicator Line
                  Positioned(
                    left: todayOffset * widthPerDay,
                    top: -12,
                    bottom: -8,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Dotted today line
                        CustomPaint(
                          size: const Size(2, double.infinity),
                          painter: DottedLinePainter(color: AppTheme.error),
                        ),
                        // TODAY Pill Badge at top
                        Positioned(
                          top: -16,
                          left: -20,
                          right: -20,
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.error,
                                borderRadius: BorderRadius.circular(100),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.error.withValues(alpha: 0.3),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Text(
                                'TODAY',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: AppTheme.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Color _colorForMilestoneStatus(MilestoneStatus status) {
    switch (status) {
      case MilestoneStatus.completed:
        return AppTheme.success;
      case MilestoneStatus.inProgress:
        return AppTheme.accent;
      case MilestoneStatus.delayed:
        return AppTheme.error;
      case MilestoneStatus.pending:
        return AppTheme.textLight;
    }
  }

  LinearGradient _gradientForMilestoneStatus(MilestoneStatus status) {
    switch (status) {
      case MilestoneStatus.completed:
        return const LinearGradient(
          colors: [Color(0xFF10B981), Color(0xFF059669)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
      case MilestoneStatus.inProgress:
        return const LinearGradient(
          colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
      case MilestoneStatus.delayed:
        return const LinearGradient(
          colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
      case MilestoneStatus.pending:
        return const LinearGradient(
          colors: [Color(0xFF94A3B8), Color(0xFF64748B)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        );
    }
  }
}

class DottedLinePainter extends CustomPainter {
  final Color color;
  final double dashHeight;
  final double dashSpace;
  final double strokeWidth;

  DottedLinePainter({
    required this.color,
    this.dashHeight = 6,
    this.dashSpace = 4,
    this.strokeWidth = 1.5,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    double startY = 0;
    while (startY < size.height) {
      canvas.drawLine(
        Offset(size.width / 2, startY),
        Offset(size.width / 2, startY + dashHeight),
        paint,
      );
      startY += dashHeight + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant DottedLinePainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.dashHeight != dashHeight ||
        oldDelegate.dashSpace != dashSpace ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
