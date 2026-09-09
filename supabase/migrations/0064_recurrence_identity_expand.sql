-- Recurrences — expansion of the occurrence identity model.
--
-- Run AFTER 0063_household_categories.sql.
--
-- Change: openspec/changes/fix-recurrence-backlog/
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THIS MIGRATION CHANGES NO BEHAVIOUR.
--
-- It is the "expand" half of an expand/activate pair (design.md, decision 17).
-- It adds columns and tables, backfills them and installs a compatibility
-- trigger — but leaves the `recurrence_instances_one_pending_per_rule` index in
-- place, so the app still sees exactly one pending occurrence per rule, just
-- like today.
--
-- The backlog is enabled in <next free>_recurrence_backlog_activate.sql, AFTER
-- deploying web and native with the new model. The order matters: dropping the
-- index before that deploy would leave the database piling up backlog while the
-- app still shows a single occurrence — invisible, and worse than the current
-- bug.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- What it adds, and why each piece:
--
--   due_date            The occurrence identity. Today `scheduled_date` doubles
--                       as identity and as the movement date, and confirming
--                       OVERWRITES it with the date the user picks
--                       (mutations.ts), so the occurrence loses its original
--                       due date. With a backlog that also makes it
--                       unidentifiable.
--
--   resolution_kind     How it was resolved: `created` (the recurrence created
--   linked_conversion   the movement) or `linked` (the user linked one of their
--                       own). Undo does different things in each case: delete
--                       vs keep. `linked_conversion` records whether linking
--                       converted a personal movement into a shared one, so
--                       that conversion can be reverted.
--
--   reconstruct_from    How far back the generator may reconstruct.
--                       Conservative policy (decision 21): do NOT reconstruct
--                       anything earlier than the last known point, because
--                       there is no history of schedule edits or pauses and
--                       assuming one fabricates backlog that may never have
--                       existed.
--
--   schedule_versions   The schedule over time. A frequency change applies from
--                       a date onwards and does not reinterpret the past;
--                       without this, the generator would read the old calendar
--                       as gaps.
--
--   pauses              The pause intervals. A due date falling during a pause
--                       does not exist and is not recovered on resume; without
--                       the persisted interval, the paused period also reads as
--                       gaps.
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor,
-- then regenerate types. The whole migration runs in one transaction.

begin;

-- The reference "today". A bare `current_date` is FORBIDDEN: Supabase runs in
-- UTC and the app closes the day on Argentine time.
create temporary table _migration_today on commit drop as
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · due_date — the occurrence identity
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The starting point is `scheduled_date`, but it is NOT equally trustworthy
-- across statuses, and saying "it derives from the schedule" would be false:
--
--   pending   EXACT. Nothing overwrote it: the generator wrote it and nobody
--             else.
--   skipped   EXACT. `skipRecurrenceInstance` only touches `status` and
--             `resolved_at` — the due date survives untouched.
--   confirmed SUSPECT. `confirmRecurrenceInstance` writes
--             `scheduled_date = payload.date ?? instance.scheduled_date`, so if
--             the user changed the date while confirming, what is stored today
--             is the PAYMENT DATE, not the due date.
--
-- For confirmed rows there is NO way to prove what the due date was. An earlier
-- version of this migration tried to infer it by checking whether the date
-- "lands on the schedule", and that reasoning is INVALID: landing on the
-- schedule is necessary, not sufficient. An instalment due on August 10th and
-- confirmed late, on September 10th, lands perfectly on a monthly-10th schedule
-- — and belongs to a different occurrence. The check can make some dates
-- suspect, never prove the rest are exact. And if the frequency was ever
-- edited, comparing against the CURRENT schedule does not even say which
-- calendar was in force when the instance was created.
--
-- And an uncertain date CANNOT OCCUPY AN IDENTITY. An earlier version of this
-- migration stored the doubtful date anyway, flagged as approximate, and that
-- reproduces #96 by another route:
--
--   1. The August due date was 10/08.
--   2. It was confirmed late, on 10/09; the old code left scheduled_date=10/09.
--   3. The migration copied that into due_date=10/09 (flagged, but present).
--   4. The real cursor was still at 10/08.
--   5. The generator tries to create the TRUE 10/09 due date…
--   6. …and the unique index rejects it: the doubtful row already holds that
--      identity.
--
--   ⇒ September disappears. Exactly the block this change removes.
--
-- Policy: what is unknown is declared unknown, not approximated.
--
--   pending / skipped         due_date EXACT.
--   confirmed pre-migration   due_date NULL + due_date_is_unknown = true.
--                             `scheduled_date` keeps the only legacy datum
--                             available, without pretending it is a due date.
--   confirmed post-migration  exact by construction: from the deploy onwards
--                             `due_date` is no longer overwritten.
--
-- The identity index applies only where `due_date IS NOT NULL`, and the
-- generator dedupes only against exact due dates. If some day the user fixes
-- the history by hand, `due_date` gets filled in and the row stops being
-- unknown.

