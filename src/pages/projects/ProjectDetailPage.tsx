import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Trash2, Users, CheckSquare, FileText, BookOpen,
  Calendar, DollarSign, TrendingUp, ArrowLeft
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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

const COLORS = ['#3b82f6', '#f59e0b', '#22c55e']; // blue, amber, green

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
        const p = await getProject(projectId);
        setProject(p);
        if (p) {
          const [t, u, d, s] = await Promise.all([
            getTasks([where('projectId', '==', projectId)]).catch(() => []),
            getAllUsers().catch(() => []),
            getDocuments(projectId).catch(() => []),
            getSiteDiary(projectId).catch(() => []),
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

  if (loading) return <div className="flex items-center justify-center h-full min-h-[50vh]"><Spinner size="lg" /></div>;
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

  const chartData = [
    { name: 'In Progress', value: tasksByStatus.in_progress },
    { name: 'Approved', value: tasksByStatus.approved },
    { name: 'Done', value: tasksByStatus.done },
  ].filter(d => d.value > 0);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Dashboard', icon: TrendingUp },
    { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
    { id: 'documents', label: `Docs (${documents.length})`, icon: FileText },
    { id: 'sitediary', label: 'Site Diary', icon: BookOpen },
    { id: 'team', label: `Team (${members.length})`, icon: Users },
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <button 
            onClick={() => navigate('/app/projects')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
            <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 capitalize border border-emerald-100">
              ● {project.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            Manager: {manager ? <span className="text-slate-900">{manager.name}</span> : '—'}
          </p>
        </div>
        
        <div className="flex gap-2">
          {can('projects_edit') && (
            <Button
              variant="outline"
              leftIcon={<Edit className="w-4 h-4" />}
              onClick={() => navigate(`/app/projects/${projectId}/edit`)}
            >
              Edit
            </Button>
          )}
          {can('projects_delete') && (
            <Button
              variant="danger"
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

      {/* Navigation Pills */}
      <div className="flex gap-2 p-1.5 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 overflow-x-auto w-fit shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-300 rounded-xl ${
              tab === t.id
                ? 'bg-primary text-white shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <t.icon className={`w-4 h-4 ${tab === t.id ? 'text-white' : 'text-slate-400'}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Progress Chart */}
            <Card className="lg:col-span-2 hover:shadow-card-hover transition-all duration-300 flex flex-col">
              <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Project Progress
              </h3>
              <div className="flex-1 flex flex-col sm:flex-row items-center gap-8">
                <div className="w-full sm:w-1/2 h-64">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">No task data available</div>
                  )}
                </div>
                
                <div className="w-full sm:w-1/2 space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-slate-600">Completion</span>
                      <span className="text-2xl font-black text-primary">{progress}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'In Progress', value: tasksByStatus.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Approved', value: tasksByStatus.approved, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Done', value: tasksByStatus.done, color: 'text-green-600', bg: 'bg-green-50' },
                    ].map((s) => (
                      <div key={s.label} className={`${s.bg} p-3 rounded-2xl text-center shadow-sm`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Details Card */}
            <Card className="hover:shadow-card-hover transition-all duration-300">
              <h3 className="font-bold text-lg text-slate-900 mb-6">Details</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</p>
                    <p className="font-medium text-slate-900">{formatDate(project.startDate)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</p>
                    <p className="font-medium text-slate-900">{formatDate(project.expectedEndDate)}</p>
                  </div>
                </div>

                {project.budget !== undefined && project.budget > 0 && (
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget</p>
                      <p className="font-medium text-slate-900">${project.budget.toLocaleString()}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Avatar name={manager?.name ?? '?'} src={manager?.avatarUrl} size="md" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Manager</p>
                    <p className="font-medium text-slate-900">{manager?.name ?? 'Unassigned'}</p>
                  </div>
                </div>
              </div>
            </Card>
            
          </div>
        )}

        {tab === 'tasks' && (
          <Card padding={false} className="hover:shadow-card-hover transition-all duration-300 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-900">Task List</h3>
              {can('tasks_create') && (
                <Button size="sm" onClick={() => navigate(`/app/tasks/create`)}>
                  Add Task
                </Button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/app/tasks/${task.id}`)}
                >
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-900 mb-1">{task.title}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Due {formatDate(task.dueDate)}</span>
                      {task.assigneeIds?.length > 0 && (
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5"/> {task.assigneeIds.length} assignees</span>
                      )}
                    </div>
                  </div>
                  <TaskStatusChip status={getTaskStatus(task)} />
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No tasks in this project</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === 'documents' && (
          <Card padding={false} className="hover:shadow-card-hover transition-all duration-300 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-900">Project Documents</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => window.open(doc.url, '_blank')}
                >
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{doc.name}</p>
                    <p className="text-sm text-slate-500">Uploaded on {formatDate(doc.createdAt)}</p>
                  </div>
                  <Badge variant={doc.approvalStatus === 'approved' ? 'success' : 'warning'} size="md">
                    {doc.approvalStatus}
                  </Badge>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No documents yet</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === 'sitediary' && (
          <Card padding={false} className="hover:shadow-card-hover transition-all duration-300 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-900">Site Diary</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {diary.map((entry) => (
                <div key={entry.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-slate-900 text-lg">{entry.date}</p>
                    <Badge variant="info" size="md">{entry.weather}</Badge>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{entry.progressNotes}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg">
                      <Users className="w-4 h-4 text-slate-400" /> {entry.workerCount} workers
                    </span>
                    {entry.temperature != null && (
                      <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-slate-400" /> {entry.temperature}°C
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {diary.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No site diary entries</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === 'team' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map((member) => (
              <Card
                key={member.id}
                hover
                onClick={() => navigate(`/app/team/${member.id}`)}
                className="flex flex-col items-center p-6 text-center"
              >
                <Avatar name={member.name} src={member.avatarUrl} size="lg" className="mb-4 ring-4 ring-slate-50" />
                <h4 className="font-bold text-slate-900 text-lg">{member.name}</h4>
                <p className="text-sm text-slate-500 mb-4">{member.email || member.phone}</p>
                {member.id === project.projectManagerId && (
                  <Badge variant="info" size="sm" className="mt-auto">Project Manager</Badge>
                )}
              </Card>
            ))}
            {members.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No team members assigned</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
