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


-- ── 2a-bis · What the cap had already spent when this schedule began ───────
--
-- The other half of the floor. `max_occurrences` counts positions from the
-- rule's start; a reader without the schedule versions counts them from the only
-- anchor it can see, the CURRENT one. While the anchor could not move those were
-- the same number. This release moves it — and everything the rule spent under
-- its previous anchor stops counting, so a three-cuota rule finishes and
-- "próxima fecha" and the dashboard go on offering a fourth.
--
-- Filled by the same trigger that decides the floor, from the same function the
-- RPC validates with. Zero for a rule whose first schedule is its only one.
alter table public.recurrences
  add column if not exists schedule_positions_before INT NOT NULL DEFAULT 0;

comment on column public.recurrences.schedule_positions_before is
  'Calendar positions spent before schedule_effective_from. Lets a reader without versions apply max_occurrences.';

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

-- THE PAIR, AS A CONSTRAINT. The trigger below derives the date and refuses to
-- move it, but a trigger is a rule about WRITES: it says nothing about a row
-- that reached this shape some other way — a migration with the trigger
-- disabled, a repair run as the owner, a restore. A linked rule with no seed
-- date is the state every consumer of `coveredOccurrences` misreads, so the
-- table refuses to hold it at all.
alter table public.recurrences
  drop constraint if exists chk_recurrences_seed_pair;
alter table public.recurrences
  add constraint chk_recurrences_seed_pair
  CHECK (created_from_transaction_id is null or seed_occurrence_date is not null);


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

    -- THE LINK IS SET AT BIRTH AND CAN ONLY BE CUT. With the seed date frozen
    -- above, a client that could attach a link afterwards — or point it at a
    -- different movement — would produce exactly the row the CHECK forbids or,
    -- worse, one that satisfies it while naming the wrong occurrence: a rule
    -- claiming to cover a date some unrelated movement has nothing to do with.
    -- ONE transition stays open, and it is the one 0065 makes: cutting it.
    if NEW.created_from_transaction_id is distinct from OLD.created_from_transaction_id
       and not (OLD.created_from_transaction_id is not null
                and NEW.created_from_transaction_id is null)
    then
      raise exception
        'created_from_transaction_id cannot be introduced or replaced: rule % was seeded by %, and the write tried to point it at %. Only unlinking is allowed.',
        OLD.id, OLD.created_from_transaction_id, NEW.created_from_transaction_id
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


-- ── 2e · How many positions of its calendar a rule has spent ───────────────
--
-- `max_occurrences` counts POSITIONS on the rule's calendar, not rows in
-- `recurrence_instances`. The two are not the same number and never were:
--
--   · a rule created from a movement covers its first occurrence WITH that
--     movement and has no instance row for it;
--   · a position the calendar produced while nothing was generating has no row
--     either, and it is still spent.
--
-- Counting rows tells a 6-cuota rule it has cuotas left when it does not, and
-- offers a reference date for a rule that will never fire again.
--
-- THIS IS A SECOND IMPLEMENTATION OF THE GENERATOR'S WALK, and that is a cost
-- taken deliberately, exactly as `recurrence_candidate_effective_dates` takes
-- it: the server has to be able to refuse a date on its own, and the generator
-- lives in TypeScript. What makes it safe is the same thing — a parity test that
-- runs both over the same schedules and fails when they disagree. Every rule
-- below mirrors `forEachComposedOccurrence`:
--
--   · the stretch a version owns ends at the EARLIEST of its own end, the day
--     before the next version, and today;
--   · the first version's calendar reaches back to its anchor, and the positions
--     between the anchor and `effective_from` are already spent — counted by
--     arithmetic, with no pause subtracted, because that stretch is not walked;
--   · a pause covers [paused_from, resumed_at): the day it resumes, the rule is
--     running again;
--   · a position past `end_date` is not produced;
--   · the count saturates at the cap, because a walk that reaches it stops.
create or replace function public.recurrence_positions_spent(
  p_id    uuid,
  p_today date
)
returns int
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule     public.recurrences;
  v_version  record;
  v_next     date;
  v_to       date;
  v_step     interval;
  v_produced int := 0;
  v_count    int;
  v_span     int;
  v_seed     date;
  v_upfront  boolean := false;
  v_prefix   boolean;
