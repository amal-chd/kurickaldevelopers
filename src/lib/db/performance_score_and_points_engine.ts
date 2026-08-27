import { Timestamp } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import {
  AppUser, Role, Project, Task, Subtask, TaskComment, Document as TDocument,
  Attendance, ChatChannel, ChatMessage, SiteDiaryEntry,
  OrgSettings, AppNotification, ContactInquiry, TaskAssignmentConfig,
  PerformanceScore, PerformanceReview, PerformanceConfig,
  LeaveRequest, SalarySlip, Expense,
} from '../../types';
import { calculatePerformanceScore, DEFAULT_PERFORMANCE_CONFIG } from '../performanceEngine';
import { notifyPush } from '../push';
import { createNotification } from './notifications';
import { getUser } from './users';

const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.message?.includes('permission') || error?.message?.includes('denied');
  if (isPermissionError) {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    console.error(`[AUTHORIZATION ERROR] Action: ${actionName} failed with permission-denied.`, {
      errorMessage: error.message,
      errorCode: error.code,
      currentUserUid: firebaseUser?.uid ?? 'not-authenticated',
      currentUserRole: appUser?.roleId ?? 'no-role-assigned',
      userPermissions: permissions,
      context,
    });
  } else {
    console.warn(`[API ERROR] Action: ${actionName} failed.`, error, context);
  }
};

// ─── Performance Score & Points Engine ────────────────────────────────────────
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

// Numeric/sortable columns that physically exist on performance_scores. Used to
// keep those columns populated alongside the full jsonb snapshot.
const SCORE_NUMERIC_COLUMNS: Record<string, string> = {
  overallPerformanceIndex: 'overall_performance_index',
  pointsBalance: 'points_balance',
  pointsLifetime: 'points_lifetime',
  totalTasksCompleted: 'total_tasks_completed',
  totalTasksAssigned: 'total_tasks_assigned',
  tasksCompletedOnTime: 'tasks_completed_on_time',
  tasksCompletedLate: 'tasks_completed_late',
  tasksOverdue: 'tasks_overdue',
  tasksRejected: 'tasks_rejected',
  averageCompletionTimeHrs: 'average_completion_time_hrs',
  qualityScore: 'quality_score',
  communicationScore: 'communication_score',
  reliabilityScore: 'reliability_score',
};

// Build the row to persist: existing numeric columns + the full score snapshot
// in `data` (the table can't hold all of PerformanceScore's rich fields).
const scoreToRow = (userId: string, score: any): any => {
  const row: any = { id: userId, user_id: userId, data: score, updated_at: new Date().toISOString() };
  for (const [camel, snake] of Object.entries(SCORE_NUMERIC_COLUMNS)) {
    if (score[camel] !== undefined && score[camel] !== null) row[snake] = score[camel];
  }
  return row;
};

const mapScore = (d: any): PerformanceScore => {
  const result: any = {};
  for (const key of Object.keys(d)) {
    if (key === 'data') continue;
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

  // If a full snapshot was persisted as jsonb, overlay it — it carries every
  // rich field the individual columns can't (badges, streaks, breakdowns, …).
  if (d.data && typeof d.data === 'object') {
    return { ...result, ...d.data } as PerformanceScore;
  }
  return result as PerformanceScore;
};

export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return mapScore(data);
  } catch (err: any) {
    logPermissionError('getPerformanceScore', err, { userId });
    return null;
  }
};

export const getAllPerformanceScores = async (): Promise<PerformanceScore[]> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*');
    if (error) throw error;
    return (data || []).map(mapScore);
  } catch (err: any) {
    logPermissionError('getAllPerformanceScores', err);
    return [];
  }
};

