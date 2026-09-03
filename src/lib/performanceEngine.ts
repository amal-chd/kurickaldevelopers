import { Task, PerformanceScore, PerformanceReview, PerformanceConfig, Attendance } from '../types';
import { Timestamp } from 'firebase/firestore';

// Dates reach this engine as Firestore Timestamps (app reads) OR plain JS Date /
// ISO strings (Supabase recalc path). Coerce any of them — or null — to a Date
// safely, so `.toDate()` on a non-Timestamp never crashes the whole calculation.
const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Default config values
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  priorityWeights: {
    critical: 50,
    high: 35,
    medium: 20,
    low: 10,
  },
  penalties: {
    latePerDay: 3,
    deadlineExtension: 5,
    rejection: 15,
    reopening: 10,
    missedDeadline: 5,
    inactivityPerDay: 2,
  },
  bonuses: {
    streakBonus5: 1.10, // +10%
    streakBonus10: 1.20, // +20%
    streakBonus25: 1.35, // +35%
    onTimeBonus: 5,
    collaborationBonus: 10,
  },
  scoreWeights: {
    productivity: 0.25,
    reliability: 0.25,
    efficiency: 0.20,
    quality: 0.20,
    collaboration: 0.10,
  },
  roleDifficultyMultipliers: {
    // Normalization multipliers for different roles (adjust as needed)
    'director': 1.0,
    'project_manager': 1.2,
    'site_engineer': 1.1,
    'foreman': 1.0,
    'labour': 0.9,
    'admin': 1.0,
  },
  updatedAt: Timestamp.now(),
  updatedBy: 'system',
};

