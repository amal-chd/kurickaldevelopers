# Task Pilot SaaS — Phase 1: audit, research, architecture and rollout

_Last updated 2026-11-17._

## 1. Audit summary (before Phase 1)

| Area | Finding | Impact on SaaS |
|---|---|---|
| Auth | Firebase Auth. User profiles in Firestore `users` (37 docs; 24 have `orgId: "main"`, 13 have no `orgId`). | Identity stays in Firebase. `orgId` becomes the tenant key. |
| Data | Supabase Postgres, 25 tables, real production data (2.3k attendance rows, 4.3k audit logs, 221 tasks). | No table had a tenant column. |
| Security | Every table had an `"Allow all for anon"` RLS policy (`USING true`). The client uses the anon key with no Supabase JWT. | With no tenant column, no isolation was possible. |
| Roles | Global `roles` table (14 roles). Firestore rules also read a legacy Firestore `roles` copy. | Roles must be per-org. Firestore needs a mirror for its rules. |
| Settings | Singleton rows with fixed ids (`org`, `task_assignment`, `performance_config`). | Ids would collide between tenants, so they need per-org ids. |
| Admin actions | `send-push` edge function creates, deletes and resets users and sends broadcasts. Every new user was hard-coded to `orgId: "main"`, and broadcasts went to all users. | Needed org scoping. |
| Auto-provisioning | `ensureUserDoc` silently created a `main` profile for any unknown login. | A SaaS sign-up would have joined the Kurickal workspace. Now fixed. |
| Website | `/` is the Kurickal Developers company site. | Kept unchanged. The SaaS site lives alongside it. |
| Mobile | Flutter app in its own nested repo (`mobile_app/`, pushes to `origin/mobile`). It reads Supabase with the anon key. | Needs an org-aware build before outside tenants use mobile (see §6). |

## 2. Competitive research

| Segment | Examples | Pricing model | Where Task Pilot wins |
|---|---|---|---|
| Global enterprise suites | Procore, Autodesk Build | Priced on annual construction volume, roughly $10k–$100k+/yr. No public price list. | Price, INR billing and setup time. |
| Residential and builder suites | Buildertrend | Flat rate with unlimited users, about $99–$829/mo (sources conflict). Quote after a sales call. | Transparent self-serve pricing and a trial with no card. |
| Field tools | Fieldwire | Per user: free for 5 users, then $39/$64/$89 per user per month. | Flat team pricing: 10 users on Fieldwire Pro is about $390/mo, Task Pilot Starter is ₹1,499/mo. |
| India SMB apps | Powerplay, Onsite | Mobile-first, labour and material focus. No public INR prices found. | Office-and-field depth: approvals, performance scoring, HR and expenses, documents. |
| Construction ERPs (India) | Various | Licence around ₹0.5–12L plus AMC. | No implementation project; live in a day. |

