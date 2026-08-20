import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Migrating missing task fields using UPDATE...');
  const snapshot = await db.collection('tasks').get();
  
  if (snapshot.empty) {
    console.log('No tasks found');
    return;
  }

  let i = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { error } = await supabase.from('tasks').update({
      milestone_id: data.milestoneId,
      assignee_ids: data.assigneeIds || (data.assignedTo ? [data.assignedTo] : []),
      assigned_role_id: data.assignedRoleId,
      assigned_role_ids: data.assignedRoleIds || [],
      estimated_hours: data.estimatedHours || 0,
      actual_hours: data.actualHours || 0,
      depends_on: data.dependsOn || [],
      is_recurring: data.isRecurring || false,
      recurrence_rule: data.recurrenceRule,
      is_template: data.isTemplate || false,
      labels: data.tags || data.labels || [],
      attachments: data.attachmentUrls || data.attachments || [],
    }).eq('id', doc.id);
    
    if (error) {
      console.error(`Error updating task ${doc.id}:`, error);
    }
    i++;
    if (i % 10 === 0) console.log(`Updated ${i}/${snapshot.docs.length} tasks`);
  }
}

run().catch(console.error);
