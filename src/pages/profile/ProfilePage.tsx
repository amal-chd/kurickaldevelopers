import React, { useState, useRef } from 'react';
import { Camera, LogOut, Mail, Phone, Shield, Check, Edit3, Save, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { updateUser, uploadFile } from '../../lib/firestore';
import { logout } from '../../hooks/useAuth';
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
          style={{ background: `linear-gradient(135deg, ${role?.color ?? '#1A3A5C'}, ${role?.color ?? '#1A3A5C'}cc 55%, ${role?.color ?? '#2C5F8F'}88)` }}
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
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-600 transition-colors shadow-md border-2 border-white"
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
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{appUser.name || appUser.email}</h3>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                {role && (
                  <span
                    className="inline-block text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm"
                    style={{ backgroundColor: role.color ?? '#1A3A5C' }}
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
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                {appUser.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {appUser.email}
                  </span>
                )}
                {appUser.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
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
              <h3 className="font-semibold text-gray-900">My Permissions</h3>
              <p className="text-xs text-gray-400">{permissionKeys.length} permissions granted</p>
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

      {/* Sign out */}
      <Card className="!p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 text-sm">Sign Out</p>
            <p className="text-xs text-gray-400 mt-0.5">You'll need to sign in again to access the app</p>
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
