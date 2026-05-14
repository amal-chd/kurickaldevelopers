import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Download, BarChart2, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { usePermissions } from '../../hooks/usePermissions';
import { getTasks, getProjects, getAllUsers, getAttendance } from '../../lib/firestore';
import { Task, Project, AppUser, Attendance } from '../../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#1A3A5C', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#06B6D4'];

const ReportsPage: React.FC = () => {
  const { can } = usePermissions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const load = async () => {
      const [t, p, u] = await Promise.all([getTasks(), getProjects(), getAllUsers()]);
      setTasks(t);
      setProjects(p);
      setUsers(u);
      setLoading(false);
    };
    load();
  }, []);

  if (!can('reports_view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8" />}
          title="Access Denied"
          description="You don't have permission to view reports."
        />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  // Task completion by status
  const taskStatusData = [
    { name: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress').length, fill: COLORS[0] },
    { name: 'Approved', value: tasks.filter((t) => t.status === 'approved').length, fill: COLORS[1] },
    { name: 'Done', value: tasks.filter((t) => t.status === 'done').length, fill: COLORS[2] },
  ];

  // Project status distribution
  const projectStatusData = [
    { name: 'Planning', value: projects.filter((p) => p.status === 'planning').length },
    { name: 'Active', value: projects.filter((p) => p.status === 'active').length },
    { name: 'On Hold', value: projects.filter((p) => p.status === 'on_hold').length },
    { name: 'Completed', value: projects.filter((p) => p.status === 'completed').length },
  ].filter((d) => d.value > 0);

  // Tasks per member
  const memberProductivity = users.map((u) => ({
    name: u.name.split(' ')[0],
    tasks: tasks.filter((t) => t.assigneeIds?.includes(u.id)).length,
    done: tasks.filter((t) => t.assigneeIds?.includes(u.id) && t.status === 'done').length,
  })).filter((m) => m.tasks > 0).sort((a, b) => b.tasks - a.tasks).slice(0, 10);

  // Task completion trend (last 7 days by creation)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
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

  // Priority distribution
  const priorityData = [
    { name: 'Low', value: tasks.filter((t) => t.priority === 'low').length, fill: COLORS[5] },
    { name: 'Medium', value: tasks.filter((t) => t.priority === 'medium').length, fill: COLORS[0] },
    { name: 'High', value: tasks.filter((t) => t.priority === 'high').length, fill: COLORS[1] },
    { name: 'Critical', value: tasks.filter((t) => t.priority === 'critical').length, fill: COLORS[3] },
  ].filter((d) => d.value > 0);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Reports & Analytics</h2>
        {can('reports_export') && (
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Export CSV
          </Button>
        )}
      </div>

      {/* Date filter */}
      <Card className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-gray-700">Date Range:</p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3.5 h-10 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-800"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3.5 h-10 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-gray-800"
        />
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: totalTasks, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Completion Rate', value: `${completionRate}%`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Active Projects', value: projects.filter((p) => p.status === 'active').length, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Team Members', value: users.length, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <Card key={s.label}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Task Status Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={taskStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {taskStatusData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Project Status */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Project Status</h3>
          {projectStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {projectStatusData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No project data</div>
          )}
        </Card>

        {/* Task Trend */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Task Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke={COLORS[0]} name="Created" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="done" stroke={COLORS[2]} name="Completed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Team Productivity */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Team Productivity</h3>
          {memberProductivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={memberProductivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                <Tooltip />
                <Legend />
                <Bar dataKey="tasks" name="Assigned" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                <Bar dataKey="done" name="Done" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </Card>

        {/* Priority Distribution */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Task Priority Distribution</h3>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {priorityData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </Card>

        {/* Per-project task summary */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Tasks per Project</h3>
          <div className="space-y-3">
            {projects.slice(0, 6).map((p) => {
              const ptasks = tasks.filter((t) => t.projectId === p.id);
              const done = ptasks.filter((t) => t.status === 'done').length;
              const pct = ptasks.length > 0 ? Math.round((done / ptasks.length) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 truncate">{p.name}</span>
                    <span className="text-gray-500 flex-shrink-0 ml-2">{done}/{ptasks.length}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
