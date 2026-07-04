/**
 * Kurickal TMS — Patch Director Role Permissions
 * Updates the director role to include all missing permissions.
 * Run: node scripts/patch_director_role.js
 */

const API_KEY    = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";
const DB_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE  = `https://identitytoolkit.googleapis.com/v1`;
const PASSWORD   = "Kurickal@2024";

function bool(v)  { return { booleanValue: Boolean(v) }; }

const ALL_PERMISSIONS = {
  'tasks_view': bool(true),
  'tasks_create': bool(true),
  'tasks_edit': bool(true),
  'tasks_delete': bool(true),
  'tasks_approve': bool(true),
  'projects_view': bool(true),
  'projects_create': bool(true),
  'projects_edit': bool(true),
  'projects_delete': bool(true),
  'docs_view': bool(true),
  'docs_upload': bool(true),
  'docs_approve': bool(true),
  'team_view': bool(true),
  'team_manage': bool(true),
  'team_delete': bool(true),
  'reports_view': bool(true),
  'reports_export': bool(true),
  'time_log': bool(true),
  'time_view_all': bool(true),
  'roles_manage': bool(true),
  'settings_manage': bool(true),
  'notifications_manage': bool(true),
  'chat_view': bool(true),
  'chat_send': bool(true),
  'chat_create_group': bool(true),
  'chat_announce': bool(true),
  'chat_moderate': bool(true),
  'attendance_view_all': bool(true),
};

async function signIn(email) {
  const res = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) { console.error(`  ✗ Sign-in failed for ${email}:`, data.error.message); return null; }
  return { uid: data.localId, idToken: data.idToken };
}

async function patchDirectorRole(idToken) {
  const url = `${DB_BASE}/roles/director?updateMask.fieldPaths=permissions`;
  const body = {
    fields: {
      permissions: {
        mapValue: {
          fields: ALL_PERMISSIONS
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ Patch failed: ${res.status}`, text.substring(0, 300));
    return false;
  }
  return true;
}

async function main() {
  console.log('Patching director role permissions in Firestore…\n');

  console.log('Signing in as Thomas Kurickal (Director)…');
  const thomas = await signIn('thomas@kurickaldevelopers.com');
  
  if (thomas) {
    console.log('Authenticated ✓\n');
    const ok = await patchDirectorRole(thomas.idToken);
    if (ok) {
      console.log('  ✓ Director role permissions updated successfully!');
    }
  } else {
    console.error('Failed to sign in. Cannot patch role.');
  }
}

main().catch(console.error);