// Helper to get week start date string (for weekly grouping in anti-gaming logic)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function calculatePerformanceScore(
  userId: string,
  userTasks: Task[],
  reviews: PerformanceReview[],
  attendanceList: Attendance[],
  config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG,
  roleId: string = ''
): PerformanceScore {
  const completedTasks = userTasks.filter(t => t.status === 'done');
  const assignedTasks = userTasks;

  // 1. Completion count by priority
  const completedByPriority = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  completedTasks.forEach(t => {
    if (t.priority in completedByPriority) {
      completedByPriority[t.priority as keyof typeof completedByPriority]++;
    }
  });

  // 2. Base points calculation with anti-gaming & complexity multipliers
  let rawPointsEarned = 0;
  
  // Group low-priority completed tasks by week
  const lowPriorityByWeek: Record<string, Task[]> = {};
  const completedWeeks: Record<string, { highCritical: number; total: number }> = {};

  completedTasks.forEach(t => {
    const compDate = toDate(t.updatedAt) ?? new Date();
    const weekKey = getWeekKey(compDate);

    if (!completedWeeks[weekKey]) {
      completedWeeks[weekKey] = { highCritical: 0, total: 0 };
    }
    completedWeeks[weekKey].total++;

    if (t.priority === 'critical' || t.priority === 'high') {
      completedWeeks[weekKey].highCritical++;
    }

    if (t.priority === 'low') {
      if (!lowPriorityByWeek[weekKey]) {
        lowPriorityByWeek[weekKey] = [];
      }
      lowPriorityByWeek[weekKey].push(t);
    } else {
      // Calculate standard points
      const basePoints = config.priorityWeights[t.priority as keyof typeof config.priorityWeights] || 20;
      const complexityMultiplier = t.estimatedHours > 0 ? Math.min(Math.max(t.estimatedHours / 4, 0.5), 3.0) : 1.0;
      rawPointsEarned += basePoints * complexityMultiplier;
    }
  });

  // Apply diminishing returns to weekly low-priority tasks (Anti-Gaming)
  Object.entries(lowPriorityByWeek).forEach(([, tasks]) => {
    tasks.forEach((t, index) => {
      const basePoints = config.priorityWeights.low;
      const complexityMultiplier = t.estimatedHours > 0 ? Math.min(Math.max(t.estimatedHours / 4, 0.5), 3.0) : 1.0;
      const normalPoints = basePoints * complexityMultiplier;

      if (index >= 10) {
        // After 10 completed in a week: only 25% points
        rawPointsEarned += normalPoints * 0.25;
      } else if (index >= 5) {
        // After 5 completed in a week: only 50% points
        rawPointsEarned += normalPoints * 0.50;
      } else {
        rawPointsEarned += normalPoints;
      }
    });
  });

  // Apply 15% bonus for weeks where >= 60% of tasks were high or critical
  let weeklyBonusesCount = 0;
  Object.values(completedWeeks).forEach(week => {
    if (week.total >= 3 && (week.highCritical / week.total) >= 0.60) {
      weeklyBonusesCount++;
    }
  });
  if (weeklyBonusesCount > 0) {
    rawPointsEarned *= (1 + (0.15 * Math.min(weeklyBonusesCount, 4))); // Cap weekly distribution bonus
  }

  // 3. Penalty Calculations & Overdue/Reopened/Rejections
  let totalPenaltyPoints = 0;
  const penaltyBreakdown = {
    lateCompletions: 0,
    deadlineExtensions: 0,
    rejections: 0,
    reopenings: 0,
    missedDeadlines: 0,
    inactivity: 0,
  };

  let tasksCompletedOnTime = 0;
  let tasksCompletedLate = 0;
  let tasksOverdue = 0;
  let tasksRejected = 0;
  let tasksReopened = 0;
  let deadlineExtensions = 0;

  // Chronological sort for streak calculations
  const sortedCompleted = [...completedTasks].sort((a, b) => {
    const timeA = toDate(a.updatedAt)?.getTime() ?? 0;
    const timeB = toDate(b.updatedAt)?.getTime() ?? 0;
    return timeA - timeB;
  });

  let consecutiveSuccesses = 0;
  let bestStreak = 0;

  sortedCompleted.forEach(t => {
    // Reopened tracking
    if ((t as any).reopenedCount && (t as any).reopenedCount > 0) {
      tasksReopened += (t as any).reopenedCount;
      const reopenPen = (t as any).reopenedCount * config.penalties.reopening;
      penaltyBreakdown.reopenings += reopenPen;
      totalPenaltyPoints += reopenPen;
    }

    // Rejections tracking
    if (t.approvalStatus === 'rejected') {
      tasksRejected++;
      penaltyBreakdown.rejections += config.penalties.rejection;
      totalPenaltyPoints += config.penalties.rejection;
    }

    // Deadline extensions tracking
    if ((t as any).deadlineExtensionsCount && (t as any).deadlineExtensionsCount > 0) {
      const extCount = (t as any).deadlineExtensionsCount;
      deadlineExtensions += extCount;
      let extPen = 0;
      for (let i = 1; i <= extCount; i++) {
        if (i === 1) extPen += config.penalties.deadlineExtension;
        else if (i === 2) extPen += 8;
        else extPen += 12;
      }
      penaltyBreakdown.deadlineExtensions += extPen;
      totalPenaltyPoints += extPen;
    }

    // On-time check
    const due = toDate(t.dueDate);
    if (due) {
      const comp = toDate(t.updatedAt) ?? new Date();

      if (comp > due) {
        // Late Completion
        tasksCompletedLate++;
        consecutiveSuccesses = 0; // Break the streak

        const daysLate = Math.ceil((comp.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const latePen = Math.min(daysLate * config.penalties.latePerDay, 30); // Max 30 points penalty
        penaltyBreakdown.lateCompletions += latePen;
        totalPenaltyPoints += latePen;
      } else {
        // On-Time Completion
        tasksCompletedOnTime++;
        consecutiveSuccesses++;
        if (consecutiveSuccesses > bestStreak) {
          bestStreak = consecutiveSuccesses;
        }
      }
    } else {
      // Tasks without due date are considered on-time
      tasksCompletedOnTime++;
      consecutiveSuccesses++;
      if (consecutiveSuccesses > bestStreak) {
        bestStreak = consecutiveSuccesses;
      }
    }
  });

  // Calculate streak bonus multipliers
  let streakMultiplier = 1.0;
  if (consecutiveSuccesses >= 25) {
    streakMultiplier = config.bonuses.streakBonus25;
  } else if (consecutiveSuccesses >= 10) {
    streakMultiplier = config.bonuses.streakBonus10;
  } else if (consecutiveSuccesses >= 5) {
    streakMultiplier = config.bonuses.streakBonus5;
  }
  rawPointsEarned *= streakMultiplier;

  // Active missed deadlines (overdue tasks)
  const now = new Date();
  assignedTasks.forEach(t => {
    const due = toDate(t.dueDate);
    if (t.status !== 'done' && due) {
      if (now > due) {
        tasksOverdue++;
        const daysOverdue = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const overduePen = daysOverdue * config.penalties.missedDeadline;
        penaltyBreakdown.missedDeadlines += overduePen;
        totalPenaltyPoints += overduePen;
      }
    }
  });

  // Inactivity penalty (no completions/updates for more than 3 days)
  let lastActivityDate = now;
  if (userTasks.length > 0) {
    const dates = userTasks.map(t => toDate(t.updatedAt)?.getTime() ?? 0);
    const maxDate = Math.max(...dates);
    if (maxDate > 0) {
      lastActivityDate = new Date(maxDate);
    }
  }
  const inactiveDays = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
  if (inactiveDays > 3) {
    const inactivityPen = (inactiveDays - 3) * config.penalties.inactivityPerDay;
    penaltyBreakdown.inactivity += inactivityPen;
    totalPenaltyPoints += inactivityPen;
  }

  // 4. Time Metrics & Efficiency
  // (accumulated for potential reporting; only the ratio sum feeds the score)
  let _totalEstHours = 0;
  let totalActHours = 0;
  let efficiencyRatiosSum = 0;
  let efficiencyTasksCount = 0;

  completedTasks.forEach(t => {
    // Check member progress for actualHours
    const progress = t.memberProgress?.[userId];
    const actHours = progress?.actualHours || 0;
    
    if (t.estimatedHours > 0 && actHours > 0) {
      _totalEstHours += t.estimatedHours;
      totalActHours += actHours;
      const ratio = t.estimatedHours / actHours;
      efficiencyRatiosSum += Math.min(ratio, 2.0); // Cap individual ratio at 2.0
      efficiencyTasksCount++;
    }
  });

  const avgCompletionHours = completedTasks.length > 0 
    ? parseFloat((totalActHours / completedTasks.length).toFixed(1)) 
    : 0;

  const avgEfficiencyRatio = efficiencyTasksCount > 0 
    ? parseFloat((efficiencyRatiosSum / efficiencyTasksCount).toFixed(2)) 
    : 1.0;

  // 5. Quality Metrics (Reviews)
  const peerReviews = reviews.filter(r => r.type === 'peer');
  const managerReviews = reviews.filter(r => r.type === 'manager');

  const avgPeerReviewScore = peerReviews.length > 0
    ? parseFloat((peerReviews.reduce((sum, r) => sum + r.score, 0) / peerReviews.length).toFixed(2))
    : 4.0; // Default fallback to a healthy 4.0

  const avgManagerReviewScore = managerReviews.length > 0
    ? parseFloat((managerReviews.reduce((sum, r) => sum + r.score, 0) / managerReviews.length).toFixed(2))
    : 4.0;

  // 6. Collaboration
  const tasksHelpedOnCount = userTasks.filter(t => t.assigneeIds?.length > 1 && t.createdBy !== userId).length;

  // 7. Attendance — count DISTINCT calendar days, not rows. A user can have
  // multiple attendance records on the same day (one per project checked into),
  // so attendanceList.length overcounts (e.g. showed "41 days" within a 30-day
  // window). De-dupe by the YYYY-MM-DD date.
  const attendanceDays = new Set(attendanceList.map((a) => a.date)).size;
  const attendanceRate = Math.min(Math.round((attendanceDays / 22) * 100), 100);

  // 8. Normalization factor based on role
  const normalizationFactor = config.roleDifficultyMultipliers[roleId] || 1.0;
  const normalizedPoints = rawPointsEarned * normalizationFactor;

  // 9. Composite Scores (0-100 scale)
  const productivityScore = Math.min(Math.round((normalizedPoints / Math.max(assignedTasks.length * 15, 50)) * 100), 100);
  const onTimePercentage = completedTasks.length > 0 ? (tasksCompletedOnTime / completedTasks.length) * 100 : 100;
  const reliabilityScore = Math.max(Math.round(onTimePercentage - Math.min(totalPenaltyPoints, 40)), 0);
  const efficiencyScore = Math.min(Math.round(avgEfficiencyRatio * 50 + 40), 100);
  const qualityScore = Math.round(((avgPeerReviewScore * 0.4 + avgManagerReviewScore * 0.6) / 5) * 100);
  const collaborationScore = Math.min((tasksHelpedOnCount * 10) + Math.round(avgPeerReviewScore * 8), 100);

  // 10. OPI (Overall Performance Index)
  const OPI = Math.round(
    productivityScore * config.scoreWeights.productivity +
    reliabilityScore * config.scoreWeights.reliability +
    efficiencyScore * config.scoreWeights.efficiency +
    qualityScore * config.scoreWeights.quality +
    collaborationScore * config.scoreWeights.collaboration
  );

  // 11. Consistency Metric Days (daily completion days in last 30)
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const dailyActivityDays = new Set(
    completedTasks
      .map(t => toDate(t.updatedAt)?.toISOString().split('T')[0] ?? '')
      .filter(dateStr => dateStr && new Date(dateStr) >= thirtyDaysAgo)
  ).size;

  // 12. Real completion-rate trends (previously hardcoded placeholder data).
  // Weekly: on-time completion rate for each of the last 4 weeks (oldest →
  // newest). Weeks with no completions count as a neutral 100 so an idle week
  // doesn't chart as a crash to zero.
  const rateForRange = (start: Date, end: Date): number => {
    const inRange = completedTasks.filter(t => {
      const d = toDate(t.updatedAt);
      return d && d >= start && d < end;
    });
    if (inRange.length === 0) return 100;
    const onTime = inRange.filter(t => {
      const dd = toDate(t.dueDate);
      if (!dd) return true;
      const comp = toDate(t.updatedAt) ?? new Date();
      return comp <= dd;
    }).length;
    return Math.round((onTime / inRange.length) * 100);
  };

  const weeklyCompletionRates: number[] = [];
  for (let w = 3; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * 86400000);
    const start = new Date(end.getTime() - 7 * 86400000);
    weeklyCompletionRates.push(rateForRange(start, end));
  }

  const monthlyCompletionRates: number[] = [];
  for (let m = 3; m >= 0; m--) {
    const end = new Date(now.getTime() - m * 30 * 86400000);
    const start = new Date(end.getTime() - 30 * 86400000);
    monthlyCompletionRates.push(rateForRange(start, end));
  }

  // 13. Badges Award logic
  const badges: string[] = [];
  if (completedTasks.length >= 10) {
    badges.push('speed_demon');
  }
  if (avgPeerReviewScore >= 4.5 && avgManagerReviewScore >= 4.5 && completedTasks.length >= 5) {
    badges.push('quality_king');
  }
  if (bestStreak >= 10) {
    badges.push('streak_master');
  }
  if (tasksHelpedOnCount >= 5) {
    badges.push('team_player');
  }
  if (tasksCompletedLate === 0 && completedTasks.length >= 8) {
    badges.push('iron_will');
  }
  if (OPI >= 90) {
    badges.push('mvp');
  }
  if (onTimePercentage === 100 && tasksRejected === 0 && completedTasks.length >= 5) {
    badges.push('perfect_month');
  }
  if (completedByPriority.critical >= 3) {
    badges.push('critical_hero');
  }
  if (dailyActivityDays >= 15) {
    badges.push('consistency_champion');
  }

  return {
    id: userId,
    userId,
    totalTasksCompleted: completedTasks.length,
    totalTasksAssigned: assignedTasks.length,
    tasksCompletedOnTime,
    tasksCompletedLate,
    tasksOverdue,
    tasksRejected,
    tasksReopened,
    deadlineExtensions,
    consecutiveSuccesses,
    bestStreak,
    completedByPriority,
    avgCompletionHours,
    avgEfficiencyRatio,
    avgPeerReviewScore,
    avgManagerReviewScore,
    qualityScore,
    dailyActivityDays,
    weeklyCompletionRates,
    monthlyCompletionRates,
    tasksHelpedOnCount,
    collaborationScore,
    attendanceDays,
    attendanceRate,
    productivityScore,
    reliabilityScore,
    efficiencyScore,
    overallPerformanceIndex: OPI,
    totalPenaltyPoints,
    penaltyBreakdown,
    badges,
    roleId,
    departmentNormalizationFactor: normalizationFactor,
    lastRecalculatedAt: Timestamp.now(),
  };
}
