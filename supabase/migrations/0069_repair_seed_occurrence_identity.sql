-- ═══════════════════════════════════════════════════════════════════════════
-- 0069 · The seed occurrence, repaired where 0068 guessed it wrong
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 0068 backfilled `recurrences.seed_occurrence_date` from `start_date`, on this
-- premise, written in its own header:
--
--   "before this migration a seeded rule could not move its anchor, so
--    `start_date` still IS the seed occurrence"
--
-- THE PREMISE IS FALSE. `updateRecurrence` has accepted `start_date` all along —
-- the field was absent from the edit drawer, not from the mutation — so a seeded
-- rule's anchor could move, and on the database 0068 first ran against, one had.
-- For that rule the backfill recorded the CORRECTED anchor as the occurrence its
-- seed movement covers, which is a different date.
--
-- ═══ THE CRITERION, AND WHAT IT IS WORTH ══════════════════════════════════
--
--   repair every linked rule whose `seed_occurrence_date` differs from the
--   `anchor_date` of its earliest schedule version.
--
-- Generic on purpose, though today it matches one row. The alternative — naming
-- that row's id — would be a migration nobody can verify and that says nothing
-- about what was wrong.
--
-- ═══ THIS IS AN AUDITED ONE-TIME REPAIR, NOT AN INVARIANT ═════════════════
--
-- The earliest surviving version is the best record of where a rule began. It is
-- NOT a permanent one, and an earlier draft of this migration claimed it was.
-- The correction, kept here because the wrong version reads perfectly plausible:
--
--   0068's `recurrence_sync_schedule_and_pauses()` DELETES the versions that
--   have not come into effect yet — `effective_from > today` — before opening
--   the corrected one. A rule seeded by a FUTURE movement has exactly one such
--   version, the one its own insert created. Correct its anchor before the rule
--   starts and that version is gone; the earliest one left carries the NEW
--   anchor, while `seed_occurrence_date` correctly keeps the occurrence the
--   movement covers. The two disagree and NOTHING IS WRONG.
--
-- On such a rule this migration would overwrite a seed that was never broken,
-- and no query separates it from the rule that IS broken: the same three
-- columns, with the old value on the other side.
--
-- WHAT MAKES IT SAFE HERE IS NOT THE CRITERION — IT IS THE AUDIT. On the
-- database this runs against (caso real reportado en #96) the criterion was run
-- as a read first: exactly one rule disagreed, an active rule whose anchor was
-- corrected in the past, with no rule of the second kind anywhere. Anyone
-- reaching for this query on another database has to redo that audit before
-- running it, and `validate_schema.sql` 8.1L only LISTS the disagreements for
-- that reason — it cannot assert an equality that a correct database can break.
--
-- WHAT IT IS NOT. It does NOT compare against `transactions.date`: that column
-- is editable, so a movement re-dated after the rule was created would look like
-- a broken identity and is not one. Ten rules on this database differ that way
-- and are correct; comparing against the movement is what made them look wrong.
--
-- ═══ WHY IT MATTERS, GIVEN NOTHING VISIBLY BREAKS TODAY ═══════════════════
--
-- The value is dormant, not harmless. It is read in two places:
--
--   · UNLINKING OR DELETING THE SEED MOVEMENT. `delete_movement_unlinking_seed`
--     releases the reconstruction floor from `seed_occurrence_date - 1`, and
--     0064's guard only permits that transition when the floor being released is
--     the one the seed established. With the wrong date those two disagree and
--     the guard REFUSES — which is the defect #121 spent a whole round fixing:
--     a movement that can no longer be deleted at all. It sleeps here only
--     because this rule's seed occurrence is already in the past.
--   · THE CAP. `schedule_positions_before` is derived from it. The rule has no
--     `max_occurrences` today; the moment one is set, the offset is off by one
--     and the rule hands out a position it does not have.
--
-- ═══ WHAT IT RUNS ═════════════════════════════════════════════════════════
--
--   · Disables TWO before-triggers on `recurrences`, for the length of one
--     transaction: the guard, because `seed_occurrence_date` is immutable by
--     design and this is the deliberate, auditable exception 0064 documents; and
--     the resolver, because on UPDATE it copies `schedule_positions_before` back
--     from OLD — leave it on and the recomputation below undoes itself.
--   · Repairs the seed of every linked rule matching the criterion, DELETED ONES
--     INCLUDED: a soft-deleted rule keeps its movements and can be consulted, and
--     leaving a known-wrong identity behind because the row is hidden is how a
--     repair becomes a second bug.
--   · Recomputes `schedule_positions_before` for exactly those rules, in the same
--     transaction, from the same function the RPC validates with.
--
-- A failure at any point rolls the whole thing back, the trigger states included:
-- `alter table ... disable trigger` is transactional in Postgres.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.recurrences disable trigger trg_recurrence_reconstruct_from_guard;
alter table public.recurrences disable trigger trg_recurrence_resolve_schedule_effective_from;

-- The earliest version of each rule. `effective_from` orders it; `id` breaks a
-- tie so the answer cannot depend on physical row order.
create temp table seed_repair_targets on commit drop as
with first_version as (
  select distinct on (v.recurrence_id)
         v.recurrence_id, v.anchor_date
    from public.recurrence_schedule_versions v
   order by v.recurrence_id, v.effective_from, v.id
)
select r.id, r.seed_occurrence_date as was, fv.anchor_date as should_be
  from public.recurrences r
  join first_version fv on fv.recurrence_id = r.id
 where r.created_from_transaction_id is not null
   and r.seed_occurrence_date is distinct from fv.anchor_date;

update public.recurrences r
   set seed_occurrence_date = t.should_be
  from seed_repair_targets t
 where t.id = r.id;

-- And the number derived from it, for the same rules and in the same breath: a
-- repaired seed with a stale offset is half a repair.
update public.recurrences r
   set schedule_positions_before = public.recurrence_positions_before(
         r.id, r.schedule_effective_from, r.start_date,
         r.interval_count, r.interval_unit, r.seed_occurrence_date,
         r.max_occurrences, r.end_date)
  from seed_repair_targets t
 where t.id = r.id;

alter table public.recurrences enable trigger trg_recurrence_reconstruct_from_guard;
alter table public.recurrences enable trigger trg_recurrence_resolve_schedule_effective_from;

-- ── Self-check ─────────────────────────────────────────────────────────────
DO $selfcheck$
declare
  v_left int;
  v_off  uuid;
begin
  with first_version as (
    select distinct on (v.recurrence_id)
           v.recurrence_id, v.anchor_date
      from public.recurrence_schedule_versions v
     order by v.recurrence_id, v.effective_from, v.id
  )
  select count(*) into v_left
    from public.recurrences r
    join first_version fv on fv.recurrence_id = r.id
   where r.created_from_transaction_id is not null
     and r.seed_occurrence_date is distinct from fv.anchor_date;
  if v_left > 0 then
    raise exception '0069 failed: % linked rules still disagree with their earliest surviving version', v_left;
  end if;

  -- Every rule this migration touched must now agree with the function. Only
  -- those: for a rule whose floor is still in the FUTURE the offset is computed
  -- against `today` and legitimately moves with the calendar, so asserting it
  -- across the whole table would fail on a date rather than on a defect.
  select r.id into v_off
    from public.recurrences r
    join seed_repair_targets t on t.id = r.id
   where r.schedule_positions_before is distinct from public.recurrence_positions_before(
           r.id, r.schedule_effective_from, r.start_date,
           r.interval_count, r.interval_unit, r.seed_occurrence_date,
           r.max_occurrences, r.end_date)
   limit 1;
  if v_off is not null then
    raise exception '0069 failed: rule % kept an offset the function does not agree with', v_off;
  end if;

  -- And the triggers are back on, for normal writes.
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.recurrences'::regclass
       and tgname in ('trg_recurrence_reconstruct_from_guard',
                      'trg_recurrence_resolve_schedule_effective_from')
       and tgenabled not in ('O', 'A')
  ) then
    raise exception '0069 failed: a trigger it disabled was left off';
  end if;

  raise notice '✓ 0069 — the seed occurrence agrees with the anchor the rule began with';
end $selfcheck$;

commit;
