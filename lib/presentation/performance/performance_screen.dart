import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/theme.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_sizes.dart';
import '../../data/models/performance_score_model.dart';
import '../../providers/performance_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

class PerformanceScreen extends ConsumerStatefulWidget {
  const PerformanceScreen({super.key});

  @override
  ConsumerState<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends ConsumerState<PerformanceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final Map<String, Map<String, String>> badgeMetadata = {
    'speed_demon': {'name': 'Speed Demon', 'desc': 'Complete 10+ tasks in a week', 'icon': '⚡'},
    'quality_king': {'name': 'Quality King', 'desc': 'Maintain review scores above 4.5', 'icon': '👑'},
    'streak_master': {'name': 'Streak Master', 'desc': '10+ consecutive tasks on time', 'icon': '🔥'},
    'team_player': {'name': 'Team Player', 'desc': 'Help on 5+ team tasks', 'icon': '🤝'},
    'iron_will': {'name': 'Iron Will', 'desc': 'Zero late tasks in a month', 'icon': '🛡️'},
    'mvp': {'name': 'MVP', 'desc': 'OPI score of 90+', 'icon': '🏆'},
    'perfect_month': {'name': 'Perfect Month', 'desc': '100% on-time, 0 rejections', 'icon': '🎯'},
    'critical_hero': {'name': 'Critical Hero', 'desc': 'Complete 3+ critical tasks', 'icon': '🚨'},
    'consistency_champion': {'name': 'Consistency Champ', 'desc': 'Active on tasks 15+ days', 'icon': '📈'},
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final myScoreAsync = ref.watch(myPerformanceScoreProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance & Points'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accent,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Leaderboard'),
            Tab(text: 'Badges'),
          ],
        ),
      ),
      body: myScoreAsync.when(
        loading: () => const LoadingWidget(),
        error: (e, _) => AppErrorWidget(
          message: e.toString(),
          onRetry: () => ref.invalidate(myPerformanceScoreProvider),
        ),
        data: (score) {
          if (score == null) {
            return const Center(
              child: Text('No performance data calculated yet. Complete tasks to earn points!'),
            );
          }
          return TabBarView(
            controller: _tabController,
            children: [
              _buildOverviewTab(score),
              _buildLeaderboardTab(),
              _buildBadgesTab(score),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOverviewTab(PerformanceScoreModel score) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSizes.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Score Arc Gauge
          Center(
            child: Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusLg)),
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(AppSizes.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 140,
                          height: 140,
                          child: CircularProgressIndicator(
                            value: score.overallPerformanceIndex / 100,
                            strokeWidth: 10,
                            color: AppColors.accent,
                            backgroundColor: AppColors.accent.withAlpha(30),
                          ),
                        ),
                        Column(
                          children: [
                            Text(
                              '${score.overallPerformanceIndex}',
                              style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.primary),
                            ),
                            const Text(
                              'OPI Score',
                              style: TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSizes.md),
                    Text(
                      score.overallPerformanceIndex >= 90
                          ? '🏆 Elite Performer'
                          : score.overallPerformanceIndex >= 75
                              ? '⭐ Strong Performer'
                              : '👍 Consistent Work',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSizes.md),

          // Streak Card
          Card(
            color: Colors.orange.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
              side: BorderSide(color: Colors.orange.shade100),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm + 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Text('🔥', style: TextStyle(fontSize: 28)),
                      SizedBox(width: AppSizes.sm),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('On-Time Streak', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.brown)),
                          Text('Consecutive tasks on time', style: TextStyle(fontSize: 11, color: Colors.brown)),
                        ],
                      ),
                    ],
                  ),
                  Text(
                    '${score.consecutiveSuccesses}',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.orange),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSizes.md),

          // KPI Grid
          const Text('Performance Indicators', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: AppSizes.sm),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 1.6,
            crossAxisSpacing: AppSizes.sm,
            mainAxisSpacing: AppSizes.sm,
            children: [
              _buildKpiCard('Productivity', '${score.productivityScore}%'),
              _buildKpiCard('Reliability', '${score.reliabilityScore}%'),
              _buildKpiCard('Efficiency', '${score.efficiencyScore}%'),
              _buildKpiCard('Quality', '${score.qualityScore}%'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard(String label, String value) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.sm + 4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.primary)),
          ],
        ),
      ),
    );
  }

  Widget _buildLeaderboardTab() {
    final listAsync = ref.watch(leaderboardProvider);

    return listAsync.when(
      loading: () => const LoadingWidget(),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (scores) {
        return ListView.builder(
          itemCount: scores.length,
          itemBuilder: (context, idx) {
            final s = scores[idx];
            final userAsync = ref.watch(userProvider(s.userId));

            return userAsync.when(
              loading: () => const SizedBox(height: 72),
              error: (_, __) => const SizedBox(),
              data: (user) {
                if (user == null) return const SizedBox();
                final isTop3 = idx < 3;

                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: 4),
                  child: ListTile(
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 28,
                          child: Text(
                            isTop3 ? (idx == 0 ? '🥇' : idx == 1 ? '🥈' : '🥉') : '#${idx + 1}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                        const SizedBox(width: AppSizes.sm),
                        CircleAvatar(
                          backgroundImage: user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
                          child: user.avatarUrl == null ? Text(user.name.substring(0, 1)) : null,
                        ),
                      ],
                    ),
                    title: Text(user.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Streak: 🔥 ${s.consecutiveSuccesses}'),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm + 2, vertical: AppSizes.xs + 2),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withAlpha(20),
                        borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                        border: Border.all(color: AppColors.accent.withAlpha(50)),
                      ),
                      child: Text(
                        '${s.overallPerformanceIndex}',
                        style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.accent),
                      ),
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildBadgesTab(PerformanceScoreModel score) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSizes.md),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppSizes.sm,
        mainAxisSpacing: AppSizes.sm,
        childAspectRatio: 1.1,
      ),
      itemCount: badgeMetadata.length,
      itemBuilder: (context, idx) {
        final entry = badgeMetadata.entries.elementAt(idx);
        final id = entry.key;
        final meta = entry.value;
        final hasBadge = score.badges.contains(id);

        return Card(
          elevation: hasBadge ? 2 : 0,
          color: hasBadge ? Colors.white : Colors.grey.shade100.withAlpha(150),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusMd),
            side: BorderSide(color: hasBadge ? Colors.amber.shade200 : Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSizes.sm),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(meta['icon'] ?? '', style: TextStyle(fontSize: 32, color: hasBadge ? null : Colors.grey)),
                const SizedBox(height: AppSizes.xs),
                Text(
                  meta['name'] ?? '',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: hasBadge ? Colors.black : Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 2),
                Text(
                  meta['desc'] ?? '',
                  style: const TextStyle(fontSize: 9, color: AppTheme.textMuted),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
