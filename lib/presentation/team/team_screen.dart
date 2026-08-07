import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../data/models/user_model.dart';
import '../../providers/role_provider.dart';
import '../../providers/user_provider.dart';
import '../shared/widgets/avatar_widget.dart';
import '../shared/widgets/error_widget.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/empty_state_widget.dart';
import '../shared/widgets/permission_gate.dart';

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text(AppStrings.team)),
      body: PermissionGate(
        permission: 'team_view',
        fallback: const Center(
          child: EmptyStateWidget(
            icon: Icons.lock_outline_rounded,
            title: 'Access Restricted',
            subtitle: 'You do not have permission to view the team directory.',
          ),
        ),
        child: _TeamBody(searchCtrl: _searchCtrl),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Team Body
// ═══════════════════════════════════════════════════════════════════════════════

class _TeamBody extends ConsumerStatefulWidget {
  final TextEditingController searchCtrl;

  const _TeamBody({required this.searchCtrl});

  @override
  ConsumerState<_TeamBody> createState() => _TeamBodyState();
}

class _TeamBodyState extends ConsumerState<_TeamBody> {
  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(allUsersProvider);

    return Column(
      children: [
        // ── Search Bar ──
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            controller: widget.searchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search team members…',
              prefixIcon: const Icon(
                Icons.search_rounded,
                color: AppTheme.textMuted,
              ),
              suffixIcon: widget.searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        widget.searchCtrl.clear();
                        setState(() {});
                      },
                    )
                  : null,
              isDense: true,
            ),
          ),
        ),

        // ── Grid ──
        Expanded(
          child: usersAsync.when(
            loading: () => const ShimmerList(count: 6, itemHeight: 96),
            error: (e, _) => AppErrorWidget(
              message: e.toString(),
              onRetry: () => ref.invalidate(allUsersProvider),
            ),
            data: (users) {
              final query = widget.searchCtrl.text.toLowerCase();
              final filtered = query.isEmpty
                  ? users
                  : users
                        .where(
                          (u) =>
                              u.name.toLowerCase().contains(query) ||
                              u.email.toLowerCase().contains(query),
                        )
                        .toList();

              if (filtered.isEmpty) {
                return EmptyStateWidget(
                  icon: widget.searchCtrl.text.isNotEmpty
                      ? Icons.search_off_rounded
                      : Icons.people_outline_rounded,
                  title: widget.searchCtrl.text.isNotEmpty
                      ? 'No results for "${widget.searchCtrl.text}"'
                      : 'No team members yet',
                  subtitle: widget.searchCtrl.text.isNotEmpty
                      ? 'Try a different search term.'
                      : 'Team members will appear here once added.',
                );
              }

              return GridView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.88,
                ),
                itemCount: filtered.length,
                itemBuilder: (_, i) => _MemberCard(user: filtered[i]),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MemberCard extends StatelessWidget {
  final UserModel user;

  const _MemberCard({required this.user});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/team/${user.uid}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border.all(color: AppTheme.divider),
          boxShadow: AppTheme.softShadow,
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AvatarWidget(imageUrl: user.avatarUrl, name: user.name, size: 56),
            const SizedBox(height: 10),
            Text(
              user.name,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: AppTheme.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              user.email,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 8),
            _RoleBadge(roleId: user.roleId, isActive: user.isActive),
          ],
        ),
      ),
    );
  }
}

class _RoleBadge extends ConsumerWidget {
  final String roleId;
  final bool isActive;

  const _RoleBadge({required this.roleId, required this.isActive});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Look up the actual role name from Firestore instead of mangling the doc ID
    final roleAsync = roleId.isEmpty
        ? null
        : ref.watch(roleStreamProvider(roleId));
    final label = roleAsync?.value?.name ?? (roleId.isEmpty ? 'Member' : '…');
    final color = isActive ? AppTheme.brand : AppTheme.textLight;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        border: Border.all(color: color.withValues(alpha: 0.31)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
