-- ════════════════════════════════════════════════════════════════════
-- IV DrugRef — Supabase reference-data schema (Phase 2 step 2)
-- Tables for the admin-maintained clinical reference data (drugs, compat
-- pairs, renal dosing). Each row keeps the full record in `data` (jsonb) —
-- the app already consumes these as JSON objects, so mapping stays trivial.
-- RLS: PUBLIC read (the app shows this to everyone) + ADMIN-only writes
-- (verified via public.is_admin(), created in auth.sql).
-- Run in: Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────
create table if not exists public.drugs (
  id         int primary key,            -- existing numeric drug id
  generic    text,
  status     text not null default 'approved',
  data       jsonb not null,             -- the full drug object
  updated_at timestamptz not null default now()
);

create table if not exists public.compat_pairs (
  id         text primary key,           -- the sheet's id (stringified) for upsert
  drug_a     text,
  drug_b     text,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.renal_drugs (
  id         text primary key,           -- existing string id (e.g. 'vancomycin')
  name       text,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists drugs_generic_idx      on public.drugs (generic);
create index if not exists compat_pairs_a_idx     on public.compat_pairs (drug_a);
create index if not exists compat_pairs_b_idx     on public.compat_pairs (drug_b);

-- ── RLS: public read, admin write ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['drugs','compat_pairs','renal_drugs'] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "public read %1$s" on public.%1$I;', t);
    execute format(
      'create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true);', t);

    execute format('drop policy if exists "admin write %1$s" on public.%1$I;', t);
    execute format(
      'create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- NOTE: a one-time data backfill (GAS → these tables) follows, using the
-- Phase-1 pattern (temporary anon INSERT during migration, then removed).


-- ── Allergy tables (Phase 2, added later) ───────────────────────────
create table if not exists public.allergy_groups (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.allergy_refs (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['allergy_groups','allergy_refs'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "public read %1$s" on public.%1$I;', t);
    execute format('create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true);', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$I;', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;
