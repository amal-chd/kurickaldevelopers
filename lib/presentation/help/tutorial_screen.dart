import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// In-app staff tutorial — a mobile-native "how to use Task Pilot" guide.
/// Content mirrors the staff field manual, condensed for on-site reading.
class TutorialScreen extends StatelessWidget {
  const TutorialScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final topics = _topics;
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('App Tutorial'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0.5,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppTheme.primary, AppTheme.primaryMid],
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              boxShadow: AppTheme.softShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: AppTheme.accent.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                      ),
                      child: const Icon(Icons.school_rounded,
                          color: AppTheme.accent, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'How to use Task Pilot',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'A quick guide to running your day on site — attendance, '
                  'tasks, chat and more. Tap any topic to expand it.',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontSize: 13.5,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          for (var i = 0; i < topics.length; i++) ...[
            _ExpandableTopic(topic: topics[i], startOpen: i == 0),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
          Center(
            child: Text(
              'Task Pilot · Kurickal Developers',
              style: TextStyle(
                fontSize: 11.5,
                color: AppTheme.textLight,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Expandable topic card ────────────────────────────────────────────────────

class _ExpandableTopic extends StatefulWidget {
  final _Topic topic;
  final bool startOpen;
  const _ExpandableTopic({required this.topic, this.startOpen = false});

  @override
  State<_ExpandableTopic> createState() => _ExpandableTopicState();
}

class _ExpandableTopicState extends State<_ExpandableTopic> {
  late bool _open = widget.startOpen;

  @override
  Widget build(BuildContext context) {
    final t = widget.topic;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppTheme.divider),
        boxShadow: _open ? AppTheme.softShadow : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: t.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppTheme.radiusXs),
                    ),
                    child: Icon(t.icon, color: t.color, size: 21),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.title,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          t.summary,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textLight,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down_rounded,
                        color: AppTheme.textMuted),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(height: 1, color: AppTheme.divider),
                  const SizedBox(height: 12),
                  ...t.blocks.map((b) => b.build(t.color)),
                ],
              ),
            ),
            crossFadeState:
                _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
            sizeCurve: Curves.easeInOut,
          ),
        ],
      ),
    );
  }
}

// ─── Content model ────────────────────────────────────────────────────────────

class _Topic {
  final IconData icon;
  final Color color;
  final String title;
  final String summary;
  final List<_Block> blocks;
  const _Topic({
    required this.icon,
    required this.color,
    required this.title,
    required this.summary,
    required this.blocks,
  });
}

abstract class _Block {
  const _Block();
  Widget build(Color accent);
}

/// Paragraph with lightweight **bold** support.
class _P extends _Block {
  final String text;
  const _P(this.text);
  @override
  Widget build(Color accent) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: RichText(
          text: TextSpan(
            style: const TextStyle(
                fontSize: 13.5, height: 1.55, color: AppTheme.textMuted),
            children: _spans(text),
          ),
        ),
      );
}

class _Bullets extends _Block {
  final List<String> items;
  const _Bullets(this.items);
  @override
  Widget build(Color accent) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: items
              .map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 7),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 6, right: 9),
                          child: Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                                color: accent, shape: BoxShape.circle),
                          ),
                        ),
                        Expanded(
                          child: RichText(
                            text: TextSpan(
                              style: const TextStyle(
                                  fontSize: 13.5,
                                  height: 1.5,
                                  color: AppTheme.textMuted),
                              children: _spans(s),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ))
              .toList(),
        ),
      );
}

