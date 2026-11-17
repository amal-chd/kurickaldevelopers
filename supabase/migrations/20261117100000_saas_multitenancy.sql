-- ═══════════════════════════════════════════════════════════════════════════
--  Task Pilot SaaS — Phase 1: multi-tenancy, plans, billing, platform admin
--
--  BACKWARD COMPATIBLE BY DESIGN
--  • Every existing row is backfilled to the legacy organisation 'main'
--    (Kurickal Developers) — the same id already stored in Firestore
--    users.orgId, so web, mobile and Firestore stay consistent.
--  • org_id defaults to public.current_org_id(), which resolves to 'main'
--    for any client that doesn't send an org header (= every existing web
--    and mobile build). Existing apps therefore read/write exactly what they
--    did before.
--  • New tenants' clients send `x-org-id`; RLS scopes every tenant table to it.
--  • When Firebase is registered as a Supabase Third-Party Auth provider and
--    clients send the Firebase ID token, current_org_id() switches to
--    membership-verified resolution (see 20261117100100_* lockdown notes).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Org resolution ────────────────────────────────────────────────────────
create or replace function public.request_header(name text)
returns text language sql stable as $$
  select nullif(
    (nullif(current_setting('request.headers', true), '')::json ->> lower(name)),
    ''
  );
$$;

create or replace function public.current_org_id()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  hdr text := public.request_header('x-org-id');
  sub text := nullif(coalesce(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '');
  iss text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'iss', '');
  resolved text;
begin
  -- Firebase-authenticated request: trust only memberships.
  if sub is not null and iss like 'https://securetoken.google.com/%' then
    select m.org_id into resolved
      from public.org_members m
     where m.user_uid = sub and m.status = 'active'
       and (hdr is null or m.org_id = hdr)
     order by (m.org_id = coalesce(hdr, '')) desc, m.created_at
     limit 1;
    return resolved;               -- null ⇒ no tenant rows visible
  end if;
  -- Anonymous / legacy client: header, else the legacy org.
  return coalesce(hdr, 'main');
end $$;

-- ─── Plans ─────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id                     text primary key,
  name                   text not null,
  tagline                text,
  description            text,
  currency               text not null default 'INR',
  price_monthly          integer not null default 0,   -- minor units (paise)
  price_yearly           integer not null default 0,
  max_users              integer,                      -- null = unlimited
  max_projects           integer,
  max_storage_mb         integer,
  features               jsonb not null default '[]'::jsonb,  -- module keys
  trial_days             integer not null default 14,
  is_public              boolean not null default true,
  is_active              boolean not null default true,
  is_custom_pricing      boolean not null default false,
  highlight              boolean not null default false,
  sort_order             integer not null default 0,
  razorpay_plan_monthly  text,
  razorpay_plan_yearly   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

insert into public.plans (id, name, tagline, description, price_monthly, price_yearly,
  max_users, max_projects, max_storage_mb, features, trial_days, highlight, sort_order, is_custom_pricing)
values
 ('starter', 'Starter', 'For small contractors getting organised',
  'Tasks, projects, attendance with GPS, site diary, documents and team chat.',
  149900, 1499000, 10, 5, 10240,
  '["tasks","projects","team","documents","chat","site_diary","attendance","notifications"]', 14, false, 1, false),
 ('professional', 'Professional', 'For growing construction firms',
  'Everything in Starter plus expenses, leave, assets & equipment, reports and performance scoring.',
  399900, 3999000, 40, 25, 102400,
  '["tasks","projects","team","documents","chat","site_diary","attendance","notifications","expenses","leave","assets","reports","performance"]', 14, true, 2, false),
 ('business', 'Business', 'For multi-site builders & PMCs',
  'Everything in Professional plus payroll/salary slips, audit trail, advanced roles and priority support.',
  899900, 8999000, 150, null, 512000,
  '["tasks","projects","team","documents","chat","site_diary","attendance","notifications","expenses","leave","assets","reports","performance","salary","audit_log","advanced_roles","priority_support"]', 14, false, 3, false),
 ('enterprise', 'Enterprise', 'Unlimited scale, custom terms',
  'Unlimited users and projects, dedicated onboarding, SLA, custom integrations.',
  0, 0, null, null, null,
  '["tasks","projects","team","documents","chat","site_diary","attendance","notifications","expenses","leave","assets","reports","performance","salary","audit_log","advanced_roles","priority_support","sso","api_access"]', 0, false, 4, true)
