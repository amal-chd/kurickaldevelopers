#!/usr/bin/env node
/**
 * SaaS rollout backfill (idempotent, additive).
 *
 *   node scripts/saas-backfill.cjs            # dry run — prints what would change
 *   node scripts/saas-backfill.cjs --apply    # writes
 *
 * 1. Firestore users without `orgId` → orgId: "main" (the legacy workspace the
 *    app already assumes for them). Required before tenant-scoped user queries.
 * 2. Sets Firebase custom claims { role: "authenticated", org_id } on every
 *    user so Supabase Third-Party Auth accepts their ID tokens (stage B).
 * 3. Prints an idempotent SQL upsert for public.org_members to run in Supabase.
 *
 * Needs ./serviceAccountKey.json (git-ignored).
 */
const admin = require('firebase-admin');
const path = require('path');

const APPLY = process.argv.includes('--apply');
admin.initializeApp({ credential: admin.credential.cert(require(path.resolve('serviceAccountKey.json'))) });

(async () => {
  const fs = admin.firestore();
  const snap = await fs.collection('users').get();
  const rows = [];
  let missing = 0;
  for (const d of snap.docs) {
    const u = d.data();
    const orgId = u.orgId || 'main';
    if (!u.orgId) {
      missing++;
      if (APPLY) await d.ref.set({ orgId: 'main' }, { merge: true });
    }
    if (APPLY) {
      try {
        const au = await admin.auth().getUser(d.id);
        await admin.auth().setCustomUserClaims(d.id, { ...(au.customClaims || {}), role: 'authenticated', org_id: orgId });
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }
    }
    rows.push({ uid: d.id, email: (u.email || '').toLowerCase(), name: u.name || null, role: u.roleId || null, org: orgId, active: u.isActive !== false });
  }
  console.error(`${snap.size} users, ${missing} without orgId ${APPLY ? '→ set to main' : '(dry run)'}`);
  const esc = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  console.log('insert into public.org_members (org_id, user_uid, email, name, role_id, status) values');
  console.log(rows.map((r) => `  (${esc(r.org)}, ${esc(r.uid)}, ${esc(r.email)}, ${esc(r.name)}, ${esc(r.role)}, '${r.active ? 'active' : 'suspended'}')`).join(',\n'));
  console.log('on conflict (org_id, user_uid) do update set email = excluded.email, name = excluded.name, role_id = excluded.role_id, status = excluded.status;');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