class _Steps extends _Block {
  final List<String> items;
  const _Steps(this.items);
  @override
  Widget build(Color accent) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Column(
          children: [
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(
                                fontSize: 13.5,
                                height: 1.5,
                                color: AppTheme.textMuted),
                            children: _spans(items[i]),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
}

enum _TipKind { tip, important, warning }

class _Tip extends _Block {
  final String text;
  final _TipKind kind;
  const _Tip(this.text, {this.kind = _TipKind.tip});
  @override
  Widget build(Color accent) {
    final (bg, fg, icon) = switch (kind) {
      _TipKind.tip => (
          AppTheme.success.withValues(alpha: 0.09),
          AppTheme.success,
          Icons.check_circle_rounded
        ),
      _TipKind.important => (
          AppTheme.warning.withValues(alpha: 0.10),
          AppTheme.accentDark,
          Icons.info_rounded
        ),
      _TipKind.warning => (
          AppTheme.error.withValues(alpha: 0.09),
          AppTheme.error,
          Icons.warning_rounded
        ),
    };
    return Container(
      margin: const EdgeInsets.only(top: 2, bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        border: Border(left: BorderSide(color: fg, width: 3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: fg),
          const SizedBox(width: 9),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(
                    fontSize: 12.8, height: 1.5, color: AppTheme.textMuted),
                children: _spans(text),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Splits text on **bold** markers into styled spans.
List<TextSpan> _spans(String text) {
  final spans = <TextSpan>[];
  final parts = text.split('**');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].isEmpty) continue;
    spans.add(TextSpan(
      text: parts[i],
      style: i.isOdd
          ? const TextStyle(
              fontWeight: FontWeight.w700, color: AppTheme.onSurface)
          : null,
    ));
  }
  return spans;
}

// ─── The tutorial content ─────────────────────────────────────────────────────

const List<_Topic> _topics = [
  _Topic(
    icon: Icons.login_rounded,
    color: AppTheme.info,
    title: 'Getting started',
    summary: 'Signing in, notifications & your profile',
    blocks: [
      _P('Your account is created for you by an administrator — there is '
          'nothing to register. Just sign in and go.'),
      _Steps([
        'Enter the **email and password** your admin gave you and tap **Sign in**. '
            '(Some crews sign in by **phone number** and an SMS code instead.)',
        'Allow **notifications** when asked — this is how you hear about tasks, '
            'approvals and announcements.',
        'On a personal phone, turn on **biometric unlock** (Face ID / fingerprint) '
            'in Profile so you do not retype your password.',
      ]),
      _Tip(
          'Forgot your password? There is no self-service reset — ask any admin to '
          'open **User Management**, tap your name and choose **Reset Password**. '
          'Change it once you are in.',
          kind: _TipKind.important),
    ],
  ),
  _Topic(
    icon: Icons.dashboard_rounded,
    color: AppTheme.primaryMid,
    title: 'Your home dashboard',
    summary: 'Your morning briefing at a glance',
    blocks: [
      _Bullets([
        '**KPIs** — tasks due today, overdue, and waiting on a review.',
        '**My Tasks** — what is assigned to you; tap a row to open it.',
        '**Quick Actions** — check in, create a task, open chat, log the site diary.',
        '**Active Sites** — the projects you are on, with progress and health.',
      ]),
    ],
  ),
  _Topic(
    icon: Icons.task_alt_rounded,
    color: AppTheme.statusInProgress,
    title: 'Tasks & the review flow',
    summary: 'Statuses, finishing work & assigning',
    blocks: [
      _P('A task has three statuses: **In Progress** → **Under Review** → **Done**.'),
      _P('**Finishing a task:** when you tap **Mark as done** as a field worker, the '
          'task goes to **Under Review** (not straight to Done). Your task creator '
          'and project manager get a "Verification Required" alert, and a manager '
          'then marks it **Done**.'),
      _Tip('If you created the task or you are a manager, your "done" lands as '
          '**Done** immediately. The review step keeps points fair.'),
      _P('**Creating a task:** tap **＋ New Task**, give it a title, project, due date '
          'and priority, then assign it to **people** or to a whole **role**. Add '
          'subtasks, tags and photo attachments if useful.'),
      _Tip('You always see tasks assigned to **you**, to **your role**, or that **you '
          'created** — no special permission needed. If one is missing, ask the '
          'creator to confirm your name or role is on it.',
          kind: _TipKind.important),
    ],
  ),
  _Topic(
    icon: Icons.access_time_rounded,
    color: AppTheme.success,
    title: 'Attendance & overtime',
    summary: 'Check in and out on site',
    blocks: [
      _Steps([
        'On arrival, tap **Check in** — the app confirms you are inside the site '
            '**geofence** and stamps the time and place.',
        'When you leave, tap **Check out** — your hours are worked out automatically '
            'and anything beyond standard hours counts as **overtime**.',
      ]),
      _P('Open **My Attendance** for a monthly calendar, total hours, overtime, and '
          'recent overtime days. A day counts once even if you check into more than '
          'one project.'),
      _Tip('Check-in refused? You must be **within the site geofence** with '
          '**location permission** granted. If you are on site and it still refuses, '
          'ask your project manager to check the site location and radius.',
          kind: _TipKind.warning),
    ],
  ),
  _Topic(
    icon: Icons.chat_bubble_rounded,
    color: AppTheme.info,
    title: 'Team chat & tagging',
    summary: 'Channels, and tagging people or whole roles',
    blocks: [
      _P('There are four channel types: **Direct** (1-to-1), **Project** (everyone on '
          'a job), **Group** (a custom crew), and **Announcement** (leaders post, '
          'everyone reads).'),
      _P('**Tagging:** type **@** then a few letters. The picker shows a **Roles** '
          'group at the top and **People** below.'),
      _Bullets([
        'Pick a **role** (e.g. @Site Engineer) to notify **everyone in that role** at once.',
        'Pick a **person** to tag just them. Channel members appear first.',
      ]),
      _Tip('Everyone can tag — it is not limited to managers. Use role tags to reach '
          'a whole crew without adding names one by one.'),
      _P('You can also reply, add reactions, share a task into chat, and attach '
          'photos or files.'),
    ],
  ),
  _Topic(
    icon: Icons.folder_rounded,
    color: AppTheme.statusReview,
    title: 'Documents & site diary',
    summary: 'Files per project & the daily log',
    blocks: [
      _P('**Documents:** store drawings, permits and reports against a project. '
          'Anyone with access can view and upload; leads can mark a document '
          '**Approved**.'),
      _P('**Site diary:** log the day — weather, progress, worker count, issues and '
          'safety notes, with photos. One entry per project per day.'),
      _Tip('On iOS, if a file will not attach from iCloud, open it once in the Files '
          'app first so it downloads, then attach it.',
          kind: _TipKind.important),
    ],
  ),
  _Topic(
    icon: Icons.inventory_2_rounded,
    color: AppTheme.accent,
    title: 'Assets & equipment',
    summary: 'The equipment register',
    blocks: [
      _P('Every asset shows a status: **Available**, **In use**, **Maintenance** or '
          '**Retired**.'),
      _Bullets([
        'Everyone can browse the register and open an asset for its details.',
        'Asset managers **add** equipment, **assign** it out and back, and **log '
            'maintenance**.',
        'Each asset shows its current **book value** and depreciation for finance.',
      ]),
    ],
  ),
  _Topic(
    icon: Icons.emoji_events_rounded,
    color: AppTheme.accentDark,
    title: 'Performance & points',
    summary: 'How your score, badges & rank work',
    blocks: [
      _P('You are scored fairly on the work you actually complete. See your score, '
          'badges and leaderboard rank under **Performance & Points**.'),
      _Bullets([
        '**Earns points:** completing tasks (more for higher priority), finishing '
            'on time, on-time streaks, helping on shared tasks, strong attendance.',
        '**Costs points:** late or missed deadlines, deadline extensions, rejected '
            'or reopened work, long inactivity.',
      ]),
      _Tip('Scores are **normalised by role**, so you are measured against the demands '
          'of your own job — never compared unfairly to a different one.'),
    ],
  ),
  _Topic(
    icon: Icons.account_balance_wallet_rounded,
    color: AppTheme.success,
    title: 'Leave, salary & expenses',
    summary: 'HR & finance basics',
    blocks: [
      _Bullets([
        '**Leave** — log your leave type, dates and reason.',
        '**Salary slips** — view your monthly payslips: basic, allowances, '
            'deductions and net pay.',
        '**Purchase & expenses** — record expenses against a project.',
      ]),
      _P('You always see your own; Accounts, HR and managers manage these across the '
          'company depending on their role.'),
    ],
  ),
  _Topic(
    icon: Icons.notifications_rounded,
    color: AppTheme.error,
    title: 'Notifications',
    summary: 'Staying across what needs you',
    blocks: [
      _Bullets([
        '**Tap** a notification to jump to the task, chat or item it is about.',
        'Related alerts about the same item are **stacked** — you see "Updates to: …" '
            'with a count and the latest on top.',
        'Opening the item marks it read; you can also mark all as read.',
      ]),
      _Tip('Not getting alerts? Allow notifications for Task Pilot in your phone '
          'settings, and check your in-app preferences under Profile. On a shared '
          'device, sign back in to re-register it.',
          kind: _TipKind.important),
    ],
  ),
  _Topic(
    icon: Icons.shield_rounded,
    color: AppTheme.primaryMid,
    title: 'Your role & access',
    summary: 'What you can see and do',
    blocks: [
      _P('Every person has one **role** that decides which menus you see and which '
          'actions you can take. Field roles focus on their own tasks and '
          'attendance; managers oversee the full board; admins manage users and '
          'roles.'),
      _Tip('Missing access you need for your job — or seeing something you should not? '
          'Tell an administrator; they can adjust your role in seconds.',
          kind: _TipKind.important),
    ],
  ),
  _Topic(
    icon: Icons.support_agent_rounded,
    color: AppTheme.info,
    title: 'Need help?',
    summary: 'Who to contact',
    blocks: [
      _Bullets([
        'Your **project manager** — anything about tasks, projects or attendance on '
            'your site.',
        'An **administrator** — account, password, role or access issues.',
      ]),
    ],
  ),
];