on conflict (id) do nothing;

-- ─── Organisations ─────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id                    text primary key default gen_random_uuid()::text,
  name                  text not null,
  slug                  text unique,
  industry              text not null default 'construction',
  company_size          text,
  country               text not null default 'IN',
  currency              text not null default 'INR',
  timezone              text not null default 'Asia/Kolkata',
  logo_url              text,
  website               text,
  phone                 text,
  email                 text,
  address               text,
  tax_id                text,               -- GSTIN / VAT
  owner_uid             text,
  owner_email           text,
  status                text not null default 'trialing'
                        check (status in ('trialing','active','past_due','suspended','cancelled','expired')),
  plan_id               text references public.plans(id),
  billing_cycle         text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  enabled_modules       jsonb,              -- null ⇒ plan features; array ⇒ explicit override
  feature_overrides     jsonb not null default '{}'::jsonb,  -- {"module": true|false}
  limit_overrides       jsonb not null default '{}'::jsonb,  -- {"max_users": 500}
  settings              jsonb not null default '{}'::jsonb,
  onboarding_completed  boolean not null default false,
  is_legacy             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Legacy tenant: grandfathered on Enterprise, never expires.
insert into public.organizations (id, name, slug, industry, status, plan_id, onboarding_completed, is_legacy, owner_email)
values ('main', 'Kurickal Developers', 'kurickal', 'construction', 'active', 'enterprise', true, true, 'thomas@kurickaldevelopers.com')
on conflict (id) do nothing;

create table if not exists public.org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null references public.organizations(id) on delete cascade,
  user_uid    text not null,
  email       text,
  name        text,
  role_id     text,
  status      text not null default 'active' check (status in ('active','suspended','removed')),
  is_owner    boolean not null default false,
  invited_by  text,
  created_at  timestamptz not null default now(),
  unique (org_id, user_uid)
);
create index if not exists org_members_uid_idx on public.org_members(user_uid);

create table if not exists public.org_invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       text not null references public.organizations(id) on delete cascade,
  email        text not null,
  name         text,
  role_id      text,
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by   text,
  status       text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists org_invitations_org_idx on public.org_invitations(org_id);

-- ─── Billing ───────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    text not null references public.organizations(id) on delete cascade,
  plan_id                   text not null references public.plans(id),
  billing_cycle             text not null default 'monthly',
  status                    text not null default 'created',
     -- created | authenticated | active | pending | halted | cancelled | completed | paused | expired
  provider                  text not null default 'razorpay',
  provider_subscription_id  text unique,
  provider_customer_id      text,
  short_url                 text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  cancelled_at              timestamptz,
  created_by                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists subscriptions_org_idx on public.subscriptions(org_id);

create sequence if not exists public.invoice_number_seq start 1001;

create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  org_id               text not null references public.organizations(id) on delete cascade,
  subscription_id      uuid references public.subscriptions(id) on delete set null,
  invoice_number       text unique default ('TP-' || to_char(now(), 'YYYY') || '-' || nextval('public.invoice_number_seq')),
  provider             text not null default 'razorpay',
  provider_payment_id  text unique,
  provider_invoice_id  text,
  amount               integer not null,        -- minor units, tax inclusive
  tax_amount           integer not null default 0,
  currency             text not null default 'INR',
  status               text not null default 'paid' check (status in ('pending','paid','failed','refunded')),
  description          text,
  plan_id              text,
  period_start         timestamptz,
  period_end           timestamptz,
  billing_details      jsonb not null default '{}'::jsonb,
  paid_at              timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists payments_org_idx on public.payments(org_id);

