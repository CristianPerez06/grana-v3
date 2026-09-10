-- ═══════════════════════════════════════════════════════════════════════════
-- 0068 · A schedule version can stop before the next one starts
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Found in the QA of #121, with real data. Correcting a rule's anchor mid-cycle
-- DUPLICATED the cycle's occurrence: a monthly salary anchored on the 8th, with
-- the 8 September one already confirmed, corrected to the 10th on 10 September
-- ⇒ the generator also materialized 10 September. Two salaries in one month.
--
-- It is not a generator defect. An occurrence is identified by (rule, due_date),
-- and the 8th and the 10th are two dates: NO DATE ARITHMETIC CAN KNOW THEY ARE
-- THE SAME SALARY. Four automatic formulas were tried — `today + 1`, "one
-- interval after the last existing one", "from the next old occurrence", "from
-- the next period" — and each solves two of these three and breaks the third:
--
--   A. the cycle's occurrence was already resolved  ⇒ the correction must rule
--      from the NEXT one, or the cycle gains a second occurrence;
--   B. the cycle's occurrence has not arrived yet   ⇒ it must move to the new
--      date, and NOT also fire on the old one;
--   C. the rule owes a backlog                      ⇒ the backlog keeps the old
--      dates, because the past is not reinterpreted.
--
-- Reasoning by "period" is not a way out either: a rule every 3 days has none.
-- So the ambiguity is the user's to resolve, with concrete dates, and what this
-- migration adds is the ability to RECORD that answer.
--
-- ═══ WHAT IT ADDS ═════════════════════════════════════════════════════════
--
--   1. `recurrence_schedule_versions.effective_until` — the last day, INCLUSIVE,
--      on which a version may produce. NULL keeps today's meaning ("until the
--      next one starts"), so no existing row changes what it says.
--   2. `recurrences.schedule_effective_from` — since when the current schedule
--      rules. Denormalized on purpose: the reads that draw "Próxima fecha" and
--      the dashboard projection walk the calendar from the rule's own columns
--      and never look at versions, so without this they would keep projecting
--      an occurrence the generator will never create.
--   3. `update_recurrence_schedule` — the ONLY way to move an anchor. It carries
--      the chosen effective date and the rule's patch in ONE transaction, and
--      the trigger REJECTS an anchor change that does not bring it. An implicit
--      effective date is exactly what produced the duplicate.
--
-- ═══ WHY THE OUTGOING VERSION CLOSES AT `least(today, chosen - 1)` ═════════
--
-- Because `effective_until` is inclusive and two schedules must never overlap:
-- if the new one starts TODAY the old must end YESTERDAY; if it starts later,
-- the old ends TODAY and the gap in between produces nothing. Closing it always
-- at `today` would leave both ruling today; closing it always at `chosen - 1`
-- would let the OLD schedule keep firing through the gap — which is the same
-- duplicate, one cycle later, on the old date.
--
-- Additive: no row is rewritten and nothing is dropped.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · The end of a version ───────────────────────────────────────────────

alter table public.recurrence_schedule_versions
  add column if not exists effective_until DATE;

comment on column public.recurrence_schedule_versions.effective_until is
  'Last day (inclusive) this version may produce. NULL = until the next version starts.';

alter table public.recurrence_schedule_versions
  drop constraint if exists chk_schedule_versions_effective_range;
alter table public.recurrence_schedule_versions
  add constraint chk_schedule_versions_effective_range
  CHECK (effective_until is null or effective_until >= effective_from);

-- ── 2 · The floor every read can see ───────────────────────────────────────
-- Backfilled from the newest version so a rule that never moves its anchor
-- reads exactly as it does today.

alter table public.recurrences
  add column if not exists schedule_effective_from DATE;

comment on column public.recurrences.schedule_effective_from is
  'Since when the current schedule rules. Maintained by recurrence_sync_schedule_and_pauses.';

