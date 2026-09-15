-- 0071 — A pause looks FORWARD: the day it is opened still belongs to the calendar.
--
-- THE DEFECT
--
-- `recurrence_positions_spent` (0068) subtracts a pause as `[paused_from,
-- resumed_at)`, so the pause swallows its own opening day. A rule whose
-- occurrence falls TODAY produces it — the instance row exists, the money is
-- committed — and then the user pauses the rule the same day. That position
-- stopped counting.
--
-- Observed in QA on the real database, on a monthly rule anchored to today with
-- a limit of 3 and its first cuota already pending:
--
--   before pausing ........ 1 of 3
--   after pausing ......... 0 of 3   ← the pending cuota stopped counting
--   resumed the same day .. 1 of 3   (the interval collapses, so it hid itself)
--   resumed two days later  0 of 3   ← permanent
--
-- And this number is not only what the screens show: it is what cuts the
-- generation. At «0 de 3» with one cuota already pending, the rule goes on to
-- produce THREE MORE — four instalments in a plan of three.
--
-- THE RULE, STATED ONCE
--
-- A date carries no time of day, so the calendar cannot tell whether the pause
-- came before or after that day's occurrence. The product rule settles it in the
-- one direction that cannot destroy a commitment already made: PAUSING AFFECTS
-- THE DAYS AFTER IT. A rule paused on the day it falls due still owes that day.
--
-- `paused_from` keeps holding the real date the user pressed Pausar — what
-- changes is how the interval is READ. Storing `today + 1` instead would make
-- the stored history lie about when it happened, and would produce incoherent
-- dates on resuming.
--
-- The twin change lives in `subtractPauses` (`@grana/money-logic`), which is
-- what the generator walks; a parity regression pins the two against each other.
-- One character separates them — `>=` here against `>` — which is exactly why it
-- is pinned by `validate_schema.sql` rather than left to be re-read.
--
-- SCOPE
--
-- One function is replaced, and nothing else. No data is rewritten: pauses keep
-- their dates, instances keep theirs. What changes is the answer the function
-- gives from now on.
--
-- SAFE TO RE-RUN.

begin;

-- The body below is 0068's function COPIED VERBATIM, with one predicate changed:
-- `d > ps.paused_from` where it read `d >= ps.paused_from`. It was extracted from
-- the shipped file rather than retyped — a hand-written copy of a 230-line
-- function is a second implementation pretending to be the same one.
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
            -- ── THE ONE CHANGE 0071 MAKES ───────────────────────────────
            -- `>` and not `>=`: the day a pause was opened still belongs to the
            -- calendar. An occurrence that fell that day was produced BEFORE the
            -- user paused — the instance row proves it — and a pause must not
            -- take away a position the rule already spent.
            and d > ps.paused_from
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

revoke all on function public.recurrence_positions_spent(uuid, date) from public;
revoke all on function public.recurrence_positions_spent(uuid, date) from anon;
grant execute on function public.recurrence_positions_spent(uuid, date) to authenticated;


-- ── Self-check, inside the transaction ──────────────────────────────────────
do $verify$
declare
  v_oid  oid;
  v_proc pg_proc;
  v_body text;
begin
  v_oid := to_regprocedure('public.recurrence_positions_spent(uuid, date)');
  if v_oid is null then
    raise exception '0071: recurrence_positions_spent is missing after the replacement';
  end if;
  select * into v_proc from pg_proc where oid = v_oid;

  v_body := lower(regexp_replace(regexp_replace(v_proc.prosrc, '--[^\n]*', ' ', 'g'), '\s+', ' ', 'g'));

  -- THE ONE CHARACTER THIS MIGRATION EXISTS FOR. Asserted rather than assumed:
  -- the whole body is reproduced above, so a bad copy-paste would leave the old
  -- predicate in place and the function would look replaced.
  if v_body not like '%d > ps.paused_from%' then
    raise exception '0071: the pause predicate is not "d > ps.paused_from" — the day a pause opens would still be swallowed';
  end if;
  if v_body like '%d >= ps.paused_from%' then
    raise exception '0071: the old inclusive pause predicate is still there';
  end if;

  if v_proc.provolatile <> 's' then
    raise exception '0071: the function is not STABLE (provolatile = %)', v_proc.provolatile;
  end if;
  if v_proc.prosecdef then
    raise exception '0071: the function is SECURITY DEFINER; RLS must stay the authorization';
  end if;
  if v_proc.proconfig is null
     or not ('search_path=public, pg_temp' = any(v_proc.proconfig)) then
    raise exception '0071: search_path is not pinned (proconfig = %)', v_proc.proconfig;
  end if;

  if has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception '0071: anon retains EXECUTE';
  end if;
  if has_function_privilege('public', v_oid, 'EXECUTE') then
    raise exception '0071: PUBLIC retains EXECUTE';
  end if;
  if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception '0071: authenticated cannot execute it';
  end if;

  raise notice '0071 OK: a pause no longer swallows the day it was opened on';
end $verify$;

commit;
