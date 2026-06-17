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
import { useAuthStore } from '../store/authStore';
import {
  AppUser, Role, Project, Task, Subtask, Document as TDocument,
  Attendance, ChatChannel, ChatMessage, SiteDiaryEntry,
  OrgSettings, AuditLog, AppNotification, ContactInquiry, TaskAssignmentConfig,
} from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────
export const getUser = async (uid: string): Promise<AppUser | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AppUser;
  } catch (err: any) {
    console.warn('Gracefully handled getUser error:', err);
    return null;
  }
};

export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
  } catch (err: any) {
    console.warn('Gracefully handled getAllUsers error:', err);
    return [];
  }
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
  try {
    const snap = await getDoc(doc(db, 'roles', roleId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Role;
  } catch (err: any) {
    console.warn('Gracefully handled getRole error:', err);
    return null;
  }
};

export const getAllRoles = async (): Promise<Role[]> => {
  try {
    const snap = await getDocs(collection(db, 'roles'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Role));
  } catch (err: any) {
    console.warn('Gracefully handled getAllRoles error:', err);
    return [];
  }
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
  try {
    const { firebaseUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;

    if (!uid) return [];

    let q;
    if (permissions.projects_view) {
      q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
    }

    const snap = await getDocs(q);
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));

    if (!permissions.projects_view) {
      projects.sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
        return tb - ta;
      });
    }

    return projects;
  } catch (err: any) {
    console.warn('Gracefully handled getProjects error:', err);
    return [];
  }
};

export const getProject = async (id: string): Promise<Project | null> => {
  try {
    const snap = await getDoc(doc(db, 'projects', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Project;
  } catch (err: any) {
    console.warn('Gracefully handled getProject error:', err);
    return null;
  }
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
  const { firebaseUser, permissions } = useAuthStore.getState();
  const uid = firebaseUser?.uid;

  if (!uid) {
    cb([]);
    return () => {};
  }

  let q;
  if (permissions.projects_view) {
    q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
  } else {
    q = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
  }

  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    if (!permissions.projects_view) {
      projects.sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
        return tb - ta;
      });
    }
    cb(projects);
  });
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = async (constraints: QueryConstraint[] = []): Promise<Task[]> => {
  try {
    const { firebaseUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;

    if (!uid) return [];

    if (permissions.tasks_view) {
      try {
        const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      } catch (err: any) {
        console.warn('Gracefully handled tasks_view tasks fetch error:', err);
        return [];
      }
    }

    if (constraints.length > 0) {
      try {
        const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      } catch (err: any) {
        console.warn('Gracefully handled tasks fetch error with constraints:', err);
        return [];
      }
    }

    const tasksMap = new Map<string, Task>();

    try {
      const qAssignee = query(collection(db, 'tasks'), where('assigneeIds', 'array-contains', uid));
      const assigneeSnap = await getDocs(qAssignee);
      assigneeSnap.docs.forEach((d) => {
        tasksMap.set(d.id, { id: d.id, ...d.data() } as Task);
      });
    } catch (err: any) {
      console.warn('Gracefully handled assignee tasks fetch error:', err);
    }

    try {
      const qCreated = query(collection(db, 'tasks'), where('createdBy', '==', uid));
      const createdSnap = await getDocs(qCreated);
      createdSnap.docs.forEach((d) => {
        tasksMap.set(d.id, { id: d.id, ...d.data() } as Task);
      });
    } catch (err: any) {
      console.warn('Gracefully handled created tasks fetch error:', err);
    }

    const myProjects = await getProjects();
    const myProjectIds = myProjects.map((p) => p.id);

    if (myProjectIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < myProjectIds.length; i += 10) {
        chunks.push(myProjectIds.slice(i, i + 10));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const qProj = query(collection(db, 'tasks'), where('projectId', 'in', chunk));
            const projSnap = await getDocs(qProj);
            projSnap.docs.forEach((d) => {
              tasksMap.set(d.id, { id: d.id, ...d.data() } as Task);
            });
          } catch (err: any) {
            console.warn('Gracefully handled projects chunk task fetch error:', err);
          }
        })
      );
    }

    const tasks = Array.from(tasksMap.values());
    tasks.sort((a, b) => {
      const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
      const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
      return tb - ta;
    });

    return tasks;
  } catch (err: any) {
    console.warn('Gracefully handled getTasks top-level error:', err);
    return [];
  }
};

