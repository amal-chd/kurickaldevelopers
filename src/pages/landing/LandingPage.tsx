import React from 'react';
import { Link } from 'react-router-dom';
import {
  HardHat, ShieldCheck, Smartphone, Target, Users, MapPin,
  CheckCircle2, ArrowRight, HeartHandshake, Eye, Award, Building2, Mail, Clock
} from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from '../saas/marketing/MarketingLayout';
import { useSeo } from '../../lib/seo';

export const LandingPage: React.FC = () => {
  useSeo({
    title: 'About Task Pilot — Construction Management Operating System',
    description: 'Learn about Task Pilot, our mission to bring radical operational clarity to jobsites, and our team building the future of construction technology.',
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
            We started Task Pilot on active construction sites to solve a fundamental reality:
            construction projects don't fail from lack of ambition — they bleed time and budget from broken communication between the jobsite and the head office.
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

      {/* ─── The Story ─── */}
      <Section className="py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-full">
              Our Origin
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-3">
              Why we replaced WhatsApp groups and paper registers
            </h2>
            <div className="mt-5 space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
              <p>
                In 2024, our founding team watched brilliant engineers spend 2 hours every evening copying site measurements from grease-stained notebooks into Excel sheets, while critical change requests were lost in endless WhatsApp group chats.
              </p>
              <p>
                Meanwhile, directors and project sponsors had zero real-time visibility into who was actually on site, whether daily progress was keeping pace with the schedule, or when material costs were starting to exceed estimates.
              </p>
              <p>
                We built Task Pilot to bridge that divide with a single, uncompromising platform: simple enough for a supervisor in dusty boots to log DPRs and check in via GPS in 10 seconds, yet powerful enough to give executives live BOQ earned-value tracking across 20 simultaneous sites.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-10 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-lg">Task Pilot at a Glance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-amber-600">250+</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Active Project Sites</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-slate-900">45k+</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Tasks Verified & Closed</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-emerald-600">99.4%</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">GPS Verification Rate</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200">
                <p className="text-2xl font-extrabold text-blue-600">₹12 Cr+</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Tracked BOQ Spend</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">Headquarters & Engineering:</strong><br />
              Task Pilot Technologies<br />
              Kochi & Bangalore, India<br />
              Serving builders, general contractors, and EPC infrastructure firms nationwide.
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Our Core Values ─── */}
      <div className="bg-slate-50 py-20 border-y border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Eyebrow>What Guides Us</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Our Core Principles</h2>
            <p className="mt-2 text-slate-600 text-sm">
              We design every feature around the tough operational realities of real construction teams.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: HardHat,
                title: 'Field-First Usability',
                desc: 'If it does not work in bright sunlight on a budget smartphone with one thumb, it does not ship. Site usability comes before office vanity.',
              },
              {
                icon: Eye,
                title: 'Radical Transparency',
                desc: 'No vague updates. Tasks require verified photo sign-offs, attendance is validated by GPS, and cost variances are flagged immediately.',
              },
              {
                icon: ShieldCheck,
                title: 'Strict Data Isolation',
                desc: 'Your rates, drawings, and crew data belong strictly to your company. Every tenant database partition is private and isolated.',
              },
              {
                icon: HeartHandshake,
                title: 'Honest Flat Pricing',
                desc: 'We never charge per seat or punish you for adding site engineers or supervisors. One transparent monthly rate in INR with GST.',
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
      </div>

      {/* ─── Contact & Offices ─── */}
      <Section className="py-20">
        <div className="rounded-3xl border border-slate-200 p-8 sm:p-12 bg-white shadow-sm">
          <div className="max-w-2xl mb-8">
            <Eyebrow>Get In Touch</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
              We're here to help your teams build better
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Have questions about deploying Task Pilot, migrating data, or partner integrations?
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <Mail className="w-5 h-5 text-amber-600 mb-2" />
              <p className="font-bold text-slate-900 text-sm">General Inquiries</p>
              <a href="mailto:hello@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                hello@taskpilot.app
              </a>
              <p className="text-[11px] text-slate-500 mt-1">Press, partnerships, and general queries</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <Users className="w-5 h-5 text-amber-600 mb-2" />
              <p className="font-bold text-slate-900 text-sm">Sales & Onboarding</p>
              <a href="mailto:sales@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                sales@taskpilot.app
              </a>
              <p className="text-[11px] text-slate-500 mt-1">Product demos and volume custom plans</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-amber-600 mb-2" />
              <p className="font-bold text-slate-900 text-sm">Customer Support</p>
              <a href="mailto:support@taskpilot.app" className="text-xs text-amber-700 font-semibold hover:underline mt-1 block">
                support@taskpilot.app
              </a>
              <p className="text-[11px] text-slate-500 mt-1">Technical assistance and account help</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Bottom CTA ─── */}
      <Section className="pb-20">
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