begin
  select * into v_rule from public.recurrences where id = p_id;
  if not found then
    return 0;
  end if;

  -- THE SEED IS A SPENT POSITION, always. The movement is in the ledger from the
  -- day the rule is created, dated ahead or not, and no version of the schedule
  -- need produce it for that to be true. Correcting a reference date is exactly
  -- the case where none does — the seed's own date falls in the gap the
  -- correction opens — and without this a three-cuota rule hands out three more
  -- on top of the movement the user already has.
  v_seed := v_rule.seed_occurrence_date;

  for v_version in
    select v.*,
           lead(v.effective_from) over (order by v.effective_from) as next_from,
           row_number() over (order by v.effective_from)           as ord
      from public.recurrence_schedule_versions v
     where v.recurrence_id = p_id
     order by v.effective_from
  loop
    exit when v_rule.max_occurrences is not null and v_produced >= v_rule.max_occurrences;

    v_step := case v_version.interval_unit
                when 'day'   then make_interval(days   => v_version.interval_count)
                when 'week'  then make_interval(weeks  => v_version.interval_count)
                when 'month' then make_interval(months => v_version.interval_count)
                when 'year'  then make_interval(years  => v_version.interval_count)
              end;
    if v_step is null then
      raise exception 'unknown schedule: % every %', v_version.interval_unit, v_version.interval_count
        using errcode = 'check_violation';
    end if;

    -- The earliest of the three ends.
    v_to := p_today;
    if v_version.effective_until is not null and v_version.effective_until < v_to then
      v_to := v_version.effective_until;
    end if;
    v_next := v_version.next_from;
    if v_next is not null and (v_next - 1) < v_to then
      v_to := v_next - 1;
    end if;

    -- How many steps could possibly fit, so the series is bounded by the rule's
    -- own life instead of a guessed constant.
    v_span := greatest(0, (v_to - v_version.anchor_date)) + 1;
    v_span := case v_version.interval_unit
                when 'day'   then v_span / v_version.interval_count
                when 'week'  then v_span / (v_version.interval_count * 7)
                when 'month' then v_span / (v_version.interval_count * 28)
                when 'year'  then v_span / (v_version.interval_count * 365)
              end + 2;

    -- The positions already spent before this version took effect. Only for the
    -- first one: later versions start where the previous stopped counting.
    if v_version.ord = 1 then
      select count(*) into v_produced
        from generate_series(0, v_span) n
       where (v_version.anchor_date + (v_step * n))::date < v_version.effective_from
         and (v_rule.end_date is null
              or (v_version.anchor_date + (v_step * n))::date <= v_rule.end_date);

      -- Counted there already, or counted here — once either way.
      select v_seed is not null and exists (
        select 1 from generate_series(0, v_span) n
         where (v_version.anchor_date + (v_step * n))::date = v_seed
           and (v_version.anchor_date + (v_step * n))::date < v_version.effective_from
      ) into v_prefix;
      v_upfront := v_seed is not null and not v_prefix;
      if v_upfront then
        v_produced := v_produced + 1;
      end if;
    end if;

    continue when v_version.effective_from > v_to;

    select count(*) into v_count
      from generate_series(0, v_span) n
      cross join lateral (select (v_version.anchor_date + (v_step * n))::date as d) x
     where d >= v_version.effective_from
       and d <= v_to
       and (v_rule.end_date is null or d <= v_rule.end_date)
       and not (v_upfront and d = v_seed)
       and not exists (
         select 1 from public.recurrence_pauses ps
          where ps.recurrence_id = p_id
            and d >= ps.paused_from
            and (ps.resumed_at is null or d < ps.resumed_at)
       );

    v_produced := v_produced + v_count;
  end loop;

  -- No versions at all: the loop never ran, and the seed is still spent.
  if not exists (
    select 1 from public.recurrence_schedule_versions where recurrence_id = p_id
  ) then
    v_produced := case when v_seed is null then 0 else 1 end;
  end if;

  if v_rule.max_occurrences is not null and v_produced > v_rule.max_occurrences then
    v_produced := v_rule.max_occurrences;
  end if;
  return v_produced;
