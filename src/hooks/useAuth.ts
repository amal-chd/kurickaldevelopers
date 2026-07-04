import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuthStore } from '../store/authStore';
import { getUser, getRole } from '../lib/firestore';
import { registerFcm, clearFcmToken } from '../lib/fcm';

// ─── Default roles seeded on first boot ─────────────────────────────────────

const DEFAULT_ROLES = [
  {
    id: 'director',
    name: 'Director / Owner',
    description: 'Full access to all features and settings',
    color: '#1A3A5C',
    level: 100,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_view_all: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_view_all: true, projects_create: true, projects_edit: true, projects_delete: true,
      docs_view: true, docs_view_all: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true, team_delete: true,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      roles_manage: true, settings_manage: true, notifications_manage: true,
      chat_view: true, chat_send: true, chat_create_group: true, chat_announce: true, chat_moderate: true,
      attendance_view_all: true,
      contact_view: true, contact_manage: true,
    },
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access — team, roles, settings',
    color: '#9C27B0',
    level: 90,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_view_all: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_view_all: true, projects_create: true, projects_edit: true, projects_delete: false,
      docs_view: true, docs_view_all: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true, team_delete: true,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      roles_manage: true, settings_manage: true, notifications_manage: true,
      chat_view: true, chat_send: true, chat_create_group: true, chat_announce: false, chat_moderate: true,
      attendance_view_all: true,
      contact_view: true, contact_manage: true,
    },
  },
  {
    id: 'project_manager',
    name: 'Project Manager',
    description: 'Manages projects, tasks, and team assignments',
    color: '#2196F3',
    level: 80,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_view_all: true, tasks_create: true, tasks_edit: true, tasks_delete: false, tasks_approve: true,
      projects_view: true, projects_view_all: true, projects_create: true, projects_edit: true, projects_delete: false,
      docs_view: true, docs_view_all: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: false,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      roles_manage: false, settings_manage: false, notifications_manage: false,
      chat_view: true, chat_send: true, chat_create_group: true, chat_announce: false, chat_moderate: false,
      attendance_view_all: true,
      contact_view: true, contact_manage: false,
    },
  },
  {
    id: 'accounts',
    name: 'Accounts',
    description: 'Finance, reports, and document access',
    color: '#4CAF50',
    level: 50,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_view_all: true, tasks_create: false, tasks_edit: false, tasks_delete: false, tasks_approve: false,
      projects_view: true, projects_view_all: true, projects_create: false, projects_edit: false, projects_delete: false,
      docs_view: true, docs_view_all: true, docs_upload: true, docs_approve: false,
      team_view: true, team_manage: false,
      reports_view: true, reports_export: true,
      time_log: false, time_view_all: true,
      roles_manage: false, settings_manage: false, notifications_manage: false,
      chat_view: true, chat_send: true, chat_create_group: false, chat_announce: false, chat_moderate: false,
      attendance_view_all: true,
      contact_view: true, contact_manage: false,
    },
  },
  {
    id: 'site_engineer',
    name: 'Site Engineer',
    description: 'Field engineer — tasks, site diary, documents',
    color: '#009688',
    level: 60,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: false, tasks_approve: false,
      projects_view: true, projects_create: false, projects_edit: false, projects_delete: false,
      docs_view: true, docs_upload: true, docs_approve: false,
      team_view: true, team_manage: false,
      reports_view: true, reports_export: false,
      time_log: true, time_view_all: false,
      roles_manage: false, settings_manage: false, notifications_manage: false,
      chat_view: true, chat_send: true, chat_create_group: false, chat_announce: false, chat_moderate: false,
      attendance_view_all: false,
      contact_view: false, contact_manage: false,
    },
  },
  {
    id: 'foreman',
    name: 'Foreman',
    description: 'Site foreman — limited task and attendance access',
    color: '#F59E0B',
    level: 40,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: false, tasks_edit: true, tasks_delete: false, tasks_approve: false,
      projects_view: true, projects_create: false, projects_edit: false, projects_delete: false,
      docs_view: true, docs_upload: false, docs_approve: false,
      team_view: true, team_manage: false,
      reports_view: false, reports_export: false,
      time_log: true, time_view_all: false,
      roles_manage: false, settings_manage: false, notifications_manage: false,
      chat_view: true, chat_send: true, chat_create_group: false, chat_announce: false, chat_moderate: false,
      attendance_view_all: false,
      contact_view: false, contact_manage: false,
    },
  },
  {
    id: 'labour',
    name: 'Labour',
    description: 'Site worker — attendance and basic task view only',
    color: '#9E9E9E',
    level: 20,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: false, tasks_edit: false, tasks_delete: false, tasks_approve: false,
      projects_view: false, projects_create: false, projects_edit: false, projects_delete: false,
      docs_view: false, docs_upload: false, docs_approve: false,
      team_view: true, team_manage: false,
      reports_view: false, reports_export: false,
      time_log: true, time_view_all: false,
      roles_manage: false, settings_manage: false, notifications_manage: false,
      chat_view: true, chat_send: true, chat_create_group: false, chat_announce: false, chat_moderate: false,
      attendance_view_all: false,
      contact_view: false, contact_manage: false,
    },
  },
];

