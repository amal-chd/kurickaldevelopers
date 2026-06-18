import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Check, Info } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';
import { getAllRoles, getTaskAssignmentConfig, updateTaskAssignmentConfig } from '../../lib/firestore';
import { Role, TaskAssignmentConfig } from '../../types';
import toast from 'react-hot-toast';

const TaskAssignmentSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { appUser } = useAuthStore();

  // Only the Director / admins who manage roles can configure this.
  const canManage = can('roles_manage') || can('settings_manage');

  const [roles, setRoles] = useState<Role[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [allRoles, config] = await Promise.all([
          getAllRoles(),
          getTaskAssignmentConfig(),
        ]);
        // Highest authority first
        const sorted = [...allRoles].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
        setRoles(sorted);
        if (config) {
          setEnabled(config.enabled);
          setMatrix(config.matrix ?? {});
        }
      } catch {
        toast.error('Failed to load assignment settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isAllowed = (fromRole: string, toRole: string) =>
    matrix[fromRole]?.includes(toRole) ?? false;

  const toggleCell = (fromRole: string, toRole: string) => {
    setMatrix((prev) => {
      const current = prev[fromRole] ?? [];
      const next = current.includes(toRole)
        ? current.filter((r) => r !== toRole)
        : [...current, toRole];
      return { ...prev, [fromRole]: next };
    });
  };

  const toggleRowAll = (fromRole: string) => {
    setMatrix((prev) => {
      const current = prev[fromRole] ?? [];
      const allIds = roles.map((r) => r.id);
      const hasAll = allIds.every((id) => current.includes(id));
      return { ...prev, [fromRole]: hasAll ? [] : allIds };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Partial<TaskAssignmentConfig> = {
        enabled,
        matrix,
        updatedBy: appUser?.id ?? '',
      };
      await updateTaskAssignmentConfig(config);
      toast.success('Assignment rules saved');
    } catch {
      toast.error('Failed to save. Check your permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="Access Denied"
          description="Only the Director can configure task-assignment rules."
        />
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Task Assignment Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Decide which roles can assign tasks to which roles.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Enforce assignment rules</p>
            <p className="text-xs text-gray-500 mt-0.5">
              When off, anyone who can create tasks may assign them to anyone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-primary' : 'bg-gray-300'}`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
      </Card>

      {/* Info banner */}
      <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${enabled ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Each row is a role that creates a task. Tick the roles it is allowed to
          assign that task to. {enabled ? 'Rules are currently enforced.' : 'Rules are currently disabled — turn the switch on to enforce them.'}
        </p>
      </div>

      {/* Matrix */}
      {roles.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-6">
            No roles found. Create roles first in Role Management.
          </p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide sticky left-0 bg-gray-50/60">
                    Creator role
                  </th>
                  {roles.map((r) => (
                    <th key={r.id} className="px-3 py-3 text-center font-semibold text-gray-500 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.name}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-gray-400 text-xs">All</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {roles.map((from) => (
                  <tr key={from.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: from.color }} />
                        {from.name}
                      </span>
                    </td>
                    {roles.map((to) => {
                      const active = isAllowed(from.id, to.id);
                      return (
                        <td key={to.id} className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCell(from.id, to.id)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto transition-colors ${
                              active
                                ? 'bg-primary border-primary text-white'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                            title={`${from.name} → ${to.name}`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleRowAll(from.id)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/app/admin')}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save Rules</Button>
      </div>
    </div>
  );
};

export default TaskAssignmentSettingsPage;