end $$;

-- ── 2e-bis · The OFFSET, which is a different number ───────────────────────
--
-- `schedule_positions_before` is not "what the rule has spent". It is what the
-- CURRENT calendar will not walk again — the head start a reader without the
-- schedule versions has to be given so that `max_occurrences` still counts from
-- the rule's beginning.
--
-- The total above cannot be copied into it. The two disagree on exactly one
-- position: the seed's. A rule created from a movement has its version starting
-- ON the seed's own date, so the current calendar DOES produce it; counted in
-- the offset as well, it is spent twice, and a three-cuota rule with two of them
-- accounted for answers that there is no third.
--
-- So the seed is taken out of the offset precisely when the current calendar is
-- going to walk it — which is not the same as "the seed is recent": a seed the
-- corrected schedule does not land on is never walked, and belongs here.
-- The old six-argument shape goes: its answer was wrong, and leaving it callable
-- would leave the wrong answer reachable.
drop function if exists public.recurrence_positions_before(uuid, date, date, int, text, date);

create or replace function public.recurrence_positions_before(
  p_id             uuid,
  p_floor          date,
  p_anchor         date,
  p_interval_count int,
  p_interval_unit  text,
  p_seed           date,
  p_max            int,
  p_end_date       date
)
returns int
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_spent int;
  v_step  interval;
  v_span  int;
  v_on    boolean;
  v_k     int;
begin
  -- Up to the day the outgoing schedule stops: the day before the new one rules,
  -- or today when the new one is still ahead — the gap between produces nothing.
  v_spent := public.recurrence_positions_spent(p_id, least(v_today, p_floor - 1));

  -- Before the floor, so the current calendar cannot reach it: it is offset.
  if p_seed is null or p_seed < p_floor or p_seed < p_anchor then
    return v_spent;
  end if;

  v_step := case p_interval_unit
              when 'day'   then make_interval(days   => p_interval_count)
              when 'week'  then make_interval(weeks  => p_interval_count)
              when 'month' then make_interval(months => p_interval_count)
              when 'year'  then make_interval(years  => p_interval_count)
            end;
  if v_step is null or p_interval_count < 1 then
    raise exception 'unknown schedule: % every %', p_interval_unit, p_interval_count
      using errcode = 'check_violation';
  end if;

  v_span := greatest(0, (p_seed - p_anchor)) + 1;
  v_span := case p_interval_unit
              when 'day'   then v_span / p_interval_count
              when 'week'  then v_span / (p_interval_count * 7)
              when 'month' then v_span / (p_interval_count * 28)
              when 'year'  then v_span / (p_interval_count * 365)
            end + 2;

  -- WHERE the seed sits among the positions this schedule still has to walk, and
  -- whether it is one of them at all.
  select bool_or(d = p_seed), count(*) filter (where d < p_seed)
    into v_on, v_k
    from generate_series(0, v_span) n
    cross join lateral (select (p_anchor + (v_step * n))::date as d) x
   where d >= p_floor and d <= p_seed;

  -- Not a position of this calendar: nobody walks it, so it stays.
  if not coalesce(v_on, false) then
    return v_spent;
  end if;

  -- BEING ON THE CALENDAR IS NOT BEING REACHED BY IT. A progression contains
  -- every one of its dates; a rule walks only as far as its end and its cap let
  -- it. A seed past either is spent once and never counted again, so taking it
  -- out of the offset would spend it zero times.
  if p_end_date is not null and p_seed > p_end_date then
    return v_spent;
  end if;
  -- `v_spent` already counts the seed, so what is left to walk from the floor is
  -- `p_max - (v_spent - 1)` positions, at indices 0 .. p_max - v_spent.
  if p_max is not null and v_k > p_max - v_spent then
    return v_spent;
  end if;

  return v_spent - 1;
end $$;

