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
  PerformanceScore, PerformanceReview, PerformanceConfig,
} from '../types';
import { calculatePerformanceScore, DEFAULT_PERFORMANCE_CONFIG } from './performanceEngine';

// Helper to log detailed, production-grade diagnostic information for permission/authorization errors
export const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('denied');
  if (isPermissionError) {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    console.error(`[AUTHORIZATION ERROR] Action: ${actionName} failed with permission-denied.`, {
      errorMessage: error.message,
      errorCode: error.code,
      currentUserUid: firebaseUser?.uid ?? 'not-authenticated',
      currentUserRole: appUser?.roleId ?? 'no-role-assigned',
      userPermissions: permissions,
      context,
    });
  } else {
    console.warn(`[API ERROR] Action: ${actionName} failed.`, error, context);
  }
};

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

export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid));
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
    if (permissions.projects_view_all) {
      q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
    }

    const snap = await getDocs(q);
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));

    if (!permissions.projects_view_all) {
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
  if (permissions.projects_view_all) {
    q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
  } else {
    q = query(collection(db, 'projects'), where('memberIds', 'array-contains', uid));
  }

  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    if (!permissions.projects_view_all) {
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
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;
    const roleId = appUser?.roleId;

    if (!uid) return [];

    if (permissions.tasks_view_all) {
      try {
        const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      } catch (err: any) {
        logPermissionError('getTasks (tasks_view_all query)', err);
        return [];
      }
    }

    if (constraints.length > 0) {
      try {
        const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      } catch (err: any) {
        logPermissionError('getTasks (constraints query)', err);
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
      logPermissionError('getTasks (assignee query)', err);
    }

    if (roleId) {
      try {
        const qRole = query(collection(db, 'tasks'), where('assignedRoleIds', 'array-contains', roleId));
        const roleSnap = await getDocs(qRole);
        roleSnap.docs.forEach((d) => {
          tasksMap.set(d.id, { id: d.id, ...d.data() } as Task);
        });
      } catch (err: any) {
        logPermissionError('getTasks (role query)', err);
      }
    }

    try {
      const qCreated = query(collection(db, 'tasks'), where('createdBy', '==', uid));
      const createdSnap = await getDocs(qCreated);
      createdSnap.docs.forEach((d) => {
        tasksMap.set(d.id, { id: d.id, ...d.data() } as Task);
      });
    } catch (err: any) {
      logPermissionError('getTasks (created query)', err);
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
            logPermissionError('getTasks (projects chunk query)', err);
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
    logPermissionError('getTasks (top-level)', err);
    return [];
  }
};

export const getTask = async (id: string): Promise<Task | null> => {
  try {
    const snap = await getDoc(doc(db, 'tasks', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Task;
  } catch (err: any) {
    logPermissionError('getTask', err, { id });
    return null;
  }
};

export const createTask = async (data: Omit<Task, 'id'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'tasks'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (data.assigneeIds && data.assigneeIds.length > 0) {
    data.assigneeIds.forEach(uid => {
      recalculatePerformanceScore(uid).catch(err => console.warn('Error recalculating score on task create:', err));
    });
  }
  return ref2.id;
};

export const updateTask = async (id: string, data: Partial<Task>): Promise<void> => {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: serverTimestamp() });
  try {
    const taskDoc = await getDoc(doc(db, 'tasks', id));
    if (taskDoc.exists()) {
      const task = taskDoc.data() as Task;
      if (task.assigneeIds) {
        task.assigneeIds.forEach(uid => {
          recalculatePerformanceScore(uid).catch(err => console.warn('Error recalculating score on task update:', err));
        });
      }
    }
  } catch (err) {
    console.warn('Error triggering recalculation in updateTask:', err);
  }
};

export const deleteTask = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'tasks', id));
};

