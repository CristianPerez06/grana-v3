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
-- THE WINDOW IS REAL BECAUSE THERE IS ONLY ONE DATABASE. Supabase is
-- online-only here and there is a single project (AGENTS.md), so the expansion
-- lands on the database real people use and stays there while web and native are
-- deployed and walked through. That gap is what this file guards. It is not a
-- staging concept: there is no staging.
--
-- Run:  psql "$DATABASE_URL" -f supabase/validate_schema_transition.sql
-- =============================================================================

begin;

-- ── 1 · The expansion is installed, at the same depth as the final check ───
-- The same block `validate_schema.sql` runs. An earlier version of this file
-- checked a handful of objects by NAME, so a trigger on another table, or a new
-- table missing half its columns, passed as installed — and this is the gate in
-- front of the QA that decides the activation.

-- ┌── SHARED BLOCK · expansion inventory (0064 + 0065) ─────────────────────┐
-- │ BYTE-IDENTICAL in `validate_schema.sql` and                             │
-- │ `validate_schema_transition.sql`. SQL applied by hand has no include, so │
-- │ the copies are kept identical on purpose and a test compares them.       │
-- │                                                                          │
-- │ It is shared because the transition window needs exactly the same depth  │
-- │ as the final state: objects checked by NAME alone let a trigger on       │
-- │ another table, a disabled one, or a table missing half its columns pass  │
-- │ as installed — and the window is when the QA that decides the activation │
-- │ happens. What differs between the two files is the PHASE, and only that: │
-- │ it lives outside this block in each of them.                             │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
declare
  missing   text;
  v_secdef  boolean;
  v_offend  int;
