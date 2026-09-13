import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, Search, CheckSquare, Clock, MessageSquare, FileText,
  Package, Award, Wallet, Bell, Shield, HelpCircle, ChevronDown,
  ChevronRight, ArrowLeft, ExternalLink, Check, Copy, HardHat,
  Smartphone, Monitor, Sparkles, AlertTriangle, Info, CheckCircle2,
  Calendar, Layers, MapPin, Users, Flame, ChevronUp
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SectionBlock {
  type: 'paragraph' | 'steps' | 'bullets' | 'tip' | 'warning' | 'table';
  text?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  badge?: string;
}

interface ManualTopic {
  id: string;
  category: string;
  title: string;
  summary: string;
  icon: React.ElementType;
  badgeColor: string;
  blocks: SectionBlock[];
}

const TOPICS: ManualTopic[] = [
  {
    id: 'getting-started',
    category: 'Basics',
    title: 'Getting Started & Account Access',
    summary: 'Account provisioning, sign-in, mobile vs web, and device permissions',
    icon: Smartphone,
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Task Pilot is the unified project management and field operations platform for Kurickal Developers. Your account is pre-provisioned by company administration—no self-registration is needed.'
      },
      {
        type: 'steps',
        items: [
          '**Sign In**: Log in using your assigned corporate email and initial password provided by the administrator.',
          '**Grant Permissions**: On mobile, approve **Location** (necessary for site geofenced attendance) and **Notifications** (for task assignments and chat alerts).',
          '**Biometric Unlock**: On personal smartphones, enable Face ID or Fingerprint unlock in your Profile page for seamless 1-tap access without retyping passwords.',
          '**Web Dashboard**: Access the full desktop management portal anytime at **https://kurikal-tms-app.web.app**.'
        ]
      },
      {
        type: 'tip',
        text: 'Forgot your password? For security compliance, password resets are handled by system administrators. Contact any manager or director who can instantly trigger a password reset for your account via User Management.'
      }
    ]
  },
  {
    id: 'dashboard',
    category: 'Basics',
    title: 'Morning Briefing & Dashboard',
    summary: 'Understanding your home briefing, daily KPIs, and quick actions',
    icon: Monitor,
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'The dashboard acts as your operational command center. It organizes your day before you step onto the construction site.'
      },
      {
        type: 'bullets',
        items: [
          '**KPI Summary**: View real-time indicators for tasks due today, pending verifications, overdue work, and active projects.',
          '**Quick Action Bar**: Fast shortcuts to Check In/Out, New Task creation, Team Chat, and Site Diary logging.',
          '**My Tasks**: An actionable list of tasks assigned specifically to you or your active role, sorted by urgency and deadline.',
          '**Active Sites**: Live status of sites you are currently posted to, including supervisor contact and site health status.'
        ]
      }
    ]
  },
  {
    id: 'tasks-and-review',
    category: 'Field Operations',
    title: 'Tasks & The 3-Step Verification Flow',
    summary: 'Task lifecycles, subtasks, role assignments, and manager review',
    icon: CheckSquare,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Every task in Task Pilot follows a strict quality assurance workflow: **In Progress → Under Review → Done**.'
      },
      {
        type: 'steps',
        items: [
          '**In Progress**: Work is actively underway. Team members can post progress updates, upload photos/documents, and tick off subtasks.',
          '**Mark as Done (Staff Submission)**: When field personnel tap "Mark as Done", the task moves to **Under Review**. It does not instantly become Done.',
          '**Verification Required**: The task creator and project manager automatically receive an instant push notification saying *"[Name] submitted task for verification"*.',
          '**Manager Sign-off**: The project manager or administrator inspects the completed work and marks it **Done**, awarding performance points to the assignees.'
        ]
      },
      {
        type: 'tip',
        text: 'Tasks created directly by project managers or directors automatically complete when they mark them done. The review step ensures fair accountability and prevents accidental self-credit on team tasks.'
      },
      {
        type: 'bullets',
        items: [
          '**Assigning to Roles**: Tasks can be assigned to individual people OR to an entire role (e.g. all Site Engineers). Anyone holding that role receives the alert and shares ownership.',
          '**Subtask Checklists**: Break complex civil work into concrete milestones (e.g. "Excavation", "Rebar Placement", "Pouring").',
          '**File Attachments**: Upload inspection photos, receipts, or PDF reports directly inside task comments.'
        ]
      }
    ]
  },
  {
    id: 'attendance-overtime',
    category: 'Field Operations',
    title: 'Site Attendance, Geofencing & Overtime',
    summary: 'GPS check-ins, automated hours, 8-hour overtime thresholds, and logs',
    icon: Clock,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Attendance is strictly verified against each project\'s verified GPS boundary to ensure compliance and precise work records.'
      },
      {
        type: 'steps',
        items: [
          '**Arrival**: Stand within the designated site boundary and tap **Check In**. The system checks your GPS coordinates against the site coordinates and records your start time.',
          '**Departure**: Tap **Check Out** when ending your shift. Total active time is computed to the exact minute.',
          '**Multiple Sites**: If you travel between sites during the day, checking in to a new site automatically logs your transition while preserving your total daily attendance.'
        ]
      },
      {
        type: 'table',
        headers: ['Work Duration', 'Classification', 'Overtime Recorded'],
        rows: [
          ['Under 8 hours (0 – 480 mins)', 'Standard Shift', '0h 0m'],
          ['8 hours 30 mins (510 mins)', 'Standard + Overtime', '0h 30m'],
          ['10 hours (600 mins)', 'Standard + Overtime', '2h 00m']
        ]
      },
      {
        type: 'warning',
        text: 'If check-in fails with "Out of Geofence Range", verify that location services are enabled on your device. If you are physically on site, notify your Project Manager to calibrate the site boundary radius.'
      }
    ]
  },
  {
    id: 'chat-and-tagging',
    category: 'Collaboration',
    title: 'Team Chat & Intelligent Tagging',
    summary: 'Channels, direct messages, and broadcasting with @Role mentions',
    icon: MessageSquare,
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Task Pilot features real-time messaging tailored specifically for distributed construction site teams.'
      },
      {
        type: 'bullets',
        items: [
          '**Direct Messages (1-on-1)**: Private conversations between individual colleagues.',
          '**Project Channels**: Automatically created for every project, containing all assigned members.',
          '**Announcement Channels**: Company-wide broadcasts where management posts updates and directives.',
          '**Group Chats**: Flexible custom channels for specialized crews (e.g. Electrical team, Procurement team).'
        ]
      },
      {
        type: 'paragraph',
        text: '**Supercharged @Mentions**:'
      },
      {
        type: 'steps',
        items: [
          'Type **@** into the message composer to trigger the suggestion popup.',
          '**@Person**: Tags a specific colleague and sends them an immediate notification with sound and vibration.',
          '**@Role**: Tag an entire job title (e.g., **@Site Engineer**, **@Purchase Manager**, **@Accounts**). Everyone in the company with that role receives the alert simultaneously without having to tag people individually.'
        ]
      },
      {
        type: 'tip',
        text: 'You can share tasks directly into chat by tapping the task link or sharing the task ID. Members can open and view the task directly from the message bubble.'
      }
    ]
  },
  {
    id: 'documents-diary',
    category: 'Field Operations',
    title: 'Documents & Daily Site Diary',
    summary: 'Drawings register, approvals, weather logs, manpower, and safety notes',
    icon: FileText,
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Every project maintains a permanent legal and operational archive of files and daily site records.'
      },
      {
        type: 'bullets',
        items: [
          '**Document Repository**: Store architectural CAD drawings, structural plans, soil test reports, and municipal permits organized by project.',
          '**Approval Statuses**: Critical drawings can be marked as "Under Review" or "Approved" by Project Managers and Chief Engineers before field implementation.',
          '**Daily Site Diary**: Supervisors record daily conditions including Weather (Rain/Sunny/Clear), Contractor Manpower Headcounts, Work Summary, and Safety Incidents.',
          '**Photo Evidence**: Attach progress snapshots directly to each daily diary entry for verifiable work histories.'
        ]
      }
    ]
  },
  {
    id: 'assets-equipment',
    category: 'Resources',
    title: 'Asset & Equipment Management',
    summary: 'Machinery register, allocations, maintenance records, and depreciation',
    icon: Package,
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'All company tools, heavy vehicles, scaffolding, and testing instruments are logged in the central asset register.'
      },
      {
        type: 'bullets',
        items: [
          '**Live Statuses**: Equipment is tracked as **Available**, **In Use**, **Under Maintenance**, or **Retired**.',
          '**Custody Tracking**: View which site engineer or project currently holds a specific generator, transit mixer, or total station.',
          '**Maintenance Logs**: Log periodic servicing, part replacements, and repair costs.',
          '**Depreciation & Valuation**: Financial overview calculating straight-line depreciation and current book value.'
        ]
      }
    ]
  },
  {
    id: 'performance-engine',
    category: 'Recognition',
    title: 'Performance Engine & Points System',
    summary: 'Normalised scoring, on-time streaks, rankings, and badges',
    icon: Award,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'The Performance Engine rewards diligence, punctuality, and proactive problem solving across all departments.'
      },
      {
        type: 'table',
        headers: ['Event / Contribution', 'Impact on Score', 'Notes'],
        rows: [
          ['Task Completed On Time', '+10 to +30 Points', 'Weighted higher for High & Urgent priority tasks'],
          ['On-time Work Streak (5+ tasks)', '+25 Bonus Points', 'Awarded for consistent delivery without extensions'],
          ['Shared Collaboration Support', '+15 Points', 'Assisting colleagues on joint project milestones'],
          ['Missed Deadline / Overdue', '-15 Points', 'Deducted when work lapses past the agreed due date'],
          ['Rejected Verification', '-10 Points', 'When work is returned by manager for rework']
        ]
      },
      {
        type: 'tip',
        text: 'All scores are **normalised by role demand**. A Site Engineer is never unfairly benchmarked against an Office Administrator; everyone is scored against the standards of their own craft.'
      }
    ]
  },
  {
    id: 'hr-finance',
    category: 'Administration',
    title: 'HR, Leave, Salary & Expenses',
    summary: 'Leave applications, salary slips breakdown, and project site expenses',
    icon: Wallet,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blocks: [
      {
        type: 'bullets',
        items: [
          '**Leave Requests**: Apply for Paid Leave, Sick Leave, or Casual Leave. Track approval status from your department head in real time.',
          '**Salary Slips**: Securely view monthly payslips detailing Basic Pay, HRA, Travel Allowances, Overtime Pay, and Net Remittance.',
          '**Site Expenses**: Log field purchase receipts (e.g. emergency hardware, fuel, cement batches) with photo receipts for reimbursement and cost tracking.'
        ]
      }
    ]
  },
  {
    id: 'notifications',
    category: 'System',
    title: 'Notification Center & Intelligent Stacking',
    summary: 'FCM push alerts, chronological grouping, and thread stacking',
    icon: Bell,
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'The Notification Center ensures you never miss a deadline or urgent directive, without overwhelming your device.'
      },
      {
        type: 'bullets',
        items: [
          '**Date Grouping**: Notifications are categorized cleanly into **Today**, **Yesterday**, and **Earlier**.',
          '**Smart Notification Stacking**: Multiple events on the same task or project (e.g., three comments and a subtask) are collapsed into one stacked card with a badge showing the update count.',
          '**One-Tap Navigation**: Tapping any notification opens the corresponding task, chat channel, or document directly.',
          '**Mark All as Read**: Clear all pending alerts in one click from the dropdown or full notification center.'
        ]
      }
    ]
  },
  {
    id: 'roles-access',
    category: 'Security',
    title: 'Role Hierarchy & Permission Matrix',
    summary: 'Role levels 10 to 100, permissions, and security guards',
    icon: Shield,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    blocks: [
      {
        type: 'paragraph',
        text: 'Every user in the system is assigned a role that determines their data visibility and administrative authority.'
      },
      {
        type: 'table',
        headers: ['Role Tier', 'Level', 'Key Responsibilities & Scope'],
        rows: [
          ['Director / Owner', '100', 'Full executive control, role assignment, administrative overrides, financial audits'],
          ['Admin', '90', 'User management, company settings, system audits, broadcast messaging'],
          ['Project Manager', '89', 'Project creation, task approvals, contractor oversight, site budget management'],
          ['Planning & Quality Head', '87', 'Drawings approval, quality audits, delivery milestone scheduling'],
          ['Purchase Manager', '85', 'Procurement approvals, material supplier requisitions, asset intake'],
          ['Office Administrator', '72', 'Attendance monitoring, office coordination, document archiving'],
          ['Quantity Surveyor', '68', 'Estimation, measurement sheets, material quantity reconciliation'],
          ['Accounts', '67', 'Salary slips generation, expense disbursement, financial reporting'],
          ['Site Engineer', '49', 'Daily site supervision, task execution, diary entries, geofence check-in'],
          ['Equipment Operator', '10', 'Machinery operation, asset usage logging, personal attendance']
        ]
      }
    ]
  },
  {
    id: 'support-contacts',
    category: 'Support',
    title: 'Support & Escalation Directory',
    summary: 'Who to contact for on-site emergencies, app issues, or account changes',
    icon: HelpCircle,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    blocks: [
      {
        type: 'bullets',
        items: [
          '**On-Site Civil / Project Inquiries**: Contact your assigned **Project Manager** directly via the project chat channel.',
          '**Password & Access Adjustments**: Request your department manager or email **thomas@kurickaldevelopers.com**.',
          '**Payroll & Expense Reconciliations**: Post questions to the **Accounts** team in the corporate chat.',
          '**Emergency Site Safety**: Call the safety officer or project director immediately.'
        ]
      }
    ]
  }
];

