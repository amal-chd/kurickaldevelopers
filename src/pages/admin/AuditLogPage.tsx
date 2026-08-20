import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Search, RefreshCw, ClipboardList, User, CheckSquare, Folder, Key,
  FileText, Clock, Settings, Bell, ChevronDown, ChevronRight, Trash2, Plus,
  Pencil, LogIn, LogOut, ArrowRight, Receipt, CalendarDays, Banknote,
  ShieldCheck, UserCheck, UserX, BookOpen, AlertTriangle,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { usePermissions } from '../../hooks/usePermissions';
import { fetchAuditLogs, AUDIT_CATEGORIES, categoryLabel } from '../../lib/auditLog';
import { AuditLog } from '../../types';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Action → icon / colour ───────────────────────────────────────────────────

type Tone = 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'slate';

const TONE_CLASSES: Record<Tone, { bg: string; text: string; chipBg: string; chipText: string }> = {
  green: { bg: 'bg-emerald-500', text: 'text-emerald-600', chipBg: 'bg-emerald-50', chipText: 'text-emerald-700' },
  red: { bg: 'bg-red-500', text: 'text-red-600', chipBg: 'bg-red-50', chipText: 'text-red-700' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', chipBg: 'bg-blue-50', chipText: 'text-blue-700' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', chipBg: 'bg-amber-50', chipText: 'text-amber-700' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', chipBg: 'bg-purple-50', chipText: 'text-purple-700' },
  slate: { bg: 'bg-slate-400', text: 'text-slate-500', chipBg: 'bg-slate-100', chipText: 'text-slate-600' },
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'user.created': UserCheck, 'user.updated': Pencil, 'user.activated': UserCheck,
  'user.deactivated': UserX, 'user.deleted': Trash2, 'user.role_changed': ArrowRight,
  'user.password_reset': Key,
  'role.created': ShieldCheck, 'role.updated': Shield, 'role.deleted': Trash2,
  'project.created': Plus, 'project.updated': Pencil, 'project.deleted': Trash2,
  'task.created': Plus, 'task.updated': Pencil, 'task.status_changed': ArrowRight, 'task.deleted': Trash2,
  'expense.approved': Receipt, 'expense.rejected': Receipt, 'expense.submitted': Receipt,
  'leave.approved': CalendarDays, 'leave.rejected': CalendarDays, 'leave.submitted': CalendarDays,
  'salary.created': Banknote, 'salary.updated': Banknote, 'salary.paid': Banknote,
  'settings.updated': Settings, 'notification.sent': Bell,
  'auth.login': LogIn, 'auth.logout': LogOut,
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User, role: Key, project: Folder, task: CheckSquare, attendance: Clock,
  document: FileText, site_diary: BookOpen, settings: Settings, notification: Bell,
  expense: Receipt, leave: CalendarDays, salary: Banknote, auth: LogIn,
};

const actionIcon = (action: string): React.ComponentType<{ className?: string }> => {
  if (ACTION_ICONS[action]) return ACTION_ICONS[action];
  const cat = action.includes('.') ? action.split('.')[0] : action;
  return CATEGORY_ICONS[cat] ?? ClipboardList;
};

const actionTone = (action: string, severity?: string): Tone => {
  if (severity === 'critical') return 'red';
  const verb = action.includes('.') ? action.split('.').slice(1).join('.') : action;
  if (/delet|deactivat|reject/.test(verb)) return 'red';
  if (/creat|activat|approve|added|paid|checked_in/.test(verb)) return 'green';
  if (/updat|changed|assigned/.test(verb)) return 'blue';
  if (severity === 'warning') return 'amber';
  if (/role/.test(action)) return 'purple';
  return 'slate';
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

const toDate = (ts: any): Date | null => {
  if (!ts) return null;
  try {
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts instanceof Date) return ts;
    return null;
  } catch { return null; }
};

const relativeTime = (d: Date): string => {
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return format(d, 'HH:mm');
};

const dayHeader = (d: Date): string => {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMMM yyyy');
};

// ─── Change diff row ──────────────────────────────────────────────────────────

const ChangeRow: React.FC<{ label: string; from?: string | null; to?: string | null }> = ({ label, from, to }) => (
  <div className="flex items-start gap-2 text-xs">
    <span className="w-24 flex-shrink-0 font-medium text-slate-500">{label}</span>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">{from || '—'}</span>
      <ArrowRight className="w-3 h-3 text-slate-400" />
      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{to || '—'}</span>
    </div>
  </div>
);

// ─── Log row ──────────────────────────────────────────────────────────────────

const LogRow: React.FC<{ log: AuditLog; isLast: boolean }> = ({ log, isLast }) => {
  const [open, setOpen] = useState(false);
  const Icon = actionIcon(log.action);
  const tone = TONE_CLASSES[actionTone(log.action, log.severity)];
  const d = toDate(log.createdAt);
  const changes = log.changes ?? [];
  const metaEntries = Object.entries(log.meta ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v) !== '');
  const hasDetails = changes.length > 0 || metaEntries.length > 0 || !!log.targetName;

  const desc = log.description || log.action;
  const renderDesc = () => {
    if (log.targetName && desc.includes(log.targetName)) {
      const [before, ...rest] = desc.split(log.targetName);
      return <>{before}<span className="font-semibold text-slate-900">{log.targetName}</span>{rest.join(log.targetName)}</>;
    }
    return desc;
  };

  return (
    <div className={`${isLast ? '' : 'border-b border-slate-50'}`}>
      <div
        className={`flex items-start gap-3 px-4 py-3 ${hasDetails ? 'cursor-pointer hover:bg-slate-50/70' : ''} transition-colors`}
        onClick={() => hasDetails && setOpen((o) => !o)}
      >
        {/* Avatar + action badge */}
        <div className="relative flex-shrink-0">
          <Avatar name={log.actorName || 'System'} src={log.actorAvatar || undefined} size="sm" />
          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${tone.bg} flex items-center justify-center ring-2 ring-white`}>
            <Icon className="w-2.5 h-2.5 text-white" />
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug">{renderDesc()}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
            <span className="font-medium text-slate-500 truncate max-w-[10rem]">{log.actorName || 'System'}</span>
            <span>·</span>
            <span>{d ? relativeTime(d) : '—'}</span>
            {hasDetails && (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
          </div>
        </div>

        {/* Action chip */}
        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${tone.chipBg} ${tone.chipText}`}>
          {log.action}
        </span>
      </div>

      {/* Expandable detail */}
      {open && hasDetails && (
        <div className="mx-4 mb-3 ml-14 p-3 rounded-lg bg-slate-50 space-y-2">
          {log.targetName && (
            <p className="text-xs text-slate-500"><span className="font-semibold">Target:</span> {log.targetName}</p>
          )}
          {changes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-wide text-slate-400">CHANGES</p>
              {changes.map((c, i) => (
                <ChangeRow key={i} label={c.label || c.field} from={c.from} to={c.to} />
              ))}
            </div>
          )}
          {metaEntries.length > 0 && (
            <div className="space-y-0.5">
              {metaEntries.map(([k, v]) => (
                <p key={k} className="text-xs text-slate-500">
                  <span className="font-semibold capitalize">{k.replace(/_/g, ' ')}:</span> {String(v)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AuditLogPage: React.FC = () => {
  const { can } = usePermissions();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [actorId, setActorId] = useState('');
  const [pageLimit, setPageLimit] = useState(120);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      setLogs(await fetchAuditLogs(pageLimit));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, [pageLimit]);

  const actors = useMemo(() => {
    const seen = new Map<string, string>();
    logs.forEach((l) => { if (l.actorId && !seen.has(l.actorId)) seen.set(l.actorId, l.actorName || l.actorId); });
    return Array.from(seen.entries());
  }, [logs]);

  const categoriesPresent = useMemo(
    () => AUDIT_CATEGORIES.filter((c) => logs.some((l) => l.targetType === c)),
    [logs],
  );

  if (!can('settings_manage') && !can('roles_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Shield className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view audit logs." />
      </div>
    );
  }

  const q = search?.toLowerCase().trim();
  const filtered = logs.filter((l) => {
    if (category && l.targetType !== category) return false;
    if (actorId && l.actorId !== actorId) return false;
    if (q &&
      !l.action?.toLowerCase().includes(q) &&
      !(l.actorName || '')?.toLowerCase().includes(q) &&
      !(l.description || '')?.toLowerCase().includes(q) &&
      !(l.targetName || '')?.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group filtered entries by day.
  const groups: { header: string; items: AuditLog[] }[] = [];
  filtered.forEach((l) => {
    const d = toDate(l.createdAt);
    const header = d ? dayHeader(d) : 'Unknown date';
    const last = groups[groups.length - 1];
    if (last && last.header === header) last.items.push(l);
    else groups.push({ header, items: [l] });
  });

  const stats = [
    { label: 'Total Entries', value: logs.length, color: 'text-slate-900' },
    { label: 'Today', value: logs.filter((l) => { const d = toDate(l.createdAt); return d && isToday(d); }).length, color: 'text-primary' },
    { label: 'This Week', value: logs.filter((l) => { const d = toDate(l.createdAt); return d && (Date.now() - d.getTime()) < 7 * 24 * 3600 * 1000; }).length, color: 'text-blue-600' },
    { label: 'Filtered', value: filtered.length, color: 'text-slate-700' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Activity Log</h2>
          <p className="text-sm text-slate-500 mt-0.5">A complete, tamper-proof trail of everything that happens across your workspace</p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="text-center py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
            placeholder="Search by member, action or detail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none px-3 py-2.5 pr-8 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          >
            <option value="">All members</option>
            {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Category chips */}
      {categoriesPresent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${category === '' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            All
          </button>
          {categoriesPresent.map((c) => {
            const Icon = CATEGORY_ICONS[c] ?? ClipboardList;
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(active ? '' : c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {categoryLabel(c)}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={logs.length === 0 ? <ClipboardList className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            title={logs.length === 0 ? 'No activity recorded yet' : 'No entries match your filters'}
            description={logs.length === 0 ? 'Actions taken across the app will appear here.' : 'Try clearing the search or filters.'}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.header}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{g.header}</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{g.items.length}</span>
              </div>
              <Card padding={false}>
                {g.items.map((l, i) => (
                  <LogRow key={l.id} log={l} isLast={i === g.items.length - 1} />
                ))}
              </Card>
            </div>
          ))}

          {/* Load more */}
          {logs.length >= pageLimit && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                onClick={() => setPageLimit((v) => v + 120)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Load older activity
              </button>
              <p className="text-xs text-slate-400">Showing {filtered.length} of {logs.length} loaded entries</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
