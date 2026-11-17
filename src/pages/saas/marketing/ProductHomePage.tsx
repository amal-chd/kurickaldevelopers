import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone, IndianRupee, Zap } from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { FEATURES, INDUSTRIES, TESTIMONIALS } from './content';
import { PricingCards } from './PricingPage';

const ProductHomePage: React.FC = () => (
  <MarketingLayout>
    {/* Hero */}
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div aria-hidden className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-amber-200/30 blur-3xl" />
      <Section className="relative pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Eyebrow>Construction work management</Eyebrow>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
            Every site, task and crew — <span className="text-amber-600">under control.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-xl">
            Task Pilot replaces WhatsApp groups and spreadsheets with one workspace for tasks, approvals, GPS attendance,
            daily site diaries, documents and expenses — on the web and on every phone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800">
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact-sales" className="h-12 px-6 inline-flex items-center rounded-xl border border-slate-300 font-semibold hover:bg-white">Book a demo</Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {['No credit card needed', 'Set up in minutes', 'Android & iOS apps'].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold">Today across 4 sites</p>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Live</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['On site', '46'], ['Tasks due', '18'], ['Approvals', '7']].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-slate-500">{k}</p></div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[['Slab shuttering — Block B', 'In review', 'bg-amber-50 text-amber-700'], ['Electrical conduit, 3rd floor', 'In progress', 'bg-blue-50 text-blue-700'], ['Site diary — Kakkanad', 'Submitted', 'bg-emerald-50 text-emerald-700']].map(([t, s, c]) => (
                <div key={t} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm">
                  <span className="truncate">{t}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c}`}>{s}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Illustration</p>
          </div>
        </div>
      </Section>
    </div>

    {/* Value props */}
    <Section className="py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { icon: Smartphone, t: 'Field-first', d: 'Designed for site engineers and supervisors on phones, not just the office.' },
        { icon: IndianRupee, t: 'Fair, flat pricing', d: 'One price for your whole team tier, billed in INR with UPI AutoPay.' },
        { icon: ShieldCheck, t: 'Your data, isolated', d: 'Each company has its own private workspace, roles and audit trail.' },
        { icon: Zap, t: 'Live in a day', d: 'Pre-built roles for construction — invite your team and go.' },
      ].map(({ icon: I, t, d }) => (
        <div key={t} className="rounded-2xl border border-slate-200 p-6">
          <I className="w-6 h-6 text-amber-600" aria-hidden />
          <p className="mt-4 font-semibold">{t}</p>
          <p className="mt-1.5 text-sm text-slate-600">{d}</p>
        </div>
      ))}
    </Section>

    {/* Features */}
    <div className="bg-slate-50 py-20">
      <Section>
        <div className="max-w-2xl">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">One workspace for the office and the site</h2>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.slice(0, 9).map(({ icon: I, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><I className="w-5 h-5" aria-hidden /></div>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <Link to="/features" className="mt-8 inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:underline">See all features <ArrowRight className="w-4 h-4" /></Link>
      </Section>
    </div>

    {/* Industries */}
    <Section className="py-20">
      <Eyebrow>Who it's for</Eyebrow>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Made for teams that build and maintain</h2>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INDUSTRIES.map(({ slug, icon: I, name, headline }) => (
          <Link key={slug} to={`/industries/${slug}`} className="group rounded-2xl border border-slate-200 p-5 hover:border-slate-900 transition-colors">
            <I className="w-6 h-6 text-slate-700" aria-hidden />
            <p className="mt-3 font-semibold">{name}</p>
            <p className="text-sm text-slate-600 mt-1">{headline}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 group-hover:gap-2 transition-all">Learn more <ArrowRight className="w-3.5 h-3.5" /></span>
          </Link>
        ))}
      </div>
    </Section>

    {TESTIMONIALS.length > 0 && (
      <div className="bg-slate-900 text-white py-20">
        <Section className="grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <blockquote className="text-lg leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm text-slate-300">{t.name}, {t.title} — {t.company}</figcaption>
            </figure>
          ))}
        </Section>
      </div>
    )}

    {/* Pricing */}
    <div className="bg-slate-50 py-20">
      <Section>
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">Simple plans that grow with you</h2>
        </div>
        <div className="mt-10"><PricingCards /></div>
      </Section>
    </div>

    {/* CTA */}
    <Section className="py-20">
      <div className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Get your sites organised this week</h2>
          <p className="mt-2 text-slate-300">Start free. Invite your team. Cancel any time.</p>
        </div>
        <Link to="/register" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shrink-0">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Section>
  </MarketingLayout>
);

export default ProductHomePage;
