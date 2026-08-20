const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

code = code.replace(
`export const subscribePerformanceScores = (cb: (scores: PerformanceScore[]) => void) => {
  const channel = supabase.channel('performance_scores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_scores' }, async () => {
      const { data } = await supabase.from('performance_scores').select('*');
      if (data) cb(data as PerformanceScore[]);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};`,
`export const subscribePerformanceScores = (cb: (scores: PerformanceScore[]) => void) => {
  const channel = supabase.channel('performance_scores')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_scores' }, async () => {
      const scores = await getAllPerformanceScores();
      cb(scores);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};`
);

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