export const subscribeTasks = (cb: (tasks: Task[]) => void, constraints: QueryConstraint[] = []) => {
  const { firebaseUser, appUser, permissions } = useAuthStore.getState();
  const uid = firebaseUser?.uid;
  const roleId = appUser?.roleId;

  if (!uid) {
    cb([]);
    return () => {};
  }

  if (permissions.tasks_view_all) {
    const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))));
  }

  if (constraints.length > 0) {
    const q = query(collection(db, 'tasks'), ...constraints, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))),
      (err) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          logPermissionError('subscribeTasks (constraints query)', err);
          cb([]);
        }
      }
    );
  }

  let assigneeTasks: Task[] = [];
  let roleTasks: Task[] = [];
  let createdTasks: Task[] = [];
  const projectTasksMap = new Map<string, Task[]>();
  let projectUnsubs: (() => void)[] = [];

  const emit = () => {
    const mergedMap = new Map<string, Task>();
    assigneeTasks.forEach((t) => mergedMap.set(t.id, t));
    roleTasks.forEach((t) => mergedMap.set(t.id, t));
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
    (err) => logPermissionError('subscribeTasks (assignee query)', err)
  );

  let unsubRole = () => {};
  if (roleId) {
    unsubRole = onSnapshot(
      query(collection(db, 'tasks'), where('assignedRoleIds', 'array-contains', roleId)),
      (snap) => {
        roleTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
        emit();
      },
      (err) => logPermissionError('subscribeTasks (role query)', err)
    );
  }

  const unsubCreated = onSnapshot(
    query(collection(db, 'tasks'), where('createdBy', '==', uid)),
    (snap) => {
      createdTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      emit();
    },
    (err) => logPermissionError('subscribeTasks (created query)', err)
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
          (err) => logPermissionError(`subscribeTasks (project chunk ${index} query)`, err)
        );
        projectUnsubs.push(unsubProj);
      });
    } else {
      emit();
    }
  });

  return () => {
    unsubAssignee();
    unsubRole();
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
    const { firebaseUser, permissions } = useAuthStore.getState();
    const uid = firebaseUser?.uid;
    if (!uid) return [];

    const mapDoc = (d: any) => {
      const data = d.data();
      const createdAt = data.createdAt || data.uploadedAt || null;
      const url = data.url || data.fileUrl || '';
      const size = typeof data.size === 'number' ? data.size : (data.fileSize || 0);
      return { id: d.id, ...data, createdAt, url, size } as TDocument;
    };

    const sortDocs = (docs: TDocument[]) => {
      return docs.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
    };

    if (permissions.docs_view_all) {
      const constraints: QueryConstraint[] = [];
      if (projectId) constraints.push(where('projectId', '==', projectId));
      const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
      return sortDocs(snap.docs.map(mapDoc));
    }

    const docsMap = new Map<string, TDocument>();

    // Fetch my own uploads
    try {
      const constraints: QueryConstraint[] = [where('uploadedBy', '==', uid)];
      if (projectId) constraints.push(where('projectId', '==', projectId));
      const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
      snap.docs.forEach((d) => docsMap.set(d.id, mapDoc(d)));
    } catch (e) {
      logPermissionError('getDocuments (uploadedBy)', e);
    }

    // Fetch project docs
    if (projectId) {
      try {
        const snap = await getDocs(query(collection(db, 'documents'), where('projectId', '==', projectId)));
        snap.docs.forEach((d) => docsMap.set(d.id, mapDoc(d)));
      } catch (e) {
        logPermissionError('getDocuments (projectId)', e);
      }
    } else {
      const myProjects = await getProjects();
      const myProjectIds = myProjects.map((p) => p.id);
      if (myProjectIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < myProjectIds.length; i += 10) chunks.push(myProjectIds.slice(i, i + 10));
        await Promise.all(
          chunks.map(async (chunk) => {
            try {
              const snap = await getDocs(query(collection(db, 'documents'), where('projectId', 'in', chunk)));
              snap.docs.forEach((d) => docsMap.set(d.id, mapDoc(d)));
            } catch (e) {
              logPermissionError('getDocuments (projects chunk)', e);
            }
          })
        );
      }
    }

    return sortDocs(Array.from(docsMap.values()));
  } catch (err: any) {
    console.warn('Gracefully handled getDocuments error:', err);
    return [];
  }
};

export const createDocument = async (data: Omit<TDocument, 'id'>): Promise<string> => {
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    uploadedAt: serverTimestamp(),
    fileUrl: data.url || '',
    fileSize: data.size || 0,
    type: 'other' // default type for mobile compatibility
  };
  const ref2 = await addDoc(collection(db, 'documents'), payload);
  return ref2.id;
};

