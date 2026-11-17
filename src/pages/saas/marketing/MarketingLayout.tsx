import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { INDUSTRIES } from './content';

export const SAAS_HOME = import.meta.env.VITE_SITE_MODE === 'saas' ? '/' : '/product';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/industries/construction', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact-sales', label: 'Book a demo' },
];

export const MarketingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] bg-white px-3 py-2 rounded shadow">Skip to content</a>
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={SAAS_HOME} className="flex items-center gap-2.5" aria-label="Task Pilot home">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg" />
            <span className="font-bold tracking-tight text-lg">Task Pilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'text-slate-900 bg-slate-100' : 'text-slate-600 hover:text-slate-900'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/login" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Sign in</Link>
            <Link to="/register" className="h-9 px-4 inline-flex items-center rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Start free trial</Link>
          </div>
          <button className="md:hidden p-2 -mr-2" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => <Link key={n.to} to={n.to} className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">{n.label}</Link>)}
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 text-sm font-medium">Sign in</Link>
              <Link to="/register" className="flex-1 h-10 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-semibold">Start free trial</Link>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="bg-slate-950 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-white font-bold"><img src="/logo.png" alt="" className="w-7 h-7 rounded" /> Task Pilot</div>
            <p className="mt-3 leading-relaxed">Work management for construction and field teams — tasks, sites, attendance and approvals in one place.</p>
          </div>
          <div>
            <p className="text-white font-semibold mb-3">Product</p>
            <ul className="space-y-2">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/manual" className="hover:text-white">Field manual</Link></li>
              <li><Link to="/register" className="hover:text-white">Start free trial</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold mb-3">Industries</p>
            <ul className="space-y-2">
              {INDUSTRIES.slice(0, 5).map((i) => <li key={i.slug}><Link to={`/industries/${i.slug}`} className="hover:text-white">{i.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold mb-3">Company</p>
            <ul className="space-y-2">
              <li><Link to="/contact-sales" className="hover:text-white">Contact sales</Link></li>
              <li><Link to="/policy" className="hover:text-white">Privacy policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms of use</Link></li>
              <li><Link to="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Task Pilot. All rights reserved.</div>
      </footer>
    </div>
  );
};

export const Section: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = '', id }) => (
  <section id={id} className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</section>
);

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">{children}</p>
);