alter table public.recurrence_instances
  add column due_date             DATE,
  add column due_date_is_unknown  BOOLEAN NOT NULL DEFAULT false;

update public.recurrence_instances
   set due_date            = case when status = 'confirmed' then null else scheduled_date end,
       due_date_is_unknown = (status = 'confirmed');

-- Unknown and absent are the same thing, and they cannot diverge.
alter table public.recurrence_instances
  add constraint chk_recurrence_instances_due_date_unknown check (
    (due_date is null) = due_date_is_unknown
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Collision policy: abort with a report, never guess
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Only among EXACT due dates: historical confirmed rows have `due_date NULL`
-- and compete for no identity. A doubtful confirmed row that "matched" an exact
-- due date is no reason to abort — they may well be two different occurrences,
-- and that was exactly the trap in the earlier version.
--
-- What CAN happen is that two pending/skipped rows of the same rule share a
-- `scheduled_date`. Deciding which one belongs to which due date is a
-- case-by-case call and no automatic rule gets it right; a misassigned
-- `due_date` is a movement attributed to the wrong month, and it surfaces
-- months later. Aborting is cheap.

do $$
declare
  collision record;
  report    text := '';
  total     int  := 0;
begin
  for collision in
    select recurrence_id, due_date, count(*) as n,
           string_agg(id::text || ' (' || status || ')', ', ' order by created_at) as instances
      from public.recurrence_instances
     where due_date is not null
     group by recurrence_id, due_date
    having count(*) > 1
  loop
    total := total + 1;
    report := report || format(
      E'\n  rule %s · due date %s · %s instances: %s',
      collision.recurrence_id, collision.due_date, collision.n, collision.instances
    );
  end loop;

  if total > 0 then
    raise exception E'due_date backfill aborted: % due date(s) with more than one instance.%\n\nResolve by hand which instance belongs to each due date, then run again.',
      total, report;
  end if;
end $$;

-- `due_date` is NOT NOT NULL: historical confirmed rows hold null on purpose.
-- The index is PARTIAL for the same reason — an unknown identity cannot reserve
-- the slot of a known one.
create unique index recurrence_instances_one_per_rule_due_date
  on public.recurrence_instances (recurrence_id, due_date)
  where due_date is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · How the occurrence was resolved
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `skipped` carries `resolution_kind = NULL`: skipping resolves without a
-- movement, so there is nothing to undo and no way to undo it.
--
-- The constraints go IN THIS MIGRATION, after the step 7 trigger. An earlier
-- version deferred them to the activation out of fear that an old client would
-- violate them while confirming — but the trigger fills `resolution_kind` in
-- before the constraint is evaluated (BEFORE trigger → CHECK), so the
-- incompatibility does not exist. Deferring them would only leave the database
-- unprotected for the whole transition.

alter table public.recurrence_instances
  add column resolution_kind   TEXT    NULL,
  add column linked_conversion BOOLEAN NOT NULL DEFAULT false;

-- Until today the only way to resolve with a movement was by creating it.
update public.recurrence_instances
   set resolution_kind = 'created'
 where status = 'confirmed';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · reconstruct_from — the reconstruction floor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The generator never materializes before GREATEST(reconstruct_from, horizon).
--
--   active  `last_generated_date` is, by definition, "covered up to here".
--           Reconstructing earlier would re-propose occurrences the rule
--           already considers resolved.
--   paused  the migration date. We do not know since when they have been
--           paused, and any earlier date would surface the paused periods as
--           backlog on resume — which decision 16 forbids.
--
-- The contract, and it is worth being exact because an earlier version of this
-- comment stated it backwards: `reconstruct_from` is the LAST KNOWN POINT, and
-- the occurrences AFTER it, within the horizon, ARE reconstructed — minus any
-- instances that already exist.
--
-- That IS the #96 fix, and it has to be. In the ticket's case the cursor was
-- stuck in June with an unresolved pending occurrence that never advanced it;
-- reconstructing from there, June already exists and is deduped, but July,
-- August and September show up. If this did not reconstruct backwards, the bug
-- would still be alive.
--
-- What is NOT reconstructed is anything before the cursor: the rule already
-- considers that covered. And for paused rules nothing before the migration is
-- reconstructed, because we do not know since when they have been paused.

alter table public.recurrences
  add column reconstruct_from DATE;

-- `start_date - 1` when there is no cursor, and NOT `start_date`: the contract
-- generates occurrences STRICTLY AFTER `reconstruct_from`, and the current
-- engine puts the first occurrence ON `start_date` when there is no cursor
-- (`decideRecurrenceInstance`, packages/money-logic/src/recurrences.ts). With a
-- plain `start_date`, a directly created rule that has never materialized would
-- lose its first occurrence.
update public.recurrences r
   set reconstruct_from = case
         when r.status = 'paused'               then (select d from _migration_today)
         when r.last_generated_date is not null then r.last_generated_date
         else r.start_date - 1
       end;

alter table public.recurrences
  alter column reconstruct_from set not null,
  -- A placeholder, never a stored value: the BEFORE INSERT trigger below
  -- overwrites it on every insert. It exists so the column is not NOT NULL
  -- WITHOUT a default, which would make `supabase gen types` mark
  -- `reconstruct_from` as REQUIRED on Insert and force every client to send a
  -- value the database owns — including old clients that know nothing about it.
  --
  -- `infinity` and not `-infinity` on purpose: if the trigger were ever dropped,
  -- this value FAILS CLOSED. The generator never materializes before
  -- `reconstruct_from`, so `infinity` produces nothing, while `-infinity` would
  -- rebuild a rule's entire history as backlog.
  alter column reconstruct_from set default 'infinity'::date;

-- Without this the expansion BREAKS recurrence creation: a DEFAULT cannot
-- reference another column of the same row, and neither the current code nor the
-- installed clients write this column. The expansion has to preserve behaviour,
-- so the value is derived with the SAME criterion as the backfill above.
--
-- On INSERT it is computed UNCONDITIONALLY, not only when the incoming value is
-- null: the database is the sole owner of this column, exactly as it is of the
-- schedule history, and a client value — the placeholder default included —
-- must never survive.
--
-- On UPDATE it is FROZEN, and that half is not optional. `recurrences` has had a
-- "users update own recurrences" policy since 0011, and the generated types
-- expose every column of the table in `Update`, so an INSERT-only trigger would
-- leave `reconstruct_from` writable by any authenticated client. That is not a
-- cosmetic hole: this column is the floor of what the generator reconstructs, so
-- moving it BACKWARDS fabricates months of backlog out of nothing, and moving it
-- FORWARDS hides occurrences the user is actually owed. Neither is visible in
-- the UI, and neither is something the app ever needs to do.
--
-- The guard is not an RLS policy because RLS grants or denies the whole row: the
-- user legitimately updates amount, description, frequency and status on the
-- same UPDATE. Only this column has to stay put, and a column-level rule lives
-- in a trigger.
--
-- A later migration that DOES need to move the floor — the activation, say —
-- can `alter table public.recurrences disable trigger
-- trg_recurrence_reconstruct_from_guard;` around the write. That is deliberate
-- and auditable in the migration; a client UPDATE is neither.
create or replace function public.recurrence_reconstruct_from_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.reconstruct_from is distinct from OLD.reconstruct_from then
      raise exception
        'reconstruct_from is immutable: rule % has floor %, and the write tried to move it to %.',
        OLD.id, OLD.reconstruct_from, NEW.reconstruct_from
        using errcode = '23514';
    end if;
    return NEW;
  end if;

  NEW.reconstruct_from := case
    when NEW.status = 'paused'               then (now() at time zone 'America/Argentina/Buenos_Aires')::date
    when NEW.last_generated_date is not null then NEW.last_generated_date
    -- With no cursor the first occurrence lands ON start_date, and the
    -- contract generates strictly after the floor.
    else NEW.start_date - 1
  end;
  return NEW;
end $$;

-- The name says `guard`, not `default`: it derives the value on INSERT AND keeps
-- it immutable on UPDATE. The coda of this migration warns about exactly this
-- mistake in `trg_recurrence_instance_compat`, whose name hides a permanent
-- business rule behind a temporary-sounding label. Not repeating it here.
create trigger trg_recurrence_reconstruct_from_guard
  before insert or update on public.recurrences
  for each row
  execute function public.recurrence_reconstruct_from_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4b · The premise the assumed schedule versions rest on, verified HERE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Section 5 writes, for every existing rule, ONE assumed schedule version whose
-- `anchor_date` is `start_date`. That is only faithful while the rule's cursor
-- sits on its own schedule: today's generator resumes the cadence FROM the
-- cursor (`addInterval(cursor, …)`), and if the cursor drifted off the calendar
-- — an edit moved `start_date`, or the frequency changed after the cursor was
-- written — then the calendar and the cursor disagree, and an assumed version
-- that says nothing about the drift would quietly hand the rule a different next
-- occurrence than the one the user is seeing today.
--
-- `docs/qa/auditoria-fase-cursor.sql` answers this question against production,
-- but its answer is a SNAPSHOT: between running it and applying this migration
-- the user keeps using the app, and one edit is enough to create a drifted rule.
-- A read taken days earlier cannot be a guarantee about the moment of the write.
-- So the invariant is re-checked HERE, inside the same transaction as the
-- backfill: whatever the audit said, this is the state that actually gets
-- migrated.
--
-- Aborting is the right outcome, and it is cheap — nothing has been committed.
-- If this fires, the audit's answer changed and the decision it fed (task 1.10b:
-- anchor the walker on the calendar) no longer holds unchanged: those rules need
-- their PHASE persisted, or an explicit documented compatibility, before the
-- assumed version can be written for them. Silently anchoring them on
-- `start_date` would move a due date the user is already looking at.

