const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Triggers when a new chat message is created.
 * Sends a push notification to all channel members except the sender.
 */
exports.onChatMessage = functions.firestore
  .document('chats/{channelId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const channelId = context.params.channelId;

    // Get the channel details
    const channelDoc = await db.collection('chats').doc(channelId).get();
    if (!channelDoc.exists) return null;

    const channel = channelDoc.data();
    const memberIds = channel.memberIds || [];
    const senderId = message.senderId;

    // Get all recipient users (everyone except sender)
    const recipientIds = memberIds.filter(id => id !== senderId);
    if (recipientIds.length === 0) return null;

    // Fetch the sender's details for the notification body
    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().name : 'Someone';

    // Get FCM tokens for recipients
    const tokens = [];
    for (const uid of recipientIds) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        tokens.push(userDoc.data().fcmToken);
      }
    }

    if (tokens.length === 0) return null;

    let bodyText = message.text;
    if (message.type === 'image') bodyText = '📷 Photo';
    else if (message.type === 'file') bodyText = '📎 File';
    else if (message.type === 'task_ref') bodyText = '📌 Task Reference';

    let titleText = channel.name ? `${channel.name}` : `New message from ${senderName}`;
    if (channel.type === 'direct') {
      titleText = senderName;
    } else {
      bodyText = `${senderName}: ${bodyText}`;
    }

    const payload = {
      notification: {
        title: titleText,
        body: bodyText,
      },
      // type/relatedId match the client's deep-link router (FcmService):
      // tapping a chat push opens the channel.
      data: {
        type: 'chat_message',
        relatedId: channelId,
      },
      android: {
        priority: 'high',
        notification: { channelId: 'task_pilot_channel', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      tokens: tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(payload);
      console.log(`Successfully sent chat message to ${response.successCount} devices`);
      return null;
    } catch (error) {
      console.error('Error sending chat push notification:', error);
      return null;
    }
  });

/**
 * Triggers when a task is created or updated.
 * Sends a push notification to assignees and creates a notification document.
 */
exports.onTaskChange = functions.firestore
  .document('tasks/{taskId}')
  .onWrite(async (change, context) => {
    // If deleted, do nothing
    if (!change.after.exists) return null;

    const task = change.after.data();
    const prevTask = change.before.exists ? change.before.data() : null;
    const taskId = context.params.taskId;

    // Check if new assignees were added
    const newAssignees = task.assigneeIds || [];
    const oldAssignees = prevTask ? (prevTask.assigneeIds || []) : [];

    const assignedUsers = newAssignees.filter(id => !oldAssignees.includes(id));
    
    // Check if task is due soon or overdue (could be handled by scheduled function, but let's just handle assignment and status here)
    let notifyUsers = [];
    let title = '';
    let body = '';
    let type = '';

    if (assignedUsers.length > 0) {
      // New assignments
      notifyUsers = assignedUsers;
      title = 'New Task Assigned';
      body = `You have been assigned to: ${task.title}`;
      type = 'task_assigned';
    } else if (prevTask && prevTask.status !== task.status && task.createdBy) {
      // Status changed - notify creator
      notifyUsers = [task.createdBy];
      title = 'Task Status Updated';
      body = `${task.title} is now ${task.status}`;
      type = 'task_updated';
    } else {
      return null;
    }

    if (notifyUsers.length === 0) return null;

    const tokens = [];
    const batch = db.batch();

    for (const uid of notifyUsers) {
      // Create Notification Document
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        recipientId: uid,
        type: type,
        title: title,
        body: body,
        relatedId: taskId,
        relatedType: 'task',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get Token for push
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        tokens.push(userDoc.data().fcmToken);
      }
    }

    await batch.commit();

    if (tokens.length > 0) {
      const payload = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: type,
          relatedId: taskId,
        },
        android: {
          priority: 'high',
          notification: { channelId: 'task_pilot_channel', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
        tokens: tokens,
      };

      try {
        await messaging.sendEachForMulticast(payload);
        console.log('Sent task notification');
      } catch (error) {
        console.error('Error sending task notification:', error);
      }
    }

    return null;
  });