create table if not exists public.billing_events (
  id            text primary key,              -- provider event id (idempotency)
  provider      text not null default 'razorpay',
  event_type    text not null,
  org_id        text,
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

-- ─── Platform (super-admin) ────────────────────────────────────────────────
create table if not exists public.platform_admins (
  email       text primary key,
  uid         text,
  role        text not null default 'owner' check (role in ('owner','admin','support','finance')),
  created_at  timestamptz not null default now()
);
-- Identity only — the password lives in Firebase Auth and is never stored here.
insert into public.platform_admins (email, role) values ('thekadaapp@gmail.com', 'owner')
on conflict (email) do nothing;

create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('general', '{"product_name":"Task Pilot","support_email":"support@taskpilot.app","default_trial_days":14,"default_plan":"professional","grace_period_days":7,"signups_enabled":true}'),
  ('tax', '{"gst_percent":18,"prices_include_tax":true,"seller_name":"Task Pilot","seller_gstin":""}'),
  ('maintenance', '{"enabled":false,"message":""}')
on conflict (key) do nothing;

create table if not exists public.platform_audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_uid    text,
  actor_email  text,
  action       text not null,
  target_type  text,
  target_id    text,
  org_id       text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists platform_audit_created_idx on public.platform_audit_logs(created_at desc);

create sequence if not exists public.ticket_number_seq start 1001;
create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  ticket_number     integer not null default nextval('public.ticket_number_seq'),
  org_id            text not null references public.organizations(id) on delete cascade,
  subject           text not null,
  category          text not null default 'general',   -- general|billing|bug|feature|account
  priority          text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status            text not null default 'open' check (status in ('open','pending','resolved','closed')),
  created_by_uid    text,
  created_by_email  text,
  created_by_name   text,
  assigned_to       text,
  last_reply_at     timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists support_tickets_org_idx on public.support_tickets(org_id);

create table if not exists public.support_ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.support_tickets(id) on delete cascade,
  author_uid   text,
  author_name  text,
  author_type  text not null default 'customer' check (author_type in ('customer','staff','system')),
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id);

