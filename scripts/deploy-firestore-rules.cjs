// Usage: node deploy-rules.cjs [--release]   (without --release: compile-check only)
const admin = require(process.cwd() + '/node_modules/firebase-admin');
const fs = require('fs');
admin.initializeApp({ credential: admin.credential.cert(require(process.cwd() + '/serviceAccountKey.json')) });
(async () => {
  const sr = admin.securityRules();
  const current = await sr.getFirestoreRuleset();
  fs.writeFileSync(process.argv[3] || '/dev/null', current.source[0].content);
  console.log('current ruleset:', current.name);
  const source = fs.readFileSync('firestore.rules', 'utf8');
  const rs = await sr.createRuleset(sr.createRulesFileFromSource('firestore.rules', source)); // compiles; throws on error
  console.log('compiled OK:', rs.name);
  if (process.argv[2] === '--release') { await sr.releaseFirestoreRuleset(rs); console.log('RELEASED', rs.name); }
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
