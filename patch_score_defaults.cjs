const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

const replacement = `
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const mapScore = (d: any): PerformanceScore => {
  const result: any = {};
  for (const key of Object.keys(d)) {
    result[toCamelCase(key)] = d[key];
  }
  
  // Provide safe defaults for missing columns
  result.badges = typeof d.badges === 'string' ? JSON.parse(d.badges) : (d.badges || []);
  result.completedByPriority = typeof d.completed_by_priority === 'string' ? JSON.parse(d.completed_by_priority) : (d.completed_by_priority || { low: 0, medium: 0, high: 0, critical: 0 });
  result.tasksReopened = d.tasks_reopened || 0;
  result.deadlineExtensions = d.deadline_extensions || 0;
  result.consecutiveSuccesses = d.consecutive_successes || 0;
  result.bestStreak = d.best_streak || 0;
  
  return result as PerformanceScore;
};`;

code = code.replace(/const toCamelCase = [\s\S]*?return result as PerformanceScore;\n};/, replacement.trim());

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