export const updateDocument = async (id: string, data: Partial<TDocument>): Promise<void> => {
  const updates: Record<string, any> = { ...data };
  if (data.url !== undefined) {
    updates.fileUrl = data.url;
  }
  if (data.size !== undefined) {
    updates.fileSize = data.size;
  }
  await updateDoc(doc(db, 'documents', id), updates);
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
  // The user's own channels + all company announcement channels (visible to all
  // staff via chat_view), merged and deduped so announcements always show.
  const buckets: Record<'mine' | 'announce', ChatChannel[]> = { mine: [], announce: [] };
  const emit = () => {
    const byId = new Map<string, ChatChannel>();
    [...buckets.mine, ...buckets.announce].forEach((c) => byId.set(c.id, c));
    const channels = Array.from(byId.values()).sort((a, b) => {
      const at = (a.lastMessageAt as any)?.toMillis?.() ?? 0;
      const bt = (b.lastMessageAt as any)?.toMillis?.() ?? 0;
      return bt - at;
    });
    cb(channels);
  };

  const unsubMine = onSnapshot(
    query(collection(db, 'chats'), where('memberIds', 'array-contains', userId)),
    (snap) => { buckets.mine = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatChannel)); emit(); },
    (err) => { console.warn('subscribeChannels(mine) error:', err.code); buckets.mine = []; emit(); },
  );

  const unsubAnnounce = onSnapshot(
    query(collection(db, 'chats'), where('type', '==', 'announcement')),
    (snap) => { buckets.announce = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatChannel)); emit(); },
    (err) => { console.warn('subscribeChannels(announce) error:', err.code); buckets.announce = []; emit(); },
  );

  return () => { unsubMine(); unsubAnnounce(); };
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

// Deterministic project channel id so web + mobile share one channel per project.
export const projectChannelId = (projectId: string) => `project_${projectId}`;

// Keeps a project's chat channel membership in sync with the project. Creates
// the channel on first call, then upserts memberIds (project members + manager)
// on every project edit — so adding a member to a project adds them to the chat.
export const syncProjectChannel = async (
  projectId: string,
  projectName: string,
  memberIds: string[],
  projectManagerId: string,
): Promise<void> => {
  const id = projectChannelId(projectId);
  const members = Array.from(new Set([...memberIds, projectManagerId].filter(Boolean)));
  const existing = await getChannel(id);
  if (existing) {
    await updateChannel(id, { name: projectName, memberIds: members });
  } else {
    await createChannelWithId(id, {
      type: 'project',
      name: projectName,
      createdBy: projectManagerId,
      memberIds: members,
      adminIds: projectManagerId ? [projectManagerId] : [],
      lastMessageText: 'Project channel created',
      lastMessageBy: '',
      unreadCounts: {},
      lastReadAt: {},
      isArchived: false,
    });
  }
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

  // Get channel details
  const channelSnap = await getDoc(doc(db, 'chats', channelId));
  const channelData = channelSnap.exists() ? channelSnap.data() : null;
  const channelType = channelData?.type ?? '';
  const channelName = channelData?.name ?? 'Group';
  const memberIds: string[] = channelData?.memberIds ?? [];

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

  // If this is an announcement channel, create targeted in-app notifications
  if (channelType === 'announcement') {
    let senderName = 'Someone';
    try {
      const senderSnap = await getDoc(doc(db, 'users', data.senderId));
      if (senderSnap.exists()) {
        senderName = senderSnap.data().name || senderSnap.data().email || 'Someone';
      }
    } catch (_) {}

    let bodyText = data.text || '';
    if (data.type === 'image') bodyText = '📷 Photo';
    else if (data.type === 'file') bodyText = '📎 File';
    else if (data.type === 'task_ref') bodyText = '📌 Task Reference';

    const truncatedBody = bodyText.length > 150 ? bodyText.slice(0, 150) + '…' : bodyText;

    for (const uid of memberIds) {
      if (uid === data.senderId) continue;
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData?.preferences?.announcements === false) {
            continue;
          }
        }
      } catch (_) {}

      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: uid,
        type: 'announcement',
        title: `Announcement in ${channelName}`,
        body: `${senderName}: ${truncatedBody}`,
        relatedId: channelId,
        relatedType: 'chat',
        isRead: {},
        createdAt: serverTimestamp(),
      });
    }
  }

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
    const constraints: QueryConstraint[] = [];
    if (projectId) constraints.push(where('projectId', '==', projectId));
    const snap = await getDocs(query(collection(db, 'site_diaries'), ...constraints));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Normalize: prefer mobile field names, fall back to legacy web fields
        progressNotes: data.progressNotes || data.workDone || '',
        workerCount: data.workerCount ?? data.manpower ?? 0,
        issuesNotes: data.issuesNotes || '',
        safetyNotes: data.safetyNotes || data.remarks || '',
        temperature: data.temperature ?? null,
        photoUrls: data.photoUrls ?? [],
        createdAt: data.createdAt || data.updatedAt || null,
      } as SiteDiaryEntry;
    }).sort((a, b) => {
      // Sort by date descending (client-side to avoid index requirements)
      return (b.date || '').localeCompare(a.date || '');
    });
  } catch (err: any) {
    console.warn('Gracefully handled getSiteDiary error:', err);
    return [];
  }
};

