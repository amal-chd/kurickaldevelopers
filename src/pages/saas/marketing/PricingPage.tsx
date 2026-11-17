import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, ChevronDown } from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { COMPARISON, FAQS, PRICING_NOTE } from './content';
import { saasApi } from '../../../lib/saasApi';
import { Plan, MODULES, formatMoney } from '../../../lib/tenant';
import { useSeo } from '../../../lib/seo';

let plansCache: Plan[] | null = null;
export function usePlans() {
  const [plans, setPlans] = useState<Plan[] | null>(plansCache);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    saasApi<{ plans: Plan[] }>('public_plans', {}, { public: true })
      .then((r) => { plansCache = r.plans; setPlans(r.plans); })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { if (!plansCache) load(); }, []);
  return { plans, error, reload: load };
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
              {c === 'monthly' ? 'Monthly' : 'Yearly'} {c === 'yearly' && <span className="ml-1 text-emerald-600">2 months free</span>}
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
                {(p.is_custom_pricing ? ['Dedicated onboarding & data migration', 'SLA & priority support', 'SSO and API access'] : inherited.map(featureLabel)).map((f) => (
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
          <button className="w-full flex items-center justify-between gap-4 py-4 text-left font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}<ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="pb-4 text-slate-600 text-sm leading-relaxed">{f.a}</p>}
        </div>
      ))}
    </div>
  );
};

const PricingPage: React.FC = () => {
  useSeo({ title: 'Pricing', description: 'Flat team pricing in INR — not per seat. Starter, Professional, Business and Enterprise plans with a 14-day free trial, no card required.', path: '/pricing' });
  return (
  <MarketingLayout>
    <Section className="pt-16 pb-10 text-center">
      <Eyebrow>Pricing</Eyebrow>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Plans for every size of team</h1>
      <p className="mt-3 text-slate-600 max-w-xl mx-auto">Flat team pricing — not per seat. Every plan starts with a free trial, no card required.</p>
    </Section>
    <Section className="pb-20"><PricingCards /></Section>

    <div className="bg-slate-50 py-20">
      <Section>
        <h2 className="text-2xl font-bold tracking-tight text-center">How Task Pilot compares</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th scope="col" className="text-left font-semibold p-4">Capability</th>
                <th scope="col" className="p-4 font-bold text-slate-900">Task Pilot</th>
                <th scope="col" className="p-4 font-semibold">Global enterprise suites</th>
                <th scope="col" className="p-4 font-semibold">Generic task apps</th>
                <th scope="col" className="p-4 font-semibold">WhatsApp + Excel</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.row} className="border-t border-slate-100">
                  <th scope="row" className="text-left font-medium p-4">{r.row}</th>
                  <td className="p-4 text-center bg-amber-50/40"><Cell v={r.tp} /></td>
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
      <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently asked questions</h2>
      <Faq />
    </Section>
  </MarketingLayout>
  );
};

export default PricingPage;
