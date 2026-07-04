/**
 * Kurickal TMS — Patch Role Levels
 * Adds the `level` field to all existing system roles in Firestore.
 * Authenticates as Thomas Kurickal (Director) who has roles_manage permission.
 * Run: node scripts/patch_role_levels.js
 */

const API_KEY    = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";
const DB_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE  = `https://identitytoolkit.googleapis.com/v1`;

// Hierarchy levels: higher = more authority
const ROLE_LEVELS = {
  director:        100,
  admin:            90,
  project_manager:  70,
  accounts:         60,
  site_engineer:    50,
  foreman:          30,
  labour:           10,
};

async function signIn(email, password) {
  const resp = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function patchRole(roleId, level, token) {
  const url = `${DB_BASE}/roles/${roleId}?updateMask.fieldPaths=level`;
  const body = {
    fields: { level: { integerValue: String(level) } },
  };

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`  ✗ ${roleId} (level ${level}): ${resp.status} ${txt.substring(0, 200)}`);
  } else {
    console.log(`  ✓ ${roleId} → level ${level}`);
  }
}

async function main() {
  console.log('Patching role levels in Firestore…\n');

  // Sign in as Thomas (Director — has roles_manage permission)
  console.log('Signing in as Thomas Kurickal (Director)…');
  const token = await signIn('thomas@kurickaldevelopers.com', 'Kurickal@2024');
  console.log('Authenticated ✓\n');

  for (const [roleId, level] of Object.entries(ROLE_LEVELS)) {
    await patchRole(roleId, level, token);
  }

  console.log('\nDone! All system roles now have hierarchy levels.');
}

main().catch(console.error);
