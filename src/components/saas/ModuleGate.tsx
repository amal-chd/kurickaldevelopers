import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useTenantStore, hasModule, moduleForPath, MODULES } from '../../lib/tenant';

/**
 * Blocks pages whose module isn't in the tenant's plan, showing an upgrade
 * prompt instead of a silent redirect. The legacy workspace and any state
 * where the plan hasn't loaded yet are always allowed through.
 */
const ModuleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const ctx = useTenantStore((s) => s.context);
  const mod = moduleForPath(pathname);
  if (!mod || hasModule(ctx, mod)) return <>{children}</>;
  const meta = MODULES.find((m) => m.key === mod);
  return (
    <div className="max-w-lg mx-auto mt-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-5">
        <Sparkles className="w-7 h-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-slate-900">{meta?.label ?? 'This module'} isn't in your plan</h1>
      <p className="text-slate-500 mt-2 text-sm">{meta?.description} Upgrade your plan to unlock it for your whole team.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/app/billing" className="inline-flex items-center h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">See plans</Link>
        <Link to="/app/dashboard" className="inline-flex items-center h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to dashboard</Link>
      </div>
    </div>
  );
};

export default ModuleGate;