do $$
declare
  drifted record;
  report  text := '';
  total   int  := 0;
begin
  for drifted in
    with cursored as (
      -- The next date TODAY's generator would produce: addInterval(cursor, …),
      -- with month/year clamping anchored on start_date.
      select r.id, r.start_date, r.interval_count, r.interval_unit,
             r.last_generated_date as cursor,
             case r.interval_unit
               when 'day'  then r.last_generated_date + r.interval_count
               when 'week' then r.last_generated_date + (r.interval_count * 7)
               else (
                 date_trunc('month',
                   r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                                            || ' month')::interval)
                 + (least(
                      extract(day from r.start_date),
                      extract(day from date_trunc('month',
                        r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                                                 || ' month')::interval) + interval '1 month - 1 day')
                    ) - 1) * interval '1 day'
               )::date
             end as next_date
        from public.recurrences r
       where r.status <> 'deleted'
         and r.last_generated_date is not null
    ),
    -- How many intervals from start_date to that date. Integer estimate; the
    -- candidates below correct it, because end-of-month clamping can shift an
    -- occurrence by one step.
    estimated as (
      select c.*,
             case c.interval_unit
               when 'day'   then floor((c.next_date - c.start_date)::numeric / c.interval_count)
               when 'week'  then floor((c.next_date - c.start_date)::numeric / (c.interval_count * 7))
               when 'month' then floor((((extract(year from c.next_date) - extract(year from c.start_date)) * 12
                                       + (extract(month from c.next_date) - extract(month from c.start_date))))::numeric
                                       / c.interval_count)
               when 'year'  then floor((extract(year from c.next_date) - extract(year from c.start_date))::numeric
                                       / c.interval_count)
             end::int as n0
        from cursored c
    ),
    candidates as (
      select e.*, n,
             case e.interval_unit
               when 'day'  then e.start_date + (n * e.interval_count)
               when 'week' then e.start_date + (n * e.interval_count * 7)
               else (
                 date_trunc('month',
                   e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                                   || ' month')::interval)
                 + (least(
                      extract(day from e.start_date),
                      extract(day from date_trunc('month',
                        e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                                        || ' month')::interval) + interval '1 month - 1 day')
                    ) - 1) * interval '1 day'
               )::date
             end as occurrence
        from estimated e
        -- Around GREATEST(n0, 0): `updateRecurrence` allows moving `start_date`
        -- without adjusting the cursor, so the cursor — and this next date — can
        -- land BEFORE the rule's own start.
        cross join lateral (values (greatest(e.n0, 0) - 1), (greatest(e.n0, 0)),
                                   (greatest(e.n0, 0) + 1), (greatest(e.n0, 0) + 2),
                                   (greatest(e.n0, 0) + 3)) as v(n)
       where n >= 0
    )
    select id, start_date, interval_count, interval_unit, cursor, next_date
      from candidates
     group by id, start_date, interval_count, interval_unit, cursor, next_date
    -- No candidate equals it ⇒ the date is not on the rule's schedule.
    having not bool_or(occurrence = next_date)
  loop
    total := total + 1;
    report := report || format(
      E'\n  rule %s · every %s %s from %s · cursor %s · next %s (off schedule)',
      drifted.id, drifted.interval_count, drifted.interval_unit,
      drifted.start_date, drifted.cursor, drifted.next_date
    );
  end loop;

  if total > 0 then
    raise exception E'Assumed schedule versions aborted: % rule(s) whose next occurrence is not on their own schedule.%\n\nThe cursor-phase audit (docs/qa/auditoria-fase-cursor.sql) answered this question BEFORE the deploy, and the answer changed since. Persist the phase of these rules, or write down an explicit compatibility for them, before migrating: anchoring them on start_date would move a due date the user is already looking at.',
      total, report;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · recurrence_schedule_versions — the schedule over time
