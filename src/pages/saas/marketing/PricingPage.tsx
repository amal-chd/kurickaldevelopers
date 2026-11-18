import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, ChevronDown, ShieldCheck, Database, Headphones, ArrowRight, FileCheck } from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { COMPARISON, FAQS, PRICING_NOTE } from './content';
import { saasApi } from '../../../lib/saasApi';
import { Plan, MODULES, formatMoney } from '../../../lib/tenant';
import { useSeo } from '../../../lib/seo';

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For independent contractors and small site crews getting organized.',
    currency: 'INR',
    price_monthly: 149900,
    price_yearly: 1499000,
    max_users: 10,
    max_projects: 3,
    max_storage_mb: 5120,
    features: ['tasks', 'projects', 'attendance', 'site_diary', 'documents', 'chat', 'mobile', 'notifications'],
    trial_days: 14,
    highlight: false,
    is_custom_pricing: false,
    sort_order: 1,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For growing builders managing multiple active sites and trades.',
    currency: 'INR',
    price_monthly: 399900,
    price_yearly: 3999000,
    max_users: 30,
    max_projects: 10,
    max_storage_mb: 25600,
    features: ['tasks', 'projects', 'attendance', 'site_diary', 'documents', 'chat', 'mobile', 'notifications', 'boq', 'materials', 'labour', 'inspections', 'timeline', 'expenses'],
    trial_days: 14,
    highlight: true,
    is_custom_pricing: false,
    sort_order: 2,
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For established developers needing deep cost control and HR automation.',
    currency: 'INR',
    price_monthly: 799900,
    price_yearly: 7999000,
    max_users: 100,
    max_projects: 30,
    max_storage_mb: 102400,
    features: ['tasks', 'projects', 'attendance', 'site_diary', 'documents', 'chat', 'mobile', 'notifications', 'boq', 'materials', 'labour', 'inspections', 'timeline', 'expenses', 'assets', 'leave', 'salary', 'reports', 'performance', 'roles'],
    trial_days: 14,
    highlight: false,
    is_custom_pricing: false,
    sort_order: 3,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large EPCs and developers requiring custom integrations and dedicated support.',
    currency: 'INR',
    price_monthly: 0,
    price_yearly: 0,
    max_users: null,
    max_projects: null,
    max_storage_mb: null,
    features: ['tasks', 'projects', 'attendance', 'site_diary', 'documents', 'chat', 'mobile', 'notifications', 'boq', 'materials', 'labour', 'inspections', 'timeline', 'expenses', 'assets', 'leave', 'salary', 'reports', 'performance', 'roles', 'team'],
    trial_days: 14,
    highlight: false,
    is_custom_pricing: true,
    sort_order: 4,
  },
];

let plansCache: Plan[] | null = null;
export function usePlans() {
  const [plans, setPlans] = useState<Plan[] | null>(plansCache || DEFAULT_PLANS);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    saasApi<{ plans: Plan[] }>('public_plans', {}, { public: true })
      .then((r) => { plansCache = r.plans; setPlans(r.plans); })
      .catch(() => {
        // Fall back gracefully to DEFAULT_PLANS so pricing page never breaks
        setPlans(DEFAULT_PLANS);
      });
  };
  useEffect(() => { load(); }, []);
  return { plans: plans || DEFAULT_PLANS, error, reload: load };
}

const limitLabel = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `Up to ${n} ${unit}`);
const storageLabel = (mb: number | null) => (mb === null ? 'Unlimited storage' : `${mb >= 1024 ? Math.round(mb / 1024) + ' GB' : mb + ' MB'} storage`);

