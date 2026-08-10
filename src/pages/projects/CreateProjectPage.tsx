import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { createProject, updateProject, getProject, getAllUsers, syncProjectChannel } from '../../lib/firestore';
import { logAudit, AuditCategory } from '../../lib/auditLog';
import { AppUser, Project, ProjectStatus } from '../../types';
import toast from 'react-hot-toast';

const CreateProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const isEdit = !!projectId;
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();

  const canAccess = isEdit ? can('projects_edit') : can('projects_create');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    siteAddress: '',
    clientName: '',
    status: 'active' as ProjectStatus,
    startDate: '',
    expectedEndDate: '',
    budget: '',
    projectManagerId: '',
    memberIds: [] as string[],
    healthStatus: 'green' as any,
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
            siteAddress: p.siteAddress || '',
            clientName: p.clientName || '',
            status: p.status,
            startDate: p.startDate?.toDate().toISOString().split('T')[0] ?? '',
            expectedEndDate: p.expectedEndDate?.toDate().toISOString().split('T')[0] ?? '',
            budget: String(p.budget ?? ''),
            projectManagerId: p.projectManagerId,
            memberIds: p.memberIds ?? [],
            healthStatus: p.healthStatus || 'green',
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
    if (!form.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (form.startDate && form.expectedEndDate && new Date(form.expectedEndDate) < new Date(form.startDate)) {
      toast.error('Expected end date cannot be before the start date');
      return;
    }
    setLoading(true);
    try {
      // Omit start/end date entirely when blank — Firestore rejects undefined,
      // and Timestamp.now() defaults previously polluted project timelines.
      const data: Omit<Project, 'id' | 'startDate' | 'expectedEndDate'> &
        Pick<Project, 'startDate' | 'expectedEndDate'> = {
        name: form.name.trim(),
        description: form.description.trim(),
        siteAddress: form.siteAddress.trim(),
        clientName: form.clientName.trim(),
        status: form.status,
        ...(form.startDate ? { startDate: Timestamp.fromDate(new Date(form.startDate)) } : { startDate: Timestamp.now() }),
        ...(form.expectedEndDate ? { expectedEndDate: Timestamp.fromDate(new Date(form.expectedEndDate)) } : { expectedEndDate: Timestamp.now() }),
        budget: Number(form.budget) || 0,
        projectManagerId: form.projectManagerId || appUser.id,
        progressPercent: isEdit && projectId ? (await getProject(projectId))?.progressPercent || 0 : 0,
        healthStatus: form.healthStatus,
        createdAt: isEdit && projectId ? (await getProject(projectId))?.createdAt || Timestamp.now() : Timestamp.now(),
        memberIds: Array.from(
          new Set([...form.memberIds, form.projectManagerId || appUser.id, appUser.id].filter(Boolean)),
        ),
      };

      if (isEdit && projectId) {
        await updateProject(projectId, data);
        await syncProjectChannel(projectId, data.name, data.memberIds, data.projectManagerId).catch(() => {});
        void logAudit({
          action: 'project.updated',
          category: AuditCategory.project,
          targetId: projectId,
          targetName: data.name,
          description: `Updated project "${data.name}"`,
          meta: { members: data.memberIds.length },
        });
        toast.success('Project updated');
        navigate(`/app/projects/${projectId}`);
      } else {
        const id = await createProject(data);
        await syncProjectChannel(id, data.name, data.memberIds, data.projectManagerId).catch(() => {});
        void logAudit({
          action: 'project.created',
          category: AuditCategory.project,
          targetId: id,
          targetName: data.name,
          description: `Created project "${data.name}"`,
          meta: { client: data.clientName, members: data.memberIds.length },
        });
        toast.success('Project created');
        navigate(`/app/projects/${id}`);
      }
    } catch {
      toast.error('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="Access Denied"
          description={`You need '${isEdit ? 'projects_edit' : 'projects_create'}' permission.`}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {isEdit ? 'Edit Project' : 'Create Project'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">Project Details</h3>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Site Address"
                placeholder="Site Address"
                value={form.siteAddress}
                onChange={(e) => setForm((p) => ({ ...p, siteAddress: e.target.value }))}
              />
              <Input
                label="Client Name"
                placeholder="Client Name"
                value={form.clientName}
                onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
              <Select
                label="Health Status"
                value={form.healthStatus}
                onChange={(e) => setForm((p) => ({ ...p, healthStatus: e.target.value as any }))}
                options={[
                  { value: 'green', label: 'Green (On Track)' },
                  { value: 'amber', label: 'Amber (At Risk)' },
                  { value: 'red', label: 'Red (Delayed)' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Budget ($)"
                type="number"
                placeholder="0"
                value={form.budget}
                onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                min="0"
              />
              <Select
                label="Project Manager"
                value={form.projectManagerId}
                onChange={(e) => setForm((p) => ({ ...p, projectManagerId: e.target.value }))}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                placeholder="Select manager"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
              <Input
                label="Expected End Date"
                type="date"
                value={form.expectedEndDate}
                onChange={(e) => setForm((p) => ({ ...p, expectedEndDate: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900 mb-3">Team Members</h3>
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
                      : 'border-slate-200 hover:border-slate-300'
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
