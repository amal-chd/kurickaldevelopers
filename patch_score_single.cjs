const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

code = code.replace(
`export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return data as PerformanceScore;
  } catch (err: any) {
    logPermissionError('getPerformanceScore', err, { userId });
    return null;
  }
};`,
`export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*').eq('id', userId).single();
    if (error || !data) return null;
    const d: any = data;
    return {
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
      badges: typeof d.badges === 'string' ? JSON.parse(d.badges) : (d.badges || []),
    } as PerformanceScore;
  } catch (err: any) {
    logPermissionError('getPerformanceScore', err, { userId });
    return null;
  }
};`
);

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
