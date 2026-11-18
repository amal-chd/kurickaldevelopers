import React, { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowRight, X, Check, ShieldCheck, Smartphone, Database, Lock,
  ChevronRight, Sparkles, CheckCircle2, Layers, HardHat, FileText,
  IndianRupee, MapPin
} from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { FEATURES, INDUSTRIES } from './content';
import { useSeo } from '../../../lib/seo';

const CATEGORIES = [
  { id: 'all', label: 'All Modules (21)' },
  { id: 'field', label: 'Field & Site Ops' },
  { id: 'commercial', label: 'BOQ & Commercials' },
  { id: 'planning', label: 'Planning & Quality' },
  { id: 'admin', label: 'HR, Team & Security' },
];

const CATEGORY_MAP: Record<string, string[]> = {
  field: ['tasks', 'attendance', 'site_diary', 'mobile', 'notifications', 'chat'],
  commercial: ['boq', 'materials', 'labour', 'expenses', 'salary', 'reports'],
  planning: ['projects', 'documents', 'timeline', 'inspections', 'assets'],
  admin: ['roles', 'team', 'leave', 'performance'],
};

export const FeaturesPage: React.FC = () => {
  useSeo({
    title: 'Task Pilot Features — Complete Construction Operating System',
    description: 'Every module construction teams need: tasks & sign-offs, GPS attendance, daily site diary (DPR), BOQ & cost control, materials, labour, inspections, Gantt timeline, drawings and chat.',
    path: '/features',
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFeatures = activeCategory === 'all'
    ? FEATURES
    : FEATURES.filter((f) => CATEGORY_MAP[activeCategory]?.includes(f.key));

  return (
    <MarketingLayout>
      {/* ─── Hero ─── */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 pt-16 pb-12 border-b border-slate-100">
        <Section className="text-center max-w-3xl mx-auto">
          <Eyebrow>Full Modular Suite</Eyebrow>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Everything your construction sites run on
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Turn on only the modules you need today. Every company gets its own private, isolated workspace,
            with 8 role tiers pre-configured for construction operations.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── 4 Flagship Deep-Dives ─── */}
      <Section className="py-16">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-500/5 via-white to-white p-8 relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-5 font-bold shadow-md">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-full">
              Field Core
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">Tamper-Proof GPS Attendance</h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Eliminate buddy punching and proxy check-ins. Site engineers, supervisors, and labor check in directly through the mobile app.
              Coordinates are validated within a customizable geofence radius around your project site.
            </p>
            <ul className="mt-4 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Geofence perimeter lock with spoof prevention</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Live attendance counter on head office dashboard</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1-click Excel export formatted for payroll</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-500/5 via-white to-white p-8 relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center mb-5 font-bold shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-full">
              Reporting Core
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">Daily Site Diary (DPR)</h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Standardize daily progress reporting across every contractor. Log weather, trade-wise manpower counts, equipment active/idle hours,
              work executed by zone, and timestamped progress photos.
            </p>
            <ul className="mt-4 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed in under 3 minutes on mobile</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automatic time, date, and GPS watermarks on photos</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Client-ready PDF reports generated instantly</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-500/5 via-white to-white p-8 relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-5 font-bold shadow-md">
              <IndianRupee className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-full">
              Financial Core
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">BOQ & Earned Value Cost Control</h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Import your Bill of Quantities directly from Excel. As site engineers log completed quantities, Task Pilot recalculates
              Planned Value (PV), Earned Value (EV), and Actual Cost (AC) from real material receipts and labor wage slips.
            </p>
            <ul className="mt-4 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Real-time Cost Performance Index (CPI) tracking</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Early warning alerts before budget overruns occur</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Subcontractor payment certification support</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-500/5 via-white to-white p-8 relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-5 font-bold shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100/60 px-2.5 py-1 rounded-full">
              Execution Core
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">Enforced Task Sign-Offs & Quality Gates</h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              No task is considered complete until verified. Set rules requiring site engineers or quality inspectors to digitally inspect
              and sign off with photo evidence before rebar is covered or concrete is poured.
            </p>
            <ul className="mt-4 space-y-2 text-xs font-medium text-slate-700">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Strict role-based approval permissions</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Subtask inspection checklists with pass/fail gates</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Complete chronological audit trail for every change</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ─── Filtered Modules Grid ─── */}
      <Section className="pb-20">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            {activeCategory === 'all' ? 'All 21 Built-In Modules' : `Modules in ${CATEGORIES.find((c) => c.id === activeCategory)?.label}`}
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Included in our flat-rate tiers. No hidden per-feature unlock charges.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFeatures.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Enterprise Security & Architecture ─── */}
      <div className="bg-slate-900 text-white py-20 border-t border-slate-800">
        <Section>
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Enterprise Grade</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Data isolation and security you can trust
            </h2>
            <p className="mt-3 text-slate-400 text-sm">
              Your drawings, tender bids, employee data, and contractor rates are confidential. Here is how Task Pilot safeguards them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Database,
                title: 'Strict Multi-Tenancy',
                desc: 'Every organization is partitioned at the database level. Queries enforce tenant verification on every single request.',
              },
              {
                icon: Lock,
                title: 'Granular Role Hierarchy',
                desc: 'Pre-configured roles: Director, Admin, Project Manager, Site Engineer, Foreman, Labour, Accounts, and Client View-Only.',
              },
              {
                icon: Smartphone,
                title: 'Offline Sync Resilience',
                desc: 'Site engineers can record attendance, take DPR photos, and log notes even when basement signals drop.',
              },
              {
                icon: ShieldCheck,
                title: 'Encrypted Cloud Storage',
                desc: 'All PDFs, structural blueprints, and documents are stored with 256-bit AES encryption at rest and in transit.',
              },
            ].map((sec) => (
              <div key={sec.title} className="rounded-2xl bg-white/5 border border-white/10 p-6">
                <sec.icon className="w-8 h-8 text-amber-400 mb-4" />
                <h3 className="font-bold text-white text-base">{sec.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">{sec.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Product Roadmap ─── */}
      <Section className="py-20">
        <div className="rounded-3xl bg-slate-50 border border-slate-200 p-8 sm:p-12">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
              Continuous Innovation
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">On the Task Pilot Roadmap</h2>
            <p className="text-sm text-slate-600 mt-2">
              We ship improvements every week based on feedback from active site supervisors and project directors.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Subcontractor Billing Portal', stage: 'In Development', desc: 'Direct RA bill submissions and measurement verification' },
              { title: 'Drawing Revision Markups', stage: 'In Development', desc: 'Annotate cloud blueprints directly on tablet with site photos' },
              { title: 'Client View-Only Portal', stage: 'Next Up', desc: 'Share curated progress reports with real estate buyers or owners' },
              { title: 'Public REST API & Webhooks', stage: 'Next Up', desc: 'Connect ERPs like SAP and Tally with Task Pilot attendance & expenses' },
              { title: 'Purchase Orders & Vendor Comparison', stage: 'Planned', desc: 'Compare multi-vendor cement and steel quotes before PO issue' },
              { title: 'Bar Bending Schedule (BBS) Logs', stage: 'Planned', desc: 'Calculate cutting and bending steel schedules on site' },
              { title: 'Single Sign-On (SAML / Okta)', stage: 'Planned', desc: 'Enterprise authentication for corporate IT departments' },
              { title: 'AI Daily Site Voice Summary', stage: 'Planned', desc: 'Dictate your site diary notes in English or Malayalam' },
            ].map((item) => (
              <div key={item.title} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.stage === 'In Development' ? 'bg-amber-100 text-amber-800' :
                      item.stage === 'Next Up' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.stage}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Bottom CTA ─── */}
      <Section className="pb-20">
        <div className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Try Task Pilot on your sites today</h2>
            <p className="mt-2 text-slate-300 text-sm">Full 14-day free trial on all plans. No payment details required.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/register"
              className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shrink-0"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact-sales"
              className="h-12 px-6 inline-flex items-center justify-center rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 shrink-0"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
};

export const IndustryPage: React.FC = () => {
  const { slug } = useParams();
  const ind = INDUSTRIES.find((i) => i.slug === slug);
  useSeo({
    title: ind ? `${ind.name} Management Software` : 'Industries',
    description: ind ? `${ind.headline}. ${ind.gains.join('. ')}.` : 'Task Pilot for construction and field teams.',
    path: `/industries/${slug}`,
  });

  if (!ind) return <Navigate to="/features" replace />;
  const Icon = ind.icon;

  return (
    <MarketingLayout>
      <div className="bg-slate-900 text-white py-16 md:py-24 border-b border-slate-800">
        <Section>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Icon className="w-4 h-4" />
            <span>Sector Solution: {ind.name}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl leading-tight">
            {ind.headline}
          </h1>
          <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Eliminate operational blindspots between your job sites and head office. Task Pilot gives {ind.name.toLowerCase()} the tools to track every rupee, task, and team member.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="h-12 px-7 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20"
            >
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact-sales"
              className="h-12 px-6 inline-flex items-center rounded-xl border border-white/30 font-semibold hover:bg-white/10"
            >
              Schedule a tailored demo
            </Link>
          </div>
        </Section>
      </div>

      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>The Shift</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            How Task Pilot changes your day-to-day operations
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm uppercase tracking-wider mb-4">
                <X className="w-5 h-5 text-rose-600" />
                The Current Reality (Without Task Pilot)
              </div>
              <ul className="space-y-4 text-slate-700 text-sm">
                {ind.pains.map((p) => (
                  <li key={p} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/30 p-8 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm uppercase tracking-wider mb-4">
                <Check className="w-5 h-5 text-emerald-600" />
                The Task Pilot Way (With Task Pilot)
              </div>
              <ul className="space-y-4 text-slate-700 text-sm">
                {ind.gains.map((g) => (
                  <li key={g} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                    <span className="leading-relaxed">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Other Industries ─── */}
      <div className="bg-slate-50 py-16 border-t border-slate-200">
        <Section>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Explore solutions for other sectors:</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {INDUSTRIES.filter((x) => x.slug !== ind.slug).map((x) => (
              <Link
                key={x.slug}
                to={`/industries/${x.slug}`}
                className="p-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:border-slate-900 hover:shadow-sm transition-all flex items-center gap-2"
              >
                <x.icon className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">{x.name}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </MarketingLayout>
  );
};
