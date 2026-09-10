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
-- ═══ THERE IS ONE DATABASE. APPLYING THIS IS A PRODUCTION CHANGE ═══
--
-- Supabase is online-only here and there is a single project (AGENTS.md):
-- migrations are pasted into the dashboard of the database real people use.
-- There is no QA copy to try this on, so "apply it in QA first" is not an option
-- that exists — applying it IS the release.
--
-- That makes the order matter more, not less, and it makes one of the checks
-- unrunnable beforehand. Before applying:
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
--   3. The five behaviours that do NOT need the backlog, walked on web and on
--      native during the transition window (0064/0065 applied, this one not):
--      `validate_schema_transition.sql` is the gate for that window.
--
-- The sixth behaviour — SEVERAL unresolved occurrences at once, which is what
-- the whole change is about — cannot be exercised before this migration, on any
-- database, because the index is what prevents it. It is verified immediately
-- AFTER applying, on real data. Reading condition 3 as "test everything first"
-- is what makes the plan look circular; it never included that one.
--
-- ═══ THE ROLLBACK EXPIRES ALMOST AT ONCE ═══
--
-- The line at the end of this file only works while no rule holds two pending
-- occurrences — and the first generator run after the activation is what creates
-- them, which happens the first time anybody opens the app. So the window in
-- which "put the index back" is still an option is measured in minutes, not days.
-- If a snapshot is wanted, it has to be taken BEFORE applying, not after
-- noticing something.
--
-- Condition 1 is the only one the database can see, and the part it can see is
-- checked below: the index is not dropped if the new model is not there. The
-- other two are decisions a person makes; this file cannot make them.
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
-- │ It checks the two guards that the activation is about to lean on, and it │
-- │ does so by comparing them against a CANONICAL definition built and       │
-- │ rendered by this same Postgres.                                          │
-- │                                                                          │
-- │ Three weaker approaches were tried and each let something through:       │
-- │   · by NAME — an index in another schema, on another table, non-unique   │
-- │     or invalid answers to the same name and protects nothing;            │
-- │   · by SUBSTRING — `due_date is not null and status = 'confirmed'`       │
-- │     contains every right word and covers no unresolved occurrence;       │
-- │   · by SAMPLE — probing one date and one uuid passes a predicate reading │
-- │     `due_date >= date '2026-01-01'`, which abandons everything older.    │
-- │     A sample cannot prove a rule that has to hold universally.           │
-- │                                                                          │
-- │ Comparing rendered text exactly is what proves it, and building the      │
-- │ canonical side HERE is what makes that safe: both sides come out of the  │
-- │ same server's deparser, so no Postgres version renders one differently   │
-- │ from the other. The temporary table is `like` the real one, so column    │
-- │ names and types — and therefore any cast the deparser prints — match.    │
-- │                                                                          │
-- │ The price is that an equivalent REWRITE is rejected (`not (due_date is   │
-- │ null)` is the same rule, spelled differently). That is a false red, not  │
-- │ a false green: it stops a deploy instead of blessing an unprotected      │
-- │ table, and the fix is to re-create the object in the canonical form.     │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
declare
  v_predicate  text;
  v_canonical  text;
  v_columns    text[];
  v_check_def  text;
  v_check_canon text;
  v_status     text;
  v_due        date;
  v_accepted   boolean;