-- ═══════════════════════════════════════════════════════════════════════════

-- The composite FK below needs this candidate key. `id` is already the PK; this
-- only declares that (id, user_id) identifies a row too, so child tables can
-- require the rule and the owner to match.
alter table public.recurrences
  add constraint recurrences_id_user_unique UNIQUE (id, user_id);

create table public.recurrence_schedule_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id  UUID        NOT NULL,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Since when THIS version applies. For the one the migration creates it is
  -- `reconstruct_from`, NOT `start_date`: we do not know which schedule ran
  -- before the last known point, and claiming the current one applied from the
  -- start would make the walker produce dates the rule never produced.
  effective_from DATE        NOT NULL,
  interval_count INT         NOT NULL,
  interval_unit  TEXT        NOT NULL,
  -- Anchor for end-of-month CLAMPING, not a claim about when the schedule
  -- started: it is what makes a rule on the 31st go back to the 31st after
  -- February. It is kept as `start_date` because that is exactly what the
  -- generator does today
  -- (`addInterval(cursor, unit, count, { anchorDate: start_date })`), so the
  -- assumed version reproduces current behaviour without inventing anything.
  anchor_date    DATE        NOT NULL,
  -- true ⇒ created by this migration. It means: we do not know which schedule
  -- applied before `effective_from`. Versions the user creates by editing do
  -- not carry the flag.
  is_assumed     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_schedule_versions_interval_unit
    CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  CONSTRAINT chk_schedule_versions_interval_count_positive
    CHECK (interval_count > 0),

  -- With two independent FKs (rule on one side, user on the other) and an RLS
  -- policy that only looks at `user_id = auth.uid()`, the database would accept
  -- a row holding MY user and SOMEBODY ELSE'S recurrence. The composite FK makes
  -- that impossible, and it does not depend on the RLS policy remembering to
  -- check it.
  CONSTRAINT recurrence_schedule_versions_recurrence_fk
    FOREIGN KEY (recurrence_id, user_id)
    REFERENCES public.recurrences(id, user_id) ON DELETE CASCADE
);

