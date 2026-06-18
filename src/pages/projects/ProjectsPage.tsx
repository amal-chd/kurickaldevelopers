import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Users, Calendar, TrendingUp, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Input from '../../components/ui/Input';
import { usePermissions } from '../../hooks/usePermissions';
import { getProjects, getTasks, getAllUsers } from '../../lib/firestore';
import { Project, Task, AppUser } from '../../types';
import { formatDate, projectStatusLabel } from '../../lib/utils';

const STATUS_STYLES: Record<string, { label: string; badge: string; bar: string; border: string }> = {
  planning:  { label: 'Planning',   badge: 'bg-purple-50 text-purple-700 border-purple-100',  bar: 'bg-purple-400',  border: 'border-t-purple-400' },
  active:    { label: 'Active',     badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'bg-emerald-500', border: 'border-t-emerald-500' },
  on_hold:   { label: 'On Hold',    badge: 'bg-amber-50 text-amber-700 border-amber-100',     bar: 'bg-amber-400',   border: 'border-t-amber-400' },
  completed: { label: 'Completed',  badge: 'bg-blue-50 text-blue-700 border-blue-100',        bar: 'bg-blue-500',    border: 'border-t-blue-500' },
  cancelled: { label: 'Cancelled',  badge: 'bg-red-50 text-red-600 border-red-100',           bar: 'bg-red-400',     border: 'border-t-red-400' },
};

const STATUS_FILTERS = ['all', 'active', 'planning', 'on_hold', 'completed', 'cancelled'];

const ProjectsPage: React.FC = () => {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, t, u] = await Promise.all([getProjects(), getTasks(), getAllUsers()]);
        setProjects(p); setTasks(t); setUsers(u);
      } finally { setLoading(false); }
    })();
  }, []);

  if (!can('projects_view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<FolderOpen className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view projects." />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const getProgress = (id: string) => {
    const pts = tasks.filter((t) => t.projectId === id);
    if (!pts.length) return 0;
    return Math.round((pts.filter((t) => t.status === 'done').length / pts.length) * 100);
  };

  const filtered = projects.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = STATUS_FILTERS.reduce((acc, s) => {
    acc[s] = s === 'all' ? projects.length : projects.filter((p) => p.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Projects</h2>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} total</p>
        </div>
        {can('projects_create') && (
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/projects/create')}>
            New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-64">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 flex-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                filter === s
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {counts[s] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filter === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8" />}
          title="No projects found"
          description={search ? 'Try adjusting your search.' : 'Create your first project to get started.'}
          action={
            can('projects_create') && !search ? (
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/app/projects/create')}>
                Create Project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const progress = getProgress(project.id);
            const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.planning;
            const manager = users.find((u) => u.id === project.managerId);
            const taskCount = tasks.filter((t) => t.projectId === project.id).length;

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/app/projects/${project.id}`)}
                className={`bg-white rounded-2xl border border-gray-100 border-t-4 ${style.border} shadow-sm hover:shadow-card-hover hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden`}
              >
                <div className="p-5 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-base">{project.name}</h3>
                      {project.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{project.description}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span className="font-medium">Progress</span>
                      <span className="font-semibold text-gray-700">{progress}%</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${style.bar}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 pt-1 border-t border-gray-50">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {project.memberIds?.length ?? 0} members
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {taskCount} tasks
                    </span>
                    {project.endDate && (
                      <span className="flex items-center gap-1.5 ml-auto">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(project.endDate)}
                      </span>
                    )}
                  </div>

                  {manager && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{(manager.name || manager.email || '?')[0].toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-gray-500">{manager.name || manager.email}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