export const createSiteDiary = async (data: Omit<SiteDiaryEntry, 'id'>): Promise<string> => {
  // Write both mobile and web fields for cross-platform compatibility
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Ensure mobile fields are written
    progressNotes: data.progressNotes || '',
    workerCount: data.workerCount ?? 0,
    issuesNotes: data.issuesNotes || '',
    safetyNotes: data.safetyNotes || '',
    // Also write legacy web fields for backward compat
    workDone: data.progressNotes || '',
    manpower: data.workerCount ?? 0,
    remarks: data.safetyNotes || '',
  };
  const ref2 = await addDoc(collection(db, 'site_diaries'), payload);
  return ref2.id;
};

export const updateSiteDiary = async (id: string, data: Partial<SiteDiaryEntry>): Promise<void> => {
  const updates: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  // Sync legacy web fields when mobile fields are updated
  if (data.progressNotes !== undefined) updates.workDone = data.progressNotes;
  if (data.workerCount !== undefined) updates.manpower = data.workerCount;
  if (data.safetyNotes !== undefined) updates.remarks = data.safetyNotes;
  await updateDoc(doc(db, 'site_diaries', id), updates);
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

export const createNotification = async (data: Omit<AppNotification, 'id' | 'createdAt'> & { createdAt?: any }): Promise<void> => {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    createdAt: data.createdAt || serverTimestamp(),
  });
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

// ─── Performance Score & Points Engine ────────────────────────────────────────
export const getPerformanceScore = async (userId: string): Promise<PerformanceScore | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'performance_scores', userId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PerformanceScore;
    }
    return null;
  } catch (err: any) {
    logPermissionError('getPerformanceScore', err, { userId });
    return null;
  }
};

export const getAllPerformanceScores = async (): Promise<PerformanceScore[]> => {
  try {
    const snap = await getDocs(collection(db, 'performance_scores'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceScore));
  } catch (err: any) {
    logPermissionError('getAllPerformanceScores', err);
    return [];
  }
};

export const subscribePerformanceScores = (cb: (scores: PerformanceScore[]) => void) => {
  return onSnapshot(
    collection(db, 'performance_scores'),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceScore)))
  );
};

export const getPerformanceReviews = async (taskId: string): Promise<PerformanceReview[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'performance_reviews'), where('taskId', '==', taskId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceReview));
  } catch (err: any) {
    console.warn('Gracefully handled getPerformanceReviews error:', err);
    return [];
  }
};

export const submitPerformanceReview = async (review: Omit<PerformanceReview, 'id' | 'createdAt'>): Promise<string> => {
  const ref2 = await addDoc(collection(db, 'performance_reviews'), {
    ...review,
    createdAt: serverTimestamp(),
  });
  recalculatePerformanceScore(review.revieweeId).catch(err => console.warn('Error recalculating score on review submit:', err));
  return ref2.id;
};

export const getPerformanceConfig = async (): Promise<PerformanceConfig> => {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'performance_config'));
    if (docSnap.exists()) {
      return docSnap.data() as PerformanceConfig;
    }
    return DEFAULT_PERFORMANCE_CONFIG;
  } catch (err: any) {
    console.warn('getPerformanceConfig error:', err);
    return DEFAULT_PERFORMANCE_CONFIG;
  }
};

export const updatePerformanceConfig = async (data: Partial<PerformanceConfig>): Promise<void> => {
  const { firebaseUser } = useAuthStore.getState();
  await setDoc(doc(db, 'settings', 'performance_config'), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: firebaseUser?.email || 'admin',
  }, { merge: true });
};