create unique index recurrence_schedule_versions_one_per_date
  on public.recurrence_schedule_versions (recurrence_id, effective_from);

create index idx_recurrence_schedule_versions_lookup
  on public.recurrence_schedule_versions (recurrence_id, effective_from desc);

-- `effective_from = reconstruct_from` (the last known point), not `start_date`.
-- If the rule was ever edited — and there is no edit history to tell — this
-- version makes NO claim about anything earlier. The walker never looks before
-- this date.
-- `effective_from` is `reconstruct_from`, except for a rule with no cursor,
-- where it is `start_date`: there `reconstruct_from` holds `start_date - 1`,
-- which is a generation floor and not a date on which the schedule ever applied.
insert into public.recurrence_schedule_versions
  (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
select r.id, r.user_id,
       case when r.status <> 'paused' and r.last_generated_date is null
            then r.start_date else r.reconstruct_from end,
       r.interval_count, r.interval_unit, r.start_date, true
  from public.recurrences r
on conflict (recurrence_id, effective_from) do nothing;

alter table public.recurrence_schedule_versions enable row level security;

create policy "users select own recurrence_schedule_versions"
  on public.recurrence_schedule_versions for SELECT
  using (user_id = auth.uid());

-- NO INSERT / UPDATE / DELETE policies, on purpose: the schedule history is
-- maintained by the database (see the trigger in section 6b). With write
-- policies, "the database is the sole owner" would be a mere convention any
-- client could sidestep, duplicating or altering the history.

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · recurrence_pauses — the pause intervals
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `recurrences.status = 'paused'` says "it is paused right now"; the interval
-- says "it was paused from here to here", which is what the generator needs in
-- order not to read that period as gaps on resume.

create table public.recurrence_pauses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id UUID        NOT NULL,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paused_from   DATE        NOT NULL,
  resumed_at    DATE        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_recurrence_pauses_order
    CHECK (resumed_at IS NULL OR resumed_at >= paused_from),

  -- Same reason as in schedule_versions: the rule and the owner have to be the
  -- same person, enforced by the database and not by the RLS policy.
  CONSTRAINT recurrence_pauses_recurrence_fk
    FOREIGN KEY (recurrence_id, user_id)
    REFERENCES public.recurrences(id, user_id) ON DELETE CASCADE
);