begin

  -- (1) New columns on the existing table, plus the rule's reconstruction floor.
  for missing in
    select col from unnest(array['due_date','due_date_is_unknown','resolution_kind','linked_conversion']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_instances'
        and column_name = col
    )
  loop
    raise exception 'recurrence_instances.% is missing (migration 0064)', missing;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recurrences'
       and column_name = 'reconstruct_from' and is_nullable = 'NO'
  ) then
    raise exception 'recurrences.reconstruct_from is missing or nullable (migration 0064)';
  end if;

  -- NOT NULL *with* a default, on purpose. Without one, `supabase gen types`
  -- marks the column REQUIRED on Insert and every client has to send a value the
  -- database owns — old clients included, which cannot. `infinity` fails closed:
  -- if the trigger were dropped, the generator materializes nothing instead of
  -- rebuilding a rule's whole history as backlog.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recurrences'
       and column_name = 'reconstruct_from' and column_default like '%infinity%'
  ) then
    raise exception 'recurrences.reconstruct_from lost its default: generated types would require it on Insert, and without it the value stops failing closed if the guard is dropped';
  end if;

  -- And the placeholder never survives: the trigger computes the column on every
  -- insert, so no row may hold it.
  select count(*) into v_offend
    from public.recurrences where reconstruct_from = 'infinity'::date;
  if v_offend > 0 then
    raise exception 'recurrences: % rows hold reconstruct_from = infinity — the guard that derives the column did not run', v_offend;
  end if;

  -- (2) The two new tables and their columns.
  for missing in
    select col from unnest(array['id','recurrence_id','user_id','effective_from','interval_count',
                                 'interval_unit','anchor_date','is_assumed','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_schedule_versions'
        and column_name = col
    )
  loop
    raise exception 'recurrence_schedule_versions.% is missing', missing;
  end loop;

  for missing in
    select col from unnest(array['id','recurrence_id','user_id','paused_from','resumed_at','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_pauses'
        and column_name = col
    )
  loop
    raise exception 'recurrence_pauses.% is missing', missing;
  end loop;

  -- (3) Indexes. The identity index is PARTIAL on purpose: a historical
  --     confirmed row has no identity to enforce, so it stays out of the index
  --     that enforces identity. (Not because a NULL would block a known date:
  --     Postgres treats NULLs as distinct, so a full index would admit any
  --     number of them.) Whether the predicate is the right one is asserted by
  --     the SHARED CONTRACT block, against a canonical definition.
  for missing in
    select ix from unnest(array['recurrence_instances_one_per_rule_due_date',
                                'recurrence_schedule_versions_one_per_date',
                                'idx_recurrence_schedule_versions_lookup',
                                'recurrence_pauses_one_open_per_rule',
                                'idx_recurrence_pauses_lookup']) as ix
    where not exists (
      select 1 from pg_indexes where schemaname = 'public' and indexname = ix
    )
  loop
    raise exception 'index % does not exist (migration 0064)', missing;
  end loop;

  -- Whether that index actually protects anything — and whether the due-date
  -- CHECK does — is asserted by the SHARED CONTRACT block right after this one.
  -- It used to be `indexdef like '%WHERE (due_date IS NOT NULL)%'`, which a
  -- predicate of `due_date is not null and status = 'confirmed'` satisfies while
  -- covering no unresolved occurrence at all.

  -- (5) Constraints.
  for missing in
    select cn from unnest(array['chk_recurrence_instances_due_date_unknown',
                                'chk_recurrence_instances_unresolved_has_due_date',
                                'chk_recurrence_instances_resolution_kind',
                                'chk_recurrence_instances_linked_conversion']) as cn
    where not exists (
      select 1 from pg_constraint
       where conrelid = 'public.recurrence_instances'::regclass and conname = cn
    )
  loop
    raise exception 'CHECK % does not exist on recurrence_instances', missing;
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.recurrences'::regclass
       and conname = 'recurrences_id_user_unique' and contype = 'u'
  ) then
    raise exception 'recurrences_id_user_unique does not exist: without that candidate key the composite FKs cannot be declared';
  end if;

  -- (6) COMPOSITE FKs. With two independent FKs (rule on one side, user on the
  --     other) and an RLS policy that only checks `user_id = auth.uid()`, the
  --     database would accept a row holding MY user and SOMEBODY ELSE'S rule.
  --
  --     Checked by the COLUMNS on both sides, not by "it has two of them": a
  --     constraint with the right name, the right arity and the wrong columns
  --     would pass a nominal check and protect nothing.
  for missing in
    select t.child from (values
      ('recurrence_schedule_versions', 'recurrence_schedule_versions_recurrence_fk'),
      ('recurrence_pauses',            'recurrence_pauses_recurrence_fk')
    ) as t(child, cname)
    where not exists (
      select 1
        from pg_constraint con
       where con.conrelid = ('public.' || t.child)::regclass
         and con.conname  = t.cname
         and con.contype  = 'f'
         and con.confrelid = 'public.recurrences'::regclass
         and con.confdeltype = 'c'  -- ON DELETE CASCADE
         -- Local columns, in order: (recurrence_id, user_id).
         and (select array_agg(a.attname::text order by k.ord)
                from unnest(con.conkey) with ordinality as k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = con.conrelid and a.attnum = k.attnum)
             = array['recurrence_id', 'user_id']
         -- Referenced columns, in order: (id, user_id).
         and (select array_agg(a.attname::text order by k.ord)
                from unnest(con.confkey) with ordinality as k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = con.confrelid and a.attnum = k.attnum)
             = array['id', 'user_id']
    )
  loop
    raise exception 'the FK from % to recurrences is not (recurrence_id, user_id) -> (id, user_id) ON DELETE CASCADE: a user could attach their user_id to somebody else''s rule', missing;
  end loop;

  -- (7) Triggers, checked by TABLE, FUNCTION, EVENTS, TIMING and LEVEL — not by
  --     name. A trigger called `trg_recurrence_reconstruct_from_guard` that only
  --     fires on INSERT is the exact hole this section exists to catch:
  --     `reconstruct_from` is the floor of what the generator reconstructs,
  --     `recurrences` has had a user UPDATE policy since 0011, and the generated
  --     types expose the column in `Update`. Moving that floor backwards
  --     fabricates months of backlog; moving it forwards hides occurrences the
  --     user is owed.
  --
  --     Timing and level are part of the contract, not decoration. The same guard
  --     moved to AFTER would still fire on both events and still pass an
  --     events-only check, while silently doing nothing: `NEW` is not writable
  --     after the row is in, so it could no longer DERIVE `reconstruct_from` on
  --     insert. A STATEMENT-level trigger has no `NEW`/`OLD` at all.
  --
  --     `tgenabled` is checked for the same reason, and it is the sharpest of the
  --     lot: `ALTER TABLE … DISABLE TRIGGER` leaves the name, the table, the
  --     function and every bit exactly as they are, and reopens the hole
  --     completely. 0064 itself documents that a later migration MAY disable the
  --     guard around a deliberate write — so the thing this file has to catch is
  --     someone forgetting to switch it back on. 'O' fires for origin and local
  --     writes, 'A' always; 'D' is disabled and 'R' only on a replica, and
  --     neither protects the writes the app actually makes.
  --
  --     And the function is matched by SCHEMA too: a same-named function outside
  --     `public` would otherwise pass.
  --
  --     `pg_trigger.tgtype` bits: 1 ROW, 2 BEFORE, 4 INSERT, 8 DELETE, 16 UPDATE.
  for missing in
    select t.tg from (values
      -- name                                     table                   function                               ins   upd   del    before
      ('trg_recurrence_instance_compat',          'recurrence_instances', 'recurrence_instance_compat',          true, true, false, true),
      ('trg_recurrence_reconstruct_from_guard',   'recurrences',          'recurrence_reconstruct_from_guard',   true, true, false, true),
      ('trg_recurrence_sync_schedule_and_pauses', 'recurrences',          'recurrence_sync_schedule_and_pauses', true, true, false, false)
    ) as t(tg, tbl, fn, want_insert, want_update, want_delete, want_before)
    where not exists (
      select 1
        from pg_trigger tr
        join pg_proc pr on pr.oid = tr.tgfoid
       where tr.tgname = t.tg
         and not tr.tgisinternal
         and tr.tgrelid = ('public.' || t.tbl)::regclass
         and pr.proname = t.fn
         and pr.pronamespace = 'public'::regnamespace
         and tr.tgenabled in ('O', 'A')                -- enabled for normal writes
         and ((tr.tgtype & 4)  <> 0) = t.want_insert   -- INSERT
         and ((tr.tgtype & 16) <> 0) = t.want_update   -- UPDATE
         and ((tr.tgtype & 8)  <> 0) = t.want_delete   -- DELETE
         and ((tr.tgtype & 2)  <> 0) = t.want_before   -- BEFORE, else AFTER
         and  (tr.tgtype & 1)  <> 0                    -- FOR EACH ROW
    )
  loop
    raise exception 'trigger % is missing, DISABLED, sits on another table or on a same-named function outside public, or no longer fires with the events, timing and level it must — BEFORE ROW for the two that write NEW, AFTER ROW for the history sync (migration 0064)', missing;
  end loop;

  -- (8) THE DATABASE IS THE SOLE OWNER of the new history. The two writer
  --     functions are SECURITY DEFINER with a locked search_path, because the
  --     tables are read-only for `authenticated` — that is what turns "the
  --     database owns it" from a convention into a guarantee.
  for missing in
    select fn from unnest(array['recurrence_sync_schedule_and_pauses',
                                'recurrence_reconstruct_from_guard']) as fn
  loop
    select p.prosecdef into v_secdef
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = missing;
    if v_secdef is null then
      raise exception 'function public.% does not exist (migration 0064)', missing;
    end if;
    if not v_secdef then
      raise exception 'public.% must be SECURITY DEFINER: the tables are read-only for authenticated', missing;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = missing
         and array_to_string(p.proconfig, ',') like '%search_path=%'
    ) then
      raise exception 'public.% is SECURITY DEFINER without a locked search_path', missing;
    end if;
  end loop;

  -- (9) And no write policies on either table: with them, "the database is the
  --     sole owner" would be a convention any client could sidestep.
  for missing in
    select p.tablename || '.' || p.policyname
      from pg_policies p
     where p.schemaname = 'public'
       and p.tablename in ('recurrence_schedule_versions', 'recurrence_pauses')
       and p.cmd <> 'SELECT'
  loop
    raise exception 'write policy % on the history: the triggers maintain it, not the client', missing;
  end loop;

  -- (10) Data invariants the constraints alone do not state.
  select count(*) into v_offend
    from public.recurrence_instances
   where (due_date is null) <> due_date_is_unknown;
  if v_offend > 0 then
    raise exception 'recurrence_instances: % rows where due_date_is_unknown disagrees with due_date', v_offend;
  end if;

  select count(*) into v_offend
    from public.recurrences r
   where not exists (
     select 1 from public.recurrence_schedule_versions v where v.recurrence_id = r.id
   );
  if v_offend > 0 then
    raise exception 'recurrences: % rules with no schedule version — the walker would not know which calendar applied', v_offend;
  end if;

  -- (10b) An UNRESOLVED occurrence always has an exact vencimiento. The column is
  -- nullable only for rows resolved before the distinction existed; a `pending`
  -- one with no `due_date` would have no identity at all, and every surface that
  -- reads the vencimiento (ordering, overdue, the confirm form's default date)
  -- narrows the type on this invariant.
  --
  -- `chk_recurrence_instances_unresolved_has_due_date` (checked above) is what
  -- ENFORCES it going forward. This stays because the two answer different
  -- questions: the constraint stops new violations, this one finds any that a
  -- restored dump or a pre-0064 deployment left behind.
  select count(*) into v_offend
    from public.recurrence_instances
   where status = 'pending' and due_date is null;
  if v_offend > 0 then
    raise exception 'recurrence_instances: % pending rows with no due_date — an unresolved occurrence has no identity without one', v_offend;
  end if;

  -- (11) The atomic repair for a deleted seed (migration 0065). Its whole point
  -- is that the unlink, the floor release and the DELETE happen together; if the
  -- function is missing the client has no way to do that, and every partial
  -- outcome either duplicates a gasto or loses an occurrence.
  --
  -- Checked BY SIGNATURE, not by name. A function that merely answers to the name
  -- is not the one the client calls: PostgREST resolves an RPC by its named
  -- arguments, so a same-named function with a different parameter would leave the
  -- repair silently unperformed while this check reported everything fine.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'delete_movement_unlinking_seed'
       -- The exact argument list PostgREST resolves the call against.
       and pg_get_function_identity_arguments(p.oid) = 'p_transaction_id uuid'
       and p.prorettype = 'void'::regtype
       -- SECURITY INVOKER: it must run as the user, so RLS decides what it may
       -- touch. As DEFINER it would silently grant reach nobody reviewed.
       and p.prosecdef = false
       -- Locked search_path: the body names unqualified relations, so a mutable
       -- path would let a caller's schema decide which tables it writes to.
       and array_to_string(p.proconfig, ',') like '%search_path=%'
  ) then
    raise exception 'public.delete_movement_unlinking_seed(p_transaction_id uuid) is missing, or is not a void SECURITY INVOKER function with a locked search_path (migration 0065)';
  end if;

  -- And `authenticated` has to be able to call it: without the grant the repair
  -- fails for every real client while the function sits there looking correct.
  if not has_function_privilege(
       'authenticated',
       'public.delete_movement_unlinking_seed(uuid)',
       'EXECUTE'
     ) then
    raise exception 'authenticated cannot execute public.delete_movement_unlinking_seed (migration 0065)';
  end if;