export const recalculatePerformanceScore = async (userId: string): Promise<PerformanceScore> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    throw new Error('User not found');
  }
  const user = { id: userDoc.id, ...userDoc.data() } as AppUser;
  const roleId = user.roleId || '';

  const taskSnap = await getDocs(collection(db, 'tasks'));
  const allTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
  const userTasks = allTasks.filter(t => 
    t.assigneeIds?.includes(userId) || 
    t.createdBy === userId || 
    (t.assignedRoleIds && t.assignedRoleIds.includes(roleId)) ||
    (t.assignedRoleId && t.assignedRoleId === roleId)
  );

  const reviewSnap = await getDocs(query(collection(db, 'performance_reviews'), where('revieweeId', '==', userId)));
  const userReviews = reviewSnap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceReview));

  const attSnap = await getDocs(query(collection(db, 'attendance'), where('userId', '==', userId)));
  const userAttendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));

  const config = await getPerformanceConfig();

  const score = calculatePerformanceScore(userId, userTasks, userReviews, userAttendance, config, roleId);

  const oldScoreDoc = await getDoc(doc(db, 'performance_scores', userId));
  const oldScore = oldScoreDoc.exists() ? oldScoreDoc.data() as PerformanceScore : null;

  const allScores = await getAllPerformanceScores();
  const sortedOldScores = [...allScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const oldRank = sortedOldScores.findIndex(s => s.userId === userId) + 1;

  await setDoc(doc(db, 'performance_scores', userId), score);

  const updatedScores = allScores.map(s => s.userId === userId ? score : s);
  if (!allScores.some(s => s.userId === userId)) {
    updatedScores.push(score);
  }
  const sortedNewScores = [...updatedScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const newRank = sortedNewScores.findIndex(s => s.userId === userId) + 1;

  const formatBadgeName = (badgeId: string): string => {
    return badgeId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (oldScore) {
    // 1. Badge earned
    const newBadges = score.badges.filter(b => !oldScore.badges.includes(b));
    newBadges.forEach(b => {
      createNotification({
        title: '🏆 Achievement Unlocked!',
        body: `🏆 You earned the ${formatBadgeName(b)} badge!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    });

    // 2. Rank change
    if (oldRank > 0 && newRank < oldRank) {
      createNotification({
        title: '📈 Leaderboard Rank Up!',
        body: `📈 You moved up to #${newRank} in the org leaderboard!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    }

    // 3. Streak milestone
    if (score.consecutiveSuccesses > oldScore.consecutiveSuccesses && score.consecutiveSuccesses % 5 === 0) {
      createNotification({
        title: '🔥 On-Time Streak!',
        body: `🔥 ${score.consecutiveSuccesses} tasks completed on time in a row!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    }

    // 4. OPI milestone
    if (score.overallPerformanceIndex >= 80 && oldScore.overallPerformanceIndex < 80) {
      createNotification({
        title: '⭐ OPI Milestone!',
        body: `⭐ Your OPI reached ${score.overallPerformanceIndex}! Great work!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    }

    // 5. At-risk alert to managers
    const opiDrop = oldScore.overallPerformanceIndex - score.overallPerformanceIndex;
    if (opiDrop >= 15) {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
        const rolesSnap = await getDocs(collection(db, 'roles'));
        const allRoles = rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
        
        const managerRoles = allRoles.filter(r => r.permissions.tasks_approve || r.permissions.team_manage).map(r => r.id);
        const managers = allUsers.filter(u => managerRoles.includes(u.roleId));
        
        managers.forEach(m => {
          createNotification({
            title: '⚠️ At-Risk Team Member Alert',
            body: `⚠️ ${user.name}'s OPI dropped ${opiDrop} points this week`,
            userId: m.id,
            type: 'alert',
            isRead: {},
          }).catch(e => console.warn('Manager alert failed:', e));
        });
      } catch (err) {
        console.warn('Failed to alert managers:', err);
      }
    }
  } else {
    // Initial score calculations
    score.badges.forEach(b => {
      createNotification({
        title: '🏆 Achievement Unlocked!',
        body: `🏆 You earned the ${formatBadgeName(b)} badge!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    });

    if (score.overallPerformanceIndex >= 80) {
      createNotification({
        title: '⭐ OPI Milestone!',
        body: `⭐ Your OPI reached ${score.overallPerformanceIndex}! Great work!`,
        userId,
        type: 'milestone',
        isRead: {},
      }).catch(e => console.warn('Notification failed:', e));
    }
  }

  return score;
};