-- At most one open pause per rule: you cannot pause something already paused.
create unique index recurrence_pauses_one_open_per_rule
  on public.recurrence_pauses (recurrence_id)
  where resumed_at IS NULL;

create index idx_recurrence_pauses_lookup
  on public.recurrence_pauses (recurrence_id, paused_from);

-- Rules that are paused today open their interval on the migration date,
-- consistent with their `reconstruct_from` from step 4.
insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
select r.id, r.user_id, (select d from _migration_today)
  from public.recurrences r
 where r.status = 'paused';

alter table public.recurrence_pauses enable row level security;

create policy "users select own recurrence_pauses"
  on public.recurrence_pauses for SELECT
  using (user_id = auth.uid());

-- No write policies, same reason as in `recurrence_schedule_versions`: pause
-- intervals are opened and closed by the trigger, not by the client.

-- ═══════════════════════════════════════════════════════════════════════════
-- 6b · Dual-write: the DATABASE maintains the new history during the transition
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The step 5 and 6 backfills cover ONLY the rows that existed when this
-- migration was applied. Between the expansion and the activation the app keeps
-- writing with the old model, so without this:
--
--   · a recurrence created from any client ends up WITHOUT a version;
--   · editing the frequency or `start_date` leaves the existing version STALE;
--   · pausing or resuming opens and closes no interval.
--
-- By the time the new generator arrives, those rules would have missing or
-- stale information — and they are precisely the most recent ones.
--
-- SOLE OWNER OF THESE WRITES: the database. App code must NOT insert into
-- `recurrence_schedule_versions` or `recurrence_pauses`; doing so would
-- duplicate what these triggers do. Keeping it here also makes it atomic with
-- the rule write, without depending on every client remembering.

