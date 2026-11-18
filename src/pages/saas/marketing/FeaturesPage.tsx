import React, { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowRight, X, Check, ShieldCheck, Smartphone, Database, Lock,
  CheckCircle2, FileText, IndianRupee, MapPin,
  ClipboardCheck, Clock
} from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { FEATURES, INDUSTRIES, FeatureItem } from './content';
import { useSeo } from '../../../lib/seo';

const CATEGORIES = [
  { id: 'all', label: 'All Modules (21)' },
  { id: 'field', label: 'Field & Site Execution' },
  { id: 'commercial', label: 'BOQ & Commercials' },
  { id: 'planning', label: 'Planning & Quality' },
  { id: 'admin', label: 'HR, Team & Security' },
];

export const FeaturesPage: React.FC = () => {
  useSeo({
    title: 'Task Pilot Features — Complete Construction Operating System',
    description: 'Every module construction teams need: tasks & sign-offs, GPS attendance, daily site diary (DPR), BOQ & cost control, materials, labour, inspections, Gantt timeline, drawings and chat.',
    path: '/features',
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem | null>(null);

  const filteredFeatures = activeCategory === 'all'
    ? FEATURES
    : FEATURES.filter((f) => f.category === activeCategory);

  return (
    <MarketingLayout>
      {/* ─── Hero ─── */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 pt-16 pb-12 border-b border-slate-100">
        <Section className="text-center max-w-3xl mx-auto">
          <Eyebrow>Full Modular Suite</Eyebrow>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            21 Purpose-Built Construction Modules
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            From geofenced GPS muster on active jobsites to real-time BOQ cost control at head office.
            Every tool is included in our transparent, predictable flat team tiers.
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
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Core Capabilities</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            The foundation of modern site management
          </h2>
        </div>

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
              <ClipboardCheck className="w-6 h-6" />
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
            Included in our flat-rate tiers. No hidden per-feature unlock charges or add-on fees.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                      {feat.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{feat.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feat.fullDesc || feat.desc}</p>

                  {feat.keyBenefits && feat.keyBenefits.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Key Capabilities</p>
                      {feat.keyBenefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Roles:</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                    {feat.userRoles.slice(0, 3).join(', ')}
                  </span>
                </div>
              </div>
            );
          })}
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

      {/* ─── Bottom CTA ─── */}
      <Section className="py-20">
        <div className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Try all 21 modules on your sites today</h2>
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
    title: ind ? `${ind.name} Management Software — Task Pilot` : 'Industries',
    description: ind ? `${ind.headline}. ${ind.summary}` : 'Task Pilot for construction and field teams.',
    path: `/industries/${slug}`,
  });

  if (!ind) return <Navigate to="/features" replace />;
  const Icon = ind.icon;

  return (
    <MarketingLayout>
      {/* ─── Hero ─── */}
      <div className="bg-slate-900 text-white py-16 md:py-24 border-b border-slate-800">
        <Section>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Icon className="w-4 h-4" />
            <span>Sector Operating System: {ind.name}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl leading-tight">
            {ind.headline}
          </h1>
          <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            {ind.summary}
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

      {/* ─── The Operational Shift (Pains vs Gains) ─── */}
      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>The Operational Shift</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            How Task Pilot transforms your daily execution
          </h2>
          <p className="text-slate-600 text-sm mt-2">
            Moving away from disconnected spreadsheets and unsearchable messaging apps into a single verified system of record.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm uppercase tracking-wider mb-5">
                <X className="w-5 h-5 text-rose-600" />
                The Current Reality (Without Task Pilot)
              </div>
              <ul className="space-y-4 text-slate-700 text-sm">
                {ind.pains.map((p, idx) => (
                  <li key={idx} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/30 p-8 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm uppercase tracking-wider mb-5">
                <Check className="w-5 h-5 text-emerald-600" />
                The Task Pilot Standard (With Task Pilot)
              </div>
              <ul className="space-y-4 text-slate-700 text-sm">
                {ind.gains.map((g, idx) => (
                  <li key={idx} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                    <span className="leading-relaxed">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Key Sector Workflows ─── */}
      <div className="bg-slate-50 py-20 border-y border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Eyebrow>Field Best Practices</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              Key Workflows Tailored for {ind.name}
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              Standard operating procedures designed around the specific bottlenecks of your sector.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {ind.keyWorkflows.map((wf, idx) => (
              <div key={idx} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-800 font-bold text-xs flex items-center justify-center mb-4">
                    0{idx + 1}
                  </span>
                  <h3 className="font-bold text-base text-slate-900 mb-2">{wf.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{wf.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Typical Daily Field Routine ─── */}
      <Section className="py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Daily Rhythm</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              A Day in the Life on Task Pilot
            </h2>
            <p className="mt-2 text-slate-600 text-sm">
              How field supervisors and project managers coordinate throughout a typical shift.
            </p>
          </div>

          <div className="space-y-4">
            {ind.dailyRoutine.map((step, idx) => (
              <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 font-mono font-bold text-xs shrink-0 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{step.time}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Standard Sector Checklists ─── */}
      <div className="bg-slate-900 text-white py-16 border-t border-slate-800">
        <Section>
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Pre-Built Templates</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2">
              Ready-to-use digital checklists included for {ind.name}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Start with industry-standard inspection gates or customize to match your firm's QA/QC protocols.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ind.standardChecklists.map((chk, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-slate-200 font-medium">{chk}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Other Industries Switcher ─── */}
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
