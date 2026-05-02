import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, CheckCircle, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { createUser } from '../../lib/firestore';
import toast from 'react-hot-toast';

const OnboardingPage: React.FC = () => {
  const { firebaseUser, setAppUser } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !name.trim()) return;

    setLoading(true);
    try {
      const userData = {
        name: name.trim(),
        email: firebaseUser.email ?? '',
        phone: firebaseUser.phoneNumber ?? '',
        avatarUrl: firebaseUser.photoURL ?? '',
        roleId: '',
        isActive: true,
        orgId: 'main',
      };
      await createUser(firebaseUser.uid, userData);
      setAppUser({ id: firebaseUser.uid, ...userData });
      toast.success('Welcome to Kurickal TMS!');
      navigate('/app/dashboard');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: User, label: 'Create Profile' },
    { icon: Building2, label: 'Join Organization' },
    { icon: CheckCircle, label: 'Start Working' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2341] via-[#1A3A5C] to-[#122944] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome!</h1>
          <p className="text-white/70 mt-2">Let's set up your profile to get started</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === 0 ? 'bg-accent' : 'bg-white/20'}`}>
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-white/60 hidden sm:block">{step.label}</p>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-white/20" />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tell us about yourself</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {firebaseUser?.email && (
              <Input
                label="Email Address"
                value={firebaseUser.email}
                disabled
                leftIcon={<Mail className="w-4 h-4" />}
                hint="This is your login email"
              />
            )}
            <Button type="submit" className="w-full" loading={loading} size="lg">
              Complete Setup
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
