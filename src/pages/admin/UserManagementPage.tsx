import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Edit2, UserX, UserCheck, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import EmptyState from '../../components/ui/EmptyState';
import { getAllUsers, getAllRoles, updateUser, addAuditLog, createUser } from '../../lib/firestore';
import { AppUser, Role } from '../../types';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { serverTimestamp } from '../../lib/firestore';

const UserManagementPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [u, r] = await Promise.all([getAllUsers(), getAllRoles()]);
      setUsers(u);
      setRoles(r);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? 'No Role';

  const openEdit = (user: AppUser) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.roleId);
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!editUser || !appUser) return;
    setSaving(true);
    try {
      await updateUser(editUser.id, { name: editName, email: editEmail, roleId: editRole });
      await addAuditLog({
        action: 'user_updated',
        userId: appUser.id,
        userName: appUser.name,
        targetId: editUser.id,
        targetType: 'user',
        details: `Updated user ${editUser.name}`,
        createdAt: serverTimestamp() as any,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id ? { ...u, name: editName, email: editEmail, roleId: editRole } : u
        )
      );
      setEditModal(false);
      toast.success('User updated');
    } catch {
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: AppUser) => {
    if (!appUser) return;
    await updateUser(user.id, { isActive: !user.isActive });
    await addAuditLog({
      action: user.isActive ? 'user_deactivated' : 'user_activated',
      userId: appUser.id,
      userName: appUser.name,
      targetId: user.id,
      targetType: 'user',
      details: `${user.isActive ? 'Deactivated' : 'Activated'} user ${user.name}`,
      createdAt: serverTimestamp() as any,
    });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/app/admin')}>
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} total users</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      <Card padding={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">User</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Contact</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                    <div>
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-400 md:hidden">{user.email || user.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell text-gray-500 text-xs">{user.email || user.phone}</td>
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{getRoleName(user.roleId)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors" onClick={() => openEdit(user)} title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className={`p-2 rounded-xl transition-colors ${user.isActive ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                      onClick={() => toggleActive(user)}
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon={<Search className="w-8 h-8" />} title="No users found" description="Try adjusting your search." />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit ${editUser?.name}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          <Select
            label="Role"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Select role"
          />
        </div>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
