-- ════════════════════════════════════════════════════════════════════
-- IV DrugRef — Audit trail for admin-maintained clinical reference data
-- (B4, v5.56.0). The admin panel now writes compat/DDI/renal/allergy/drug
-- data DIRECTLY to Supabase (admin-supabase.js). The old GAS path had an
-- addAuditLog() sheet; the direct-write path had NONE, so safety-critical
-- edits landed with no who/when/before-after record and no second reviewer.
--
-- A DB-level trigger (SECURITY DEFINER) captures every INSERT/UPDATE/DELETE
-- so it CANNOT be skipped or forged from the client. Run in:
--   Supabase Dashboard → SQL Editor. Idempotent (drop-then-create).
-- Prereq: public.is_admin() (auth.sql) + the clinical tables (refdata.sql,
-- ddi.sql). Safe to run before the ddi tables exist — triggers are attached
-- only to tables that are present (to_regclass guard).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  actor      text,                 -- verified admin email (auth.jwt) or 'service/system'
  action     text not null,        -- INSERT | UPDATE | DELETE
  table_name text not null,
  row_pk     text,                 -- the row's id or key (as text)
  before     jsonb,                -- prior row (UPDATE/DELETE)
  after      jsonb                 -- new row (INSERT/UPDATE)
);
create index if not exists audit_log_ts_idx    on public.audit_log (ts);
create index if not exists audit_log_table_idx on public.audit_log (table_name, ts);

-- ── RLS: only admins may READ; nobody writes directly (the trigger, running
--    as definer, is the sole writer). No insert/update/delete policy on purpose.
alter table public.audit_log enable row level security;
drop policy if exists "admin read audit" on public.audit_log;
create policy "admin read audit" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ── Trigger function: capture actor + before/after. to_jsonb(row)->>'id'/'key'
--    avoids referencing a pk column that a given table may not have.
create or replace function public.log_audit() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare
  v_actor text;
  v_pk    text;
begin
  -- auth.jwt() is null for service-role / SQL-editor writes → tag as system.
  begin
    v_actor := coalesce(auth.jwt() ->> 'email', 'service/system');
  exception when others then
    v_actor := 'service/system';
  end;

  if (tg_op = 'DELETE') then
    v_pk := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key');
    insert into public.audit_log(actor, action, table_name, row_pk, before, after)
      values (v_actor, tg_op, tg_table_name, v_pk, to_jsonb(old), null);
    return old;
  else
    v_pk := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');
    insert into public.audit_log(actor, action, table_name, row_pk, before, after)
      values (v_actor, tg_op, tg_table_name, v_pk,
              case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
              to_jsonb(new));
    return new;
  end if;
end $$;

-- ── Attach to every clinical table that exists.
do $$
declare t text;
begin
  foreach t in array array[
    'drugs','compat_pairs','renal_drugs','ddi_pairs','ddi_class_rules',
    'allergy_groups','allergy_refs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on public.%I;', t);
      execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.log_audit();', t);
    end if;
  end loop;
end $$;

-- View the trail:  select ts, actor, action, table_name, row_pk from public.audit_log order by ts desc limit 100;
