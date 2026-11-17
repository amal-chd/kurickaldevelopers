import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MarketingLayout, Section, Eyebrow } from './MarketingLayout';
import { saasApi } from '../../../lib/saasApi';
import { useSeo } from '../../../lib/seo';

const field = 'w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm';

const ContactSalesPage: React.FC = () => {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', teamSize: '11-50', interest: 'Demo', message: '' });
  useSeo({ title: 'Book a demo', description: 'See Task Pilot on your own projects. Book a 30-minute walkthrough with our team.', path: '/contact-sales' });
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
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketingLayout>
      <Section className="py-16 grid lg:grid-cols-2 gap-12">
        <div>
          <Eyebrow>Talk to us</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">See Task Pilot on your own projects</h1>
          <p className="mt-4 text-slate-600">Book a 30-minute walkthrough. We'll set up a workspace with your sites and roles so your team can try it the same day.</p>
          <ul className="mt-6 space-y-3 text-slate-700">
            {['Live demo tailored to your workflow', 'Help importing projects and staff', 'Enterprise pricing and custom terms'].map((x) => (
              <li key={x} className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          {done ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h2 className="mt-4 text-xl font-bold">Thanks — we'll be in touch shortly</h2>
              <p className="mt-2 text-slate-600 text-sm">We usually reply within one business day.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block text-sm font-medium">Name<input required name="name" value={f.name} onChange={on} className={`${field} mt-1`} autoComplete="name" /></label>
                <label className="block text-sm font-medium">Work email<input required type="email" name="email" value={f.email} onChange={on} className={`${field} mt-1`} autoComplete="email" /></label>
                <label className="block text-sm font-medium">Phone<input name="phone" value={f.phone} onChange={on} className={`${field} mt-1`} autoComplete="tel" /></label>
                <label className="block text-sm font-medium">Company<input required name="company" value={f.company} onChange={on} className={`${field} mt-1`} autoComplete="organization" /></label>
                <label className="block text-sm font-medium">Team size
                  <select name="teamSize" value={f.teamSize} onChange={on} className={`${field} mt-1 bg-white`}>
                    {['1-10', '11-50', '51-200', '200+'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">I'm interested in
                  <select name="interest" value={f.interest} onChange={on} className={`${field} mt-1 bg-white`}>
                    {['Demo', 'Enterprise plan', 'Data migration', 'Partnership', 'Other'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium">Message<textarea name="message" value={f.message} onChange={on} rows={4} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-900 outline-none text-sm" /></label>
              <button disabled={busy} className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60">{busy ? 'Sending…' : 'Request a demo'}</button>
            </form>
          )}
        </div>
      </Section>
    </MarketingLayout>
  );
};

export default ContactSalesPage;
