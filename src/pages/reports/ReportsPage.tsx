import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { Download, AlertCircle, TrendingUp, Users, FolderOpen, Target, Calendar, CheckCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { usePermissions } from '../../hooks/usePermissions';
import { getTasks, getProjects, getAllUsers } from '../../lib/firestore';
import { Task, Project, AppUser } from '../../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';

// Modern Tailwind-inspired palette
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-lg shadow-slate-200/50">
        <p className="font-semibold text-slate-800 text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm font-medium">
            <span style={{ color: entry.color || entry.fill }}>{entry.name}:</span>
            <span className="text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ReportsPage: React.FC = () => {
  const { can } = usePermissions();
  const canView = can('reports_view');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [t, p, u] = await Promise.all([getTasks(), getProjects(), getAllUsers()]);
        setTasks(t);
        setProjects(p);
        setUsers(u);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canView]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <EmptyState
          icon={<AlertCircle className="w-12 h-12 text-rose-500" />}
          title="Access Denied"
          description="You don't have permission to view reports."
        />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-full min-h-[50vh]"><Spinner size="lg" /></div>;

  const rangeStart = startOfDay(new Date(startDate));
  const rangeEnd = endOfDay(new Date(endDate));
  const inRange = (d?: Date | null) => !!d && d >= rangeStart && d <= rangeEnd;
  const filteredTasks = tasks.filter((t) => inRange(t.createdAt?.toDate()));

  // Task Status Data
  const taskStatusData = [
    { name: 'In Progress', value: filteredTasks.filter((t) => t.status === 'in_progress').length, fill: COLORS[0] },
    { name: 'Done', value: filteredTasks.filter((t) => t.status === 'done').length, fill: COLORS[1] },
  ];

  // Project Status Data
  const projectStatusData = [
    { name: 'Active', value: projects.filter((p) => p.status === 'active').length, fill: COLORS[0] },
    { name: 'On Hold', value: projects.filter((p) => p.status === 'on_hold').length, fill: COLORS[2] },
    { name: 'Completed', value: projects.filter((p) => p.status === 'completed').length, fill: COLORS[1] },
  ].filter((d) => d.value > 0);

  // Member Productivity
  const memberProductivity = users.map((u) => ({
    name: (u.name || u.email || 'User').split(' ')[0],
    tasks: filteredTasks.filter((t) => t.assigneeIds?.includes(u.id)).length,
    done: filteredTasks.filter((t) => t.assigneeIds?.includes(u.id) && t.status === 'done').length,
  })).filter((m) => m.tasks > 0).sort((a, b) => b.tasks - a.tasks).slice(0, 10);

  // Daily Buckets (Task Activity Trend)
  const rangeDays = Math.min(
    30,
    Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1),
  );
  const dailyBuckets = Array.from({ length: rangeDays }, (_, i) => {
    const d = subDays(rangeEnd, rangeDays - 1 - i);
    return {
      date: format(d, 'MMM d'),
      created: tasks.filter((t) => {
        const td = t.createdAt?.toDate();
        return td && td >= startOfDay(d) && td <= endOfDay(d);
      }).length,
      done: tasks.filter((t) => {
        const td = t.updatedAt?.toDate();
        return td && t.status === 'done' && td >= startOfDay(d) && td <= endOfDay(d);
      }).length,
    };
  });

  // Priority Data
  const priorityData = [
    { name: 'Low', value: filteredTasks.filter((t) => t.priority === 'low').length, fill: COLORS[5] },
    { name: 'Medium', value: filteredTasks.filter((t) => t.priority === 'medium').length, fill: COLORS[0] },
    { name: 'High', value: filteredTasks.filter((t) => t.priority === 'high').length, fill: COLORS[2] },
    { name: 'Critical', value: filteredTasks.filter((t) => t.priority === 'critical').length, fill: COLORS[3] },
  ].filter((d) => d.value > 0);

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleExportCsv = () => {
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'id', 'title', 'status', 'priority', 'projectName', 'assignees',
      'createdAt', 'dueDate', 'updatedAt',
    ];
    const projectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? '';
    const userName = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;
    const rows = filteredTasks.map((t) => [
      t.id,
      t.title,
      t.status,
      t.priority,
      projectName(t.projectId),
      (t.assigneeIds ?? []).map(userName).join('; '),
      t.createdAt?.toDate ? format(t.createdAt.toDate(), 'yyyy-MM-dd') : '',
      t.dueDate?.toDate ? format(t.dueDate.toDate(), 'yyyy-MM-dd') : '',
      t.updatedAt?.toDate ? format(t.updatedAt.toDate(), 'yyyy-MM-dd') : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-report-${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 p-6 sm:p-8 rounded-3xl shadow-lg">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <TrendingUp className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-white">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Reports & Analytics</h1>
            <p className="text-blue-50 font-medium max-w-xl text-sm leading-relaxed">
              Visualize your team's productivity, track project health, and export detailed task data for deep analysis.
            </p>
          </div>
          <div className="flex gap-3">
            {can('reports_export') && (
              <Button
                variant="outline"
                size="md"
                leftIcon={<Download className="w-4 h-4 text-indigo-600" />}
                onClick={handleExportCsv}
                className="!bg-white !text-indigo-600 hover:!bg-slate-50 border-none shadow-md whitespace-nowrap"
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 w-full sm:w-fit">
        <div className="flex items-center gap-2 sm:pl-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Date Range</span>
        </div>
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full xs:w-auto min-w-0 px-3 h-9 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <span className="text-slate-400 text-sm font-medium flex-shrink-0 text-center">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full xs:w-auto min-w-0 px-3 h-9 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: totalTasks, icon: Target, gradient: 'from-blue-500 to-indigo-500' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle, gradient: 'from-emerald-500 to-teal-500' },
          { label: 'Active Projects', value: projects.filter((p) => p.status === 'active').length, icon: FolderOpen, gradient: 'from-violet-500 to-purple-500' },
          { label: 'Team Members', value: users.length, icon: Users, gradient: 'from-amber-500 to-orange-500' },
        ].map((s) => (
          <Card key={s.label} className="group hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden border-none shadow-sm">
            <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${s.gradient}`} />
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${s.gradient} rounded-full blur-3xl opacity-20 -mr-8 -mt-8`} />
            <div className="relative z-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 min-w-0">
              <div className={`p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br ${s.gradient} shadow-sm text-white flex-shrink-0`}>
                <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{s.value}</p>
                <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 leading-tight">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Activity Chart */}
      <Card className="hover:shadow-card-hover transition-all duration-300">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" /> Task Activity Trend
          </h3>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyBuckets} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} dx={-10} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600 }} />
              <Area type="monotone" dataKey="created" name="Tasks Created" stroke={COLORS[0]} strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" />
              <Area type="monotone" dataKey="done" name="Tasks Completed" stroke={COLORS[1]} strokeWidth={3} fillOpacity={1} fill="url(#colorDone)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <Card className="hover:shadow-card-hover transition-all duration-300">
          <h3 className="font-bold text-lg text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" /> Task Status Overview
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskStatusData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} dx={-10} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                <Bar dataKey="value" name="Tasks" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {taskStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Team Productivity */}
        <Card className="hover:shadow-card-hover transition-all duration-300">
          <h3 className="font-bold text-lg text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" /> Top Performers
          </h3>
          {memberProductivity.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberProductivity} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={70} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '13px', fontWeight: 600 }} />
                  <Bar dataKey="tasks" name="Assigned" fill={COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={16} />
                  <Bar dataKey="done" name="Completed" fill={COLORS[1]} radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 text-sm italic">No team productivity data</div>
          )}
        </Card>

        {/* Priority Donut */}
        <Card className="hover:shadow-card-hover transition-all duration-300">
          <h3 className="font-bold text-lg text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Priority Distribution
          </h3>
          {priorityData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {priorityData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 text-sm italic">No priority data available</div>
          )}
        </Card>

        {/* Projects Donut */}
        <Card className="hover:shadow-card-hover transition-all duration-300">
          <h3 className="font-bold text-lg text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-violet-500" /> Project Status
          </h3>
          {projectStatusData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {projectStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 text-sm italic">No active projects</div>
          )}
        </Card>

        {/* Projects Breakdown (Progress Bars) */}
        <Card className="hover:shadow-card-hover transition-all duration-300 lg:col-span-2">
          <h3 className="font-bold text-lg text-slate-900 mb-6 pb-4 border-b border-slate-100">
            Project Completion Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {projects.slice(0, 8).map((p) => {
              const ptasks = tasks.filter((t) => t.projectId === p.id);
              const done = ptasks.filter((t) => t.status === 'done').length;
              const pct = ptasks.length > 0 ? Math.round((done / ptasks.length) * 100) : 0;
              return (
                <div key={p.id} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{p.name}</span>
                    <span className="text-xs font-bold text-slate-500 flex-shrink-0 ml-2 bg-slate-100 px-2 py-1 rounded-md">{done} / {ptasks.length}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && (
              <div className="col-span-2 text-center py-8 text-slate-400 italic text-sm">No projects found.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
