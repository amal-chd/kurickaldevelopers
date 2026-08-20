const fs = require('fs');
const file = 'src/lib/db/performance_score_and_points_engine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`  const queries = [
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
  const userTasks = Array.from(taskMap.values());`,
`  // Using getTasks from tasks.ts is better to map the fields properly
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
  const userTasks = Array.from(taskMap.values());`
);

fs.writeFileSync(file, code);
