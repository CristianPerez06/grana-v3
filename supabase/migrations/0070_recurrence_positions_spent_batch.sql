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
-- SAFE TO RE-RUN. Creates one function; touches no data and no existing object.

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
