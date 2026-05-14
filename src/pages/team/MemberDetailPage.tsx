import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Clock, CheckSquare, MessageSquare } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { TaskStatusChip } from '../../components/ui/StatusChip';
import { getUser, getAllRoles, getTasks, getUserAttendanceHistory } from '../../lib/firestore';
import { AppUser, Role, Task, Attendance } from '../../types';
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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'tasks' | 'attendance'>('info');

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const [u, r, t, a] = await Promise.all([
          getUser(userId),
          getAllRoles(),
          getTasks([where('assigneeIds', 'array-contains', userId)]),
          getUserAttendanceHistory(userId, 30),
        ]);
        setMember(u);
        setRoles(r);
        setTasks(t);
        setAttendance(a);
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/team')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Profile header */}
      <Card className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <Avatar name={member.name} src={member.avatarUrl} size="xl" />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
          {role && (
            <span
              className="inline-block mt-1 text-xs px-3 py-1 rounded-full text-white font-medium"
              style={{ backgroundColor: role.color }}
            >
              {role.name}
            </span>
          )}
          <div className="flex flex-wrap gap-3 mt-3 justify-center sm:justify-start text-sm text-gray-600">
            {member.email && (
              <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{member.email}</span>
            )}
            {member.phone && (
              <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{member.phone}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
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
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'info', label: 'Info' },
          { id: 'tasks', label: `Tasks (${tasks.length})` },
          { id: 'attendance', label: `Attendance (${attendance.length})` },
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
                <TaskStatusChip status={task.status} />
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
    </div>
  );
};

export default MemberDetailPage;
