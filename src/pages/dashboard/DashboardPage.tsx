import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, FolderOpen, Users, Clock, Plus, ArrowRight,
  TrendingUp, AlertCircle, Zap,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { TaskStatusChip, PriorityChip } from '../../components/ui/StatusChip';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { getProjects, getTasks, getAllUsers } from '../../lib/firestore';
import { Task, Project, AppUser } from '../../types';
import { formatDate, projectStatusColor, projectStatusLabel } from '../../lib/utils';
import { isAfter } from 'date-fns';

const STAT_CONFIG = [
  {
    key: 'activeTasks',
    label: 'Active Tasks',
    icon: CheckSquare,
    gradient: 'from-blue-500 to-blue-600',
    shadow: 'shadow-blue-200',
    textColor: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'activeProjects',
    label: 'Active Projects',
    icon: FolderOpen,
    gradient: 'from-emerald-500 to-emerald-600',
    shadow: 'shadow-emerald-200',
    textColor: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    key: 'teamMembers',
    label: 'Team Members',
    icon: Users,
    gradient: 'from-purple-500 to-purple-600',
    shadow: 'shadow-purple-200',
    textColor: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    key: 'pendingApprovals',
    label: 'Pending Approvals',
    icon: Clock,
    gradient: 'from-amber-500 to-amber-600',
    shadow: 'shadow-amber-200',
    textColor: 'text-amber-600',
    bg: 'bg-amber-50',
  },
];

const DashboardPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load all data independently — do not gate on appUser so the spinner
    // never hangs when appUser arrives slightly after initialized.
    (async () => {
      const [pRes, tRes, uRes] = await Promise.allSettled([
        getProjects(),
        getTasks(),
        getAllUsers(),
      ]);
      if (pRes.status === 'fulfilled') setProjects(pRes.value);
      if (tRes.status === 'fulfilled') {
        setAllTasks(tRes.value);
        setMyTasks(tRes.value.filter((task) => task.assigneeIds?.includes(appUser?.id ?? '')));
      }
      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeTasks = allTasks.filter((t) => t.status === 'in_progress');
  const pendingApprovals = allTasks.filter((t) => t.approvalStatus === 'pending');
  const overdueTasks = myTasks.filter(
    (t) => t.dueDate && isAfter(new Date(), t.dueDate.toDate()) && t.status !== 'done'
  );

  const stats = {
    activeTasks: activeTasks.length,
    activeProjects: activeProjects.length,
    teamMembers: users.length,
    pendingApprovals: pendingApprovals.length,
  };

  const getProjectProgress = (projectId: string) => {
    const pts = allTasks.filter((t) => t.projectId === projectId);
    if (!pts.length) return 0;
    return Math.round((pts.filter((t) => t.status === 'done').length / pts.length) * 100);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {greeting}{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}!
          </h2>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening on your projects today.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/app/tasks/create')}>
            Task
          </Button>
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/app/projects/create')} className="hidden sm:flex">
            Project
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map((s) => (
          <Card key={s.key} className="flex items-center gap-4 !p-4">
            <div className={`p-3 rounded-xl ${s.bg} flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.textColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{(stats as any)[s.key]}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* My Tasks */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">My Tasks</h3>
                {overdueTasks.length > 0 && (
                  <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-100">
                    {overdueTasks.length} overdue
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/app/tasks')}
                className="text-xs text-primary font-medium hover:text-primary-600 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckSquare className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-sm text-gray-400">No tasks assigned to you yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {myTasks.slice(0, 7).map((task) => {
                  const isOverdue =
                    task.dueDate && isAfter(new Date(), task.dueDate.toDate()) && task.status !== 'done';
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
                        <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                          Due {formatDate(task.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityChip priority={task.priority} />
                        <TaskStatusChip status={task.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Projects */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Projects</h3>
              </div>
              <button
                onClick={() => navigate('/app/projects')}
                className="text-xs text-primary font-medium hover:text-primary-600 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {projects.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No projects yet</p>
              ) : (
                projects.slice(0, 5).map((project) => {
                  const progress = getProjectProgress(project.id);
                  return (
                    <div
                      key={project.id}
                      className="px-5 py-3.5 hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/projects/${project.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">{project.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${projectStatusColor(project.status)}`}>
                          {projectStatusLabel(project.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium w-8 text-right">{progress}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Quick actions */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Task', icon: CheckSquare, path: '/app/tasks/create', color: 'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700' },
                { label: 'New Project', icon: FolderOpen, path: '/app/projects/create', color: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700' },
                { label: 'Site Diary', icon: Clock, path: '/app/site-diary', color: 'hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700' },
                { label: 'Documents', icon: Users, path: '/app/documents', color: 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700' },
              ].map((a) => (
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
