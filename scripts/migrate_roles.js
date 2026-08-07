const API_KEY = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";
const DB_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1`;

async function migrate() {
  console.log("Starting Role Migration...");

  // Login as admin to get token
  console.log("Logging in as admin...");
  const loginRes = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@kurikal.com", password: "password123", returnSecureToken: true })
  });
  const loginData = await loginRes.json();
  if (loginData.error) {
    console.error("Login failed:", loginData.error.message);
    return;
  }
  const idToken = loginData.idToken;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`
  };

  // 1. Migrate Users
  console.log("Fetching users...");
  const usersRes = await fetch(`${DB_BASE}/users`, { headers });
  const usersData = await usersRes.json();
  
  if (usersData.error) {
    console.error("Error fetching users:", usersData.error);
    return;
  }
  if (usersData.documents) {
    console.log(`Found ${usersData.documents.length} users. Migrating to 'director' role...`);
    for (const doc of usersData.documents) {
      const docPath = doc.name.split("/documents/")[1]; // e.g. "users/123"
      const uid = docPath.split("/")[1];
      
      const currentRole = doc.fields?.roleId?.stringValue;
      if (currentRole !== 'director') {
        // Update user to director
        const payload = {
          fields: {
            ...doc.fields,
            roleId: { stringValue: "director" }
          }
        };
        const patchRes = await fetch(`${DB_BASE}/${docPath}`, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify(payload)
        });
        
        if (patchRes.ok) {
          console.log(` ✓ User ${uid} updated to 'director'`);
        } else {
          console.error(` ✗ Failed to update user ${uid}:`, await patchRes.text());
        }
      } else {
        console.log(` - User ${uid} is already 'director'`);
      }
    }
  } else {
    console.log("No users found or error fetching.");
  }

  // 2. Delete Unused Roles
  console.log("\nFetching roles...");
  const rolesRes = await fetch(`${DB_BASE}/roles`, { headers });
  const rolesData = await rolesRes.json();

  if (rolesData.documents) {
    console.log(`Found ${rolesData.documents.length} roles. Cleaning up...`);
    for (const doc of rolesData.documents) {
      const docPath = doc.name.split("/documents/")[1]; // e.g. "roles/admin"
      const roleId = docPath.split("/")[1];
      
      if (roleId !== 'director') {
        console.log(` Deleting role: ${roleId}...`);
        const delRes = await fetch(`${DB_BASE}/${docPath}`, {
          method: "DELETE",
          headers: headers
        });
        if (delRes.ok) {
          console.log(` ✓ Role ${roleId} deleted`);
        } else {
          console.error(` ✗ Failed to delete role ${roleId}:`, await delRes.text());
        }
      } else {
        console.log(` - Skipping 'director' role`);
      }
    }
  } else {
    console.log("No roles found or error fetching.");
  }

  console.log("\nMigration completed successfully!");
}

migrate().catch(console.error);
