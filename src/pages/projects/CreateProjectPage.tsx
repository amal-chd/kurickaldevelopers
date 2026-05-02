import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { createProject, updateProject, getProject, getAllUsers } from '../../lib/firestore';
import { AppUser, ProjectStatus } from '../../types';
import toast from 'react-hot-toast';

const CreateProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const isEdit = !!projectId;
  const navigate = useNavigate();
  const { appUser } = useAuthStore();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planning' as ProjectStatus,
    startDate: '',
    endDate: '',
    budget: '',
    managerId: '',
    memberIds: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      const u = await getAllUsers();
      setUsers(u);
      if (isEdit && projectId) {
        const p = await getProject(projectId);
        if (p) {
          setForm({
            name: p.name,
            description: p.description,
            status: p.status,
            startDate: p.startDate?.toDate().toISOString().split('T')[0] ?? '',
            endDate: p.endDate?.toDate().toISOString().split('T')[0] ?? '',
            budget: String(p.budget ?? ''),
            managerId: p.managerId,
            memberIds: p.memberIds ?? [],
          });
        }
      }
    };
    load();
  }, [isEdit, projectId]);

  const toggleMember = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(uid)
        ? prev.memberIds.filter((id) => id !== uid)
        : [...prev.memberIds, uid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        startDate: form.startDate ? Timestamp.fromDate(new Date(form.startDate)) : Timestamp.now(),
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : Timestamp.now(),
        budget: Number(form.budget) || 0,
        managerId: form.managerId || appUser.id,
        memberIds: form.memberIds,
      };

      if (isEdit && projectId) {
        await updateProject(projectId, data);
        toast.success('Project updated');
        navigate(`/app/projects/${projectId}`);
      } else {
        const id = await createProject(data);
        toast.success('Project created');
        navigate(`/app/projects/${id}`);
      }
    } catch {
      toast.error('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edit Project' : 'Create Project'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
          <div className="space-y-4">
            <Input
              label="Project Name"
              placeholder="e.g. Building Construction Phase 1"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <Textarea
              label="Description"
              placeholder="Project description..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                options={[
                  { value: 'planning', label: 'Planning' },
                  { value: 'active', label: 'Active' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
              <Input
                label="Budget ($)"
                type="number"
                placeholder="0"
                value={form.budget}
                onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                min="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
              <Input
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <Select
              label="Manager"
              value={form.managerId}
              onChange={(e) => setForm((p) => ({ ...p, managerId: e.target.value }))}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Select manager"
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Team Members</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {users.map((user) => {
              const selected = form.memberIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleMember(user.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                  <span className="text-xs font-medium truncate">{user.name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage;
