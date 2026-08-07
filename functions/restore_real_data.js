const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = '/Users/amalchand/Desktop/Kurical TMS/kurikal-tms-app-firebase-adminsdk-fbsvc-50a1948b26.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fromRest(val) {
  if (val && typeof val === 'object') {
    if ('stringValue' in val) return val.stringValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return admin.firestore.Timestamp.fromDate(new Date(val.timestampValue));
    if ('arrayValue' in val) {
      const list = val.arrayValue.values || [];
      return list.map(fromRest);
    }
    if ('mapValue' in val) {
      const res = {};
      const fields = val.mapValue.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        res[k] = fromRest(v);
      }
      return res;
    }
  }
  return val;
}

function convertFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    res[k] = fromRest(v);
  }
  return res;
}

async function run() {
  console.log('Starting data restoration...\n');

  // Load the extracted JSON data
  const dataPath = '/Users/amalchand/.gemini/antigravity/brain/46f5837e-29dc-4599-9449-96dd2345853a/scratch/extracted_firestore_data.json';
  if (!fs.existsSync(dataPath)) {
    console.error('Error: extracted_firestore_data.json not found!');
    return;
  }
  
  const extractedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // 1. Delete the temporary seed projects created earlier
  const tempProjectIds = ['js4rayQ9aIln6op5OgiL', 'G5IgVKqZbj7P2mbsM1pV', 'OaosY4OQaOQ3JAvM7IFM'];
  console.log('Deleting temporary seed projects...');
  for (const pid of tempProjectIds) {
    // Delete milestones subcollection first
    const milestonesSnap = await db.collection('projects').doc(pid).collection('milestones').get();
    for (const doc of milestonesSnap.docs) {
      await doc.ref.delete();
    }
    await db.collection('projects').doc(pid).delete();
    console.log(`  - Deleted temp project: ${pid}`);
  }

  // 2. Restore Roles
  console.log('\nRestoring custom & system roles...');
  const roles = extractedData.roles || {};
  for (const [key, roleDoc] of Object.entries(roles)) {
    const docId = key.split('/')[1];
    const fields = convertFields(roleDoc.fields || {});
    await db.collection('roles').doc(docId).set(fields);
    console.log(`  ✓ Restored role: ${docId} (${fields.name || 'N/A'})`);
  }

  // 3. Restore Users
  console.log('\nRestoring custom & system users...');
  const users = extractedData.users || {};
  for (const [key, userDoc] of Object.entries(users)) {
    const docId = key.split('/')[1];
    const fields = convertFields(userDoc.fields || {});
    await db.collection('users').doc(docId).set(fields);
    console.log(`  ✓ Restored user: ${docId} (${fields.name || 'N/A'}, ${fields.email || 'N/A'})`);
  }

  // 4. Restore Projects
  console.log('\nRestoring real projects...');
  const projects = extractedData.projects || {};
  for (const [key, projDoc] of Object.entries(projects)) {
    const docId = key.split('/')[1];
    const fields = convertFields(projDoc.fields || {});
    await db.collection('projects').doc(docId).set(fields);
    console.log(`  ✓ Restored project: ${docId} (${fields.name || 'N/A'})`);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  ✅  Restoration Complete!                       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
}

run().catch(console.error);
