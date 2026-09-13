-- ═══════════════════════════════════════════════════════════════════════════
-- 0069 · The seed occurrence of ONE rule, repaired where 0068 guessed it wrong
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
-- ═══ ONE ROW, NAMED, AND ONLY IN ONE SHAPE ════════════════════════════════
--
-- This repair is addressed to a single rule, identified by id, and it writes
-- only if that row is EXACTLY as the audit found it:
--
--   id                    3e8a9b72-8059-42e7-b163-f482f0b05749
--   start_date            2026-07-10   (the corrected anchor)
--   seed_occurrence_date  2026-07-10   (what 0068 wrote: the corrected anchor)
--   earliest anchor_date  2026-07-08   (where the rule actually began)
--   created_from_transaction_id  not null
--
-- and it sets `seed_occurrence_date` to 2026-07-08. Any other shape ABORTS
-- without writing. A database where the row does not exist is a NO-OP.
--
-- ═══ WHY NOT THE GENERIC CRITERION ════════════════════════════════════════
--
-- Two earlier drafts of this file repaired "every linked rule whose seed differs
-- from the `anchor_date` of its earliest schedule version", on the claim that
-- nothing rewrites that first version. THAT CLAIM IS FALSE, and the criterion
-- built on it CORRUPTS CORRECT DATA:
--
--   0068's `recurrence_sync_schedule_and_pauses()` DELETES the versions that
--   have not come into effect yet — `effective_from > today` — before opening
--   the corrected one. A rule seeded by a FUTURE movement has exactly one such
--   version, the one its own insert created. Correct its anchor before the rule
--   starts and that version is gone; the earliest one left carries the NEW
--   anchor, while `seed_occurrence_date` correctly keeps the occurrence the
--   movement covers. The two disagree and NOTHING IS WRONG — and the generic
--   query would have overwritten that correct seed with the corrected anchor,
--   destroying the identity `trg_recurrence_reconstruct_from_guard` exists to
--   protect. `seed-identity-repair.test.ts` walks that path.
--
-- No query separates the broken rule from that correct one: the same three
-- columns, with the old value on the other side. So the rule is not expressed as
-- a query at all. What justified the write was never the criterion — it was the
-- AUDIT (caso real reportado en #96), which ran the comparison as a READ and
-- found exactly one disagreement, on an active rule whose anchor had been
-- corrected in the past. This file writes that finding down instead of
-- re-deriving it, and refuses if the row it names is not what was audited.
--
-- Which is also why `validate_schema.sql` 8.1L only LISTS disagreements: there
-- is no invariant here for a schema validator to assert.
--
-- NOT compared against `transactions.date` either: that column is editable, so a
-- movement re-dated after the fact reads as a broken identity and is not one.
-- Ten rules differ that way and are correct; comparing against the movement is
-- what made them look wrong in the first measurement.
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
--   · Reads the named row under `for update`, compares it against the four
--     values above, and writes ONLY on an exact match.
--   · Recomputes `schedule_positions_before` for that same row, in the same
--     transaction, from the same function the RPC validates with: a repaired
--     seed with a stale offset is half a repair.
--
-- A failure at any point rolls the whole thing back, the trigger states included:
-- `alter table ... disable trigger` is transactional in Postgres. So an abort
-- leaves the database exactly as it was, guards on.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.recurrences disable trigger trg_recurrence_reconstruct_from_guard;
alter table public.recurrences disable trigger trg_recurrence_resolve_schedule_effective_from;

DO $repair$
declare
  -- The audited row, and the state it was audited in. Every one of these is
  -- compared before anything is written.
  k_id     constant uuid := '3e8a9b72-8059-42e7-b163-f482f0b05749';
  k_start  constant date := '2026-07-10';  -- the corrected anchor, left alone
  k_was    constant date := '2026-07-10';  -- what 0068 recorded as the seed
  k_should constant date := '2026-07-08';  -- where the rule actually began
  v_rule   public.recurrences%rowtype;
  v_anchor   date;
  v_after    date;
  v_offset   int;
  v_expected int;
begin
  -- Locked for the whole decision: the shape is checked and then written, and a
  -- concurrent edit in between would mean writing against a row nobody audited.
  select * into v_rule from public.recurrences where id = k_id for update;

  if not found then
    -- A clean database, or any database that is not the one audited. Nothing to
    -- repair and nothing to complain about.
    raise notice '· 0069 — rule % is not on this database: no-op', k_id;
    return;
  end if;

  -- The earliest version SURVIVING today. `effective_from` orders it; `id`
  -- breaks a tie so the answer cannot depend on physical row order.
  select v.anchor_date into v_anchor
    from public.recurrence_schedule_versions v
   where v.recurrence_id = k_id
   order by v.effective_from, v.id
   limit 1;

  -- ALREADY APPLIED. Re-pasting a migration by hand is a normal accident, and a
  -- repair that explodes the second time teaches people to stop re-running the
  -- ones that are safe. Distinguishable from the shape below: the seed holds the
  -- repaired value while `start_date` still holds the corrected anchor.
  if v_rule.created_from_transaction_id is not null
     and v_rule.seed_occurrence_date = k_should
     and v_rule.start_date           = k_start
     and v_anchor                    = k_should then
    raise notice '· 0069 — rule % already carries the repaired seed %: no-op', k_id, k_should;
    return;
  end if;

  -- ANY OTHER SHAPE IS NOT THE AUDITED ONE. The whole point of naming the row is
  -- that the write is justified by what was found there, not by a query that
  -- also matches rules which are correct. Aborting rolls back the trigger
  -- disables above with it.
  if v_rule.created_from_transaction_id is null
     or v_rule.seed_occurrence_date is distinct from k_was
     or v_rule.start_date           is distinct from k_start
     or v_anchor                    is distinct from k_should then
    raise exception '0069 refuses to write: rule % is not in the shape this repair was audited for (linked=%, start_date=%, seed=%, earliest anchor=%; expected linked=true, start_date=%, seed=%, earliest anchor=%). Nothing was changed — re-run the audit before repairing anything here',
      k_id,
      v_rule.created_from_transaction_id is not null, v_rule.start_date,
      v_rule.seed_occurrence_date, v_anchor,
      k_start, k_was, k_should;
  end if;

  update public.recurrences
     set seed_occurrence_date = k_should
   where id = k_id;

  -- And the number derived from it, in the same breath.
  update public.recurrences r
     set schedule_positions_before = public.recurrence_positions_before(
           r.id, r.schedule_effective_from, r.start_date,
           r.interval_count, r.interval_unit, r.seed_occurrence_date,
           r.max_occurrences, r.end_date)
   where r.id = k_id;

  -- ── Self-check, on the row that was written ──────────────────────────────
  select r.seed_occurrence_date,
         r.schedule_positions_before,
         public.recurrence_positions_before(
           r.id, r.schedule_effective_from, r.start_date,
           r.interval_count, r.interval_unit, r.seed_occurrence_date,
           r.max_occurrences, r.end_date)
    into v_after, v_offset, v_expected
    from public.recurrences r where r.id = k_id;

  if v_after is distinct from k_should then
    raise exception '0069 failed: rule % still carries seed %', k_id, v_after;
  end if;
  if v_offset is distinct from v_expected then
    raise exception '0069 failed: rule % kept an offset the function does not agree with (% vs %)', k_id, v_offset, v_expected;
  end if;

  raise notice '✓ 0069 — rule %: seed occurrence % → %, offset recomputed to %', k_id, k_was, k_should, v_offset;
end $repair$;

alter table public.recurrences enable trigger trg_recurrence_reconstruct_from_guard;
alter table public.recurrences enable trigger trg_recurrence_resolve_schedule_effective_from;

-- ── The triggers are back on, for normal writes ────────────────────────────
DO $guards$
begin
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.recurrences'::regclass
       and tgname in ('trg_recurrence_reconstruct_from_guard',
                      'trg_recurrence_resolve_schedule_effective_from')
       and tgenabled not in ('O', 'A')
  ) then
    raise exception '0069 failed: a trigger it disabled was left off';
  end if;
end $guards$;

commit;
