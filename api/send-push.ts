import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// ─── Firebase Admin bootstrap ───────────────────────────────────────────────
// The service account lives only here, in a Vercel env var — never in the
// client bundle. Set FIREBASE_SERVICE_ACCOUNT to the full service-account JSON
// (Project Settings → Service accounts → Generate new private key).
function getAdmin(): admin.app.App {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  const serviceAccount = JSON.parse(raw);
  // When the key is pasted into an env var the \n in private_key become literal
  // backslash-n; restore real newlines so the credential parses.
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const ANDROID_CHANNEL_ID = 'task_pilot_channel';

// Shared per-platform delivery options: high-priority heads-up on Android,
// sound + badge on iOS.
function deliveryOptions() {
  return {
    android: {
      priority: 'high' as const,
      notification: { channelId: ANDROID_CHANNEL_ID, sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };
}

async function tokensFor(
  db: admin.firestore.Firestore,
  uids: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const tokens: string[] = [];
  // getAll is limited to 100 refs per call; chunk to stay safe.
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const snaps = await db.getAll(
      ...chunk.map((uid) => db.collection('users').doc(uid))
    );
    for (const snap of snaps) {
      const token = snap.exists ? (snap.data()?.fcmToken as string | undefined) : undefined;
      if (token) tokens.push(token);
    }
  }
  return tokens;
}

async function sendToTokens(
  messaging: admin.messaging.Messaging,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) return 0;
  let success = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      notification: { title, body },
      data,
      ...deliveryOptions(),
      tokens: chunk,
    });
    success += res.successCount;
  }
  return success;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (harmless for same-origin web; mobile clients ignore it).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let app: admin.app.App;
  try {
    app = getAdmin();
  } catch (e: any) {
    return res.status(500).json({ error: `Server misconfigured: ${e.message}` });
  }
  const db = app.firestore();
  const messaging = app.messaging();

  // ── Verify the caller is an authenticated user ──
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return res.status(401).json({ error: 'Missing bearer token' });
  let caller: admin.auth.DecodedIdToken;
  try {
    caller = await app.auth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const event = body.event as string;

  try {
    // ── Chat message ──────────────────────────────────────────────────────
    if (event === 'chat') {
      const { channelId, messageId } = body;
      if (!channelId || !messageId) {
        return res.status(400).json({ error: 'channelId and messageId required' });
      }
      const channelSnap = await db.collection('chats').doc(channelId).get();
      if (!channelSnap.exists) return res.status(404).json({ error: 'Channel not found' });
      const channel = channelSnap.data()!;
      const memberIds: string[] = channel.memberIds || [];

      // Caller must be a member of the channel — prevents arbitrary triggering.
      if (!memberIds.includes(caller.uid)) {
        return res.status(403).json({ error: 'Not a channel member' });
      }

      const msgSnap = await db
        .collection('chats').doc(channelId)
        .collection('messages').doc(messageId).get();
      if (!msgSnap.exists) return res.status(404).json({ error: 'Message not found' });
      const message = msgSnap.data()!;
      const senderId = message.senderId;

      const senderSnap = await db.collection('users').doc(senderId).get();
      const senderName = senderSnap.exists ? (senderSnap.data()?.name ?? 'Someone') : 'Someone';

      let bodyText: string = message.text || '';
      if (message.type === 'image') bodyText = '📷 Photo';
      else if (message.type === 'file') bodyText = '📎 File';
      else if (message.type === 'task_ref') bodyText = '📌 Task Reference';

      let title: string;
      if (channel.type === 'direct') {
        title = senderName;
      } else {
        title = channel.name || 'New message';
        bodyText = `${senderName}: ${bodyText}`;
      }

      const recipients = memberIds.filter((id) => id !== senderId);
      const tokens = await tokensFor(db, recipients);
      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type: 'chat_message',
        relatedId: channelId,
      });
      return res.status(200).json({ ok: true, sent });
    }

    // ── Task assignment / status change ─────────────────────────────────────
    if (event === 'task') {
      const { taskId, kind } = body; // kind: 'assigned' | 'status'
      if (!taskId) return res.status(400).json({ error: 'taskId required' });
      const taskSnap = await db.collection('tasks').doc(taskId).get();
      if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' });
      const task = taskSnap.data()!;

      let recipients: string[] = [];
      let title = '';
      let bodyText = '';
      let type = '';

      if (kind === 'status') {
        if (task.createdBy) recipients = [task.createdBy];
        title = 'Task Status Updated';
        bodyText = `${task.title} is now ${task.status}`;
        type = 'task_updated';
      } else {
        // Default: assignment. Notify the task's assignees (server reads them,
        // so the client can't target arbitrary users).
        recipients = (task.assigneeIds || []).filter((id: string) => id !== caller.uid);
        title = 'New Task Assigned';
        bodyText = `You have been assigned to: ${task.title}`;
        type = 'task_assigned';
      }

      if (recipients.length === 0) return res.status(200).json({ ok: true, sent: 0 });

      const tokens = await tokensFor(db, recipients);
      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type, relatedId: taskId,
      });
      return res.status(200).json({ ok: true, sent });
    }

    // ── Admin broadcast (push only — in-app docs are written by the client) ──
    if (event === 'broadcast') {
      const { title, body: bodyText, targetRoleId, userIds } = body;
      if (!title || !bodyText) return res.status(400).json({ error: 'title and body required' });

      // Permission gate: caller's role must allow notifications_manage.
      const callerSnap = await db.collection('users').doc(caller.uid).get();
      const roleId = callerSnap.exists ? callerSnap.data()?.roleId : null;
      let allowed = false;
      if (roleId) {
        const roleSnap = await db.collection('roles').doc(roleId).get();
        const perms = roleSnap.exists ? (roleSnap.data()?.permissions ?? {}) : {};
        allowed = perms.notifications_manage === true || perms.roles_manage === true;
      }
      if (!allowed) return res.status(403).json({ error: 'Not allowed to broadcast' });

      // Recipients: explicit user list, else a role filter, else everyone.
      let tokens: string[];
      if (Array.isArray(userIds) && userIds.length > 0) {
        tokens = await tokensFor(db, userIds);
      } else {
        let usersQuery: admin.firestore.Query = db.collection('users');
        if (targetRoleId) usersQuery = usersQuery.where('roleId', '==', targetRoleId);
        const usersSnap = await usersQuery.get();
        tokens = [];
        usersSnap.docs.forEach((d) => {
          const t = d.data()?.fcmToken;
          if (t) tokens.push(t);
        });
      }

      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type: 'admin_broadcast',
      });
      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ error: `Unknown event: ${event}` });
  } catch (e: any) {
    console.error('send-push error:', e);
    return res.status(500).json({ error: e.message ?? 'Internal error' });
  }
}