export const PricingCards: React.FC<{ onSelect?: (plan: Plan, cycle: 'monthly' | 'yearly') => void; currentPlanId?: string | null; busyPlanId?: string | null }> = ({ onSelect, currentPlanId, busyPlanId }) => {
  const { plans, error, reload } = usePlans();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-600">Couldn't load plans: {error}</p>
        <button onClick={reload} className="mt-3 text-sm font-semibold underline">Try again</button>
      </div>
    );
  }
  if (!plans) {
    return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-96 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  }
  const featureLabel = (k: string) => MODULES.find((m) => m.key === k)?.label ?? k;

  return (
    <div>
      <div className="flex justify-center mb-8">
        <div role="radiogroup" aria-label="Billing cycle" className="inline-flex p-1 rounded-xl bg-slate-200/70">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button key={c} role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
              className={`px-4 h-9 rounded-lg text-sm font-semibold transition ${cycle === c ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
              {c === 'monthly' ? 'Monthly' : 'Yearly'} {c === 'yearly' && <span className="ml-1 text-emerald-600 font-bold">2 months free</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {plans.map((p, i) => {
          const prev = plans[i - 1];
          const inherited = prev && !p.is_custom_pricing ? p.features.filter((f) => !prev.features.includes(f)) : p.features;
          const price = cycle === 'yearly' ? p.price_yearly / 12 : p.price_monthly;
          const isCurrent = currentPlanId === p.id;
          return (
            <div key={p.id} className={`relative rounded-2xl p-6 flex flex-col bg-white border ${p.highlight ? 'border-slate-900 ring-1 ring-slate-900 shadow-xl' : 'border-slate-200'}`}>
              {p.highlight && <span className="absolute -top-3 left-6 text-xs font-bold bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full">Most popular</span>}
              <p className="font-bold text-lg">{p.name}</p>
              <p className="text-sm text-slate-500 mt-1 min-h-[40px]">{p.tagline}</p>
              <div className="mt-5 min-h-[64px]">
                {p.is_custom_pricing ? (
                  <p className="text-3xl font-extrabold tracking-tight">Custom</p>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold tracking-tight">{formatMoney(Math.round(price / 100) * 100, p.currency)}<span className="text-base font-medium text-slate-500">/mo</span></p>
                    <p className="text-xs text-slate-500 mt-1">{cycle === 'yearly' ? `${formatMoney(p.price_yearly, p.currency)} billed yearly` : 'Billed monthly'}</p>
                  </>
                )}
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{limitLabel(p.max_users, 'team members')}</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{limitLabel(p.max_projects, 'projects')}</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{storageLabel(p.max_storage_mb)}</li>
                {prev && !p.is_custom_pricing && <li className="pt-1 text-xs font-semibold text-slate-500">Everything in {prev.name}, plus:</li>}
                {(p.is_custom_pricing ? ['Dedicated onboarding & data migration', 'SLA & priority support', 'Custom ERP & API integration'] : inherited.map(featureLabel)).map((f) => (
                  <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                {p.is_custom_pricing ? (
                  <Link to="/contact-sales" className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-slate-300 font-semibold hover:bg-slate-50">Talk to sales</Link>
                ) : onSelect ? (
                  <button disabled={isCurrent || busyPlanId === p.id} onClick={() => onSelect(p, cycle)}
                    className={`w-full h-11 rounded-xl font-semibold disabled:opacity-60 ${p.highlight ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 hover:bg-slate-50'}`}>
                    {isCurrent ? 'Current plan' : busyPlanId === p.id ? 'Opening checkout…' : `Choose ${p.name}`}
                  </button>
                ) : (
                  <Link to={`/register?plan=${p.id}&cycle=${cycle}`} className={`w-full h-11 inline-flex items-center justify-center rounded-xl font-semibold ${p.highlight ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 hover:bg-slate-50'}`}>
                    Start {p.trial_days}-day free trial
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-500 mt-6">{PRICING_NOTE}</p>
    </div>
  );
};

const Cell: React.FC<{ v: string | boolean }> = ({ v }) =>
  v === true ? <Check className="w-5 h-5 text-emerald-600 mx-auto" aria-label="Yes" /> :
  v === false ? <Minus className="w-5 h-5 text-slate-300 mx-auto" aria-label="No" /> :
  <span className="text-xs text-slate-600">{v}</span>;

export const Faq: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {FAQS.map((f, i) => (
        <div key={f.q}>
          <button className="w-full flex items-center justify-between gap-4 py-4 text-left font-semibold text-slate-900" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}<ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="pb-4 text-slate-600 text-sm leading-relaxed">{f.a}</p>}
        </div>
      ))}
    </div>
  );
};

const MODULE_MATRIX = [
  { name: 'Tasks, Subtasks & Sign-offs', starter: true, pro: true, biz: true, ent: true },
  { name: 'GPS Geofenced Attendance', starter: true, pro: true, biz: true, ent: true },
  { name: 'Daily Progress Reports (DPR)', starter: true, pro: true, biz: true, ent: true },
  { name: 'Cloud Document & Drawing Storage', starter: true, pro: true, biz: true, ent: true },
  { name: 'Site Channels & Team Chat', starter: true, pro: true, biz: true, ent: true },
  { name: 'Mobile Apps (Android, iOS, PWA)', starter: true, pro: true, biz: true, ent: true },
  { name: 'Smart Push Notifications', starter: true, pro: true, biz: true, ent: true },
  { name: 'BOQ & Earned Value (PV, EV, CPI)', starter: false, pro: true, biz: true, ent: true },
  { name: 'Materials Inventory & Indents', starter: false, pro: true, biz: true, ent: true },
  { name: 'Labour Muster & Overtime Calculation', starter: false, pro: true, biz: true, ent: true },
  { name: 'Inspections & Punch Lists', starter: false, pro: true, biz: true, ent: true },
  { name: 'Interactive Gantt Timeline', starter: false, pro: true, biz: true, ent: true },
  { name: 'Site Expenses & Petty Cash Claims', starter: false, pro: true, biz: true, ent: true },
  { name: 'Heavy Machinery & Equipment Register', starter: false, pro: false, biz: true, ent: true },
  { name: 'Staff Leave Management', starter: false, pro: false, biz: true, ent: true },
  { name: 'Monthly Salary Slips & Payroll', starter: false, pro: false, biz: true, ent: true },
  { name: 'Executive Reports & Excel Exports', starter: false, pro: false, biz: true, ent: true },
  { name: 'Performance & OPI Scoring', starter: false, pro: false, biz: true, ent: true },
  { name: '8-Tier Role Permissions', starter: false, pro: false, biz: true, ent: true },
  { name: 'Custom ERP & API Integrations', starter: false, pro: false, biz: false, ent: true },
  { name: 'Dedicated Account Manager & SLA', starter: false, pro: false, biz: false, ent: true },
];

