import React from 'react';
import { Scale } from 'lucide-react';
import { MarketingLayout, Section } from '../saas/marketing/MarketingLayout';
import { useSeo } from '../../lib/seo';

export default function TermsOfUsePage() {
  useSeo({
    title: 'Terms of Use — Task Pilot',
    description: 'Terms of Use and Subscription Agreement for Task Pilot construction management platform.',
    path: '/terms',
  });

  return (
    <MarketingLayout>
      {/* ─── Hero Banner ─── */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 pt-16 pb-12 border-b border-slate-100">
        <Section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider mb-4">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Customer Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Terms of Use
          </h1>
          <p className="mt-3 text-slate-500 text-xs sm:text-sm">
            Last Updated: November 18, 2026 · Effective Date: November 18, 2026
          </p>
        </Section>
      </div>

      {/* ─── Main Content ─── */}
      <Section className="py-16 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-sm space-y-10 text-slate-700 text-sm sm:text-base leading-relaxed">

          {/* Intro Notice */}
          <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800">
            <p className="text-xs sm:text-sm leading-relaxed">
              Welcome to <strong>Task Pilot</strong>, operated by <strong>Task Pilot Technologies</strong> ("Company," "we," "us," or "our").
              These Terms of Use ("Terms") govern your access to and use of our web portal, mobile applications (Android and iOS),
              and related cloud services (collectively, the "Services"). By registering a workspace, starting a trial, or using the Services,
              you agree to be bound by these Terms on behalf of your organization.
            </p>
          </section>

          {/* 1. Subscription & Free Trial */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">1</span>
              Free Trial & Subscription Plans
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <p>
                <strong>14-Day Free Trial:</strong> All paid plans include an unrestricted 14-day free trial. No credit card or upfront payment is required to start. During your trial, you have full access to the features included in your chosen plan tier.
              </p>
              <p>
                <strong>Billing in INR:</strong> Subscriptions are billed in Indian Rupees (INR) on a monthly or yearly cycle through our secure payment gateway partner (Razorpay). Prices include applicable GST, and automated tax invoices are delivered to your billing email.
              </p>
              <p>
                <strong>Cancellation:</strong> You may cancel or downgrade your subscription at any time from Settings → Billing. Access continues until the conclusion of your current prepaid billing cycle without penalty.
              </p>
            </div>
          </section>

          {/* 2. Customer Data Ownership */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">2</span>
              Customer Data & Intellectual Property
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <p>
                <strong>Your Data Remains Yours:</strong> Your organization retains 100% ownership, title, and all intellectual property rights to all drawings, Bill of Quantities (BOQ), rate cards, photos, task histories, and personal records entered into your workspace.
              </p>
              <p>
                <strong>Platform IP:</strong> Task Pilot Technologies retains all rights, title, and interest in the Task Pilot software, application code, mobile apps, user interfaces, documentation, logos, and trademarks.
              </p>
            </div>
          </section>

          {/* 3. Account Responsibilities & Authorized Users */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">3</span>
              Authorized Users & Role Assignments
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-3">
              Your organization's administrator manages who is invited to join your workspace. Users are provisioned under specific roles (Director, Admin, Project Manager, Site Engineer, Foreman, Labour, Accounts, Client View-Only).
            </p>
            <ul className="list-disc ml-6 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>You are responsible for maintaining the confidentiality of user login credentials.</li>
              <li>You agree to promptly revoke access for any departed employee or contractor.</li>
              <li>Task Pilot assigns permissions based strictly on the role configured by your workspace administrators.</li>
            </ul>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">4</span>
              Acceptable Use Policy
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-3">
              You agree not to use the Services to:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-xs sm:text-sm text-slate-600">
              <li>Upload malicious code, viruses, or unauthorized scrapers.</li>
              <li>Attempt to reverse engineer, decompile, or breach the multi-tenant isolation boundaries of the platform.</li>
              <li>Falsify GPS attendance coordinates or tamper with audit verification mechanisms.</li>
              <li>Resell, lease, or sublicense workspace access to third parties outside your authorized projects.</li>
            </ul>
          </section>

          {/* 5. Service Availability & Support */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">5</span>
              Service Level & Support
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              We target a 99.9% uptime for core operational systems (GPS Attendance, Task Sign-Offs, and DPR Logging).
              Scheduled maintenance is communicated in advance and conducted during off-peak hours.
              Standard email support is provided to all active accounts, with priority support and dedicated onboarding available on Business and Enterprise tiers.
            </p>
          </section>

          {/* 6. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">6</span>
              Limitation of Liability
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TASK PILOT TECHNOLOGIES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, PROJECT DELAYS,
              WORK STOPPAGES, OR LOSS OF BUSINESS DATA ARISING OUT OF OR IN CONNECTION WITH THE USE OF OUR SERVICES.
              OUR TOTAL AGGREGATE LIABILITY UNDER THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOUR ORGANIZATION
              TO TASK PILOT DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* 7. Governing Law */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">7</span>
              Governing Law & Jurisdiction
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              These Terms shall be governed by and construed in accordance with the laws of India.
              Any disputes arising under or related to these Terms shall be subject to the exclusive jurisdiction of the courts of Kerala, India.
            </p>
          </section>

          {/* 8. Contact */}
          <section className="pt-6 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">8</span>
              Contact Us
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              If you have any questions regarding these Terms or enterprise agreements, please contact:
            </p>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-1.5">
              <p><strong className="text-slate-900">Task Pilot Technologies</strong></p>
              <p>Legal & Corporate Compliance</p>
              <p>Email:{' '}
                <a href="mailto:legal@taskpilot.app" className="text-amber-700 font-semibold hover:underline">
                  legal@taskpilot.app
                </a>
              </p>
              <p>Customer Support:{' '}
                <a href="mailto:support@taskpilot.app" className="text-amber-700 font-semibold hover:underline">
                  support@taskpilot.app
                </a>
              </p>
              <p className="text-slate-500 pt-1">India Operations: Kochi & Bangalore</p>
            </div>
          </section>

        </div>
      </Section>
    </MarketingLayout>
  );
}
