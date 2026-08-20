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
import { db, storage } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import {
  AppUser, Role, Project, Task, Subtask, TaskComment, Document as TDocument,
  Attendance, ChatChannel, ChatMessage, SiteDiaryEntry,
  OrgSettings, AppNotification, ContactInquiry, TaskAssignmentConfig,
  PerformanceScore, PerformanceReview, PerformanceConfig,
  LeaveRequest, SalarySlip, Expense,
} from '../../types';
import { calculatePerformanceScore, DEFAULT_PERFORMANCE_CONFIG } from '../performanceEngine';
import { notifyPush } from '../push';

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
