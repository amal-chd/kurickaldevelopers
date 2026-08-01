import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Shield } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input, { Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { getAllRoles, createRole, updateRole, deleteRole } from '../../lib/firestore';
import { Role, Permissions } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';

const ALL_PERMISSIONS: (keyof Permissions)[] = [
  'tasks_view', 'tasks_view_all', 'tasks_create', 'tasks_edit', 'tasks_delete', 'tasks_approve',
  'projects_view', 'projects_view_all', 'projects_create', 'projects_edit', 'projects_delete',
  'docs_view', 'docs_view_all', 'docs_upload', 'docs_approve',
  'team_view', 'team_manage', 'team_delete',
  'reports_view', 'reports_export',
  'time_log', 'time_view_all',
  'roles_manage', 'settings_manage',
  'notifications_manage',
  'chat_view', 'chat_send', 'chat_create_group', 'chat_announce', 'chat_moderate',
  'attendance_view_all',
  'contact_view', 'contact_manage',
  'performance_view', 'performance_manage',
];

const RoleManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#0F172A',
    level: '1',
    permissions: {} as Permissions,
  });

  const canManage = can('roles_manage') || (role?.level ?? 0) >= 100;

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    getAllRoles().then((r) => { setRoles(r); setLoading(false); });
  }, [canManage]);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="Access Denied"
          description="You don't have permission to manage roles."
        />
      </div>
    );
  }

  const resetForm = () => {
    setForm({ name: '', description: '', color: '#0F172A', level: '1', permissions: {} });
    setEditing(null);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setForm({
      name: role.name,
      description: role.description,
      color: role.color,
      level: String(role.level),
      permissions: { ...role.permissions },
    });
    setModal(true);
  };

  const togglePerm = (perm: keyof Permissions) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [perm]: !prev.permissions[perm] },
    }));
  };

  const handleSave = async () => {
    if (!appUser || !form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        level: Number(form.level),
        permissions: form.permissions,
        createdBy: appUser.id,
      };
      if (editing) {
        await updateRole(editing.id, data);
        setRoles((prev) => prev.map((r) => r.id === editing.id ? { ...r, ...data } : r));
        toast.success('Role updated');
      } else {
        const id = await createRole(data);
        setRoles((prev) => [...prev, { id, ...data }]);
        toast.success('Role created');
      }
      setModal(false);
      resetForm();
    } catch {
      toast.error('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!window.confirm('Delete this role?')) return;
    await deleteRole(roleId);
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    toast.success('Role deleted');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold text-slate-900 flex-1">Role Management</h2>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setModal(true); }}>
          New Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="No roles yet"
          description="Create your first role to assign permissions."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const permCount = Object.values(role.permissions).filter(Boolean).length;
            return (
              <Card key={role.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: role.color }}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{role.name}</p>
                    <p className="text-xs text-slate-500">Level {role.level}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg" onClick={() => openEdit(role)}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {role.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{role.description}</p>
                )}
                <p className="text-xs text-slate-500">{permCount} permissions enabled</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); resetForm(); }}
        title={editing ? `Edit ${editing.name}` : 'Create Role'}
        size="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Role</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Role Name"
              placeholder="e.g. Site Manager"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <Input
              label="Level"
              type="number"
              value={form.level}
              onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
              min="1"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Color:</label>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer"
            />
            <span className="text-sm text-slate-500">{form.color}</span>
          </div>
          <Textarea
            label="Description"
            placeholder="Role description..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
          />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Permissions</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                    form.permissions[perm]
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!form.permissions[perm]}
                    onChange={() => togglePerm(perm)}
                    className="rounded border-slate-300 text-primary"
                  />
                  <span>{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagementPage;
