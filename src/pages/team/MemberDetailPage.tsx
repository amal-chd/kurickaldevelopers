import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Clock, CheckSquare, MessageSquare, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { TaskStatusChip } from '../../components/ui/StatusChip';
import { getUser, getAllRoles, getTasks, getUserAttendanceHistory, getPerformanceScore } from '../../lib/firestore';
import { AppUser, Role, Task, Attendance, PerformanceScore } from '../../types';
import { formatDate, formatTime, getDuration } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { getDmChannelId } from '../../lib/utils';
import { where } from 'firebase/firestore';

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
  const [tab, setTab] = useState<'info' | 'tasks' | 'attendance' | 'performance'>('info');

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        // Fetch core user first
        const u = await getUser(userId);
        setMember(u);

        if (u) {
          // Fetch secondary resources in parallel, individual safe fallbacks
          const [r, t, a, p] = await Promise.all([
            getAllRoles().catch((err) => {
              console.warn('MemberDetail: failed to load roles:', err);
              return [];
            }),
            getTasks().then((allTasks) =>
              allTasks.filter((t) =>
                t.assigneeIds?.includes(userId) ||
                t.assignedRoleIds?.includes(u.roleId ?? '') ||
                (t.assignedRoleId && t.assignedRoleId === u.roleId)
              )
            ).catch((err) => {
              console.warn('MemberDetail: failed to load tasks:', err);
              return [];
            }),
            getUserAttendanceHistory(userId, 30).catch((err) => {
              console.warn('MemberDetail: failed to load attendance history:', err);
              return [];
            }),
            getPerformanceScore(userId).catch((err) => {
              console.warn('MemberDetail: failed to load performance score:', err);
              return null;
            }),
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!member) return <div className="text-center py-16 text-gray-500">Member not found</div>;

  const role = roles.find((r) => r.id === member.roleId);

  const handleMessage = () => {
    if (!appUser || !userId) return;
    const dmId = getDmChannelId(appUser.id, userId);
    navigate(`/app/chat/${dmId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" 
        onClick={() => navigate('/app/team')} 
      />
      {/* Drawer */}
      <div className="relative w-full max-w-3xl bg-slate-50 h-full shadow-2xl animate-slide-in-right overflow-y-auto flex flex-col border-l border-slate-200/60">
        <div className="p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 mb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-4">
              <Avatar name={member.name} src={member.avatarUrl} size="lg" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{member.name}</h1>
                {role && (
                  <span
                    className="inline-block mt-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: role.color }}
                  >
                    {role.name}
                  </span>
                )}
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                  {member.email && (
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email}</span>
                  )}
                  {member.phone && (
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{member.phone}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant={member.isActive ? 'success' : 'danger'}>
                {member.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {appUser?.id !== userId && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  onClick={handleMessage}
                >
                  Message
                </Button>
              )}
              <button 
                onClick={() => navigate('/app/team')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'info', label: 'Info' },
          { id: 'tasks', label: `Tasks (${tasks.length})` },
          { id: 'attendance', label: `Attendance (${attendance.length})` },
          { id: 'performance', label: 'Performance' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && role && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Role & Permissions</h3>
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700">Role: {role.name}</p>
            {role.description && <p className="text-xs text-gray-500 mt-1">{role.description}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(role.permissions).map(([key, val]) => (
              <div
                key={key}
                className={`text-xs px-2 py-1 rounded-lg ${val ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}
              >
                {key.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'tasks' && (
        <Card padding={false}>
          <div className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/app/tasks/${task.id}`)}
              >
                <CheckSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(task.dueDate)}</p>
                </div>
                <TaskStatusChip status={task.memberProgress?.[userId || '']?.status ?? task.status} />
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No tasks assigned</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'attendance' && (
        <Card padding={false}>
          <div className="divide-y divide-gray-50">
            {attendance.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{a.date}</p>
                  <p className="text-xs text-gray-500">
                    In: {formatTime(a.checkInTime)} · Out: {formatTime(a.checkOutTime)}
                    {a.checkInTime && <span className="ml-2">· {getDuration(a.checkInTime, a.checkOutTime)}</span>}
                  </p>
                </div>
                {a.isWithinGeofence === false && (
                  <Badge variant="warning" size="sm">Outside</Badge>
                )}
                {!a.checkOutTime && a.checkInTime && (
                  <Badge variant="success" size="sm">On Site</Badge>
                )}
              </div>
            ))}
            {attendance.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No attendance history</p>
            )}
          </div>
        </Card>
      )}

      {tab === 'performance' && (
        <Card>
          {performance ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Performance Metrics</h3>
                  <p className="text-xs text-gray-500">Overall Performance Index (OPI)</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-amber-500">{performance.overallPerformanceIndex}</span>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase">OPI Score</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 border-t pt-4 border-gray-100">
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Productivity</span>
                  <span className="text-lg font-bold text-gray-800">{performance.productivityScore}%</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Reliability</span>
                  <span className="text-lg font-bold text-gray-800">{performance.reliabilityScore}%</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Efficiency</span>
                  <span className="text-lg font-bold text-gray-800">{performance.efficiencyScore}%</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Quality</span>
                  <span className="text-lg font-bold text-gray-800">{performance.qualityScore}%</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Collab</span>
                  <span className="text-lg font-bold text-gray-800">{performance.collaborationScore}%</span>
                </div>
              </div>

              <div className="border-t pt-4 border-gray-100">
                <h4 className="text-sm font-bold mb-3">Earned Badges ({performance.badges.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {performance.badges.map(b => (
                    <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      🏆 {b.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                  {performance.badges.length === 0 && (
                    <span className="text-xs text-gray-400 font-medium">No achievements earned yet.</span>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Tasks Completed On-Time</span>
                  <span className="text-sm font-bold text-green-600">{performance.tasksCompletedOnTime}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Tasks Completed Late</span>
                  <span className="text-sm font-bold text-red-650">{performance.tasksCompletedLate}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Active Overdue Tasks</span>
                  <span className="text-sm font-bold text-rose-600">{performance.tasksOverdue}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-medium">Consecutive Streak</span>
                  <span className="text-sm font-bold text-orange-600">🔥 {performance.consecutiveSuccesses}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No performance score calculated yet.</p>
          )}
        </Card>
      )}
        </div>
      </div>
    </div>
  );
};

export default MemberDetailPage;
