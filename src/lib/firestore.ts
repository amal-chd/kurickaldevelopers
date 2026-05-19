import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import {
  AppUser, Role, Project, Task, Subtask, Document as TDocument,
  Attendance, ChatChannel, ChatMessage, SiteDiaryEntry,
  OrgSettings, AuditLog, AppNotification, ContactInquiry,
} from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUser = async (uid: string): Promise<AppUser | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AppUser;
};

export const getAllUsers = async (): Promise<AppUser[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
};

export const updateUser = async (uid: string, data: Partial<AppUser>): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { ...data });
};

export const createUser = async (uid: string, data: Omit<AppUser, 'id'>): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() });
};

export const subscribeUsers = (cb: (users: AppUser[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
  });
};

// ─── Roles ────────────────────────────────────────────────────────────────────
export const getRole = async (roleId: string): Promise<Role | null> => {
  const snap = await getDoc(doc(db, 'roles', roleId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Role;
};

export const getAllRoles = async (): Promise<Role[]> => {
  const snap = await getDocs(collection(db, 'roles'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Role));
};

export const createRole = async (data: Omit<Role, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'roles'), { ...data, createdAt: serverTimestamp() });
  return ref2.id;
};

export const updateRole = async (roleId: string, data: Partial<Role>): Promise<void> => {
  await updateDoc(doc(db, 'roles', roleId), { ...data });
};

export const deleteRole = async (roleId: string): Promise<void> => {
  await deleteDoc(doc(db, 'roles', roleId));
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const getProjects = async (): Promise<Project[]> => {
  const snap = await getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
};

export const getProject = async (id: string): Promise<Project | null> => {
  const snap = await getDoc(doc(db, 'projects', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Project;
};

export const createProject = async (data: Omit<Project, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'projects'), { ...data, createdAt: serverTimestamp() });
  return ref2.id;
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<void> => {
  await updateDoc(doc(db, 'projects', id), { ...data });
};

export const deleteProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'projects', id));
};

export const subscribeProjects = (cb: (projects: Project[]) => void) => {
  return onSnapshot(
    query(collection(db, 'projects'), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)))
  );
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = async (constraints: QueryConstraint[] = []): Promise<Task[]> => {
  const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
};

export const getTask = async (id: string): Promise<Task | null> => {
  const snap = await getDoc(doc(db, 'tasks', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Task;
};

export const createTask = async (data: Omit<Task, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'tasks'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref2.id;
};

export const updateTask = async (id: string, data: Partial<Task>): Promise<void> => {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteTask = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'tasks', id));
};

export const subscribeTasks = (cb: (tasks: Task[]) => void, constraints: QueryConstraint[] = []) => {
  const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))));
};

// ─── Subtasks ─────────────────────────────────────────────────────────────────
export const getSubtasks = async (taskId: string): Promise<Subtask[]> => {
  const snap = await getDocs(collection(db, 'tasks', taskId, 'subtasks'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subtask));
};

export const addSubtask = async (taskId: string, data: Omit<Subtask, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'tasks', taskId, 'subtasks'), data);
  return ref2.id;
};

export const updateSubtask = async (taskId: string, subtaskId: string, data: Partial<Subtask>): Promise<void> => {
  await updateDoc(doc(db, 'tasks', taskId, 'subtasks', subtaskId), { ...data });
};

export const deleteSubtask = async (taskId: string, subtaskId: string): Promise<void> => {
  await deleteDoc(doc(db, 'tasks', taskId, 'subtasks', subtaskId));
};

export const subscribeSubtasks = (taskId: string, cb: (subtasks: Subtask[]) => void) => {
  return onSnapshot(collection(db, 'tasks', taskId, 'subtasks'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subtask)))
  );
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const getDocuments = async (projectId?: string): Promise<TDocument[]> => {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (projectId) constraints.unshift(where('projectId', '==', projectId));
  const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TDocument));
};

export const createDocument = async (data: Omit<TDocument, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'documents'), { ...data, createdAt: serverTimestamp() });
  return ref2.id;
};

export const updateDocument = async (id: string, data: Partial<TDocument>): Promise<void> => {
  await updateDoc(doc(db, 'documents', id), { ...data });
};

