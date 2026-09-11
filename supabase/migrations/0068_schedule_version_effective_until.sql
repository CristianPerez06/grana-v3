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

-- The version that describes the schedule the rule has TODAY, not simply the
-- newest one and not `start_date`. They usually coincide; where they do not, the
-- newest version may describe a schedule the rule no longer has —a future
-- version left by an edit— and `start_date` says when the rule began, which is a
-- different question from when its current schedule started ruling.
-- Correlated subqueries rather than a lateral join: in an UPDATE the FROM list
-- cannot reference the target row, and the choice depends on it.
update public.recurrences r
   set schedule_effective_from = (
     select v.effective_from
       from public.recurrence_schedule_versions v
      where v.recurrence_id = r.id
        and v.interval_count = r.interval_count
        and v.interval_unit  = r.interval_unit
        and v.anchor_date    = r.start_date
      order by v.effective_from desc
      limit 1
   );

-- NO FALLBACK. A rule with no version describing the schedule it currently has
-- is DRIFT: the two halves of the model disagree about what the rule does.
-- Picking the newest version instead would hide that and freeze a false floor
-- into a column every read trusts. Better to stop here, with the rule named, and
-- look at it.
DO $floor$
declare
  v_orphan uuid;
begin
  for v_orphan in
    select id from public.recurrences where schedule_effective_from is null order by id
  loop
    raise exception '0068 aborted: recurrence % has no schedule version matching its current schedule — the model drifted and the floor cannot be derived', v_orphan;
  end loop;
end $floor$;


-- ── 2b · Which occurrence the seed movement covers ─────────────────────────
--
-- A rule created from a movement has no instance row for that movement's
-- occurrence: the movement IS it. Until now that occurrence was READ OFF
-- `start_date`, which was safe only because `start_date` could not move.
--
-- This feature moves it. The moment an anchor is corrected the two come apart,
-- and every reader that still equates them is wrong in a different way:
--
--   · `coveredOccurrences` marks the NEW anchor as already covered, hiding the
--     first occurrence of the corrected schedule from every projection;
--   · 0065 releases the floor computing `start_date - 1` from the corrected
--     anchor, while the guard below demands the floor the SEED established —
--     they no longer match, the transition is rejected, and the movement can no
--     longer be deleted at all.
--
-- So the occurrence gets an identity of its own, immutable, next to the anchor
-- that is now free to move.
alter table public.recurrences
  add column if not exists seed_occurrence_date DATE;

comment on column public.recurrences.seed_occurrence_date is
  'Occurrence covered by the seed movement. Immutable: the anchor may be corrected, this may not.';

-- Exact for every existing row: before this migration a seeded rule could not
-- move its anchor, so `start_date` still IS the seed occurrence. A rule already
-- unlinked covers nothing and gets NULL.
update public.recurrences
   set seed_occurrence_date = start_date
 where created_from_transaction_id is not null
   and seed_occurrence_date is null;

commit;

begin;