// Known director email — this account always gets the director role on first sign-up
const DIRECTOR_EMAIL = 'thomas@kurickaldevelopers.com';

// Role assigned by email when no admin has manually set a role yet
const EMAIL_ROLE_MAP: Record<string, string> = {
  'thomas@kurickaldevelopers.com': 'director',
  'meena@kurickaldevelopers.com':  'admin',
  'ravi@kurickaldevelopers.com':   'project_manager',
  'arjun@kurickaldevelopers.com':  'site_engineer',
  'priya@kurickaldevelopers.com':  'site_engineer',
  'suresh@kurickaldevelopers.com': 'foreman',
  'biju@kurickaldevelopers.com':   'labour',
  'anitha@kurickaldevelopers.com': 'accounts',
};

// ─── Seed roles if Firestore has none ───────────────────────────────────────

async function seedRolesIfNeeded(): Promise<void> {
  try {
    const directorSnap = await getDoc(doc(db, 'roles', 'director'));
    if (directorSnap.exists()) return; // already seeded

    await Promise.all(
      DEFAULT_ROLES.map((role) =>
        setDoc(doc(db, 'roles', role.id), { ...role, createdAt: serverTimestamp() })
      )
    );
  } catch {
    // Firestore rules may block this on a locked-down project — that's OK,
    // roles were already seeded via another means (setup page / Flutter app).
  }
}

// ─── Auto-create / patch user doc on first login ────────────────────────────

async function ensureUserDoc(uid: string, email: string, displayName: string | null): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  const derivedName = displayName?.trim() || email.split('@')[0] || 'User';
  const roleId = EMAIL_ROLE_MAP[email];

  if (snap.exists()) {
    const data = snap.data();
    await setDoc(ref, {
      ...data,
      name: data.name || derivedName,
      roleId: data.roleId || roleId || null,
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
    return;
  }

  // Create the user document even if they don't have a role yet
  await setDoc(ref, {
    name: derivedName,
    email,
    phone: '',
    avatarUrl: '',
    roleId: roleId || null,
    isActive: true,
    orgId: 'main',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuthInit() {
  const { setFirebaseUser, setAppUser, setRole, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentStore = useAuthStore.getState();
      const isSameUser = currentStore.firebaseUser?.uid === firebaseUser?.uid;

      // Update the firebase user reference
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        // Skip setup steps if it's a transient token refresh of an already initialized user session
        if (!isSameUser || !currentStore.appUser) {
          setLoading(true);
          try {
            // Force a fresh ID token so Firestore auth validation is ready.
            await firebaseUser.getIdToken(true);
            await new Promise((r) => setTimeout(r, 300));

            // Seed roles on first use
            await seedRolesIfNeeded();

            // Auto-create/patch user doc (updates lastLoginAt)
            await ensureUserDoc(
              firebaseUser.uid,
              firebaseUser.email ?? '',
              firebaseUser.displayName,
            );
          } catch (err) {
            console.warn('Auth init setup step failed (non-fatal):', err);
          }

          // Load app user + role from Firestore
          try {
            const appUser = await getUser(firebaseUser.uid);
            setAppUser(appUser);

            if (appUser) registerFcm(appUser.id);

            if (appUser?.roleId) {
              let role = await getRole(appUser.roleId);
              if (!role) {
                const builtin = DEFAULT_ROLES.find((r) => r.id === appUser.roleId);
                if (builtin) {
                  role = {
                    id: builtin.id,
                    name: builtin.name,
                    description: builtin.description,
                    color: builtin.color,
                    level: builtin.level,
                    permissions: builtin.permissions,
                    createdBy: 'system',
                  };
                }
              }
              setRole(role);
            } else {
              setRole(null);
            }
          } catch (err) {
            console.error('Failed to load user/role from Firestore:', err);
            setAppUser(null);
            setRole(null);
          }
          setLoading(false);
        }
      } else {
        setAppUser(null);
        setRole(null);
        setLoading(false);
      }

      setInitialized(true);
    });

    return unsub;
  }, [setFirebaseUser, setAppUser, setRole, setLoading, setInitialized]);
}

export async function logout() {
  // Detach this browser's push token first (best-effort) so a shared device
  // stops receiving the signed-out user's notifications.
  const uid = auth.currentUser?.uid;
  if (uid) await clearFcmToken(uid);
  await signOut(auth);
}
