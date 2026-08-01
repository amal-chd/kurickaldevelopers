import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  createLeaveRequest, getMyLeaveRequests, getAllLeaveRequests, deleteLeaveRequest,
  getAllUsers, getAllRoles, createNotification,
} from '../../lib/firestore';
import { LeaveRequest, LeaveType } from '../../types';
import toast from 'react-hot-toast';

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
];

const typeLabel = (t: LeaveType) => LEAVE_TYPES.find((x) => x.value === t)?.label ?? t;

const dayCount = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
};

const LeavePage: React.FC = () => {
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();

  // Managers/HR see everyone's leave; everyone else sees their own.
  const canViewAll = can('leave_manage') || can('team_manage') || (role?.level ?? 0) >= 80;

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'casual' as LeaveType, startDate: '', endDate: '', reason: '' });

  const load = async () => {
    if (!appUser) return;
    setLoading(true);
    const data = canViewAll ? await getAllLeaveRequests() : await getMyLeaveRequests(appUser.id);
    setLeaves(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id, canViewAll]);

  const days = useMemo(() => dayCount(form.startDate, form.endDate), [form.startDate, form.endDate]);

  const notifyManagers = async (leave: Omit<LeaveRequest, 'id'>) => {
    try {
      const [users, roles] = await Promise.all([getAllUsers(), getAllRoles()]);
      const managerRoleIds = roles.filter((r) => r.permissions?.team_manage || r.permissions?.leave_manage).map((r) => r.id);
      users
        .filter((u) => managerRoleIds.includes(u.roleId) && u.id !== appUser?.id && u.isActive)
        .forEach((u) => {
          createNotification({
            title: 'New Leave Application',
            body: `${leave.userName} applied for ${typeLabel(leave.type)} (${leave.startDate} → ${leave.endDate})`,
            userId: u.id,
            type: 'leave',
            isRead: {},
            createdAt: null as any,
          }).catch(() => {});
        });
    } catch { /* best effort */ }
  };

  const handleSubmit = async () => {
    if (!appUser) return;
    if (!form.startDate || !form.endDate) { toast.error('Pick start and end dates'); return; }
    if (days <= 0) { toast.error('End date must be on or after start date'); return; }
    if (!form.reason.trim()) { toast.error('Please add a reason'); return; }
    setSaving(true);
    try {
      const payload = {
        userId: appUser.id,
        userName: appUser.name,
        roleId: appUser.roleId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days,
        reason: form.reason.trim(),
        orgId: appUser.orgId || 'main',
      };
      await createLeaveRequest(payload);
      notifyManagers(payload);
      toast.success('Leave application submitted');
      setModal(false);
      setForm({ type: 'casual', startDate: '', endDate: '', reason: '' });
      load();
    } catch {
      toast.error('Failed to submit leave application');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leave: LeaveRequest) => {
    if (!window.confirm('Delete this leave application?')) return;
    try {
      await deleteLeaveRequest(leave.id);
      setLeaves((prev) => prev.filter((l) => l.id !== leave.id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Applications</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {canViewAll ? 'All staff leave applications' : 'Apply for leave and track your applications'}
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModal(true)}>Apply for Leave</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : leaves.length === 0 ? (
        <EmptyState icon={<CalendarDays className="w-8 h-8" />} title="No leave applications" description="Applications will appear here." />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                  {canViewAll && <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Employee</th>}
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Dates</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Days</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Reason</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    {canViewAll && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.userName || '?'} size="sm" />
                          <span className="font-semibold text-slate-900">{l.userName}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{typeLabel(l.type)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">{l.startDate} → {l.endDate}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{l.days}</td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-[240px] truncate" title={l.reason}>{l.reason}</td>
                    <td className="px-4 py-3.5 text-right">
                      {(l.userId === appUser?.id || canViewAll) && (
                        <button onClick={() => handleDelete(l)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canViewAll && leaves.length > 0 && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Showing {leaves.length} application(s) across all staff.
        </p>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Apply for Leave"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving}>Submit</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Leave Type"
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as LeaveType }))}
            options={LEAVE_TYPES}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
          {days > 0 && <p className="text-xs text-slate-500">Duration: <span className="font-semibold text-slate-700">{days} day(s)</span></p>}
          <Textarea label="Reason" rows={3} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason for leave..." />
        </div>
      </Modal>
    </div>
  );
};

export default LeavePage;
