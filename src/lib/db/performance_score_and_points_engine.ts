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
export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return data as PerformanceScore;
  } catch (err: any) {
    logPermissionError('getPerformanceScore', err, { userId });
    return null;
  }
};

export const getAllPerformanceScores = async (): Promise<PerformanceScore[]> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      totalTasksCompleted: d.total_tasks_completed,
      totalTasksAssigned: d.total_tasks_assigned,
      tasksCompletedOnTime: d.tasks_completed_on_time,
      tasksCompletedLate: d.tasks_completed_late,
      tasksOverdue: d.tasks_overdue,
      tasksRejected: d.tasks_rejected,
      averageCompletionTimeHrs: d.average_completion_time_hrs,
      qualityScore: d.quality_score,
      communicationScore: d.communication_score,
      reliabilityScore: d.reliability_score,
      overallPerformanceIndex: d.overall_performance_index,
      pointsBalance: d.points_balance,
      pointsLifetime: d.points_lifetime,
    })) as unknown as PerformanceScore[];
  } catch (err: any) {
    logPermissionError('getAllPerformanceScores', err);
    return [];
  }
};

export const subscribePerformanceScores = (cb: (scores: PerformanceScore[]) => void) => {
  const channel = supabase.channel('performance_scores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_scores' }, async () => {
      const { data } = await supabase.from('performance_scores').select('*');
      if (data) cb(data as PerformanceScore[]);
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
  const { data, error } = await supabase.from('performance_reviews')
    .insert([{ ...review, created_at: new Date().toISOString() }])
    .select('id').single();
  if (error) throw error;
  recalculatePerformanceScore(review.revieweeId).catch(err => console.warn('Error recalculating score on review submit:', err));
  return data.id;
};

export const getPerformanceConfig = async (): Promise<PerformanceConfig> => {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'performance_config').single();
    if (error || !data) return DEFAULT_PERFORMANCE_CONFIG;
    return data as PerformanceConfig;
  } catch (err: any) {
    console.warn('getPerformanceConfig error:', err);
    return DEFAULT_PERFORMANCE_CONFIG;
  }
};

export const updatePerformanceConfig = async (data: Partial<PerformanceConfig>): Promise<void> => {
  const { firebaseUser } = useAuthStore.getState();
  await supabase.from('settings').upsert({
    id: 'performance_config',
    ...data,
    updated_at: new Date().toISOString(),
    updated_by: firebaseUser?.email || 'admin',
  });
};

export const recalculatePerformanceScore = async (userId: string): Promise<PerformanceScore> => {
  const { data: userDoc, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
  if (userError || !userDoc) {
    throw new Error('User not found');
  }
  const user = userDoc as AppUser;
  const roleId = user.roleId || '';

  const taskMap = new Map<string, Task>();
  const queries = [
    supabase.from('tasks').select('*').contains('assignee_ids', [userId]),
    supabase.from('tasks').select('*').eq('created_by', userId),
    ...(roleId ? [supabase.from('tasks').select('*').contains('assigned_role_ids', [roleId])] : [])
  ];

  await Promise.all(queries.map(async (q) => {
    try {
      const { data } = await q;
      if (data) {
        data.forEach((d: any) => taskMap.set(d.id, d as Task));
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

  const { data: oldScoreDoc } = await supabase.from('performance_scores').select('*').eq('id', userId).single();
  const oldScore = oldScoreDoc ? (oldScoreDoc as PerformanceScore) : null;

  const allScores = await getAllPerformanceScores();
  const sortedOldScores = [...allScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const oldRank = sortedOldScores.findIndex(s => s.userId === userId) + 1;

  await supabase.from('performance_scores').upsert(score);

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
