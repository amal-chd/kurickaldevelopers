import React, { useEffect, useState } from 'react';
import { Save, Building2, Clock, MapPin, Loader2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { usePermissions } from '../../hooks/usePermissions';
import { getOrgSettings, updateOrgSettings } from '../../lib/firestore';
import { OrgSettings } from '../../types';
import toast from 'react-hot-toast';
import EmptyState from '../../components/ui/EmptyState';
import { Shield } from 'lucide-react';

const DEFAULT: OrgSettings = {
  companyName: 'Kurickal Developers LLP',
  companyLogo: '',
  timezone: 'Asia/Kolkata',
  workStartTime: '08:00',
  workEndTime: '18:00',
  geofenceRadius: 200,
  geofenceLat: 10.0159,
  geofenceLng: 76.3419,
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Card className="space-y-5">
    <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
      <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
  </Card>
);

const OrgSettingsPage: React.FC = () => {
  const { can } = usePermissions();
  const [settings, setSettings] = useState<OrgSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrgSettings().then((s) => {
      if (s) setSettings(s);
      setLoading(false);
    });
  }, []);

  if (!can('settings_manage')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Shield className="w-8 h-8" />} title="Access Denied" description="You need 'settings_manage' permission." />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrgSettings(settings);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof OrgSettings, value: string | number) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Organisation Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Manage company info, work hours & geofence</p>
        </div>
        <Button onClick={handleSave} loading={saving} leftIcon={<Save className="w-4 h-4" />}>
          Save Changes
        </Button>
      </div>

      {/* Company Info */}
      <Section title="Company Information" icon={<Building2 className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company Name</label>
            <Input value={settings.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Company Name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Timezone</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={settings.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            >
              {['Asia/Kolkata', 'UTC', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Working Hours */}
      <Section title="Working Hours" icon={<Clock className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Work Start Time</label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={settings.workStartTime}
              onChange={(e) => set('workStartTime', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Work End Time</label>
            <input
              type="time"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={settings.workEndTime}
              onChange={(e) => set('workEndTime', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs text-amber-700 font-medium">Work hours: {settings.workStartTime} – {settings.workEndTime} ({settings.timezone})</p>
        </div>
      </Section>

      {/* Geofence */}
      <Section title="Geofence Settings" icon={<MapPin className="w-4 h-4" />}>
        <p className="text-xs text-gray-400">
          Staff attendance check-ins are validated against this geofence. A warning is shown if a staff member checks in outside the radius.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Latitude</label>
            <Input
              type="number"
              step="0.0001"
              value={settings.geofenceLat}
              onChange={(e) => set('geofenceLat', parseFloat(e.target.value))}
              placeholder="10.0159"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Longitude</label>
            <Input
              type="number"
              step="0.0001"
              value={settings.geofenceLng}
              onChange={(e) => set('geofenceLng', parseFloat(e.target.value))}
              placeholder="76.3419"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Radius (metres)</label>
            <Input
              type="number"
              value={settings.geofenceRadius}
              onChange={(e) => set('geofenceRadius', parseInt(e.target.value))}
              placeholder="200"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 mt-2">
          <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700">
            Centre: {settings.geofenceLat.toFixed(4)}, {settings.geofenceLng.toFixed(4)} — Radius: {settings.geofenceRadius}m
          </p>
        </div>
      </Section>
    </div>
  );
};

export default OrgSettingsPage;
