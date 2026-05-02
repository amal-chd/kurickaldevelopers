import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Users, CheckSquare, FileText, BookOpen,
  Calendar, DollarSign, TrendingUp,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import { TaskStatusChip } from '../../components/ui/StatusChip';
import Badge from '../../components/ui/Badge';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getProject, getTasks, getAllUsers, getDocuments, getSiteDiary,
  deleteProject,
} from '../../lib/firestore';
import { Project, Task, AppUser, Document as TDocument, SiteDiaryEntry } from '../../types';
import { formatDate, projectStatusLabel, projectStatusColor } from '../../lib/utils';
import toast from 'react-hot-toast';
import { where } from 'firebase/firestore';

type Tab = 'overview' | 'tasks' | 'documents' | 'sitediary' | 'team';

const ProjectDetailPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();

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
        const [p, t, u, d, s] = await Promise.all([
          getProject(projectId),
          getTasks([where('projectId', '==', projectId)]),
          getAllUsers(),
          getDocuments(projectId),
          getSiteDiary(projectId),
        ]);
        setProject(p);
        setTasks(t);
        setUsers(u);
        setDocuments(d);
        setDiary(s);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!project) return <div className="text-center py-16 text-gray-500">Project not found</div>;

  const members = users.filter((u) => project.memberIds?.includes(u.id));
  const manager = users.find((u) => u.id === project.managerId);
  const tasksByStatus = {
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    approved: tasks.filter((t) => t.status === 'approved').length,
    done: tasks.filter((t) => t.status === 'done').length,
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/projects')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${projectStatusColor(project.status)}`}>
              {projectStatusLabel(project.status)}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
          )}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <h3 className="font-semibold text-gray-900 mb-4">Project Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall Progress</span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2">
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
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Start: {formatDate(project.startDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>End: {formatDate(project.endDate)}</span>
              </div>
              {project.budget > 0 && (
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span>Budget: ${project.budget.toLocaleString()}</span>
                </div>
              )}
              {manager && (
                <div className="flex items-center gap-2">
                  <Avatar name={manager.name} src={manager.avatarUrl} size="xs" />
                  <span className="text-gray-600">Manager: {manager.name}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Tasks</h3>
            {can('tasks_create') && (
              <Button size="sm" onClick={() => navigate(`/app/tasks/create`)}>
                Add Task
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/app/tasks/${task.id}`)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(task.dueDate)}</p>
                </div>
                <TaskStatusChip status={task.status} />
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No tasks in this project</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Documents</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/app/documents/${doc.id}`)}
              >
                <FileText className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                </div>
                <Badge variant={doc.approvalStatus === 'approved' ? 'success' : 'warning'} size="sm">
                  {doc.approvalStatus}
                </Badge>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No documents yet</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'sitediary' && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Site Diary</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {diary.map((entry) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">{entry.date}</p>
                  <Badge variant="info" size="sm">{entry.weather}</Badge>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{entry.workDone}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {entry.manpower} workers · {entry.equipment}
                </p>
              </div>
            ))}
            {diary.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No site diary entries</p>
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
                <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                <p className="text-xs text-gray-500 truncate">{member.email || member.phone}</p>
              </div>
              {member.id === project.managerId && (
                <Badge variant="info" size="sm">Manager</Badge>
              )}
            </Card>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-gray-400 col-span-3 text-center py-8">No members yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
