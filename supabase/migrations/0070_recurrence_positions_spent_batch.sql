-- 0070 — Asking for the spent positions of MANY rules in one round trip.
--
-- WHY
--
-- `recurrence_positions_spent(p_id, p_today)` (0068) answers for ONE rule, and
-- that is all the detail screen ever needed. The recurrences hub is about to
-- need the same number for every rule it lists, because a rule's shown state —
-- active, paused, finalizada — is derived from its calendar and its progress,
-- not from `recurrences.status`. Asking one rule at a time would cost one round
-- trip per row: 64 on the real database, growing with use.
--
-- WHAT THIS IS NOT
--
-- It is NOT a second implementation of the count. The body calls
-- `recurrence_positions_spent` once per row and returns what it says. There is
-- one definition of what `max_occurrences` counts, and this is a second way to
-- ASK for it — not a second way to compute it. A copy of the walk here would be
-- a copy that drifts, and the number it produces is what decides whether a rule
-- goes on reminding the user about money.
--
-- THE FRONTIER, DECLARED
--
--   · `security invoker`, NOT definer. This function receives a LIST OF IDS from
--     the caller. A definer would run as the owner, RLS would not apply, and
--     anyone who could guess a uuid would be handed the progress of somebody
--     else's rule. As invoker, the `select` below sees only what the caller's
--     RLS policy on `public.recurrences` lets it see, so ids belonging to
--     another user simply do not come back — and `recurrence_positions_spent`,
--     itself invoker, reads the same way.
--   · Explicit `revoke`/`grant`. Postgres grants EXECUTE to PUBLIC by default
--     and Supabase additionally exposes `anon`; a function whose privileges are
--     left unsaid is open, and nothing in the file says so. That is what
--     migration 0067 existed to repair. Not repeating it.
--   · `set search_path = public, pg_temp`, so a caller cannot shadow the tables
--     this reads by putting a schema in front of them.
--
-- `validate_schema.sql` pins the signature, the body and these three privileges,
-- with the same section that already pins `recurrence_positions_spent`: a
-- function that can be replaced without anyone noticing is not a frontier.
--
-- ONE TRANSACTION, AND IT CHECKS ITSELF BEFORE COMMITTING.
--
-- `create or replace` and the three privilege statements are four statements. Run
-- loose, a failure on the third leaves the function CREATED and its privileges
-- half applied — and the half that Postgres applies by default is EXECUTE to
-- PUBLIC, so the failure mode is a function open to everyone that nobody was
-- told about. Wrapped, either all four land or none does.
--
-- The verification block at the end asserts, inside the same transaction, every
-- part of the contract this file claims: the function exists with this argument
-- list, it returns these two columns in this order, it is STABLE, it is
-- SECURITY INVOKER, its `search_path` is pinned, and the three grants are what
-- they should be. A migration that says what it guarantees and does not check it
-- is a comment, not a guarantee.
--
-- SAFE TO RE-RUN. Creates one function; touches no data and no existing object.

begin;

create or replace function public.recurrence_positions_spent_batch(
  p_ids   uuid[],
  p_today date
)
returns table (
  recurrence_id   uuid,
  positions_spent int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- The join against `recurrences` is what applies RLS: an id the caller cannot
  -- see produces no row, rather than producing a count. `p_today` travels
  -- unchanged — the AR financial date is the caller's to decide, never
  -- `current_date`, which on Supabase is UTC and moves the boundary by 3 hours.
  select r.id, public.recurrence_positions_spent(r.id, p_today)
    from public.recurrences r
   where r.id = any(p_ids)
$$;

revoke all on function public.recurrence_positions_spent_batch(uuid[], date) from public;
revoke all on function public.recurrence_positions_spent_batch(uuid[], date) from anon;
grant execute on function public.recurrence_positions_spent_batch(uuid[], date) to authenticated;


-- ── Self-check, inside the transaction ──────────────────────────────────────
do $verify$
declare
  v_oid  oid;
  v_proc pg_proc;
  v_cols text;
begin
  v_oid := to_regprocedure('public.recurrence_positions_spent_batch(uuid[], date)');
  if v_oid is null then
    raise exception '0070: the function was not created with the expected argument list';
  end if;

  select * into v_proc from pg_proc where oid = v_oid;

  -- THE RETURN SHAPE, columns and order. The readers destructure it by name, and
  -- a replacement that returns the same two columns the other way round type-checks
  -- everywhere and answers with each rule's progress attributed to another rule.
  select string_agg(format('%s %s', p.name, format_type(p.type_oid, null)), ', ' order by p.ord)
    into v_cols
    from unnest(v_proc.proargnames, v_proc.proallargtypes, v_proc.proargmodes)
         with ordinality as p(name, type_oid, mode, ord)
   where p.mode = 't';
  if v_cols is distinct from 'recurrence_id uuid, positions_spent integer' then
    raise exception '0070: the function returns %, not (recurrence_id uuid, positions_spent integer)', coalesce(v_cols, '<nothing>');
  end if;

  -- STABLE: the hub calls it once per read and Postgres may fold it. A VOLATILE
  -- replacement is not wrong in its answer, it is wrong in what the planner may
  -- do with it, and nothing on screen would say so.
  if v_proc.provolatile <> 's' then
    raise exception '0070: the function is not STABLE (provolatile = %)', v_proc.provolatile;
  end if;

  -- SECURITY INVOKER: it takes a LIST OF IDS, so RLS on the caller's side is the
  -- only thing between somebody and another user's rules.
  if v_proc.prosecdef then
    raise exception '0070: the function is SECURITY DEFINER; it takes a list of ids, so RLS must stay the authorization';
  end if;

  if v_proc.proconfig is null
     or not ('search_path=public, pg_temp' = any(v_proc.proconfig)) then
    raise exception '0070: search_path is not pinned to "public, pg_temp" (proconfig = %)', v_proc.proconfig;
  end if;

  -- The three privilege statements above, asserted rather than assumed.
  if has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception '0070: anon retains EXECUTE — the revoke did not take';
  end if;
  if has_function_privilege('public', v_oid, 'EXECUTE') then
    raise exception '0070: PUBLIC retains EXECUTE — Postgres grants it by default and the revoke did not take';
  end if;
  if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception '0070: authenticated cannot execute it — the grant did not take';
  end if;

  raise notice '0070 OK: recurrence_positions_spent_batch created, STABLE, SECURITY INVOKER, search_path pinned, privileges as declared';
end $verify$;

commit;
