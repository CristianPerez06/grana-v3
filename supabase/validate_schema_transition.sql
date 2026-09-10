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
-- IT IS A GATE, NOT A PHASE REPORT. An earlier version only checked which side
-- of the activation the schema was on, so it went green with the identity index
-- deleted, or the schedule-version tables missing, or the triggers gone — every
-- object the activation is about to depend on. It now verifies the expansion
-- itself (0064 and 0065) and only then the phase.
--
-- Run:  psql "$DATABASE_URL" -f supabase/validate_schema_transition.sql
-- =============================================================================

begin;

-- ── 1 · The expansion is installed ─────────────────────────────────────────
do $$
declare
  missing text;
begin
  -- Columns 0064 adds. Without them there is nothing to be in the middle of,
  -- and the answer is "apply 0064", not "you are in the window".
  for missing in
    select col from unnest(array['due_date',
                                 'due_date_is_unknown',
                                 'resolution_kind',
                                 'linked_conversion']) as col
    where not exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'recurrence_instances'
         and column_name  = col
    )
  loop
    raise exception 'transition check: recurrence_instances.% is missing — the expansion (0064) is not applied, so this is not the transition window', missing;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'recurrences'
       and column_name  = 'reconstruct_from'
  ) then
    raise exception 'transition check: recurrences.reconstruct_from is missing (0064) — the generator has no floor and would rebuild from the beginning of time';
  end if;

  -- The two tables the walker reads. Missing, the generator falls back to
  -- nothing and silently rebuilds against the wrong calendar.
  for missing in
    select t from unnest(array['recurrence_schedule_versions',
                               'recurrence_pauses']) as t
    where to_regclass('public.' || t) is null
  loop
    raise exception 'transition check: public.% is missing (0064)', missing;
  end loop;

  -- The triggers that MAINTAIN all of that. They are the reason the app does not
  -- write these tables itself, so their absence is not visible from the client:
  -- rules keep being created and edited, and their history quietly stops.
  for missing in
    select tg from unnest(array['trg_recurrence_reconstruct_from_guard',
                                'trg_recurrence_sync_schedule_and_pauses',
                                'trg_recurrence_instance_compat']) as tg
    where not exists (
      select 1 from pg_trigger where tgname = tg and not tgisinternal
    )
  loop
    raise exception 'transition check: trigger % is missing (0064)', missing;
  end loop;

  -- 0065's atomic repair, by SIGNATURE: PostgREST resolves an RPC by its named
  -- arguments, so a same-named function with a different parameter would leave
  -- deleting a seeded movement silently unperformed.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'delete_movement_unlinking_seed'
       and pg_get_function_identity_arguments(p.oid) = 'p_transaction_id uuid'
       and p.prosecdef = false
  ) then
    raise exception 'transition check: public.delete_movement_unlinking_seed(p_transaction_id uuid) is missing, or is not SECURITY INVOKER (0065)';
  end if;
end $$;

-- ── 2 · And the two guards the activation will lean on ─────────────────────
-- Same block as `validate_schema.sql` and migration 0066, on purpose: the
-- contract cannot be weaker here than at the moment it gets relied upon.

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

-- ── 3 · The phase itself ───────────────────────────────────────────────────
do $$
begin
  -- The old constraint is STILL STANDING. Its absence means the activation
  -- already happened, and the file to run is `validate_schema.sql`.
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname  = 'recurrence_instances_one_pending_per_rule'
  ) then
    raise exception 'transition check: the single-pending index is gone — the activation (0066) is applied, so validate the final state with validate_schema.sql instead';
  end if;

  -- The two models coexist coherently. That is this state's whole risk: an
  -- occurrence written during the window has to be valid under BOTH, which is
  -- what 0064's compatibility trigger is for. A pending row with no `due_date`
  -- would be valid under the old model and identity-less under the new one.
  if exists (
    select 1 from public.recurrence_instances
     where status = 'pending' and due_date is null
  ) then
    raise exception 'transition check: pending rows with no due_date — 0064''s compatibility trigger is not deriving it, and the activation would leave them without identity';
  end if;

  -- And nobody got ahead of the plan: while the old index stands, no rule can
  -- hold two unresolved occurrences. If one does, the index was dropped and
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

  raise notice '✓ transition window OK — expansion (0064/0065) fully installed, activation (0066) still pending. Run validate_schema.sql once it is applied.';
end $$;

rollback;
