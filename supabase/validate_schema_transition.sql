-- =============================================================================
-- validate_schema_transition.sql — the window between the expansion and the
-- activation of the recurrence backlog (migrations 0064/0065 applied, 0066 not).
--
-- Comments in English per AGENTS.md.
--
-- WHY IT IS A SEPARATE FILE. `validate_schema.sql` validates the FINAL state and
-- demands the activation: while `recurrence_instances_one_pending_per_rule`
-- exists, a rule can hold only one unresolved occurrence, which is #96 exactly
-- as reported. Accepting that state there would mean signing off on the unfixed
-- schema.
--
-- But the window is real and, for a while, correct: 0064 and 0065 are applied,
-- web and native are being deployed, and the activation deliberately waits until
-- every surface can render a collection and manual QA has run. THIS file is what
-- to run during that window — and only then. Once 0066 is applied it starts
-- failing on purpose, which is the signal to go back to `validate_schema.sql`.
--
-- Run:  psql "$DATABASE_URL" -f supabase/validate_schema_transition.sql
-- =============================================================================

begin;

do $$
begin
  -- (1) The expansion IS applied. Without it there is nothing to be in the
  -- middle of, and the answer is "apply 0064", not "you are in the window".
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'recurrence_instances'
       and column_name  = 'due_date'
  ) then
    raise exception 'transition check: recurrence_instances.due_date is missing — the expansion (0064) is not applied, so this is not the transition window';
  end if;

  -- (2) The old constraint is STILL STANDING. Its absence means the activation
  -- already happened, and the file to run is `validate_schema.sql`.
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname  = 'recurrence_instances_one_pending_per_rule'
  ) then
    raise exception 'transition check: the single-pending index is gone — the activation (0066) is applied, so validate the final state with validate_schema.sql instead';
  end if;

  -- (3) The two models coexist coherently. This is the state's whole risk: an
  -- occurrence written during the window has to be valid under BOTH, and that is
  -- what 0064's compatibility trigger is for. A pending row with no `due_date`
  -- would be valid under the old model and identity-less under the new one.
  if exists (
    select 1 from public.recurrence_instances
     where status = 'pending' and due_date is null
  ) then
    raise exception 'transition check: pending rows with no due_date — 0064''s compatibility trigger is not deriving it, and the activation would leave them without identity';
  end if;

  -- (4) And nobody got ahead of the plan: while the old index stands, no rule
  -- can hold two unresolved occurrences. If one does, the index was dropped and
  -- recreated, or disabled, somewhere off the deploy path.
  if exists (
    select 1
      from public.recurrence_instances
     where status = 'pending'
     group by recurrence_id
    having count(*) > 1
  ) then
    raise exception 'transition check: a rule already holds several pending occurrences while the single-pending index stands — the schema was changed outside the migrations';
  end if;

  raise notice '✓ transition window OK — expansion applied, activation (0066) still pending. Run validate_schema.sql once it is applied.';
end $$;

rollback;
