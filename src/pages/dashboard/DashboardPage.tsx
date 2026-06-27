import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, FolderOpen, Users, Clock, Plus, ArrowRight,
  TrendingUp, AlertCircle, Zap, Calendar, RefreshCw,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { TaskStatusChip, PriorityChip } from '../../components/ui/StatusChip';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { subscribeProjects, subscribeTasks, subscribeUsers } from '../../lib/firestore';
import { Task, Project, AppUser } from '../../types';
import { formatDate, projectStatusColor, projectStatusLabel } from '../../lib/utils';
import { isAfter } from 'date-fns';

const DashboardPage: React.FC = () => {
  const { appUser, firebaseUser } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers]       = useState<AppUser[]>([]);

  // Track which of the three subscriptions have fired at least once
  const [ready, setReady] = useState({ projects: false, tasks: false, users: false });

  const markReady = (key: keyof typeof ready) =>
    setReady((prev) => ({ ...prev, [key]: true }));

  const loading = !ready.projects || !ready.tasks || !ready.users;

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    // Reset ready state when changing user
    setReady({ projects: false, tasks: false, users: false });

    // onSnapshot subscriptions automatically re-run when the auth token
    // refreshes, so they recover from the initial permission-denied race
    // without any manual "Try again" click.
    const unsubProjects = subscribeProjects((data) => {
      setProjects(data);
      markReady('projects');
    });
    const unsubTasks = subscribeTasks((data) => {
      setAllTasks(data);
      markReady('tasks');
    });
    const unsubUsers = subscribeUsers((data) => {
      setUsers(data);
      markReady('users');
    });

    // Safety net: if any subscription never fires (e.g. offline), unblock after 7 s
    const timer = setTimeout(() => setReady({ projects: true, tasks: true, users: true }), 7000);

    return () => {
      unsubProjects();
      unsubTasks();
      unsubUsers();
      clearTimeout(timer);
    };
  }, [firebaseUser?.uid, appUser?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-400">Loading dashboard…</p>
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const userId      = appUser?.id ?? '';
  const isManager   = can('tasks_approve');

  // Managers see all tasks; others see only their own
  const myTasks     = isManager
    ? allTasks
    : allTasks.filter((t) => t.assigneeIds?.includes(userId));

  const activeProjects   = projects.filter((p) => p.status === 'active');
  const inProgressTasks  = allTasks.filter((t) => t.status === 'in_progress');
  const pendingApprovals = allTasks.filter((t) => t.approvalStatus === 'pending');
  const overdueTasks     = myTasks.filter(
    (t) => t.dueDate && isAfter(new Date(), t.dueDate.toDate()) && t.status !== 'done',
  );

  const getProjectProgress = (projectId: string) => {
    const pts = allTasks.filter((t) => t.projectId === projectId);
    if (!pts.length) return 0;
    return Math.round((pts.filter((t) => t.status === 'done').length / pts.length) * 100);
  };

  // Safe greeting — guard against empty/null name
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (appUser?.name || appUser?.email || '').split(/[\s@]/)[0] || '';

  const STATS = [
    { label: 'Active Tasks',      value: inProgressTasks.length,  icon: CheckSquare, gradient: 'from-blue-500 to-blue-600',       path: '/app/tasks' },
    { label: 'Active Projects',   value: activeProjects.length,   icon: FolderOpen,  gradient: 'from-emerald-500 to-emerald-600', path: '/app/projects' },
    { label: 'Team Members',      value: users.length,            icon: Users,       gradient: 'from-violet-500 to-violet-600',   path: '/app/team' },
    { label: 'Pending Approvals', value: pendingApprovals.length, icon: Clock,       gradient: 'from-amber-500 to-amber-600',     path: '/app/tasks' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''}!
          </h2>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening on your projects today.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {can('tasks_create') && (
            <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/app/tasks/create')}>
              Task
            </Button>
          )}
          {can('projects_create') && (
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/app/projects/create')} className="hidden sm:flex">
              Project
            </Button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STATS.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.path)}
            className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-4 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-gray-200 transition-all duration-200 text-left w-full overflow-hidden"
          >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${s.gradient} ring-1 ring-inset ring-white/40 flex-shrink-0 shadow-sm`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-[28px] font-bold text-gray-900 leading-none tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1.5 leading-tight font-medium">{s.label}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 absolute top-4 right-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── My Tasks ── */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  {isManager ? 'All Tasks' : 'My Tasks'}
                </h3>
                {overdueTasks.length > 0 && (
                  <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-100">
                    {overdueTasks.length} overdue
                  </span>
                )}
                <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                  {myTasks.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/app/tasks')}
                className="text-xs text-primary font-medium hover:text-primary-600 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckSquare className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-sm font-medium text-gray-400">No tasks yet</p>
                <p className="text-xs text-gray-300 mt-1">Tasks assigned to you will appear here</p>
                {can('tasks_create') && (
                  <button
                    onClick={() => navigate('/app/tasks/create')}
                    className="mt-4 text-xs text-primary font-semibold hover:underline"
                  >
                    + Create your first task
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {myTasks.slice(0, 8).map((task) => {
                  const isOverdue =
                    task.dueDate &&
                    isAfter(new Date(), task.dueDate.toDate()) &&
                    task.status !== 'done';
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/tasks/${task.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        </div>
                        {task.dueDate && (
                          <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                            <Calendar className="w-3 h-3" />
                            {isOverdue ? 'Overdue · ' : ''}Due {formatDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityChip priority={task.priority} />
                        <TaskStatusChip status={task.status} />
                      </div>
                    </div>
                  );
                })}
                {myTasks.length > 8 && (
                  <div className="px-5 py-3 bg-gray-50/40">
                    <button
                      onClick={() => navigate('/app/tasks')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      + {myTasks.length - 8} more tasks — view all
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Projects */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Projects</h3>
                <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/app/projects')}
                className="text-xs text-primary font-medium hover:text-primary-600 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <FolderOpen className="w-5 h-5 text-gray-200" />
                </div>
                <p className="text-sm text-gray-400">No projects yet</p>
                {can('projects_create') && (
                  <button
                    onClick={() => navigate('/app/projects/create')}
                    className="mt-3 text-xs text-primary font-semibold hover:underline"
                  >
                    + Create a project
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {projects.slice(0, 5).map((project) => {
                  const progress = getProjectProgress(project.id);
                  return (
                    <div
                      key={project.id}
                      className="px-5 py-3.5 hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/projects/${project.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">{project.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${projectStatusColor(project.status)}`}>
                          {projectStatusLabel(project.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium w-8 text-right">{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Team snapshot */}
          {users.length > 0 && (
            <Card padding={false}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-50 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Team</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                    {users.length}
                  </span>
                </div>
                {can('team_view') && (
                  <button
                    onClick={() => navigate('/app/team')}
                    className="text-xs text-primary font-medium hover:text-primary-600 flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {users.slice(0, 12).map((u) => (
                  <div
                    key={u.id}
                    className="group relative cursor-pointer"
                    onClick={() => can('team_view') && navigate(`/app/team/${u.id}`)}
                  >
                    <Avatar name={u.name || u.email} src={u.avatarUrl} size="sm" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                        {u.name || u.email}
                      </div>
                    </div>
                  </div>
                ))}
                {users.length > 12 && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    +{users.length - 12}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                can('tasks_create')    && { label: 'New Task',    icon: CheckSquare, path: '/app/tasks/create',    color: 'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700' },
                can('projects_create') && { label: 'New Project', icon: FolderOpen,  path: '/app/projects/create', color: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700' },
                                          { label: 'Site Diary',  icon: Clock,       path: '/app/site-diary',      color: 'hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700' },
                can('docs_view')       && { label: 'Documents',   icon: FolderOpen,  path: '/app/documents',       color: 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700' },
              ] as any[]).filter(Boolean).map((a: any) => (
                <button
                  key={a.label}
                  onClick={() => navigate(a.path)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 text-gray-600 text-xs font-medium transition-all duration-150 ${a.color}`}
                >
                  <a.icon className="w-5 h-5" />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
