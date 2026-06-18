import React, { useEffect, useState } from 'react';
import {
  Plus, BookOpen, Users, Wrench, Edit2, Camera,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { getSiteDiary, createSiteDiary, updateSiteDiary, getProjects } from '../../lib/firestore';
import { SiteDiaryEntry, Project } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Stormy', 'Foggy', 'Windy'];

const SiteDiaryPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const [entries, setEntries] = useState<SiteDiaryEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SiteDiaryEntry | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');

  const [form, setForm] = useState({
    projectId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    weather: 'Sunny',
    workDone: '',
    manpower: '',
    equipment: '',
    remarks: '',
    photoUrls: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      const [e, p] = await Promise.all([getSiteDiary(), getProjects()]);
      setEntries(e);
      setProjects(p);
      setLoading(false);
    };
    load();
  }, []);

  const resetForm = () => {
    setForm({
      projectId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      weather: 'Sunny',
      workDone: '',
      manpower: '',
      equipment: '',
      remarks: '',
      photoUrls: [],
    });
    setEditing(null);
  };

  const openEdit = (entry: SiteDiaryEntry) => {
    setEditing(entry);
    setForm({
      projectId: entry.projectId,
      date: entry.date,
      weather: entry.weather,
      workDone: entry.workDone,
      manpower: String(entry.manpower),
      equipment: entry.equipment,
      remarks: entry.remarks,
      photoUrls: entry.photoUrls ?? [],
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!appUser || !form.workDone.trim()) return;
    setSaving(true);
    try {
      const data = {
        projectId: form.projectId,
        date: form.date,
        weather: form.weather,
        workDone: form.workDone,
        manpower: Number(form.manpower) || 0,
        equipment: form.equipment,
        remarks: form.remarks,
        photoUrls: form.photoUrls,
        // Firestore security rule for site_diaries checks resource.data.authorId;
        // `createdBy` was being written before, which broke author-self-update.
        authorId: appUser.id,
      };
      if (editing) {
        await updateSiteDiary(editing.id, data);
        setEntries((prev) => prev.map((e) => e.id === editing.id ? { ...e, ...data } : e));
        toast.success('Entry updated');
      } else {
        const id = await createSiteDiary(data);
        setEntries((prev) => [{ id, ...data }, ...prev]);
        toast.success('Entry created');
      }
      setModal(false);
      resetForm();
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  // Site diary deletions are disabled by Firestore rules ("allow delete: if false")
  // for audit-trail integrity. The delete button has been removed from the UI.

  const filtered = projectFilter
    ? entries.filter((e) => e.projectId === projectFilter)
    : entries;

  const getProjectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? '—';

  const weatherIcon = (w: string) => {
    if (w.toLowerCase().includes('rain') || w.toLowerCase().includes('storm')) return '🌧️';
    if (w.toLowerCase().includes('cloud')) return '☁️';
    if (w.toLowerCase().includes('fog')) return '🌫️';
    if (w.toLowerCase().includes('wind')) return '💨';
    return '☀️';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Site Diary</h2>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setModal(true); }}>
          New Entry
        </Button>
      </div>

      {/* Project filter */}
      <div className="flex gap-3">
        <div className="relative">
          <select
            className="appearance-none px-3.5 pr-9 h-10 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8" />}
          title="No diary entries"
          description="Create your first site diary entry."
          action={
            <Button size="sm" onClick={() => { resetForm(); setModal(true); }}>
              New Entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id} padding={false}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className="text-2xl">{weatherIcon(entry.weather)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{entry.date}</p>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {entry.weather}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{getProjectName(entry.projectId)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {expanded === entry.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {expanded === entry.id && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Work Done</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.workDone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Manpower
                      </p>
                      <p className="text-sm text-gray-700">{entry.manpower} workers</p>
                    </div>
                    {entry.equipment && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> Equipment
                        </p>
                        <p className="text-sm text-gray-700">{entry.equipment}</p>
                      </div>
                    )}
                  </div>
                  {entry.remarks && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Remarks</p>
                      <p className="text-sm text-gray-700">{entry.remarks}</p>
                    </div>
                  )}
                  {entry.photoUrls?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Photos ({entry.photoUrls.length})
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {entry.photoUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); resetForm(); }}
        title={editing ? 'Edit Diary Entry' : 'New Site Diary Entry'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Update' : 'Save Entry'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
            <Select
              label="Weather"
              value={form.weather}
              onChange={(e) => setForm((p) => ({ ...p, weather: e.target.value }))}
              options={WEATHER_OPTIONS.map((w) => ({ value: w, label: `${weatherIcon(w)} ${w}` }))}
            />
          </div>
          <Select
            label="Project"
            value={form.projectId}
            onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select project"
          />
          <Textarea
            label="Work Done"
            placeholder="Describe the work done today..."
            value={form.workDone}
            onChange={(e) => setForm((p) => ({ ...p, workDone: e.target.value }))}
            rows={4}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Manpower Count"
              type="number"
              placeholder="0"
              value={form.manpower}
              onChange={(e) => setForm((p) => ({ ...p, manpower: e.target.value }))}
              min="0"
            />
            <Input
              label="Equipment Used"
              placeholder="e.g. Excavator, Crane"
              value={form.equipment}
              onChange={(e) => setForm((p) => ({ ...p, equipment: e.target.value }))}
            />
          </div>
          <Textarea
            label="Remarks"
            placeholder="Any additional remarks..."
            value={form.remarks}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
};

export default SiteDiaryPage;
