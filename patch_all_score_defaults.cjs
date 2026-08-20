const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

const replacement = `
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const mapScore = (d: any): PerformanceScore => {
  const result: any = {};
  for (const key of Object.keys(d)) {
    result[toCamelCase(key)] = d[key];
  }
  
  // Provide safe defaults for ALL missing columns and nested objects
  const safeParseJSON = (val: any, defaultVal: any) => {
    if (!val) return defaultVal;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return defaultVal; }
    }
    return val;
  };

  result.badges = safeParseJSON(d.badges, []);
  result.completedByPriority = safeParseJSON(d.completed_by_priority, { low: 0, medium: 0, high: 0, critical: 0 });
  result.penaltyBreakdown = safeParseJSON(d.penalty_breakdown, { lateCompletions: 0, deadlineExtensions: 0, rejections: 0, reopenings: 0, missedDeadlines: 0, inactivity: 0 });
  result.weeklyCompletionRates = safeParseJSON(d.weekly_completion_rates, []);
  result.monthlyCompletionRates = safeParseJSON(d.monthly_completion_rates, []);
  
  // Primitives
  result.tasksReopened = d.tasks_reopened || 0;
  result.deadlineExtensions = d.deadline_extensions || 0;
  result.consecutiveSuccesses = d.consecutive_successes || 0;
  result.bestStreak = d.best_streak || 0;
  result.avgCompletionHours = d.avg_completion_hours || 0;
  result.avgEfficiencyRatio = d.avg_efficiency_ratio || 0;
  result.avgPeerReviewScore = d.avg_peer_review_score || 0;
  result.avgManagerReviewScore = d.avg_manager_review_score || 0;
  result.dailyActivityDays = d.daily_activity_days || 0;
  result.tasksHelpedOnCount = d.tasks_helped_on_count || 0;
  result.collaborationScore = d.collaboration_score || 0;
  result.attendanceDays = d.attendance_days || 0;
  result.attendanceRate = d.attendance_rate || 0;
  result.productivityScore = d.productivity_score || 0;
  result.efficiencyScore = d.efficiency_score || 0;
  result.totalPenaltyPoints = d.total_penalty_points || 0;
  result.departmentNormalizationFactor = d.department_normalization_factor || 1;
  
  return result as PerformanceScore;
};`;

code = code.replace(/const toCamelCase = [\s\S]*?return result as PerformanceScore;\n};/, replacement.trim());

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