-- ── 2c · The guard, keyed on the seed occurrence instead of the anchor ─────
--
-- 0064's version reads the seed's occurrence off `start_date`, in two of its
-- clauses. With the anchor free to move they stop describing the situation the
-- exception exists for, and the exception stops firing for it:
--
--   seed dated the 7th, still in the future  ⇒ floor 7, anchor 7
--   reference corrected to the 9th           ⇒ floor 7, anchor 9
--   delete the seed movement                 ⇒ 0065 offers floor 8 (9 - 1),
--     the guard demands `OLD.reconstruct_from = OLD.start_date` (7 = 9) — false
--
-- …so the write is rejected and the movement can no longer be deleted at all.
-- Both clauses now name `seed_occurrence_date`, which does not move, and the
-- released floor is the day before the occurrence the movement actually covers.
--
-- Everything else is 0064's function unchanged, restated in full rather than
-- patched: a trigger body is replaced whole, and a reader comparing the two
-- should see the same shape.
create or replace function public.recurrence_reconstruct_from_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'UPDATE' then
    -- The seed occurrence is an identity, not a setting. Nothing may move it —
    -- there is no correct new value, because the movement it names does not
    -- change. Checked before the floor, since the floor's exception rests on it.
    if NEW.seed_occurrence_date is distinct from OLD.seed_occurrence_date then
      raise exception
        'seed_occurrence_date is immutable: rule % covers occurrence %, and the write tried to move it to %.',
        OLD.id, OLD.seed_occurrence_date, NEW.seed_occurrence_date
        using errcode = '23514';
    end if;

    if NEW.reconstruct_from is distinct from OLD.reconstruct_from
       -- ONE transition is allowed, and it is not an edit: RELEASING THE FLOOR A
       -- DELETED FUTURE SEED LEFT BEHIND.
       --
       -- A rule created from a movement has its floor set to that movement's
       -- date, because the movement IS that occurrence. Delete the movement and
       -- keep the rule and the premise is gone — but with the floor frozen the
       -- generator would never produce it, so the period the movement was
       -- covering disappears (the orphan defect 0053 repairs, which used to be
       -- repaired by clearing the cursor the generator no longer reads).
       --
       -- Every clause below is load-bearing, and together they describe that one
       -- situation and nothing else:
       --   · the floor moves back by EXACTLY ONE DAY, to the day before the seed
       --     occurrence, which is the floor the rule would have had with no seed
       --     at all. It cannot reach any further back, so an occurrence hidden
       --     before it stays hidden and the reconstruction cannot be widened;
       --   · the floor being released is the one the SEED established
       --     (`OLD.reconstruct_from = OLD.seed_occurrence_date`);
       --   · `start_date` does not move in the same write. Redundant now that the
       --     target is pinned to an immutable column, and kept anyway: it costs
       --     nothing and keeps the permission as narrow as it was;
       --   · the seed occurrence is still in the FUTURE. This is what keeps
       --     `acceptRecurrenceSuggestion` out: it produces the same floor shape,
       --     but from the last date DETECTION SAW, always in the past — and there
       --     the movement really does exist, so releasing would duplicate it;
       --   · the rule WAS seeded and is no longer, in this very write. Requiring
       --     the seed to have existed is what makes this a repair rather than a
       --     transition any rule can reach: without it, a rule that never had a
       --     seed could be walked into the same shape and then released, and the
       --     exception would stop describing the situation it exists for.
       and not (
            NEW.reconstruct_from = OLD.seed_occurrence_date - 1
        and OLD.reconstruct_from = OLD.seed_occurrence_date
        and NEW.start_date = OLD.start_date
        and OLD.seed_occurrence_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date
        and OLD.created_from_transaction_id is not null
        and NEW.created_from_transaction_id is null
       )
    then
      raise exception
        'reconstruct_from is immutable: rule % has floor %, and the write tried to move it to %.',
        OLD.id, OLD.reconstruct_from, NEW.reconstruct_from
        using errcode = '23514';
    end if;
    return NEW;
  end if;

  -- Derived, never taken from the client: a rule seeded by a movement covers the
  -- occurrence that movement is dated on, and one that was not seeded covers
  -- nothing. This is the only write that ever sets it.
  NEW.seed_occurrence_date := case
    when NEW.created_from_transaction_id is not null then NEW.start_date
    else null
  end;

  NEW.reconstruct_from := case
    when NEW.status = 'paused'               then (now() at time zone 'America/Argentina/Buenos_Aires')::date
    when NEW.last_generated_date is not null then NEW.last_generated_date
    -- With no cursor the first occurrence lands ON start_date, and the
    -- contract generates strictly after the floor.
    else NEW.start_date - 1
  end;
  return NEW;
end $$;