-- SECURITY DEFINER with a locked `search_path`: the tables are READ-ONLY for
-- `authenticated` (see below), so the trigger needs to write above RLS. That is
-- what turns "the database is the owner" from a convention into a guarantee:
-- the app cannot duplicate or alter the history even if it wanted to.
create or replace function public.recurrence_sync_schedule_and_pauses()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if TG_OP = 'INSERT' then
    -- Initial version. `is_assumed = false`: for a rule created right now we DO
    -- know its schedule from the start, unlike the ones the migration had to
    -- assume.
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

  -- A schedule change ⇒ a new version. It does not reinterpret the past:
  -- earlier occurrences keep being read with the previous version.
  if NEW.interval_count is distinct from OLD.interval_count
     or NEW.interval_unit is distinct from OLD.interval_unit
     or NEW.start_date    is distinct from OLD.start_date then

    -- Versions that HAVE NOT COME INTO EFFECT YET are replaced, not kept.
    -- Without this, a rule starting in the future and edited before it begins
    -- resurrects its old schedule on the start day:
    --
    --   8/9  created with start 1/10  ⇒ version with effective_from = 1/10
    --   8/9  the frequency is edited  ⇒ version with effective_from = 8/9
    --   1/10 arrives                  ⇒ the 1/10 one becomes the most recent
    --                                    again and restores the old schedule.
    delete from public.recurrence_schedule_versions
     where recurrence_id = NEW.id and effective_from > today;

    -- Effective from today, or from the start if the rule has not begun yet. A
    -- version cannot apply before the rule exists.
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
    values
      (NEW.id, NEW.user_id, greatest(today, NEW.start_date),
       NEW.interval_count, NEW.interval_unit, NEW.start_date, false)
    on conflict (recurrence_id, effective_from) do update
      set interval_count = excluded.interval_count,
          interval_unit  = excluded.interval_unit,
          anchor_date    = excluded.anchor_date,
          is_assumed     = false;
  end if;

  -- Pausing opens the interval; resuming closes it. Without this the paused
  -- period would read as gaps on resume (decision 16).
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

create trigger trg_recurrence_sync_schedule_and_pauses
  after insert or update on public.recurrences
  for each row
  execute function public.recurrence_sync_schedule_and_pauses();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Compatibility trigger for old native clients
-- ═══════════════════════════════════════════════════════════════════════════
--
-- An installed app does NOT update because we applied a migration. Old clients
-- write `scheduled_date` and know nothing about `due_date` or
-- `resolution_kind`, so their writes would produce invalid rows in the new
-- model. The trigger fills them in without the client knowing anything.
--
-- It is retired in migration C, together with `scheduled_date`.