/**
 * Keeps each project's chat channel membership in exact sync with the project.
 *
 * The project channel (chats doc with type === 'project' and a matching
 * projectId) is the single source of truth that both the web and Flutter
 * clients read. Clients seed it lazily on first open, but never re-sync it,
 * so membership drifts as people are added to / removed from the project.
 *
 * This trigger makes the channel authoritative:
 *   - project created/updated -> channel members = project.memberIds + manager
 *   - channel auto-created if it does not exist yet (so it always exists)
 *   - project deleted -> channel archived
 */
exports.onProjectWrite = functions.firestore
  .document('projects/{projectId}')
  .onWrite(async (change, context) => {
    const projectId = context.params.projectId;

    // Find the existing project channel (admin SDK bypasses the membership
    // read rule, so a simple type+projectId query reliably returns the one doc).
    const channelSnap = await db
      .collection('chats')
      .where('type', '==', 'project')
      .where('projectId', '==', projectId)
      .limit(1)
      .get();
    const channelDoc = channelSnap.empty ? null : channelSnap.docs[0];

    // Project deleted -> archive the channel so it drops out of every member's
    // list but the history is preserved.
    if (!change.after.exists) {
      if (channelDoc && !channelDoc.data().isArchived) {
        await channelDoc.ref.update({ isArchived: true });
      }
      return null;
    }

    const project = change.after.data();

    // Desired membership: every project member plus the manager, de-duped and
    // with empty values stripped. Manager field differs between clients
    // (web: managerId, Flutter: projectManagerId).
    const managerId = project.managerId || project.projectManagerId || null;
    const desiredMembers = Array.from(
      new Set([...(project.memberIds || []), managerId].filter(Boolean))
    );

    if (channelDoc) {
      const channel = channelDoc.data();
      const current = channel.memberIds || [];
      const sameMembers =
        current.length === desiredMembers.length &&
        desiredMembers.every((id) => current.includes(id));
      const sameName = channel.name === project.name;

      if (sameMembers && sameName) return null;

      const update = { memberIds: desiredMembers, name: project.name };

      // Drop unread/last-read bookkeeping for members who left the project so
      // the channel doc doesn't accumulate stale per-user entries.
      const removed = current.filter((id) => !desiredMembers.includes(id));
      for (const uid of removed) {
        update[`unreadCounts.${uid}`] = admin.firestore.FieldValue.delete();
        update[`lastReadAt.${uid}`] = admin.firestore.FieldValue.delete();
      }

      await channelDoc.ref.update(update);
      return null;
    }

    // No channel yet (older project, or created before this trigger existed) —
    // create one so the project always has a channel with the right members.
    const newRef = db.collection('chats').doc();
    await newRef.set({
      id: newRef.id,
      type: 'project',
      name: project.name || 'Project',
      description: `Project channel for ${project.name || 'project'}`,
      projectId: projectId,
      iconEmoji: '🏗️',
      memberIds: desiredMembers,
      adminIds: managerId ? [managerId] : [],
      createdBy: managerId || (desiredMembers[0] ?? ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageText: 'Channel created',
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageBy: null,
      isArchived: false,
      unreadCounts: {},
    });
    return null;
  });

// The company-wide announcement channel has a fixed, well-known id (seeded in
// scripts/seed_all.js). Every active user belongs to it.
const ANNOUNCEMENTS_CHANNEL_ID = 'ch_announcements';

/**
 * Keeps the company announcement channel's membership in sync with the user
 * base so every active member receives company announcements — and people who
 * are deactivated or deleted drop out.
 *
 * Membership only changes on three transitions (created, deleted, isActive
 * flipped), so routine writes like lastLoginAt / profile edits short-circuit
 * before touching the channel.
 */
exports.onUserWrite = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;

    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // A user counts as a member while they exist and are not deactivated
    // (isActive defaults to true when absent, matching the seed behaviour).
    const wasMember = !!before && before.isActive !== false;
    const isMember = !!after && after.isActive !== false;

    // No membership-relevant change — skip without reading the channel.
    if (wasMember === isMember) return null;

    const channelRef = db.collection('chats').doc(ANNOUNCEMENTS_CHANNEL_ID);
    const channelSnap = await channelRef.get();

    // Self-heal: if the announcement channel doesn't exist yet, create it from
    // the current set of active users.
    if (!channelSnap.exists) {
      if (!isMember) return null;
      const usersSnap = await db
        .collection('users')
        .where('isActive', '==', true)
        .get();
      const memberIds = Array.from(
        new Set([...usersSnap.docs.map((d) => d.id), uid])
      );
      await channelRef.set({
        id: ANNOUNCEMENTS_CHANNEL_ID,
        type: 'announcement',
        name: 'Company Announcements',
        description: 'Official company-wide announcements',
        projectId: null,
        iconEmoji: '📢',
        memberIds: memberIds,
        adminIds: [],
        createdBy: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageText: '',
        lastMessageAt: null,
        lastMessageBy: null,
        isArchived: false,
        unreadCounts: {},
      });
      return null;
    }

    if (isMember) {
      await channelRef.update({
        memberIds: admin.firestore.FieldValue.arrayUnion(uid),
      });
    } else {
      await channelRef.update({
        memberIds: admin.firestore.FieldValue.arrayRemove(uid),
        [`unreadCounts.${uid}`]: admin.firestore.FieldValue.delete(),
        [`lastReadAt.${uid}`]: admin.firestore.FieldValue.delete(),
      });
    }
    return null;
  });

