-- ════════════════════════════════════════════════════════════════════
-- IV DrugRef — Supabase Auth / admin gate (Phase 2 step 1)
-- Run in: Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── Step 1.2a: admin allowlist + helper (run BEFORE testing dashboard login) ──
create table if not exists public.admins (
  email    text primary key,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies on admins → only the SQL editor / service role can read it
-- directly. The dashboard checks admin status through the SECURITY DEFINER
-- function below (which bypasses RLS for its internal lookup).

create or replace function public.is_admin() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.admins where email = (auth.jwt() ->> 'email')
  );
$$;

-- Seed the first admin (add more rows for more admins).
insert into public.admins(email) values ('thapanat.nk@gmail.com')
  on conflict (email) do nothing;


-- ── Step 1.2b: LOCK event reads to admins ───────────────────────────
-- Only authenticated admins can SELECT events; the anon INSERT policy (in
-- schema.sql) stays, so the public app keeps logging analytics. This is now
-- ACTIVE committed IaC (previously it lived only as a comment, so the repo's
-- SQL didn't converge to the production policy — running these files fresh left
-- the dashboard unable to read events). is_admin() is defined above, so ordering
-- within this file is safe; run schema.sql first for the events table itself.
drop policy if exists "anon read events" on public.events;
drop policy if exists "admin read events" on public.events;
create policy "admin read events" on public.events
  for select to authenticated using (public.is_admin());