revoke all on function public.recurrence_positions_before(uuid, date, date, int, text, date, int, date) from public;
revoke all on function public.recurrence_positions_before(uuid, date, date, int, text, date, int, date) from anon;
grant execute on function public.recurrence_positions_before(uuid, date, date, int, text, date, int, date) to authenticated;

revoke all on function public.recurrence_positions_spent(uuid, date) from public;
revoke all on function public.recurrence_positions_spent(uuid, date) from anon;
grant execute on function public.recurrence_positions_spent(uuid, date) to authenticated;


-- Backfill, now that the function exists. Exact for every existing row: before
-- this migration an anchor could not move, so a rule's calendar reaches back to
-- its own start and there is nothing behind the version in force — except for a
-- rule whose schedule changed FREQUENCY, where the earlier versions did spend
-- positions the current anchor still happens to count. Asking the function is
-- what gets both right without having to tell them apart.
update public.recurrences r
   set schedule_positions_before = public.recurrence_positions_before(
         r.id, r.schedule_effective_from, r.start_date,
         r.interval_count, r.interval_unit, r.seed_occurrence_date,
         r.max_occurrences, r.end_date);

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
    -- A rule's first schedule has nothing behind it.
    NEW.schedule_positions_before := 0;
    return NEW;
  end if;

  -- THE COLUMN BELONGS TO THE TRIGGER. Whatever the client sent is discarded
  -- before anything else: a floor a client could move is a floor that stops
  -- meaning anything, and this one decides which occurrences exist. Column-level
  -- privileges would say it more declaratively, but they would also block the
  -- RPC, which runs as the caller on purpose.
  NEW.schedule_effective_from := OLD.schedule_effective_from;
  NEW.schedule_positions_before := OLD.schedule_positions_before;

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
    -- What the cap had already spent when the outgoing schedule stopped — which
    -- is `least(today, chosen - 1)`, the very day the AFTER trigger is about to
    -- close it on. Asked BEFORE that close, so the outgoing version still
    -- describes its own stretch; asked as of the day it stops, so the gap it
    -- leaves behind contributes nothing.
    NEW.schedule_positions_before := public.recurrence_positions_before(
      NEW.id, chosen::date, NEW.start_date,
      NEW.interval_count, NEW.interval_unit, NEW.seed_occurrence_date,
      NEW.max_occurrences, NEW.end_date);

  elsif NEW.interval_count is distinct from OLD.interval_count
     or NEW.interval_unit  is distinct from OLD.interval_unit then
    -- A frequency change keeps the behaviour it always had: it rules from today,
    -- or from the start for a rule that has not begun. Nothing is ambiguous here
    -- — the anchor does not move, so no cycle can be served twice.
    NEW.schedule_effective_from := greatest(today, NEW.start_date);
    NEW.schedule_positions_before := public.recurrence_positions_before(
      NEW.id, greatest(today, NEW.start_date), NEW.start_date,
      NEW.interval_count, NEW.interval_unit, NEW.seed_occurrence_date,
      NEW.max_occurrences, NEW.end_date);
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

-- FAIL-CLOSED, and it exists to be overwritten. The trigger above writes this
-- column on every insert, so the default is only ever reached when the trigger
-- is gone, disabled, or bypassed — precisely when a wrong value would go
-- unnoticed. So the value it lands on is the one that SUPPRESSES: a floor in the
-- year 9999 means no schedule rules yet and nothing is projected. An empty card
-- is a bug someone reports; a card announcing vencimientos nobody will ever owe
-- is a bug someone BELIEVES.
--
-- It is also what makes `Insert` optional in the generated types honest: without
-- a default, a regeneration marks the column required and every insert in the
-- codebase would have to name a floor it has no business choosing.
alter table public.recurrences
  alter column schedule_effective_from set default '9999-12-31';

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
    --
    -- By POSITIONS of the calendar, not by rows: a seeded rule's first
    -- occurrence has no row, and neither has a position the calendar produced
    -- while nothing was generating. Counting rows here said a spent rule still
    -- had cuotas left and accepted a reference date that will never fire.
    v_remaining := case
      when v_next.max_occurrences is null then null
      else v_next.max_occurrences - public.recurrence_positions_spent(p_id, v_today)
    end;

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