Sources: [projul pricing guide 2026](https://projul.com/blog/construction-software-pricing-guide-2026/), [per-user vs flat-rate](https://projul.com/blog/construction-software-pricing-models-per-user-vs-flat-rate/), [Procore pricing review](https://constructable.ai/blog/procore-reviews-pricing-alternatives), [India construction ERP pricing](https://concorderp.blogspot.com/2026/04/construction-erp-pricing-in-india-what.html). These are third-party figures that disagree with each other, so verify them before quoting.

**Positioning:** construction work management for Indian SMB and mid-market contractors. Field-first, flat team pricing in INR with UPI AutoPay, and live in a day.

**Seeded plans** (editable in Platform Console → Plans; prices in paise, GST-inclusive):

| Plan | Monthly | Yearly | Users | Projects | Adds |
|---|---|---|---|---|---|
| Starter | ₹1,499 | ₹14,990 | 10 | 5 | Tasks, projects, team, attendance, site diary, documents, chat |
| Professional ★ | ₹3,999 | ₹39,990 | 40 | 25 | Expenses, leave, assets, reports, performance |
| Business | ₹8,999 | ₹89,990 | 150 | ∞ | Salary, audit trail, advanced roles, priority support |
| Enterprise | Custom | — | ∞ | ∞ | SSO, API, SLA (sales-led) |

## 3. Architecture

```
Browser / Mobile ──Firebase ID token──► saas-api (edge fn, service role) ──► organizations, plans,
       │                                   │  verifies token, enforces           subscriptions, payments,
       │                                   │  member / org-admin / platform      invitations, tickets,
       │                                   │  role per action                    platform_* tables
       │                                   └──► Razorpay API
       │
       └──anon key + x-org-id header──► PostgREST ──RLS: org_id = current_org_id()──► tenant tables
                                                                                    (all 25 existing)
Razorpay ──HMAC-signed webhook──► razorpay-webhook (edge fn) ──► subscriptions / payments / org status
pg_cron (hourly) ──► run_subscription_lifecycle(): trial reminders, trial expiry, past_due → suspended
```

### Tenancy
- `organizations.id` is the tenant key. The legacy workspace is **`main`**, the same value already on Firestore `users.orgId`. It is grandfathered on Enterprise with `is_legacy = true`, never expires and has every module.
- Every existing table gained `org_id text not null default public.current_org_id()` with an FK and index. All existing rows were backfilled to `main`.
- `public.current_org_id()`:
  - **Firebase-authenticated request** (stage B): resolves to the org from `org_members` for `auth.jwt()->>'sub'`. The `x-org-id` header is honoured only if the user is a member of that org.
  - **Anon request** (stage A, today): uses the `x-org-id` header, or `main` when the header is absent. Existing web and mobile builds send no header, so they keep seeing exactly what they saw before.
- The `"Allow all for anon"` policies were replaced with `tenant_isolation` (`org_id = (select current_org_id())`). Public inserts into `contact_inquiries` still work.
- Billing, subscription, platform and support tables have **no** client policies (except public `plans` read and own-org `org_members` read). They are reachable only through `saas-api` with a verified Firebase token.
- Firestore rules (`firestore.rules`, versioned; not deployed yet): users can read only same-org profiles, `orgId` is immutable from clients, and team managers act only within their own org.

### Two-stage isolation (be clear about this)
- **Stage A (this change):** data is correctly scoped for the official clients. A malicious user holding the anon key could still forge `x-org-id`. That is the same exposure as before (previously everything was open), but it is **not** cryptographic isolation.
- **Stage B (go-live gate for paying customers):**
  1. Register Firebase as a Third-Party Auth provider in Supabase.
  2. Run `scripts/saas-backfill.cjs --apply` to set the `role=authenticated` claims.
  3. Set `VITE_SUPABASE_FIREBASE_AUTH=true` on web and ship the mobile equivalent.
  4. Run the "lockdown" SQL in §6, which drops the anon branch.

  After that, the org comes from the verified token and realtime streams per tenant. Until then, non-legacy tenants get polling instead of realtime (`tenantPoll`).

### Feature access and limits
- Effective modules come from the plan `features`, then the tenant's `enabled_modules` subset (Organization page), then platform `feature_overrides`.
- Enforced in three places:
  - Sidebar visibility.
  - `ModuleGate`, which shows an upgrade page instead of the route.
  - Server-side: the seat limit is checked in `invite_member` and `send-push create_user`. The project limit and read-only status are enforced by **DB triggers**, so no client can bypass them.

### Billing (Razorpay Subscriptions)
- The checkout flow:
  1. `create_subscription` lazily creates the Razorpay plan per (plan, cycle) and creates the subscription. During a trial it uses `start_at = trial end`.
  2. Razorpay Checkout runs in the browser.
  3. `verify_payment` checks the HMAC `payment_id|subscription_id` with the key secret.
- The webhook is the source of truth for renewals and failures (`pending`/`halted` → `past_due`; cancelled → read-only at period end). It is idempotent via `billing_events`.
- Upgrades take effect immediately. Downgrades apply at cycle end and are checked against current usage.
- GST invoices (CGST/SGST split, printable or PDF) come from `payments`. Seller name and GSTIN are set in Platform Console → Settings.

### Super-admin
- `platform_admins` is seeded with **thekadaapp@gmail.com** (role `owner`). It stores no password.
- Access requires that the Firebase account with that email has a **verified email or Google sign-in**. On first access the uid is pinned, so a re-registered address cannot take over.
- `/platform` provides:
  - an overview with MRR/ARR, revenue and signups by month, and breakdowns
  - companies, with status, plan, trial, limit and feature overrides
  - plans editor, billing (payments and subscriptions), support tickets with replies
  - users, sales leads, announcements, audit log, and settings (signups, trial, grace period, tax/GST, admin roster)

## 4. What shipped in Phase 1

| Area | Files |
|---|---|
| Migration | `supabase/migrations/20261117100000_saas_multitenancy.sql` |
| Control-plane API | `supabase/functions/saas-api/index.ts` |
| Payments webhook | `supabase/functions/razorpay-webhook/index.ts` |
| Tenant-aware admin actions | `supabase/functions/send-push/index.ts` (create/delete/reset/broadcast scoped to org, seat limits) |
| Client tenancy | `src/lib/tenant.ts`, `src/lib/saasApi.ts`, `x-org-id` on every request (`supabaseClient.ts`), scoped settings ids, scoped Firestore user queries, role mirror |
| Marketing | `/product`, `/pricing` (live plans, comparison, FAQ), `/features`, `/industries/:slug` (6), `/contact-sales` (→ Leads) |
| Onboarding | `/register` (account → company → trial), `/onboarding`, `/invite/:token` |
| Tenant admin | `/app/organization` (profile, modules, invitations), `/app/billing` (+ invoices), `/app/support` |
| Super-admin | `/platform/*` |
| Tests | `src/lib/tenant.test.ts` |

## 5. Rollout runbook

1. **Apply the migration** (additive; legacy behaviour unchanged): `20261117100000_saas_multitenancy.sql`.
2. **Backfill** with `node scripts/saas-backfill.cjs` (dry run), then `--apply`. Run the printed SQL in Supabase.
3. **Function secrets:**
   ```
   supabase secrets set RAZORPAY_KEY_ID=… RAZORPAY_KEY_SECRET=… RAZORPAY_WEBHOOK_SECRET=… APP_URL=https://<app domain> --project-ref ximaqbhnykyxxgiqbwoh
   ```
   (`FIREBASE_SERVICE_ACCOUNT` already exists.) Use test keys first.
4. **Deploy functions:**
   ```
   npx --no-install supabase functions deploy saas-api --project-ref ximaqbhnykyxxgiqbwoh --no-verify-jwt
   npx --no-install supabase functions deploy razorpay-webhook --project-ref ximaqbhnykyxxgiqbwoh --no-verify-jwt
   npx --no-install supabase functions deploy send-push --project-ref ximaqbhnykyxxgiqbwoh --no-verify-jwt
   ```
5. **Razorpay webhook:** point it at `…/functions/v1/razorpay-webhook` with events `subscription.*` and `payment.failed`.
6. **Firestore rules:** `firebase deploy --only firestore:rules`. Run this after step 2 so every user has an `orgId`.
7. **Web deploy:** `git push origin master:main` (Vercel). For a dedicated SaaS domain, set `VITE_SITE_MODE=saas` so `/` becomes the product home.
8. **Super-admin:** sign in to `/register` or `/login` as thekadaapp@gmail.com, verify the email (the console offers to send the verification), then open `/platform`.
9. **Stage B** (before onboarding outside paying tenants): see §3. This also requires the mobile build in §6.

## 6. Roadmap

**Phase 1.5: hardening (next)**
- Mobile (Flutter):
  - Send `x-org-id` from `users.orgId` (or the Firebase token once stage B is on).
  - Hide modules by plan.
  - Show the billing banner.
  - Block login for inactive orgs.
  - Release to the stores before outside tenants use mobile.
- Stage B lockdown SQL:
  ```sql
  -- after both clients send Firebase tokens
  create or replace function public.current_org_id() … -- remove the anon branch (return null when no Firebase sub)
  ```
- Storage buckets: prefix object paths with `org_id/` and add matching storage policies.
- Transactional email (invites, receipts, trial reminders) through a provider such as Resend or SES. Today invites are shared as links (copy or WhatsApp) and reminders are sent in-app.
- Storage-quota metering. The limit exists, but enforcement needs per-org storage usage.

**Phase 2: construction modules** (each behind a module key, so other industries can turn them off)
- BOQ and estimation (items, rates, quantities, versions); project cost monitoring (budget vs. committed vs. actual from expenses and POs)
- Material and inventory (stores, GRN, issue to site, stock alerts); purchase orders linked to expenses
- Labour and contractor management (contractor register, daily labour count in the site diary, wage sheets); work orders
- Inspections, checklists and safety (templates, sign-off, NCRs, photo evidence, incident log)
- Gantt timelines, milestones and dependencies; client approvals portal (the `client` role exists already)

**Phase 3: scale and enterprise**
- SSO (Google Workspace / SAML), public API and webhooks, data export
- Custom domains and branding per tenant, offline-first mobile sync
- Usage analytics and churn signals in the platform console, dunning emails, coupons, and reseller/partner accounts
