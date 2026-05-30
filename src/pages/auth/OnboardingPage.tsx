import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, ShieldCheck, Check,
  ChevronRight, ChevronLeft, Bell, Fingerprint,
  CheckCircle2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { createUser, getAllRoles, serverTimestamp } from '../../lib/firestore';
import { Role } from '../../types';
import toast from 'react-hot-toast';

const OnboardingPage: React.FC = () => {
  const { firebaseUser, setAppUser, setRole } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Set name from firebase profile if available
  useEffect(() => {
    if (firebaseUser?.displayName) {
      setName(firebaseUser.displayName);
    }
    if (firebaseUser?.phoneNumber) {
      setPhone(firebaseUser.phoneNumber);
    }
  }, [firebaseUser]);

  // Load roles from Firestore
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await getAllRoles();
        // Sort roles so higher level (Director, Admin) comes first
        data.sort((a, b) => b.level - a.level);
        setRoles(data);
      } catch (err) {
        console.error('Failed to load roles from Firestore', err);
        // Fallback roles in case database cannot be reached or is empty
        setRoles([
          { id: 'director', name: 'Director / Owner', description: 'Full access to all features and settings', color: '#1A3A5C', level: 100, permissions: {}, createdBy: 'system' },
          { id: 'admin', name: 'Admin', description: 'Administrative access — team, roles, settings', color: '#9C27B0', level: 90, permissions: {}, createdBy: 'system' },
          { id: 'project_manager', name: 'Project Manager', description: 'Manages projects, tasks, and team assignments', color: '#2196F3', level: 80, permissions: {}, createdBy: 'system' },
          { id: 'site_engineer', name: 'Site Engineer', description: 'Field engineer — tasks, site diary, documents', color: '#009688', level: 60, permissions: {}, createdBy: 'system' },
          { id: 'foreman', name: 'Foreman', description: 'Site foreman — limited task and attendance access', color: '#F59E0B', level: 40, permissions: {}, createdBy: 'system' },
          { id: 'accounts', name: 'Accounts', description: 'Finance, reports, and document access', color: '#4CAF50', level: 50, permissions: {}, createdBy: 'system' },
          { id: 'labour', name: 'Labour', description: 'Site worker — attendance and basic task view only', color: '#9E9E9E', level: 20, permissions: {}, createdBy: 'system' },
        ]);
      } finally {
        setLoadingRoles(false);
      }
    };
    loadRoles();
  }, []);

  const handleNext = () => {
    if (step === 0) {
      if (!name.trim()) {
        toast.error('Please enter your full name');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!selectedRoleId) {
        toast.error('Please select your role');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (!firebaseUser || !name.trim() || !selectedRoleId) return;

    setSubmitting(true);
    try {
      const userData = {
        name: name.trim(),
        email: firebaseUser.email ?? '',
        phone: phone.trim() || '+910000000000',
        avatarUrl: firebaseUser.photoURL ?? '',
        roleId: selectedRoleId,
        isActive: true,
        orgId: 'main',
        notificationsEnabled,
        biometricEnabled,
        projectIds: [],
        lastLoginAt: serverTimestamp(),
      };

      // 1. Create in Firestore (Rules allow creates for own UID with selected role)
      await createUser(firebaseUser.uid, userData);

      // 2. Resolve matching role
      const chosenRole = roles.find((r) => r.id === selectedRoleId) || null;

      // 3. Update auth store
      setAppUser({ id: firebaseUser.uid, ...userData });
      setRole(chosenRole);

      toast.success('Onboarding completed! Welcome aboard.');
      navigate('/app/dashboard');
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      toast.error(`Failed to save profile: ${err?.message || err || 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { label: 'Profile', desc: 'Personal details' },
    { label: 'Role', desc: 'Select position' },
    { label: 'Settings', desc: 'Preferences' },
    { label: 'Review', desc: 'Confirm info' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060f1e] via-[#1A3A5C] to-[#0d2540] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-10 relative anim-scale-in">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <img src="/logo.png" alt="Task Pilot" className="w-12 h-12 rounded-2xl object-cover shadow-lg" />
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">Welcome to Task Pilot</h1>
            <p className="text-gray-500 text-xs sm:text-sm">Complete these quick steps to set up your account</p>
          </div>
        </div>

        {/* Horizontal Progress Steps */}
        <div className="hidden sm:flex items-center justify-between gap-2 mb-10 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          {steps.map((s, idx) => {
            const isActive = step === idx;
            const isCompleted = step > idx;
            return (
              <React.Fragment key={s.label}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-emerald-100 shadow-lg'
                      : isActive
                        ? 'bg-primary text-white shadow-primary/20 shadow-lg scale-105'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </div>
                  <div>
                    <p className={`text-xs font-bold leading-tight ${isActive ? 'text-primary' : isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>{s.label}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{s.desc}</p>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 max-w-[40px] rounded transition-all duration-200 ${
                    isCompleted ? 'bg-emerald-500' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile Stepper Header */}
        <div className="sm:hidden flex items-center justify-between mb-6 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
          <span className="text-xs font-bold text-primary">Step {step + 1} of 4: {steps[step].label}</span>
          <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${((step + 1) / 4) * 100}%` }} />
          </div>
        </div>

        {/* Content Box */}
        <div className="min-h-[280px] mb-8">
          
          {/* STEP 1: NAME & PHONE */}
          {step === 0 && (
            <div className="space-y-5 anim-fade-in">
              <div className="border-b border-gray-100 pb-2">
                <h2 className="text-lg font-black text-gray-900">Tell us about yourself</h2>
                <p className="text-gray-400 text-xs">Enter your profile name and contact number</p>
              </div>
              <Input
                label="Full Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                leftIcon={<User className="w-4 h-4" />}
                autoFocus
              />
              <Input
                label="Phone Number"
                placeholder="e.g. +91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
                hint="Used for team communication"
              />
              <Input
                label="Email Address"
                value={firebaseUser?.email || ''}
                disabled
                leftIcon={<Mail className="w-4 h-4" />}
                hint="Your email address is verified via sign-in"
              />
            </div>
          )}

          {/* STEP 2: CHOOSE ROLE */}
          {step === 1 && (
            <div className="space-y-4 anim-fade-in">
              <div className="border-b border-gray-100 pb-2">
                <h2 className="text-lg font-black text-gray-900">Choose your role</h2>
                <p className="text-gray-400 text-xs">Select your position in the company. Your dashboard and permissions adapt to this.</p>
              </div>

              {loadingRoles ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Loading available roles...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {roles.map((role) => {
                    const isSelected = selectedRoleId === role.id;
                    const color = role.color || '#475569';
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`flex items-start text-left p-4 rounded-2xl border-2 transition-all duration-200 relative group cursor-pointer ${
                          isSelected
                            ? 'bg-slate-50 shadow-md'
                            : 'bg-white hover:bg-slate-50/50 border-gray-100 hover:border-gray-200'
                        }`}
                        style={{
                          borderColor: isSelected ? color : undefined,
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mr-3 text-white font-bold text-xs"
                          style={{ backgroundColor: color }}
                        >
                          {role.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors truncate">{role.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{role.description || 'No description available'}</p>
                        </div>
                        {isSelected && (
                          <div
                            className="absolute right-3.5 top-3.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: color }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PREFERENCES */}
          {step === 2 && (
            <div className="space-y-6 anim-fade-in">
              <div className="border-b border-gray-100 pb-2">
                <h2 className="text-lg font-black text-gray-900">Device preferences</h2>
                <p className="text-gray-400 text-xs">Configure notifications and log in options</p>
              </div>

              <div className="space-y-4">
                {/* Push Notification Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3.5 pr-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Enable Push Notifications</p>
                      <p className="text-xs text-gray-400 leading-relaxed mt-0.5">Stay updated with task assignments, due dates, and supervisor approvals</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Biometric Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3.5 pr-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Fingerprint className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Biometric Sign-In</p>
                      <p className="text-xs text-gray-400 leading-relaxed mt-0.5">Use Face ID or fingerprint on compatible mobile devices to sign in faster</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={biometricEnabled}
                      onChange={(e) => setBiometricEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW */}
          {step === 3 && (
            <div className="space-y-5 anim-fade-in">
              <div className="border-b border-gray-100 pb-2">
                <h2 className="text-lg font-black text-gray-900">Confirm details</h2>
                <p className="text-gray-400 text-xs">Verify your profile information before completing registration</p>
              </div>

              <div className="bg-gray-50/60 rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100/50">
                  <span className="text-xs text-gray-400 font-semibold">Full Name</span>
                  <span className="text-sm font-bold text-gray-800">{name}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100/50">
                  <span className="text-xs text-gray-400 font-semibold">Verified Email</span>
                  <span className="text-sm font-medium text-gray-500">{firebaseUser?.email}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100/50">
                  <span className="text-xs text-gray-400 font-semibold">Phone Number</span>
                  <span className="text-sm font-bold text-gray-800">{phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100/50">
                  <span className="text-xs text-gray-400 font-semibold">Selected Role</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: roles.find((r) => r.id === selectedRoleId)?.color || '#94a3b8' }}
                    />
                    <span className="text-sm font-black text-gray-800">
                      {roles.find((r) => r.id === selectedRoleId)?.name || selectedRoleId}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-gray-400 font-semibold">Preferences</span>
                  <div className="flex gap-2">
                    {notificationsEnabled && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Notifications
                      </span>
                    )}
                    {biometricEnabled && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Biometric
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/60 rounded-2xl border border-amber-100 p-4 flex gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Security Rule Precaution</p>
                  <p className="text-[11px] text-amber-600/90 leading-relaxed mt-0.5">
                    Your assigned role ensures correct team organization permissions. For security, your role cannot be updated directly on the device once registration is completed.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Buttons / Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || submitting}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Back
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="px-6"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={handleComplete}
              loading={submitting}
              className="px-8 shadow-lg shadow-accent/20"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Get Started
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};

export default OnboardingPage;
