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

async function migrateCollection(collectionName: string, tableName: string, mapper: (doc: any) => any) {
  console.log(`Migrating ${collectionName} to ${tableName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`No documents found in ${collectionName}`);
    return;
  }

  const batchSize = 100;
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = snapshot.docs.slice(i, i + batchSize);
    const rows = batch.map(doc => {
      try {
        return mapper({ id: doc.id, ...doc.data() });
      } catch(e) {
        console.error('Mapper error on doc', doc.id, e);
        return null;
      }
    }).filter(Boolean);
    
    if (rows.length > 0) {
      const { error } = await supabase.from(tableName).upsert(rows);
      if (error) {
        console.error(`Error migrating batch for ${tableName}:`, error);
      } else {
        console.log(`Migrated ${i + rows.length}/${snapshot.docs.length} ${tableName}`);
      }
    }
  }
}

async function migrateSubcollections() {
  console.log('Migrating subcollections (comments, subtasks)...');
  const tasksSnapshot = await db.collection('tasks').get();
  
  for (const taskDoc of tasksSnapshot.docs) {
    const taskId = taskDoc.id;
    
    // Comments
    const commentsSnapshot = await taskDoc.ref.collection('comments').get();
    if (!commentsSnapshot.empty) {
      const comments = commentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          task_id: taskId,
          author_id: data.authorId || '',
          text: data.text || '',
          mentions: data.mentions || [],
          attachment_urls: data.attachmentUrls || [],
          created_at: data.createdAt?.toDate(),
          edited_at: data.editedAt?.toDate()
        };
      });
      const { error } = await supabase.from('comments').upsert(comments);
      if (error) console.error(`Error migrating comments for task ${taskId}:`, error);
    }
    
    // Subtasks
    const subtasksSnapshot = await taskDoc.ref.collection('subtasks').get();
    if (!subtasksSnapshot.empty) {
      const subtasks = subtasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          task_id: taskId,
          title: data.title || '',
          is_done: data.isDone || false,
          completed_by: data.completedBy || null
        };
      });
      const { error } = await supabase.from('subtasks').upsert(subtasks);
      if (error) console.error(`Error migrating subtasks for task ${taskId}:`, error);
    }
  }
  console.log('Subcollections migrated!');
}

async function run() {
  await migrateCollection('performance_scores', 'performance_scores', (data) => ({
    id: data.userId || data.id,
    user_id: data.userId || data.id,
    total_tasks_completed: data.totalTasksCompleted || 0,
    total_tasks_assigned: data.totalTasksAssigned || 0,
    tasks_completed_on_time: data.tasksCompletedOnTime || 0,
    tasks_completed_late: data.tasksCompletedLate || 0,
    tasks_overdue: data.tasksOverdue || 0,
    tasks_rejected: data.tasksRejected || 0,
    average_completion_time_hrs: data.averageCompletionTimeHrs || 0,
    quality_score: data.qualityScore || 0,
    communication_score: data.communicationScore || 0,
    reliability_score: data.reliabilityScore || 0,
    overall_performance_index: data.overallPerformanceIndex || 0,
    points_balance: data.pointsBalance || 0,
    points_lifetime: data.pointsLifetime || 0
  }));

  await migrateCollection('performance_reviews', 'performance_reviews', (data) => ({
    id: data.id,
    task_id: data.taskId,
    reviewer_id: data.reviewerId,
    reviewee_id: data.revieweeId,
    type: data.type,
    score: data.score || 0,
    comment: data.comment,
    created_at: data.createdAt?.toDate()
  }));

  await migrateCollection('settings', 'settings', (data) => ({
    id: data.id || 'org',
    company_name: data.companyName,
    company_logo: data.companyLogo,
    timezone: data.timezone,
    work_start_time: data.workStartTime,
    work_end_time: data.workEndTime,
    geofence_radius: data.geofenceRadius,
    geofence_lat: data.geofenceLat,
    geofence_lng: data.geofenceLng,
    currency: data.currency,
    date_format: data.dateFormat,
    time_format: data.timeFormat,
    theme_color: data.themeColor,
    language: data.language,
    features_enabled: data.featuresEnabled
  }));
  
  await migrateSubcollections();

  console.log('Missing data migration complete!');
}

run().catch(console.error);
