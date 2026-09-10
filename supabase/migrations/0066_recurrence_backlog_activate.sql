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
-- The database can only see one of the three conditions: whether the new model
-- is there. It is checked before anything is dropped, because retiring the old
-- protection over an unprotected table is the one outcome worse than not
-- running at all.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'recurrence_instances'
       and column_name  = 'due_date'
  ) then
    raise exception 'activation aborted: recurrence_instances.due_date is missing — apply 0064 first';
  end if;
end $$;

-- ┌── SHARED CONTRACT · occurrence identity ─────────────────────────────────┐
-- │ BYTE-IDENTICAL in three files: migration 0066, validate_schema.sql and   │
-- │ validate_schema_transition.sql. SQL applied by hand has no include, so   │
-- │ the copies are kept identical on purpose and a test compares them; edit  │
-- │ one and that test tells you which others to bring along.                 │
-- │                                                                          │
-- │ It checks the two guards BY BEHAVIOUR, not by the text they happen to be │
-- │ spelled with. A name proves nothing and neither does a substring: an     │
-- │ index predicate reading `due_date is not null and status = 'confirmed'`  │
-- │ contains all the right words and protects no unresolved occurrence, and  │
-- │ a correctly named CHECK may say `true`. Comparing the rendered text      │
-- │ exactly would catch both and break on any equivalent rewrite — and on a  │
-- │ Postgres that renders the same expression differently from the one this  │
-- │ was written against.                                                     │
-- │                                                                          │
-- │ So each guard is copied onto a TEMPORARY table and probed there. No      │
-- │ production row is touched, and what gets asserted is the rule.           │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
declare
  v_predicate text;
  v_columns   text[];
  v_check_def text;
  v_status    text;
  v_rid       uuid := '00000000-0000-0000-0000-0000000000aa';
begin
  -- ── 1 · The identity index ──────────────────────────────────────────────
  -- Structure first: right schema, right table, unique, valid, ready, and the
  -- two columns that make an occurrence. An index that merely answers to the
  -- name could be any of those things and protect nothing.
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
   where ns.nspname = 'public'
     and ix.relname = 'recurrence_instances_one_per_rule_due_date'
     and tb.relname = 'recurrence_instances'
     and i.indisunique
     and i.indisvalid
     and i.indisready;

  if v_columns is null then
    raise exception 'occurrence identity: public.recurrence_instances_one_per_rule_due_date is missing, or is not a valid UNIQUE index on public.recurrence_instances (0064)';
  end if;

  if v_columns <> array['recurrence_id', 'due_date']::text[] then
    raise exception 'occurrence identity: the index covers (%), not (recurrence_id, due_date) — it would not stop a duplicated occurrence', array_to_string(v_columns, ', ');
  end if;

  -- Partial on purpose: a historical `confirmed` row holds `due_date NULL` and
  -- competes for no identity. A full index would let one unknown row block a
  -- real occurrence, which is the trap 0064 was built to avoid.
  if v_predicate is null then
    raise exception 'occurrence identity: the index is not partial — a row with an unknown due_date would compete for an identity it does not have';
  end if;

  create temp table identity_probe (
    recurrence_id uuid,
    due_date      date,
    status        text
  ) on commit drop;

  execute format(
    'create unique index identity_probe_ix on identity_probe (recurrence_id, due_date) where %s',
    v_predicate
  );

  -- Every status that OCCUPIES a due date has to be covered. `pending` and
  -- `skipped` are unresolved or resolved-without-a-movement and both hold their
  -- vencimiento; a `confirmed` row written after 0064 holds an exact one too.
  -- A predicate that excludes any of them lets the generator write the same
  -- occurrence twice, which is the duplicate this index exists to refuse.
  for v_status in select unnest(array['pending', 'skipped', 'confirmed']) loop
    begin
      insert into identity_probe (recurrence_id, due_date, status)
      values (v_rid, date '2026-06-23', v_status),
             (v_rid, date '2026-06-23', v_status);
      raise exception 'occurrence identity: the index predicate (%) does not cover % occurrences — the same vencimiento could be materialized twice', v_predicate, v_status;
    exception
      when unique_violation then
        null;  -- what has to happen
    end;
  end loop;

  -- ── 2 · The due-date CHECK ──────────────────────────────────────────────
  -- It has to exist AND be validated: one added `NOT VALID` enforces new rows
  -- while leaving everything already stored unexamined, which is exactly the
  -- data this is about.
  select pg_get_constraintdef(oid)
    into v_check_def
    from pg_constraint
   where conrelid = 'public.recurrence_instances'::regclass
     and conname  = 'chk_recurrence_instances_unresolved_has_due_date'
     and contype  = 'c'
     and convalidated;

  if v_check_def is null then
    raise exception 'unresolved due date: chk_recurrence_instances_unresolved_has_due_date is missing or NOT VALID (0064) — a pending row with no due_date would have no identity';
  end if;

  create temp table check_probe (
    status   text,
    due_date date
  ) on commit drop;

  execute format('alter table check_probe add %s', v_check_def);

  -- An UNRESOLVED occurrence with no vencimiento has to be refused. A CHECK
  -- with the right name and the body `true` passes every test that looks at
  -- names, states and stored rows, and stops nothing from here on.
  for v_status in select unnest(array['pending', 'skipped']) loop
    begin
      insert into check_probe (status, due_date) values (v_status, null);
      raise exception 'unresolved due date: the CHECK accepts a % row with no due_date, so its rule does not match its name (%)', v_status, v_check_def;
    exception
      when check_violation then
        null;  -- what has to happen
    end;
  end loop;

  -- And a historical `confirmed` row with no vencimiento has to be ACCEPTED:
  -- 0064 leaves those null on purpose, because the date is unrecoverable.
  begin
    insert into check_probe (status, due_date) values ('confirmed', null);
  exception
    when check_violation then
      raise exception 'unresolved due date: the CHECK rejects a historical confirmed row with no due_date (%) — 0064 leaves those null on purpose', v_check_def;
  end;
end $$;
-- └── END SHARED CONTRACT ───────────────────────────────────────────────────┘

-- Belt and braces for what that CHECK guarantees: if it was ever added
-- `NOT VALID` and validated later, this is what would have been skipped in
-- between. Cheap, and the rows it would find are unfixable after the drop.
do $$
begin
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