end $$;
-- └── END SHARED BLOCK · expansion inventory ───────────────────────────────┘

-- ── 2 · And the two guards the activation will lean on ─────────────────────
-- Same block as `validate_schema.sql` and migration 0066, on purpose: the
-- contract cannot be weaker here than at the moment it gets relied upon.

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
  v_column     text;
  v_due        date;
  v_accepted   boolean;
begin
  -- A copy of the real table: same columns, same types, no constraints and no
  -- indexes. Everything below is built and probed on THIS, so no production row
  -- is read or written.
  -- `including defaults` keeps whatever defaults the real columns have; the loop
  -- then drops every NOT NULL from the copy. Both are needed, and for the same
  -- reason: the only thing under test here is the identity contract, and a probe
  -- row must not have to satisfy every unrelated column of the real table.
  -- Without the loop this block fails on `amount` — NOT NULL with no default in
  -- production — which says nothing about the guards it exists to check.
  --
  -- Written as a loop over the catalog rather than a list of column names on
  -- purpose: a list goes stale the next time a column is added, and it goes
  -- stale silently, in a file nobody runs until the day it matters.
  create temp table identity_probe (
    like public.recurrence_instances including defaults
  ) on commit drop;

  for v_column in
    select a.attname
      from pg_attribute a
     where a.attrelid = 'identity_probe'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attnotnull
  loop
    execute format('alter table identity_probe alter column %I drop not null', v_column);
  end loop;

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
