import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield, Calendar, Users, Clock, MapPin, CheckCircle,
  XCircle, AlertTriangle, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { usePermissions } from '../../hooks/usePermissions';
import { subscribeAttendance, getAllUsers, getUserAttendanceHistory, getOrgSettings } from '../../lib/firestore';
import { Attendance, AppUser, OrgSettings } from '../../types';
import { format, addDays, subDays, differenceInMinutes, differenceInSeconds } from 'date-fns';

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const LiveTimer: React.FC<{ checkInTime: any }> = ({ checkInTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      try {
        const start = checkInTime.toDate();
        const secs = differenceInSeconds(new Date(), start);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } catch {
        setElapsed('—');
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [checkInTime]);

  return <span className="font-mono text-sm text-green-600 font-semibold">{elapsed}</span>;
};

interface StaffHistoryModalProps {
  user: AppUser;
  onClose: () => void;
  orgSettings: OrgSettings | null;
}

const StaffHistoryModal: React.FC<StaffHistoryModalProps> = ({ user, onClose, orgSettings }) => {
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserAttendanceHistory(user.id, 30).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, [user.id]);

  const formatTs = (ts: any) => {
    if (!ts) return '—';
    try { return format(ts.toDate(), 'HH:mm'); } catch { return '—'; }
  };

  const getDuration = (rec: Attendance) => {
    if (!rec.checkInTime || !rec.checkOutTime) return null;
    try {
      const mins = differenceInMinutes(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
      return formatDuration(mins);
    } catch { return null; }
  };

  const isOutsideGeofence = (rec: Attendance) => {
    if (!rec.checkInLocation || !orgSettings) return false;
    const dist = haversineDistance(
      orgSettings.geofenceLat, orgSettings.geofenceLng,
      rec.checkInLocation.latitude, rec.checkInLocation.longitude
    );
    return dist > orgSettings.geofenceRadius;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{user.name}</h3>
            <p className="text-sm text-gray-500">{user.email} · Last 30 days</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{history.filter((h) => h.checkInTime).length}</p>
              <p className="text-xs text-gray-500">Days Present</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{history.filter((h) => isOutsideGeofence(h)).length}</p>
              <p className="text-xs text-gray-500">Outside Fence</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{history.filter((h) => h.checkInTime && !h.checkOutTime).length}</p>
              <p className="text-xs text-gray-500">No Check-out</p>
            </div>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No attendance records found</p>
          ) : (
            history.map((rec) => {
              const outside = isOutsideGeofence(rec);
              const duration = getDuration(rec);
              return (
                <div key={rec.id} className={`p-3 rounded-xl border ${outside ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {rec.date ? format(new Date(rec.date), 'EEE, dd MMM yyyy') : '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600">
                          In: <span className="font-medium text-green-700">{formatTs(rec.checkInTime)}</span>
                        </span>
                        <span className="text-xs text-gray-600">
                          Out: <span className="font-medium text-red-600">{formatTs(rec.checkOutTime)}</span>
                        </span>
                        {duration && (
                          <span className="text-xs text-gray-500">{duration}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {outside && (
                        <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Outside
                        </span>
                      )}
                      {!rec.checkOutTime && rec.checkInTime && (
                        <span className="text-xs text-red-600 font-medium">No checkout</span>
                      )}
                    </div>
                  </div>
                  {rec.checkInAddress && (
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {rec.checkInAddress}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const AttendanceDashboardPage: React.FC = () => {
  const { can } = usePermissions();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  useEffect(() => {
    getAllUsers().then(setUsers);
    getOrgSettings().then(setOrgSettings);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAttendance(date, (recs) => {
      setRecords(recs);
      setLoading(false);
    });
    return () => unsub();
  }, [date]);

  if (!can('attendance_view_all') && !can('team_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Shield className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view staff attendance." />
      </div>
    );
  }

  const getRecord = (userId: string) => records.find((r) => r.userId === userId);

  const isOutsideGeofence = (rec: Attendance) => {
    if (!rec?.checkInLocation || !orgSettings) return false;
    const dist = haversineDistance(
      orgSettings.geofenceLat, orgSettings.geofenceLng,
      rec.checkInLocation.latitude, rec.checkInLocation.longitude
    );
    return dist > orgSettings.geofenceRadius;
  };

  const presentCount = records.filter((r) => r.checkInTime).length;
  const checkedOutCount = records.filter((r) => r.checkOutTime).length;
  const outsideCount = records.filter((r) => isOutsideGeofence(r)).length;
  const absentCount = users.filter((u) => !getRecord(u.id)?.checkInTime).length;

  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Monitor daily check-ins, check-outs & geofence compliance</p>
        </div>
        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <button onClick={() => setDate(format(subDays(new Date(date), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm font-medium text-gray-800 focus:outline-none"
          />
          <button
            onClick={() => setDate(format(addDays(new Date(date), 1), 'yyyy-MM-dd'))}
            disabled={isToday}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present', value: presentCount, icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Checked Out', value: checkedOutCount, icon: <Clock className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Outside Fence', value: outsideCount, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Absent', value: absentCount, icon: <XCircle className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-3 py-3">
            <div className={`p-2 rounded-xl ${s.bg} ${s.color}`}>{s.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((user) => {
            const rec = getRecord(user.id);
            const checkedIn = !!rec?.checkInTime;
            const checkedOut = !!rec?.checkOutTime;
            const outside = isOutsideGeofence(rec!);

            let statusColor = 'border-gray-100 bg-white';
            let statusLabel = 'Absent';
            let statusIcon = <XCircle className="w-4 h-4 text-red-400" />;

            if (checkedIn && !checkedOut) {
              statusColor = 'border-green-200 bg-green-50';
              statusLabel = 'Checked In';
              statusIcon = <CheckCircle className="w-4 h-4 text-green-600" />;
            } else if (checkedOut) {
              statusColor = 'border-blue-100 bg-blue-50';
              statusLabel = 'Checked Out';
              statusIcon = <Clock className="w-4 h-4 text-blue-500" />;
            }

            const getDur = () => {
              if (!rec?.checkInTime) return null;
              const end = rec.checkOutTime ? rec.checkOutTime.toDate() : new Date();
              try {
                const mins = differenceInMinutes(end, rec.checkInTime.toDate());
                return formatDuration(mins);
              } catch { return null; }
            };

            return (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md ${statusColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar name={user.name} src={user.avatarUrl} size="md" />
                    {checkedIn && !checkedOut && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {statusIcon}
                      <span className="text-xs font-medium text-gray-700">{statusLabel}</span>
                    </div>
                  </div>
                  {outside && (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                {checkedIn && (
                  <div className="mt-3 pt-3 border-t border-black/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Check-in</span>
                      <span className="font-medium text-gray-800">
                        {rec?.checkInTime ? format(rec.checkInTime.toDate(), 'HH:mm') : '—'}
                      </span>
                    </div>
                    {checkedOut ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Check-out</span>
                        <span className="font-medium text-gray-800">
                          {rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'HH:mm') : '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Duration</span>
                        {rec?.checkInTime && <LiveTimer checkInTime={rec.checkInTime} />}
                      </div>
                    )}
                    {getDur() && checkedOut && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Total</span>
                        <span className="font-medium text-blue-600">{getDur()}</span>
                      </div>
                    )}
                    {outside && (
                      <p className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        Outside geofence
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* History Modal */}
      {selectedUser && (
        <StaffHistoryModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          orgSettings={orgSettings}
        />
      )}
    </div>
  );
};

export default AttendanceDashboardPage;
