-- ════════════════════════════════════════════════════════════════════
-- IV DrugRef — Supabase analytics schema (Phase 1)
-- ────────────────────────────────────────────────────────────────────
-- Single append-only table for ALL analytics events (replaces the 17
-- Google Sheets analytics tabs). Run this once in:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Re-running is safe (everything is "if not exists" / drop-then-create).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),    -- SERVER time (authoritative, always UTC)
  client_ts   timestamptz,                           -- time reported by the browser (optional)
  type        text        not null,                  -- event kind: 'session','search','page_view',...
  session_id  text,
  user_id     text,
  app_version text,
  data        jsonb       not null default '{}'::jsonb -- event-specific fields (query, drug_name, ...)
);

-- Indexes — keep dashboard queries fast as the table grows.
create index if not exists events_ts_idx       on public.events (ts);
create index if not exists events_type_ts_idx  on public.events (type, ts);
create index if not exists events_user_id_idx  on public.events (user_id);
create index if not exists events_data_gin_idx on public.events using gin (data);

-- ── Row Level Security ──────────────────────────────────────────────
-- Lock the table, then allow ONLY anonymous INSERT. The public site can
-- WRITE analytics but cannot READ, UPDATE or DELETE them.
alter table public.events enable row level security;

drop policy if exists "anon insert events" on public.events;
create policy "anon insert events"
  on public.events
  for insert
  to anon
  with check (true);

-- NOTE: no SELECT/UPDATE/DELETE policy for anon on purpose. Dashboard read
-- access is added later (Phase 1, step 5) via aggregate RPC functions or an
-- authenticated role — so raw rows are never exposed to the public key.
