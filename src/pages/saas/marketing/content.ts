import {
  CheckSquare, FolderKanban, MapPin, BookOpen, FileText, MessageSquare, Receipt, CalendarDays,
  Truck, BarChart3, Award, Wallet, ShieldCheck, Smartphone, Bell, Users,
  HardHat, Building2, Paintbrush, Route, Wrench, Briefcase,
} from 'lucide-react';

export const FEATURES = [
  { key: 'tasks', icon: CheckSquare, title: 'Tasks, approvals & subtasks', desc: 'Assign work to people or whole roles, set priorities and due dates, attach photos, and require sign-off before a task is closed.' },
  { key: 'projects', icon: FolderKanban, title: 'Projects & sites', desc: 'Every site in one place — budget, health, progress, members, documents and the full task history.' },
  { key: 'attendance', icon: MapPin, title: 'GPS attendance', desc: 'Geo-fenced check-in and check-out from the phone, with live attendance dashboards for the office.' },
  { key: 'site_diary', icon: BookOpen, title: 'Daily site diary (DPR)', desc: 'Daily progress reports with manpower, weather, work done and photos — exportable for clients.' },
  { key: 'documents', icon: FileText, title: 'Drawings & documents', desc: 'Upload drawings, BOQs and contracts, approve revisions and view PDFs right on site.' },
  { key: 'chat', icon: MessageSquare, title: 'Project chat', desc: 'Site channels, direct messages and company announcements — keep decisions out of personal WhatsApp.' },
  { key: 'expenses', icon: Receipt, title: 'Purchase & expenses', desc: 'Site expenses and purchase requests with bills, approvals and project-wise spend.' },
  { key: 'assets', icon: Truck, title: 'Equipment & assets', desc: 'Register machinery and tools, allocate them to sites and track maintenance.' },
  { key: 'leave', icon: CalendarDays, title: 'Leave management', desc: 'Leave requests, balances and approvals without paperwork.' },
  { key: 'reports', icon: BarChart3, title: 'Reports & exports', desc: 'Dashboards for owners and Excel exports for accounts.' },
  { key: 'performance', icon: Award, title: 'Performance & points', desc: 'Automatic scoring from on-time delivery, attendance and quality — fair, visible, motivating.' },
  { key: 'salary', icon: Wallet, title: 'Salary slips', desc: 'Generate and share monthly salary slips with every employee.' },
  { key: 'roles', icon: ShieldCheck, title: 'Roles & permissions', desc: 'Directors, PMs, engineers, supervisors, workers and clients — each sees exactly what they should.' },
  { key: 'mobile', icon: Smartphone, title: 'Built for the field', desc: 'Android & iOS apps designed for site teams, with photo capture and push notifications.' },
  { key: 'notifications', icon: Bell, title: 'Smart notifications', desc: 'Push and in-app alerts for assignments, approvals, deadlines and announcements.' },
  { key: 'team', icon: Users, title: 'Multi-company ready', desc: 'Every company gets its own isolated workspace, branding and team — no separate installs.' },
];