export const getTask = async (id: string): Promise<Task | null> => {
  try {
    const snap = await getDoc(doc(db, 'tasks', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Task;
  } catch (err: any) {
    console.warn('Gracefully handled getTask error:', err);
    return null;
  }
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
  const { firebaseUser, permissions } = useAuthStore.getState();
  const uid = firebaseUser?.uid;

  if (!uid) {
    cb([]);
    return () => {};
  }

  if (permissions.tasks_view) {
    const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))));
  }

  if (constraints.length > 0) {
    const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))),
      (err) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
          console.warn('Gracefully handled tasks subscription permission denial:', err);
          cb([]);
        }
      }
    );
  }

  let assigneeTasks: Task[] = [];
  let createdTasks: Task[] = [];
  const projectTasksMap = new Map<string, Task[]>();
  let projectUnsubs: (() => void)[] = [];

  const emit = () => {
    const mergedMap = new Map<string, Task>();
    assigneeTasks.forEach((t) => mergedMap.set(t.id, t));
    createdTasks.forEach((t) => mergedMap.set(t.id, t));
    projectTasksMap.forEach((tasksList) => {
      tasksList.forEach((t) => mergedMap.set(t.id, t));
    });

    const tasks = Array.from(mergedMap.values());
    tasks.sort((a, b) => {
      const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt as any)?.seconds * 1000 || 0;
      const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt as any)?.seconds * 1000 || 0;
      return tb - ta;
    });
    cb(tasks);
  };

  const unsubAssignee = onSnapshot(
    query(collection(db, 'tasks'), where('assigneeIds', 'array-contains', uid)),
    (snap) => {
      assigneeTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      emit();
    },
    (err) => console.warn('Assignee tasks sub error:', err)
  );

  const unsubCreated = onSnapshot(
    query(collection(db, 'tasks'), where('createdBy', '==', uid)),
    (snap) => {
      createdTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      emit();
    },
    (err) => console.warn('Created tasks sub error:', err)
  );

  const unsubProjects = subscribeProjects((projects) => {
    const myProjectIds = projects.map((p) => p.id);

    projectUnsubs.forEach((unsub) => unsub());
    projectUnsubs = [];
    projectTasksMap.clear();

    if (myProjectIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < myProjectIds.length; i += 10) {
        chunks.push(myProjectIds.slice(i, i + 10));
      }

      chunks.forEach((chunk, index) => {
        const qProj = query(collection(db, 'tasks'), where('projectId', 'in', chunk));
        const unsubProj = onSnapshot(
          qProj,
          (snap) => {
            projectTasksMap.set(
              index.toString(),
              snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
            );
            emit();
          },
          (err) => console.warn(`Project chunk ${index} tasks sub error:`, err)
        );
        projectUnsubs.push(unsubProj);
      });
    } else {
      emit();
    }
  });

  return () => {
    unsubAssignee();
    unsubCreated();
    unsubProjects();
    projectUnsubs.forEach((unsub) => unsub());
  };
};

// ─── Subtasks ─────────────────────────────────────────────────────────────────
export const getSubtasks = async (taskId: string): Promise<Subtask[]> => {
  try {
    const snap = await getDocs(collection(db, 'tasks', taskId, 'subtasks'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subtask));
  } catch (err: any) {
    console.warn('Gracefully handled getSubtasks error:', err);
    return [];
  }
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
  try {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (projectId) constraints.unshift(where('projectId', '==', projectId));
    const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TDocument));
  } catch (err: any) {
    console.warn('Gracefully handled getDocuments error:', err);
    return [];
  }
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
  try {
    const constraints: QueryConstraint[] = [];
    if (date) constraints.push(where('date', '==', date));
    if (userId) constraints.push(where('userId', '==', userId));
    const snap = await getDocs(query(collection(db, 'attendance'), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
  } catch (err: any) {
    console.warn('Gracefully handled getAttendance error:', err);
    return [];
  }
};

export const subscribeAttendance = (date: string, cb: (records: Attendance[]) => void) => {
  return onSnapshot(
    query(collection(db, 'attendance'), where('date', '==', date)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance)))
  );
};