begin
  -- A copy of the real table: same columns, same types, no constraints and no
  -- indexes. Everything below is built and probed on THIS, so no production row
  -- is read or written.
  -- `including defaults` matters: without it the copy keeps every NOT NULL and
  -- loses the defaults that satisfy them, so an insert fails on `id` instead of
  -- on the rule under test.
  create temp table identity_probe (
    like public.recurrence_instances including defaults
  ) on commit drop;

  -- ── 1 · The identity index ──────────────────────────────────────────────
  -- Structure first: right schema, right table, unique, valid, ready, and the
  -- two columns that make an occurrence.
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

  -- Partial on purpose. NOT because a NULL would block a known date — Postgres
  -- treats NULLs as distinct in a unique index, so a full index would admit any
  -- number of them. The reason is the other way round: a historical `confirmed`
  -- row has NO identity to enforce, so it has no business in the index that
  -- enforces identity. Keeping it out is what makes "every row here holds an
  -- exact vencimiento" true of the index itself, and what stops a later change
  -- — a NULLS NOT DISTINCT index, a backfill that guesses a date — from turning
  -- unknown rows into competitors for a slot they were never given.
  if v_predicate is null then
    raise exception 'occurrence identity: the index is not partial — rows with an unknown due_date have no identity and must not take part in the index that enforces it';
  end if;

  -- The canonical predicate, deparsed by this server from the definition 0064
  -- ships. Anything else — narrower, wider, or merely different — is refused.
  -- There is no probe here because no set of probes would do: a predicate is a
  -- rule over every row that could ever exist, and any finite sample of dates
  -- and uuids passes `due_date >= date '2026-01-01'` while abandoning every
  -- occurrence older than that.
  create unique index identity_probe_canonical
      on identity_probe (recurrence_id, due_date)
   where due_date is not null;

  select pg_get_expr(i.indpred, i.indrelid)
    into v_canonical
    from pg_index i
   where i.indexrelid = 'identity_probe_canonical'::regclass;

  if v_predicate is distinct from v_canonical then
    raise exception 'occurrence identity: the index predicate is %, not % — it does not cover the same occurrences. If it is an equivalent rewrite, re-create the index in the canonical form', v_predicate, v_canonical;
  end if;

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

  -- The REAL rule, copied onto the probe table and then exercised over its whole
  -- domain. `chk_recurrence_instances_status` (0011) limits `status` to three
  -- values and `due_date` is either known or not, so the six rows below are
  -- every case there is — an exhaustive truth table, not an example.
  --
  -- Both halves matter. A CHECK that refuses too much passes any test that only
  -- looks at what it rejects: `check (status = 'confirmed')` turns away a
  -- pending row with no vencimiento, and every legitimate pending occurrence
  -- along with it.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.recurrence_instances'::regclass
       and conname  = 'chk_recurrence_instances_status'
       and contype  = 'c'
       and convalidated
  ) then
    raise exception 'unresolved due date: chk_recurrence_instances_status is missing (0011) — status is unbounded, so the cases below would not be exhaustive';
  end if;

  execute format('alter table identity_probe add %s', v_check_def);

  for v_status, v_due, v_accepted in
    select * from (values
      -- An unresolved occurrence with no vencimiento has no identity: refused.
      ('pending',   null::date,        false),
      ('skipped',   null::date,        false),
      -- A historical confirmed row: 0064 leaves its due_date null on purpose.
      ('confirmed', null::date,        true),
      -- And everything WITH a vencimiento is legitimate, however old or far off.
      -- Two distant dates, because one would pass a rule bounded by a range.
      ('pending',   date '1999-01-01', true),
      ('skipped',   date '2099-12-31', true),
      ('confirmed', date '2026-06-23', true)
    ) as cases(status, due_date, accepted)
  loop
    begin
      insert into identity_probe (recurrence_id, user_id, scheduled_date, due_date, status)
      values (gen_random_uuid(), gen_random_uuid(),
              coalesce(v_due, date '2026-06-23'), v_due, v_status);
      if not v_accepted then
        raise exception 'unresolved due date: the CHECK accepts a % row with due_date % and must not (%)', v_status, coalesce(v_due::text, 'null'), v_check_def;
      end if;
    exception
      when check_violation then
        if v_accepted then
          raise exception 'unresolved due date: the CHECK rejects a % row with due_date %, which is a legitimate occurrence (%)', v_status, coalesce(v_due::text, 'null'), v_check_def;
        end if;
    end;
  end loop;

  -- And then the same exact-text argument as the index, on a clean copy: the
  -- truth table above covers every case the current schema allows, and the
  -- comparison is what keeps that claim true if a fourth status is ever added.
  create temp table canonical_probe (
    like public.recurrence_instances including defaults
  ) on commit drop;

  alter table canonical_probe
    add constraint chk_canonical check (status = 'confirmed' or due_date is not null);

  select pg_get_constraintdef(oid)
    into v_check_canon
    from pg_constraint
   where conrelid = 'canonical_probe'::regclass
     and conname  = 'chk_canonical';

  if v_check_def is distinct from v_check_canon then
    raise exception 'unresolved due date: the CHECK is %, not % — its rule is not the one its name claims. If it is an equivalent rewrite, re-create it in the canonical form', v_check_def, v_check_canon;
  end if;
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
