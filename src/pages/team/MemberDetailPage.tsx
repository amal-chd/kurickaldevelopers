import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Phone, Calendar, CheckSquare, MessageSquare, ArrowLeft, Trophy, Target } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { TaskStatusChip } from '../../components/ui/StatusChip';
import { getUser, getAllRoles, getTasks, getUserAttendanceHistory, getPerformanceScore } from '../../lib/firestore';
import { AppUser, Role, Task, Attendance, PerformanceScore } from '../../types';
import { formatDate, formatTime, getDuration, getOvertimeMinutes, formatOvertime } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { getDmChannelId } from '../../lib/utils';

const MemberDetailPage: React.FC = () => {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();

  const [member, setMember] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [performance, setPerformance] = useState<PerformanceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'tasks' | 'attendance'>('info');

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const u = await getUser(userId);
        setMember(u);
        if (u) {
          const [r, t, a, p] = await Promise.all([
            getAllRoles().catch(() => []),
            getTasks().then((allTasks) =>
              allTasks.filter((task) =>
                task.assigneeIds?.includes(userId) ||
                task.assignedRoleIds?.includes(u.roleId ?? '') ||
                (task.assignedRoleId && task.assignedRoleId === u.roleId)
              )
            ).catch(() => []),
            getUserAttendanceHistory(userId, 30).catch(() => []),
            getPerformanceScore(userId).catch(() => null),
          ]);
          setRoles(r);
          setTasks(t);
          setAttendance(a);
          setPerformance(p);
        }
      } catch (err) {
        console.error('Failed to load member details:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) return <div className="flex items-center justify-center h-full min-h-[50vh]"><Spinner size="lg" /></div>;
  if (!member) return <div className="text-center py-16 text-slate-500">Member not found</div>;

  const role = roles.find((r) => r.id === member.roleId);

  const handleMessage = () => {
    if (!appUser || !userId) return;
    const dmId = getDmChannelId(appUser.id, userId);
    navigate(`/app/chat/${dmId}`);
  };

  const chartData = performance ? [
    { subject: 'Productivity', score: performance.productivityScore },
    { subject: 'Reliability', score: performance.reliabilityScore },
    { subject: 'Efficiency', score: performance.efficiencyScore },
    { subject: 'Quality', score: performance.qualityScore },
    { subject: 'Collab', score: performance.collaborationScore },
  ] : [];

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in space-y-6">
      
      {/* Back Button */}
      <button 
        onClick={() => navigate('/app/team')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Team
      </button>

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 p-8 rounded-3xl shadow-lg">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Target className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-6">
            <Avatar name={member.name} src={member.avatarUrl} size="xl" className="ring-4 ring-white/30 shadow-xl" />
            <div className="text-white">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-extrabold tracking-tight">{member.name}</h1>
                <Badge variant={member.isActive ? 'success' : 'danger'} className="bg-white/20 text-white border-none backdrop-blur-md">
                  {member.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {role && (
                <div className="text-blue-100 font-medium tracking-wide mb-3">{role.name}</div>
              )}
              <div className="flex flex-wrap gap-4 text-sm font-medium text-blue-50">
                {member.email && (
                  <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{member.email}</span>
                )}
                {member.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{member.phone}</span>
                )}
              </div>
            </div>
          </div>
          {appUser?.id !== userId && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<MessageSquare className="w-4 h-4" />}
              onClick={handleMessage}
              className="shadow-sm"
            >
              Message Member
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Performance Analytics */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="hover:shadow-card-hover transition-all duration-300">
            <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Performance Analytics
            </h3>
            {performance ? (
              <div className="space-y-6">
                <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="block text-4xl font-black text-amber-500 mb-1">{performance.overallPerformanceIndex}</span>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Overall Score</span>
                </div>

                <div className="h-64 w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={member.name} dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Task Completion Stats</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-xl">
                      <span className="text-xs font-semibold text-green-700 uppercase">On Time</span>
                      <p className="text-xl font-bold text-green-800">{performance.tasksCompletedOnTime}</p>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl">
                      <span className="text-xs font-semibold text-rose-700 uppercase">Late</span>
                      <p className="text-xl font-bold text-rose-800">{performance.tasksCompletedLate}</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-xl">
                      <span className="text-xs font-semibold text-orange-700 uppercase">Streak</span>
                      <p className="text-xl font-bold text-orange-800">{performance.consecutiveSuccesses} 🔥</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Badges</span>
                      <p className="text-xl font-bold text-slate-800">{performance.badges.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No performance data yet</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Deep Dives (Tabs) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-200/60 overflow-x-auto w-fit shadow-sm">
            {[
              { id: 'info', label: 'Role & Info' },
              { id: 'tasks', label: `Active Tasks (${tasks.length})` },
              { id: 'attendance', label: `Attendance` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`px-6 py-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-300 rounded-xl ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {tab === 'info' && role && (
              <Card className="hover:shadow-card-hover transition-all duration-300">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  Role Details
                </h3>
                <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="font-semibold text-slate-900 text-lg mb-1">{role.name}</p>
                  {role.description && <p className="text-sm text-slate-500">{role.description}</p>}
                </div>
                
                <h4 className="text-sm font-bold text-slate-900 mb-4">Assigned Permissions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(role.permissions).map(([key, val]) => (
                    <div
                      key={key}
                      className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border ${
                        val 
                          ? 'bg-green-50/50 text-green-700 border-green-100 font-semibold' 
                          : 'bg-slate-50/50 text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${val ? 'bg-green-500' : 'bg-slate-300'}`} />
                      {key.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === 'tasks' && (
              <Card padding={false} className="hover:shadow-card-hover transition-all duration-300 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-lg text-slate-900">Assigned Tasks</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/tasks/${task.id}`)}
                    >
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <CheckSquare className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate mb-1">{task.title}</p>
                        <p className="text-sm text-slate-500">Due {formatDate(task.dueDate)}</p>
                      </div>
                      <TaskStatusChip status={task.memberProgress?.[userId || '']?.status ?? task.status} />
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-center py-16">
                      <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No active tasks</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {tab === 'attendance' && (
              <Card padding={false} className="hover:shadow-card-hover transition-all duration-300 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-lg text-slate-900">Recent Attendance (30 days)</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {attendance.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 mb-1">{a.date}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>In: <strong className="text-slate-700">{formatTime(a.checkInTime)}</strong></span>
                          {a.checkOutTime && (
                            <>
                              <span>Out: <strong className="text-slate-700">{formatTime(a.checkOutTime)}</strong></span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold">{getDuration(a.checkInTime, a.checkOutTime)}</span>
                              {(() => {
                                if (!a.checkInTime || !a.checkOutTime) return null;
                                const ot = getOvertimeMinutes(a.checkInTime.toDate(), a.checkOutTime.toDate());
                                if (ot > 0) return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">OT: {formatOvertime(ot)}</span>;
                                return null;
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      {a.isWithinGeofence === false && (
                        <Badge variant="warning" size="md">Outside Geofence</Badge>
                      )}
                      {!a.checkOutTime && a.checkInTime && (
                        <Badge variant="success" size="md" className="animate-pulse">Active Now</Badge>
                      )}
                    </div>
                  ))}
                  {attendance.length === 0 && (
                    <div className="text-center py-16">
                      <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No attendance records found</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDetailPage;
