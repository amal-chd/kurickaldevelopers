import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, MapPin, Eye, FileText, CheckCircle2, Mail, Building2 } from 'lucide-react';
import { MarketingLayout, Section, Eyebrow } from '../saas/marketing/MarketingLayout';
import { useSeo } from '../../lib/seo';

export default function PrivacyPolicyPage() {
  useSeo({
    title: 'Privacy Policy — Task Pilot',
    description: 'Privacy Policy for Task Pilot. Learn how we safeguard your organization’s construction data, blueprints, and GPS attendance information.',
    path: '/policy',
  });

  return (
    <MarketingLayout>
      {/* ─── Hero Banner ─── */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 pt-16 pb-12 border-b border-slate-100">
        <Section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-4 border border-amber-500/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-slate-500 text-xs sm:text-sm">
            Last Updated: November 18, 2026 · Effective Date: November 18, 2026
          </p>
        </Section>
      </div>

      {/* ─── Main Content ─── */}
      <Section className="py-16 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-sm space-y-10 text-slate-700 text-sm sm:text-base leading-relaxed">

          {/* Commitment Intro */}
          <section className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/70 text-slate-800">
            <h2 className="font-bold text-base text-amber-950 flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-600" />
              Our Core Privacy Commitment
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
              <strong>Task Pilot Technologies</strong> ("Task Pilot", "we", "us", or "our") provides project management,
              field operations, attendance, and commercial control software for the construction and built-environment sectors.
              We believe your drawings, BOQs, contractor wage rates, and jobsite data are strictly confidential property of your organization.
              We do not sell, rent, or monetize your customer data.
            </p>
          </section>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">1</span>
              Information We Collect
            </h2>
            <p className="mb-3">
              We collect information to provide, secure, and improve our services to you. This includes:
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-900 text-sm">Account & Profile Information</p>
                <p className="text-xs text-slate-600 mt-1">
                  Name, corporate email address, phone number, designated company role (e.g. Director, Project Manager, Site Engineer), and workspace credentials managed securely via authenticated sessions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-900 text-sm">Project & Jobsite Operational Data</p>
                <p className="text-xs text-slate-600 mt-1">
                  Tasks, inspection checklists, Daily Progress Reports (DPRs), manpower logs, weather logs, equipment allocations, and Bill of Quantities (BOQ) line items uploaded or entered by your users.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-900 text-sm">Drawings, Documents & Media</p>
                <p className="text-xs text-slate-600 mt-1">
                  Architectural and structural blueprints, work permits, safety inspection photos, and receipts uploaded into your private tenant document repository.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">2</span>
              GPS Location & Field Attendance Policy
            </h2>
            <div className="space-y-3">
              <p>
                Task Pilot offers tamper-proof GPS attendance verification for field personnel. Here is our strict location policy:
              </p>
              <ul className="list-disc ml-6 space-y-2 text-xs sm:text-sm text-slate-600">
                <li>
                  <strong className="text-slate-800">Point-in-Time Only:</strong> Location coordinates are captured <em>only at the precise moment</em> an employee initiates a "Check In" or "Check Out" action, or submits a Daily Progress Report.
                </li>
                <li>
                  <strong className="text-slate-800">No Continuous Background Tracking:</strong> Task Pilot does NOT continuously poll, monitor, or track employee GPS movements throughout the workday or when the application is closed.
                </li>
                <li>
                  <strong className="text-slate-800">Geofence Validation:</strong> Coordinates are compared against the site radius configured by your organization's administrators to verify on-site presence.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">3</span>
              Workspace Multi-Tenancy & Data Isolation
            </h2>
            <p>
              Every organization in Task Pilot is strictly partitioned in our database architecture.
              Access controls and row-level tenant security prevent any user from one organization accessing, viewing, or querying data belonging to another organization.
              Access within your workspace is determined by your administrator via our 8 role-permission tiers.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">4</span>
              Security & Storage
            </h2>
            <p>
              We implement industry-standard administrative, physical, and technical safeguards:
            </p>
            <ul className="mt-3 list-disc ml-6 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li>All web and mobile communication is encrypted in transit using TLS 1.3.</li>
              <li>Databases, documents, and backups are encrypted at rest using AES-256 encryption.</li>
              <li>Role-based authorization checks guard every administrative action, user modification, and financial export.</li>
              <li>Continuous automated backups and disaster recovery protocols.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">5</span>
              Third-Party Sub-Processors
            </h2>
            <p className="mb-3">
              We work with trusted cloud infrastructure providers to deliver our software:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-900">Cloud Hosting & Database</p>
                <p className="text-slate-500 mt-0.5">Google Cloud Platform & Supabase (Encrypted PostgreSQL & Realtime)</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-900">Payment Processing</p>
                <p className="text-slate-500 mt-0.5">Razorpay (PCI-DSS Level 1 compliant gateway for INR UPI & cards)</p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">6</span>
              Your Data Rights & Deletion
            </h2>
            <p>
              Your organization maintains full control over its data:
            </p>
            <ul className="mt-2 list-disc ml-6 space-y-1 text-xs sm:text-sm text-slate-600">
              <li><strong>Export:</strong> Administrators can export attendance records, task registers, and DPR summaries at any time to Excel/CSV.</li>
              <li><strong>Account Deletion:</strong> Upon subscription cancellation or request, organization data is scheduled for permanent purge following our grace period.</li>
              <li><strong>Corrections:</strong> Users can update profile information directly through their settings or contact their workspace administrator.</li>
            </ul>
          </section>

          {/* Section 7 - Contact */}
          <section className="pt-6 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">7</span>
              Contact Our Privacy Office
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              If you have any questions, compliance requests, or concerns regarding this Privacy Policy, please reach out to our dedicated privacy officer:
            </p>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-1.5">
              <p><strong className="text-slate-900">Task Pilot Technologies</strong></p>
              <p>Privacy & Data Protection Team</p>
              <p>Email:{' '}
                <a href="mailto:privacy@taskpilot.app" className="text-amber-700 font-semibold hover:underline">
                  privacy@taskpilot.app
                </a>
              </p>
              <p>General Legal Inquiries:{' '}
                <a href="mailto:legal@taskpilot.app" className="text-amber-700 font-semibold hover:underline">
                  legal@taskpilot.app
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