export const deleteDocument = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'documents', id));
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const getAttendance = async (date?: string, userId?: string): Promise<Attendance[]> => {
  const constraints: QueryConstraint[] = [];
  if (date) constraints.push(where('date', '==', date));
  if (userId) constraints.push(where('userId', '==', userId));
  const snap = await getDocs(query(collection(db, 'attendance'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
};

export const subscribeAttendance = (date: string, cb: (records: Attendance[]) => void) => {
  return onSnapshot(
    query(collection(db, 'attendance'), where('date', '==', date)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance)))
  );
};

export const getUserAttendanceHistory = async (userId: string, limit2 = 30): Promise<Attendance[]> => {
  const snap = await getDocs(
    query(collection(db, 'attendance'), where('userId', '==', userId), orderBy('date', 'desc'), limit(limit2))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
};

// ─── Chat Channels ────────────────────────────────────────────────────────────
export const subscribeChannels = (userId: string, cb: (channels: ChatChannel[]) => void) => {
  return onSnapshot(
    query(collection(db, 'chats'), where('memberIds', 'array-contains', userId)),
    (snap) => {
      const channels = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ChatChannel))
        .sort((a, b) => {
          const at = (a.lastMessageAt as any)?.toMillis?.() ?? 0;
          const bt = (b.lastMessageAt as any)?.toMillis?.() ?? 0;
          return bt - at;
        });
      cb(channels);
    }
  );
};

export const getChannel = async (channelId: string): Promise<ChatChannel | null> => {
  const snap = await getDoc(doc(db, 'chats', channelId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ChatChannel;
};

export const createChannel = async (data: Omit<ChatChannel, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'chats'), data);
  return ref2.id;
};

export const createChannelWithId = async (id: string, data: Omit<ChatChannel, 'id'>): Promise<void> => {
  await setDoc(doc(db, 'chats', id), data);
};

export const updateChannel = async (id: string, data: Partial<ChatChannel>): Promise<void> => {
  await updateDoc(doc(db, 'chats', id), { ...data });
};

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const subscribeMessages = (
  channelId: string,
  cb: (messages: ChatMessage[]) => void,
  msgLimit = 100
) => {
  return onSnapshot(
    query(
      collection(db, 'chats', channelId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(msgLimit)
    ),
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
      cb(msgs);
    }
  );
};

export const sendMessage = async (channelId: string, data: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<string> => {
  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'chats', channelId, 'messages'));
  batch.set(msgRef, { ...data, createdAt: serverTimestamp() });

  // Get channel members to increment unread for non-senders
  const channelSnap = await getDoc(doc(db, 'chats', channelId));
  const memberIds: string[] = channelSnap.exists() ? (channelSnap.data().memberIds ?? []) : [];

  const channelUpdate: Record<string, any> = {
    lastMessageText: data.isDeleted ? '' : (data.text.length > 80 ? data.text.slice(0, 80) + '…' : data.text),
    lastMessageAt: serverTimestamp(),
    lastMessageBy: data.senderId,
  };
  memberIds.forEach((uid) => {
    if (uid !== data.senderId) {
      channelUpdate[`unreadCounts.${uid}`] = increment(1);
    }
  });
  batch.update(doc(db, 'chats', channelId), channelUpdate);
  await batch.commit();
  return msgRef.id;
};

export const editMessage = async (channelId: string, messageId: string, text: string): Promise<void> => {
  await updateDoc(doc(db, 'chats', channelId, 'messages', messageId), {
    text,
    editedAt: serverTimestamp(),
  });
};

export const deleteMessage = async (channelId: string, messageId: string): Promise<void> => {
  await updateDoc(doc(db, 'chats', channelId, 'messages', messageId), {
    isDeleted: true,
    text: 'This message was deleted',
  });
};

export const addReaction = async (
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'chats', channelId, 'messages', messageId), {
    [`reactions.${emoji}`]: arrayUnion(userId),
  });
};

export const removeReaction = async (
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'chats', channelId, 'messages', messageId), {
    [`reactions.${emoji}`]: arrayRemove(userId),
  });
};

export const markChannelRead = async (channelId: string, userId: string): Promise<void> => {
  await updateDoc(doc(db, 'chats', channelId), {
    [`unreadCounts.${userId}`]: 0,
    [`lastReadAt.${userId}`]: serverTimestamp(),
  });
};

