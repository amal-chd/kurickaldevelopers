import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { Loader2, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { saasApi } from '../../lib/saasApi';

const input = 'w-full h-11 px-3 rounded-lg border border-slate-300 bg-white focus:border-slate-900 outline-none text-sm';

interface InviteInfo { email: string; name?: string; status: string; orgName: string; orgLogo?: string; roleName?: string }

const InvitePage: React.FC = () => {
  const { token = '' } = useParams();
  const { firebaseUser } = useAuthStore();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    saasApi<InviteInfo>('get_invitation', { token }, { public: true })
      .then((r) => { setInfo(r); setName(r.name ?? ''); })
      .catch((e) => setError(e.message));
  }, [token]);

  const accept = async () => {
    await saasApi('accept_invitation', { token, name });
    toast.success(`Welcome to ${info?.orgName}`);
    window.location.assign('/app/dashboard?welcome=1');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    try {
      if (!firebaseUser || firebaseUser.email?.toLowerCase() !== info.email.toLowerCase()) {
        if (firebaseUser) await signOut(auth);
        if (mode === 'signup') {
          const cred = await createUserWithEmailAndPassword(auth, info.email, password);
          if (name) await updateProfile(cred.user, { displayName: name });
        } else {
          await signInWithEmailAndPassword(auth, info.email, password);
        }
      }
      await accept();
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use' ? 'You already have an account — choose "Sign in".'
        : err.code === 'auth/invalid-credential' ? 'Incorrect password.'
        : err.code === 'auth/weak-password' ? 'Use at least 8 characters.' : err.message;
      toast.error(msg);
      setBusy(false);
    }
  };

  const signedInAsInvitee = firebaseUser && info && firebaseUser.email?.toLowerCase() === info.email.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {error ? (
          <div className="text-center">
            <h1 className="text-xl font-bold">Invitation unavailable</h1>
            <p className="text-slate-600 text-sm mt-2">{error}</p>
            <Link to="/login" className="mt-5 inline-block text-sm font-semibold underline">Go to sign in</Link>
          </div>
        ) : !info ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : info.status !== 'pending' ? (
          <div className="text-center">
            <h1 className="text-xl font-bold">This invitation is {info.status}</h1>
            <p className="text-slate-600 text-sm mt-2">Ask an administrator at {info.orgName} to send a new one.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="text-center">
              {info.orgLogo ? <img src={info.orgLogo} alt="" className="w-14 h-14 rounded-xl mx-auto object-cover" /> : <MailCheck className="w-10 h-10 mx-auto text-amber-600" />}
              <h1 className="mt-3 text-xl font-bold">Join {info.orgName} on Task Pilot</h1>
              <p className="text-sm text-slate-500 mt-1">Invited as <strong>{info.roleName ?? 'team member'}</strong> · {info.email}</p>
            </div>
            {signedInAsInvitee ? (
              <button type="button" disabled={busy} onClick={() => { setBusy(true); accept().catch((e) => { toast.error(e.message); setBusy(false); }); }}
                className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-60">{busy ? 'Joining…' : 'Accept invitation'}</button>
            ) : (
              <>
                {mode === 'signup' && <label className="block text-sm font-medium">Your name<input required value={name} onChange={(e) => setName(e.target.value)} className={`${input} mt-1`} autoComplete="name" /></label>}
                <label className="block text-sm font-medium">{mode === 'signup' ? 'Create a password' : 'Password'}
                  <input required type="password" minLength={mode === 'signup' ? 8 : 6} value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
                </label>
                <button disabled={busy} className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
                </button>
                <p className="text-sm text-center text-slate-500">
                  {mode === 'signup' ? 'Already have a Task Pilot account? ' : 'New here? '}
                  <button type="button" className="font-semibold text-slate-900 underline" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create account'}</button>
                </p>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
