import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccountPath = '/Users/amalchand/Desktop/Kurical TMS/kurikal-tms-app-firebase-adminsdk-fbsvc-50a1948b26.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearTable(tableName: string) {
  await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

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

async function run() {
  await migrateCollection('projects', 'projects', (data) => ({
    id: data.id,
    name: data.name,
    description: data.description,
    client_name: data.clientName,
    location: data.location,
    start_date: data.startDate,
    end_date: data.endDate,
    status: data.status,
    member_ids: data.memberIds || [],
    manager_id: data.managerId,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('tasks', 'tasks', (data) => ({
    id: data.id,
    title: data.title,
    description: data.description,
    project_id: data.projectId,
    assigned_to: data.assignedTo,
    created_by: data.createdBy,
    status: data.status,
    priority: data.priority,
    due_date: data.dueDate?.toDate(),
    completed_at: data.completedAt?.toDate(),
    comments: data.comments,
    attachments: data.attachments || [],
    labels: data.labels || [],
    is_archived: data.isArchived || false,
    rejection_reason: data.rejectionReason,
    rejection_count: data.rejectionCount || 0,
    reopen_count: data.reopenCount || 0,
    extension_count: data.extensionCount || 0,
    original_due_date: data.originalDueDate?.toDate(),
    peer_review_status: data.peerReviewStatus,
    manager_review_status: data.managerReviewStatus,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('attendance', 'attendance', (data) => ({
    id: data.id,
    user_id: data.userId,
    date: data.date,
    check_in_time: data.checkInTime?.toDate(),
    check_out_time: data.checkOutTime?.toDate(),
    check_in_lat: data.checkInLocation?.latitude,
    check_in_lng: data.checkInLocation?.longitude,
    check_out_lat: data.checkOutLocation?.latitude,
    check_out_lng: data.checkOutLocation?.longitude,
    check_in_address: data.checkInAddress,
    check_out_address: data.checkOutAddress,
    is_within_geofence: data.isWithinGeofence || false,
    project_id: data.projectId,
    overtime_override_minutes: data.overtimeOverrideMinutes
  }));

  await migrateCollection('chats', 'chat_channels', (data) => ({
    id: data.id,
    type: data.type,
    name: data.name,
    description: data.description,
    project_id: data.projectId,
    icon_emoji: data.iconEmoji,
    member_ids: data.memberIds || [],
    admin_ids: data.adminIds || [],
    created_by: data.createdBy,
    last_message_text: data.lastMessageText,
    last_message_at: data.lastMessageAt?.toDate(),
    last_message_by: data.lastMessageBy,
    is_archived: data.isArchived || false,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('site_diaries', 'site_diaries', (data) => ({
    id: data.id,
    project_id: data.projectId,
    date: data.date,
    progress_notes: data.progressNotes,
    worker_count: data.workerCount || 0,
    issues_notes: data.issuesNotes,
    safety_notes: data.safetyNotes,
    temperature: data.temperature,
    photo_urls: data.photoUrls || [],
    author_id: data.authorId,
    work_done: data.workDone,
    manpower: data.manpower,
    equipment: data.equipment,
    remarks: data.remarks,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('expenses', 'expenses', (data) => ({
    id: data.id,
    user_id: data.userId,
    user_name: data.userName,
    title: data.title,
    category: data.category,
    amount: data.amount,
    date: data.date,
    project_id: data.projectId,
    project_name: data.projectName,
    note: data.note,
    org_id: data.orgId,
    created_at: data.createdAt?.toDate()
  }));

  console.log('Migration Complete!');
}

run().catch(console.error);