export const getUserAttendanceHistory = async (userId: string, limit2 = 30): Promise<Attendance[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'attendance'), where('userId', '==', userId), orderBy('date', 'desc'), limit(limit2))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
  } catch (err: any) {
    console.warn('Gracefully handled getUserAttendanceHistory error:', err);
    return [];
  }
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
  try {
    const snap = await getDoc(doc(db, 'chats', channelId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ChatChannel;
  } catch (err: any) {
    console.warn('Gracefully handled getChannel error:', err);
    return null;
  }
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

// Soft-delete a conversation: archived channels are hidden from every member's
// chat list.
export const archiveChannel = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'chats', id), { isArchived: true });
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
  // Recompute the channel preview from the latest non-deleted message so the
  // chat list never shows stale or deleted text for this channel.
  await syncChannelPreview(channelId);
};

// Recompute a channel's last-message preview from its most recent non-deleted
// message. Clears the preview when no visible message remains.
export const syncChannelPreview = async (channelId: string): Promise<void> => {
  const snap = await getDocs(
    query(
      collection(db, 'chats', channelId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  );
  const lastVisible = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
    .find((m) => !m.isDeleted);

  if (!lastVisible) {
    await updateDoc(doc(db, 'chats', channelId), {
      lastMessageText: '',
      lastMessageBy: '',
    });
    return;
  }

  const text = lastVisible.text.length > 80
    ? lastVisible.text.slice(0, 80) + '…'
    : lastVisible.text;
  await updateDoc(doc(db, 'chats', channelId), {
    lastMessageText: text,
    lastMessageBy: lastVisible.senderId,
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
  try {
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
    if (projectId) constraints.unshift(where('projectId', '==', projectId));
    const snap = await getDocs(query(collection(db, 'site_diaries'), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SiteDiaryEntry));
  } catch (err: any) {
    console.warn('Gracefully handled getSiteDiary error:', err);
    return [];
  }
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
  try {
    const snap = await getDoc(doc(db, 'settings', 'org'));
    if (!snap.exists()) return null;
    return snap.data() as OrgSettings;
  } catch (err: any) {
    console.warn('Gracefully handled getOrgSettings error:', err);
    return null;
  }
};

export const updateOrgSettings = async (data: Partial<OrgSettings>): Promise<void> => {
  await setDoc(doc(db, 'settings', 'org'), data, { merge: true });
};

// ─── Task Assignment Config ─────────────────────────────────────────────────
export const getTaskAssignmentConfig = async (): Promise<TaskAssignmentConfig | null> => {
  const snap = await getDoc(doc(db, 'settings', 'task_assignment'));
  if (!snap.exists()) return null;
  return snap.data() as TaskAssignmentConfig;
};

export const updateTaskAssignmentConfig = async (
  data: Partial<TaskAssignmentConfig>,
): Promise<void> => {
  await setDoc(
    doc(db, 'settings', 'task_assignment'),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
};

export const subscribeTaskAssignmentConfig = (
  cb: (config: TaskAssignmentConfig | null) => void,
) => {
  return onSnapshot(
    doc(db, 'settings', 'task_assignment'),
    (snap) => cb(snap.exists() ? (snap.data() as TaskAssignmentConfig) : null),
    (err) => { console.warn('subscribeTaskAssignmentConfig error:', err.code); cb(null); },
  );
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const getAuditLogs = async (pageLimit = 50): Promise<AuditLog[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(pageLimit))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (err: any) {
    console.warn('Gracefully handled getAuditLogs error:', err);
    return [];
  }
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
    },
    (err) => {
      console.warn('Gracefully handled notifications broadcast subscription error:', err);
      results.broadcast = [];
      emit();
    }
  );

  const unsubTargeted = onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50)),
    (snap) => {
      results.targeted = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
      emit();
    },
    (err) => {
      console.warn('Gracefully handled notifications targeted subscription error:', err);
      results.targeted = [];
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
  try {
    const snap = await getDocs(
      query(collection(db, 'contact_inquiries'), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactInquiry));
  } catch (err: any) {
    console.warn('Gracefully handled getContactInquiries error:', err);
    return [];
  }
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
