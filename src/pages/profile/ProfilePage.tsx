import React, { useState, useRef } from 'react';
import { Camera, LogOut, Mail, Phone, Shield, Check, Edit3, Save, X, Bell, Megaphone, MessageSquare, CheckSquare, Key, Lock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { updateUser, uploadFile } from '../../lib/firestore';
import { logout } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const { appUser, firebaseUser, role, permissions, setAppUser } = useAuthStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(appUser?.name ?? '');
  const [email, setEmail] = useState(appUser?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [prefAnnouncements, setPrefAnnouncements] = useState(appUser?.preferences?.announcements ?? true);
  const [prefChats, setPrefChats] = useState(appUser?.preferences?.chats ?? true);
  const [prefTasks, setPrefTasks] = useState(appUser?.preferences?.tasks ?? true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast.error('You must be logged in with an email account to change your password');
      return;
    }
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      console.error('Change password error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect');
      } else if (err.code === 'auth/weak-password') {
        toast.error('New password is too weak');
      } else {
        toast.error(err.message || 'Failed to change password');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleTogglePreference = async (key: 'announcements' | 'chats' | 'tasks', val: boolean) => {
    if (!appUser) return;
    const newPrefs = {
      announcements: key === 'announcements' ? val : prefAnnouncements,
      chats: key === 'chats' ? val : prefChats,
      tasks: key === 'tasks' ? val : prefTasks,
    };

    if (key === 'announcements') setPrefAnnouncements(val);
    if (key === 'chats') setPrefChats(val);
    if (key === 'tasks') setPrefTasks(val);

    try {
      await updateUser(appUser.id, { preferences: newPrefs });
      setAppUser({ ...appUser, preferences: newPrefs });
      toast.success('Notification preferences updated');
    } catch {
      toast.error('Failed to update notification preferences');
      if (key === 'announcements') setPrefAnnouncements(!val);
      if (key === 'chats') setPrefChats(!val);
      if (key === 'tasks') setPrefTasks(!val);
    }
  };

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    try {
      await updateUser(appUser.id, { name, email });
      setAppUser({ ...appUser, name, email });
      toast.success('Profile updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(appUser?.name ?? '');
    setEmail(appUser?.email ?? '');
    setEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, `avatars/${appUser.id}`);
      await updateUser(appUser.id, { avatarUrl: url });
      setAppUser({ ...appUser, avatarUrl: url });
      toast.success('Avatar updated');
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!appUser) return null;

  const permissionKeys = Object.entries(permissions).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

      {/* Profile hero card */}
      <Card padding={false} className="overflow-hidden">
        {/* Cover gradient */}
        <div
          className="h-28 relative"
          style={{ background: `linear-gradient(135deg, ${role?.color ?? '#0F172A'}, ${role?.color ?? '#0F172A'}cc 55%, ${role?.color ?? '#334155'}88)` }}
        >
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="relative">
              <div className="ring-4 ring-white rounded-full shadow-lg">
                <Avatar name={appUser.name} src={appUser.avatarUrl} size="xl" />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md border-2 border-white"
              >
                {uploading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="flex gap-2 pb-1">
              {!editing ? (
                <Button variant="outline" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setEditing(true)}>
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" leftIcon={<X className="w-3.5 h-3.5" />} onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} loading={saving} onClick={handleSave}>
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Info */}
          {editing ? (
            <div className="space-y-3">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input
                label="Phone Number"
                value={firebaseUser?.phoneNumber ?? appUser.phone}
                disabled
                hint="Phone number cannot be changed here"
              />
            </div>
          ) : (
            <div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{appUser.name || appUser.email}</h3>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                {role && (
                  <span
                    className="inline-block text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm"
                    style={{ backgroundColor: role.color ?? '#0F172A' }}
                  >
                    {role.name}
                  </span>
                )}
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  appUser.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  {appUser.isActive ? '● Active' : '○ Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                {appUser.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {appUser.email}
                  </span>
                )}
                {appUser.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {appUser.phone}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Permissions */}
      {permissionKeys.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">My Permissions</h3>
              <p className="text-xs text-slate-400">{permissionKeys.length} permissions granted</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {permissionKeys.map((key) => (
              <div key={key} className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                <Check className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{key.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Notification Settings</h3>
            <p className="text-xs text-slate-400">Choose what updates you want to receive</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Announcements Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div className="flex gap-3">
              <div className="p-2 bg-purple-50 rounded-xl h-fit border border-purple-100 flex-shrink-0">
                <Megaphone className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-900">Group Announcements</p>
                <p className="text-xs text-slate-400">Broad updates and group-wide notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefAnnouncements}
                onChange={(e) => handleTogglePreference('announcements', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Chats Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div className="flex gap-3">
              <div className="p-2 bg-blue-50 rounded-xl h-fit border border-blue-100 flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-900">Chat Messages</p>
                <p className="text-xs text-slate-400">Push notifications for direct and group chats</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefChats}
                onChange={(e) => handleTogglePreference('chats', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Tasks Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl h-fit border border-emerald-100 flex-shrink-0">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-900">Task Assignments</p>
                <p className="text-xs text-slate-400">Reminders for assignments and status updates</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefTasks}
                onChange={(e) => handleTogglePreference('tasks', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Security & Password */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100 flex-shrink-0">
              <Key className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Account Security</h3>
              <p className="text-xs text-slate-400">Update your account password regularly for better security</p>
            </div>
          </div>
          <Button
            variant={showPasswordSection ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
          >
            {showPasswordSection ? 'Cancel' : 'Change Password'}
          </Button>
        </div>

        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="mt-5 pt-4 border-t border-slate-100 space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasswordSection(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={changingPassword} leftIcon={<Lock className="w-3.5 h-3.5" />}>
                Update Password
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Sign out */}
      <Card className="!p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 text-sm">Sign Out</p>
            <p className="text-xs text-slate-400 mt-0.5">You'll need to sign in again to access the app</p>
          </div>
          <Button variant="danger" size="sm" leftIcon={<LogOut className="w-4 h-4" />} onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
