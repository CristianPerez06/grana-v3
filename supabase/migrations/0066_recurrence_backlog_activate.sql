-- ═══════════════════════════════════════════════════════════════════════════
-- 0066 · Activation: the backlog is allowed to exist
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migration B of the expand/activate pair (decision 17). 0064 and 0065 are
-- additive and change no behaviour; THIS ONE DOES. It retires
-- `recurrence_instances_one_pending_per_rule`, 0011's index that allowed a
-- single unresolved occurrence per rule.
--
-- That index IS #96. With it, an occurrence the user never reviewed blocks its
-- rule forever: the generator cannot write the next one, so the backlog does not
-- exist in the database and therefore does not exist on any screen. Without it a
-- rule may owe several, and each is resolved on its own, in any order.
--
-- ═══ DO NOT APPLY UNTIL ALL THREE CONDITIONS HOLD ═══
--
--   1. Web and native deployed with the new model: batched generator, reads
--      that return collections, dashboard and projection reading the existing
--      occurrences. A screen still rendering `[0]` of a list would show one of
--      several as if it were the only one.
--   2. No older native client still in use (task 2.8b). An old client never runs
--      the new generator, so its backlog is never materialized and #96 stays
--      alive for that user — now with nothing containing it. Today this holds
--      because there are no distributed native builds; it is RE-VERIFIED at
--      apply time, never assumed.
--   3. Manual QA of the six behaviours, against an environment where this
--      migration is already applied: the central one — several vencimientos at
--      once — cannot be exercised while the index is alive.
--
-- Condition 1 is the only one the database can see, and the part it can see is
-- checked below: the index is not dropped if the new model is not there.
--
-- ═══ WHAT IT DOES NOT DO ═══
--
-- It does not touch `resolution_kind` or its CHECKs: those belong to the
-- expansion (0064, task 1.4b), where the compatibility trigger fills the column
-- in before the CHECK runs.
--
-- It does not retire `scheduled_date` or `last_generated_date`. That is step C,
-- a later delivery with its own verification: the trigger's compatibility
-- branches and the reads that still display the column have to go first.
--
-- REVERSIBLE, WITH A LIMIT. Recreating the index is one line, written at the end
-- of this file. What cannot be undone is backlog already materialized: once any
-- rule holds two pending rows the CREATE UNIQUE INDEX fails, and going back
-- means deciding by hand which of its occurrences survives — the very decision
-- this change exists to avoid. That is why the order above is not negotiable.

begin;

-- ── Condition 1, verified ──────────────────────────────────────────────────
--
-- Checked STRUCTURALLY, not by name. An index that merely answers to the right
-- name proves nothing: it could live in another schema, sit on another table,
-- be non-unique, be an invalid leftover of a failed concurrent build, or cover
-- different columns. Retiring the old protection against something like that is
-- how a migration reports success and leaves the database unprotected.
do $$
declare
  v_predicate text;
  v_columns   text[];
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'recurrence_instances'
       and column_name  = 'due_date'
  ) then
    raise exception 'activation aborted: recurrence_instances.due_date is missing — apply 0064 first';
  end if;

  -- The identity index is what keeps the generator from materializing the same
  -- occurrence twice when two runs overlap. Once the single-pending index is
  -- gone, it is the ONLY thing that does.
  select array(
           select a.attname
             from unnest(i.indkey) with ordinality as k(attnum, ord)
             join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
            order by k.ord
         ),
         pg_get_expr(i.indpred, i.indrelid)
    into v_columns, v_predicate
    from pg_index i
    join pg_class     ix on ix.oid = i.indexrelid
    join pg_class     tb on tb.oid = i.indrelid
    join pg_namespace ns on ns.oid = ix.relnamespace
   where ns.nspname  = 'public'
     and ix.relname  = 'recurrence_instances_one_per_rule_due_date'
     and tb.relname  = 'recurrence_instances'
     and i.indisunique
     and i.indisvalid
     and i.indisready;

  if v_columns is null then
    raise exception 'activation aborted: public.recurrence_instances_one_per_rule_due_date is missing, or is not a valid UNIQUE index on public.recurrence_instances (0064)';
  end if;

  if v_columns <> array['recurrence_id', 'due_date']::text[] then
    raise exception 'activation aborted: the identity index covers (%), not (recurrence_id, due_date) — it would not stop a duplicated occurrence', array_to_string(v_columns, ', ');
  end if;

  -- Partial on purpose: a historical `confirmed` row holds `due_date NULL` and
  -- competes for no identity. A full index would let one unknown row block a
  -- real occurrence — which is the trap 0064 was built to avoid.
  if v_predicate is null
     or replace(lower(v_predicate), ' ', '') not like '%due_dateisnotnull%' then
    raise exception 'activation aborted: the identity index is not partial on `due_date is not null` (found: %) — an unknown identity could block a known one', coalesce(v_predicate, 'no predicate');
  end if;

  -- And every unresolved occurrence must be guaranteed a vencimiento: without
  -- one the row has no identity, so the index above does not cover it. The
  -- CHECK has to exist AND be validated — one added `NOT VALID` enforces new
  -- rows while leaving whatever is already stored unexamined.
  if not exists (
    select 1 from pg_constraint
     where conrelid  = 'public.recurrence_instances'::regclass
       and conname   = 'chk_recurrence_instances_unresolved_has_due_date'
       and contype   = 'c'
       and convalidated
  ) then
    raise exception 'activation aborted: chk_recurrence_instances_unresolved_has_due_date is missing or NOT VALID (0064) — a pending row with no due_date would have no identity';
  end if;

  -- Belt and braces for what that CHECK guarantees: if the constraint was added
  -- NOT VALID at some point and validated later, this is what would have been
  -- skipped in between.
  if exists (
    select 1 from public.recurrence_instances
     where status = 'pending' and due_date is null
  ) then
    raise exception 'activation aborted: there are pending rows with no due_date — they have no identity and the unique index does not cover them';
  end if;
end $$;

-- ── The activation ─────────────────────────────────────────────────────────
drop index if exists public.recurrence_instances_one_pending_per_rule;

-- ── Self-check ─────────────────────────────────────────────────────────────
-- That the index is gone, and that what replaces it is still standing. A silent
-- `drop` against the wrong name would leave the migration "successful" and #96
-- untouched.
do $$
begin
  if exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname  = 'recurrence_instances_one_pending_per_rule'
  ) then
    raise exception 'activation failed: the single-pending index is still there';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname  = 'recurrence_instances_one_per_rule_due_date'
  ) then
    raise exception 'activation failed: the identity index is gone';
  end if;

  raise notice '✓ 0066 — backlog activated: a rule may owe several unresolved occurrences';
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Only works while no rule has accumulated two pending occurrences yet. Once one
-- has, the CREATE fails and going back means deciding by hand which of its
-- occurrences is kept — exactly the decision this change exists to avoid.
--
--   create unique index recurrence_instances_one_pending_per_rule
--     on public.recurrence_instances (recurrence_id)
--     where status = 'pending';
