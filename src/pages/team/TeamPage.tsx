import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, UserPlus, Mail, Phone, ChevronDown } from 'lucide-react';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';
import { getAllUsers, getAllRoles } from '../../lib/firestore';
import { AppUser, Role } from '../../types';

const TeamPage: React.FC = () => {
  const { can } = usePermissions();
  const { firebaseUser } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    setLoading(true);
    (async () => {
      const [u, r] = await Promise.all([getAllUsers(), getAllRoles()]);
      setUsers(u); setRoles(r); setLoading(false);
    })();
  }, [firebaseUser?.uid]);

  if (!can('team_view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Users className="w-8 h-8" />} title="Access Denied" description="You don't have permission to view the team." />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const getRole = (roleId: string) => roles.find((r) => r.id === roleId);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q) && !u.phone?.includes(q)) return false;
    if (roleFilter && u.roleId !== roleFilter) return false;
    return true;
  });

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Team</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} members · {activeCount} active</p>
        </div>
        {can('team_manage') && (
          <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => navigate('/app/admin/users')}>
            Manage Team
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none px-3.5 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-xs transition-all h-10"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="No members found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((user) => {
            const role = getRole(user.roleId);
            return (
              <div
                key={user.id}
                onClick={() => navigate(`/app/team/${user.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-card-hover hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Color header */}
                <div
                  className="h-16 relative"
                  style={{ backgroundColor: role?.color ? role.color + '18' : '#f1f5f9' }}
                >
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
                  >
                    <div className={`ring-4 ring-white rounded-full ${!user.isActive ? 'opacity-60' : ''}`}>
                      <Avatar name={user.name} src={user.avatarUrl} size="lg" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="pt-10 pb-5 px-4 text-center">
                  <h3 className="font-semibold text-gray-900 truncate">{user.name || user.email}</h3>
                  {role && (
                    <span
                      className="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: role.color ?? '#1A3A5C' }}
                    >
                      {role.name}
                    </span>
                  )}

                  <div className="mt-3 space-y-1">
                    {user.email && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                      user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamPage;
