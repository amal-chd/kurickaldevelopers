/**
 * Kurickal TMS — Seed Data Cleanup Script
 * 
 * Authenticates as the Director (Thomas), identifies all seeded users,
 * calls the Supabase edge function to delete them from Firebase Auth
 * and clean up their records, deletes their user documents from Firestore,
 * and format remaining users' names to Title Case.
 * 
 * USAGE:
 *   node scripts/cleanup_seed.js
 */

const API_KEY = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";
const DB_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1`;
const SUPABASE_FUNC = "https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push";

// Title Case formatter keeping abbreviations (e.g. CP, AB) intact
function toTitleCase(str) {
  if (!str) return "";
  return str.split(" ").map(w => {
    if (w.toUpperCase() === w && w.length <= 3) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

async function main() {
  console.log("=== Seed Data Cleanup & Name Normalization ===");
  
  // 1. Authenticate as Director
  console.log("Authenticating as Thomas Kurickal...");
  const authRes = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "thomas@kurickaldevelopers.com",
      password: "Kurickal@2024",
      returnSecureToken: true,
    }),
  });

  if (!authRes.ok) {
    console.error("Authentication failed:", await authRes.text());
    process.exit(1);
  }

  const authData = await authRes.json();
  const idToken = authData.idToken;
  console.log("Authenticated successfully!");

  // 2. Fetch all users from Firestore
  console.log("Fetching all users from Firestore...");
  const usersRes = await fetch(`${DB_BASE}/users?pageSize=100`, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });

  if (!usersRes.ok) {
    console.error("Failed to fetch users:", await usersRes.text());
    process.exit(1);
  }

  const usersData = await usersRes.json();
  const userDocs = usersData.documents || [];
  console.log(`Found ${userDocs.length} users in Firestore.`);

  const seedUsers = [];
  const realUsers = [];

  for (const doc of userDocs) {
    const uid = doc.name.split("/").pop();
    const fields = doc.fields || {};
    const email = fields.email?.stringValue || "";
    const name = fields.name?.stringValue || "";
    
    const u = { uid, email, name, docPath: doc.name };

    if (email.endsWith("@kurickaldevelopers.com") && email !== "thomas@kurickaldevelopers.com") {
      seedUsers.push(u);
    } else {
      realUsers.push(u);
    }
  }

  console.log(`Identified ${seedUsers.length} seed users to delete:`);
  seedUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [UID: ${u.uid}]`));

  // 3. Delete seeded users via Supabase and Firestore
  for (const u of seedUsers) {
    console.log(`\nDeleting user ${u.name} (${u.email})...`);
    
    // Call Supabase edge function to delete auth account & clean subcollections
    try {
      console.log(`  Calling Supabase delete_user for ${u.uid}...`);
      const sbRes = await fetch(SUPABASE_FUNC, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          event: "delete_user",
          targetUid: u.uid,
        }),
      });

      if (!sbRes.ok) {
        console.warn(`  ⚠ Supabase delete_user returned status ${sbRes.status}:`, await sbRes.text());
      } else {
        console.log(`  ✔ Supabase deleted Auth & cleaned subcollections.`);
      }
    } catch (err) {
      console.warn(`  ⚠ Failed calling Supabase:`, err.message);
    }

    // Delete Firestore user document
    console.log(`  Deleting Firestore user document...`);
    const fsRes = await fetch(`${DB_BASE}/users/${u.uid}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${idToken}` },
    });

    if (!fsRes.ok) {
      console.error(`  ✗ Failed deleting Firestore doc for ${u.uid}:`, await fsRes.text());
    } else {
      console.log(`  ✔ Firestore user document deleted.`);
    }
  }

  // 4. Normalize real users' names to Title Case
  console.log("\nNormalizing real users' names to Title Case...");
  for (const u of realUsers) {
    if (!u.name) continue;
    const formatted = toTitleCase(u.name);
    if (formatted !== u.name) {
      console.log(`  Normalizing: "${u.name}" -> "${formatted}"`);
      const patchRes = await fetch(`${DB_BASE}/users/${u.uid}?updateMask.fieldPaths=name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: {
            name: { stringValue: formatted }
          }
        }),
      });

      if (!patchRes.ok) {
        console.error(`  ✗ Failed normalizing name for ${u.uid}:`, await patchRes.text());
      } else {
        console.log(`  ✔ Name normalized.`);
      }
    }
  }

  // 5. Normalise project names in the database
  console.log("\nNormalizing project names (e.g. correcting typos)...");
  const projsRes = await fetch(`${DB_BASE}/projects?pageSize=100`, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (projsRes.ok) {
    const projsData = await projsRes.json();
    const projDocs = projsData.documents || [];
    for (const doc of projDocs) {
      const pid = doc.name.split("/").pop();
      const name = doc.fields?.name?.stringValue || "";
      if (name.includes("mangment")) {
        const corrected = name.replace("mangment", "Management");
        console.log(`  Correcting project name: "${name}" -> "${corrected}"`);
        
        // Patch project
        await fetch(`${DB_BASE}/projects/${pid}?updateMask.fieldPaths=name`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ fields: { name: { stringValue: corrected } } }),
        });

        // Patch corresponding chat channel if exists
        const chatRes = await fetch(`${DB_BASE}/chats/project_${pid}`, {
          headers: { "Authorization": `Bearer ${idToken}` },
        });
        if (chatRes.ok) {
          console.log(`  Correcting project chat channel name...`);
          await fetch(`${DB_BASE}/chats/project_${pid}?updateMask.fieldPaths=name`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fields: { name: { stringValue: corrected } } }),
          });
        }
      }
    }
  }

  console.log("\n=== Seeding cleanup and normalization completed! ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
});