update public.recurrences r
   set schedule_effective_from = v.effective_from
  from (
    select distinct on (recurrence_id) recurrence_id, effective_from
      from public.recurrence_schedule_versions
     order by recurrence_id, effective_from desc
  ) v
 where v.recurrence_id = r.id
   and r.schedule_effective_from is distinct from v.effective_from;

commit;

begin;

-- ── 3 · Where the effective date is decided, once ──────────────────────────
--
-- BEFORE, and on the row itself: an AFTER trigger that wrote back to
-- `recurrences` would re-fire itself. Computing it here also means the AFTER
-- trigger has nothing to decide — it reads `NEW.schedule_effective_from` and
-- builds the version from it, so the rule that governs the calendar lives in
-- exactly one place.

create or replace function public.recurrence_resolve_schedule_effective_from()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  chosen text;
begin
  if TG_OP = 'INSERT' then
    NEW.schedule_effective_from := NEW.start_date;
    return NEW;
  end if;

  if NEW.start_date is distinct from OLD.start_date then
    -- THE ANSWER IS REQUIRED. Moving the anchor is ambiguous by nature: the
    -- cycle in flight may already be settled or not, and the database cannot
    -- tell. Inferring it is what produced two salaries in one month.
    chosen := nullif(current_setting('grana.schedule_effective_from', true), '');
    if chosen is null then
      raise exception 'moving a recurrence anchor needs the effective date the user chose — use update_recurrence_schedule()'
        using errcode = 'check_violation';
    end if;
    if chosen::date < today then
      raise exception 'the chosen effective date % is in the past: a schedule cannot start ruling backwards', chosen
        using errcode = 'check_violation';
    end if;
    NEW.schedule_effective_from := chosen::date;

  elsif NEW.interval_count is distinct from OLD.interval_count
     or NEW.interval_unit  is distinct from OLD.interval_unit then
    -- A frequency change keeps the behaviour it always had: it rules from today,
    -- or from the start for a rule that has not begun. Nothing is ambiguous here
    -- — the anchor does not move, so no cycle can be served twice.
    NEW.schedule_effective_from := greatest(today, NEW.start_date);
  end if;

  return NEW;
end $$;

drop trigger if exists trg_recurrence_resolve_schedule_effective_from on public.recurrences;
create trigger trg_recurrence_resolve_schedule_effective_from
  before insert or update on public.recurrences
  for each row
  execute function public.recurrence_resolve_schedule_effective_from();

-- ── 4 · The version, closed so the two never overlap ───────────────────────
-- Replaces 0064's function in place. Everything it did stays; what changes is
-- that the new version's `effective_from` is READ from the row instead of being
-- inferred, and that the outgoing one is closed.

create or replace function public.recurrence_sync_schedule_and_pauses()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  opens date;
begin
  if TG_OP = 'INSERT' then
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
    values
      (NEW.id, NEW.user_id, NEW.start_date, NEW.interval_count, NEW.interval_unit, NEW.start_date, false)
    on conflict (recurrence_id, effective_from) do nothing;

    if NEW.status = 'paused' then
      insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
      values (NEW.id, NEW.user_id, today)
      on conflict do nothing;
    end if;

    return NEW;
  end if;

  if NEW.interval_count is distinct from OLD.interval_count
     or NEW.interval_unit  is distinct from OLD.interval_unit
     or NEW.start_date    is distinct from OLD.start_date then

    opens := NEW.schedule_effective_from;

    -- Versions that HAVE NOT COME INTO EFFECT YET are replaced, not kept (0064).
    delete from public.recurrence_schedule_versions
     where recurrence_id = NEW.id and effective_from > today;

    -- CLOSE THE OUTGOING ONE. `effective_until` is inclusive, so a new version
    -- starting today means the old one ends yesterday; one starting later leaves
    -- a gap that produces nothing. Without this the old schedule keeps firing
    -- through the gap and the duplicate comes back a cycle later, on the old
    -- date — the 8th of October behind a correction that starts on the 10th.
    update public.recurrence_schedule_versions
       set effective_until = least(today, opens - 1)
     where recurrence_id = NEW.id
       and effective_from <= today
       and effective_from <= least(today, opens - 1);

    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
    values
      (NEW.id, NEW.user_id, opens, NEW.interval_count, NEW.interval_unit, NEW.start_date, false)
    on conflict (recurrence_id, effective_from) do update
      set interval_count  = excluded.interval_count,
          interval_unit   = excluded.interval_unit,
          anchor_date     = excluded.anchor_date,
          effective_until = null,
          is_assumed      = false;
  end if;

  if OLD.status is distinct from NEW.status then
    if NEW.status = 'paused' then
      insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
      values (NEW.id, NEW.user_id, today)
      on conflict do nothing;
    elsif OLD.status = 'paused' then
      update public.recurrence_pauses
         set resumed_at = greatest(today, paused_from)
       where recurrence_id = NEW.id and resumed_at is null;
    end if;
  end if;

  return NEW;