export const setTyping = async (channelId: string, userId: string, name: string): Promise<void> => {
  await setDoc(doc(db, 'chats', channelId, 'typing', userId), {
    name,
    at: serverTimestamp(),
  });
};

export const clearTyping = async (channelId: string, userId: string): Promise<void> => {
  await deleteDoc(doc(db, 'chats', channelId, 'typing', userId));
};

export const subscribeTyping = (channelId: string, cb: (typing: Record<string, string>) => void) => {
  return onSnapshot(collection(db, 'chats', channelId, 'typing'), (snap) => {
    const now = Date.now();
    const result: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const at = data.at as Timestamp;
      if (at && now - at.toMillis() < 10000) {
        result[d.id] = data.name;
      }
    });
    cb(result);
  });
};

// ─── Site Diary ───────────────────────────────────────────────────────────────
export const getSiteDiary = async (projectId?: string): Promise<SiteDiaryEntry[]> => {
  const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
  if (projectId) constraints.unshift(where('projectId', '==', projectId));
  const snap = await getDocs(query(collection(db, 'site_diaries'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SiteDiaryEntry));
};

export const createSiteDiary = async (data: Omit<SiteDiaryEntry, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'site_diaries'), { ...data, createdAt: serverTimestamp() });
  return ref2.id;
};

export const updateSiteDiary = async (id: string, data: Partial<SiteDiaryEntry>): Promise<void> => {
  await updateDoc(doc(db, 'site_diaries', id), { ...data });
};

export const deleteSiteDiary = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'site_diaries', id));
};

// ─── Org Settings ─────────────────────────────────────────────────────────────
export const getOrgSettings = async (): Promise<OrgSettings | null> => {
  const snap = await getDoc(doc(db, 'settings', 'org'));
  if (!snap.exists()) return null;
  return snap.data() as OrgSettings;
};

export const updateOrgSettings = async (data: Partial<OrgSettings>): Promise<void> => {
  await setDoc(doc(db, 'settings', 'org'), data, { merge: true });
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const getAuditLogs = async (pageLimit = 50): Promise<AuditLog[]> => {
  const snap = await getDocs(
    query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(pageLimit))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
};

export const addAuditLog = async (data: Omit<AuditLog, 'id'>): Promise<void> => {
  await addDoc(collection(db, 'audit_logs'), { ...data, createdAt: serverTimestamp() });
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const subscribeNotifications = (userId: string, cb: (notifs: AppNotification[]) => void) => {
  // Two parallel queries: broadcast (userId=='') + targeted (userId==mine)
  // Merge and deduplicate on the client side.
  const results: Record<'broadcast' | 'targeted', AppNotification[]> = {
    broadcast: [],
    targeted: [],
  };
  const emit = () => {
    const merged = [...results.broadcast, ...results.targeted]
      .sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 100);
    cb(merged);
  };

  const unsubBroadcast = onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', ''), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => {
      results.broadcast = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
      emit();
    }
  );

  const unsubTargeted = onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => {
      results.targeted = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
      emit();
    }
  );

  return () => { unsubBroadcast(); unsubTargeted(); };
};

export const markNotificationRead = async (notifId: string, userId: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', notifId), {
    [`isRead.${userId}`]: true,
  });
};

export const markAllNotificationsRead = async (notifIds: string[], userId: string): Promise<void> => {
  const batch = writeBatch(db);
  notifIds.forEach((id) => {
    batch.update(doc(db, 'notifications', id), { [`isRead.${userId}`]: true });
  });
  await batch.commit();
};

export const createNotification = async (data: Omit<AppNotification, 'id'>): Promise<void> => {
  await addDoc(collection(db, 'notifications'), { ...data, createdAt: serverTimestamp() });
};

// ─── Contact Inquiries ────────────────────────────────────────────────────────
export const createContactInquiry = async (
  data: Omit<ContactInquiry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'contact_inquiries'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref2.id;
};

export const getContactInquiries = async (): Promise<ContactInquiry[]> => {
  const snap = await getDocs(
    query(collection(db, 'contact_inquiries'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactInquiry));
};

export const updateContactInquiry = async (
  id: string,
  data: Partial<ContactInquiry>
): Promise<void> => {
  await updateDoc(doc(db, 'contact_inquiries', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteContactInquiry = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'contact_inquiries', id));
};

// re-export helpers
export { serverTimestamp, Timestamp, increment, arrayUnion, arrayRemove };
