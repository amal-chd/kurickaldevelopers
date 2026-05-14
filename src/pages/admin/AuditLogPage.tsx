import React, { useEffect, useState } from 'react';
import { Shield, Search, RefreshCw, ClipboardList, User, CheckSquare, Folder, Key, FileText, Clock, Settings, Bell, ChevronDown } from 'lucide-react';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { usePermissions } from '../../hooks/usePermissions';
import { getAuditLogs } from '../../lib/firestore';
import { AuditLog } from '../../types';
import { format } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-600',
  approve: 'bg-teal-100 text-teal-700',
  reject: 'bg-orange-100 text-orange-700',
};

const getActionColor = (action: string) => {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600';
};

const TARGET_ICON_MAP: Record<string, React.ReactNode> = {
  user: <User className="w-4 h-4 text-gray-500" />,
  task: <CheckSquare className="w-4 h-4 text-blue-500" />,
  project: <Folder className="w-4 h-4 text-emerald-500" />,
  role: <Key className="w-4 h-4 text-purple-500" />,
  document: <FileText className="w-4 h-4 text-amber-500" />,
  attendance: <Clock className="w-4 h-4 text-teal-500" />,
  settings: <Settings className="w-4 h-4 text-gray-500" />,
  notification: <Bell className="w-4 h-4 text-indigo-500" />,
};

const getTargetIcon = (targetType: string): React.ReactNode => {
  return TARGET_ICON_MAP[targetType?.toLowerCase()] ?? <ClipboardList className="w-4 h-4 text-gray-400" />;
};

const AuditLogPage: React.FC = () => {
  const { can } = usePermissions();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getAuditLogs(200);
      setLogs(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  if (!can('settings_manage') && !can('roles_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Shield className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view audit logs." />
      </div>
    );
  }

  const targetTypes = [...new Set(logs.map((l) => l.targetType).filter(Boolean))];

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    if (q && !l.action.toLowerCase().includes(q) && !l.userName.toLowerCase().includes(q) && !l.details?.toLowerCase().includes(q)) return false;
    if (typeFilter && l.targetType !== typeFilter) return false;
    return true;
  });

  const formatTime = (ts: any) => {
    if (!ts) return '—';
    try { return format(ts.toDate(), 'dd MMM yyyy, HH:mm:ss'); } catch { return '—'; }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Complete history of admin & user actions</p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search by action, user, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none px-3 py-2.5 pr-8 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {targetTypes.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: logs.length, color: 'text-gray-900' },
          { label: 'Today', value: logs.filter((l) => { try { const d = l.createdAt?.toDate(); return d && format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'); } catch { return false; } }).length, color: 'text-primary' },
          { label: 'This Week', value: logs.filter((l) => { try { const d = l.createdAt?.toDate(); return d && (Date.now() - d.getTime()) < 7*24*3600*1000; } catch { return false; } }).length, color: 'text-blue-600' },
          { label: 'Filtered', value: filtered.length, color: 'text-gray-700' },
        ].map((s) => (
          <Card key={s.label} className="text-center py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Log Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Card padding={false}>
          {filtered.length === 0 ? (
            <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="No logs found" description="No audit entries match your search." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">User</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Target</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{log.userName || '—'}</p>
                          <p className="text-xs text-gray-400">{log.userId?.slice(0, 8)}…</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="flex-shrink-0">{getTargetIcon(log.targetType)}</span>
                          <div>
                            <p className="text-xs font-medium text-gray-700 capitalize">{log.targetType || '—'}</p>
                            {log.targetId && <p className="text-xs text-gray-400">{log.targetId.slice(0, 8)}…</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs max-w-xs truncate">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AuditLogPage;
