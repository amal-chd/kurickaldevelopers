import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { Building2, Check, Loader2, Globe2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase/config';
import { useAuthStore } from '../../store/authStore';
import { saasApi } from '../../lib/saasApi';
import { useTenantStore } from '../../lib/tenant';
import { INDUSTRIES } from './marketing/content';
import { usePlans } from './marketing/PricingPage';

const input = 'w-full h-11 px-3 rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm';

const firebaseMessage = (code?: string) => ({
  'auth/email-already-in-use': 'An account with this email already exists — sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts — please wait a minute and try again.',
} as Record<string, string>)[code ?? ''] ?? 'Something went wrong. Please try again.';

/**
 * Public sign-up → create company workspace. Also serves /onboarding for a
 * signed-in user who doesn't belong to any workspace yet (account step skipped).
 */
const RegisterPage: React.FC<{ onboardingOnly?: boolean }> = ({ onboardingOnly }) => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { firebaseUser, appUser, initialized } = useAuthStore();
  const platformRole = useTenantStore((s) => s.platformRole);
  const isPlatformAdmin = Boolean(
    platformRole ||
    firebaseUser?.email === 'admin@taskpilot.app' ||
    firebaseUser?.email === 'thekadaapp@gmail.com'
  );
  const { plans } = usePlans();

  const [step, setStep] = useState<'account' | 'company'>(firebaseUser ? 'company' : 'account');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [busy, setBusy] = useState(false);
  const [acct, setAcct] = useState({ name: '', email: '', password: '' });
  const [co, setCo] = useState({
    orgName: '', industry: 'construction', companySize: '11-50', phone: '', country: 'IN',
    planId: params.get('plan') || 'professional', billingCycle: (params.get('cycle') as 'monthly' | 'yearly') || 'monthly',
  });

  useEffect(() => { if (firebaseUser) setStep('company'); }, [firebaseUser]);
  // Already in a workspace → straight to the app.
  useEffect(() => { if (initialized && appUser) navigate('/app/dashboard', { replace: true }); }, [initialized, appUser, navigate]);

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (acct.password.length < 8) throw Object.assign(new Error(), { code: 'auth/weak-password' });
        const cred = await createUserWithEmailAndPassword(auth, acct.email.trim(), acct.password);
        if (acct.name.trim()) await updateProfile(cred.user, { displayName: acct.name.trim() });
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, acct.email.trim(), acct.password);
      }
      setStep('company');
    } catch (err: any) {
      toast.error(firebaseMessage(err.code));
    } finally {
      setBusy(false);
    }
  };

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saasApi('register_org', { ...co, name: acct.name || auth.currentUser?.displayName || '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast.success('Your workspace is ready');
      // Full reload so auth, role and tenant context initialise cleanly.
      window.location.assign('/app/dashboard?welcome=1');
    } catch (err: any) {
      if (err.code === 'ALREADY_MEMBER') { window.location.assign('/app/dashboard'); return; }
      toast.error(err.message);
      setBusy(false);
    }
  };

  const selectedPlan = plans?.find((p) => p.id === co.planId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between max-w-6xl w-full mx-auto">
        <Link to="/" className="flex items-center gap-2 font-bold"><img src="/logo.png" alt="" className="w-8 h-8 rounded-lg" />Task Pilot</Link>
        {!firebaseUser && <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>}
      </header>
      <main className="flex-1 flex items-start justify-center px-4 pb-16 pt-6">
        <div className="w-full max-w-lg">
          <ol className="flex items-center gap-3 mb-6 text-sm" aria-label="Progress">
            {[['account', 'Your account'], ['company', 'Your company']].map(([k, label], i) => {
              const done = k === 'account' && step === 'company';
              const active = step === k;
              return (
                <li key={k} className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-emerald-600 text-white' : active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>{done ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
                  <span className={active ? 'font-semibold' : 'text-slate-500'}>{label}</span>
                  {i === 0 && <span className="w-8 h-px bg-slate-300 ml-1" />}
                </li>
              );
            })}
          </ol>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            {step === 'account' && !onboardingOnly ? (
              <form onSubmit={submitAccount} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{mode === 'signup' ? 'Start your free trial' : 'Sign in to continue'}</h1>
                  <p className="text-sm text-slate-500 mt-1">14 days free · no credit card required</p>
                </div>
                {mode === 'signup' && (
                  <label className="block text-sm font-medium">Full name<input required value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} className={`${input} mt-1`} autoComplete="name" /></label>
                )}
                <label className="block text-sm font-medium">Work email<input required type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} className={`${input} mt-1`} autoComplete="email" /></label>
                <label className="block text-sm font-medium">Password<input required type="password" minLength={mode === 'signup' ? 8 : 6} value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} className={`${input} mt-1`} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
                <button disabled={busy} className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
                <p className="text-sm text-center text-slate-500">
                  {mode === 'signup' ? 'Already have an account? ' : 'New to Task Pilot? '}
                  <button type="button" className="font-semibold text-slate-900 underline" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create one'}</button>
                </p>
                <p className="text-xs text-slate-400 text-center">By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/policy" className="underline">Privacy Policy</Link>.</p>
              </form>
            ) : (
              <form onSubmit={submitCompany} className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Set up your company</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Signed in as {auth.currentUser?.email}</p>
                  </div>
                </div>
                {isPlatformAdmin && (
                  <Link to="/platform" className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-800"><Globe2 className="w-4 h-4" />You're a platform administrator — open the Platform Console</Link>
                )}
                <label className="block text-sm font-medium">Company name<input required minLength={2} value={co.orgName} onChange={(e) => setCo({ ...co, orgName: e.target.value })} className={`${input} mt-1`} autoComplete="organization" /></label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-sm font-medium">Industry
                    <select value={co.industry} onChange={(e) => setCo({ ...co, industry: e.target.value })} className={`${input} mt-1`}>
                      {INDUSTRIES.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">Team size
                    <select value={co.companySize} onChange={(e) => setCo({ ...co, companySize: e.target.value })} className={`${input} mt-1`}>
                      {['1-10', '11-50', '51-200', '200+'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">Phone<input value={co.phone} onChange={(e) => setCo({ ...co, phone: e.target.value })} className={`${input} mt-1`} autoComplete="tel" /></label>
                  <label className="block text-sm font-medium">Plan to trial
                    <select value={co.planId} onChange={(e) => setCo({ ...co, planId: e.target.value })} className={`${input} mt-1`}>
                      {(plans ?? []).filter((p) => !p.is_custom_pricing).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      {!plans && <option value={co.planId}>Loading…</option>}
                    </select>
                  </label>
                </div>
                {selectedPlan && (
                  <p className="text-xs text-slate-500">{selectedPlan.trial_days}-day free trial of {selectedPlan.name}: {selectedPlan.max_users ?? 'unlimited'} users, {selectedPlan.max_projects ?? 'unlimited'} projects. You can change plans any time.</p>
                )}
                <button disabled={busy} className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}Create workspace
                </button>
                <p className="text-xs text-slate-500 text-center">Were you invited by your company? Open the invitation link your admin shared instead.</p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