create or replace function public.recurrence_instance_compat()
returns trigger
language plpgsql
as $$
begin
  -- An old client inserting a new occurrence: it wrote `scheduled_date` and not
  -- `due_date`. There the datum IS exact (the generator produced it), so it is
  -- derived. Only on INSERT: on an UPDATE the row already has its `due_date`,
  -- and an old confirmation overwrites `scheduled_date` with the payment date —
  -- deriving it there would fabricate the wrong identity.
  --
  -- That is why `scheduled_date` is NOT an alias of `due_date`: it is mirrored
  -- once on insert, and from that moment an old client can make them diverge.
  -- It is a legacy compatibility column, and new code must not read it either
  -- as a due date or as a payment date.
  if TG_OP = 'INSERT' and NEW.due_date is null then
    NEW.due_date := NEW.scheduled_date;
    NEW.due_date_is_unknown := false;
  end if;

  -- An old client confirming: until migration C, confirming always created the
  -- movement. Linking does not exist in those versions.
  if NEW.status = 'confirmed' and NEW.resolution_kind is null then
    NEW.resolution_kind := 'created';
  end if;

  -- ── Identity immutability ────────────────────────────────────────────────
  --
  -- The coherence CHECK validates the row's FINAL STATE, not the TRANSITION, so
  -- on its own it lets through two writes that break the contract:
  --
  --   update … set due_date = '2026-09-11' where due_date = '2026-09-10';
  --   update … set due_date = null, due_date_is_unknown = true;
  --
  -- The first moves an already established identity; the second erases it, and
  -- with it the protection of the partial index — the same occurrence could
  -- materialize again. The only allowed transitions are these:
  --
  --   exact    → the same, unchanged.
  --   unknown  → still unknown.
  --   unknown  → exact, once (the user fixes the history).
  --   exact    → another date, or unknown  ⇒  REJECTED.
  if TG_OP = 'UPDATE' and OLD.due_date is not null
     and (NEW.due_date is distinct from OLD.due_date) then
    raise exception
      'due_date is immutable: occurrence % already holds identity %, and the write tried to %.',
      OLD.id, OLD.due_date,
      case when NEW.due_date is null then 'clear it'
           else 'move it to ' || NEW.due_date end
      using errcode = '23514';
  end if;

  -- The flag is derived, never declared: that way a history fix filling in
  -- `due_date` does not fail for forgetting to lower the flag.
  NEW.due_date_is_unknown := (NEW.due_date is null);

  return NEW;
end $$;

create trigger trg_recurrence_instance_compat
  before insert or update on public.recurrence_instances
  for each row
  execute function public.recurrence_instance_compat();

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · Resolution constraints
-- ═══════════════════════════════════════════════════════════════════════════
--
-- They go AFTER the trigger on purpose. An old client confirming does not write
-- `resolution_kind`, but the trigger fills it in before the constraint is
-- evaluated (BEFORE trigger → CHECK), so there is no incompatibility that would
-- justify deferring them to the activation: doing so would only leave the
-- database unprotected for the whole transition.

alter table public.recurrence_instances
  add constraint chk_recurrence_instances_resolution_kind check (
    (status = 'confirmed' and resolution_kind in ('created', 'linked'))
    or (status in ('pending', 'skipped') and resolution_kind is null)
  ),
  add constraint chk_recurrence_instances_linked_conversion check (
    linked_conversion = false or resolution_kind = 'linked'
  );

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- What this migration deliberately does NOT do
-- ═══════════════════════════════════════════════════════════════════════════
--
--   · It does NOT drop `recurrence_instances_one_pending_per_rule` → activation
--
-- The activation number is NOT reserved here: it is picked against `main` when
-- that migration is written, after the deploy. This very migration was born as
-- 0061 and ended up as 0064 for that reason.
--   · It does NOT touch `scheduled_date` or `last_generated_date` → migration C
--
-- ⚠️  NOTICE FOR MIGRATION C
--
-- The `trg_recurrence_instance_compat` trigger CANNOT be dropped wholesale when
-- `scheduled_date` is retired. Its name is misleading: besides the temporary
-- compatibility with old clients, it holds a PERMANENT business rule — the
-- immutability of `due_date`. Dropping it whole would reopen the hole of being
-- able to move or erase an exact identity via UPDATE, which is precisely the
-- block this change removes.
--
-- When retiring `scheduled_date`, do ONE of these two:
--   a) remove only the compatibility branches (the `due_date` derivation on
--      INSERT and the `resolution_kind` fill-in), keeping the guard; or
--   b) replace it with a permanent guard trigger, named after what it does.
--
-- The `resolution_kind` constraints DO belong here (step 8): the compatibility
-- trigger satisfies them for old clients.
--
-- After applying: regenerate the Supabase types.