end $$;

commit;

begin;

-- ── 5 · The only way to move an anchor ─────────────────────────────────────
--
-- The patch and the chosen effective date travel in ONE transaction, because
-- half of this edit is not a valid state: an anchor moved without an effective
-- date is the bug, and an effective date without the anchor is nothing. The
-- setting is `true` (transaction-local), so it cannot leak into another
-- statement.
--
-- The patchable columns are enumerated on purpose. A generic "merge this jsonb"
-- would also let a client set `user_id`.

create or replace function public.update_recurrence_schedule(
  p_id                      uuid,
  p_patch                   jsonb,
  p_schedule_effective_from date
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config('grana.schedule_effective_from', p_schedule_effective_from::text, true);

  update public.recurrences r
     set (amount, frequency, interval_count, interval_unit, start_date, end_date,
          description, category_id, subcategory_id, account_id,
          transfer_destination_account_id, max_occurrences)
       = (select p.amount, p.frequency, p.interval_count, p.interval_unit, p.start_date,
                 p.end_date, p.description, p.category_id, p.subcategory_id, p.account_id,
                 p.transfer_destination_account_id, p.max_occurrences
            from jsonb_populate_record(r, p_patch) p)
   where r.id = p_id
     and r.user_id = auth.uid();

  if not found then
    raise exception 'recurrence % not found', p_id using errcode = 'no_data_found';
  end if;
end $$;

-- 0067's lesson: Postgres grants EXECUTE to PUBLIC on every new function and
-- Supabase grants it to `anon` directly, so both revokes are needed.
revoke execute on function public.update_recurrence_schedule(uuid, jsonb, date) from public;
revoke execute on function public.update_recurrence_schedule(uuid, jsonb, date) from anon;
grant  execute on function public.update_recurrence_schedule(uuid, jsonb, date) to authenticated;

-- ── Self-check ─────────────────────────────────────────────────────────────
DO $check$
declare
  v_missing text;
begin
  for v_missing in
    select c FROM (values ('effective_until')) as t(c)
     where not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'recurrence_schedule_versions'
          and column_name = t.c)
  loop
    raise exception '0068 failed: recurrence_schedule_versions.% is missing', v_missing;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recurrences'
       and column_name = 'schedule_effective_from'
  ) then
    raise exception '0068 failed: recurrences.schedule_effective_from is missing';
  end if;

  if has_function_privilege('anon', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') then
    raise exception '0068 failed: anon can execute update_recurrence_schedule';
  end if;

  if not has_function_privilege('authenticated', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') then
    raise exception '0068 failed: authenticated cannot execute update_recurrence_schedule';
  end if;

  -- The floor must be filled for every rule, or the reads that depend on it
  -- would silently fall back to projecting from the raw columns.
  if exists (select 1 from public.recurrences where schedule_effective_from is null) then
    raise exception '0068 failed: rules left without schedule_effective_from';
  end if;

  raise notice '✓ 0068 — a schedule version can now stop before the next one starts';
end $check$;

commit;
