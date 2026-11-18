import {
  Calculator, Boxes, ClipboardCheck, GanttChart,
  CheckSquare, FolderKanban, MapPin, BookOpen, FileText, MessageSquare, Receipt, CalendarDays,
  Truck, BarChart3, Award, Wallet, ShieldCheck, Smartphone, Bell, Users,
  HardHat, Building2, Paintbrush, Route, Wrench, Briefcase, LucideIcon
} from 'lucide-react';

export interface FeatureItem {
  key: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  fullDesc: string;
  category: 'field' | 'commercial' | 'planning' | 'admin';
  keyBenefits: string[];
  userRoles: string[];
}

export const FEATURES: FeatureItem[] = [
  {
    key: 'tasks',
    icon: CheckSquare,
    title: 'Tasks, Approvals & Subtasks',
    desc: 'Assign work to individuals or entire roles with priorities, deadlines, photo evidence, and mandatory manager sign-offs before completion.',
    fullDesc: 'Eliminate forgotten work and informal verbal instructions. Break down complex civil milestones into actionable subtasks with clear acceptance criteria. When field teams tap "Mark as Done", tasks move to Under Review for authorized engineer inspection rather than self-closing.',
    category: 'field',
    keyBenefits: ['Enforced 3-step verification (In Progress → Under Review → Done)', 'Role-based batch assignments (e.g. all Site Engineers)', 'Photo attachments with timestamp verification', 'Subtask completion checklists'],
    userRoles: ['Project Manager', 'Site Engineer', 'Foreman', 'Director'],
  },
  {
    key: 'attendance',
    icon: MapPin,
    title: 'GPS Geofenced Attendance',
    desc: 'Tamper-proof mobile check-in and check-out validated against the exact site perimeter, eliminating proxy attendance and buddy punching.',
    fullDesc: 'Field supervisors and engineers check in via the mobile app with location coordinates locked at the exact moment of punch-in. Unlike battery-draining continuous trackers, Task Pilot captures point-in-time coordinates and matches them to your configured site radius.',
    category: 'field',
    keyBenefits: ['Perimeter radius validation with spoof detection', 'Live dashboard showing who is on each site right now', '8-hour standard workday tracking with automatic overtime hours', 'One-click payroll Excel export'],
    userRoles: ['Site Engineer', 'Foreman', 'Labour', 'Admin'],
  },
  {
    key: 'site_diary',
    icon: BookOpen,
    title: 'Daily Site Diary (DPR)',
    desc: 'Comprehensive Daily Progress Reports recording manpower by trade, weather, equipment hours, executed work, and geotagged photos.',
    fullDesc: 'Standardize daily field documentation across all your contractors. Site engineers can complete a complete, professional DPR in under 3 minutes directly from their phone before leaving the jobsite, generating client-ready PDF summaries instantly.',
    category: 'field',
    keyBenefits: ['Log headcounts across skilled trades and general helpers', 'Capture weather delays and safety briefing records', 'Timestamped site photo progress gallery', 'Instant client-ready PDF and Excel exports'],
    userRoles: ['Site Engineer', 'Foreman', 'Project Manager', 'Client'],
  },
  {
    key: 'boq',
    icon: Calculator,
    title: 'BOQ & Earned Value Cost Control',
    desc: 'Import Bill of Quantities from Excel, track physical progress against financial spend, and monitor real-time Cost Performance Index (CPI).',
    fullDesc: 'Bridge the dangerous gap between site quantities and head office budgets. As work is completed, Task Pilot updates Planned Value (PV), Earned Value (EV), and Actual Cost (AC) computed from materials, labor, and site expenses to prevent budget overruns before they escalate.',
    category: 'commercial',
    keyBenefits: ['Direct Excel BOQ import with unit rates and quantities', 'Automated Cost Performance Index (CPI) and Schedule Variance (SV)', 'Real-time financial forecast at completion (EAC)', 'Transparent subcontractor billing reconciliation'],
    userRoles: ['Director', 'Project Manager', 'Accounts'],
  },
  {
    key: 'materials',
    icon: Boxes,
    title: 'Materials Inventory & Indents',
    desc: 'Track site-wise stock balances, material purchase indents, delivery gate passes, issuances to contractors, and low-stock alerts.',
    fullDesc: 'Never halt site concrete pours due to missing cement or rebar. Site teams create material requisition indents with approval workflows. Record Goods Receipt Notes (GRN) with vendor delivery slips and monitor usage rates against estimated standards.',
    category: 'commercial',
    keyBenefits: ['Site-wise live stock registers for bulk commodities', 'Requisition indents with Project Manager approval gates', 'Gate pass and Goods Receipt Note (GRN) photo verification', 'Material wastage tracking against BOQ theoretical norms'],
    userRoles: ['Site Engineer', 'Project Manager', 'Foreman', 'Accounts'],
  },
  {
    key: 'labour',
    icon: HardHat,
    title: 'Labour & Contractor Management',
    desc: 'Daily labor muster by subcontractor and trade, automated wage calculations, overtime hours, advances, and pending contractor balances.',
    fullDesc: 'Take control of your biggest daily site expenditure. Maintain a single digital register of contractor headcounts, daily wage agreements, overtime rates, and petty advances, ensuring contractor bills match actual muster rolls.',
    category: 'commercial',
    keyBenefits: ['Daily trade-wise muster (Masons, Carpenters, Steel fixers, Helpers)', 'Automated overtime rate calculations based on check-out times', 'Cash advance tracking with deduction logs on final settlement', 'Subcontractor settlement balance summary'],
    userRoles: ['Foreman', 'Site Engineer', 'Project Manager', 'Accounts'],
  },
  {
    key: 'inspections',
    icon: ClipboardCheck,
    title: 'Inspections & Punch Lists',
    desc: 'Structured quality checklists, safety walks, and pre-pour inspection gates where non-compliant items become actionable punch list tasks.',
    fullDesc: 'Ensure rigorous site quality standards. Create standardized inspection checklists for structural rebar, waterproofing, MEP rough-ins, and final architectural finishes. Mark items Pass or Fail with photo evidence and instantly assign rectification tasks to trades.',
    category: 'planning',
    keyBenefits: ['Pre-pour concrete inspection hold points', 'Punch and snag list register with photo annotations', 'Safety violation logs with immediate hazard assignments', 'Comprehensive handover quality audit trails'],
    userRoles: ['Site Engineer', 'Project Manager', 'Director'],
  },
  {
    key: 'timeline',
    icon: GanttChart,
    title: 'Gantt Timeline & Milestones',
    desc: 'Interactive visual project schedules showing task dependencies, critical paths, completion percentages, and milestone targets.',
    fullDesc: 'Visualize site schedules without clumsy desktop software. Spot cascading delays before they derail handover dates, identify dependencies between civil trades, and adjust project timelines with intuitive click-and-drag controls.',
    category: 'planning',
    keyBenefits: ['Visual Gantt timeline with multi-phase grouping', 'Key milestone tracking with countdown alerts', 'Color-coded task health indicators (On Track, At Risk, Delayed)', 'Site-by-site comparative progress overview'],
    userRoles: ['Project Manager', 'Director', 'Site Engineer'],
  },
  {
    key: 'projects',
    icon: FolderKanban,
    title: 'Multi-Site Project Hub',
    desc: 'Centralized directory for all active, upcoming, and completed project sites with geofence settings, client profiles, and assigned crews.',
    fullDesc: 'Keep every project organized in one clean repository. Set project coordinates, assign project managers and site engineers, manage budgets, and monitor overall health metrics across multiple concurrent locations.',
    category: 'planning',
    keyBenefits: ['Unified multi-site status overview for executives', 'Individual project geofence radius configuration', 'Role assignment matrix per site', 'Health scorecards based on attendance and task velocity'],
    userRoles: ['Director', 'Admin', 'Project Manager'],
  },
  {
    key: 'documents',
    icon: FileText,
    title: 'Blueprints & Document Control',
    desc: 'Secure cloud storage for structural drawings, architectural plans, BOQs, permits, and inspection reports accessible directly on site.',
    fullDesc: 'Eliminate expensive mistakes caused by site teams working off obsolete paper revisions. Upload CAD exports and PDF blueprints with version numbers, set approval statuses, and let engineers zoom in on drawings right from tablets or smartphones.',
    category: 'planning',
    keyBenefits: ['Approved revision indicator so site teams only build off final drawings', 'Fast mobile PDF viewer optimized for high-resolution blueprints', 'Categorized folders for Architectural, Structural, MEP, and Permits', 'Encrypted cloud storage with permission controls'],
    userRoles: ['Project Manager', 'Site Engineer', 'Admin', 'Director'],
  },
  {
    key: 'chat',
    icon: MessageSquare,
    title: 'Site Channels & Team Chat',
    desc: 'Structured site-specific channels, direct messages, and broadcasting with @Role mentions that keep discussions out of personal WhatsApp.',
    fullDesc: 'Bring order to project communications. Automatically provision channels for each active site, broadcast announcements to the entire company, and use intelligent role mentions like @SiteEngineer or @Accounts to notify all relevant team members simultaneously.',
    category: 'field',
    keyBenefits: ['Dedicated channels auto-created for every project site', 'Intelligent @Role tagging to alert job titles simultaneously', 'Direct 1-on-1 messaging for private coordination', 'Share live tasks and document links directly in chat bubbles'],
    userRoles: ['Director', 'Admin', 'Project Manager', 'Site Engineer', 'Foreman', 'Accounts'],
  },
  {
    key: 'expenses',
    icon: Receipt,
    title: 'Site Expenses & Petty Cash',
    desc: 'Mobile expense claims for site purchases, fuel, and transport with bill photo uploads and multi-level approval workflows.',
    fullDesc: 'Stop losing receipts and waiting weeks to reconcile site petty cash. Engineers snap photos of physical bills at local hardware vendors, specify the project and expense category, and submit for instant manager review.',
    category: 'commercial',
    keyBenefits: ['Instant receipt photo capture from phone camera', 'Project-wise petty cash balance reconciliation', 'Categorization by Fuel, Hardware, Transport, and Miscellaneous', 'Manager approval workflow before accounts disbursement'],
    userRoles: ['Site Engineer', 'Foreman', 'Project Manager', 'Accounts'],
  },
  {
    key: 'assets',
    icon: Truck,
    title: 'Plant & Equipment Tracking',
    desc: 'Machinery register for cranes, excavators, generators, and testing tools with site allocation history and maintenance records.',
    fullDesc: 'Track your capital machinery across jobsites. Know exactly which site currently holds specific tools or heavy vehicles, record service dates and maintenance costs, and prevent equipment from sitting idle when needed elsewhere.',
    category: 'planning',
    keyBenefits: ['Status tracking: Available, In Use, Under Maintenance, Retired', 'Site allocation history and custody handover logs', 'Preventive maintenance schedule and repair expense logging', 'Straight-line equipment depreciation and valuation calculations'],
    userRoles: ['Project Manager', 'Admin', 'Director', 'Site Engineer'],
  },
  {
    key: 'performance',
    icon: Award,
    title: 'Performance & OPI Engine',
    desc: 'Objective employee performance index calculated from on-time task delivery, attendance reliability, and quality approvals.',
    fullDesc: 'Eliminate bias in annual appraisals. Task Pilot automatically aggregates individual and crew metrics into a normalized Overall Performance Index (OPI), recognizing punctual staff and providing constructive visibility into delays.',
    category: 'admin',
    keyBenefits: ['Automated score calculation based on verified site execution', 'On-time streak recognition and milestone achievements', 'Crew velocity comparison across different site postings', 'Transparent merit-based metrics for incentives and bonuses'],
    userRoles: ['Director', 'Admin', 'Project Manager'],
  },
  {
    key: 'leave',
    icon: CalendarDays,
    title: 'Leave & Absence Management',
    desc: 'Simple leave applications, balance tracking, and approval queues that automatically update daily attendance expectations.',
    fullDesc: 'Replace paper leave letters with transparent digital requests. Employees view their remaining annual, casual, and sick leave balances, submit requests with reasons, and managers approve or decline in seconds.',
    category: 'admin',
    keyBenefits: ['Self-serve balance tracking for all staff members', 'Notification alerts sent immediately to reporting managers', 'Automatic sync with daily site attendance rosters', 'Annual leave quota configuration by role'],
    userRoles: ['All Roles'],
  },
  {
    key: 'salary',
    icon: Wallet,
    title: 'Salary Slips & Payroll Records',
    desc: 'Generate, preview, print, and distribute monthly salary slips with earnings, deductions, and tax calculations for your staff.',
    fullDesc: 'Streamline month-end payroll for your corporate staff and salaried engineers. Set up basic pay, allowances, and statutory deductions, review monthly attendance logs, and generate clean payslips in one unified workflow.',
    category: 'commercial',
    keyBenefits: ['Configurable earnings and deductions breakdown', 'Integrated attendance and overtime reference data', 'Clean, professional printable PDF payslip format', 'Tenant-branded company letterhead styling'],
    userRoles: ['Accounts', 'Admin', 'Director'],
  },
  {
    key: 'roles',
    icon: ShieldCheck,
    title: '8-Tier Role Permissions',
    desc: 'Pre-configured construction hierarchy (Director, Admin, PM, Site Engineer, Foreman, Labour, Accounts, Client View-Only).',
    fullDesc: 'Enforce strict principle-of-least-privilege access across your organization. Site workers only see their assigned tasks and attendance, engineers access their active projects, and financial totals remain visible only to directors and accounts.',
    category: 'admin',
    keyBenefits: ['Tailored specifically for construction and contracting teams', 'Field workers have simple, uncluttered interfaces', 'Commercial rates and tender margins protected from general view', 'Client view-only portal for investor transparency'],
    userRoles: ['Admin', 'Director'],
  },
  {
    key: 'reports',
    icon: BarChart3,
    title: 'Executive Reports & Analytics',
    desc: 'High-level operational dashboards for directors and formatted Excel/PDF data exports for accounts and client meetings.',
    fullDesc: 'Get instant answers without calling five project managers. Review multi-site attendance percentages, task completion rates, open snag lists, and expense burn rates in real time on the web console.',
    category: 'commercial',
    keyBenefits: ['Multi-project executive summary dashboard', 'Filterable reports by date range, project, or trade', 'One-click exports compatible with Excel and Google Sheets', 'Historical audit trail for corporate compliance'],
    userRoles: ['Director', 'Admin', 'Project Manager', 'Accounts'],
  },
  {
    key: 'mobile',
    icon: Smartphone,
    title: 'Mobile-First Field Apps',
    desc: 'Responsive web and native mobile apps designed specifically for site conditions: large tap targets, offline sync, and fast photo capture.',
    fullDesc: 'Software is useless if site engineers refuse to use it. Task Pilot was designed directly with site personnel: intuitive navigation, offline resilience when basement cell service drops, and rapid 1-tap actions.',
    category: 'field',
    keyBenefits: ['Available on Android, iOS, and modern mobile browsers', 'Optimized for high-glare outdoor jobsite conditions', 'Automatic image compression for 3G/4G site data networks', 'Local cache saves updates even during temporary signal loss'],
    userRoles: ['All Roles'],
  },
  {
    key: 'notifications',
    icon: Bell,
    title: 'Smart Push & In-App Alerts',
    desc: 'Instant notifications for task assignments, inspection sign-offs, overdue milestones, material requests, and company announcements.',
    fullDesc: 'Keep teams synchronized across distance. When a task is marked for review or a concrete pour inspection is scheduled, the designated engineer or manager receives an immediate push notification with sound and vibration.',
    category: 'field',
    keyBenefits: ['Targeted alerts for assigned tasks and urgent deadlines', 'Instant push notifications for manager verification requests', 'Company-wide directive broadcasts from leadership', 'Customizable notification preferences per user'],
    userRoles: ['All Roles'],
  },
  {
    key: 'team',
    icon: Users,
    title: 'Multi-Tenant Workspace Isolation',
    desc: 'Dedicated organization workspace with custom branding, secure database partitioning, and team member management.',
    fullDesc: 'Every company operating on Task Pilot receives a private, isolated workspace. Your project data, client lists, vendor agreements, and custom rates are cryptographically walled off from all other organizations.',
    category: 'admin',
    keyBenefits: ['Row-level multi-tenant database partitioning', 'Encrypted file storage for drawings and proprietary contracts', 'Seamless member onboarding via email invites', 'Single flat-rate organization billing'],
    userRoles: ['Admin', 'Director'],
  },
];

