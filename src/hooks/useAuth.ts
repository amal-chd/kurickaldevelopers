import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuthStore } from '../store/authStore';
import { getUser, getRole } from '../lib/firestore';

// ─── Default roles seeded on first boot ─────────────────────────────────────

const DEFAULT_ROLES = [
  {
    id: 'role_director',
    name: 'Director / Owner',
    description: 'Full access to all features and settings',
    color: '#1A3A5C',
    level: 100,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_create: true, projects_edit: true, projects_delete: true,
      docs_view: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      roles_manage: true, settings_manage: true, notifications_manage: true,
      chat_view: true, chat_send: true, chat_create_group: true, chat_announce: true, chat_moderate: true,
      attendance_view_all: true,
      contact_view: true, contact_manage: true,
    },
  },
  {
    id: 'role_admin',
    name: 'Admin',
    description: 'Administrative access — team, roles, settings',
    color: '#9C27B0',
    level: 90,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_create: true, projects_edit: true, projects_delete: false,
      docs_view: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      roles_manage: true, settings_manage: true, notifications_manage: true,
      chat_view: true, chat_send: true, chat_create_group: true, chat_announce: false, chat_moderate: true,
      attendance_view_all: true,
      contact_view: true, contact_manage: true,
    },
  },
  {
    id: 'role_pm',
    name: 'Project Manager',
    description: 'Manages projects, tasks, and team assignments',
    color: '#2196F3',
    level: 80,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: false, tasks_approve: true,
      projects_view: true, projects_create: true, projects_edit: true, projects_delete: false,
      docs_view: true, docs_upload: true, docs_approve: true,
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
    id: 'role_accounts',
    name: 'Accounts',
    description: 'Finance, reports, and document access',
    color: '#4CAF50',
    level: 50,
    isSystem: false,
    createdBy: 'system',
    permissions: {
      tasks_view: true, tasks_create: false, tasks_edit: false, tasks_delete: false, tasks_approve: false,
      projects_view: true, projects_create: false, projects_edit: false, projects_delete: false,
      docs_view: true, docs_upload: true, docs_approve: false,
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
    id: 'role_engineer',
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
    id: 'role_foreman',
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
    id: 'role_labour',
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
  'thomas@kurickaldevelopers.com': 'role_director',
  'meena@kurickaldevelopers.com':  'role_admin',
  'ravi@kurickaldevelopers.com':   'role_pm',
  'arjun@kurickaldevelopers.com':  'role_engineer',
  'priya@kurickaldevelopers.com':  'role_engineer',
  'suresh@kurickaldevelopers.com': 'role_foreman',
  'biju@kurickaldevelopers.com':   'role_labour',
  'anitha@kurickaldevelopers.com': 'role_accounts',
};

// ─── Seed roles if Firestore has none ───────────────────────────────────────

async function seedRolesIfNeeded(): Promise<void> {
  try {
    const directorSnap = await getDoc(doc(db, 'roles', 'role_director'));
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

  // Derive the best available name: auth profile > email prefix > 'User'
  const derivedName = displayName?.trim() || email.split('@')[0] || 'User';
  const roleId = EMAIL_ROLE_MAP[email] ?? '';

  if (snap.exists()) {
    // Patch empty name or missing roleId on existing docs
    const data = snap.data();
    const needsPatch =
      (!data.name || data.name === '') ||
      (roleId && !data.roleId);
    if (needsPatch) {
      await setDoc(ref, {
        ...data,
        name: data.name || derivedName,
        roleId: data.roleId || roleId,
      }, { merge: true });
    }
    return;
  }

  await setDoc(ref, {
    name: derivedName,
    email,
    phone: '',
    avatarUrl: '',
    roleId,
    isActive: true,
    orgId: 'main',
    createdAt: serverTimestamp(),
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuthInit() {
  const { setFirebaseUser, setAppUser, setRole, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Force a fresh ID token so Firestore auth validation is ready.
          // This prevents "Missing or insufficient permissions" on first login.
          await firebaseUser.getIdToken(true);

          // 1. Seed roles on very first use (silently ignores permission errors —
          //    roles may already exist from a prior run or from the Flutter app)
          await seedRolesIfNeeded();

          // 2. Auto-create user doc if this is their first login
          await ensureUserDoc(
            firebaseUser.uid,
            firebaseUser.email ?? '',
            firebaseUser.displayName,
          );
        } catch (err) {
          // Non-fatal — the user doc might already exist or rules block seeding.
          // We still proceed to read whatever is in Firestore.
          console.warn('Auth init setup step failed (non-fatal):', err);
        }

        // 3. Load app user + role — always attempt even if setup steps failed
        try {
          const appUser = await getUser(firebaseUser.uid);
          setAppUser(appUser);

          if (appUser?.roleId) {
            // Try Firestore first; fall back to built-in defaults so the app
            // works even when roles haven't been seeded to Firestore yet.
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
      } else {
        setAppUser(null);
        setRole(null);
      }

      setLoading(false);
      setInitialized(true);
    });

    return unsub;
  }, [setFirebaseUser, setAppUser, setRole, setLoading, setInitialized]);
}

export async function logout() {
  await signOut(auth);
}
