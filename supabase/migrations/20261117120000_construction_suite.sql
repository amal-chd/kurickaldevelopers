-- ═══════════════════════════════════════════════════════════════════════════
--  Task Pilot — Construction Suite (Phase 2)
--  BOQ & cost control · Materials & inventory · Labour & contractors ·
--  Inspections, checklists & punch list · Project timeline (milestones)
--
--  Purely additive: new tables + one nullable column (tasks.start_date).
--  Every table is tenant-scoped exactly like the core tables
--  (org_id default current_org_id(), tenant_isolation RLS, write guard).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── BOQ ───────────────────────────────────────────────────────────────────
create table if not exists public.boq_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id    text not null,
  code          text,
  description   text not null,
  category      text,
  unit          text not null default 'nos',
  quantity      numeric not null default 0 check (quantity >= 0),
  rate          numeric not null default 0 check (rate >= 0),
  executed_qty  numeric not null default 0 check (executed_qty >= 0),
  sort_order    integer not null default 0,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists boq_items_project_idx on public.boq_items(org_id, project_id);

-- ─── Materials ─────────────────────────────────────────────────────────────
create table if not exists public.materials (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name          text not null,
  code          text,
  category      text,
  unit          text not null default 'nos',
  min_stock     numeric not null default 0,
  default_rate  numeric not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists materials_org_name_uq on public.materials(org_id, lower(name));

create table if not exists public.material_movements (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  material_id   uuid not null references public.materials(id) on delete cascade,
  project_id    text not null,
  kind          text not null check (kind in ('receipt','issue','return','adjustment')),
  quantity      numeric not null check (quantity <> 0),   -- signed: + into site stock, − out of it
  rate          numeric not null default 0,
  supplier      text,
  reference     text,       -- invoice / challan / GRN number
  note          text,
  date          date not null default current_date,
  created_by    text,
  created_by_name text,
  created_at    timestamptz not null default now()
);
create index if not exists material_movements_idx on public.material_movements(org_id, project_id, material_id);

create table if not exists public.material_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  material_id   uuid not null references public.materials(id) on delete cascade,
  project_id    text not null,
  quantity      numeric not null check (quantity > 0),
  required_by   date,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','ordered','received')),
  note          text,
  requested_by  text,
  requested_by_name text,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists material_requests_idx on public.material_requests(org_id, status);

-- Current stock per project & material (RLS of the base table applies).
create or replace view public.material_stock with (security_invoker = true) as
  select m.org_id, mm.project_id, m.id as material_id, m.name, m.unit, m.category, m.min_stock,
         sum(mm.quantity) as quantity,
         sum(case when mm.kind = 'receipt' then mm.quantity * mm.rate else 0 end) as received_value,
         max(mm.date) as last_movement
    from public.materials m
    join public.material_movements mm on mm.material_id = m.id
   group by m.org_id, mm.project_id, m.id, m.name, m.unit, m.category, m.min_stock;

-- ─── Labour & contractors ──────────────────────────────────────────────────
create table if not exists public.contractors (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name          text not null,
  trade         text,
  phone         text,
  tax_id        text,
  address       text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.labour_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id      text not null,
  contractor_id   uuid references public.contractors(id) on delete set null,
  date            date not null default current_date,
  category        text not null,                 -- Mason, Helper, Carpenter, Bar bender…
  headcount       integer not null check (headcount >= 0),
  rate            numeric not null default 0,    -- per head per day
  overtime_hours  numeric not null default 0,
  overtime_rate   numeric not null default 0,    -- per hour (whole crew)
  amount          numeric generated always as (headcount * rate + overtime_hours * overtime_rate) stored,
  note            text,
  created_by      text,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists labour_entries_idx on public.labour_entries(org_id, project_id, date);

create table if not exists public.labour_payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  contractor_id  uuid not null references public.contractors(id) on delete cascade,
  project_id     text,
  kind           text not null default 'payment' check (kind in ('payment','advance')),
  amount         numeric not null check (amount > 0),
  date           date not null default current_date,
  reference      text,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);

-- ─── Inspections, checklists & punch list ──────────────────────────────────
create table if not exists public.inspection_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name        text not null,
  category    text not null default 'quality' check (category in ('quality','safety','handover','other')),
  items       jsonb not null default '[]'::jsonb,   -- [{id,label,required}]
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.inspections (
  id             uuid primary key default gen_random_uuid(),
  org_id         text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id     text not null,
  template_id    uuid references public.inspection_templates(id) on delete set null,
  title          text not null,
  category       text not null default 'quality',
  location       text,
  status         text not null default 'draft' check (status in ('draft','passed','failed')),
  results        jsonb not null default '[]'::jsonb,  -- [{id,label,result:'pass'|'fail'|'na'|null,note}]
  score          numeric,                              -- % of applicable items passed
  notes          text,
  inspector_id   text,
  inspector_name text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists inspections_idx on public.inspections(org_id, project_id);

create table if not exists public.punch_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id     text not null,
  inspection_id  uuid references public.inspections(id) on delete set null,
  title          text not null,
  description    text,
  location       text,
  priority       text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status         text not null default 'open' check (status in ('open','in_progress','ready_for_review','closed')),
  assignee_id    text,
  due_date       date,
  photo_urls     jsonb not null default '[]'::jsonb,
  created_by     text,
  closed_by      text,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists punch_items_idx on public.punch_items(org_id, project_id, status);

-- ─── Timeline ──────────────────────────────────────────────────────────────
create table if not exists public.project_milestones (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id    text not null,
  name          text not null,
  due_date      date not null,
  status        text not null default 'pending' check (status in ('pending','done')),
  completed_at  timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists project_milestones_idx on public.project_milestones(org_id, project_id);

alter table public.tasks add column if not exists start_date timestamptz;

-- ─── Security: tenant isolation + inactive-org write guard ─────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'boq_items','materials','material_movements','material_requests','contractors','labour_entries',
    'labour_payments','inspection_templates','inspections','punch_items','project_milestones'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format('create policy tenant_isolation on public.%I for all to anon, authenticated
                      using (org_id = (select public.current_org_id()))
                      with check (org_id = (select public.current_org_id()))', t);
    execute format('drop trigger if exists trg_org_writable on public.%I', t);
    execute format('create trigger trg_org_writable before insert on public.%I for each row execute function public.enforce_org_writable()', t);
  end loop;
end $$;

-- ─── Plans: add the new modules ────────────────────────────────────────────
update public.plans set features = features || '["timeline"]'::jsonb
 where id = 'starter' and not features ? 'timeline';
update public.plans set features = features || '["timeline","inspections","materials","labour"]'::jsonb
 where id = 'professional' and not features ? 'inspections';
update public.plans set features = features || '["timeline","inspections","materials","labour","boq"]'::jsonb
 where id in ('business','enterprise') and not features ? 'boq';
update public.plans set description = 'Everything in Starter plus inspections & punch lists, materials, labour & contractors, expenses, leave, assets, reports and performance scoring.'
 where id = 'professional';
update public.plans set description = 'Everything in Professional plus BOQ & cost control, payroll/salary slips, audit trail, advanced roles and priority support.'
 where id = 'business';

-- ─── Realtime for the field-heavy tables ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['punch_items','material_requests','labour_entries'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
