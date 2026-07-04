import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Smartphone, Clock, Phone, Mail, MessageSquare,
  CheckCheck, XCircle, Inbox, StickyNote, Trash2, Search,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getContactInquiries, updateContactInquiry, deleteContactInquiry,
} from '../../lib/firestore';
import { ContactInquiry, InquiryStatus, InquirySource } from '../../types';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<InquiryStatus, { label: string; classes: string; dot: string }> = {
  new:       { label: 'New',       classes: 'bg-blue-50 text-blue-700 border border-blue-100',      dot: 'bg-blue-500' },
  contacted: { label: 'Contacted', classes: 'bg-amber-50 text-amber-700 border border-amber-100',   dot: 'bg-amber-500' },
  closed:    { label: 'Closed',    classes: 'bg-slate-100 text-slate-500 border border-slate-200',     dot: 'bg-slate-400' },
};

const SOURCE_CONFIG: Record<InquirySource, { label: string; icon: React.ElementType; classes: string }> = {
  website:    { label: 'Website',    icon: Globe,       classes: 'bg-indigo-50 text-indigo-600' },
  mobile_app: { label: 'Mobile App', icon: Smartphone,  classes: 'bg-emerald-50 text-emerald-600' },
};

const PROJECT_TYPE_COLORS: Record<string, string> = {
  'Residential Construction': 'bg-blue-50 text-blue-700',
  'Commercial Construction':  'bg-purple-50 text-purple-700',
  'Infrastructure':           'bg-amber-50 text-amber-700',
  'Renovation / Remodelling': 'bg-rose-50 text-rose-600',
  'Design & Consultancy':     'bg-teal-50 text-teal-700',
};

const ContactInquiriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<InquirySource | 'all'>('all');

  // Detail / notes modal
  const [selected, setSelected] = useState<ContactInquiry | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    getContactInquiries()
      .then(setInquiries)
      .finally(() => setLoading(false));
  }, []);

  if (!can('contact_view') && !can('contact_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="Access Denied"
          description="You don't have permission to view contact inquiries."
        />
      </div>
    );
  }

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const filtered = inquiries.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && q.source !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.name.toLowerCase().includes(s) &&
          !q.phone.includes(s) &&
          !(q.email ?? '').toLowerCase().includes(s) &&
          !q.projectType.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const counts = {
    new:       inquiries.filter((q) => q.status === 'new').length,
    contacted: inquiries.filter((q) => q.status === 'contacted').length,
    closed:    inquiries.filter((q) => q.status === 'closed').length,
  };

  /* ── actions ─────────────────────────────────────────────────────────── */
  const changeStatus = async (inq: ContactInquiry, status: InquiryStatus) => {
    await updateContactInquiry(inq.id, { status });
    setInquiries((prev) => prev.map((q) => q.id === inq.id ? { ...q, status } : q));
    if (selected?.id === inq.id) setSelected((prev) => prev ? { ...prev, status } : prev);
    toast.success(`Marked as ${STATUS_CONFIG[status].label}`);
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await updateContactInquiry(selected.id, { notes: notesValue });
      setInquiries((prev) => prev.map((q) => q.id === selected.id ? { ...q, notes: notesValue } : q));
      setSelected((prev) => prev ? { ...prev, notes: notesValue } : prev);
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async (inq: ContactInquiry) => {
    if (!window.confirm(`Delete enquiry from ${inq.name}?`)) return;
    await deleteContactInquiry(inq.id);
    setInquiries((prev) => prev.filter((q) => q.id !== inq.id));
    if (selected?.id === inq.id) setSelected(null);
    toast.success('Deleted');
  };

  const openDetail = (inq: ContactInquiry) => {
    setSelected(inq);
    setNotesValue(inq.notes ?? '');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/app/admin')}>
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Contact Inquiries</h2>
          <p className="text-sm text-slate-500 mt-0.5">{inquiries.length} total · from website &amp; mobile app</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(counts) as [InquiryStatus, number][]).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === status ? cfg.classes + ' ring-2 ring-offset-1 ring-current/30' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <span className="bg-white/50 px-1.5 py-0.5 rounded-full font-bold">{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          {(['all', 'website', 'mobile_app'] as const).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src === 'all' ? 'all' : src as InquirySource)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                sourceFilter === src
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {src === 'all' ? 'All Sources' : src === 'website' ? '🌐 Website' : '📱 Mobile'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search by name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No inquiries found"
          description="Contact form submissions from the website and mobile app will appear here."
        />
      ) : (
        <Card padding={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden lg:table-cell">Project Type</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((inq) => {
                const statusCfg = STATUS_CONFIG[inq.status];
                const sourceCfg = SOURCE_CONFIG[inq.source];
                const SourceIcon = sourceCfg.icon;
                return (
                  <tr
                    key={inq.id}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                    onClick={() => openDetail(inq)}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{inq.name}</p>
                      {inq.notes && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                          <StickyNote className="w-3 h-3" /> Has notes
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {inq.phone}
                      </p>
                      {inq.email && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3" /> {inq.email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PROJECT_TYPE_COLORS[inq.projectType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {inq.projectType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sourceCfg.classes}`}>
                        <SourceIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">{sourceCfg.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(inq.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {can('contact_manage') && inq.status === 'new' && (
                          <button
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                            onClick={() => changeStatus(inq, 'contacted')}
                            title="Mark as Contacted"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('contact_manage') && inq.status === 'contacted' && (
                          <button
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            onClick={() => changeStatus(inq, 'closed')}
                            title="Close"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('contact_manage') && (
                          <button
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            onClick={() => handleDelete(inq)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Inquiry Details"
        size="2xl"
        footer={
          can('contact_manage') ? (
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex gap-2">
                {selected?.status === 'new' && (
                  <Button size="sm" onClick={() => changeStatus(selected!, 'contacted')} leftIcon={<CheckCheck className="w-4 h-4" />}>
                    Mark Contacted
                  </Button>
                )}
                {selected?.status === 'contacted' && (
                  <Button variant="outline" size="sm" onClick={() => changeStatus(selected!, 'closed')} leftIcon={<XCircle className="w-4 h-4" />}>
                    Close
                  </Button>
                )}
                {selected?.status === 'closed' && (
                  <Button variant="outline" size="sm" onClick={() => changeStatus(selected!, 'new')}>
                    Reopen
                  </Button>
                )}
              </div>
              <Button size="sm" onClick={saveNotes} loading={savingNotes} leftIcon={<StickyNote className="w-4 h-4" />}>
                Save Notes
              </Button>
            </div>
          ) : <div />
        }
      >
        {selected && (
          <div className="space-y-5">
            {/* Meta row */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${STATUS_CONFIG[selected.status].classes}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selected.status].dot}`} />
                {STATUS_CONFIG[selected.status].label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${SOURCE_CONFIG[selected.source].classes}`}>
                {React.createElement(SOURCE_CONFIG[selected.source].icon, { className: 'w-3 h-3' })}
                {SOURCE_CONFIG[selected.source].label}
              </span>
              <span className={`text-xs font-medium px-2.5 py-1.5 rounded-full ${PROJECT_TYPE_COLORS[selected.projectType] ?? 'bg-slate-100 text-slate-600'}`}>
                {selected.projectType}
              </span>
            </div>

            {/* Contact info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Contact Info</h4>
                <p className="text-base font-bold text-slate-900">{selected.name}</p>
                <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="w-4 h-4" /> {selected.phone}
                </a>
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Mail className="w-4 h-4" /> {selected.email}
                  </a>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Received</h4>
                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {formatDate(selected.createdAt)}
                </p>
              </div>
            </div>

            {/* Message */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Project Details
              </h4>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </p>
            </div>

            {/* Internal notes */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Internal Notes
              </h4>
              <textarea
                rows={3}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                disabled={!can('contact_manage')}
                placeholder="Add internal notes about this inquiry…"
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContactInquiriesPage;
