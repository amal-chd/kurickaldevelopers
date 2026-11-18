import React from 'react';
import { Link } from 'react-router-dom';
import {
  HardHat, ShieldCheck, Users,
  ArrowRight, HeartHandshake, Eye, Mail,
  CheckCircle2, Building2, MapPin, Database, Lock, Smartphone
} from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from '../saas/marketing/MarketingLayout';
import { useSeo } from '../../lib/seo';

export const LandingPage: React.FC = () => {
  useSeo({
    title: 'About Task Pilot — Construction Management Operating System',
    description: 'Learn about Task Pilot, our mission to bring radical operational clarity to jobsites, and our technology engineered for boots on the ground.',
    path: '/company',
  });

  return (
    <MarketingLayout>
      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/60 pt-16 pb-20 border-b border-slate-100">
        <div aria-hidden className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-200/20 blur-3xl pointer-events-none" />
        <Section className="text-center max-w-3xl mx-auto">
          <Eyebrow>About Task Pilot</Eyebrow>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Built by builders. <br className="hidden sm:inline" />
            <span className="text-amber-600">Engineered for the jobsite.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            We built Task Pilot to solve a fundamental construction reality:
            projects don't fail from lack of ambition — they bleed time and budget from broken communication between the physical jobsite and the head office.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="h-12 px-7 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 shadow-md transition-all"
            >
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact-sales"
              className="h-12 px-6 inline-flex items-center rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm hover:bg-slate-50 transition-all"
            >
              Talk to our team
            </Link>
          </div>
        </Section>
      </div>

      {/* ─── The Story & Architecture Specs ─── */}
      <Section className="py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-full">
              Our Purpose
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              Replacing WhatsApp groups and paper registers with verified site execution
            </h2>
            <div className="mt-5 space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
              <p>
                In the Indian construction industry, brilliant site engineers spend hours every evening transcribing measurements from dusty notebooks into Excel sheets, while critical drawing revisions and pour clearances disappear into noisy WhatsApp group chats.
              </p>
              <p>
                At the same time, managing directors and developers have had no tamper-proof visibility into who is actually on site, whether daily progress matches the project schedule, or when material costs are starting to deviate from the Bill of Quantities (BOQ).
              </p>
              <p>
                Task Pilot bridges that divide with a single, uncompromising platform: simple enough for a supervisor in safety boots to log DPRs and check in via GPS in seconds, yet powerful enough to give executives real-time Earned Value cost control across 20 simultaneous sites.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-10 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-lg">Platform Architecture & Capabilities</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-amber-600">21</p>
                <p className="text-xs text-slate-700 font-bold mt-0.5">Integrated Modules</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Tasks, BOQ, DPR, Stock & more</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-slate-900">8 Tiers</p>
                <p className="text-xs text-slate-700 font-bold mt-0.5">Role-Based Access</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Director to Site Labour</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-emerald-600">100%</p>
                <p className="text-xs text-slate-700 font-bold mt-0.5">Tenant Data Isolation</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Encrypted private workspace</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-blue-600">₹0</p>
                <p className="text-xs text-slate-700 font-bold mt-0.5">Per-Seat Surcharge</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Flat predictable team tiers</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">Task Pilot Technologies</strong><br />
              Cloud Construction Operations & Project Management Platform<br />
              Engineered for builders, general contractors, and EPC infrastructure firms.
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 8-Tier Organizational Model ─── */}
      <div className="bg-slate-50 py-20 border-y border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Eyebrow>Built For Construction Crews</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">8 Pre-Configured Role Tiers</h2>
            <p className="mt-2 text-slate-600 text-sm">
              Each user sees exactly the interfaces and commercial data relevant to their job responsibility.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Director', access: 'Executive Level', desc: 'Complete portfolio oversight, cross-site financial spend, BOQ margins, and contract approvals.' },
              { role: 'Admin', access: 'System Level', desc: 'Workspace configuration, user provisioning, custom roles, audit logs, and billing management.' },
              { role: 'Project Manager', access: 'Project Level', desc: 'Task delegation, drawing revision sign-offs, milestone schedules, and contractor verification.' },
              { role: 'Site Engineer', access: 'Field Execution', desc: 'Quality inspection hold points, rebar/concrete checklists, photo uploads, and material indents.' },
              { role: 'General Foreman', access: 'Site Supervision', desc: 'Daily labor muster, trade headcounts, machinery hour logging, and Daily Progress Reports (DPR).' },
              { role: 'Labour & Trades', access: 'Mobile Only', desc: 'GPS geofenced check-in/out, assigned subtask checklists, and personal attendance history.' },
              { role: 'Accounts & Finance', access: 'Commercial Level', desc: 'Site petty cash expense claims, material bills, salary slips, and contractor advance balances.' },
              { role: 'Client (View-Only)', access: 'Stakeholder Level', desc: 'Curated milestone progress photos, approved DPR summaries, and handover snag list tracking.' },
            ].map((item) => (
              <div key={item.role} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {item.access}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{item.role}</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Our Core Principles ─── */}
      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>What Guides Us</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Our Core Engineering Principles</h2>
          <p className="mt-2 text-slate-600 text-sm">
            We design every feature around the harsh physical realities of real construction teams.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: HardHat,
              title: 'Field-First Usability',
              desc: 'If it does not work in bright sunlight on a budget smartphone with one hand, it does not ship. Site usability always comes before office vanity.',
            },
            {
              icon: Eye,
              title: 'Radical Transparency',
              desc: 'No vague updates. Tasks require verified photo sign-offs, attendance is validated by GPS, and cost variances are flagged immediately.',
            },
            {
              icon: ShieldCheck,
              title: 'Strict Data Isolation',
              desc: 'Your rates, drawings, and crew data belong strictly to your company. Every tenant database partition is private and encrypted.',
            },
            {
              icon: HeartHandshake,
              title: 'Honest Flat Pricing',
              desc: 'We never charge per seat or punish you for adding site engineers or supervisors. One transparent monthly rate in INR with GST tax invoicing.',
            },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-4">
                <v.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">{v.title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Contact & Direct Channels ─── */}
      <div className="bg-slate-50 py-20 border-t border-slate-200">
        <Section>
          <div className="rounded-3xl border border-slate-200 p-8 sm:p-12 bg-white shadow-sm">
            <div className="max-w-2xl mb-8">
              <Eyebrow>Get In Touch</Eyebrow>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
                We're here to help your teams build better
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Have questions about deploying Task Pilot, migrating existing Excel registers, or volume enterprise pricing?
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <Mail className="w-5 h-5 text-amber-600 mb-2" />
                <p className="font-bold text-slate-900 text-sm">General Inquiries</p>
                <a href="mailto:hello@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                  hello@taskpilot.app
                </a>
                <p className="text-[11px] text-slate-500 mt-1">Partnerships, queries, and technical specifications</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <Users className="w-5 h-5 text-amber-600 mb-2" />
                <p className="font-bold text-slate-900 text-sm">Sales & Onboarding</p>
                <a href="mailto:sales@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                  sales@taskpilot.app
                </a>
                <p className="text-[11px] text-slate-500 mt-1">Product walkthroughs and data migration assistance</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <ShieldCheck className="w-5 h-5 text-amber-600 mb-2" />
                <p className="font-bold text-slate-900 text-sm">Customer Support</p>
                <a href="mailto:support@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                  support@taskpilot.app
                </a>
                <p className="text-[11px] text-slate-500 mt-1">Account help and rapid technical assistance</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── Bottom CTA ─── */}
      <Section className="py-20">
        <div className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ready to streamline your sites?</h2>
            <p className="mt-2 text-slate-300 text-sm">Experience the difference with a 14-day free trial on your active projects.</p>
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

export default LandingPage;