export default function FieldManualPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    'getting-started': true,
    'tasks-and-review': true,
    'attendance-overtime': true,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check if rendered inside the authenticated layout (/app/*)
  const isInsideApp = location.pathname.startsWith('/app');

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(TOPICS.map((t) => t.category))];
    return cats;
  }, []);

  const filteredTopics = useMemo(() => {
    return TOPICS.filter((t) => {
      const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
      if (!matchesCat) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(q);
      const inSummary = t.summary.toLowerCase().includes(q);
      const inBlocks = t.blocks.some((b) => {
        if (b.text && b.text.toLowerCase().includes(q)) return true;
        if (b.items && b.items.some((it) => it.toLowerCase().includes(q))) return true;
        if (b.rows && b.rows.some((row) => row.some((cell) => cell.toLowerCase().includes(q)))) return true;
        return false;
      });
      return inTitle || inSummary || inBlocks;
    });
  }, [searchQuery, selectedCategory]);

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    TOPICS.forEach((t) => { next[t.id] = true; });
    setExpandedTopics(next);
  };

  const collapseAll = () => {
    setExpandedTopics({});
  };

  const handleCopyLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/manual#${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-[#1b61d4] selection:text-white ${isInsideApp ? 'bg-slate-50 p-4 sm:p-6 max-w-6xl mx-auto' : 'bg-[#f4f7f9] text-[#0f2143]'}`}>
      {/* ── Top Header for Standalone / Public Mode ── */}
      {!isInsideApp && (
        <>
          <header className="bg-[#0f2143] py-5 sticky top-0 z-50 border-b border-white/10 shadow-md">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => navigate('/')}
              >
                <div className="w-9 h-9 border-2 border-white flex items-center justify-center rotate-45 group-hover:bg-white transition-all">
                  <div className="w-3.5 h-3.5 bg-white -rotate-45 group-hover:bg-[#0f2143] transition-all" />
                </div>
                <div>
                  <span className="font-bold text-lg sm:text-xl tracking-wide text-white uppercase block leading-none">
                    Task Pilot
                  </span>
                  <span className="text-[10px] text-blue-200/70 uppercase tracking-wider font-semibold">
                    Kurickal Developers Field Manual
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {appUser ? (
                  <button
                    onClick={() => navigate('/app/dashboard')}
                    className="flex items-center gap-2 bg-[#1b61d4] hover:bg-[#154db0] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm"
                  >
                    Go to Portal
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-lg transition-all"
                  >
                    Sign In
                  </button>
                )}
                <button
                  onClick={() => navigate('/')}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-blue-100/70 hover:text-white transition-colors ml-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Home
                </button>
              </div>
            </div>
          </header>

          {/* Banner Hero */}
          <section className="bg-gradient-to-b from-[#0f2143] to-[#152e5a] text-white pt-8 pb-14 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1b61d4]/30 border border-[#1b61d4]/40 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">
                <HardHat className="w-3.5 h-3.5 text-amber-400" />
                Official Staff Operations Guide
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Task Pilot Field Manual
              </h1>
              <p className="text-blue-100/80 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                Complete operational guide for site engineers, project managers, foremen, and contractors. Master your daily attendance, tasks, chat, and field reports.
              </p>
            </div>
          </section>
        </>
      )}

      {/* ── In-App Header Banner (when viewed in /app) ── */}
      {isInsideApp && (
        <div className="mb-6 bg-gradient-to-r from-[#0f2143] to-[#1a3a6b] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 text-blue-200 text-xs font-medium mb-1">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              Standard Operating Procedures
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff Field Manual</h1>
            <p className="text-blue-100/80 text-xs sm:text-sm max-w-xl">
              Essential guidelines for daily site execution, geofenced attendance, review workflows, and points.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href="/manual"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Public Link
            </a>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className={`max-w-4xl mx-auto ${!isInsideApp ? '-mt-6 px-4 sm:px-6 relative z-10' : ''}`}>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics (e.g., 'overtime', 'mark done', 'geofence', 'points', '@role')..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b61d4] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium px-1.5 py-0.5"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#0f2143] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Expand / Collapse toggle */}
            <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
              <button onClick={expandAll} className="hover:text-[#1b61d4] transition-colors">
                Expand All
              </button>
              <span>•</span>
              <button onClick={collapseAll} className="hover:text-[#1b61d4] transition-colors">
                Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* ── Topic Cards List ── */}
        <div className="space-y-4 pb-16">
          {filteredTopics.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700 mb-1">No matching topics found</h3>
              <p className="text-sm text-slate-500 mb-4">Try searching for different keywords or clear your search query.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="px-4 py-2 bg-[#1b61d4] text-white text-xs font-medium rounded-lg hover:bg-[#154db0]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredTopics.map((topic) => {
              const isOpen = !!expandedTopics[topic.id];
              const Icon = topic.icon;

              return (
                <article
                  key={topic.id}
                  id={topic.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-150 scroll-mt-24"
                >
                  {/* Topic Accordion Header */}
                  <header
                    onClick={() => toggleTopic(topic.id)}
                    className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 select-none transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#1b61d4] shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h2 className="text-base sm:text-lg font-bold text-[#0f2143] tracking-tight">
                            {topic.title}
                          </h2>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${topic.badgeColor}`}>
                            {topic.category}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <button
                        title="Copy direct link to this section"
                        onClick={(e) => handleCopyLink(topic.id, e)}
                        className="p-1.5 text-slate-400 hover:text-[#1b61d4] hover:bg-slate-100 rounded-md transition-colors"
                      >
                        {copiedId === topic.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <div className="p-1 text-slate-400">
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </header>

                  {/* Expanded Content */}
                  {isOpen && (
                    <div className="px-5 pb-6 pt-2 border-t border-slate-100 space-y-4">
                      {topic.blocks.map((block, idx) => {
                        if (block.type === 'paragraph' && block.text) {
                          return (
                            <p key={idx} className="text-sm text-slate-600 leading-relaxed">
                              {renderFormattedText(block.text)}
                            </p>
                          );
                        }

                        if (block.type === 'steps' && block.items) {
                          return (
                            <div key={idx} className="space-y-2.5 my-3">
                              {block.items.map((step, sIdx) => (
                                <div key={sIdx} className="flex items-start gap-3">
                                  <div className="w-5 h-5 rounded-full bg-[#0f2143] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {sIdx + 1}
                                  </div>
                                  <div className="text-sm text-slate-600 leading-snug">
                                    {renderFormattedText(step)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        if (block.type === 'bullets' && block.items) {
                          return (
                            <ul key={idx} className="space-y-2 my-2 text-sm text-slate-600">
                              {block.items.map((bullet, bIdx) => (
                                <li key={bIdx} className="flex items-start gap-2.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1b61d4] shrink-0 mt-2" />
                                  <span>{renderFormattedText(bullet)}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        }

                        if (block.type === 'tip' && block.text) {
                          return (
                            <div key={idx} className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs sm:text-sm text-blue-900 flex items-start gap-2.5 my-2">
                              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div className="leading-relaxed">
                                <span className="font-semibold block mb-0.5">Pro Tip</span>
                                {renderFormattedText(block.text)}
                              </div>
                            </div>
                          );
                        }

                        if (block.type === 'warning' && block.text) {
                          return (
                            <div key={idx} className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-900 flex items-start gap-2.5 my-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="leading-relaxed">
                                <span className="font-semibold block mb-0.5">Important Notice</span>
                                {renderFormattedText(block.text)}
                              </div>
                            </div>
                          );
                        }

                        if (block.type === 'table' && block.headers && block.rows) {
                          return (
                            <div key={idx} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-xs sm:text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                                  <tr>
                                    {block.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="px-3.5 py-2.5">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {block.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/50">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="px-3.5 py-2 font-mono text-xs">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* ── Quick Help Banner at Bottom ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-3 shadow-xs mb-8">
          <HardHat className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Have questions not covered in the manual?</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Reach out to your assigned Project Manager or Director directly on the Task Pilot portal.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate(appUser ? '/app/chat' : '/login')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f2143] hover:bg-[#152e5a] text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {appUser ? 'Open Team Chat' : 'Sign in to Contact Team'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer for Public Page ── */}
      {!isInsideApp && (
        <footer className="bg-[#0f2143] py-10 border-t border-white/10 text-white/70 text-xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
            <div>
              <p className="font-semibold text-white">Kurickal Developers LLP</p>
              <p className="text-blue-100/50 text-[11px] mt-0.5">Task Pilot Enterprise Operations & Project Management</p>
            </div>
            <div className="flex items-center gap-5 text-blue-100/70">
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <a href="/policy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Use</a>
              <a href="/manual" className="text-white font-medium">Field Manual</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/**
 * Lightweight helper to format **bold** text strings into styled React spans
 */
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
