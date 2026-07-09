import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import admin from "npm:firebase-admin@11.10.1";

// ─── CORS Headers ────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─── Firebase Admin Bootstrap ────────────────────────────────────────────────
let firebaseApp: admin.app.App | null = null;

function getAdminApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;
  
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  const serviceAccount = JSON.parse(raw);
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return firebaseApp;
}

const ANDROID_CHANNEL_ID = "task_pilot_channel";

function deliveryOptions() {
  return {
    android: {
      priority: "high" as const,
      notification: { channelId: ANDROID_CHANNEL_ID, sound: "default" },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1 } },
    },
  };
}

async function tokensFor(
  db: admin.firestore.Firestore,
  uids: string[],
  eventType?: string
): Promise<string[]> {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const tokens: string[] = [];
  
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const snaps = await db.getAll(
      ...chunk.map((uid) => db.collection("users").doc(uid))
    );
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() || {};
      
      // Respect notification preferences
      const preferences = data.preferences || {};
      if (eventType === "announcement" && preferences.announcements === false) {
        continue;
      }
      if (eventType === "chat" && preferences.chats === false) {
        continue;
      }
      if (eventType === "task" && preferences.tasks === false) {
        continue;
      }
      
      const token = data.fcmToken as string | undefined;
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

// ─── Edge Function Server ────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight.
  // NOTE: a 204 response must have a NULL body — passing "ok" with status 204
  // makes Deno's Response constructor throw, which surfaced as a 500 on every
  // browser preflight and broke all web → edge-function calls.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let app: admin.app.App;
  try {
    app = getAdminApp();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Server misconfigured: ${e.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = app.firestore();
  const messaging = app.messaging();

  // Verify caller ID token
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let caller: admin.auth.DecodedIdToken;
  try {
    caller = await app.auth().verifyIdToken(idToken);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const event = body.event as string;

    // ── Chat Event ──
    if (event === "chat") {
      const { channelId, messageId } = body;
      if (!channelId || !messageId) {
        return new Response(JSON.stringify({ error: "channelId and messageId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channelSnap = await db.collection("chats").doc(channelId).get();
      if (!channelSnap.exists) {
        return new Response(JSON.stringify({ error: "Channel not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const channel = channelSnap.data()!;
      const memberIds: string[] = channel.memberIds || [];

      if (!memberIds.includes(caller.uid)) {
        return new Response(JSON.stringify({ error: "Not a channel member" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msgSnap = await db
        .collection("chats").doc(channelId)
        .collection("messages").doc(messageId).get();
      if (!msgSnap.exists) {
        return new Response(JSON.stringify({ error: "Message not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const message = msgSnap.data()!;
      const senderId = message.senderId;

      const senderSnap = await db.collection("users").doc(senderId).get();
      const senderName = senderSnap.exists ? (senderSnap.data()?.name ?? "Someone") : "Someone";

      let bodyText: string = message.text || "";
      if (message.type === "image") bodyText = "📷 Photo";
      else if (message.type === "file") bodyText = "📎 File";
      else if (message.type === "task_ref") bodyText = "📌 Task Reference";

      const isAnnouncement = channel.type === "announcement";
      const eventType = isAnnouncement ? "announcement" : "chat";

      let title: string;
      if (isAnnouncement) {
        title = `Announcement in ${channel.name || "Group"}`;
        bodyText = `${senderName}: ${bodyText}`;
      } else if (channel.type === "direct") {
        title = senderName;
      } else {
        title = channel.name || "New message";
        bodyText = `${senderName}: ${bodyText}`;
      }

      const recipients = memberIds.filter((id) => id !== senderId);
      const tokens = await tokensFor(db, recipients, eventType);
      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type: isAnnouncement ? "announcement" : "chat_message",
        relatedId: channelId,
      });

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Task Event ──
    if (event === "task") {
      const { taskId, kind } = body;
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const taskSnap = await db.collection("tasks").doc(taskId).get();
      if (!taskSnap.exists) {
        return new Response(JSON.stringify({ error: "Task not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const task = taskSnap.data()!;

      let recipients: string[] = [];
      let title = "";
      let bodyText = "";
      let type = "";

      if (kind === "status") {
        if (task.createdBy) recipients = [task.createdBy];
        title = "Task Status Updated";
        bodyText = `${task.title} is now ${task.status}`;
        type = "task_updated";
      } else {
        recipients = (task.assigneeIds || []).filter((id: string) => id !== caller.uid);

        // Role-based assignment: also notify every user holding one of the
        // task's assignedRoleIds (server-derived — the client sends only ids).
        const roleIds: string[] = task.assignedRoleIds ||
          (task.assignedRoleId ? [task.assignedRoleId] : []);
        for (let i = 0; i < roleIds.length; i += 10) {
          const chunk = roleIds.slice(i, i + 10);
          const usersSnap = await db
            .collection("users")
            .where("roleId", "in", chunk)
            .get();
          usersSnap.docs.forEach((d) => {
            if (d.id !== caller.uid && d.data()?.isActive !== false) {
              recipients.push(d.id);
            }
          });
        }

        title = "New Task Assigned";
        bodyText = `You have been assigned to: ${task.title}`;
        type = "task_assigned";
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokens = await tokensFor(db, recipients, "task");
      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type,
        relatedId: taskId,
      });

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Broadcast Event ──
    if (event === "broadcast") {
      const { title, body: bodyText, targetRoleId, userIds } = body;
      if (!title || !bodyText) {
        return new Response(JSON.stringify({ error: "title and body required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callerSnap = await db.collection("users").doc(caller.uid).get();
      const roleId = callerSnap.exists ? callerSnap.data()?.roleId : null;
      let allowed = false;
      if (roleId) {
        const roleSnap = await db.collection("roles").doc(roleId).get();
        const perms = roleSnap.exists ? (roleSnap.data()?.permissions ?? {}) : {};
        allowed = perms.notifications_manage === true || perms.roles_manage === true;
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Not allowed to broadcast" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let tokens: string[];
      if (Array.isArray(userIds) && userIds.length > 0) {
        tokens = await tokensFor(db, userIds);
      } else {
        let usersQuery: admin.firestore.Query = db.collection("users");
        if (targetRoleId) usersQuery = usersQuery.where("roleId", "==", targetRoleId);
        const usersSnap = await usersQuery.get();
        tokens = [];
        usersSnap.docs.forEach((d) => {
          const t = d.data()?.fcmToken;
          if (t) tokens.push(t);
        });
      }

      const sent = await sendToTokens(messaging, tokens, title, bodyText, {
        type: "admin_broadcast",
      });

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Delete User Event ──
    if (event === "delete_user") {
      const { targetUid } = body;
      if (!targetUid) {
        return new Response(JSON.stringify({ error: "targetUid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (caller.uid === targetUid) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callerSnap = await db.collection("users").doc(caller.uid).get();
      const roleId = callerSnap.exists ? callerSnap.data()?.roleId : null;
      let allowed = false;
      let callerLevel = 0;
      if (roleId) {
        const roleSnap = await db.collection("roles").doc(roleId).get();
        const perms = roleSnap.exists ? (roleSnap.data()?.permissions ?? {}) : {};
        allowed = perms.team_manage === true || perms.roles_manage === true;
        callerLevel = roleSnap.exists ? (roleSnap.data()?.level ?? 0) : 0;
      }

      if (!allowed) {
        return new Response(JSON.stringify({ error: "Not allowed to delete users" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hierarchy guard: cannot delete a user whose role outranks yours
      // (e.g. an Admin must not be able to delete the Director). Mirrors the
      // myLevel() constraint used in the Firestore rules for role changes.
      const targetSnap = await db.collection("users").doc(targetUid).get();
      if (targetSnap.exists) {
        const targetRoleId = targetSnap.data()?.roleId;
        if (targetRoleId) {
          const targetRoleSnap = await db.collection("roles").doc(targetRoleId).get();
          const targetLevel = targetRoleSnap.exists ? (targetRoleSnap.data()?.level ?? 0) : 0;
          if (targetLevel > callerLevel) {
            return new Response(
              JSON.stringify({ error: "Cannot delete a user with a higher role level" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      try {
        await app.auth().deleteUser(targetUid);
      } catch (e: any) {
        if (e.code !== "auth/user-not-found") {
          throw e;
        }
      }

      // Unified schema keys notifications on `userId`; also sweep the legacy
      // `recipientId` field so pre-migration docs are cleaned up too.
      for (const field of ["userId", "recipientId"]) {
        const notificationsSnap = await db
          .collection("notifications")
          .where(field, "==", targetUid)
          .get();
        if (!notificationsSnap.empty) {
          const batch = db.batch();
          notificationsSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      const attendanceSnap = await db
        .collection("attendance")
        .where("userId", "==", targetUid)
        .get();
      if (!attendanceSnap.empty) {
        const batch = db.batch();
        attendanceSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      const privateSnap = await db
        .collection("users")
        .doc(targetUid)
        .collection("private")
        .get();
      if (!privateSnap.empty) {
        const batch = db.batch();
        privateSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      // Performance data: the score doc plus reviews about the deleted user
      // (reviews they wrote about others are kept — they concern other users).
      await db.collection("performance_scores").doc(targetUid).delete()
        .catch(() => {});
      const reviewsSnap = await db
        .collection("performance_reviews")
        .where("revieweeId", "==", targetUid)
        .get();
      if (!reviewsSnap.empty) {
        const batch = db.batch();
        reviewsSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }


      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Reset Password Event ──
    if (event === "reset_password") {
      const { targetUid, newPassword } = body;
      if (!targetUid || !newPassword) {
        return new Response(JSON.stringify({ error: "targetUid and newPassword required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify caller permissions
      const callerSnap = await db.collection("users").doc(caller.uid).get();
      const roleId = callerSnap.exists ? callerSnap.data()?.roleId : null;
      let allowed = false;
      let callerLevel = 0;
      if (roleId) {
        const roleSnap = await db.collection("roles").doc(roleId).get();
        const perms = roleSnap.exists ? (roleSnap.data()?.permissions ?? {}) : {};
        allowed = perms.team_manage === true || perms.roles_manage === true;
        callerLevel = roleSnap.exists ? (roleSnap.data()?.level ?? 0) : 0;
      }

      if (!allowed) {
        return new Response(JSON.stringify({ error: "Not allowed to reset passwords" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hierarchy guard: cannot reset password for a user whose role outranks yours
      const targetSnap = await db.collection("users").doc(targetUid).get();
      if (targetSnap.exists) {
        const targetRoleId = targetSnap.data()?.roleId;
        if (targetRoleId) {
          const targetRoleSnap = await db.collection("roles").doc(targetRoleId).get();
          const targetLevel = targetRoleSnap.exists ? (targetRoleSnap.data()?.level ?? 0) : 0;
          if (targetLevel > callerLevel) {
            return new Response(
              JSON.stringify({ error: "Cannot reset password for a user with a higher role level" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      // Update the user's password via Firebase Admin SDK (no old password needed)
      await app.auth().updateUser(targetUid, { password: newPassword });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
