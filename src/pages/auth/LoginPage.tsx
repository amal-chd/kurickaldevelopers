import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../../firebase/config';
import {
  Mail, Lock, Eye, EyeOff,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

// ─── Left panel stats ─────────────────────────────────────────────────────────

const STATS = [
  { label: 'Projects Managed', value: '50+' },
  { label: 'Team Members',     value: '35+' },
  { label: 'Tasks Completed',  value: '1,200+' },
  { label: 'Years Active',     value: '7+' },
];



// ─── Main — sign-in only (mirrors the mobile app: no sign-up, no onboarding) ──

const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const navigate                = useNavigate();
  const { firebaseUser }        = useAuthStore();

  // Already logged in → straight to dashboard
  useEffect(() => {
    if (firebaseUser) navigate('/app/dashboard');
  }, [firebaseUser, navigate]);

  // ── Error helper ────────────────────────────────────────────────────────────
  const toastAuthError = (code: string) => {
    const map: Record<string, string> = {
      'auth/invalid-credential':    'Invalid email or password.',
      'auth/user-not-found':        'No account found with this email.',
      'auth/wrong-password':        'Invalid email or password.',
      'auth/invalid-email':         'Please enter a valid email address.',
      'auth/too-many-requests':     'Too many attempts. Try again later.',
      'auth/user-disabled':         'This account has been disabled. Contact your admin.',
    };
    toast.error(map[code] ?? 'Authentication failed. Please try again.');
  };

  // ── Sign In ─────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Signed in!');
      navigate('/app/dashboard');
    } catch (err: unknown) {
      toastAuthError((err as { code?: string }).code ?? '');
    } finally {
      setLoading(false);
    }
  };



  // ── Forgot password ─────────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (!email.trim()) { toast.error('Enter your email above first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent!');
    } catch {
      toast.error('Could not send reset email.');
    }
  };



  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-gradient-to-br from-[#020617] via-[#0F172A] to-[#1E293B] p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute top-1/3 -right-16 w-72 h-72 bg-accent/10 rounded-full blur-[80px]" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-14">
            <img src="/logo.png" alt="Task Pilot" className="w-11 h-11 rounded-2xl object-cover shadow-lg" />
            <div>
              <p className="text-white font-bold text-base">Task Pilot</p>
              <p className="text-white/40 text-xs">Task Management System</p>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Manage your<br />
            <span className="text-accent">construction projects</span><br />
            with precision.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Real-time task tracking, team collaboration, attendance monitoring and document management — all in one platform.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src="/logo.png" alt="Task Pilot" className="w-14 h-14 rounded-2xl object-cover shadow-xl mb-3" />
            <h1 className="text-2xl font-bold text-slate-900">Task Pilot</h1>
            <p className="text-slate-500 text-sm">Construction Task Management</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your account</h2>
              <p className="text-sm text-slate-500 mt-1">Welcome back. Enter your credentials to continue.</p>
            </div>

            {/* Sign In form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                leftIcon={<Mail className="w-4 h-4" />}
              />
              <div>
                <Input
                  label="Password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPass((p) => !p)}
                      className="text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <div className="flex justify-end mt-1.5">
                  <button type="button" onClick={handleForgot}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" loading={loading} size="lg">
                Sign In
              </Button>
            </form>




          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            © {new Date().getFullYear()} Kurickal Developers LLP · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
