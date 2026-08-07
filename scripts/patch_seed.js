/**
 * Kurickal TMS — Seed Patch
 * Fixes the gaps left from seed_all.js:
 *   1. Suresh Kumar's user doc (uses his own token → works with real rules)
 *   2. Missing chat seed messages (needs open rules for 30s)
 *
 * Run:
 *   node scripts/patch_seed.js
 */

const API_KEY    = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";
const DB_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE  = `https://identitytoolkit.googleapis.com/v1`;
const PASSWORD   = "Kurickal@2024";

function ts(date) { return { timestampValue: (date instanceof Date ? date : new Date(date)).toISOString() }; }
function str(v)   { return { stringValue: String(v) }; }
function bool(v)  { return { booleanValue: Boolean(v) }; }
function nul()    { return { nullValue: null }; }
function arr(items) { return { arrayValue: { values: items.length ? items : [] } }; }
function strArr(items) { return arr(items.map(str)); }
function daysAgo(d) { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; }

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

async function firestoreSet(collection, docId, fields, idToken) {
  const url = `${DB_BASE}/${collection}/${docId}`;
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ fields }) });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ ${collection}/${docId}: ${res.status}`, text.substring(0, 300));
    return false;
  }
  return true;
}

async function firestoreAdd(collection, fields, idToken) {
  const url = `${DB_BASE}/${collection}`;
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ fields }) });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ POST ${collection}: ${res.status}`, text.substring(0, 300));
    return null;
  }
  const data = await res.json();
  return data.name.split("/").pop();
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     Kurickal TMS — Seed Patch Script             ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Step 1: Fix Suresh Kumar's user doc (uses his own token → real rules OK) ──
  console.log("👤 Patching Suresh Kumar user doc...");
  const suresh = await signIn("suresh@kurickaldevelopers.com");
  if (suresh) {
    const ok = await firestoreSet("users", suresh.uid, {
      name:              str("Suresh Kumar"),
      email:             str("suresh@kurickaldevelopers.com"),
      phone:             str("+919876543214"),
      roleId:            str("foreman"),
      avatarUrl:         nul(),
      projectIds:        arr([]),   // project linking done separately
      fcmToken:          nul(),
      isActive:          bool(true),
      biometricEnabled:  bool(false),
      createdAt:         ts(daysAgo(90)),
      lastLoginAt:       ts(new Date()),
    }, suresh.idToken);
    console.log(ok ? `  ✓ Suresh Kumar doc written (uid: ${suresh.uid})` : "  ✗ Still failed — open rules needed");
  }

  // ── Step 2: Missing chat messages (needs open rules — script warns if blocked) ──
  console.log("\n💬 Patching missing chat messages...");

  // Sign in as Thomas to get a valid sender token
  const thomas = await signIn("thomas@kurickaldevelopers.com");
  const ravi   = await signIn("ravi@kurickaldevelopers.com");
  const arjun  = await signIn("arjun@kurickaldevelopers.com");

  if (thomas) {
    // Announcement channel missing message
    const id = await firestoreAdd("chats/ch_announcements/messages", {
      channelId:  str("ch_announcements"),
      senderId:   str(thomas.uid),
      text:       str("Welcome to Kurickal Developers LLP. This channel is for official announcements only. Please keep conversations respectful and professional."),
      type:       str("system"),
      reactions:  { mapValue: { fields: {} } },
      isDeleted:  bool(false),
      createdAt:  ts(daysAgo(30)),
    }, thomas.idToken);
    console.log(id ? "  ✓ Announcement message added" : "  ✗ Announcement message failed (open rules needed)");
  }

  if (ravi && arjun) {
    // Commercial Complex Edappally missing message
    const proj2Id = "TjUZKSO4rWCTVIT5xWZC"; // from the seed output
    const id = await firestoreAdd(`chats/proj_${proj2Id}/messages`, {
      channelId:  str(`proj_${proj2Id}`),
      senderId:   str(arjun.uid),
      text:       str("Foundation work completed on Block A. Starting column work from Monday. Labour deployed: 18 workers."),
      type:       str("text"),
      reactions:  { mapValue: { fields: {} } },
      isDeleted:  bool(false),
      createdAt:  ts(daysAgo(3)),
    }, arjun.idToken);
    console.log(id ? "  ✓ Commercial Complex message added" : "  ✗ Commercial Complex message failed (open rules needed)");
  }

  console.log("\n✅ Patch complete.\n");
  console.log("Note: If any writes failed, temporarily set Firestore to test mode,");
  console.log("re-run this script, then restore your rules with: firebase deploy --only firestore:rules\n");
}

main().catch(console.error);