export interface IndustryData {
  slug: string;
  icon: LucideIcon;
  name: string;
  headline: string;
  summary: string;
  pains: string[];
  gains: string[];
  keyWorkflows: { title: string; desc: string }[];
  dailyRoutine: { time: string; title: string; desc: string }[];
  standardChecklists: string[];
}

export const INDUSTRIES: IndustryData[] = [
  {
    slug: 'construction',
    icon: HardHat,
    name: 'General Contractors & Civil Builders',
    headline: 'Run every construction site from one unified screen',
    summary: 'General contracting involves coordinating hundreds of skilled trades, managing tight pouring schedules, monitoring material drops, and maintaining rigorous safety records across multiple projects. Task Pilot connects your field supervisors with the head office in real time.',
    pains: [
      'Site progress updates buried in unsearchable WhatsApp group chats',
      'No tamper-proof record of contractor headcounts or daily attendance',
      'Subcontractor cost overruns discovered only at the monthly bill review',
      'Structural inspections missed because checklists were kept on paper',
    ],
    gains: [
      'Automated daily progress reports (DPR) with verified site photos and weather notes',
      'Geofenced attendance confirming who actually reported to each site',
      'Earned value BOQ tracking linking executed physical quantities to costs',
      'Mandatory pre-pour and structural inspection checklists with engineer sign-offs',
    ],
    keyWorkflows: [
      {
        title: 'Pre-Pour Concrete Inspection Gates',
        desc: 'Before any concrete pour begins, the site engineer conducts a digital checklist verifying shuttering alignment, rebar spacing, and cover blocks, attaching photo evidence before the project manager digitally clears the pour.',
      },
      {
        title: 'Daily Trade Muster & Subcontractor Overtime',
        desc: 'Supervisors log trade-wise headcounts (masons, barbenders, helpers) each morning. Task Pilot validates hours and overtime automatically, eliminating end-of-month invoice disputes with labor subcontractors.',
      },
      {
        title: 'Material Gate Passes & Requisitions',
        desc: 'Track bulk commodities like cement and TMT steel from indent to gate delivery slip, maintaining a real-time running stock register for every active jobsite.',
      },
    ],
    dailyRoutine: [
      { time: '08:00 AM', title: 'Shift Check-In & Toolbox Talk', desc: 'Crew punches in via geofenced mobile app. Supervisor logs safety briefing and daily trade counts.' },
      { time: '01:00 PM', title: 'Midday Milestones & Inspection Sign-Offs', desc: 'Engineers inspect completed subtasks, upload rebar photos, and sign off on quality gates.' },
      { time: '05:30 PM', title: 'DPR Submission & Overtime Logs', desc: 'Foreman compiles weather, completed quantities, and photos into DPR. Project director sees multi-site pulse in office.' },
    ],
    standardChecklists: [
      'Reinforcement & Shuttering Pre-Pour Checklist',
      'Scaffolding & Work-at-Height Safety Audit',
      'Incoming Material Quality Inspection (Cement/Steel/Aggregates)',
      'Subcontractor Daily Muster Verification',
    ],
  },
  {
    slug: 'real-estate',
    icon: Building2,
    name: 'Real Estate Developers',
    headline: 'Executive-level portfolio visibility across every project development',
    summary: 'Real estate developers must oversee multiple concurrent projects, manage diverse turnkey contractors, and ensure promised delivery milestones are achieved on time and within budget. Task Pilot provides the executive control center necessary for developer boards.',
    pains: [
      'Reliance on subjective phone updates from contractors with no physical proof',
      'Uncontrolled change orders and material variations inflating total project cost',
      'Inability to provide institutional investors and homebuyers with verifiable milestone progress',
      'Fragmented project documents and delayed handover snags',
    ],
    gains: [
      'Executive dashboard summarizing progress, financial health, and risks across all sites',
      'Variance tracking alerting leadership to budget drifts before expenses are committed',
      'Exportable progress packs suitable for RERA compliance, bank audits, and investor reports',
      'Systematic snagging and pre-handover audit tracking for flawless unit deliveries',
    ],
    keyWorkflows: [
      {
        title: 'Portfolio Multi-Site Health Scorecards',
        desc: 'Compare task completion velocity, worker attendance rates, and budget consumption across all ongoing residential or commercial developments.',
      },
      {
        title: 'Earned Value Management & Cashflow Forecasting',
        desc: 'Track planned versus earned value against cumulative actual expenditures to ensure developer capital matches physical construction progress.',
      },
      {
        title: 'Handover Quality Auditing',
        desc: 'Conduct thorough flat-by-flat and zone-by-zone snag audits, assigning defect rectifications to respective contractors with photographic evidence.',
      },
    ],
    dailyRoutine: [
      { time: '09:00 AM', title: 'Executive Portfolio Review', desc: 'Leadership reviews overall attendance and flags any delayed critical path milestones.' },
      { time: '02:00 PM', title: 'Contractor Payment Certification', desc: 'Verify contractor billing claims against digitally approved site quantities and milestone sign-offs.' },
      { time: '06:00 PM', title: 'Automated Daily Executive Summary', desc: 'Receive aggregated DPR digest showing work executed across all residential towers.' },
    ],
    standardChecklists: [
      'Pre-Handover Unit Snag List (Civil, Electrical, Plumbing, Joinery)',
      'Contractor Milestone Completion Verification',
      'RERA Milestone Documentation Check',
      'Safety and Environmental Compliance Audit',
    ],
  },
  {
    slug: 'interiors',
    icon: Paintbrush,
    name: 'Interior & Fit-Out Contractors',
    headline: 'Fast-moving commercial and residential fit-outs with zero dropped details',
    summary: 'Interior fit-out projects move rapidly with dozens of small, highly specialized trades (carpentry, electrical, HVAC, tiling, painting) working concurrently in tight spaces. Task Pilot gives fit-out teams granular checklist management and instant defect rectification.',
    pains: [
      'Critical architectural design revisions lost between office designers and site carpenters',
      'Minor punch items and client snags lingering for weeks, delaying final payment release',
      'Dozens of small petty cash purchases and material runs that are difficult to reconcile',
      'Difficulty coordinating overlapping trades in restricted commercial tenancies',
    ],
    gains: [
      'Centralized drawing repository ensuring site carpenters always view the latest approved rev',
      'Instant mobile snagging where defect photos are tagged with room number and trade owner',
      'Mobile expense logging with camera receipt capture for rapid petty cash reconciliation',
      'Subtask checklists enforcing quality standards for carpentry, polishing, and glass installation',
    ],
    keyWorkflows: [
      {
        title: 'Rapid Room-by-Room Punch Listing',
        desc: 'Walk commercial tenancies with a phone or tablet, pin snag items directly to room numbers, specify the contractor responsible, and track real-time resolution.',
      },
      {
        title: 'Blueprint Revision Control on Site',
        desc: 'Ensure site supervisors and MEP contractors are never working off outdated floorplans or reflected ceiling plans (RCP).',
      },
      {
        title: 'Fast-Track Procurement Approvals',
        desc: 'Approve specialty material indents (laminates, fixtures, custom hardware) with attached vendor quotes before procurement.',
      },
    ],
    dailyRoutine: [
      { time: '08:30 AM', title: 'Trade Task Allocation', desc: 'Assign specific subtasks to electricians, drywallers, and painters with reference drawings.' },
      { time: '01:30 PM', title: 'Snag Verification Walk', desc: 'Inspect rectified items from previous punch lists and sign off with before-and-after photos.' },
      { time: '06:00 PM', title: 'Daily Fit-out Progress Update', desc: 'Log zone completion percentages and submit material receipts for accounts reimbursement.' },
    ],
    standardChecklists: [
      'MEP First-Fix & Concealed Conduit Quality Check',
      'Drywall Partitioning & Acoustic Insulation Inspection',
      'Carpentry & Joinery Dimensional Accuracy Check',
      'Final Architectural Snagging & Cleaning Checklist',
    ],
  },
  {
    slug: 'infrastructure',
    icon: Route,
    name: 'Infrastructure & EPC Contractors',
    headline: 'Discipline and compliance at scale for roads, bridges, and utilities',
    summary: 'Linear and heavy infrastructure projects stretch across kilometers with dispersed crews, expensive plant machinery, and stringent government compliance requirements. Task Pilot provides location-aware coordination and heavy machinery tracking across remote zones.',
    pains: [
      'Supervising dispersed teams spread across remote chainages or road packages',
      'Heavy machinery (excavators, rollers, transit mixers) sitting idle or untracked',
      'Paper-based compliance records lost or damaged in challenging outdoor environments',
      'Delays in reporting material test results and soil stabilization milestones',
    ],
    gains: [
      'Multi-site geofencing tracking attendance across distinct chainages and base camps',
      'Asset management logging equipment utilization hours, breakdowns, and maintenance',
      'Standardized digital DPRs recording earthwork quantities, compaction tests, and weather',
      'Immutable audit trails meeting state and national highway authority documentation standards',
    ],
    keyWorkflows: [
      {
        title: 'Chainage-Wise Earthwork & Paving Logs',
        desc: 'Log physical progress by chainage or bridge pier, linking daily volume measurements to project milestones and BOQ billing items.',
      },
      {
        title: 'Heavy Equipment Maintenance & Allocation',
        desc: 'Monitor equipment operational status, log running hours, schedule periodic servicing, and allocate excavators and pavers to active packages.',
      },
      {
        title: 'Environmental & Safety Compliance',
        desc: 'Maintain digital records of traffic management setups, PPE compliance, and soil testing certifications.',
      },
    ],
    dailyRoutine: [
      { time: '07:30 AM', title: 'Site Muster & Machinery Allocation', desc: 'Log operator check-ins and verify plant machinery readiness across work fronts.' },
      { time: '12:00 PM', title: 'Material Delivery & Lab Testing', desc: 'Record asphalt/concrete mix temperatures, slump tests, and batching plant delivery slips.' },
      { time: '05:00 PM', title: 'Sectional Progress & DPR Submission', desc: 'Compile executed chainage length, earthwork volumes, and equipment running hours.' },
    ],
    standardChecklists: [
      'Subgrade Compaction & Field Dry Density (FDD) Test Log',
      'Asphalt / Concrete Paving Quality Inspection',
      'Heavy Plant Pre-Operation Safety Checklist',
      'Traffic Diversion & Site Barricading Safety Inspection',
    ],
  },
  {
    slug: 'facility-management',
    icon: Wrench,
    name: 'Facility Management & Operations',
    headline: 'Preventive maintenance, service ticketing, and asset longevity',
    summary: 'Facility managers handle recurring preventive maintenance schedules, urgent corrective repair tickets, vendor contracts, and asset lifecycle tracking across commercial towers and campuses. Task Pilot provides the structured workflow needed to guarantee SLAs.',
    pains: [
      'Technicians spread across buildings with no proof that preventive tasks were performed',
      'Tenant service complaints lost in verbal handovers or handwritten logbooks',
      'Lack of historical maintenance records leading to premature equipment breakdown',
      'Difficulty verifying vendor technician timesheets and SLA compliance',
    ],
    gains: [
      'Automatic recurring task generation for HVAC, DG sets, elevators, and fire systems',
      'Photo evidence and digital sign-offs required before maintenance tickets can close',
      'Complete asset lifecycle logs tracking every repair, part replacement, and service cost',
      'Technician performance tracking scoring response times and first-time resolution rates',
    ],
    keyWorkflows: [
      {
        title: 'Scheduled Preventive Maintenance (PPM)',
        desc: 'Automate weekly, monthly, and quarterly maintenance checklists for chillers, fire suppression systems, transformers, and water treatment plants.',
      },
      {
        title: 'Tenant Service Ticket Resolution',
        desc: 'Route maintenance requests to appropriate trade technicians, track time-to-completion, and require tenant sign-off before closing.',
      },
      {
        title: 'Asset History & Breakdown Analysis',
        desc: 'Maintain complete digital service histories for every critical facility asset to make informed repair-versus-replace decisions.',
      },
    ],
    dailyRoutine: [
      { time: '08:00 AM', title: 'Shift Handover & Critical Equipment Rounds', desc: 'Morning team logs round readings for DG sets, chillers, and water levels.' },
      { time: '01:00 PM', title: 'Preventive Task Execution', desc: 'Technicians complete scheduled maintenance checklists and upload verification photos.' },
      { time: '06:00 PM', title: 'Ticket Closure & SLA Reporting', desc: 'Review resolved complaints, verify pending spare parts, and generate daily operations log.' },
    ],
    standardChecklists: [
      'Daily DG Set & Electrical Substation Rounds',
      'HVAC Chiller & AHU Routine Inspection',
      'Fire Fighting & Alarm System Functional Test',
      'Plumbing, Water Tank & STP Water Quality Check',
    ],
  },
  {
    slug: 'project-management',
    icon: Briefcase,
    name: 'PMC & Engineering Consultants',
    headline: 'Coordinate owners, contractors, and design consultants with total transparency',
    summary: 'Project Management Consultancies (PMC) act as independent guardians of project schedule, cost, and quality. They need objective, dispute-free records of contractor progress, delay notifications, and design clarifications. Task Pilot is the PMC audit powerhouse.',
    pains: [
      'Spending days compiling weekly client presentation decks from raw field data',
      'Ambiguity over contractor delays leading to disputes over time extensions',
      'Disorganized drawing review cycles causing design consultant bottlenecks',
      'Tracking multiple independent contractors across different software tools',
    ],
    gains: [
      'Client-ready DPRs and milestone dashboards accessible in real time',
      'Comprehensive chronological audit trail documenting every inspection and delay reason',
      'Centralized drawing review workflow marking architectural plans Approved or Under Review',
      'Single standardized operating system deployed across all contractors on the project',
    ],
    keyWorkflows: [
      {
        title: 'Independent Quality & Compliance Auditing',
        desc: 'PMC engineers conduct non-negotiable quality hold-point inspections, issuing digital non-conformance reports (NCR) with photographic proof.',
      },
      {
        title: 'Delay Causation & Variation Documentation',
        desc: 'Maintain immutable timestamped logs of client decisions, weather delays, and contractor shortfalls for fair contract administration.',
      },
      {
        title: 'Executive Client Progress Packs',
        desc: 'Provide project sponsors and institutional investors with live view-only access or automated weekly milestone completion digests.',
      },
    ],
    dailyRoutine: [
      { time: '08:30 AM', title: 'Multi-Contractor Morning Coordination', desc: 'Review contractor headcounts and active zones on the multi-site map.' },
      { time: '02:00 PM', title: 'Joint Quality Inspections', desc: 'Conduct pre-pour structural checks alongside contractor engineers and sign off in-app.' },
      { time: '05:30 PM', title: 'Daily Master Summary Generation', desc: 'Review and approve contractor DPR submissions to publish the consolidated PMC daily report.' },
    ],
    standardChecklists: [
      'PMC Quality Hold Point Inspection Sign-Off',
      'Non-Conformance Report (NCR) & Corrective Action Verification',
      'Contractor Bill Quantity Verification Sheet',
      'Health, Safety & Environmental (HSE) Weekly Audit',
    ],
  },
];

