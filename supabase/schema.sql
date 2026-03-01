-- =====================================================
-- Materials Testing Lab — Supabase Database Schema
-- =====================================================
-- Run this entire script in the Supabase SQL Editor
-- (Project → SQL Editor → New Query → Paste → Run)
-- =====================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- =====================================================
-- PROFILES
-- Extends the built-in auth.users table.
-- role: 'admin' = lab staff, 'client' = customer
-- =====================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('admin','client')),
  full_name   text,
  company     text,
  phone       text,
  created_at  timestamptz default now()
);

-- Automatically create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- PROJECTS
-- A project groups related samples together.
-- =====================================================
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.profiles(id) on delete set null,
  project_name  text not null,
  project_number text,
  location      text,
  engineer      text,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- =====================================================
-- SAMPLES
-- Individual samples submitted for testing.
-- =====================================================
create table if not exists public.samples (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  sample_label    text not null,           -- e.g. "S-01", "Core-3B"
  material_type   text not null,           -- 'soil','concrete','asphalt','aggregate'
  description     text,
  collection_date date,
  location_detail text,                    -- station, depth, lift, etc.
  submitted_by    text,
  status          text not null default 'received'
                  check (status in ('received','in-progress','complete','hold')),
  received_at     timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- =====================================================
-- TEST RESULTS
-- One row per individual test performed on a sample.
-- =====================================================
create table if not exists public.test_results (
  id            uuid primary key default gen_random_uuid(),
  sample_id     uuid references public.samples(id) on delete cascade,
  test_name     text not null,             -- e.g. "Standard Proctor"
  standard      text,                      -- e.g. "ASTM D698"
  result_value  text,                      -- numeric or descriptive
  unit          text,                      -- e.g. "pcf", "psi", "%"
  pass_fail     text check (pass_fail in ('pass','fail','n/a')),
  spec_value    text,                      -- required spec if applicable
  tested_date   date,
  technician    text,
  notes         text,
  report_path   text,                      -- path in Supabase Storage
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- =====================================================
-- QUOTE REQUESTS
-- Captures submissions from the public contact form.
-- =====================================================
create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  company       text,
  email         text not null,
  phone         text,
  project_name  text,
  tests_needed  text,
  timeline      text,
  status        text not null default 'new'
                check (status in ('new','contacted','converted','closed')),
  created_at    timestamptz default now()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.samples       enable row level security;
alter table public.test_results  enable row level security;
alter table public.quote_requests enable row level security;

-- Helper: check if the calling user is an admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- PROFILES: users can read/update their own; admins can read all
create policy "profiles: own read"
  on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles: own update"
  on public.profiles for update using (auth.uid() = id);
create policy "profiles: admin insert"
  on public.profiles for insert with check (public.is_admin());

-- PROJECTS: admins full access; clients see only their own projects
create policy "projects: admin all"
  on public.projects for all using (public.is_admin());
create policy "projects: client select"
  on public.projects for select using (client_id = auth.uid());

-- SAMPLES: admins full access; clients see samples on their projects
create policy "samples: admin all"
  on public.samples for all using (public.is_admin());
create policy "samples: client select"
  on public.samples for select using (
    exists (
      select 1 from public.projects p
      where p.id = samples.project_id and p.client_id = auth.uid()
    )
  );

-- TEST RESULTS: admins full access; clients see results on their samples
create policy "results: admin all"
  on public.test_results for all using (public.is_admin());
create policy "results: client select"
  on public.test_results for select using (
    exists (
      select 1 from public.samples s
      join public.projects p on p.id = s.project_id
      where s.id = test_results.sample_id and p.client_id = auth.uid()
    )
  );

-- QUOTE REQUESTS: anyone can insert (public form); only admins can read/manage
create policy "quotes: public insert"
  on public.quote_requests for insert with check (true);
create policy "quotes: admin all"
  on public.quote_requests for select using (public.is_admin());
create policy "quotes: admin update"
  on public.quote_requests for update using (public.is_admin());

-- =====================================================
-- STORAGE — "reports" bucket policies
-- Prerequisite: create the bucket first:
--   Storage → New bucket → name: "reports" → Private
-- Then run the SQL below (or paste into SQL Editor).
-- =====================================================

-- Admins: full access to the reports bucket
create policy "reports: admin insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reports'
    and public.is_admin()
  );

create policy "reports: admin select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and public.is_admin()
  );

create policy "reports: admin update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'reports'
    and public.is_admin()
  );

create policy "reports: admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reports'
    and public.is_admin()
  );

-- Clients: read-only access to reports linked to their own samples
create policy "reports: client select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and exists (
      select 1
      from public.test_results tr
      join public.samples s  on s.id  = tr.sample_id
      join public.projects p on p.id  = s.project_id
      where tr.report_path = storage.objects.name
        and p.client_id    = auth.uid()
    )
  );

-- =====================================================
-- PROCTOR COMPACTION TESTS (ASTM D698 / D1557)
-- One proctor_test per sample test; one proctor_point
-- per compaction data point (typically 5-6 per test).
-- =====================================================
create table if not exists public.proctor_tests (
  id               uuid primary key default gen_random_uuid(),
  sample_id        uuid references public.samples(id) on delete cascade,
  standard         text not null default 'ASTM D698'
                   check (standard in ('ASTM D698','ASTM D1557')),
  mold_volume      numeric not null default 0.0333,  -- ft³
  spec_gravity     numeric not null default 2.65,    -- Gs for ZAV curve
  max_dry_density  numeric,                          -- pcf, auto-calculated
  optimum_moisture numeric,                          -- %, auto-calculated
  technician       text,
  tested_date      date,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists public.proctor_points (
  id               uuid primary key default gen_random_uuid(),
  proctor_test_id  uuid references public.proctor_tests(id) on delete cascade,
  point_number     int not null,
  moisture_content numeric not null,  -- %
  dry_density      numeric not null,  -- pcf
  created_at       timestamptz default now()
);

-- Link test_results rows back to their proctor test (nullable)
alter table public.test_results
  add column if not exists proctor_test_id uuid
  references public.proctor_tests(id) on delete set null;

-- RLS
alter table public.proctor_tests  enable row level security;
alter table public.proctor_points enable row level security;

create policy "proctor_tests: admin all"
  on public.proctor_tests for all using (public.is_admin());

create policy "proctor_tests: client select"
  on public.proctor_tests for select using (
    exists (
      select 1 from public.samples s
      join public.projects p on p.id = s.project_id
      where s.id = proctor_tests.sample_id
        and p.client_id = auth.uid()
    )
  );

create policy "proctor_points: admin all"
  on public.proctor_points for all using (public.is_admin());

create policy "proctor_points: client select"
  on public.proctor_points for select using (
    exists (
      select 1
      from public.proctor_tests pt
      join public.samples s  on s.id  = pt.sample_id
      join public.projects p on p.id  = s.project_id
      where pt.id = proctor_points.proctor_test_id
        and p.client_id = auth.uid()
    )
  );

-- =====================================================
-- SEED: Create your first admin user
-- 1. Sign the user up normally via the portal login
-- 2. Then run this to promote them to admin:
--    UPDATE public.profiles SET role='admin'
--    WHERE id = '<paste-user-uuid-here>';
-- =====================================================
