const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

const replacement = `
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const mapScore = (d: any): PerformanceScore => {
  const result: any = {};
  for (const key of Object.keys(d)) {
    result[toCamelCase(key)] = d[key];
  }
  result.badges = typeof d.badges === 'string' ? JSON.parse(d.badges) : (d.badges || []);
  return result as PerformanceScore;
};

export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const { data, error } = await supabase.from('performance_scores').select('*').eq('id', userId).single();
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
`;

code = code.replace(/export const getPerformanceScore[\s\S]*?getAllPerformanceScores[\s\S]*?return \[\];\n  }\n};/, replacement.trim());

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
