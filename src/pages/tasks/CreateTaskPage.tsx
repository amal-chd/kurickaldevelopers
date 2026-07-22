import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { createTask, updateTask, getTask, getAllUsers, getProjects, getTaskAssignmentConfig, createNotification, getAllRoles } from '../../lib/firestore';
import { notifyPush } from '../../lib/push';
import { Task, AppUser, Project, TaskPriority, TaskStatus, TaskAssignmentConfig, Role } from '../../types';
import toast from 'react-hot-toast';
import Avatar from '../../components/ui/Avatar';

const CreateTaskPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const isEdit = !!taskId;
  const navigate = useNavigate();
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();

  // Edit needs tasks_edit; create needs tasks_create.
  const canAccess = isEdit ? can('tasks_edit') : can('tasks_create');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignConfig, setAssignConfig] = useState<TaskAssignmentConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    projectId: '',
    status: 'in_progress' as TaskStatus,
    priority: 'medium' as TaskPriority,
    dueDate: '',
    estimatedHours: '',
    tags: '',
    assigneeIds: [] as string[],
    assignedRoleIds: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      const [u, p, cfg, r] = await Promise.all([
        getAllUsers(),
        getProjects(),
        getTaskAssignmentConfig(),
        getAllRoles(),
      ]);
      setUsers(u);
      setProjects(p);
      setAssignConfig(cfg);
      setRoles(r);

      if (isEdit && taskId) {
        const task = await getTask(taskId);
        if (task) {
          setForm({
            title: task.title,
            description: task.description,
            projectId: task.projectId,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ? task.dueDate.toDate().toISOString().split('T')[0] : '',
            estimatedHours: String(task.estimatedHours ?? ''),
            tags: task.tags?.join(', ') ?? '',
            assigneeIds: task.assigneeIds ?? [],
            assignedRoleIds: task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []),
          });
        }
      }
    };
    load();
  }, [isEdit, taskId]);

  // Which users the current user is allowed to assign this task to.
  // Driven by the Director's assignment matrix; falls back to "everyone" when
  // the rules are disabled or this role hasn't been configured. Already-selected
  // assignees stay visible so editing never silently drops them.
  const assignableUsers = (() => {
    if (!assignConfig || !assignConfig.enabled) return users;
    const myRole = appUser?.roleId ?? '';
    const allowed = assignConfig.matrix?.[myRole];
    if (!allowed) return users; // role not configured → unrestricted
    return users.filter(
      (u) => allowed.includes(u.roleId) || form.assigneeIds.includes(u.id),
    );
  })();

  // Which roles the current user is allowed to assign this task to.
  const assignableRoles = (() => {
    if (!assignConfig || !assignConfig.enabled) {
      const myLevel = role?.level ?? 0;
      return roles.filter((r) => r.level < myLevel);
    }
    const myRole = appUser?.roleId ?? '';
    const allowed = assignConfig.matrix?.[myRole];
    if (!allowed) {
      const myLevel = role?.level ?? 0;
      return roles.filter((r) => r.level < myLevel);
    }
    return roles.filter((r) => allowed.includes(r.id));
  })();

  const assignmentRestricted =
    !!assignConfig?.enabled && !!assignConfig.matrix?.[appUser?.roleId ?? ''];

  const toggleAssignee = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(uid)
        ? prev.assigneeIds.filter((id) => id !== uid)
        : [...prev.assigneeIds, uid],
    }));
  };

  const toggleAssignedRole = (rid: string) => {
    setForm((prev) => ({
      ...prev,
      assignedRoleIds: prev.assignedRoleIds.includes(rid)
        ? prev.assignedRoleIds.filter((id) => id !== rid)
        : [...prev.assignedRoleIds, rid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser || !form.title.trim()) return;
    if (!form.projectId) {
      toast.error('Please select a project');
      return;
    }

    setLoading(true);
    try {
      const data: Omit<Task, 'id'> = {
        title: form.title.trim(),
        description: form.description.trim(),
        projectId: form.projectId,
        status: form.status,
        priority: form.priority,
        // No due date picked → default to end of TODAY. Using Timestamp.now()
        // made the task overdue seconds after creation, unfairly counting it
        // as "completed late" in the performance point system.
        dueDate: form.dueDate
          ? Timestamp.fromDate(new Date(`${form.dueDate}T23:59:59`))
          : Timestamp.fromDate(new Date(new Date().setHours(23, 59, 59, 999))),
        estimatedHours: Number(form.estimatedHours) || 0,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        assigneeIds: form.assigneeIds,
        assignedRoleIds: form.assignedRoleIds,
        createdBy: appUser.id,
        approvalStatus: 'none' as const,
        createdAt: isEdit && taskId ? (await getTask(taskId))?.createdAt || Timestamp.now() : Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (isEdit && taskId) {
        await updateTask(taskId, data);
        if (form.assigneeIds.length > 0) notifyPush({ event: 'task', taskId, kind: 'assigned' });
        
        // Notify role members if assignedRoleIds are newly set or changed
        getTask(taskId).then((oldTask) => {
          if (oldTask) {
            const oldRoles = oldTask.assignedRoleIds ?? (oldTask.assignedRoleId ? [oldTask.assignedRoleId] : []);
            const newRoles = form.assignedRoleIds;
            const newlyAddedRoles = newRoles.filter((r) => !oldRoles.includes(r));
            if (newlyAddedRoles.length > 0) {
              getAllUsers().then((allUsers) => {
                allUsers
                  .filter((u) => newlyAddedRoles.includes(u.roleId) && u.id !== appUser.id && u.isActive)
                  .forEach((u) => {
                    createNotification({
                      title: 'New Role Task Assigned',
                      body: `A task has been assigned to your role: ${form.title.trim()}`,
                      userId: u.id,
                      type: 'task_assigned',
                      isRead: {},
                      createdAt: null as any,
                    }).catch(() => {});
                  });
              });
            }
          }
        });

        toast.success('Task updated');
      } else {
        const id = await createTask(data);
        if (form.assigneeIds.length > 0) {
          notifyPush({ event: 'task', taskId: id, kind: 'assigned' });
          form.assigneeIds
            .filter((uid) => uid !== appUser.id)
            .forEach((uid) =>
              createNotification({
                title: 'New Task Assigned',
                body: `You have been assigned to: ${form.title.trim()}`,
                userId: uid,
                type: 'task_assigned',
                isRead: {},
                createdAt: null as any,
              }).catch(() => {}),
            );
        }
        if (form.assignedRoleIds.length > 0) {
          getAllUsers().then((allUsers) => {
            allUsers
              .filter((u) => form.assignedRoleIds.includes(u.roleId) && u.id !== appUser.id && u.isActive)
              .forEach((u) => {
                createNotification({
                  title: 'New Role Task Assigned',
                  body: `A task has been assigned to your role: ${form.title.trim()}`,
                  userId: u.id,
                  type: 'task_assigned',
                  isRead: {},
                  createdAt: null as any,
                }).catch(() => {});
              });
          });
        }
        toast.success('Task created');
        navigate(`/app/tasks/${id}`);
        return;
      }
      navigate(`/app/tasks/${taskId}`);
    } catch (err) {
      toast.error('Failed to save task');
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
          description={`You need '${isEdit ? 'tasks_edit' : 'tasks_create'}' permission.`}
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
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{isEdit ? 'Edit Task' : 'Create Task'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">Task Information</h3>
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="Task title..."
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
            <Textarea
              label="Description"
              placeholder="Describe the task..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Project"
                value={form.projectId}
                onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Select project"
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                options={[
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'done', label: 'Done' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
              <Input
                label="Estimated Hours"
                type="number"
                placeholder="0"
                value={form.estimatedHours}
                onChange={(e) => setForm((p) => ({ ...p, estimatedHours: e.target.value }))}
                min="0"
              />
            </div>
            <Input
              label="Due Date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
            <Input
              label="Tags"
              placeholder="design, urgent, review (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900 mb-3">Assign to Roles / Departments / Teams</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {assignableRoles.map((roleItem) => {
              const selected = form.assignedRoleIds.includes(roleItem.id);
              return (
                <button
                  key={roleItem.id}
                  type="button"
                  onClick={() => toggleAssignedRole(roleItem.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" style={{ color: roleItem.color || '#0F172A' }} />
                  <span className="text-xs font-medium truncate">{roleItem.name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-900 mb-3">Assignees</h3>
          {assignmentRestricted && (
            <p className="text-xs text-slate-500 mb-3 -mt-1">
              You can assign this task only to the roles your Director has allowed.
            </p>
          )}
          {assignableUsers.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Your role isn't allowed to assign tasks to anyone. Ask your Director to update the assignment rules.
            </p>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {assignableUsers.map((user) => {
              const selected = form.assigneeIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleAssignee(user.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                  <span className="text-xs font-medium truncate">{user.name}</span>
                </button>
              );
            })}
          </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateTaskPage;
