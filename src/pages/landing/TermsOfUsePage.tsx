import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';

export default function TermsOfUsePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen font-sans bg-[#f4f7f9] text-[#0f2143] selection:bg-[#1b61d4] selection:text-white">

      {/* ── Header ── */}
      <header className="bg-[#0f2143] py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="Task Pilot" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-2xl tracking-wide text-white uppercase">Task Pilot</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </header>

      {/* ── Banner ── */}
      <section className="bg-[#0f2143] pb-16 pt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b61d4]/20 rounded-full mb-6">
            <Scale className="w-8 h-8 text-[#1b61d4]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">Terms of Use</h1>
          <p className="text-blue-100/60 text-sm">Last updated: May 14, 2026</p>
        </div>
      </section>

      {/* ── Content ── */}
      <main className="relative z-10 -mt-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-8 md:p-12 space-y-10">

            {/* Introduction */}
            <section>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Welcome to Task Pilot by Kurickal Developers LLP ("Company," "we," "us," or "our"). These Terms of Use
                ("Terms") govern your access to and use of our website, mobile application, and Task Management System
                portal (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these
                Terms. If you do not agree, you may not use the Services.
              </p>
            </section>

            {/* 1. Acceptance of Terms */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">1</span>
                Acceptance of Terms
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  By creating an account, downloading our app, or using the Services in any way, you acknowledge that you
                  have read, understood, and agree to be bound by these Terms and our{' '}
                  <a href="/policy" className="text-[#1b61d4] hover:underline font-medium">Privacy Policy</a>,
                  which is incorporated into these Terms by reference.
                </p>
                <p>
                  If you are using the Services on behalf of an organization, you represent and warrant that you have the
                  authority to bind that organization to these Terms.
                </p>
              </div>
            </section>

            {/* 2. Account Terms */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">2</span>
                Account Terms
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <ul className="list-disc ml-6 space-y-2">
                  <li>You must be at least 18 years old to use the Services.</li>
                  <li>You must provide accurate and complete information when creating your account.</li>
                  <li>You are responsible for maintaining the security of your account credentials.</li>
                  <li>You must not share your account with any other person or allow unauthorized access.</li>
                  <li>You are responsible for all activities that occur under your account.</li>
                  <li>You must notify us immediately if you suspect any unauthorized use of your account.</li>
                </ul>
              </div>
            </section>

            {/* 3. Use of the Services */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">3</span>
                Acceptable Use
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>You agree to use the Services only for lawful purposes. You shall not:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>Use the Services in any way that violates applicable laws or regulations.</li>
                  <li>Upload, transmit, or distribute any content that is harmful, obscene, defamatory, or infringing.</li>
                  <li>Attempt to gain unauthorized access to any part of the Services, other accounts, or systems.</li>
                  <li>Interfere with or disrupt the integrity or performance of the Services.</li>
                  <li>Use the Services for any purpose other than construction project and task management.</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Services.</li>
                  <li>Use automated systems (bots, scrapers) to access the Services without permission.</li>
                </ul>
              </div>
            </section>

            {/* 4. Subscription & Payment Terms */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">4</span>
                Subscription & Payment Terms
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  Access to certain features of the Services may require a paid subscription. Where applicable:
                </p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>Subscription fees are billed in advance on a recurring basis (monthly or annual).</li>
                  <li>Subscriptions automatically renew unless cancelled before the end of the current billing period.</li>
                  <li>Prices are subject to change upon reasonable notice.</li>
                  <li>Refunds are handled in accordance with the applicable app store's refund policy (Apple App Store or Google Play Store).</li>
                  <li>You may cancel your subscription at any time through your app store account settings.</li>
                  <li>Upon cancellation, you retain access to the Services until the end of your current billing period.</li>
                </ul>
                <p>
                  For subscriptions purchased through the Apple App Store, payment is charged to your Apple ID account
                  at confirmation of purchase. The subscription automatically renews unless it is cancelled at least
                  24 hours before the end of the current period. Your account will be charged for renewal within 24 hours
                  prior to the end of the current period. You can manage and cancel your subscriptions by going to your
                  App Store account settings after purchase.
                </p>
              </div>
            </section>

            {/* 5. Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">5</span>
                Intellectual Property
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  The Services, including all content, features, and functionality (including but not limited to software,
                  text, designs, graphics, logos, and icons), are owned by Kurickal Developers LLP and protected by
                  intellectual property laws.
                </p>
                <p>
                  You retain ownership of any content you upload to the Services (e.g., project data, documents, photos).
                  By uploading content, you grant us a limited license to use, store, and display that content solely for
                  the purpose of providing the Services to you.
                </p>
              </div>
            </section>

            {/* 6. User Content */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">6</span>
                User Content
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  You are solely responsible for all data, information, and files that you upload, store, or transmit
                  through the Services ("User Content"). You represent and warrant that:
                </p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>You own or have the necessary rights to use and share the User Content.</li>
                  <li>Your User Content does not violate any applicable law or the rights of any third party.</li>
                  <li>Your User Content is accurate and not misleading.</li>
                </ul>
                <p>
                  We reserve the right to remove any User Content that violates these Terms.
                </p>
              </div>
            </section>

            {/* 7. Limitation of Liability */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">7</span>
                Limitation of Liability
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, KURICKAL DEVELOPERS LLP SHALL NOT BE LIABLE FOR ANY INDIRECT,
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
                  INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, OR GOODWILL, ARISING FROM:
                </p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>Your use of or inability to use the Services.</li>
                  <li>Any unauthorized access to or alteration of your data.</li>
                  <li>Any third-party conduct on the Services.</li>
                  <li>Any bugs, viruses, or errors in the Services.</li>
                </ul>
                <p>
                  Our total liability for any claims arising from or relating to these Terms or the Services shall not
                  exceed the amount you paid us in the twelve (12) months preceding the claim.
                </p>
              </div>
            </section>

            {/* 8. Disclaimer */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">8</span>
                Disclaimer of Warranties
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR
                ERROR-FREE.
              </p>
            </section>

            {/* 9. Termination */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">9</span>
                Termination
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  We may suspend or terminate your access to the Services at any time, with or without cause or notice, if
                  we believe you have violated these Terms or if your conduct may harm other users or the Company.
                </p>
                <p>
                  Upon termination, your right to use the Services will immediately cease. Provisions of these Terms that
                  by their nature should survive termination (including intellectual property, limitation of liability, and
                  dispute resolution) will remain in effect.
                </p>
              </div>
            </section>

            {/* 10. Governing Law */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">10</span>
                Governing Law
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to
                its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive
                jurisdiction of the courts in Kerala, India.
              </p>
            </section>

            {/* 11. Changes */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">11</span>
                Changes to These Terms
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting
                the updated Terms on this page and updating the "Last updated" date. Your continued use of the Services
                after any changes indicates your acceptance of the updated Terms.
              </p>
            </section>

            {/* 12. Contact */}
            <section className="bg-[#f4f7f9] -mx-8 md:-mx-12 -mb-8 md:-mb-12 px-8 md:px-12 py-10 rounded-b-lg">
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">12</span>
                Contact Us
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-2">
                <p>If you have any questions about these Terms, please contact us:</p>
                <div className="mt-4 space-y-1">
                  <p><strong className="text-[#0f2143]">Kurickal Developers LLP</strong></p>
                  <p>Email: <a href="mailto:info@kurickaldevelopers.com" className="text-[#1b61d4] hover:underline">info@kurickaldevelopers.com</a></p>
                  <p>Phone: <a href="tel:+919876543210" className="text-[#1b61d4] hover:underline">+91 98765 43210</a></p>
                  <p>Kerala, India</p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#0f2143] py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-white flex items-center justify-center rotate-45">
              <div className="w-3 h-3 bg-white -rotate-45" />
            </div>
            <span className="text-white font-bold tracking-wide text-lg uppercase">Kurickal Developers</span>
          </div>
          <p className="text-blue-100/40 text-[11px]">© {new Date().getFullYear()} Kurickal Developers LLP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
