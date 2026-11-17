import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, X, Check } from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { FEATURES, INDUSTRIES } from './content';

export const FeaturesPage: React.FC = () => (
  <MarketingLayout>
    <Section className="pt-16 pb-12 text-center">
      <Eyebrow>Features</Eyebrow>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Everything your sites run on</h1>
      <p className="mt-3 text-slate-600 max-w-2xl mx-auto">Turn on only the modules you need. Every workspace is isolated, role-based and works on web, Android and iOS.</p>
    </Section>
    <Section className="pb-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {FEATURES.map(({ icon: I, title, desc }) => (
        <div key={title} className="rounded-2xl border border-slate-200 p-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><I className="w-5 h-5" aria-hidden /></div>
          <h2 className="mt-4 font-semibold">{title}</h2>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
        </div>
      ))}
    </Section>
    <Section className="pb-20">
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8">
        <h2 className="text-xl font-bold">On the roadmap</h2>
        <p className="text-sm text-slate-600 mt-1">Shipping next for construction teams:</p>
        <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-slate-700">
          {['BOQ & estimation', 'Material & inventory tracking', 'Labour & contractor management', 'Work orders', 'Inspections, checklists & safety', 'Gantt timelines & milestones', 'Client approvals portal', 'Project cost monitoring'].map((x) => (
            <li key={x} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{x}</li>
          ))}
        </ul>
      </div>
    </Section>
  </MarketingLayout>
);

export const IndustryPage: React.FC = () => {
  const { slug } = useParams();
  const ind = INDUSTRIES.find((i) => i.slug === slug);
  if (!ind) return <Navigate to="/features" replace />;
  const I = ind.icon;
  return (
    <MarketingLayout>
      <div className="bg-slate-900 text-white">
        <Section className="py-16 md:py-24">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold"><I className="w-5 h-5" aria-hidden />{ind.name}</div>
          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl">{ind.headline}</h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">Start free trial <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/contact-sales" className="h-12 px-6 inline-flex items-center rounded-xl border border-white/30 font-semibold hover:bg-white/10">Book a demo</Link>
          </div>
        </Section>
      </div>
      <Section className="py-16 grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg">Without Task Pilot</h2>
          <ul className="mt-4 space-y-3 text-slate-700">{ind.pains.map((p) => <li key={p} className="flex gap-2"><X className="w-5 h-5 text-red-500 shrink-0" />{p}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-slate-900 p-6">
          <h2 className="font-bold text-lg">With Task Pilot</h2>
          <ul className="mt-4 space-y-3 text-slate-700">{ind.gains.map((p) => <li key={p} className="flex gap-2"><Check className="w-5 h-5 text-emerald-600 shrink-0" />{p}</li>)}</ul>
        </div>
      </Section>
      <Section className="pb-20">
        <h2 className="text-xl font-bold mb-4">Other industries</h2>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.filter((x) => x.slug !== ind.slug).map((x) => (
            <Link key={x.slug} to={`/industries/${x.slug}`} className="px-4 h-10 inline-flex items-center rounded-full border border-slate-200 text-sm font-medium hover:border-slate-900">{x.name}</Link>
          ))}
        </div>
      </Section>
    </MarketingLayout>
  );
};
