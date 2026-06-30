-- ════════════════════════════════════════════════════════════════════
-- IV DrugRef — Supabase schema for Drug–Drug Interaction (DDI) data
-- (admin-managed, Phase 2 step 3). Mirrors supabase/refdata.sql:
--   • ddi_pairs       — curated explicit interaction pairs
--   • ddi_class_rules — keyword → additive-risk classes mapping
-- The CLASS DEFINITIONS themselves (label/severity/icon/mechanism/management
-- per class) stay hardcoded in js/drug-interactions.js — they are structural,
-- not data the pharmacist edits day-to-day. Admin maintains WHICH drugs map to
-- which class (ddi_class_rules) and the named pairs (ddi_pairs).
-- RLS: PUBLIC read (the app screens for everyone) + ADMIN-only writes
-- (public.is_admin(), created in auth.sql).
-- Run in: Supabase Dashboard → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────
create table if not exists public.ddi_pairs (
  id         text primary key,           -- sheet id (stringified) for upsert
  a          text,                       -- display/keyword for side A
  b          text,                       -- display/keyword for side B
  data       jsonb not null,             -- {a|aAny, b|bAny, severity, mechanism, management, ref}
  updated_at timestamptz not null default now()
);

create table if not exists public.ddi_class_rules (
  id         text primary key,           -- sheet id (stringified) for upsert
  keyword    text,                       -- lowercase substring matched against a generic
  data       jsonb not null,             -- {keyword, classes:[...]}
  updated_at timestamptz not null default now()
);

create index if not exists ddi_pairs_a_idx        on public.ddi_pairs (a);
create index if not exists ddi_pairs_b_idx        on public.ddi_pairs (b);
create index if not exists ddi_class_rules_kw_idx on public.ddi_class_rules (keyword);

-- ── RLS: public read, admin write ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ddi_pairs','ddi_class_rules'] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "public read %1$s" on public.%1$I;', t);
    execute format(
      'create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true);', t);

    execute format('drop policy if exists "admin write %1$s" on public.%1$I;', t);
    execute format(
      'create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- NOTE: a one-time backfill (GAS → these tables) follows via the ADMIN GAS
-- editor: migrateDDIToSupabaseNow() (defined in gas-complete.js), which seeds
-- the curated pairs + class rules currently hardcoded in drug-interactions.js.
