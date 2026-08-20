import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  Shield, Clock, MapPin, CheckCircle,
  XCircle, AlertTriangle, ChevronLeft, ChevronRight, X, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import { usePermissions } from '../../hooks/usePermissions';
import { subscribeAttendance, getAllUsers, getUserAttendanceHistory, getOrgSettings, getProjects, getAllRoles } from '../../lib/firestore';
import { Attendance, AppUser, OrgSettings, Project, Role } from '../../types';
import { format, addDays, subDays, differenceInMinutes, differenceInSeconds, differenceInDays } from 'date-fns';
import { getOvertimeMinutes, formatOvertime } from '../../lib/utils';
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
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">{user.name}</h3>
            <p className="text-sm text-slate-500">{user.email} · Last 30 days</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-900">{history.filter((h) => h.checkInTime).length}</p>
              <p className="text-xs text-slate-500">Days Present</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{history.filter((h) => isOutsideGeofence(h)).length}</p>
              <p className="text-xs text-slate-500">Outside Fence</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{history.filter((h) => h.checkInTime && !h.checkOutTime).length}</p>
              <p className="text-xs text-slate-500">No Check-out</p>
            </div>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : history.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No attendance records found</p>
          ) : (
            history.map((rec) => {
              const outside = isOutsideGeofence(rec);
              const duration = getDuration(rec);
              return (
                <div key={rec.id} className={`p-3 rounded-xl border ${outside ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {rec.date ? format(new Date(rec.date), 'EEE, dd MMM yyyy') : '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-600">
                          In: <span className="font-medium text-green-700">{formatTs(rec.checkInTime)}</span>
                        </span>
                        <span className="text-xs text-slate-600">
                          Out: <span className="font-medium text-red-600">{formatTs(rec.checkOutTime)}</span>
                        </span>
                        {duration && (
                          <span className="text-xs text-slate-500">{duration}</span>
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
                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
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

const OvertimeReport: React.FC<{ month: string; users: any[] }> = ({ month, users }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMonthRecords = async () => {
      setLoading(true);
      try {
        const [year, m] = month.split('-').map(Number);
        const daysInMonth = new Date(year, m, 0).getDate();
        const startDate = `${month}-01`;
        const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;
        
        const snap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          )
        );
        const allRecords: any[] = [];
        snap.forEach(doc => allRecords.push({ id: doc.id, ...doc.data() }));
        setRecords(allRecords);
      } catch (err) {
        console.error('Failed to fetch overtime data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthRecords();
  }, [month]);

  // Calculate per-user overtime
  const userOvertimeMap = useMemo(() => {
    const map = new Map<string, { totalOtMins: number; daysWithOt: number; totalMins: number; daysPresent: number }>();
    
    for (const rec of records) {
      if (!rec.checkInTime || !rec.checkOutTime) continue;
      const checkIn = rec.checkInTime.toDate ? rec.checkInTime.toDate() : new Date(rec.checkInTime);
      const checkOut = rec.checkOutTime.toDate ? rec.checkOutTime.toDate() : new Date(rec.checkOutTime);
      const totalMins = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000);
      const otMins = getOvertimeMinutes(checkIn, checkOut, rec.overtimeOverrideMinutes);
      
      const existing = map.get(rec.userId) || { totalOtMins: 0, daysWithOt: 0, totalMins: 0, daysPresent: 0 };
      existing.totalMins += totalMins;
      existing.daysPresent++;
      if (otMins > 0) {
        existing.totalOtMins += otMins;
        existing.daysWithOt++;
      }
      map.set(rec.userId, existing);
    }
    return map;
  }, [records]);

  // Sort users by overtime descending, filter to those with OT
  const sortedUsers = useMemo(() => {
    return users
      .filter(u => u.isActive !== false)
      .map(u => ({
        ...u,
        overtime: userOvertimeMap.get(u.uid || u.id) || { totalOtMins: 0, daysWithOt: 0, totalMins: 0, daysPresent: 0 }
      }))
      .sort((a, b) => b.overtime.totalOtMins - a.overtime.totalOtMins);
  }, [users, userOvertimeMap]);

  const totalTeamOt = sortedUsers.reduce((sum, u) => sum + u.overtime.totalOtMins, 0);
  const staffWithOt = sortedUsers.filter(u => u.overtime.totalOtMins > 0).length;

  if (loading) return <div className="text-center py-12 text-gray-500">Loading overtime data...</div>;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium">Total Team Overtime</p>
          <p className="text-2xl font-bold text-amber-800">{formatOvertime(totalTeamOt) || '0h'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-medium">Staff with Overtime</p>
          <p className="text-2xl font-bold text-blue-800">{staffWithOt} / {sortedUsers.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-600 font-medium">Avg Overtime / Person</p>
          <p className="text-2xl font-bold text-purple-800">{staffWithOt > 0 ? formatOvertime(Math.round(totalTeamOt / staffWithOt)) : '0h'}</p>
        </div>
      </div>

      {/* Staff overtime table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Staff Member</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days Present</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Days with OT</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Hours</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Overtime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedUsers.map(user => {
              const ot = user.overtime;
              const totalH = Math.floor(ot.totalMins / 60);
              const totalM = ot.totalMins % 60;
              return (
                <tr key={user.uid || user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3 text-sm text-gray-600">{ot.daysPresent}</td>
                  <td className="text-center px-4 py-3 text-sm text-gray-600">{ot.daysWithOt}</td>
                  <td className="text-center px-4 py-3 text-sm text-gray-600">{totalH}h {totalM}m</td>
                  <td className="text-right px-4 py-3">
                    {ot.totalOtMins > 0 ? (
                      <span className="inline-block px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-sm font-bold">
                        {formatOvertime(ot.totalOtMins)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedUsers.length === 0 && (
          <div className="text-center py-8 text-gray-400">No staff data available</div>
        )}
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
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [exportEnd, setExportEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [activeTab, setActiveTab] = useState<'daily' | 'overtime'>('daily');
  const [overtimeMonth, setOvertimeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Export the FULL attendance report (last 90 days for every staff member)
  // as an Excel workbook.
  // Export the FULL attendance report (last 90 days for every staff member)
  // as a highly organized multi-sheet Excel workbook.
  const handleExportExcel = async () => {
    if (exporting) return;
    if (exportStart > exportEnd) {
      toast.error('Start date must be on or before the end date.');
      return;
    }
    setExportOpen(false);
    setExporting(true);
    try {
      // 1. Fetch auxiliary data
      const [fetchedProjects, fetchedRoles] = await Promise.all([
        getProjects().catch(() => [] as Project[]),
        getAllRoles().catch(() => [] as Role[]),
      ]);

      const projectMap = new Map<string, string>();
      fetchedProjects.forEach((p) => projectMap.set(p.id, p.name));

      const roleMap = new Map<string, string>();
      fetchedRoles.forEach((r) => roleMap.set(r.id, r.name));

      // 2. Fetch history for all users, limited to the selected date range.
      // getUserAttendanceHistory limits by RECORD COUNT (most-recent first), so
      // fetch enough records to reach back to the range start, then filter to
      // [exportStart, exportEnd] (date is a "YYYY-MM-DD" string, so string
      // comparison is a valid range check).
      const daysBack = Math.max(differenceInDays(new Date(), new Date(`${exportStart}T00:00:00`)), 0);
      const recordsToFetch = Math.min(500, daysBack + 31);
      const inRange = (rec: Attendance) => {
        const d = rec.date ?? (rec.checkInTime?.toDate ? format(rec.checkInTime.toDate(), 'yyyy-MM-dd') : '');
        return !!d && d >= exportStart && d <= exportEnd;
      };

      const staffHistoryMap = new Map<string, Attendance[]>();
      let totalRecordsFetched = 0;

      for (const u of users) {
        const raw = await getUserAttendanceHistory(u.id, recordsToFetch).catch(() => [] as Attendance[]);
        const hist = raw.filter(inRange);
        staffHistoryMap.set(u.id, hist);
        totalRecordsFetched += hist.length;
      }

      if (totalRecordsFetched === 0) {
        toast.error('No attendance records found in the selected date range.');
        return;
      }

      // 3. Build Sheet 1: Overview & KPI Summary
      const staffSummaries = users.map((u) => {
        const hist = staffHistoryMap.get(u.id) || [];
        const presentDays = hist.filter((h) => h.checkInTime).length;
        const noCheckoutDays = hist.filter((h) => h.checkInTime && !h.checkOutTime).length;
        const outsideGeofenceDays = hist.filter((h) => isOutsideGeofence(h)).length;

        let totalMins = 0;
        let totalOvertimeMins = 0;
        hist.forEach((rec) => {
          if (rec.checkInTime && rec.checkOutTime) {
            try {
              const inT = rec.checkInTime.toDate();
              const outT = rec.checkOutTime.toDate();
              totalMins += differenceInMinutes(outT, inT);
              totalOvertimeMins += getOvertimeMinutes(inT, outT, rec.overtimeOverrideMinutes);
            } catch {
              // Ignore invalid dates
            }
          }
        });

        const totalHours = Math.round((totalMins / 60) * 100) / 100;
        const totalOvertimeHours = Math.round((totalOvertimeMins / 60) * 100) / 100;
        const avgHours = presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0;
        const complianceRate = presentDays > 0
          ? Math.round(((presentDays - outsideGeofenceDays) / presentDays) * 100)
          : 100;

        return {
          'Staff Member': u.name || u.email || u.id,
          'Email': u.email ?? '',
          'Role': u.roleId ? (roleMap.get(u.roleId) ?? 'No Role') : 'No Role',
          'Days Present': presentDays,
          'Total Hours Worked': totalHours,
          'Total Overtime Hours': totalOvertimeHours,
          'Avg Hours / Day': avgHours,
          'Outside Geofence Incidents': outsideGeofenceDays,
          'Missing Checkouts': noCheckoutDays,
          'Compliance Rate': `${complianceRate}%`,
        };
      });

      const overviewData = [
        { A: 'ATTENDANCE MANAGEMENT SUMMARY REPORT', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' },
        { A: 'Report Date:', B: format(new Date(), 'yyyy-MM-dd HH:mm'), C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' },
        { A: 'Period:', B: `${exportStart} to ${exportEnd}`, C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' },
        { A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' },
        { A: 'TEAM PERFORMANCE COMPLIANCE OVERVIEW', B: '', C: '', D: '', E: '', F: '', G: '', H: '', I: '', J: '' },
      ];

      const overviewSheet = XLSX.utils.json_to_sheet(overviewData, { skipHeader: true });
      XLSX.utils.sheet_add_json(overviewSheet, staffSummaries, { origin: 'A6' });

      // Column widths for Overview
      overviewSheet['!cols'] = [
        { wch: 24 }, // Staff Member
        { wch: 28 }, // Email
        { wch: 16 }, // Role
        { wch: 14 }, // Days Present
        { wch: 18 }, // Total Hours Worked
        { wch: 20 }, // Total Overtime Hours
        { wch: 16 }, // Avg Hours / Day
        { wch: 24 }, // Outside Geofence Incidents
        { wch: 18 }, // Missing Checkouts
        { wch: 18 }, // Compliance Rate
      ];

      // 4. Build Sheet 2: Detailed Daily Attendance Logs
      const dailyRecords: any[] = [];
      for (const u of users) {
        const hist = staffHistoryMap.get(u.id) || [];
        for (const rec of hist) {
          const inT = rec.checkInTime?.toDate?.();
          const outT = rec.checkOutTime?.toDate?.();
          const mins = inT && outT ? differenceInMinutes(outT, inT) : null;

          dailyRecords.push({
            'Date': rec.date ?? (inT ? format(inT, 'yyyy-MM-dd') : ''),
            'Staff Member': u.name || u.email || u.id,
            'Email': u.email ?? '',
            'Project Name': rec.projectId ? (projectMap.get(rec.projectId) ?? 'Unknown Project') : 'No Project Assigned',
            'Check In': inT ? format(inT, 'HH:mm') : '—',
            'Check In Address': rec.checkInAddress || '—',
            'Check Out': outT ? format(outT, 'HH:mm') : '—',
            'Check Out Address': rec.checkOutAddress || '—',
            'Duration (hrs)': mins !== null ? Math.round((mins / 60) * 100) / 100 : '—',
            'Overtime (hrs)': (inT && outT) ? Math.round((getOvertimeMinutes(inT, outT, rec.overtimeOverrideMinutes) / 60) * 100) / 100 : '—',
            'Geofence Compliance': isOutsideGeofence(rec) ? 'Outside Geofence' : 'Compliant',
          });
        }
      }

      dailyRecords.sort((a, b) => b.Date.localeCompare(a.Date) || a['Staff Member'].localeCompare(b['Staff Member']));
      const dailySheet = XLSX.utils.json_to_sheet(dailyRecords);
      dailySheet['!cols'] = [
        { wch: 12 }, // Date
        { wch: 22 }, // Staff Member
        { wch: 26 }, // Email
        { wch: 24 }, // Project Name
        { wch: 10 }, // Check In
        { wch: 32 }, // Check In Address
        { wch: 10 }, // Check Out
        { wch: 32 }, // Check Out Address
        { wch: 14 }, // Duration (hrs)
        { wch: 14 }, // Overtime (hrs)
        { wch: 20 }, // Geofence Compliance
      ];

      // 5. Build Sheet 3: Flagged Incidents (Exceptions Only)
      const flaggedIncidents: any[] = [];
      for (const u of users) {
        const hist = staffHistoryMap.get(u.id) || [];
        for (const rec of hist) {
          const inT = rec.checkInTime?.toDate?.();
          const _outT = rec.checkOutTime?.toDate?.();

          const isOutside = isOutsideGeofence(rec);
          const isMissingCheckout = rec.checkInTime && !rec.checkOutTime;

          if (isOutside || isMissingCheckout) {
            flaggedIncidents.push({
              'Date': rec.date ?? (inT ? format(inT, 'yyyy-MM-dd') : ''),
              'Staff Member': u.name || u.email || u.id,
              'Email': u.email ?? '',
              'Project Name': rec.projectId ? (projectMap.get(rec.projectId) ?? 'Unknown Project') : 'No Project Assigned',
              'Incident Type': isOutside && isMissingCheckout
                ? 'Outside Fence & Missing Checkout'
                : isOutside
                  ? 'Outside Geofence'
                  : 'Missing Checkout',
              'Details': isOutside
                ? `Checked in at coordinates outside geofence boundary (${rec.checkInAddress || 'unknown location'})`
                : 'Checked in but did not record a check-out time.',
            });
          }
        }
      }

      flaggedIncidents.sort((a, b) => b.Date.localeCompare(a.Date) || a['Staff Member'].localeCompare(b['Staff Member']));
      const flaggedSheet = XLSX.utils.json_to_sheet(flaggedIncidents);
      flaggedSheet['!cols'] = [
        { wch: 12 }, // Date
        { wch: 22 }, // Staff Member
        { wch: 26 }, // Email
        { wch: 24 }, // Project Name
        { wch: 28 }, // Incident Type
        { wch: 60 }, // Details
      ];

      // 6. Assemble the workbook and trigger download
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, overviewSheet, 'Summary & Overview');
      XLSX.utils.book_append_sheet(wb, dailySheet, 'Daily Attendance Logs');
      if (flaggedIncidents.length > 0) {
        XLSX.utils.book_append_sheet(wb, flaggedSheet, 'Flagged Incidents');
      }

      XLSX.writeFile(wb, `kurickal-attendance-${exportStart}_to_${exportEnd}.xlsx`);
      toast.success(`Exported ${totalRecordsFetched} logs for ${exportStart} → ${exportEnd}.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export attendance report');
    } finally {
      setExporting(false);
    }
  };

  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Monitor daily check-ins, check-outs & geofence compliance</p>
        </div>
        {/* Excel export — choose a date / date range for the report */}
        <Button
          variant="outline"
          size="sm"
          loading={exporting}
          leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          onClick={() => setExportOpen(true)}
        >
          Export Excel
        </Button>

        <Modal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Export Attendance Report"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setExportOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={exporting}
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Choose the date range to include. The workbook covers every staff member's
              check-ins, daily logs, and flagged incidents within this range.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block font-medium text-slate-700 mb-1">From</span>
                <input
                  type="date"
                  value={exportStart}
                  max={exportEnd}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
              <label className="text-sm">
                <span className="block font-medium text-slate-700 mb-1">To</span>
                <input
                  type="date"
                  value={exportEnd}
                  min={exportStart}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: 'Today', days: 0 },
                { label: 'Last 7 days', days: 6 },
                { label: 'Last 30 days', days: 29 },
                { label: 'Last 90 days', days: 89 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setExportStart(format(subDays(new Date(), preset.days), 'yyyy-MM-dd'));
                    setExportEnd(format(new Date(), 'yyyy-MM-dd'));
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <button onClick={() => setDate(format(subDays(new Date(date), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-slate-100 rounded">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm font-medium text-slate-800 focus:outline-none"
          />
          <button
            onClick={() => setDate(format(addDays(new Date(date), 1), 'yyyy-MM-dd'))}
            disabled={isToday}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'daily'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Daily Attendance
        </button>
        <button
          onClick={() => setActiveTab('overtime')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'overtime'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overtime Report
        </button>
      </div>

      {activeTab === 'daily' && (
        <>

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
              <p className="text-xs text-slate-500">{s.label}</p>
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

            let statusColor = 'border-slate-100 bg-white';
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
                    <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {statusIcon}
                      <span className="text-xs font-medium text-slate-700">{statusLabel}</span>
                    </div>
                  </div>
                  {outside && (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                {checkedIn && (
                  <div className="mt-3 pt-3 border-t border-black/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Check-in</span>
                      <span className="font-medium text-slate-800">
                        {rec?.checkInTime ? format(rec.checkInTime.toDate(), 'HH:mm') : '—'}
                      </span>
                    </div>
                    {checkedOut ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Check-out</span>
                        <span className="font-medium text-slate-800">
                          {rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'HH:mm') : '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Duration</span>
                        {rec?.checkInTime && <LiveTimer checkInTime={rec.checkInTime} />}
                      </div>
                    )}
                    {getDur() && checkedOut && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Total</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">{getDur()}</span>
                          {(() => {
                            if (!rec?.checkInTime || !rec?.checkOutTime) return null;
                            const otMins = getOvertimeMinutes(rec.checkInTime.toDate(), rec.checkOutTime.toDate(), rec.overtimeOverrideMinutes);
                            if (otMins > 0) {
                              return <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-bold">OT: {formatOvertime(otMins)}</span>;
                            }
                            return null;
                          })()}
                        </div>
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

        </>
      )}

      {activeTab === 'overtime' && (
        <div>
          {/* Month selector */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => {
                const [y, m] = overtimeMonth.split('-').map(Number);
                const prev = new Date(y, m - 2, 1);
                setOvertimeMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
              }}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              ←
            </button>
            <h3 className="text-lg font-bold text-gray-800">
              {new Date(overtimeMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => {
                const [y, m] = overtimeMonth.split('-').map(Number);
                const next = new Date(y, m, 1);
                const now = new Date();
                if (next <= new Date(now.getFullYear(), now.getMonth() + 1, 1)) {
                  setOvertimeMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              →
            </button>
          </div>
          
          {/* Overtime table */}
          <OvertimeReport month={overtimeMonth} users={users} />
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
