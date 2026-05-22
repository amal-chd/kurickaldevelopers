import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <Shield className="w-8 h-8 text-[#1b61d4]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">Privacy Policy</h1>
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
                Kurickal Developers LLP ("we," "us," or "our") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you visit our website, use our Task Management System (TMS) portal, or use our mobile application
                (collectively, the "Services"). Please read this policy carefully.
              </p>
            </section>

            {/* 1. Information We Collect */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">1</span>
                Information We Collect
              </h2>
              <div className="space-y-4 text-[15px] text-slate-600 leading-relaxed">
                <div>
                  <h3 className="font-semibold text-[#0f2143] mb-1">Personal Data</h3>
                  <p>When you use our Services, we may collect personally identifiable information including but not limited to:</p>
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Full name, email address, and phone number</li>
                    <li>Company or organization name</li>
                    <li>Profile photograph (if uploaded)</li>
                    <li>Job title and role within the organization</li>
                    <li>Login credentials (email and password, managed through Firebase Authentication)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f2143] mb-1">Usage Data</h3>
                  <p>We automatically collect certain information when you access our Services:</p>
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Device type, operating system, and browser type</li>
                    <li>IP address and approximate geographic location</li>
                    <li>Pages visited, features used, and time spent on the platform</li>
                    <li>App crash reports and performance diagnostics</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f2143] mb-1">Project & Task Data</h3>
                  <p>Data you voluntarily enter into our TMS, including:</p>
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Project details, task descriptions, comments, and attachments</li>
                    <li>Site diary entries and daily logs</li>
                    <li>Chat messages and communication records</li>
                    <li>Documents uploaded to the system</li>
                    <li>Attendance and time-tracking records</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 2. How We Use Your Information */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">2</span>
                How We Use Your Information
              </h2>
              <ul className="space-y-2 text-[15px] text-slate-600 leading-relaxed">
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To provide, operate, and maintain our Services</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To manage your account and provide customer support</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To send push notifications regarding task updates, assignments, and deadlines</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To facilitate real-time communication between team members</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To generate reports and analytics for project management</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To improve and personalize the user experience</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To respond to contact form inquiries submitted through our website</li>
                <li className="flex gap-2"><span className="text-[#1b61d4] mt-1">•</span> To detect, prevent, and address technical issues and security threats</li>
              </ul>
            </section>

            {/* 3. Data Storage & Security */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">3</span>
                Data Storage & Security
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>
                  Your data is stored securely using Google Firebase infrastructure, which includes Cloud Firestore
                  for database storage, Firebase Authentication for identity management, and Firebase Cloud Storage
                  for file uploads. All data is encrypted in transit using TLS/SSL protocols.
                </p>
                <p>
                  We implement industry-standard security measures including role-based access controls (RBAC),
                  server-side security rules, and regular security audits. However, no method of electronic
                  transmission or storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            {/* 4. Data Sharing */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">4</span>
                Data Sharing & Disclosure
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li><strong>Within your organization:</strong> Team members within the same organization may view project-related data as permitted by their assigned role and permissions.</li>
                  <li><strong>Service providers:</strong> We use Google Firebase and Google Cloud Platform as our infrastructure providers, governed by Google's Data Processing Terms.</li>
                  <li><strong>Legal obligations:</strong> We may disclose your information if required by law, court order, or governmental regulation.</li>
                  <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction.</li>
                </ul>
              </div>
            </section>

            {/* 5. Push Notifications */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">5</span>
                Push Notifications
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Our mobile application uses Firebase Cloud Messaging (FCM) to deliver push notifications about
                task assignments, due dates, messages, and other project-related updates. You can opt out of
                push notifications at any time through your device settings. Disabling notifications will not
                affect other functionality of the app.
              </p>
            </section>

            {/* 6. Cookies */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">6</span>
                Cookies & Local Storage
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Our web application uses browser local storage and session cookies to maintain your login session
                and preferences. These are essential for the proper functioning of the Services. We do not use
                third-party tracking cookies or advertising cookies.
              </p>
            </section>

            {/* 7. Data Retention */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">7</span>
                Data Retention
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                We retain your personal data for as long as your account is active or as needed to provide you
                with our Services. Project data, including tasks, diary entries, and communications, is retained
                for the duration of the project and a reasonable period thereafter for record-keeping purposes.
                If you wish to delete your account or request data deletion, please contact us using the
                information provided below.
              </p>
            </section>

            {/* 8. Your Rights */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">8</span>
                Your Rights
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-3">
                <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>The right to access your personal data</li>
                  <li>The right to correct inaccurate or incomplete data</li>
                  <li>The right to request deletion of your personal data</li>
                  <li>The right to object to or restrict processing of your data</li>
                  <li>The right to data portability</li>
                </ul>
                <p>
                  To exercise any of these rights, please contact us at the email address provided below.
                  We will respond to your request within 30 days.
                </p>
              </div>
            </section>

            {/* 9. Children's Privacy */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">9</span>
                Children's Privacy
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Our Services are not intended for individuals under the age of 18. We do not knowingly collect
                personal data from children. If we become aware that we have collected personal data from a child,
                we will take steps to delete such information immediately.
              </p>
            </section>

            {/* 10. Changes */}
            <section>
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">10</span>
                Changes to This Policy
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by
                posting the updated policy on this page and updating the "Last updated" date. Your continued
                use of the Services after any changes indicates your acceptance of the updated policy.
              </p>
            </section>

            {/* 11. Contact */}
            <section className="bg-[#f4f7f9] -mx-8 md:-mx-12 -mb-8 md:-mb-12 px-8 md:px-12 py-10 rounded-b-lg">
              <h2 className="text-xl font-semibold text-[#0f2143] mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#1b61d4]/10 text-[#1b61d4] text-sm font-bold rounded-full">11</span>
                Contact Us
              </h2>
              <div className="text-[15px] text-slate-600 leading-relaxed space-y-2">
                <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
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
