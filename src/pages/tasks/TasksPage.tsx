import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, LayoutGrid, Search, AlertCircle, CheckSquare, Calendar, ChevronDown } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { PriorityChip, CompletionStatusChip } from '../../components/ui/StatusChip';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { getTasks, getAllUsers, getProjects, getAllRoles } from '../../lib/firestore';
import { Task, AppUser, Project, TaskStatus, Role } from '../../types';
import { formatDate } from '../../lib/utils';
import { isAfter } from 'date-fns';

type ViewMode = 'kanban' | 'list';
type TabFilter = 'all' | 'in_progress' | 'under_review' | 'done' | 'overdue';

const STATUSES: TaskStatus[] = ['in_progress', 'under_review', 'done'];

const COLUMN_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot: string }> = {
  in_progress:  { label: 'In Progress',  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100',       dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-100',   dot: 'bg-purple-500' },
  done:         { label: 'Done',         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
};

const TAB_LABELS: Record<TabFilter, string> = {
  all: 'All', in_progress: 'In Progress', under_review: 'Under Review', done: 'Done', overdue: 'Overdue',
};

const TasksPage: React.FC = () => {
  const { appUser, firebaseUser } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Only roles that approve tasks (Director / Admin / PM) see every task.
  // Field staff who can create/edit still see only the tasks assigned to them.
  // Only roles with tasks_view_all (Director / PM / Admin by default) see the
  // full board; everyone else sees only tasks assigned to them or their role.
  const isManager = can('tasks_view_all');

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    setLoading(true);
    (async () => {
      const [tRes, uRes, pRes, rRes] = await Promise.allSettled([
        getTasks(),
        getAllUsers(),
        getProjects(),
        getAllRoles(),
      ]);
      if (tRes.status === 'fulfilled') setTasks(tRes.value);
      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      if (pRes.status === 'fulfilled') setProjects(pRes.value);
      if (rRes.status === 'fulfilled') setRoles(rRes.value);
      setLoading(false);
    })();
  }, [firebaseUser?.uid, appUser?.id]);

  const getRole = (rid: string) => roles.find((r) => r.id === rid);

  const getUser = (uid: string) => users.find((u) => u.id === uid);
  const getTaskStatus = (t: Task) => {
    if (isManager || !appUser) return t.status;
    return t.memberProgress?.[appUser.id]?.status ?? t.status;
  };
  const isOverdue = (t: Task) => !!(t.dueDate && isAfter(new Date(), t.dueDate.toDate()) && getTaskStatus(t) !== 'done');

  const filteredTasks = tasks.filter((t) => {
    if (!isManager && !t.assigneeIds?.includes(appUser?.id ?? '') && !t.assignedRoleIds?.includes(appUser?.roleId ?? '')) return false;
    if (projectFilter && t.projectId !== projectFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    
    const status = getTaskStatus(t);
    if (tab === 'all') return true;
    if (tab === 'overdue') return isOverdue(t);
    return status === tab;
  });

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filteredTasks.filter((t) => getTaskStatus(t) === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);


  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const KanbanCard: React.FC<{ task: Task }> = ({ task }) => {
    const project = projects.find((p) => p.id === task.projectId);
    const overdue = isOverdue(task);
    const assignees = (task.assigneeIds ?? []).slice(0, 3).map(getUser).filter(Boolean) as AppUser[];

    return (
      <div
        className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3.5 ${overdue ? 'border-red-200' : 'border-slate-100'}`}
        onClick={() => navigate(`/app/tasks/${task.id}`)}
      >
        <div className="flex items-center justify-between mb-2">
          <PriorityChip priority={task.priority} />
          {overdue && (
            <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
              <AlertCircle className="w-3 h-3" />Overdue
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-900 leading-snug mb-2 line-clamp-2">{task.title}</p>
        {project && <p className="text-xs text-primary/70 font-medium mb-3 truncate">{project.name}</p>}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex -space-x-1.5">
              {assignees.map((u) => (
                <div key={u.id} className="ring-2 ring-white rounded-full">
                  <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                </div>
              ))}
            </div>
            {task.assignedRoleId && (() => {
              const r = getRole(task.assignedRoleId);
              if (!r) return null;
              return (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    color: r.color,
                    borderColor: `${r.color}30`,
                    backgroundColor: `${r.color}08`,
                  }}
                >
                  {r.name}
                </span>
              );
            })()}
          </div>
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tasks</h2>
        </div>
        {can('tasks_create') && (
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/tasks/create')}>
            New Task
          </Button>
        )}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            className={`p-2 rounded-lg transition-all ${view === 'kanban' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('kanban')}
            aria-label="Board view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('list')}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none px-3.5 pr-9 h-10 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-xs transition-all"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as TabFilter[]).map((t) => {
          const count = t === 'all' ? filteredTasks.length
            : t === 'overdue' ? filteredTasks.filter(isOverdue).length
            : filteredTasks.filter((x) => x.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {TAB_LABELS[t]}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Kanban */}
      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
          {STATUSES.map((status) => {
            const cfg = COLUMN_CONFIG[status];
            const colTasks = tasksByStatus[status];
            return (
              <div key={status} className="flex-shrink-0 w-72 flex flex-col gap-2.5">
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cfg.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <h3 className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</h3>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-sm ${cfg.color}`}>{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-16">
                  {colTasks.map((task) => <KanbanCard key={task.id} task={task} />)}
                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                      <CheckSquare className="w-5 h-5 text-slate-200 mb-1" />
                      <p className="text-xs text-slate-300">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-y-auto">
          <Card padding={false}>
            {filteredTasks.length === 0 ? (
              <EmptyState icon={<CheckSquare className="w-8 h-8" />} title="No tasks found" description="Try adjusting your filters or create a new task." />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Task</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Project</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Priority</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden lg:table-cell">Due</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden lg:table-cell">Assignees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const overdue = isOverdue(task);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/60 cursor-pointer transition-colors" onClick={() => navigate(`/app/tasks/${task.id}`)}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <span className="font-medium text-slate-900 line-clamp-1">{task.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-slate-400 text-xs">{project?.name ?? '—'}</td>
                        <td className="px-4 py-3.5 hidden sm:table-cell"><PriorityChip priority={task.priority} /></td>
                        <td className="px-4 py-3.5">
                          <CompletionStatusChip
                            status={getTaskStatus(task)}
                            completionStatus={task.completionStatus}
                            dueDate={task.dueDate}
                          />
                        </td>
                        <td className={`px-4 py-3.5 hidden lg:table-cell text-xs font-medium ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                          {formatDate(task.dueDate)}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex -space-x-1.5">
                              {(task.assigneeIds ?? []).slice(0, 3).map((uid) => {
                                const u = getUser(uid);
                                return u ? <Avatar key={uid} name={u.name} src={u.avatarUrl} size="xs" /> : null;
                              })}
                            </div>
                            {(() => {
                              const rolesList = task.assignedRoleIds ?? (task.assignedRoleId ? [task.assignedRoleId] : []);
                              return rolesList.map((rid) => {
                                const r = getRole(rid);
                                if (!r) return null;
                                return (
                                  <span
                                    key={rid}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                    style={{
                                      color: r.color,
                                      borderColor: `${r.color}30`,
                                      backgroundColor: `${r.color}08`,
                                    }}
                                  >
                                    {r.name}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </div>
      )}

    </div>
  );
};

export default TasksPage;
