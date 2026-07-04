import React, { useEffect, useState } from 'react';
import {
  Trophy, RefreshCw, Sparkles, MessageSquare
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getPerformanceScore,
  getAllPerformanceScores,
  recalculatePerformanceScore,
  submitPerformanceReview,
  getAllUsers,
  getTasks
} from '../../lib/firestore';
import { PerformanceScore, AppUser, Task } from '../../types';

const COLORS = ['#334155', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6'];

const BADGE_METADATA: Record<string, { name: string; desc: string; icon: string; color: string }> = {
  speed_demon: { name: 'Speed Demon', desc: 'Complete 10+ tasks in a single week', icon: '⚡', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  quality_king: { name: 'Quality King', desc: 'Maintain review scores above 4.5 across tasks', icon: '👑', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  streak_master: { name: 'Streak Master', desc: 'Complete 10+ consecutive tasks on time', icon: '🔥', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  team_player: { name: 'Team Player', desc: 'Collaborate on 5+ team tasks as a contributor', icon: '🤝', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  iron_will: { name: 'Iron Will', desc: 'Zero late task completions in a 30-day window', icon: '🛡️', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  mvp: { name: 'MVP', desc: 'Attain an Overall Performance Index of 90+', icon: '🏆', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  perfect_month: { name: 'Perfect Month', desc: '100% on-time rate with zero task rejections', icon: '🎯', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  critical_hero: { name: 'Critical Hero', desc: 'Complete 3+ critical-priority tasks', icon: '🚨', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  consistency_champion: { name: 'Consistency Champ', desc: 'Stay active on tasks for 15+ days in a month', icon: '📈', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
};

const PerformancePage: React.FC = () => {
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const userId = appUser?.id ?? '';
  const isManager = can('tasks_approve');

  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'analytics' | 'badges' | 'insights'>('overview');
  const [myScore, setMyScore] = useState<PerformanceScore | null>(null);
  const [allScores, setAllScores] = useState<PerformanceScore[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  
  // Review form states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [reviewScore, setReviewScore] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  // Review type is fixed to 'peer' for now (no selector in the UI yet).
  const [reviewType] = useState<'peer' | 'manager'>('peer');

  const canViewOrg = can('performance_view') || can('team_manage');

  const loadData = async () => {
    try {
      setLoading(true);
      // Staff without performance_view can only read their OWN score — skip
      // the org-wide fetch entirely (faster, no denied reads).
      const [score, scores, users, tasksList] = await Promise.all([
        getPerformanceScore(userId),
        canViewOrg ? getAllPerformanceScores() : Promise.resolve([]),
        getAllUsers(),
        getTasks()
      ]);
      setMyScore(score);
      setAllScores(scores);
      setAllUsers(users);
      setAllTasks(tasksList);
    } catch (e) {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
    // loadData is stable in behaviour and depends only on userId; including it
    // would re-fetch on every render since it's recreated each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const updated = await recalculatePerformanceScore(userId);
      setMyScore(updated);
      const scores = await getAllPerformanceScores();
      setAllScores(scores);
      toast.success('Performance scores updated successfully!');
    } catch (e) {
      toast.error('Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !selectedUser || !reviewScore) {
      toast.error('Please complete all review fields');
      return;
    }
    try {
      await submitPerformanceReview({
        taskId: selectedTask,
        reviewerId: userId,
        revieweeId: selectedUser,
        type: reviewType,
        score: reviewScore,
        comment: reviewComment,
      });
      toast.success('Performance review submitted successfully!');
      setShowReviewModal(false);
      setSelectedTask('');
      setSelectedUser('');
      setReviewComment('');
      loadData();
    } catch (e) {
      toast.error('Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Find user's department ranking
  const departmentUsers = allUsers.filter(u => u.roleId === appUser?.roleId).map(u => u.id);
  const sortedOrgScores = [...allScores].sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);
  const sortedDeptScores = [...allScores]
    .filter(s => departmentUsers.includes(s.userId))
    .sort((a, b) => b.overallPerformanceIndex - a.overallPerformanceIndex);

  const orgRank = sortedOrgScores.findIndex(s => s.userId === userId) + 1;
  const deptRank = sortedDeptScores.findIndex(s => s.userId === userId) + 1;

  // Period-aware "tasks completed" for the leaderboard: counts DONE tasks whose
  // last update falls inside the selected window ('all' uses the lifetime
  // aggregate from the score document).
  const periodStart =
    period === 'week' ? Date.now() - 7 * 86400000 :
    period === 'month' ? Date.now() - 30 * 86400000 : 0;
  const completedInPeriod = (uid: string, lifetime: number) => {
    if (period === 'all') return lifetime;
    return allTasks.filter(t =>
      t.status === 'done' &&
      (t.assigneeIds?.includes(uid)) &&
      ((t.updatedAt as any)?.toMillis?.() ?? 0) >= periodStart
    ).length;
  };

  // Radar data
  const radarData = myScore ? [
    { subject: 'Productivity', A: myScore.productivityScore, fullMark: 100 },
    { subject: 'Reliability', A: myScore.reliabilityScore, fullMark: 100 },
    { subject: 'Efficiency', A: myScore.efficiencyScore, fullMark: 100 },
    { subject: 'Quality', A: myScore.qualityScore, fullMark: 100 },
    { subject: 'Collaboration', A: myScore.collaborationScore, fullMark: 100 },
  ] : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in text-slate-800 dark:text-slate-200">
      
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="w-8 h-8 text-amber-500" />
            Performance & Points Engine
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track achievements, leaderboard ranks, and complete detailed operational KPIs.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowReviewModal(true)}
            variant="outline"
            leftIcon={<MessageSquare className="w-4 h-4" />}
          >
            Review Peer
          </Button>
          <Button
            onClick={handleRecalculate}
            loading={recalculating}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Recalculate Score
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4 overflow-x-auto">
        {(['overview', 'leaderboard', 'analytics', 'badges', 'insights'] as const).map(tab => {
          if (tab === 'insights' && !isManager) return null;
          // Org-wide tabs need performance_view — without it the rules only
          // allow reading the user's OWN score, so these would render empty.
          if ((tab === 'leaderboard' || tab === 'analytics') && !canViewOrg) return null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 font-semibold text-sm capitalize border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && myScore && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Score Card */}
          <Card padding={false} className="flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-white to-slate-50 dark:from-slate-850 dark:to-slate-800 border border-slate-100 dark:border-slate-700">
            <div className="relative w-40 h-40 flex items-center justify-center mt-4">
              <span className="text-6xl font-black text-amber-500">{myScore.overallPerformanceIndex}</span>
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <h3 className="text-xl font-bold mt-4">Overall Performance Index</h3>
            <p className="text-sm text-slate-500 mt-1">OPI Target: 90+</p>
            
            <div className="grid grid-cols-2 gap-4 w-full mt-6 border-t pt-6 border-slate-100 dark:border-slate-700">
              {canViewOrg ? (
                <>
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">#{deptRank || '-'}</span>
                    <span className="text-xs text-slate-500 font-medium">Department Rank</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">#{orgRank || '-'}</span>
                    <span className="text-xs text-slate-500 font-medium">Organization Rank</span>
                  </div>
                </>
              ) : (
                // Staff can't read others' scores, so ranks are unknowable —
                // show their own meaningful personal stats instead.
                <>
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">🔥 {myScore.bestStreak}</span>
                    <span className="text-xs text-slate-500 font-medium">Best Streak</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-slate-900 dark:text-white">{myScore.badges.length}</span>
                    <span className="text-xs text-slate-500 font-medium">Badges Earned</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Radar Metrics */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">KPI Breakdown</h3>
            </div>
            <div className="p-5">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="My Metrics" dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Quick Stats & Streak */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Streaks & Badges</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔥</span>
                  <div>
                    <h4 className="font-bold text-orange-950 dark:text-orange-100">On-Time Streak</h4>
                    <p className="text-xs text-orange-700 dark:text-orange-350">Consecutive tasks completed on time</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-orange-600">{myScore.consecutiveSuccesses}</span>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h4 className="font-bold text-sm mb-3">Earned Badges ({myScore.badges.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {myScore.badges.map(b => {
                    const meta = BADGE_METADATA[b];
                    if (!meta) return null;
                    return (
                      <span
                        key={b}
                        title={meta.desc}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${meta.color}`}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <Card padding={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Leaderboards</h3>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                {(['week', 'month', 'all'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-1.5 rounded text-xs font-bold capitalize transition-all ${
                      period === p ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold uppercase">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">OPI Score</th>
                    <th className="py-3 px-4 text-center">
                      Tasks Completed{period !== 'all' ? ` (${period})` : ''}
                    </th>
                    <th className="py-3 px-4 text-center">Current Streak</th>
                    <th className="py-3 px-4">Earned Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrgScores.map((score, index) => {
                    const user = allUsers.find(u => u.id === score.userId);
                    if (!user) return null;
                    const isCurrent = score.userId === userId;

                    return (
                      <tr
                        key={score.userId}
                        className={`border-b border-slate-100 dark:border-slate-800 transition-all ${
                          isCurrent ? 'bg-amber-500/10 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </td>
                        <td className="py-4 px-4 flex items-center gap-3">
                          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">{user.name}</span>
                            <span className="text-xs text-slate-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                            {score.overallPerformanceIndex}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">{completedInPeriod(score.userId, score.totalTasksCompleted)}</td>
                        <td className="py-4 px-4 text-center font-bold text-orange-600">🔥 {score.consecutiveSuccesses}</td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1 overflow-hidden">
                            {score.badges.slice(0, 3).map(b => (
                              <span key={b} title={BADGE_METADATA[b]?.name} className="text-lg">
                                {BADGE_METADATA[b]?.icon}
                              </span>
                            ))}
                            {score.badges.length > 3 && (
                              <span className="text-xs text-slate-400 font-bold self-center">+{score.badges.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'analytics' && myScore && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Task Priority Distribution</h3>
            </div>
            <div className="p-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Critical', value: myScore.completedByPriority.critical },
                      { name: 'High', value: myScore.completedByPriority.high },
                      { name: 'Medium', value: myScore.completedByPriority.medium },
                      { name: 'Low', value: myScore.completedByPriority.low },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                    dataKey="value"
                  >
                    {COLORS.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Penalty Points Breakdown</h3>
            </div>
            <div className="p-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Late', value: myScore.penaltyBreakdown.lateCompletions },
                    { name: 'Extensions', value: myScore.penaltyBreakdown.deadlineExtensions },
                    { name: 'Rejections', value: myScore.penaltyBreakdown.rejections },
                    { name: 'Reopenings', value: myScore.penaltyBreakdown.reopenings },
                    { name: 'Overdue', value: myScore.penaltyBreakdown.missedDeadlines },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'badges' && myScore && (
        <Card padding={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Achievements Shelf</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(BADGE_METADATA).map(([id, meta]) => {
              const hasBadge = myScore.badges.includes(id);
              return (
                <div
                  key={id}
                  className={`p-4 rounded-xl border flex gap-4 transition-all ${
                    hasBadge
                      ? 'bg-white dark:bg-slate-850 border-amber-200 dark:border-amber-900/30 shadow-sm'
                      : 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-150 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <span className="text-4xl self-center">{meta.icon}</span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {meta.name}
                      {hasBadge && <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{meta.desc}</p>
                    <span className={`inline-block mt-3 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasBadge ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {hasBadge ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'insights' && isManager && (
        <Card padding={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">At-Risk Team Members (OPI &lt; 70)</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {allScores.filter(s => s.overallPerformanceIndex < 70).map(s => {
              const u = allUsers.find(user => user.id === s.userId);
              if (!u) return null;
              return (
                <div key={s.userId} className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatarUrl} name={u.name} size="sm" />
                    <div>
                      <h4 className="font-bold">{u.name}</h4>
                      <p className="text-xs text-slate-500">OPI: {s.overallPerformanceIndex}</p>
                    </div>
                  </div>
                  <Badge variant="danger">Review Needed</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card padding={false} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Peer Performance Review</h3>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Task Reference</label>
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                >
                  <option value="">Select Task</option>
                  {allTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Assignee / Reviewee</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                >
                  <option value="">Select Member</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Score Rating (1-5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewScore(star)}
                      className={`text-2xl transition-all ${reviewScore >= star ? 'text-amber-500 scale-110' : 'text-slate-300 dark:text-slate-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Review Comment</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Provide details on quality, timeliness, or collaboration..."
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 h-24"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 border-slate-100 dark:border-slate-700">
                <Button type="button" onClick={() => setShowReviewModal(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit">
                  Submit Review
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PerformancePage;
