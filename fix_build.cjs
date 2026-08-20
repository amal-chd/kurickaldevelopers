const fs = require('fs');

const orgFile = 'src/lib/db/org_settings.ts';
let orgCode = fs.readFileSync(orgFile, 'utf8');

orgCode = orgCode.replace(/if \(data\.currency !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/if \(data\.dateFormat !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/if \(data\.timeFormat !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/if \(data\.themeColor !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/if \(data\.language !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/if \(data\.featuresEnabled !== undefined\).*;\n/g, '');
orgCode = orgCode.replace(/currency: data\.currency,\n/g, '');
orgCode = orgCode.replace(/dateFormat: data\.date_format,\n/g, '');
orgCode = orgCode.replace(/timeFormat: data\.time_format,\n/g, '');
orgCode = orgCode.replace(/themeColor: data\.theme_color,\n/g, '');
orgCode = orgCode.replace(/language: data\.language,\n/g, '');
orgCode = orgCode.replace(/featuresEnabled: data\.features_enabled,\n/g, '');

fs.writeFileSync(orgFile, orgCode);


const perfFile = 'src/lib/db/performance_score_and_points_engine.ts';
let perfCode = fs.readFileSync(perfFile, 'utf8');

perfCode = perfCode.replace(
  /\}\)\) as PerformanceScore\[\];/g,
  '})) as unknown as PerformanceScore[];'
);

fs.writeFileSync(perfFile, perfCode);