export const subscribePerformanceScores = (cb: (scores: PerformanceScore[]) => void) => {
  const channel = supabase.channel(`performance_scores_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_scores' }, async () => {
      const scores = await getAllPerformanceScores();
      cb(scores);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const getPerformanceReviews = async (taskId: string): Promise<PerformanceReview[]> => {
  try {
    const { data, error } = await supabase.from('performance_reviews').select('*').eq('task_id', taskId);
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      taskId: d.task_id,
      reviewerId: d.reviewer_id,
      revieweeId: d.reviewee_id,
      type: d.type,
      score: d.score,
      comment: d.comment,
      createdAt: d.created_at,
    })) as unknown as PerformanceReview[];
  } catch (err: any) {
    console.warn('Gracefully handled getPerformanceReviews error:', err);
    return [];
  }
};

export const submitPerformanceReview = async (review: Omit<PerformanceReview, 'id' | 'createdAt'>): Promise<string> => {
  // performance_reviews columns are snake_case — map explicitly (spreading the
  // camelCase review sent taskId/reviewerId/revieweeId which are not columns).
  const { data, error } = await supabase.from('performance_reviews')
    .insert([{
      task_id: review.taskId,
      reviewer_id: review.reviewerId,
      reviewee_id: review.revieweeId,
      type: review.type,
      score: review.score,
      comment: review.comment,
      created_at: new Date().toISOString(),
    }])
    .select('id').single();
  if (error) throw error;
  recalculatePerformanceScore(review.revieweeId).catch(err => console.warn('Error recalculating score on review submit:', err));
  return data.id;
};

export const getPerformanceConfig = async (): Promise<PerformanceConfig> => {
  try {
    const { data, error } = await supabase.from('settings').select('config').eq('id', 'performance_config').maybeSingle();
    if (error || !data || !(data as any).config) return DEFAULT_PERFORMANCE_CONFIG;
    // Stored in the generic `config` jsonb column (settings has no per-config
    // columns); merge over defaults so new keys are always present.
    return { ...DEFAULT_PERFORMANCE_CONFIG, ...((data as any).config) } as PerformanceConfig;
  } catch (err: any) {
    console.warn('getPerformanceConfig error:', err);
    return DEFAULT_PERFORMANCE_CONFIG;
  }
};

export const updatePerformanceConfig = async (data: Partial<PerformanceConfig>): Promise<void> => {
  const existing = await getPerformanceConfig();
  const merged = { ...existing, ...data };
  await supabase.from('settings').upsert({
    id: 'performance_config',
    config: merged,
    updated_at: new Date().toISOString(),
  });
};

export const recalculatePerformanceScore = async (userId: string): Promise<PerformanceScore> => {
  // Users live in Firestore (identity layer), not Supabase — read from there.
  const user = await getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const roleId = user.roleId || '';

  const taskMap = new Map<string, Task>();
  // Using getTasks from tasks.ts is better to map the fields properly
  // Since we cannot import it easily due to circular deps, we map it directly here
  const queries = [
    supabase.from('tasks').select('*').contains('assignee_ids', [userId]),
    supabase.from('tasks').select('*').eq('created_by', userId),
    ...(roleId ? [supabase.from('tasks').select('*').contains('assigned_role_ids', [roleId])] : [])
  ];

  await Promise.all(queries.map(async (q) => {
    try {
      const { data } = await q;
      if (data) {
        data.forEach((d: any) => {
          const mapped = {
            ...d,
            id: d.id,
            title: d.title,
            description: d.description,
            projectId: d.project_id,
            milestoneId: d.milestone_id,
            assigneeIds: d.assigned_to ? JSON.parse(d.assigned_to) : (d.assignee_ids || []),
            assignedRoleId: d.assigned_role_id,
            assignedRoleIds: d.assigned_role_ids || [],
            createdBy: d.created_by,
            status: d.status,
            priority: d.priority,
            tags: typeof d.tags === 'string' ? JSON.parse(d.tags) : (d.tags || []),
            dueDate: d.due_date ? new Date(d.due_date) : null,
            startDate: d.start_date ? new Date(d.start_date) : null,
            completedAt: d.completed_at ? new Date(d.completed_at) : null,
            // Engine uses updatedAt as the completion-time proxy — omitting it
            // made every completed task look done "now" (wrong on-time stats).
            updatedAt: d.updated_at ? new Date(d.updated_at) : (d.completed_at ? new Date(d.completed_at) : null),
            attachmentUrls: d.attachment_urls || [],
            followers: d.followers || [],
            estimatedHours: d.estimated_hours,
            actualHours: d.actual_hours,
            costImpact: d.cost_impact,
            qualityScore: d.quality_score,
          } as Task;
          taskMap.set(d.id, mapped);
        });
      }
    } catch (e) {
      logPermissionError('recalculatePerformanceScore (task query)', e);
    }
  }));
  const userTasks = Array.from(taskMap.values());

  const { data: reviewSnap } = await supabase.from('performance_reviews').select('*').eq('reviewee_id', userId);
  const userReviews = (reviewSnap || []) as PerformanceReview[];

  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const { data: attSnap } = await supabase.from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', cutoff);
  const userAttendance = (attSnap || []) as Attendance[];

  const config = await getPerformanceConfig();
  const score = calculatePerformanceScore(userId, userTasks, userReviews, userAttendance, config, roleId);

  const { data: oldScoreDoc } = await supabase.from('performance_scores').select('*').eq('id', userId).maybeSingle();
  // Map to camelCase (and overlay the jsonb snapshot) so the OPI/badge/streak
  // comparisons below read real values instead of undefined snake_case keys.
  const oldScore = oldScoreDoc ? mapScore(oldScoreDoc) : null;

  const allScores = await getAllPerformanceScores();
  const sortedOldScores = [...allScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const oldRank = sortedOldScores.findIndex(s => s.userId === userId) + 1;

  await supabase.from('performance_scores').upsert(scoreToRow(userId, score));

  const updatedScores = allScores.map(s => s.userId === userId ? score : s);
  if (!allScores.some(s => s.userId === userId)) {
    updatedScores.push(score);
  }
  const sortedNewScores = [...updatedScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const newRank = sortedNewScores.findIndex(s => s.userId === userId) + 1;

  const formatBadgeName = (badgeId: string): string => {
    return badgeId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (oldScore) {
    const newBadges = score.badges.filter((b: any) => !oldScore.badges.includes(b));
    newBadges.forEach((b: any) => {
      createNotification({
        title: '🏆 Achievement Unlocked!',
        body: `🏆 You earned the ${formatBadgeName(b)} badge!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    });

    if (oldRank > 0 && newRank < oldRank) {
      createNotification({
        title: '📈 Leaderboard Rank Up!',
        body: `📈 You moved up to #${newRank} in the org leaderboard!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    }

    if (score.consecutiveSuccesses > oldScore.consecutiveSuccesses && score.consecutiveSuccesses % 5 === 0) {
      createNotification({
        title: '🔥 On-Time Streak!',
        body: `🔥 ${score.consecutiveSuccesses} tasks completed on time in a row!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    }

    if (score.overallPerformanceIndex >= 80 && oldScore.overallPerformanceIndex < 80) {
      createNotification({
        title: '⭐ OPI Milestone!',
        body: `⭐ Your OPI reached ${score.overallPerformanceIndex}! Great work!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    }

    const opiDrop = oldScore.overallPerformanceIndex - score.overallPerformanceIndex;
    if (opiDrop >= 15) {
      try {
        const { data: usersSnap } = await supabase.from('users').select('*');
        const allUsers = (usersSnap || []) as AppUser[];
        const { data: rolesSnap } = await supabase.from('roles').select('*');
        const allRoles = (rolesSnap || []) as Role[];
        
        const managerRoles = allRoles.filter(r => r.permissions?.tasks_approve || r.permissions?.team_manage).map(r => r.id);
        const managers = allUsers.filter(u => managerRoles.includes(u.roleId));
        
        managers.forEach(m => {
          createNotification({
            title: '⚠️ At-Risk Team Member Alert',
            body: `⚠️ ${user.name}'s OPI dropped ${opiDrop} points this week`,
            userId: m.id,
            type: 'alert',
            isRead: {},
          }).catch((e: any) => console.warn('Manager alert failed:', e));
        });
      } catch (err) {
        console.warn('Failed to alert managers:', err);
      }
    }
  } else {
    score.badges.forEach((b: any) => {
      createNotification({
        title: '🏆 Achievement Unlocked!',
        body: `🏆 You earned the ${formatBadgeName(b)} badge!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    });

    if (score.overallPerformanceIndex >= 80) {
      createNotification({
        title: '⭐ OPI Milestone!',
        body: `⭐ Your OPI reached ${score.overallPerformanceIndex}! Great work!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch((e: any) => console.warn('Notification failed:', e));
    }
  }

  return score;
};