/**
 * Triggers when an admin schedules a broadcast notification.
 */
exports.onAdminBroadcast = functions.firestore
  .document('broadcast_notifications/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const title = data.title;
    const body = data.body;
    const targetRoleId = data.targetRoleId; // Single role ID or null for all
    const extraData = data.data || {};

    let usersQuery = db.collection('users');
    if (targetRoleId) {
      usersQuery = usersQuery.where('roleId', '==', targetRoleId);
    }

    const usersSnap = await usersQuery.get();
    const tokens = [];
    const batch = db.batch();

    usersSnap.forEach(userDoc => {
      const userData = userDoc.data();
      
      // Create Notification Document for each user
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        recipientId: userDoc.id,
        type: 'admin_broadcast',
        title: title,
        body: body,
        relatedId: context.params.docId,
        relatedType: 'broadcast',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
      }
    });

    await batch.commit();

    let successCount = 0;
    if (tokens.length > 0) {
      // Send in chunks of 500 (FCM limit)
      const chunkSize = 500;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        const payload = {
          notification: {
            title: title,
            body: body,
          },
          data: {
            type: 'admin_broadcast',
            ...extraData
          },
          android: {
            priority: 'high',
            notification: { channelId: 'task_pilot_channel', sound: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
          tokens: chunk,
        };
        const response = await messaging.sendEachForMulticast(payload);
        successCount += response.successCount;
      }
    }

    // Update the broadcast document status
    return snap.ref.update({
      status: 'sent',
      recipientsCount: tokens.length,
      successCount: successCount
    });
  });

/**
 * Triggers when a user document is deleted from Firestore.
 * Deletes the user from Firebase Authentication and cleans up user-specific database records.
 */
exports.onUserDelete = functions.firestore
  .document('users/{uid}')
  .onDelete(async (snap, context) => {
    const uid = context.params.uid;

    // 1. Delete user from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
      console.log(`Successfully deleted auth user: ${uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`Auth user not found for UID: ${uid}`);
      } else {
        console.error(`Error deleting auth user for UID: ${uid}`, error);
      }
    }

    // 2. Clean up notifications for this user
    try {
      const notificationsSnap = await db
        .collection('notifications')
        .where('recipientId', '==', uid)
        .get();
      
      if (!notificationsSnap.empty) {
        const batch = db.batch();
        notificationsSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Successfully deleted ${notificationsSnap.size} notifications for UID: ${uid}`);
      }
    } catch (error) {
      console.error(`Error cleaning up notifications for UID: ${uid}`, error);
    }

    // 3. Clean up attendance for this user
    try {
      const attendanceSnap = await db
        .collection('attendance')
        .where('userId', '==', uid)
        .get();
      
      if (!attendanceSnap.empty) {
        const batch = db.batch();
        attendanceSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Successfully deleted ${attendanceSnap.size} attendance records for UID: ${uid}`);
      }
    } catch (error) {
      console.error(`Error cleaning up attendance for UID: ${uid}`, error);
    }

    // 4. Clean up private subcollection documents
    try {
      const privateSnap = await db
        .collection('users')
        .doc(uid)
        .collection('private')
        .get();
      
      if (!privateSnap.empty) {
        const batch = db.batch();
        privateSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Successfully deleted ${privateSnap.size} private subcollection documents for UID: ${uid}`);
      }
    } catch (error) {
      console.error(`Error cleaning up private documents for UID: ${uid}`, error);
    }

    return null;
  });

