import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, CheckCircle2 } from 'lucide-react';
import { INDUSTRIES } from './content';

export const SAAS_HOME = import.meta.env.VITE_SITE_MODE === 'company' ? '/product' : '/';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/industries/construction', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/company', label: 'About' },
  { to: '/manual', label: 'Field Manual' },
  { to: '/contact-sales', label: 'Book a demo' },
];

export const MarketingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] bg-white px-3 py-2 rounded shadow font-semibold">Skip to content</a>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={SAAS_HOME} className="flex items-center gap-2.5 group" aria-label="Task Pilot home">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg shadow-xs group-hover:scale-105 transition-transform" />
            <span className="font-extrabold tracking-tight text-lg text-slate-900">Task Pilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive ? 'text-slate-950 bg-slate-100' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2.5">
            <Link to="/login" className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="h-9 px-4 inline-flex items-center rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all"
            >
              Start free trial
            </Link>
          </div>
          <button
            className="md:hidden p-2 -mr-2 text-slate-700 hover:text-slate-900"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {n.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-3 border-t border-slate-100 mt-2">
              <Link to="/login" className="flex-1 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Sign in
              </Link>
              <Link to="/register" className="flex-1 h-10 inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow-sm">
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">{children}</main>

      <footer className="bg-slate-950 text-slate-400 text-sm border-t border-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <img src="/logo.png" alt="" className="w-7 h-7 rounded" />
              <span>Task Pilot</span>
            </div>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              Construction and field operations operating system. Unifying task sign-offs, tamper-proof GPS attendance, Daily Progress Reports (DPR), and BOQ cost control across every site.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Platform Status: All Systems Operational</span>
            </div>
          </div>

          <div>
            <p className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Product</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><Link to="/features" className="hover:text-white transition-colors">All 21 Modules</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing & Plans</Link></li>
              <li><Link to="/manual" className="hover:text-white transition-colors">Staff Field Manual</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">14-Day Free Trial</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Sectors</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              {INDUSTRIES.map((i) => (
                <li key={i.slug}>
                  <Link to={`/industries/${i.slug}`} className="hover:text-white transition-colors">
                    {i.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Company</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li><Link to="/company" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/contact-sales" className="hover:text-white transition-colors">Contact Sales</Link></li>
              <li><Link to="/policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Account Sign In</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} Task Pilot Technologies. All rights reserved.</p>
            <p className="text-slate-400">Next-Generation Construction Project Management</p>
          </div>
        </div>
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
