import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Trash2, Clock, Calendar, Tag, User, MessageSquare,
  CheckSquare, Plus, Check, AlertCircle, ChevronDown, X
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { TaskStatusChip, PriorityChip, CompletionStatusChip } from '../../components/ui/StatusChip';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getTask, getAllUsers, getSubtasks, addSubtask, updateSubtask, deleteSubtask,
  updateTask, deleteTask, getProject, sendMessage, getChannel,
  createNotification, getAllRoles,
} from '../../lib/firestore';
import { Task, Subtask, AppUser, Project, TaskStatus, Role } from '../../types';
import { notifyPush } from '../../lib/push';
import { formatDate, taskStatusLabel, calculateCompletionDetails, formatDelay } from '../../lib/utils';
import toast from 'react-hot-toast';
import Input from '../../components/ui/Input';
import { isAfter } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'done', label: 'Done' },
];

const TaskDetailPage: React.FC = () => {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();

  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const load = async () => {
      try {
        const [t, u, rList] = await Promise.all([
          getTask(taskId),
          getAllUsers(),
          getAllRoles(),
        ]);
        setTask(t);
        setUsers(u);
        setRoles(rList);
        if (t?.projectId) {
          const p = await getProject(t.projectId);
          setProject(p);
        }
        const st = await getSubtasks(taskId);
        setSubtasks(st);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!task) return <div className="flex items-center justify-center h-64 text-gray-500">Task not found</div>;

  const getUser = (uid: string) => users.find((u) => u.id === uid);
  const isManager = can('tasks_approve');
  const displayStatus = isManager ? task.status : (task.memberProgress?.[appUser?.id ?? '']?.status ?? task.status);
  const isOverdue = task.dueDate && isAfter(new Date(), task.dueDate.toDate()) && displayStatus !== 'done';
  const completedSubtasks = subtasks.filter((s) => s.isDone).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!taskId || !appUser || !task) return;
    try {
      const isManager = can('tasks_approve');
      const updatedProgress = { ...(task.memberProgress ?? {}) };
      let nextGlobalStatus = task.status;

      if (!isManager) {
        const details = newStatus === 'done' ? calculateCompletionDetails(new Date(), task.dueDate) : null;
        updatedProgress[appUser.id] = {
          status: newStatus,
          updatedAt: Timestamp.now() as any,
          completedBy: newStatus === 'done' ? appUser.id : undefined,
          completedAt: newStatus === 'done' ? Timestamp.now() as any : undefined,
          completionStatus: details ? details.completionStatus : undefined,
          delaySeconds: details ? details.delaySeconds : undefined,
        };

        const explicitUids = task.assigneeIds ?? [];
        const roleUids: string[] = [];
        const assignedRolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
        if (assignedRolesList.length > 0) {
          users
            .filter((u) => assignedRolesList.includes(u.roleId) && u.isActive)
            .forEach((u) => roleUids.push(u.id));
        }

        const allAssigneeIds = Array.from(new Set([...explicitUids, ...roleUids]));
        let allDone = true;
        for (const uid of allAssigneeIds) {
          const userStatus = updatedProgress[uid]?.status ?? 'in_progress';
          if (userStatus !== 'done') {
            allDone = false;
            break;
          }
        }

        nextGlobalStatus = allDone && allAssigneeIds.length > 0 ? 'done' : 'in_progress';
      } else {
        nextGlobalStatus = newStatus;
        if (newStatus === 'done') {
          const details = calculateCompletionDetails(new Date(), task.dueDate);
          const explicitUids = task.assigneeIds ?? [];
          const roleUids: string[] = [];
          const assignedRolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
          if (assignedRolesList.length > 0) {
            users
              .filter((u) => assignedRolesList.includes(u.roleId) && u.isActive)
              .forEach((u) => roleUids.push(u.id));
          }
          const allAssigneeIds = Array.from(new Set([...explicitUids, ...roleUids]));
          allAssigneeIds.forEach((uid) => {
            updatedProgress[uid] = {
              status: 'done',
              updatedAt: Timestamp.now() as any,
              completedBy: appUser.id,
              completedAt: Timestamp.now() as any,
              completionStatus: details.completionStatus,
              delaySeconds: details.delaySeconds,
            };
          });
        }
      }

      const globalDetails = nextGlobalStatus === 'done' ? calculateCompletionDetails(new Date(), task.dueDate) : null;
      const updateData: any = {
        status: nextGlobalStatus,
        memberProgress: updatedProgress,
      };
      if (nextGlobalStatus === 'done' && globalDetails) {
        updateData.completedAt = Timestamp.now() as any;
        updateData.completionStatus = globalDetails.completionStatus;
        updateData.delaySeconds = globalDetails.delaySeconds;
      } else if (nextGlobalStatus !== 'done') {
        updateData.completedAt = null;
        updateData.completionStatus = null;
        updateData.delaySeconds = null;
      }

      await updateTask(taskId, updateData);
      
      notifyPush({ event: 'task', taskId, kind: 'status' });
      if (task.createdBy && task.createdBy !== appUser.id) {
        createNotification({
          title: 'Task Status Updated',
          body: `${task.title} is now ${taskStatusLabel(nextGlobalStatus)}`,
          userId: task.createdBy,
          type: 'task_updated',
          isRead: {},
          createdAt: null as any,
        }).catch(() => {});
      }

      setTask((prev) => prev ? { ...prev, ...updateData } : prev);
      setStatusOpen(false);

      if (task.projectId) {
        const channelId = `project_${task.projectId}`;
        try {
          const ch = await getChannel(channelId);
          if (ch) {
            await sendMessage(channelId, {
              senderId: appUser.id,
              text: `Task "${task.title}" status changed to ${taskStatusLabel(nextGlobalStatus)}`,
              type: 'system',
              reactions: {},
              mentionedUserIds: [],
              isDeleted: false,
            });
          }
        } catch {}
      }
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!taskId || !appUser) return;
    try {
      await updateSubtask(taskId, subtask.id, {
        isDone: !subtask.isDone,
        completedBy: !subtask.isDone ? appUser.id : undefined,
      });
      setSubtasks((prev) =>
        prev.map((s) => s.id === subtask.id ? { ...s, isDone: !s.isDone } : s)
      );
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const handleAddSubtask = async () => {
    if (!taskId || !newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const id = await addSubtask(taskId, { title: newSubtask.trim(), isDone: false });
      setSubtasks((prev) => [...prev, { id, title: newSubtask.trim(), isDone: false }]);
      setNewSubtask('');
    } catch {
      toast.error('Failed to add subtask');
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
      navigate('/app/tasks');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleGoToProjectChat = () => {
    if (task.projectId) {
      navigate(`/app/chat/project_${task.projectId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" 
        onClick={() => navigate('/app/tasks')} 
      />
      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-slate-50 h-full shadow-2xl animate-slide-in-right overflow-y-auto flex flex-col border-l border-slate-200/60">
        <div className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Task Details</h2>
            <div className="flex items-center gap-2">
              {can('tasks_edit') && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit className="w-4 h-4" />}
                  onClick={() => navigate(`/app/tasks/${taskId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {can('tasks_delete') && (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete
                </Button>
              )}
              <button 
                onClick={() => navigate('/app/tasks')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-xl font-bold text-gray-900 flex-1">{task.title}</h1>
              <div className="relative">
                <button
                  onClick={() => setStatusOpen(!statusOpen)}
                  className="flex items-center gap-1"
                >
                  <CompletionStatusChip status={displayStatus} completionStatus={task.memberProgress?.[appUser?.id ?? '']?.completionStatus ?? task.completionStatus} dueDate={task.dueDate} />
                  {<ChevronDown className="w-3 h-3 text-gray-500" />}
                </button>
                {statusOpen && can('tasks_edit') && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden min-w-36">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                        onClick={() => handleStatusChange(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <PriorityChip priority={task.priority} />
              {isOverdue && (
                <Badge variant="danger">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Overdue
                </Badge>
              )}
              {task.tags?.map((tag) => (
                <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>

            {task.description && (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
            )}
          </Card>

          {/* Subtasks */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                Subtasks ({completedSubtasks}/{subtasks.length})
              </h3>
              <span className="text-sm text-gray-500">{subtaskProgress}%</span>
            </div>

            {subtasks.length > 0 && (
              <div className="mb-3">
                <div className="bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 mb-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl group"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      subtask.isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-primary'
                    }`}
                  >
                    {subtask.isDone && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`text-sm flex-1 ${subtask.isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {subtask.title}
                  </span>
                  {can('tasks_edit') && (
                    <button
                      onClick={() => deleteSubtask(taskId!, subtask.id).then(() =>
                        setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id))
                      )}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {can('tasks_edit') && (
              <div className="flex gap-2">
                <Input
                  placeholder="Add subtask..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleAddSubtask} loading={addingSubtask}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right - details */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Due: </span>
                <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-900'}>
                  {formatDate(task.dueDate)}
                </span>
              </div>
              {(task.status === 'done' || task.status === 'approved') && task.completedAt && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Completed: </span>
                  <span className="text-gray-900 font-medium">
                    {formatDate(task.completedAt)}
                  </span>
                </div>
              )}
              {task.delaySeconds !== undefined && task.delaySeconds > 0 && (
                <div className="flex items-center gap-2 text-rose-600 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>Delay: {formatDelay(task.delaySeconds)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Est: {task.estimatedHours ?? 0}h</span>
              </div>
              {project && (
                <div
                  className="flex items-center gap-2 text-gray-600 cursor-pointer hover:text-primary"
                  onClick={() => navigate(`/app/projects/${project.id}`)}
                >
                  <Tag className="w-4 h-4 text-gray-400" />
                  <span>{project.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <span>Created: {formatDate(task.createdAt)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">Assignees</h3>
            <div className="space-y-2">
              {task.assigneeIds?.map((uid) => {
                const u = getUser(uid);
                if (!u) return null;
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-xl"
                    onClick={() => navigate(`/app/team/${uid}`)}
                  >
                    <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                    <span className="text-sm text-gray-700">{u.name}</span>
                  </div>
                );
              })}
              {!task.assigneeIds?.length && (
                <p className="text-sm text-gray-400">No individual assignees</p>
              )}
            </div>
          </Card>

          {(() => {
            const rolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
            if (rolesList.length === 0) return null;
            return (
              <Card>
                <h3 className="font-semibold text-gray-900 mb-3">Assigned Roles</h3>
                <div className="space-y-2">
                  {rolesList.map((rid) => {
                    const r = roles.find((roleItem) => roleItem.id === rid);
                    if (!r) return null;
                    return (
                      <div key={rid} className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="text-sm font-semibold" style={{ color: r.color }}>
                          {r.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {isManager && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-3">Member Progress</h3>
              <div className="space-y-2">
                {(() => {
                  const explicitUids = task.assigneeIds ?? [];
                  const roleUids: string[] = [];
                  const assignedRolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
                  if (assignedRolesList.length > 0) {
                    users
                      .filter((u) => assignedRolesList.includes(u.roleId) && u.isActive)
                      .forEach((u) => roleUids.push(u.id));
                  }
                  const allAssigneeIds = Array.from(new Set([...explicitUids, ...roleUids]));
                  if (allAssigneeIds.length === 0) {
                    return <p className="text-sm text-gray-400">No members assigned</p>;
                  }
                  return allAssigneeIds.map((uid) => {
                    const u = getUser(uid);
                    if (!u) return null;
                    const prog = task.memberProgress?.[uid];
                    const uStatus: TaskStatus = prog?.status ?? 'in_progress';
                    return (
                      <div key={uid} className="flex items-center justify-between p-2 border border-gray-100 rounded-xl hover:bg-gray-50/50">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/app/team/${uid}`)}>
                          <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                          <span className="text-xs font-semibold text-gray-700">{u.name}</span>
                        </div>
                        <TaskStatusChip status={uStatus} />
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {task.projectId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                leftIcon={<MessageSquare className="w-4 h-4" />}
                onClick={handleGoToProjectChat}
              >
                Go to Project Chat
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Delete confirm */}
      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Task"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        }
      >
        <p className="text-gray-600">Are you sure you want to delete this task? This cannot be undone.</p>
      </Modal>
      </div>
    </div>
  );
};

export default TaskDetailPage;
