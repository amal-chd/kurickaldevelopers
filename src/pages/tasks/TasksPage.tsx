import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, LayoutGrid, Search, AlertCircle, CheckSquare, Calendar, ChevronDown } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { TaskStatusChip, PriorityChip } from '../../components/ui/StatusChip';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { getTasks, getAllUsers, getProjects } from '../../lib/firestore';
import { Task, AppUser, Project, TaskStatus } from '../../types';
import { formatDate } from '../../lib/utils';
import { isAfter } from 'date-fns';

type ViewMode = 'kanban' | 'list';
type TabFilter = 'all' | 'in_progress' | 'approved' | 'done' | 'overdue';

const STATUSES: TaskStatus[] = ['in_progress', 'approved', 'done'];

const COLUMN_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot: string }> = {
  in_progress: { label: 'In Progress', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100',     dot: 'bg-blue-500' },
  approved:    { label: 'Approved',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
  done:        { label: 'Done',        color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200',       dot: 'bg-gray-400' },
};

const TAB_LABELS: Record<TabFilter, string> = {
  all: 'All', in_progress: 'In Progress', approved: 'Approved', done: 'Done', overdue: 'Overdue',
};

const TasksPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const isManager = can('tasks_approve') || can('tasks_edit');

  useEffect(() => {
    (async () => {
      const [tRes, uRes, pRes] = await Promise.allSettled([
        getTasks(),
        getAllUsers(),
        getProjects(),
      ]);
      if (tRes.status === 'fulfilled') setTasks(tRes.value);
      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      if (pRes.status === 'fulfilled') setProjects(pRes.value);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getUser = (uid: string) => users.find((u) => u.id === uid);
  const isOverdue = (t: Task) => !!(t.dueDate && isAfter(new Date(), t.dueDate.toDate()) && t.status !== 'done');

  const filteredTasks = tasks.filter((t) => {
    if (!isManager && !t.assigneeIds?.includes(appUser?.id ?? '')) return false;
    if (projectFilter && t.projectId !== projectFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === 'all') return true;
    if (tab === 'overdue') return isOverdue(t);
    return t.status === tab;
  });

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filteredTasks.filter((t) => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  if (!can('tasks_view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<AlertCircle className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view tasks." />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const KanbanCard: React.FC<{ task: Task }> = ({ task }) => {
    const project = projects.find((p) => p.id === task.projectId);
    const overdue = isOverdue(task);
    const assignees = (task.assigneeIds ?? []).slice(0, 3).map(getUser).filter(Boolean) as AppUser[];

    return (
      <div
        className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3.5 ${overdue ? 'border-red-200' : 'border-gray-100'}`}
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
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{task.title}</p>
        {project && <p className="text-xs text-primary/70 font-medium mb-3 truncate">{project.name}</p>}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {assignees.map((u) => (
              <div key={u.id} className="ring-2 ring-white rounded-full">
                <Avatar name={u.name} src={u.avatarUrl} size="xs" />
              </div>
            ))}
          </div>
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
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
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h2>
        </div>
        {can('tasks_create') && (
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/tasks/create')}>
            New Task
          </Button>
        )}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <button
            className={`p-2.5 transition-colors ${view === 'kanban' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            className={`p-2.5 transition-colors ${view === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setView('list')}
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
            className="appearance-none px-3.5 pr-9 h-10 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-200 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as TabFilter[]).map((t) => {
          const count = t === 'all' ? filteredTasks.length
            : t === 'overdue' ? filteredTasks.filter(isOverdue).length
            : filteredTasks.filter((x) => x.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
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
                    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
                      <CheckSquare className="w-5 h-5 text-gray-200 mb-1" />
                      <p className="text-xs text-gray-300">Empty</p>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100 bg-gray-50/60">
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Task</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Project</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Priority</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Due</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Assignees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const overdue = isOverdue(task);
                    return (
                      <tr key={task.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={() => navigate(`/app/tasks/${task.id}`)}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            <span className="font-medium text-gray-900 line-clamp-1">{task.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-gray-400 text-xs">{project?.name ?? '—'}</td>
                        <td className="px-4 py-3.5 hidden sm:table-cell"><PriorityChip priority={task.priority} /></td>
                        <td className="px-4 py-3.5"><TaskStatusChip status={task.status} /></td>
                        <td className={`px-4 py-3.5 hidden lg:table-cell text-xs font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                          {formatDate(task.dueDate)}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="flex -space-x-1.5">
                            {(task.assigneeIds ?? []).slice(0, 3).map((uid) => {
                              const u = getUser(uid);
                              return u ? <Avatar key={uid} name={u.name} src={u.avatarUrl} size="xs" /> : null;
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
