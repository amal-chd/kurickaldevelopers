import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, ShieldCheck, Smartphone, IndianRupee,
  Check, MapPin, FileText,
  Clock, ChevronRight, Activity, HardHat, Boxes, AlertTriangle
} from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { FEATURES, INDUSTRIES, FAQS } from './content';
import { PricingCards } from './PricingPage';
import { useSeo } from '../../../lib/seo';

export const ProductHomePage: React.FC = () => {
  useSeo({
    title: 'Task Pilot — Construction Project & Field Operations Software',
    description: 'The operating system for construction and field teams: tasks with sign-offs, GPS attendance, daily site diaries (DPR), BOQ cost control, materials, labour and Gantt timelines. Start a 14-day free trial.',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Task Pilot',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      offers: { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: '1499', offerCount: 4 },
    },
  });

  const [activeTab, setActiveTab] = useState<'command' | 'tasks' | 'dpr' | 'boq'>('command');

  return (
    <MarketingLayout>
      {/* ─── Hero Section ─── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/60 pt-10 pb-20 md:pt-16 md:pb-28 border-b border-slate-100">
        <div aria-hidden className="absolute -top-40 -right-40 w-[550px] h-[550px] rounded-full bg-amber-200/25 blur-3xl pointer-events-none" />
        <div aria-hidden className="absolute top-1/2 -left-40 w-[450px] h-[450px] rounded-full bg-blue-100/30 blur-3xl pointer-events-none" />

        <Section className="relative">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-900 text-xs font-semibold mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Next-Generation Construction Management</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
              Every site, task and crew —{' '}
              <span className="text-amber-600 underline decoration-amber-300/60 decoration-wavy decoration-2">under control.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed font-normal">
              Task Pilot replaces chaotic WhatsApp groups and paper registers with one unified workspace for task sign-offs,
              tamper-proof GPS attendance, daily site diaries, BOQ cost tracking, and equipment allocation — on the web and on every smartphone.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to="/register"
                className="w-full sm:w-auto h-13 px-8 inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 text-white font-semibold text-base hover:bg-slate-800 shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 transition-all hover:-translate-y-0.5"
              >
                Start 14-day free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact-sales"
                className="w-full sm:w-auto h-13 px-7 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-base hover:bg-slate-50 transition-all"
              >
                Book a live demo
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-500">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                No credit card required
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Up and running in 10 minutes
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Native Android & iOS apps
              </li>
            </ul>
          </div>

          {/* ── Interactive Hero Showcase ── */}
          <div className="mt-10 rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden max-w-5xl mx-auto">
            {/* Window bar */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-medium text-slate-400 hidden sm:inline">Task Pilot Operations Hub</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg">
                {[
                  { id: 'command', label: 'Site Command', icon: Activity },
                  { id: 'tasks', label: 'Tasks & Approvals', icon: CheckCircle2 },
                  { id: 'dpr', label: 'Daily DPR', icon: FileText },
                  { id: 'boq', label: 'BOQ & Spend', icon: IndianRupee },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        active ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Showcase body */}
            <div className="p-6 bg-slate-50/70 min-h-[380px]">
              {activeTab === 'command' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Multi-Site Pulse</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      </div>
                      <p className="text-xl font-bold text-slate-900 mt-0.5">4 Active Construction Projects</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200">
                        All Sites Checked In
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">On-Site Today</p>
                      <p className="text-3xl font-extrabold text-slate-900 mt-1">68</p>
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Geo-verified check-ins
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Tasks in Progress</p>
                      <p className="text-3xl font-extrabold text-slate-900 mt-1">29</p>
                      <p className="text-[11px] text-slate-500 mt-1">Across 7 site trades</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Pending Verifications</p>
                      <p className="text-3xl font-extrabold text-amber-600 mt-1">5</p>
                      <p className="text-[11px] text-amber-700 font-semibold mt-1">Requires Engineer sign-off</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Daily DPR Status</p>
                      <p className="text-3xl font-extrabold text-emerald-600 mt-1">100%</p>
                      <p className="text-[11px] text-slate-500 mt-1">4 of 4 sites submitted</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Recent Jobsite Activity Feed</p>
                    <div className="space-y-2.5">
                      {[
                        { site: 'Metro Viaduct Package 02', text: 'Pier cap concrete pour inspection completed and signed off', role: 'Site Engineer (Civil)', status: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { site: 'Commercial Tower Block A', text: 'Daily Site Diary submitted with 6 photos and 42 manpower logged', role: 'General Foreman', status: 'DPR Logged', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { site: 'Residential Enclave Phase 2', text: 'Material indent for 300 bags OPC 53 cement submitted for approval', role: 'Project Manager', status: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      ].map((act, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                          <div>
                            <span className="font-bold text-slate-800 mr-2">{act.site}:</span>
                            <span className="text-slate-600">{act.text}</span>
                            <span className="text-slate-400 ml-2">({act.role})</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-semibold shrink-0 border ${act.color}`}>
                            {act.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold text-xs uppercase tracking-wider border border-rose-200">High Priority</span>
                        <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-bold text-xs uppercase tracking-wider border border-amber-200">Requires Sign-off</span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">Due Today · 4:00 PM</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Level 4 Slab Shuttering & Rebar Reinforcement Verification</h3>
                    <p className="text-xs text-slate-600 mt-1">Commercial Tower Block A · Tower 1, Zone B · Assigned to Site Team & QA Inspector</p>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                        <p className="text-[11px] font-semibold text-emerald-800">Subtask 1</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /> Rebar Spacing (200mm c/c)</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                        <p className="text-[11px] font-semibold text-emerald-800">Subtask 2</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /> 25mm Cover Blocks Placed</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                        <p className="text-[11px] font-semibold text-amber-800">Subtask 3 (In Review)</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-600" /> Shutter Cleanliness Inspection</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span>Enforced Rule: Cannot close or mark done until Project Manager digitally approves</span>
                      <span className="font-bold text-slate-700">2 Site Photos Attached</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dpr' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-900">Daily Progress Report (DPR) #142</h3>
                        <p className="text-xs text-slate-500">Metro Viaduct Package 02 · Submitted Today 5:15 PM</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">Verified by GPS</span>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 my-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Weather & Conditions</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">Sunny, 31°C · Normal Shift</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Total Manpower On Site</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">38 Skilled · 24 Helpers</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Active Machinery</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">1 Crane · 2 Transit Mixers</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="font-semibold text-slate-900">Work Executed Today:</p>
                      <p>• Completed M35 concrete casting for Pier #48 (total volume 42 m³).</p>
                      <p>• Fabricated 4.2 tons of steel reinforcement for diaphragm wall segment 6.</p>
                      <p>• Safety briefing conducted: 100% PPE compliance verified before shift start.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'boq' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-bold text-slate-900">Commercial & BOQ Variance Tracking</h3>
                        <p className="text-xs text-slate-500">Live Earned Value Management across civil works</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200">CPI: 1.05 (Under Budget)</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Planned Value (PV)</p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">₹48.5 L</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Earned Value (EV)</p>
                        <p className="text-xl font-black text-emerald-700 mt-0.5">₹49.2 L</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p className="text-[11px] text-slate-500 font-medium">Actual Cost (AC)</p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">₹46.8 L</p>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                      <span>Cost savings achieved through tracked material receipts and direct labour registers</span>
                      <span className="font-bold">+ ₹2.4 Lakhs saved</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ─── Platform Architecture & Standards Banner ─── */}
      <div className="bg-slate-900 text-white py-12 border-y border-slate-800">
        <Section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400">21</p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-semibold">Specialized Modules</p>
              <p className="text-[11px] text-slate-400 mt-0.5">From GPS attendance to BOQ</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400">8 Tiers</p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-semibold">Pre-Configured Roles</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Directors down to Site Labour</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400">100%</p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-semibold">Tenant Data Isolation</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Encrypted private workspace</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400">₹0</p>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-semibold">Per-Seat Penalties</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Predictable flat team tiers</p>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── Why Teams Choose Task Pilot (4 Pillars) ─── */}
      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>Why Task Pilot</Eyebrow>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Engineered specifically for the dust, rain, and realities of construction
          </h2>
          <p className="mt-3 text-slate-600 text-base">
            Generic project management tools fail on jobsites because they are designed for laptop desks. Task Pilot is engineered for boots on the ground.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Smartphone,
              title: 'Field-First Interface',
              desc: 'High-contrast UI with large tap targets and offline support so site engineers and foremen can log DPRs and check attendance in sunlight.',
              badge: 'Fast on mobile',
            },
            {
              icon: MapPin,
              title: 'Tamper-Proof GPS Attendance',
              desc: 'Geo-fenced mobile check-ins ensure staff are physically on the jobsite. Live attendance dashboards for head office with automatic overtime calculation.',
              badge: 'Zero ghost labour',
            },
            {
              icon: ShieldCheck,
              title: 'Total Tenant Data Isolation',
              desc: 'Each company receives its own private database partition. Drawings, BOQs, rates, and employee salaries remain strictly private and encrypted.',
              badge: 'Bank-grade security',
            },
            {
              icon: IndianRupee,
              title: 'Fair Flat Team Pricing',
              desc: 'No per-seat pricing that penalizes you for adding site engineers or supervisors. One transparent monthly rate in INR with GST tax invoicing.',
              badge: 'GST-ready billing',
            },
          ].map(({ icon: Icon, title, desc, badge }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-900 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-amber-400 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded-full bg-slate-100">
                    {badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Flagship Features Grid ─── */}
      <div className="bg-slate-50/80 py-20 border-y border-slate-200/70">
        <Section>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <Eyebrow>Comprehensive Suite</Eyebrow>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                One system connecting the head office to every active site
              </h2>
            </div>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 font-bold text-slate-900 hover:text-amber-600 transition-colors shrink-0"
            >
              Explore all 21 modules <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.slice(0, 9).map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-bold text-base text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/features"
              className="h-11 px-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-sm hover:bg-slate-50"
            >
              View detailed feature breakdowns & roadmap <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Section>
      </div>

      {/* ─── Operational Problem & Solution Scenarios ─── */}
      <div className="bg-slate-900 text-white py-20 border-t border-slate-800">
        <Section>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-400">Built For Construction Realities</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Solving the 3 costliest jobsite breakdowns
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              See how Task Pilot replaces informal guesswork with verified digital operational standards.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:bg-white/[0.07] transition-all">
              <div>
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" /> The WhatsApp Chaos Trap
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Unrecorded Changes & Missed Inspections</h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Pour approvals and drawing revisions get lost in cluttered WhatsApp groups. When rebar spacing is wrong or concrete finishes crack, there is no verifiable paper trail.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">The Task Pilot Solution</p>
                <p className="text-xs text-slate-300">
                  Enforced 3-step verification gates (In Progress → Under Review → Done). No task closes without engineer digital sign-off and mandatory photo evidence.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:bg-white/[0.07] transition-all">
              <div>
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" /> Ghost Labor & Attendance Fraud
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Inflated Muster Rolls & Disputed Overtime</h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Paper registers and proxy punches result in contractors billing for workers who were never on site, while disputed overtime claims turn into monthly headaches.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">The Task Pilot Solution</p>
                <p className="text-xs text-slate-300">
                  Point-in-time GPS check-ins validated against the project perimeter radius. Overtime beyond 8 hours is auto-calculated with zero battery drain.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between hover:bg-white/[0.07] transition-all">
              <div>
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" /> Late Budget Variance Discovery
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Cost Overruns Discovered Too Late</h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                  Site material purchases and labor advances are recorded weeks later on disconnected Excel sheets, obscuring project burn rates until profits evaporate.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">The Task Pilot Solution</p>
                <p className="text-xs text-slate-300">
                  Live BOQ Earned Value Management updates Planned Value (PV), Earned Value (EV), and Cost Performance Index (CPI) dynamically as site work progresses.
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── Construction Project Lifecycle ─── */}
      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>End-To-End Execution</Eyebrow>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            How Task Pilot powers your project lifecycle
          </h2>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            From initial BOQ tender import to final client snag clearance, every milestone is structured and verifiable.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Setup & BOQ Import',
              desc: 'Import your Bill of Quantities from Excel, configure site geofence coordinates, and provision roles for directors, engineers, and subcontractors.',
              icon: HardHat,
            },
            {
              step: '02',
              title: 'Daily Site Execution',
              desc: 'Engineers check in via GPS, log trade headcounts, conduct safety briefings, and submit Daily Progress Reports (DPRs) with timestamped photos.',
              icon: Activity,
            },
            {
              step: '03',
              title: 'Cost & Inventory Control',
              desc: 'Site material indents require approval before purchase. Goods Receipt Notes (GRN) and contractor advances sync directly into project spend.',
              icon: Boxes,
            },
            {
              step: '04',
              title: 'Quality & Handover',
              desc: 'Conduct pre-pour structural checklists and pre-handover snag audits. Rectifications are tracked to resolution with before/after photo proof.',
              icon: CheckCircle2,
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-3xl font-extrabold text-amber-500 block mb-2">{item.step}</span>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Industries Section ─── */}
      <div className="bg-slate-50 py-20 border-y border-slate-200">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Tailored For Your Sector</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Built for everyone in the construction lifecycle
            </h2>
            <p className="mt-3 text-slate-600">
              Whether you manage residential towers, highway packages, or fast-paced luxury fit-outs, Task Pilot adapts to your workflow.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {INDUSTRIES.map(({ slug, icon: Icon, name, headline }) => (
              <Link
                key={slug}
                to={`/industries/${slug}`}
                className="group rounded-2xl border border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all flex flex-col justify-between bg-white"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-amber-500/10 text-slate-700 group-hover:text-amber-700 flex items-center justify-center transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900 text-lg">{name}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{headline}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 group-hover:gap-2.5 transition-all">
                  See workflows <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── Pricing Section Preview ─── */}
      <div className="bg-white py-20">
        <Section>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>Transparent Pricing</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Simple flat pricing that grows with your projects
            </h2>
            <p className="mt-3 text-slate-600">
              Every plan includes a 14-day free trial with full feature access. No hidden user fees or surprises.
            </p>
          </div>
          <PricingCards />
        </Section>
      </div>

      {/* ─── FAQ Section ─── */}
      <Section className="py-20 max-w-3xl mx-auto border-t border-slate-100">
        <div className="text-center mb-12">
          <Eyebrow>Got Questions?</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-slate-600 text-sm">
            Everything you need to know about starting with Task Pilot.
          </p>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((f, i) => (
            <details key={f.q} className="group py-4" open={i === 0}>
              <summary className="flex items-center justify-between font-semibold text-slate-900 cursor-pointer list-none select-none">
                <span>{f.q}</span>
                <span className="ml-4 text-slate-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ─── Bottom CTA ─── */}
      <Section className="pb-20">
        <div className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ready to bring order to your jobsites?</h2>
            <p className="mt-2 text-slate-300 text-sm">Start your 14-day free trial now. Full features, no credit card required.</p>
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
              Book a live demo
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
};

export default ProductHomePage;