export const COMPARISON: { row: string; tp: string | boolean; global: string | boolean; generic: string | boolean; manual: string | boolean }[] = [
  { row: 'Built specifically for construction & field sites', tp: true, global: true, generic: false, manual: false },
  { row: 'GPS geofenced attendance & daily site diary (DPR)', tp: true, global: 'Add-on ($$)', generic: false, manual: false },
  { row: 'Mobile app for field engineers & supervisors', tp: true, global: true, generic: true, manual: 'WhatsApp' },
  { row: 'BOQ import, earned value (EV) & CPI tracking', tp: true, global: true, generic: false, manual: 'Spreadsheets' },
  { row: 'Materials inventory, indents & stock registers', tp: true, global: 'Add-on ($$)', generic: false, manual: 'Registers' },
  { row: 'Pre-pour checklists, inspections & punch lists', tp: true, global: true, generic: false, manual: false },
  { row: 'Interactive Gantt timeline & milestone dependencies', tp: true, global: true, generic: 'Partial', manual: false },
  { row: 'Petty cash expenses, leave & salary slips', tp: true, global: false, generic: false, manual: 'Spreadsheets' },
  { row: 'Pricing in INR with GST input tax invoices', tp: true, global: false, generic: 'Partial', manual: true },
  { row: 'Flat predictable team pricing (not per-seat)', tp: true, global: false, generic: false, manual: true },
  { row: 'Self-serve setup in under 10 minutes', tp: true, global: false, generic: true, manual: true },
  { row: 'Full 14-day free trial without credit card', tp: true, global: false, generic: true, manual: true },
];

