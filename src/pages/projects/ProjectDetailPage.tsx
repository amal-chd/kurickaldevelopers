import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Trash2, Users, CheckSquare, FileText, BookOpen,
  Calendar, DollarSign, TrendingUp, X
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import { TaskStatusChip } from '../../components/ui/StatusChip';
import Badge from '../../components/ui/Badge';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';
import {
  getProject, getTasks, getAllUsers, getDocuments, getSiteDiary,
  deleteProject,
} from '../../lib/firestore';
import { Project, Task, AppUser, Document as TDocument, SiteDiaryEntry } from '../../types';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { where } from 'firebase/firestore';

type Tab = 'overview' | 'tasks' | 'documents' | 'sitediary' | 'team';

const ProjectDetailPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { appUser } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [documents, setDocuments] = useState<TDocument[]>([]);
  const [diary, setDiary] = useState<SiteDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        // Fetch core project first
        const p = await getProject(projectId);
        setProject(p);

        if (p) {
          // Fetch secondary resources in parallel, individual safe fallbacks
          const [t, u, d, s] = await Promise.all([
            getTasks([where('projectId', '==', projectId)]).catch((err) => {
              console.warn('ProjectDetail: failed to load tasks:', err);
              return [];
            }),
            getAllUsers().catch((err) => {
              console.warn('ProjectDetail: failed to load users:', err);
              return [];
            }),
            getDocuments(projectId).catch((err) => {
              console.warn('ProjectDetail: failed to load documents:', err);
              return [];
            }),
            getSiteDiary(projectId).catch((err) => {
              console.warn('ProjectDetail: failed to load site diary entries:', err);
              return [];
            }),
          ]);
          setTasks(t);
          setUsers(u);
          setDocuments(d);
          setDiary(s);
        }
      } catch (err) {
        console.error('Failed to load project details:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!project) return <div className="text-center py-16 text-slate-500">Project not found</div>;

  const isManager = can('tasks_approve');
  const getTaskStatus = (t: Task) => {
    if (isManager || !appUser) return t.status;
    return t.memberProgress?.[appUser.id]?.status ?? t.status;
  };

  const members = users.filter((u) => project.memberIds?.includes(u.id));
  const manager = users.find((u) => u.id === project.projectManagerId);
  const tasksByStatus = {
    in_progress: tasks.filter((t) => getTaskStatus(t) === 'in_progress').length,
    approved: tasks.filter((t) => getTaskStatus(t) === 'approved').length,
    done: tasks.filter((t) => getTaskStatus(t) === 'done').length,
  };
  const progress = tasks.length > 0
    ? Math.round((tasksByStatus.done / tasks.length) * 100)
    : 0;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
    { id: 'documents', label: `Docs (${documents.length})`, icon: FileText },
    { id: 'sitediary', label: 'Site Diary', icon: BookOpen },
    { id: 'team', label: `Team (${members.length})`, icon: Users },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" 
        onClick={() => navigate('/app/projects')} 
      />
      {/* Drawer */}
      <div className="relative w-full max-w-3xl bg-slate-50 h-full shadow-2xl animate-slide-in-right overflow-y-auto flex flex-col border-l border-slate-200/60">
        <div className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex items-start gap-3 pb-4 mb-2 border-b border-slate-200/60">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 capitalize border border-emerald-100">
                  ● {project.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Manager: {manager?.name ?? '—'}</p>
            </div>
            <div className="flex gap-2">
              {can('projects_edit') && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit className="w-4 h-4" />}
                  onClick={() => navigate(`/app/projects/${projectId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {can('projects_delete') && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (window.confirm('Delete this project?')) {
                      await deleteProject(projectId!);
                      toast.success('Project deleted');
                      navigate('/app/projects');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <button 
                onClick={() => navigate('/app/projects')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Project Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Overall Progress</span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { label: 'In Progress', value: tasksByStatus.in_progress, color: 'text-blue-600' },
                  { label: 'Approved', value: tasksByStatus.approved, color: 'text-amber-600' },
                  { label: 'Done', value: tasksByStatus.done, color: 'text-green-600' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Start: {formatDate(project.startDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>End: {formatDate(project.expectedEndDate)}</span>
              </div>
              {project.budget !== undefined && project.budget > 0 && (
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>Budget: ${project.budget.toLocaleString()}</span>
                </div>
              )}
              {manager && (
                <div className="flex items-center gap-2">
                  <Avatar name={manager.name} src={manager.avatarUrl} size="xs" />
                  <span className="text-slate-600">Manager: {manager.name}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Tasks</h3>
            {can('tasks_create') && (
              <Button size="sm" onClick={() => navigate(`/app/tasks/create`)}>
                Add Task
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/app/tasks/${task.id}`)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500">Due {formatDate(task.dueDate)}</p>
                </div>
                <TaskStatusChip status={getTaskStatus(task)} />
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No tasks in this project</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Documents</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                onClick={() => window.open(doc.url, '_blank')}
              >
                <FileText className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(doc.createdAt)}</p>
                </div>
                <Badge variant={doc.approvalStatus === 'approved' ? 'success' : 'warning'} size="sm">
                  {doc.approvalStatus}
                </Badge>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No documents yet</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'sitediary' && (
        <Card padding={false}>
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Site Diary</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {diary.map((entry) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-900">{entry.date}</p>
                  <Badge variant="info" size="sm">{entry.weather}</Badge>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{entry.progressNotes}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {entry.workerCount} workers{entry.temperature != null ? ` · ${entry.temperature}°C` : ''}
                </p>
              </div>
            ))}
            {diary.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No site diary entries</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'team' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((member) => (
            <Card
              key={member.id}
              hover
              onClick={() => navigate(`/app/team/${member.id}`)}
              className="flex items-center gap-3"
            >
              <Avatar name={member.name} src={member.avatarUrl} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
                <p className="text-xs text-slate-500 truncate">{member.email || member.phone}</p>
              </div>
              {member.id === project.projectManagerId && (
                <Badge variant="info" size="sm">Manager</Badge>
              )}
            </Card>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-slate-400 col-span-3 text-center py-8">No members yet</p>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
