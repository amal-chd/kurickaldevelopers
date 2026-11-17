import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus, BookOpen, Users, Edit2, Camera, Thermometer, AlertTriangle, Shield,
  ChevronDown, ChevronUp, Trash2, Search, X, UploadCloud,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import {
  getSiteDiary, createSiteDiary, updateSiteDiary, deleteSiteDiary, getProjects,
} from '../../lib/firestore';
import { logAudit, AuditCategory } from '../../lib/auditLog';
import { uploadToSupabase, STORAGE_BUCKETS } from '../../lib/storage';
import { SiteDiaryEntry, Project } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Stormy', 'Foggy', 'Windy'];

const SiteDiaryPage: React.FC = () => {
  const { appUser, firebaseUser } = useAuthStore();
  const [entries, setEntries] = useState<SiteDiaryEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SiteDiaryEntry | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Filters
  const [projectFilter, setProjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form uses mobile-compatible field names
  const [form, setForm] = useState({
    projectId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    weather: 'Sunny',
    progressNotes: '',
    workerCount: '',
    issuesNotes: '',
    safetyNotes: '',
    temperature: '',
    photoUrls: [] as string[],
  });

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    setLoading(true);
    const load = async () => {
      const [e, p] = await Promise.all([getSiteDiary(), getProjects()]);
      setEntries(e);
      setProjects(p);
      setLoading(false);
    };
    load();
  }, [firebaseUser?.uid, appUser?.id]);

  const resetForm = () => {
    setForm({
      projectId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      weather: 'Sunny',
      progressNotes: '',
      workerCount: '',
      issuesNotes: '',
      safetyNotes: '',
      temperature: '',
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
      progressNotes: entry.progressNotes || '',
      workerCount: String(entry.workerCount || 0),
      issuesNotes: entry.issuesNotes || '',
      safetyNotes: entry.safetyNotes || '',
      temperature: entry.temperature != null ? String(entry.temperature) : '',
      photoUrls: entry.photoUrls ?? [],
    });
    setModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadToSupabase(
          file,
          STORAGE_BUCKETS.documents,
          `site-diary/${form.projectId || 'general'}`,
        );
        uploadedUrls.push(res.url);
      }
      setForm((prev) => ({
        ...prev,
        photoUrls: [...prev.photoUrls, ...uploadedUrls],
      }));
      toast.success(`${uploadedUrls.length} photo(s) uploaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photos');
    } finally {
      setUploadingPhotos(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removePhoto = (urlToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((u) => u !== urlToRemove),
    }));
  };

  const handleSave = async () => {
    if (!appUser || !form.progressNotes.trim()) return;
    setSaving(true);
    try {
      const data = {
        projectId: form.projectId,
        date: form.date,
        weather: form.weather,
        progressNotes: form.progressNotes,
        workerCount: Number(form.workerCount) || 0,
        issuesNotes: form.issuesNotes,
        safetyNotes: form.safetyNotes,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        photoUrls: form.photoUrls,
        authorId: appUser.id,
      };
      if (editing) {
        await updateSiteDiary(editing.id, data);
        setEntries((prev) => prev.map((e) => (e.id === editing.id ? { ...e, ...data } : e)));
        void logAudit({
          action: 'site_diary.updated',
          category: AuditCategory.siteDiary,
          targetId: editing.id,
          targetName: `Site Diary (${data.date})`,
          description: `Updated site diary entry for ${getProjectName(data.projectId)} (${data.date})`,
          meta: { date: data.date, projectId: data.projectId },
        });
        toast.success('Entry updated');
      } else {
        const id = await createSiteDiary(data as any);
        setEntries((prev) => [{ id, ...data } as any, ...prev]);
        void logAudit({
          action: 'site_diary.created',
          category: AuditCategory.siteDiary,
          targetId: id,
          targetName: `Site Diary (${data.date})`,
          description: `Created site diary entry for ${getProjectName(data.projectId)} (${data.date})`,
          meta: { date: data.date, projectId: data.projectId },
        });
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

  const handleDeleteEntry = async (entry: SiteDiaryEntry) => {
    if (!window.confirm(`Delete site diary entry for ${entry.date}?`)) return;
    try {
      await deleteSiteDiary(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      void logAudit({
        action: 'site_diary.deleted',
        category: AuditCategory.siteDiary,
        targetId: entry.id,
        targetName: `Site Diary (${entry.date})`,
        description: `Deleted site diary entry for ${getProjectName(entry.projectId)} (${entry.date})`,
        meta: { date: entry.date, projectId: entry.projectId },
        severity: 'warning',
      });
      toast.success('Diary entry deleted');
    } catch {
      toast.error('Failed to delete diary entry');
    }
  };

  const getProjectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? '—';

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (projectFilter && e.projectId !== projectFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = getProjectName(e.projectId).toLowerCase();
        const matchNotes = (e.progressNotes || '').toLowerCase().includes(q);
        const matchSafety = (e.safetyNotes || '').toLowerCase().includes(q);
        const matchIssues = (e.issuesNotes || '').toLowerCase().includes(q);
        const matchWeather = (e.weather || '').toLowerCase().includes(q);
        const matchDate = (e.date || '').toLowerCase().includes(q);
        if (!pName.includes(q) && !matchNotes && !matchSafety && !matchIssues && !matchWeather && !matchDate) {
          return false;
        }
      }
      return true;
    });
  }, [entries, projectFilter, searchQuery, projects]);

  const weatherIcon = (w: string) => {
    if (w?.toLowerCase().includes('rain') || w?.toLowerCase().includes('storm')) return '🌧️';
    if (w?.toLowerCase().includes('cloud')) return '☁️';
    if (w?.toLowerCase().includes('fog')) return '🌫️';
    if (w?.toLowerCase().includes('wind')) return '💨';
    return '☀️';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-primary" />
            Site Diary
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Log daily progress notes, labor manpower count, weather conditions, safety notes, and photos.
          </p>
        </div>
        <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setModal(true); }}>
          New Entry
        </Button>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search progress notes, issues, weather, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Project Filter */}
          <div className="w-full sm:w-64 relative">
            <select
              className="w-full appearance-none px-3.5 pr-9 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      {/* Diary Entries List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8" />}
          title="No diary entries found"
          description={
            searchQuery || projectFilter
              ? 'Try clearing your search query or project filter.'
              : 'Create your first site diary entry to record daily site activities.'
          }
          action={
            <Button size="sm" onClick={() => { resetForm(); setModal(true); }}>
              New Entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id} padding={false} className="overflow-hidden hover:border-slate-300 transition-colors">
              <div
                className="flex items-center gap-3.5 px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className="text-3xl select-none">{weatherIcon(entry.weather)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-base">{entry.date}</p>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-100">
                      {entry.weather}
                    </span>
                    {entry.temperature != null && (
                      <span className="text-xs bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold border border-orange-100">
                        <Thermometer className="w-3 h-3" /> {entry.temperature}°C
                      </span>
                    )}
                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      <Users className="w-3 h-3" /> {entry.workerCount || 0} workers
                    </span>
                    {entry.photoUrls?.length > 0 && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                        <Camera className="w-3 h-3" /> {entry.photoUrls.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1 truncate">
                    Project: <span className="text-slate-800">{getProjectName(entry.projectId)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(entry)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                    title="Edit entry"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                  >
                    {expanded === entry.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === entry.id && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4 bg-slate-50/40">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Progress Notes</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-3.5 rounded-xl border border-slate-100">
                      {entry.progressNotes}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {entry.issuesNotes && (
                      <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Issues & Challenges
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                          {entry.issuesNotes}
                        </p>
                      </div>
                    )}
                    {entry.safetyNotes && (
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" /> Safety & Compliance Remarks
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                          {entry.safetyNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {entry.photoUrls && entry.photoUrls.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> Site Photos ({entry.photoUrls.length})
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {entry.photoUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <img
                              src={url}
                              alt={`Site photo ${i + 1}`}
                              className="w-24 h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </a>
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
        title={editing ? 'Edit Site Diary Entry' : 'New Site Diary Entry'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModal(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            required
          />

          <Textarea
            label="Progress Notes (Work Done Today)"
            placeholder="Detail all activities completed on site today..."
            value={form.progressNotes}
            onChange={(e) => setForm((p) => ({ ...p, progressNotes: e.target.value }))}
            rows={4}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Worker Count (Manpower)"
              type="number"
              placeholder="0"
              value={form.workerCount}
              onChange={(e) => setForm((p) => ({ ...p, workerCount: e.target.value }))}
              min="0"
            />
            <Input
              label="Temperature (°C)"
              type="number"
              placeholder="e.g. 32"
              value={form.temperature}
              onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))}
            />
          </div>

          <Textarea
            label="Issues & Challenges (optional)"
            placeholder="Material shortages, weather delays, equipment breakdown..."
            value={form.issuesNotes}
            onChange={(e) => setForm((p) => ({ ...p, issuesNotes: e.target.value }))}
            rows={2}
          />

          <Textarea
            label="Safety & Compliance Remarks (optional)"
            placeholder="PPE usage, safety briefing, hazard inspection..."
            value={form.safetyNotes}
            onChange={(e) => setForm((p) => ({ ...p, safetyNotes: e.target.value }))}
            rows={2}
          />

          {/* Photo Upload Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Site Photos ({form.photoUrls.length})
            </label>
            <div className="space-y-3">
              <label className="border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-slate-50/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  {uploadingPhotos ? 'Uploading photos...' : 'Click to select or take photos'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WebP supported</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhotos}
                  className="hidden"
                />
              </label>

              {form.photoUrls.length > 0 && (
                <div className="flex gap-2.5 flex-wrap pt-1">
                  {form.photoUrls.map((url, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                      <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md transition-colors"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SiteDiaryPage;