export const FAQS = [
  {
    q: 'Do I need a credit card to start the 14-day free trial?',
    a: 'No credit card or payment information is required. You get full access to all modules in your selected plan tier immediately upon signing up so you can test Task Pilot on your live project sites.',
  },
  {
    q: 'How does billing and invoicing work?',
    a: 'Subscriptions are billed monthly or annually in INR through Razorpay. We support UPI AutoPay, credit/debit cards, and netbanking e-mandates. All prices include 18% GST, and tax invoices are automatically generated with your company GSTIN for full input tax credit.',
  },
  {
    q: 'Why do you charge flat team pricing instead of per-user seats?',
    a: 'Per-seat pricing discourages construction firms from adding site engineers, foremen, and supervisors, resulting in communication gaps and offline data silos. With Task Pilot, your plan includes a generous bundle of team members for one predictable flat monthly fee.',
  },
  {
    q: 'Can our site teams use Task Pilot on their existing smartphones?',
    a: 'Yes. Task Pilot runs as a high-performance progressive web app and native mobile application on both Android and iOS devices. It is optimized for low-bandwidth 3G/4G connectivity, supports camera photo capture, and caches data locally.',
  },
  {
    q: 'How does GPS attendance prevent fake check-ins?',
    a: 'When an employee taps Check In or Check Out, their device captures point-in-time GPS coordinates. Task Pilot verifies that these coordinates fall within the custom geofence perimeter configured for that project site. Location is never tracked continuously in the background, protecting employee battery and privacy.',
  },
  {
    q: 'Can we import our existing project data, BOQs, and staff lists?',
    a: 'Yes. You can import Bill of Quantities (BOQ) line items directly from standard Excel templates. For Business and Enterprise customers, our solutions engineering team provides complimentary onboarding assistance to migrate your ongoing projects and team rosters within 24 to 48 hours.',
  },
  {
    q: 'Is our project data, drawings, and rates kept secure and private?',
    a: 'Absolutely. Every company workspace operates inside a strictly isolated, tenant-partitioned database environment. Drawings, tenders, contractor rates, and financial reports are protected by 256-bit AES encryption at rest and in transit.',
  },
  {
    q: 'What happens if we decide to change plans or cancel?',
    a: 'You can upgrade your plan at any time with immediate effect. If you cancel, your workspace remains fully functional until the end of your prepaid billing period, after which it enters a read-only archive state so you can export your records at any time.',
  },
];

export const PRICING_NOTE = 'Prices in INR, inclusive of 18% GST. Billed securely via Razorpay with tax invoices.';
