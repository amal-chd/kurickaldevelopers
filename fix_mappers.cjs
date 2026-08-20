const fs = require('fs');
const path = require('path');

const perfFile = 'src/lib/db/performance_score_and_points_engine.ts';
let perfCode = fs.readFileSync(perfFile, 'utf8');

// Replace mapping for PerformanceScore
perfCode = perfCode.replace(
  /return data as PerformanceScore\[\];/,
  `return (data || []).map((d: any) => ({
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
    })) as PerformanceScore[];`
);

// Fix upsert mapping
perfCode = perfCode.replace(
  /const { error } = await supabase\.from\('performance_scores'\)\.upsert\(score\);/,
  `const payload = {
    id: score.userId,
    user_id: score.userId,
    total_tasks_completed: score.totalTasksCompleted,
    total_tasks_assigned: score.totalTasksAssigned,
    tasks_completed_on_time: score.tasksCompletedOnTime,
    tasks_completed_late: score.tasksCompletedLate,
    tasks_overdue: score.tasksOverdue,
    tasks_rejected: score.tasksRejected,
    average_completion_time_hrs: score.averageCompletionTimeHrs,
    quality_score: score.qualityScore,
    communication_score: score.communicationScore,
    reliability_score: score.reliabilityScore,
    overall_performance_index: score.overallPerformanceIndex,
    points_balance: score.pointsBalance,
    points_lifetime: score.pointsLifetime,
  };
  const { error } = await supabase.from('performance_scores').upsert(payload);`
);

fs.writeFileSync(perfFile, perfCode);


const orgFile = 'src/lib/db/org_settings.ts';
let orgCode = fs.readFileSync(orgFile, 'utf8');

orgCode = orgCode.replace(
  /return data as OrgSettings;/,
  `return {
      companyName: data.company_name,
      companyLogo: data.company_logo,
      timezone: data.timezone,
      workStartTime: data.work_start_time,
      workEndTime: data.work_end_time,
      geofenceRadius: data.geofence_radius,
      geofenceLat: data.geofence_lat,
      geofenceLng: data.geofence_lng,
      currency: data.currency,
      dateFormat: data.date_format,
      timeFormat: data.time_format,
      themeColor: data.theme_color,
      language: data.language,
      featuresEnabled: data.features_enabled,
    } as OrgSettings;`
);

orgCode = orgCode.replace(
  /const { error } = await supabase\.from\('settings'\)\.upsert\({ id: 'org', \.\.\.data }\);/,
  `const payload: any = { id: 'org' };
  if (data.companyName !== undefined) payload.company_name = data.companyName;
  if (data.companyLogo !== undefined) payload.company_logo = data.companyLogo;
  if (data.timezone !== undefined) payload.timezone = data.timezone;
  if (data.workStartTime !== undefined) payload.work_start_time = data.workStartTime;
  if (data.workEndTime !== undefined) payload.work_end_time = data.workEndTime;
  if (data.geofenceRadius !== undefined) payload.geofence_radius = data.geofenceRadius;
  if (data.geofenceLat !== undefined) payload.geofence_lat = data.geofenceLat;
  if (data.geofenceLng !== undefined) payload.geofence_lng = data.geofenceLng;
  if (data.currency !== undefined) payload.currency = data.currency;
  if (data.dateFormat !== undefined) payload.date_format = data.dateFormat;
  if (data.timeFormat !== undefined) payload.time_format = data.timeFormat;
  if (data.themeColor !== undefined) payload.theme_color = data.themeColor;
  if (data.language !== undefined) payload.language = data.language;
  if (data.featuresEnabled !== undefined) payload.features_enabled = data.featuresEnabled;

  const { error } = await supabase.from('settings').upsert(payload);`
);

fs.writeFileSync(orgFile, orgCode);
