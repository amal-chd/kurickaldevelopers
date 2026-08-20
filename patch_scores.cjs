const fs = require('fs');
let code = fs.readFileSync('src/lib/db/performance_score_and_points_engine.ts', 'utf8');

code = code.replace(
`      overallPerformanceIndex: d.overall_performance_index,
      pointsBalance: d.points_balance,
      pointsLifetime: d.points_lifetime,
    })) as unknown as PerformanceScore[];`,
`      overallPerformanceIndex: d.overall_performance_index,
      pointsBalance: d.points_balance,
      pointsLifetime: d.points_lifetime,
      badges: typeof d.badges === 'string' ? JSON.parse(d.badges) : (d.badges || []),
    })) as unknown as PerformanceScore[];`
);

fs.writeFileSync('src/lib/db/performance_score_and_points_engine.ts', code);