-- ── 2d · 0065 releases the floor the SEED established ──────────────────────
--
-- The other half of the same correction. 0065 computed `start_date - 1`; with a
-- corrected anchor that is a date the seed never covered, and the guard above
-- rejects it. Restated in full for the same reason as the guard.
create or replace function public.delete_movement_unlinking_seed(
  p_transaction_id UUID
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule  public.recurrences;
  v_today DATE := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- No status filter, matching the client-side guard: RESTRICT blocks the DELETE
  -- for ANY rule still holding the link, a soft-deleted one included.
  select * into v_rule
    from public.recurrences
   where created_from_transaction_id = p_transaction_id
     and user_id = auth.uid();

  if found then
    update public.recurrences
       set created_from_transaction_id = null,
           -- The legacy cursor is nulled alongside, as the client did, only for
           -- the repair case. Nothing reads it; it goes with migration C.
           last_generated_date = case
             when v_rule.status <> 'deleted' and v_rule.seed_occurrence_date > v_today
               then null
             else v_rule.last_generated_date
           end,
           reconstruct_from = case
             when v_rule.status <> 'deleted' and v_rule.seed_occurrence_date > v_today
               then v_rule.seed_occurrence_date - 1
             else v_rule.reconstruct_from
           end
     where id = v_rule.id
       and user_id = auth.uid();
  end if;

  -- Same DELETE the client issued. Every guard on `transactions` — the temporal
  -- one that raises GRN01, the cascades, the FKs — fires here exactly as it did,
  -- and now inside the same transaction as the writes above.
  delete from public.transactions
   where id = p_transaction_id
     and user_id = auth.uid();
end $$;

revoke all on function public.delete_movement_unlinking_seed(UUID) from public;
revoke all on function public.delete_movement_unlinking_seed(UUID) from anon;
grant execute on function public.delete_movement_unlinking_seed(UUID) to authenticated;

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

  -- THE COLUMN BELONGS TO THE TRIGGER. Whatever the client sent is discarded
  -- before anything else: a floor a client could move is a floor that stops
  -- meaning anything, and this one decides which occurrences exist. Column-level
  -- privileges would say it more declaratively, but they would also block the
  -- RPC, which runs as the caller on purpose.
  NEW.schedule_effective_from := OLD.schedule_effective_from;

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

-- NOT NULL, and only NOW: the trigger above is what fills the column on INSERT,
-- so between the backfill and its creation there is a window where an insert
-- would have nothing to write. A nullable floor is a floor that can go missing
-- and read as "this schedule has always ruled" — the permissive answer, reached
-- by forgetting rather than by deciding. Closed here so the only way to get
-- "no floor" is to write a date that says so.
alter table public.recurrences
  alter column schedule_effective_from set not null;

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

    -- CLOSE THE OUTGOING ONE — the one RULING, and only that one.
    --
    -- `effective_until` is inclusive, so a new version starting today means the
    -- old one ends yesterday; one starting later leaves a gap that produces
    -- nothing. Without this the old schedule keeps firing through the gap and
    -- the duplicate comes back a cycle later, on the old date — the 8th of
    -- October behind a correction that starts on the 10th.
    --
    -- THE `order by ... limit 1` IS THE POINT. Closing every version that began
    -- before today would rewrite the ends of versions already closed, and a
    -- second edit made DURING a gap would push a closed version's end forward to
    -- today — reopening the stretch the first edit had shut and producing the
    -- dates it excluded. Only the version in force is being replaced; the ones
    -- before it describe stretches that already happened.
    update public.recurrence_schedule_versions v
       set effective_until = least(today, opens - 1)
     where v.id = (
       select ruling.id
         from public.recurrence_schedule_versions ruling
        where ruling.recurrence_id = NEW.id
          and ruling.effective_from <= today
          and (ruling.effective_until is null or ruling.effective_until >= today)
        order by ruling.effective_from desc
        limit 1
     )
       and least(today, opens - 1) >= v.effective_from;

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

-- ── 5 · The two dates the user chooses between ────────────────────────────
--
-- The patch and the chosen effective date travel in ONE transaction, because
-- half of this edit is not a valid state: an anchor moved without an effective
-- date is the bug, and an effective date without the anchor is nothing. The
-- setting is `true` (transaction-local), so it cannot leak into another
-- statement.
--
-- The patchable columns are enumerated on purpose. A generic "merge this jsonb"
-- would also let a client set `user_id`.

-- The two dates the user is asked to choose between, RECOMPUTED HERE. The
-- question is drawn by the client, but the answer is verified against the
-- calendar by the database: a date that reaches the trigger unchecked opens a
-- version on a day the schedule never produces, and every occurrence after it
-- lands on the wrong phase.
--
-- Generated from the anchor, not by stepping a cursor: Postgres clamps
-- `anchor + n months` to the last valid day the same way the walker does with
-- its anchor, so a rule on the 31st comes back to the 31st after February.
create or replace function public.recurrence_candidate_effective_dates(
  p_anchor         date,
  p_interval_count int,
  p_interval_unit  text,
  p_from           date,
  p_end_date       date default null,
  p_remaining      int  default null
)
returns table (effective_from date)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_step interval := case p_interval_unit
                       when 'day'   then make_interval(days   => p_interval_count)
                       when 'week'  then make_interval(weeks  => p_interval_count)
                       when 'month' then make_interval(months => p_interval_count)
                       when 'year'  then make_interval(years  => p_interval_count)
                     end;
  v_skip int;
begin
  if v_step is null or p_interval_count < 1 then
    raise exception 'unknown schedule: % every %', p_interval_unit, p_interval_count
      using errcode = 'check_violation';
  end if;

  -- Jump most of the way arithmetically instead of walking from the anchor: a
  -- rule every 3 days anchored years back would be tens of thousands of steps.
  v_skip := greatest(
    0,
    case p_interval_unit
      when 'day'   then (p_from - p_anchor) / (p_interval_count * 1)
      when 'week'  then (p_from - p_anchor) / (p_interval_count * 7)
      when 'month' then ((extract(year from age(p_from, p_anchor))::int * 12
                          + extract(month from age(p_from, p_anchor))::int) / p_interval_count)
      when 'year'  then (extract(year from age(p_from, p_anchor))::int / p_interval_count)
    end - 1
  );

  -- A rule that has already spent its cap has no next occurrence at all, and a
  -- date past `end_date` is not one either. Offering them would put a promise in
  -- front of the user that the calendar refuses to keep.
  if p_remaining is not null and p_remaining <= 0 then
    return;
  end if;

  return query
    select d
      from generate_series(v_skip, v_skip + 40) as n,
           lateral (select (p_anchor + (v_step * n))::date as d) x
     where d >= p_from
       and (p_end_date is null or d <= p_end_date)
     order by d
     limit least(2, coalesce(p_remaining, 2));
end $$;

-- ── 6 · The only way to move an anchor ─────────────────────────────────────
--
-- The patch and the chosen effective date travel in ONE transaction, because
-- half of this edit is not a valid state: an anchor moved without an effective
-- date is the bug, and an effective date without the anchor is nothing. The
-- setting is `true` (transaction-local), so it cannot leak into another
-- statement.
--
-- SECURITY INVOKER on purpose: the update has to be refused by the same RLS that
-- refuses every other write. A definer function would be the one place in the
-- module where ownership is checked by hand.
--
-- The patchable columns are enumerated on purpose. A generic "merge this jsonb"
-- would also let a client set `user_id`.
create or replace function public.update_recurrence_schedule(
  p_id                      uuid,
  p_patch                   jsonb,
  p_schedule_effective_from date default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule    public.recurrences%rowtype;
  v_next    public.recurrences%rowtype;
  v_today     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_effective date;
  v_remaining int;
  v_ok        boolean;
begin
  -- Locked for the whole decision: the candidates are computed from the rule's
  -- own schedule, and a concurrent edit between reading it and writing would
  -- validate the date against a calendar that no longer applies.
  select * into v_rule from public.recurrences where id = p_id for update;
  if not found then
    raise exception 'recurrence % not found', p_id using errcode = 'no_data_found';
  end if;

  -- The patch, merged over the current row, is what the new schedule WILL be.
  v_next := jsonb_populate_record(v_rule, p_patch);

  if v_rule.status = 'paused' then
    -- A PAUSED RULE HAS NO NEXT OCCURRENCE to choose between: both candidates
    -- would fall inside the pause, and offering them as "the first one" would be
    -- a promise the calendar is not going to keep. The corrected schedule simply
    -- starts ruling now and waits — what the user is told is that it will be used
    -- when they resume.
    if p_schedule_effective_from is not null then
      raise exception 'a paused rule takes no chosen effective date: its schedule rules from today and waits for the rule to resume'
        using errcode = 'check_violation';
    end if;
    v_effective := greatest(v_today, v_next.start_date);
  else
    if p_schedule_effective_from is null then
      raise exception 'moving the anchor of an active rule needs the effective date the user chose'
        using errcode = 'check_violation';
    end if;

    -- How much of the cap is left. A rule that already spent it has no next
    -- occurrence, so it has nothing to offer and nothing to validate against.
    select case when v_next.max_occurrences is null then null
                else v_next.max_occurrences - count(*)::int end
      into v_remaining
      from public.recurrence_instances where recurrence_id = p_id;

    select exists (
      select 1 from public.recurrence_candidate_effective_dates(
        v_next.start_date, v_next.interval_count, v_next.interval_unit, v_today,
        v_next.end_date, v_remaining
      ) c where c.effective_from = p_schedule_effective_from
    ) into v_ok;

    if not v_ok then
      raise exception 'the effective date % is not one of the next occurrences of that schedule', p_schedule_effective_from
        using errcode = 'check_violation';
    end if;
    v_effective := p_schedule_effective_from;
  end if;

  perform set_config('grana.schedule_effective_from', v_effective::text, true);

  update public.recurrences r
     set (amount, frequency, interval_count, interval_unit, start_date, end_date,
          description, category_id, subcategory_id, account_id,
          transfer_destination_account_id, max_occurrences)
       = (v_next.amount, v_next.frequency, v_next.interval_count, v_next.interval_unit,
          v_next.start_date, v_next.end_date, v_next.description, v_next.category_id,
          v_next.subcategory_id, v_next.account_id, v_next.transfer_destination_account_id,
          v_next.max_occurrences)
   where r.id = p_id;

  if not found then
    raise exception 'recurrence % not found', p_id using errcode = 'no_data_found';
  end if;
end $$;

-- 0067's lesson: Postgres grants EXECUTE to PUBLIC on every new function and
-- Supabase grants it to `anon` directly, so both revokes are needed.
revoke execute on function public.update_recurrence_schedule(uuid, jsonb, date) from public;
revoke execute on function public.update_recurrence_schedule(uuid, jsonb, date) from anon;
grant  execute on function public.update_recurrence_schedule(uuid, jsonb, date) to authenticated;

revoke execute on function public.recurrence_candidate_effective_dates(date, int, text, date, date, int) from public;
revoke execute on function public.recurrence_candidate_effective_dates(date, int, text, date, date, int) from anon;
grant  execute on function public.recurrence_candidate_effective_dates(date, int, text, date, date, int) to authenticated;

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

  if has_function_privilege('anon', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE')
     or has_function_privilege('anon', 'public.recurrence_candidate_effective_dates(date, int, text, date, date, int)', 'EXECUTE') then
    raise exception '0068 failed: anon can execute one of the new functions';
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
