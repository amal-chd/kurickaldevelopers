import React, { useState } from 'react';
import { CheckCircle2, Mail, Phone, Clock, ShieldCheck, MapPin } from 'lucide-react';
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
                  <p className="text-xs text-slate-500">We help import your open tasks, BOQ master sheets, and staff directory.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Custom Enterprise SLA & invoicing</p>
                  <p className="text-xs text-slate-500">Direct GST corporate invoicing, dedicated account manager, and custom training.</p>
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
                <span>India Tech Centers: Kochi & Bangalore</span>
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
                  <p className="text-xs text-slate-500 mt-1">Fill out the form below and we'll contact you within 2 hours.</p>
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
                      placeholder="Your Construction Firm"
                      autoComplete="organization"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Team Size
                    <select name="teamSize" value={f.teamSize} onChange={on} className={`${field} mt-1 bg-white cursor-pointer`}>
                      {['1-10 members', '11-50 members', '51-200 members', '200+ members'].map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Primary Interest
                    <select name="interest" value={f.interest} onChange={on} className={`${field} mt-1 bg-white cursor-pointer`}>
                      {['Live 30-Min Demo', 'Enterprise Custom Plan', 'Data Migration Help', 'Multi-Site Rollout', 'Other'].map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tell us about your active projects & current workflow challenges
                  <textarea
                    name="message"
                    value={f.message}
                    onChange={on}
                    rows={3}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm transition-all"
                    placeholder="e.g. Currently tracking 3 sites on WhatsApp and spreadsheets. Want to automate daily DPRs and GPS attendance..."
                  />
                </label>

                <button
                  disabled={busy}
                  className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-60 transition-all shadow-md shadow-slate-900/10"
                >
                  {busy ? 'Scheduling...' : 'Schedule My Walkthrough →'}
                </button>

                <p className="text-[11px] text-center text-slate-400 mt-2">
                  No obligation. We respect your privacy and never sell or share your data.
                </p>
              </form>
            )}
          </div>
        </Section>
      </div>
    </MarketingLayout>
  );
};

export default ContactSalesPage;
