import React, { useEffect, useState } from 'react';
import { Bell, Send, Shield, Users, User, Megaphone, Clock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';
import { createNotification, getAllUsers } from '../../lib/firestore';
import { AppUser, AppNotification } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const NOTIFICATION_TYPES = [
  { value: 'announcement', label: 'Announcement', icon: '📢', color: 'bg-blue-50 border-blue-200' },
  { value: 'alert', label: 'Alert', icon: '⚠️', color: 'bg-amber-50 border-amber-200' },
  { value: 'reminder', label: 'Reminder', icon: '🔔', color: 'bg-purple-50 border-purple-200' },
  { value: 'update', label: 'Update', icon: '📋', color: 'bg-green-50 border-green-200' },
];

const NotificationAdminPage: React.FC = () => {
  const { can } = usePermissions();
  const { appUser } = useAuthStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('announcement');
  const [targetMode, setTargetMode] = useState<'broadcast' | 'specific'>('broadcast');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    getAllUsers().then(setUsers);

    // Subscribe to recent notifications
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setRecentNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsub();
  }, []);

  if (!can('notifications_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Shield className="w-8 h-8" />} title="Access Denied" description="You need 'notifications_manage' permission." />
      </div>
    );
  }

  const toggleUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (targetMode === 'specific' && selectedUserIds.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }

    setLoading(true);
    try {
      const targets = targetMode === 'broadcast' ? [''] : selectedUserIds;
      await Promise.all(
        targets.map((uid) =>
          createNotification({
            title: title.trim(),
            body: body.trim(),
            userId: uid,
            type,
            isRead: {},
            createdAt: null as any,
          })
        )
      );
      toast.success(
        targetMode === 'broadcast'
          ? 'Broadcast sent to all users!'
          : `Sent to ${selectedUserIds.length} user(s)!`
      );
      setTitle('');
      setBody('');
      setSelectedUserIds([]);
      setTargetMode('broadcast');
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const formatTime = (ts: any) => {
    if (!ts) return '—';
    try { return format(ts.toDate(), 'dd MMM, HH:mm'); } catch { return '—'; }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Push Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">Broadcast or send targeted notifications to staff</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Compose Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><Send className="w-4 h-4" /></div>
              <h3 className="font-semibold text-gray-900">Compose Notification</h3>
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFICATION_TYPES.map((nt) => (
                  <button
                    key={nt.value}
                    onClick={() => setType(nt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      type === nt.value ? `${nt.color} ring-2 ring-primary/30` : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{nt.icon}</span>
                    {nt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
                maxLength={80}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/80</p>
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your notification message..."
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/500</p>
            </div>

            {/* Target */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipients</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTargetMode('broadcast')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium flex-1 justify-center transition-all ${
                    targetMode === 'broadcast' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                  All Users
                </button>
                <button
                  onClick={() => setTargetMode('specific')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium flex-1 justify-center transition-all ${
                    targetMode === 'specific' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Specific
                </button>
              </div>

              {targetMode === 'specific' && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      leftIcon={<Users className="w-4 h-4" />}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {filteredUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="w-4 h-4 accent-primary rounded"
                        />
                        <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedUserIds.length > 0 && (
                    <div className="p-2 bg-primary/5 border-t border-gray-100">
                      <p className="text-xs text-primary font-medium">{selectedUserIds.length} user(s) selected</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            {(title || body) && (
              <div className="p-3 bg-gray-900 rounded-xl">
                <p className="text-xs text-gray-400 mb-2">Preview</p>
                <div className="bg-white rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-3.5 h-3.5 text-gray-500" />
                    <p className="text-xs font-semibold text-gray-800">{title || 'Notification Title'}</p>
                  </div>
                  <p className="text-xs text-gray-600">{body || 'Your message will appear here...'}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSend}
              loading={loading}
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full justify-center"
            >
              {targetMode === 'broadcast' ? 'Broadcast to All' : `Send to ${selectedUserIds.length || 0} User(s)`}
            </Button>
          </Card>
        </div>

        {/* Recent Notifications */}
        <div className="lg:col-span-2">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
              <h3 className="font-semibold text-gray-900">Recent</h3>
            </div>
            {recentNotifs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No notifications sent yet</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {recentNotifs.map((n) => {
                  const typeInfo = NOTIFICATION_TYPES.find((t) => t.value === n.type) ?? NOTIFICATION_TYPES[0];
                  return (
                    <div key={n.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="text-base">{typeInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-gray-400">{formatTime(n.createdAt)}</span>
                            {n.userId === '' ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Broadcast</span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">Targeted</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NotificationAdminPage;
