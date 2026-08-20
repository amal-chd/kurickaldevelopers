const fs = require('fs');
const file = 'src/lib/db/performance_score_and_points_engine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /return data as PerformanceReview\[\];/g,
  `return (data || []).map((d: any) => ({
      id: d.id,
      taskId: d.task_id,
      reviewerId: d.reviewer_id,
      revieweeId: d.reviewee_id,
      type: d.type,
      score: d.score,
      comment: d.comment,
      createdAt: d.created_at,
    })) as unknown as PerformanceReview[];`
);

code = code.replace(
  /const payload = \{ \.\.\.review, task_id: taskId \};/g,
  `const payload = {
    task_id: taskId,
    reviewer_id: review.reviewerId,
    reviewee_id: review.revieweeId,
    type: review.type,
    score: review.score,
    comment: review.comment,
  };`
);

fs.writeFileSync(file, code);
