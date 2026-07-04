const API_KEY = "AIzaSyA9ZmA9yNSEcrqgGjxReM_-bF3t15Q0Gk8";
const PROJECT_ID = "kurikal-tms-app";

const targetUsers = [
  { name: "Thomas", email: "thomas@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "director" },
  { name: "Ravi", email: "ravi@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "project_manager" },
  { name: "Arjun", email: "arjun@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "site_engineer" },
  { name: "Priya", email: "priya@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "site_engineer" },
  { name: "Suresh", email: "suresh@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "foreman" },
  { name: "Biju", email: "biju@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "labour" },
  { name: "Meena", email: "meena@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "admin" },
  { name: "Anitha", email: "anitha@kurickaldevelopers.com", pass: "Kurickal@2024", roleId: "accounts" },
];

async function run() {
  for (const user of targetUsers) {
    console.log(`Processing ${user.email}...`);
    // 1. Create Auth User
    let uid = null;
    const sigInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.pass, returnSecureToken: true })
    });
    const authData = await sigInRes.json();
    if (authData.error && authData.error.message !== "EMAIL_EXISTS") {
      console.error("Auth Error:", authData.error);
      continue;
    }
    uid = authData.localId;
    
    if (authData.error && authData.error.message === "EMAIL_EXISTS") {
        const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, password: user.pass, returnSecureToken: true })
        });
        const loginData = await loginRes.json();
        uid = loginData.localId;
    }
    
    if (!uid) {
      console.error("Failed to get UID");
      continue;
    }
    console.log(`Auth user UID for ${user.email}:`, uid);

    // 3. Create User Document
    const userPayload = {
      fields: {
        name: { stringValue: user.name },
        email: { stringValue: user.email },
        phone: { stringValue: "+910000000000" },
        roleId: { stringValue: user.roleId },
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
    else console.log(`Seeded user document for ${user.email}`);
  }
}

run().catch(console.error);
