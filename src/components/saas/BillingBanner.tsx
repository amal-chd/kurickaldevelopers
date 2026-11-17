import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { useTenantStore, trialDaysLeft, isReadOnlyStatus } from '../../lib/tenant';

/** Subscription status strip shown above every app page for SaaS tenants. */
const BillingBanner: React.FC = () => {
  const ctx = useTenantStore((s) => s.context);
  if (!ctx || ctx.org.is_legacy) return null;
  const { org, subscription } = ctx;

  if (isReadOnlyStatus(org.status)) {
    return (
      <div role="alert" className="bg-red-600 text-white text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Lock className="w-4 h-4 shrink-0" aria-hidden />
        <span>
          {org.status === 'expired' ? 'Your free trial has ended.' : org.status === 'cancelled' ? 'Your subscription is cancelled.' : 'Your workspace is suspended.'}{' '}
          The workspace is read-only — existing data is safe.
        </span>
        <Link to="/app/billing" className="font-semibold underline underline-offset-2">Choose a plan</Link>
      </div>
    );
  }
  if (org.status === 'past_due') {
    return (
      <div role="alert" className="bg-amber-500 text-amber-950 text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-x-3">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        <span>We couldn't process your last payment.</span>
        <Link to="/app/billing" className="font-semibold underline underline-offset-2">Update payment</Link>
      </div>
    );
  }
  if (org.status === 'trialing') {
    const days = trialDaysLeft(org);
    const mandateReady = subscription && ['authenticated', 'active'].includes(subscription.status);
    if (mandateReady) return null;
    return (
      <div className="bg-indigo-600 text-white text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-x-3">
        <Clock className="w-4 h-4 shrink-0" aria-hidden />
        <span>
          {days === 0 ? 'Your trial ends today.' : `${days} day${days === 1 ? '' : 's'} left in your ${ctx.plan?.name ?? ''} trial.`}
        </span>
        <Link to="/app/billing" className="font-semibold underline underline-offset-2">Subscribe now</Link>
      </div>
    );
  }
  return null;
};

export default BillingBanner;
