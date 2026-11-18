import React, { useState } from 'react';
import { CheckCircle2, Mail, Clock, MapPin, ChevronDown, Calendar, ShieldCheck, Laptop, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { saasApi } from '../../../lib/saasApi';
import { useSeo } from '../../../lib/seo';

const field = 'w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm transition-all';

const ContactSalesPage: React.FC = () => {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', teamSize: '11-50', interest: 'Demo', message: '' });
  useSeo({
    title: 'Book a Demo & Contact Sales — Task Pilot',
    description: 'See Task Pilot tailored to your construction sites. Book a 30-minute personalized walkthrough with our solutions engineering team.',
    path: '/contact-sales',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const on = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [e.target.name]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saasApi('public_contact', f, { public: true });
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again or email us.');
    } finally {
      setBusy(false);
    }
  };

  const salesFaqs = [
    {
      q: 'Can we test Task Pilot on a single pilot project first?',
      a: 'Yes, absolutely. We encourage prospective contractors and developers to start with a 14-day trial on a single active jobsite to experience the difference in daily DPR submission and GPS attendance before rolling out across their entire portfolio.',
    },
    {
      q: 'How long does it take for field supervisors and site engineers to learn the app?',
      a: 'Most site engineers and supervisors learn Task Pilot in under 15 minutes. The mobile interface was designed specifically with large tap targets and straightforward workflows so field personnel can use it immediately without formal IT training.',
    },
    {
      q: 'Can we pay via annual bank transfer (NEFT/RTGS) with a GST invoice?',
      a: 'Yes. In addition to UPI AutoPay and credit/debit cards on Razorpay, Business and Enterprise plans can be invoiced directly via company bank transfer with full GST tax invoices issued for your input tax credit.',
    },
    {
      q: 'What happens if a jobsite has spotty or intermittent 4G connectivity?',
      a: 'Task Pilot is engineered with offline cache resilience. Site teams can record attendance, take DPR progress photos, and fill out checklists even in basements or remote work fronts. Data syncs automatically once connectivity is restored.',
    },
  ];

  return (
    <MarketingLayout>
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 py-16 sm:py-20 border-b border-slate-100">
        <Section className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <Eyebrow>Direct Solutions Advisory</Eyebrow>
            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              See Task Pilot on your own construction sites
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Book a 30-minute tailored walkthrough. We’ll show you how to structure your sites, roles, and daily reporting
              to eliminate WhatsApp confusion and keep projects on budget.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Live walkthrough of your workflows</p>
                  <p className="text-xs text-slate-500">We simulate your actual trades, subcontract structure, and site hierarchy.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Complimentary data onboarding</p>
                  <p className="text-xs text-slate-500">We help import your open tasks, BOQ master sheets, and staff directory in 48 hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Custom Enterprise SLA & GST invoicing</p>
                  <p className="text-xs text-slate-500">Direct GST corporate invoicing, dedicated account manager, and on-site engineer training.</p>
                </div>
              </div>
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Direct Email:{' '}
                  <a href="mailto:sales@taskpilot.app" className="font-semibold text-slate-900 hover:text-amber-600 underline">
                    sales@taskpilot.app
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Response Time: <strong className="text-slate-900">Within 2 hours</strong> (Mon–Sat, 9am–7pm IST)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Product Engineering & Support: India</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5">
            {done ? (
              <div className="text-center py-12 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Demo Request Confirmed</h2>
                <p className="mt-2 text-slate-600 text-sm max-w-sm mx-auto leading-relaxed">
                  Thank you! Our solutions engineering team has received your details and will reach out shortly to schedule your walkthrough.
                </p>
                <button
                  onClick={() => setDone(false)}
                  className="mt-6 text-sm font-semibold text-amber-700 hover:underline"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="mb-2">
                  <h3 className="text-xl font-bold text-slate-900">Request a Personalized Walkthrough</h3>
                  <p className="text-xs text-slate-500 mt-1">Fill out the form below and our team will contact you within 2 hours.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Your Name *
                    <input
                      required
                      name="name"
                      value={f.name}
                      onChange={on}
                      className={`${field} mt-1`}
                      placeholder="e.g. Arun Nair"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Work Email *
                    <input
                      required
                      type="email"
                      name="email"
                      value={f.email}
                      onChange={on}
                      className={`${field} mt-1`}
                      placeholder="arun@yourcompany.com"
                      autoComplete="email"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Phone / WhatsApp *
                    <input
                      required
                      name="phone"
                      value={f.phone}
                      onChange={on}
                      className={`${field} mt-1`}
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Company Name *
                    <input
                      required
                      name="company"
                      value={f.company}
                      onChange={on}
                      className={`${field} mt-1`}
                      placeholder="e.g. Apex Civil Projects"
                      autoComplete="organization"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Active Team Size
                    <select name="teamSize" value={f.teamSize} onChange={on} className={`${field} mt-1 bg-white`}>
                      <option value="1-10">1 - 10 people</option>
                      <option value="11-50">11 - 50 people</option>
                      <option value="51-200">51 - 200 people</option>
                      <option value="200+">200+ people</option>
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Primary Interest
                    <select name="interest" value={f.interest} onChange={on} className={`${field} mt-1 bg-white`}>
                      <option value="Demo">General Product Walkthrough</option>
                      <option value="GPS & DPR">GPS Attendance & Daily Site Diary</option>
                      <option value="BOQ & Cost">BOQ Cost Control & Earned Value</option>
                      <option value="Enterprise">Custom Enterprise Deployment</option>
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Project Details / Specific Questions
                  <textarea
                    rows={3}
                    name="message"
                    value={f.message}
                    onChange={on}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm transition-all"
                    placeholder="Tell us about your active sites, current tools, or specific requirements..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
                >
                  {busy ? 'Sending request…' : 'Schedule 30-Minute Walkthrough'}
                </button>
              </form>
            )}
          </div>
        </Section>
      </div>

      {/* ─── What to Expect Section ─── */}
      <Section className="py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>The Walkthrough Process</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            What to expect on your 30-minute call
          </h2>
          <p className="mt-2 text-slate-600 text-sm">
            No generic sales pitches. We dive straight into your actual site execution and project structure.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 font-extrabold text-sm flex items-center justify-center mb-4">
              01
            </span>
            <h3 className="font-bold text-base text-slate-900 mb-1">Discovery & Site Structure</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We understand your active projects, trades, subcontractor arrangements, and where your current reporting bottlenecks occur.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 font-extrabold text-sm flex items-center justify-center mb-4">
              02
            </span>
            <h3 className="font-bold text-base text-slate-900 mb-1">Tailored Live Simulation</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We demonstrate how a supervisor records attendance and DPR photos on mobile, and how that syncs in real time with the head office BOQ tracker.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-800 font-extrabold text-sm flex items-center justify-center mb-4">
              03
            </span>
            <h3 className="font-bold text-base text-slate-900 mb-1">Complimentary Pilot Setup</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              If Task Pilot is a fit, we set up your 14-day free trial workspace immediately and help import your active projects and user roles.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Pre-Sales FAQs ─── */}
      <div className="bg-slate-50 py-20 border-t border-slate-200">
        <Section className="max-w-3xl">
          <div className="text-center mb-10">
            <Eyebrow>Common Inquiries</Eyebrow>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Questions builders ask before booking
            </h2>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white rounded-2xl p-6 shadow-sm">
            {salesFaqs.map((faq, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-semibold text-slate-900 gap-4"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </MarketingLayout>
  );
};

export default ContactSalesPage;
