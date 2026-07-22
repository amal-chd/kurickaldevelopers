import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Trash2, Clock, Calendar, Tag, User, MessageSquare,
  CheckSquare, Plus, Check, AlertCircle, ChevronDown, ArrowLeft, Lock
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
  getTask, getAllUsers, addSubtask, updateSubtask, deleteSubtask,
  updateTask, deleteTask, getProject, sendMessage, getChannel,
  createNotification, getAllRoles, addComment, subscribeComments, subscribeSubtasks,
} from '../../lib/firestore';
import { Task, Subtask, TaskComment, AppUser, Project, TaskStatus, Role } from '../../types';
import { notifyPush } from '../../lib/push';
import { formatDate, formatDateTime, taskStatusLabel, calculateCompletionDetails, formatDelay } from '../../lib/utils';
import toast from 'react-hot-toast';
import Input from '../../components/ui/Input';
import { isAfter } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'in_progress', label: 'In Progress' },
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
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
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
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsubSubtasks = subscribeSubtasks(taskId, (st) => setSubtasks(st));
    const unsubComments = subscribeComments(taskId, (cm) => setComments(cm));
    return () => {
      unsubSubtasks?.();
      unsubComments?.();
    };
  }, [taskId]);

  if (loading) return <div className="flex items-center justify-center h-full min-h-[50vh]"><Spinner size="lg" /></div>;
  if (!task) return <div className="flex items-center justify-center h-full min-h-[50vh] text-slate-500">Task not found</div>;

  const getUser = (uid: string) => users.find((u) => u.id === uid);
  const isManager = can('tasks_approve');
  const explicitUids = task.assigneeIds ?? [];
  const assignedRolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
  const isAssignee = Boolean(
    appUser && (
      explicitUids.includes(appUser.id) ||
      assignedRolesList.includes(appUser.roleId)
    )
  );
  const canEditStatus = isManager || isAssignee;

  const myRole = roles.find((r) => r.id === appUser?.roleId);
  const isProjectManager = Boolean(project && appUser && project.projectManagerId === appUser.id);
  const isAssigner = Boolean(task.createdBy && appUser && task.createdBy === appUser.id);
  const isHigherAuthority = Boolean(
    (myRole && (myRole.level ?? 0) >= 60) ||
    can('tasks_approve') ||
    can('tasks_edit') ||
    can('tasks_create') ||
    (myRole && (myRole.level ?? 0) > (roles.find((r) => r.id === (users.find((u) => u.id === task.createdBy)?.roleId))?.level ?? 0))
  );
  const canComment = isProjectManager || isAssigner || isHigherAuthority;

  const canMarkDone = Boolean(isManager || isProjectManager || isAssigner || can('tasks_edit'));
  const displayStatus = canMarkDone ? task.status : (task.memberProgress?.[appUser?.id ?? '']?.status ?? task.status);
  const isOverdue = task.dueDate && isAfter(new Date(), task.dueDate.toDate()) && displayStatus !== 'done';
  const completedSubtasks = subtasks.filter((s) => s.isDone).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const statusOptions: { value: TaskStatus; label: string }[] = canMarkDone
    ? [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'done', label: 'Done' },
      ]
    : [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'under_review', label: 'Submit for Review' },
      ];

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!taskId || !appUser || !task) return;
    if (!canMarkDone && task.status === 'under_review') {
      toast.error('This task is Under Review. Only the task assigner or project manager can approve and mark it as Done.');
      return;
    }
    if (!canEditStatus) {
      toast.error('Only assigned members can update this task\'s status.');
      return;
    }
    try {
      const updatedProgress = { ...(task.memberProgress ?? {}) };
      let nextGlobalStatus = task.status;

      if (!canMarkDone) {
        const actualStatus: TaskStatus = newStatus === 'done' ? 'under_review' : newStatus;
        const details = actualStatus === 'under_review' ? calculateCompletionDetails(new Date(), task.dueDate) : null;
        updatedProgress[appUser.id] = {
          status: actualStatus,
          updatedAt: Timestamp.now() as any,
          completedBy: actualStatus === 'under_review' ? appUser.id : undefined,
          completedAt: actualStatus === 'under_review' ? Timestamp.now() as any : undefined,
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
        let allSubmitted = true;
        for (const uid of allAssigneeIds) {
          const userStatus = updatedProgress[uid]?.status ?? 'in_progress';
          if (userStatus !== 'under_review' && userStatus !== 'done') {
            allSubmitted = false;
            break;
          }
        }

        nextGlobalStatus = allSubmitted && allAssigneeIds.length > 0 ? 'under_review' : 'in_progress';
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
      await addSubtask(taskId, { title: newSubtask.trim(), isDone: false }, appUser?.id);
      setNewSubtask('');
    } catch {
      toast.error('Failed to add subtask');
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleAddComment = async () => {
    if (!taskId || !newComment.trim() || !appUser) return;
    if (!canComment) {
      toast.error('Only the project manager, task assigner, or higher authority can add comments.');
      return;
    }
    setAddingComment(true);
    try {
      await addComment(taskId, { authorId: appUser.id, text: newComment.trim() }, appUser.id);
      setNewComment('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setAddingComment(false);
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
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <button 
            onClick={() => navigate('/app/tasks')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tasks
          </button>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              {task.title}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <PriorityChip priority={task.priority} />
            {isOverdue && (
              <Badge variant="danger">
                <AlertCircle className="w-3 h-3 mr-1" /> Overdue
              </Badge>
            )}
            {task.tags?.map((tag) => (
              <span key={tag} className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium shadow-sm">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canComment && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<MessageSquare className="w-4 h-4" />}
              onClick={() => {
                document.getElementById('task-comments-section')?.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => document.getElementById('task-comment-input')?.focus(), 300);
              }}
            >
              Add Comment
            </Button>
          )}
          {can('tasks_edit') && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<Edit className="w-4 h-4" />}
              onClick={() => navigate(`/app/tasks/${taskId}/edit`)}
            >
              Edit
            </Button>
          )}
          {can('tasks_delete') && (
            <Button
              variant="danger"
              size="md"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Task Description</h3>
              <div className="relative">
                <button
                  onClick={() => {
                    if (!canMarkDone && task.status === 'under_review') {
                      toast.error('This task is Under Review. Only the task assigner or project manager can approve and mark it as Done.');
                      return;
                    }
                    if (!canEditStatus) {
                      toast.error('Only assigned members can update this task\'s status.');
                      return;
                    }
                    setStatusOpen(!statusOpen);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                >
                  <CompletionStatusChip status={displayStatus} completionStatus={task.memberProgress?.[appUser?.id ?? '']?.completionStatus ?? task.completionStatus} dueDate={task.dueDate} />
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {statusOpen && canEditStatus && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden w-48 animate-scale-in">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                        onClick={() => handleStatusChange(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {task.description ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No description provided.</p>
            )}
          </Card>

          {/* Subtasks Section */}
          <Card className="hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Subtasks ({completedSubtasks}/{subtasks.length})
              </h3>
              <span className="text-sm font-bold text-primary bg-blue-50 px-3 py-1 rounded-full">{subtaskProgress}%</span>
            </div>

            {subtasks.length > 0 && (
              <div className="mb-6">
                <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl group border border-transparent hover:border-slate-100 transition-all"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      subtask.isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-110'
                        : 'border-slate-300 hover:border-primary hover:scale-110 bg-white'
                    }`}
                  >
                    {subtask.isDone && <Check className="w-4 h-4" />}
                  </button>
                  <span className={`text-base font-medium flex-1 ${subtask.isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {subtask.title}
                  </span>
                  {can('tasks_edit') && (
                    <button
                      onClick={() => deleteSubtask(taskId!, subtask.id).then(() =>
                        setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id))
                      )}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all p-2 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {can('tasks_edit') && (
              <div className="flex gap-3">
                <Input
                  placeholder="Add a new subtask..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  className="text-sm shadow-sm"
                />
                <Button onClick={handleAddSubtask} loading={addingSubtask}>
                  <Plus className="w-5 h-5 mr-1" /> Add
                </Button>
              </div>
            )}
          </Card>

          {/* Comments Section */}
          <div id="task-comments-section">
            <Card className="hover:shadow-card-hover transition-all duration-300">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Comments ({comments.length})
              </h3>
              {canComment && (
                <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
                  Manager & Authority Commentary
                </span>
              )}
            </div>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
              {comments.map((comment) => {
                const author = getUser(comment.authorId);
                const authorName = author ? author.name : 'Unknown User';
                const isAuthorPM = Boolean(project && comment.authorId === project.projectManagerId);
                const isAuthorCreator = comment.authorId === task.createdBy;
                const authorRole = roles.find((r) => r.id === author?.roleId);
                const isAuthorAuthority = Boolean(authorRole && (authorRole.level ?? 0) >= 60);

                return (
                  <div key={comment.id} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Avatar name={authorName} src={author?.avatarUrl} size="sm" />
                        <span className="font-semibold text-sm text-slate-900">{authorName}</span>
                        {isAuthorPM && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Project Manager
                          </span>
                        )}
                        {!isAuthorPM && isAuthorCreator && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            Assigner
                          </span>
                        )}
                        {!isAuthorPM && !isAuthorCreator && isAuthorAuthority && authorRole && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            {authorRole.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-9">{comment.text}</p>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic text-sm">
                  No comments yet. Start the conversation!
                </div>
              )}
            </div>

            {canComment ? (
              <div className="flex gap-3">
                <Input
                  id="task-comment-input"
                  placeholder="Write a comment or instruction..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  className="text-sm shadow-sm"
                />
                <Button onClick={handleAddComment} loading={addingComment}>
                  Post
                </Button>
              </div>
            ) : (
              <div className="text-center py-3.5 px-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 text-sm italic flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Only the project manager, task assigner, or higher authority can add comments.
              </div>
            )}
            </Card>
          </div>
        </div>

        {/* Right Column - Metadata Sidebar */}
        <div className="space-y-6">
          <Card className="hover:shadow-card-hover transition-all duration-300 bg-slate-50/50">
            <h3 className="font-bold text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100">Task Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Due Date</p>
                  <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-900 font-medium'}>
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              </div>
              
              {task.status === 'done' && task.completedAt && (
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Completed</p>
                    <span className="text-slate-900 font-medium">
                      {formatDate(task.completedAt)}
                    </span>
                  </div>
                </div>
              )}
              
              {task.delaySeconds !== undefined && task.delaySeconds > 0 && (
                <div className="flex items-start gap-3 text-rose-600">
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-400 text-xs uppercase tracking-wider mb-0.5">Delay</p>
                    <span className="font-bold">{formatDelay(task.delaySeconds)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Estimated Time</p>
                  <span className="text-slate-900 font-medium">{task.estimatedHours ?? 0} hours</span>
                </div>
              </div>
              
              {project && (
                <div
                  className="flex items-start gap-3 cursor-pointer group"
                  onClick={() => navigate(`/app/projects/${project.id}`)}
                >
                  <Tag className="w-5 h-5 text-amber-500 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Project</p>
                    <span className="text-slate-900 font-medium group-hover:text-primary transition-colors">{project.name}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-500 text-xs uppercase tracking-wider mb-0.5">Created At</p>
                  <span className="text-slate-900 font-medium">{formatDate(task.createdAt)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="hover:shadow-card-hover transition-all duration-300">
            <h3 className="font-bold text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100">Assignees</h3>
            <div className="space-y-3">
              {task.assigneeIds?.map((uid) => {
                const u = getUser(uid);
                if (!u) return null;
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-xl border border-transparent hover:border-slate-100 transition-all"
                    onClick={() => navigate(`/app/team/${uid}`)}
                  >
                    <Avatar name={u.name} src={u.avatarUrl} size="md" />
                    <span className="font-medium text-slate-900">{u.name}</span>
                  </div>
                );
              })}
              {!task.assigneeIds?.length && (
                <p className="text-sm text-slate-400 italic">No specific members assigned</p>
              )}
            </div>
          </Card>

          {(() => {
            const rolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
            if (rolesList.length === 0) return null;
            return (
              <Card className="hover:shadow-card-hover transition-all duration-300">
                <h3 className="font-bold text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100">Assigned Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {rolesList.map((rid) => {
                    const r = roles.find((roleItem) => roleItem.id === rid);
                    if (!r) return null;
                    return (
                      <span 
                        key={rid} 
                        style={{ backgroundColor: `${r.color}20`, color: r.color, borderColor: `${r.color}40` }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                      >
                        {r.name}
                      </span>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {isManager && (
            <Card className="hover:shadow-card-hover transition-all duration-300">
              <h3 className="font-bold text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100">Member Progress</h3>
              <div className="space-y-3">
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
                    return <p className="text-sm text-slate-400 italic">No team members working on this</p>;
                  }
                  return allAssigneeIds.map((uid) => {
                    const u = getUser(uid);
                    if (!u) return null;
                    const prog = task.memberProgress?.[uid];
                    const uStatus: TaskStatus = prog?.status ?? 'in_progress';
                    return (
                      <div key={uid} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/app/team/${uid}`)}>
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                        </div>
                        <TaskStatusChip status={uStatus} />
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          )}

          {task.projectId && (
            <Button
              className="w-full shadow-md"
              leftIcon={<MessageSquare className="w-5 h-5" />}
              onClick={handleGoToProjectChat}
            >
              Discuss in Project Chat
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Task"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Task</Button>
          </div>
        }
      >
        <div className="p-2">
          <p className="text-slate-600 font-medium">Are you sure you want to delete <strong className="text-slate-900">{task.title}</strong>?</p>
          <p className="text-sm text-rose-500 mt-2">This action cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
};

export default TaskDetailPage;