export const INDUSTRIES = [
  { slug: 'construction', icon: HardHat, name: 'Building contractors', headline: 'Run every site from one screen',
    pains: ['Site updates scattered across WhatsApp groups', 'No reliable record of who was on site', 'Delays discovered only at the monthly review'],
    gains: ['Daily site diaries with photos from every site', 'GPS attendance for staff and supervisors', 'Task approvals so nothing is "done" until it\'s checked'] },
  { slug: 'real-estate', icon: Building2, name: 'Real-estate developers', headline: 'Owner-level visibility across every project',
    pains: ['Multiple contractors, no single source of truth', 'Budget overruns spotted too late', 'Buyers asking for progress you can\'t show'],
    gains: ['Project health and progress on one dashboard', 'Expense tracking per project', 'Client (view-only) access for stakeholders'] },
  { slug: 'interiors', icon: Paintbrush, name: 'Interior & fit-out firms', headline: 'Fast-moving jobs, zero dropped details',
    pains: ['Dozens of small tasks per site', 'Design changes lost between office and site', 'Material purchases hard to reconcile'],
    gains: ['Checklists as subtasks with photo proof', 'Drawings shared and approved in-app', 'Purchase requests with bill uploads'] },
  { slug: 'infrastructure', icon: Route, name: 'Infrastructure & EPC', headline: 'Discipline at scale for linear and heavy projects',
    pains: ['Large crews across remote locations', 'Equipment idle or untracked', 'Compliance records on paper'],
    gains: ['Geo-fenced attendance per site', 'Equipment allocation and maintenance logs', 'Full audit trail for every change'] },
  { slug: 'facility-management', icon: Wrench, name: 'Facility & maintenance', headline: 'Recurring work, done and proven',
    pains: ['Technicians spread across buildings', 'No proof that work was completed', 'Complaints tracked in notebooks'],
    gains: ['Tasks routed to roles automatically', 'Photo evidence and sign-off', 'Performance scoring for every technician'] },
  { slug: 'project-management', icon: Briefcase, name: 'PMC & consultants', headline: 'Coordinate clients, contractors and your team',
    pains: ['Reporting to clients takes days', 'Contractor accountability is unclear', 'Too many tools for one project'],
    gains: ['DPRs and reports ready to share', 'Role-based access for contractors and clients', 'One workspace per client project portfolio'] },
];

/** Comparison is by category of tool, not named vendors. */
export const COMPARISON: { row: string; tp: string | boolean; global: string | boolean; generic: string | boolean; manual: string | boolean }[] = [
  { row: 'Built for construction sites', tp: true, global: true, generic: false, manual: false },
  { row: 'GPS attendance & site diary', tp: true, global: 'Add-on', generic: false, manual: false },
  { row: 'Mobile app for field staff', tp: true, global: true, generic: true, manual: 'WhatsApp' },
  { row: 'Expenses, leave & salary slips', tp: true, global: false, generic: false, manual: 'Spreadsheets' },
  { row: 'Pricing in INR with UPI / cards', tp: true, global: false, generic: 'Some', manual: true },
  { row: 'Flat team pricing (not per seat)', tp: true, global: false, generic: false, manual: true },
  { row: 'Set up in under a day', tp: true, global: false, generic: true, manual: true },
  { row: 'Free trial without a card', tp: true, global: false, generic: true, manual: true },
];

export const FAQS = [
  { q: 'Do I need a credit card to start the trial?', a: 'No. Every plan starts with a 14-day free trial with full features of the plan you pick. Add a payment method only when you decide to continue.' },
  { q: 'How does billing work?', a: 'Plans are billed monthly or yearly in INR through Razorpay. You can pay by UPI AutoPay, debit/credit card or netbanking e-mandate. Prices include GST and you get a GST invoice for every payment.' },
  { q: 'Is the price per user?', a: 'No. Each plan includes a number of team members for one flat price, so adding a site engineer doesn\'t change your bill until you reach the plan limit.' },
  { q: 'Can I change plans later?', a: 'Yes. Upgrades apply immediately; downgrades take effect at the end of the current billing cycle. You can cancel any time from Settings → Billing.' },
  { q: 'Is my company\'s data separate from other companies?', a: 'Yes. Every company gets its own isolated workspace. Data is scoped to your organisation on every request, and only people you invite can join.' },
  { q: 'What happens if my trial ends or a payment fails?', a: 'Nothing is deleted. The workspace becomes read-only until you choose a plan, and failed payments get a grace period with automatic retries.' },
  { q: 'Do you have Android and iOS apps?', a: 'Yes. Field teams use the Task Pilot mobile app for attendance, tasks, site diary, photos and chat, with push notifications.' },
  { q: 'Can you migrate our existing data?', a: 'On Business and Enterprise plans our team helps import projects, team members and open tasks from spreadsheets.' },
];

/**
 * Customer quotes shown on the marketing site. Only add genuine quotes that
 * the customer has approved for publication — the section hides when empty.
 */
export const TESTIMONIALS: { quote: string; name: string; title: string; company: string }[] = [];

export const PRICING_NOTE = 'Prices in INR, inclusive of 18% GST. Billed via Razorpay.';
