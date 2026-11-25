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

async function run() {
  await migrateCollection('audit_logs', 'audit_logs', (data) => ({
    id: data.id,
    action: data.action,
    actor_id: data.actorId,
    actor_name: data.actorName,
    actor_role: data.actorRole,
    actor_avatar: data.actorAvatar,
    target_id: data.targetId,
    target_type: data.targetType,
    target_name: data.targetName,
    description: data.description,
    changes: data.changes || {},
    ip_address: data.ipAddress,
    user_agent: data.userAgent,
    created_at: data.createdAt?.toDate()
  }));

  await migrateCollection('leave_requests', 'leave_requests', (data) => ({
    id: data.id,
    user_id: data.userId,
    user_name: data.userName,
    role_id: data.roleId,
    type: data.type,
    start_date: data.startDate,
    end_date: data.endDate,
    days: data.days || 0,
    reason: data.reason,
    org_id: data.orgId,
    status: data.status,
    manager_note: data.managerNote,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('salary_slips', 'salary_slips', (data) => ({
    id: data.id,
    user_id: data.userId,
    user_name: data.userName,
    month: data.month,
    basic: data.basic || 0,
    allowances: data.allowances || [],
    deductions: data.deductions || [],
    gross: data.gross || 0,
    total_deductions: data.totalDeductions || 0,
    net: data.net || 0,
    status: data.status,
    org_id: data.orgId,
    created_at: data.createdAt?.toDate()
  }));

  await migrateCollection('contact_inquiries', 'contact_inquiries', (data) => ({
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    project_type: data.projectType,
    message: data.message,
    status: data.status || 'new',
    source: data.source || 'website',
    assigned_to: data.assignedTo,
    notes: data.notes,
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  await migrateCollection('notifications', 'app_notifications', (data) => ({
    id: data.id,
    title: data.title,
    body: data.body,
    user_id: data.userId,
    is_read: data.isRead || {},
    type: data.type,
    related_id: data.relatedId,
    related_type: data.relatedType,
    created_at: data.createdAt?.toDate()
  }));

  await migrateCollection('documents', 'documents', (data) => ({
    id: data.id,
    name: data.name,
    type: data.type,
    url: data.url,
    size: data.size || 0,
    uploaded_by: data.uploadedBy,
    project_id: data.projectId,
    folder_id: data.folderId,
    labels: data.labels || [],
    created_at: data.createdAt?.toDate(),
    updated_at: data.updatedAt?.toDate()
  }));

  console.log('Final data migration complete!');
}

run().catch(console.error);