-- ─── Tenant column on every existing data table ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'app_notifications','asset_assignments','asset_maintenance','assets','attendance',
    'audit_logs','chat_attachments','chat_channels','chat_messages','chat_typing','comments',
    'contact_inquiries','documents','expenses','leave_requests','performance_reviews',
    'performance_scores','projects','roles','salary_slips','settings','site_diaries',
    'subtasks','tasks','time_logs'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists org_id text', t);
    execute format('update public.%I set org_id = ''main'' where org_id is null', t);
    execute format('alter table public.%I alter column org_id set default public.current_org_id()', t);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('do $c$ begin if not exists (select 1 from pg_constraint where conname = %L) then
                      alter table public.%I add constraint %I foreign key (org_id) references public.organizations(id) on delete cascade;
                    end if; end $c$', t || '_org_fk', t, t || '_org_fk');
    execute format('create index if not exists %I on public.%I(org_id)', t || '_org_idx', t);

    -- Replace the open "allow all" policy with tenant scoping. For legacy
    -- clients current_org_id() = 'main' and every existing row is 'main',
    -- so visible data is unchanged.
    execute format('drop policy if exists "Allow all for anon" on public.%I', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format('create policy tenant_isolation on public.%I for all to anon, authenticated
                      using (org_id = (select public.current_org_id()))
                      with check (org_id = (select public.current_org_id()))', t);
  end loop;
end $$;

-- Public marketing contact form must keep working without any org context.
drop policy if exists contact_public_insert on public.contact_inquiries;
create policy contact_public_insert on public.contact_inquiries for insert to anon, authenticated with check (true);

-- ─── RLS on the new tables ─────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invitations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.billing_events enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Pricing is public. Everything else is read/written only through the
-- authenticated `saas-api` / `razorpay-webhook` edge functions (service role).
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select to anon, authenticated
  using (is_public and is_active);

-- Members of the current org can list who is in it (Team pages).
drop policy if exists org_members_read on public.org_members;
create policy org_members_read on public.org_members for select to anon, authenticated
  using (org_id = (select public.current_org_id()));

-- ─── Plan limits & suspended-tenant write guard ────────────────────────────
create or replace function public.org_effective_limit(p_org text, p_key text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (o.limit_overrides ->> p_key)::integer,
    case p_key when 'max_users' then p.max_users
               when 'max_projects' then p.max_projects
               when 'max_storage_mb' then p.max_storage_mb end)
  from public.organizations o left join public.plans p on p.id = o.plan_id
  where o.id = p_org;
$$;

create or replace function public.enforce_org_writable()
returns trigger language plpgsql security definer set search_path = public as $$
declare st text; legacy boolean;
begin
  select status, is_legacy into st, legacy from public.organizations where id = new.org_id;
  if legacy then return new; end if;
  if st in ('suspended','cancelled','expired') then
    raise exception 'ORG_INACTIVE: this workspace is %. Renew the subscription to make changes.', st
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.enforce_project_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer; used integer;
begin
  lim := public.org_effective_limit(new.org_id, 'max_projects');
  if lim is null then return new; end if;
  select count(*) into used from public.projects where org_id = new.org_id;
  if used >= lim then
    raise exception 'PLAN_LIMIT: your plan allows % projects. Upgrade to add more.', lim
      using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','tasks','documents','site_diaries','expenses','attendance','assets','chat_messages','leave_requests'] loop
    execute format('drop trigger if exists trg_org_writable on public.%I', t);
    execute format('create trigger trg_org_writable before insert on public.%I for each row execute function public.enforce_org_writable()', t);
  end loop;
end $$;
drop trigger if exists trg_project_limit on public.projects;
create trigger trg_project_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ─── Lifecycle: trial expiry, dunning, reminders ───────────────────────────
create or replace function public.run_subscription_lifecycle()
returns void language plpgsql security definer set search_path = public as $$
declare grace integer := coalesce((select (value->>'grace_period_days')::int from platform_settings where key='general'), 7);
begin
  -- Trial reminders (3 days and 1 day before end) to the owner.
  insert into public.app_notifications (id, title, body, user_id, is_read, type, related_id, related_type, created_at, org_id)
  select gen_random_uuid()::text,
         'Your Task Pilot trial ends ' || case when o.trial_ends_at::date = (now() + interval '1 day')::date then 'tomorrow' else 'in 3 days' end,
         'Choose a plan in Settings → Billing to keep your workspace running without interruption.',
         o.owner_uid, '{}'::jsonb, 'billing', o.id, 'organization', now(), o.id
    from public.organizations o
   where o.status = 'trialing' and o.owner_uid is not null
     and o.trial_ends_at::date in ((now() + interval '3 days')::date, (now() + interval '1 day')::date)
     and not exists (select 1 from public.app_notifications n
                      where n.related_id = o.id and n.type = 'billing' and n.created_at::date = now()::date);

  update public.organizations set status = 'expired', updated_at = now()
   where status = 'trialing' and trial_ends_at < now() and not is_legacy;

  update public.organizations set status = 'suspended', updated_at = now()
   where status = 'past_due' and not is_legacy
     and coalesce(current_period_end, now()) < now() - make_interval(days => grace);
end $$;

revoke execute on function public.run_subscription_lifecycle() from anon, authenticated, public;
revoke execute on function public.org_effective_limit(text, text) from anon, authenticated, public;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'taskpilot_subscription_lifecycle';
select cron.schedule('taskpilot_subscription_lifecycle', '15 * * * *', 'select public.run_subscription_lifecycle()');