const PricingPage: React.FC = () => {
  useSeo({
    title: 'Pricing — Simple Flat Rates for Construction Teams',
    description: 'Flat team pricing in INR with GST input tax invoices — not per seat. Starter, Professional, Business and Enterprise plans with a 14-day free trial, no credit card required.',
    path: '/pricing',
  });

  return (
    <MarketingLayout>
      <Section className="pt-16 pb-10 text-center">
        <Eyebrow>Transparent Pricing</Eyebrow>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Predictable flat team rates — not per seat
        </h1>
        <p className="mt-3 text-slate-600 max-w-xl mx-auto text-base">
          Never hesitate to add another site engineer or supervisor. Every plan starts with a full 14-day free trial, no card required.
        </p>
      </Section>

      <Section className="pb-20">
        <PricingCards />
      </Section>

      {/* ─── Detailed Module Matrix by Plan ─── */}
      <div className="bg-slate-50 py-20 border-t border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Plan Breakdown</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-2">
              Compare features across tiers
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Select the right tier based on your active sites, crew size, and required commercial controls.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <th scope="col" className="text-left font-bold p-4">Operational Module</th>
                  <th scope="col" className="p-4 font-bold text-center">Starter</th>
                  <th scope="col" className="p-4 font-bold text-center bg-amber-500/10 text-amber-900">Professional</th>
                  <th scope="col" className="p-4 font-bold text-center">Business</th>
                  <th scope="col" className="p-4 font-bold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <td className="p-3 pl-4">Included Scope</td>
                  <td className="p-3 text-center">10 users · 3 sites</td>
                  <td className="p-3 text-center bg-amber-500/5 font-bold text-slate-800">30 users · 10 sites</td>
                  <td className="p-3 text-center">100 users · 30 sites</td>
                  <td className="p-3 text-center">Custom · Unlimited</td>
                </tr>
                {MODULE_MATRIX.map((m) => (
                  <tr key={m.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 pl-4 font-medium text-slate-900">{m.name}</td>
                    <td className="p-3.5 text-center"><Cell v={m.starter} /></td>
                    <td className="p-3.5 text-center bg-amber-500/5"><Cell v={m.pro} /></td>
                    <td className="p-3.5 text-center"><Cell v={m.biz} /></td>
                    <td className="p-3.5 text-center"><Cell v={m.ent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ─── Concierge Onboarding & GST Guarantees ─── */}
      <Section className="py-20">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center mb-4">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">GST Input Tax Ready</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                All prices include 18% GST. Automated tax invoices are generated upon payment with your firm's GSTIN and SAC code 997331 for full input tax credit claim.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center mb-4">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Complimentary Data Onboarding</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                On Business and Enterprise tiers, our engineering team helps import your ongoing projects, Excel BOQs, open task lists, and user directory in under 48 hours.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-800 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Cancel or Change Anytime</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                No long-term contracts. Upgrades apply immediately; if cancelled, your workspace stays active until the end of your billing cycle with full read-only export access.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Comparison Table ─── */}
      <div className="bg-slate-50 py-20 border-t border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Eyebrow>Market Comparison</Eyebrow>
            <h2 className="text-2xl font-bold tracking-tight text-center text-slate-900 mt-2">
              How Task Pilot compares to alternatives
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th scope="col" className="text-left font-semibold p-4">Capability</th>
                  <th scope="col" className="p-4 font-bold text-slate-900 text-center bg-amber-500/10">Task Pilot</th>
                  <th scope="col" className="p-4 font-semibold text-center">Global enterprise suites</th>
                  <th scope="col" className="p-4 font-semibold text-center">Generic task apps</th>
                  <th scope="col" className="p-4 font-semibold text-center">WhatsApp + Excel</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((r) => (
                  <tr key={r.row} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <th scope="row" className="text-left font-medium p-4 text-slate-800">{r.row}</th>
                    <td className="p-4 text-center bg-amber-500/5 font-semibold text-slate-900"><Cell v={r.tp} /></td>
                    <td className="p-4 text-center"><Cell v={r.global} /></td>
                    <td className="p-4 text-center"><Cell v={r.generic} /></td>
                    <td className="p-4 text-center"><Cell v={r.manual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section className="py-20 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-slate-900">Frequently Asked Questions</h2>
        <Faq />
      </Section>
    </MarketingLayout>
  );
};

export default PricingPage;
