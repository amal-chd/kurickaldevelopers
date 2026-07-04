const API_KEY = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";

async function run() {
  console.log("Creating auth user...");
  // 1. Create Auth User
  const sigInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@kurikal.com", password: "password123", returnSecureToken: true })
  });
  const authData = await sigInRes.json();
  if (authData.error && authData.error.message !== "EMAIL_EXISTS") {
    console.error("Auth Error:", authData.error);
    return;
  }
  let uid = authData.localId;
  
  if (authData.error && authData.error.message === "EMAIL_EXISTS") {
      const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@kurikal.com", password: "password123", returnSecureToken: true })
      });
      const loginData = await loginRes.json();
      uid = loginData.localId;
  }
  
  if (!uid) {
    console.error("Failed to get UID");
    return;
  }
  console.log("Auth user UID:", uid);

  // 2. Create Admin Role
  console.log("Creating admin role...");
  const rolePayload = {
    fields: {
      name: { stringValue: "Director / Owner" },
      description: { stringValue: "Full access to all features and settings" },
      color: { stringValue: "#1A3A5C" },
      isSystem: { booleanValue: true },
      createdBy: { stringValue: "system" },
      createdAt: { integerValue: String(Date.now()) },
      permissions: {
        mapValue: {
          fields: {
            "tasks_view": { booleanValue: true },
            "tasks_create": { booleanValue: true },
            "tasks_edit": { booleanValue: true },
            "tasks_delete": { booleanValue: true },
            "tasks_approve": { booleanValue: true },
            "projects_view": { booleanValue: true },
            "projects_create": { booleanValue: true },
            "projects_edit": { booleanValue: true },
            "docs_view": { booleanValue: true },
            "docs_upload": { booleanValue: true },
            "docs_approve": { booleanValue: true },
            "team_view": { booleanValue: true },
            "team_manage": { booleanValue: true },
            "team_delete": { booleanValue: true },
            "reports_view": { booleanValue: true },
            "reports_export": { booleanValue: true },
            "roles_manage": { booleanValue: true },
            "settings_manage": { booleanValue: true },
            "time_log": { booleanValue: true },
            "time_view_all": { booleanValue: true },
            "notifications_manage": { booleanValue: true }
          }
        }
      }
    }
  };

  const roleRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/roles/director`, {
    method: "PATCH", // PATCH with no ?updateMask works like a set/create
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rolePayload)
  });
  if (!roleRes.ok) console.error("Role Error:", await roleRes.text());

  // 3. Create User Document
  console.log("Creating user document...");
  const userPayload = {
    fields: {
      name: { stringValue: "System Admin" },
      email: { stringValue: "admin@kurikal.com" },
      phone: { stringValue: "+910000000000" },
      roleId: { stringValue: "director" },
      isActive: { booleanValue: true },
      biometricEnabled: { booleanValue: false },
      createdAt: { integerValue: String(Date.now()) },
      lastLoginAt: { integerValue: String(Date.now()) }
    }
  };

  const dbRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userPayload)
  });
  if (!dbRes.ok) console.error("User DB Error:", await dbRes.text());
  else console.log("Seeding complete!");
}

run();
