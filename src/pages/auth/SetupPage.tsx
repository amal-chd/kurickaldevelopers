/**
 * ONE-TIME SETUP PAGE — /setup
 * Creates default roles + Firebase Auth accounts + Firestore user docs.
 *
 * Strategy to avoid auth-state switching issues:
 *  1. Create roles first (unauthenticated — see note below)
 *  2. Create Thomas's Auth account → signs in as Thomas → write his Firestore doc
 *     (Thomas = Director with team_manage + roles_manage)
 *  3. Create all other Auth accounts via Firebase REST API (no sign-in change)
 *  4. Write remaining Firestore user docs while signed in as Thomas
 *     (allowed via the updated rule: isOwner || hasPermission('team_manage'))
 *
 * NOTE: Roles are created using the Firebase REST API with Thomas's ID token
 * so that hasPermission('roles_manage') is satisfied.
 */
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { Building2, CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react';

// ─── Roles ──────────────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'role_director',
    name: 'Director / Owner',
    description: 'Full access to all features and settings',
    color: '#1A3A5C',
    level: 100,
    isSystem: true,
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
    isSystem: true,
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
    isSystem: true,
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

// ─── Users (Thomas MUST be first — he becomes the bootstrap admin) ──────────

const ADMIN_USER = {
  name: 'Thomas Kurickal',
  email: 'thomas@kurickaldevelopers.com',
  roleId: 'role_director',
  phone: '',
};

const OTHER_USERS = [
  { name: 'Ravi Kumar',    email: 'ravi@kurickaldevelopers.com',   roleId: 'role_pm',       phone: '' },
  { name: 'Arjun Menon',  email: 'arjun@kurickaldevelopers.com',  roleId: 'role_engineer', phone: '' },
  { name: 'Priya Nair',   email: 'priya@kurickaldevelopers.com',  roleId: 'role_engineer', phone: '' },
  { name: 'Suresh Babu',  email: 'suresh@kurickaldevelopers.com', roleId: 'role_foreman',  phone: '' },
  { name: 'Biju Thomas',  email: 'biju@kurickaldevelopers.com',   roleId: 'role_labour',   phone: '' },
  { name: 'Meena Pillai', email: 'meena@kurickaldevelopers.com',  roleId: 'role_admin',    phone: '' },
  { name: 'Anitha George', email: 'anitha@kurickaldevelopers.com', roleId: 'role_accounts', phone: '' },
];

const DEFAULT_PASSWORD = 'Kurickal@2024';
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a Firebase Auth account via REST API without changing current auth state.
 *  Returns the new user's uid, or null if the email already exists. */
async function createAuthAccountREST(email: string, password: string): Promise<string | null> {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  const data = await resp.json();
  if (data.error) {
    if (data.error.message === 'EMAIL_EXISTS') return null; // already exists
    throw new Error(data.error.message);
  }
  return data.localId as string;
}

/** Check if a Firestore doc already exists at the given path. */
async function docExists(path: string, id: string): Promise<boolean> {
  const snap = await getDoc(doc(db, path, id));
  return snap.exists();
}

// ─── Types ──────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'done' | 'skipped' | 'error';
interface StepResult { label: string; status: StepStatus; note?: string; }

const StatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (status === 'done')    return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (status === 'skipped') return <CheckCircle className="w-4 h-4 text-gray-400" />;
  if (status === 'error')   return <XCircle className="w-4 h-4 text-red-500" />;
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
};

// ─── Component ──────────────────────────────────────────────────────────────

const SetupPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const updateStep = (index: number, update: Partial<StepResult>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));

  const runSetup = async () => {
    setRunning(true);
    setDone(false);

    // Build step labels
    const allSteps: StepResult[] = [
      { label: 'Bootstrap Admin: Thomas Kurickal', status: 'idle' },
      ...ROLES.map((r) => ({ label: `Role: ${r.name}`, status: 'idle' as StepStatus })),
      ...OTHER_USERS.map((u) => ({ label: `User: ${u.name} (${u.email})`, status: 'idle' as StepStatus })),
    ];
    setSteps(allSteps);

    // ── Phase 1: Bootstrap Thomas ────────────────────────────────────────────
    // Create Thomas's Auth account + sign in as him + write his Firestore doc.
    // All subsequent Firestore writes happen while signed in as Thomas.
    updateStep(0, { status: 'running' });
    let thomasUid: string | null = null;
    try {
      try {
        const cred = await createUserWithEmailAndPassword(auth, ADMIN_USER.email, DEFAULT_PASSWORD);
        thomasUid = cred.user.uid;
        // Force token refresh so Firestore auth is ready
        await cred.user.getIdToken(true);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') {
          // Sign in as Thomas so we have his token for subsequent writes
          const cred2 = await signInWithEmailAndPassword(auth, ADMIN_USER.email, DEFAULT_PASSWORD);
          thomasUid = cred2.user.uid;
          await cred2.user.getIdToken(true);
        } else {
          throw e;
        }
      }

      // Write Thomas's user doc if it doesn't exist
      if (await docExists('users', thomasUid)) {
        updateStep(0, { status: 'skipped', note: 'already exists' });
      } else {
        await setDoc(doc(db, 'users', thomasUid), {
          name: ADMIN_USER.name,
          email: ADMIN_USER.email,
          phone: ADMIN_USER.phone,
          avatarUrl: '',
          roleId: ADMIN_USER.roleId,
          isActive: true,
          orgId: 'main',
          createdAt: serverTimestamp(),
        });
        updateStep(0, { status: 'done' });
      }
    } catch (err: unknown) {
      updateStep(0, { status: 'error', note: String((err as Error).message ?? err) });
      // Cannot continue without Thomas signed in
      setRunning(false);
      setDone(true);
      return;
    }

    // ── Phase 2: Create roles (as Thomas who has roles_manage) ───────────────
    const roleOffset = 1;
    for (let i = 0; i < ROLES.length; i++) {
      const role = ROLES[i];
      updateStep(roleOffset + i, { status: 'running' });
      try {
        if (await docExists('roles', role.id)) {
          updateStep(roleOffset + i, { status: 'skipped', note: 'already exists' });
        } else {
          await setDoc(doc(db, 'roles', role.id), { ...role, createdAt: serverTimestamp() });
          updateStep(roleOffset + i, { status: 'done' });
        }
      } catch (err: unknown) {
        updateStep(roleOffset + i, { status: 'error', note: String((err as Error).message ?? err) });
      }
    }

    // ── Phase 3: Create remaining users ──────────────────────────────────────
    // Auth accounts are created via REST API (no auth-state change).
    // Firestore docs are written while still signed in as Thomas.
    const userOffset = 1 + ROLES.length;
    for (let i = 0; i < OTHER_USERS.length; i++) {
      const user = OTHER_USERS[i];
      const stepIdx = userOffset + i;
      updateStep(stepIdx, { status: 'running' });
      try {
        // Create Auth account without signing in (REST API)
        const newUid = await createAuthAccountREST(user.email, DEFAULT_PASSWORD);
        if (newUid === null) {
          // Email already registered — try to find existing uid via email lookup
          updateStep(stepIdx, { status: 'skipped', note: 'Auth account already exists' });
          continue;
        }

        // Write Firestore user doc as Thomas (team_manage permission)
        if (await docExists('users', newUid)) {
          updateStep(stepIdx, { status: 'skipped', note: 'Firestore doc already exists' });
        } else {
          await setDoc(doc(db, 'users', newUid), {
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatarUrl: '',
            roleId: user.roleId,
            isActive: true,
            orgId: 'main',
            createdAt: serverTimestamp(),
          });
          updateStep(stepIdx, { status: 'done' });
        }
      } catch (err: unknown) {
        updateStep(stepIdx, { status: 'error', note: String((err as Error).message ?? err) });
      }
    }

    setRunning(false);
    setDone(true);
  };

  const hasErrors = steps.some((s) => s.status === 'error');
  const roleOffset = 1;
  const userOffset = 1 + ROLES.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060f1e] via-[#1A3A5C] to-[#0d2540] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center shadow-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Task Pilot — First-Time Setup</h1>
          <p className="text-white/60 text-sm mt-2">
            Creates default roles and demo accounts in Firebase.<br />
            Run once, then navigate to <span className="font-mono text-accent">/login</span>.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Warning */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">One-time action</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Default password for all accounts: <span className="font-mono font-bold">Kurickal@2024</span>
              </p>
            </div>
          </div>

          {/* Steps list */}
          {steps.length > 0 && (
            <div className="mb-6 space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {/* Admin bootstrap */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Bootstrap Admin</p>
              {steps.slice(0, 1).map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <StatusIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-tight">{step.label}</p>
                    {step.note && <p className="text-xs text-gray-400">{step.note}</p>}
                  </div>
                </div>
              ))}
              {/* Roles */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Roles</p>
              {steps.slice(roleOffset, roleOffset + ROLES.length).map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <StatusIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-tight">{step.label}</p>
                    {step.note && <p className="text-xs text-gray-400">{step.note}</p>}
                  </div>
                </div>
              ))}
              {/* Other users */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Other Users</p>
              {steps.slice(userOffset).map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <StatusIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-tight">{step.label}</p>
                    {step.note && <p className="text-xs text-gray-400">{step.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Result banners */}
          {done && !hasErrors && (
            <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Setup complete!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  All accounts created. Go to{' '}
                  <a href="/login" className="underline font-medium">/login</a>{' '}
                  and sign in with any demo account.
                </p>
              </div>
            </div>
          )}
          {done && hasErrors && (
            <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Some steps failed</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Check the errors above. Click "Run Setup Again" — completed items will be skipped safely.
                </p>
              </div>
            </div>
          )}

          {/* Action button */}
          {!done ? (
            <button
              onClick={runSetup}
              disabled={running}
              className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {running ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
              ) : (
                'Run Setup'
              )}
            </button>
          ) : (
            <div className="flex gap-3">
              {hasErrors && (
                <button
                  onClick={() => { setDone(false); setSteps([]); }}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-center text-sm"
                >
                  Run Setup Again
                </button>
              )}
              <a
                href="/login"
                className="flex-1 py-3 px-6 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors text-center"
              >
                Go to Login →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
