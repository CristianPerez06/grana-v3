-- ═══════════════════════════════════════════════════════════════════════════
-- 0067 · card_period_pending: close it to anon
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Restores an invariant 0055 already established and 0061 reopened without
-- noticing: THE ANONYMOUS ROLE EXECUTES NOTHING IN `public`.
--
-- 0055 closed the boundary with a blanket `revoke execute on all functions in
-- schema public from anon`. A blanket revoke only covers what exists when it
-- runs: Postgres grants EXECUTE to PUBLIC on every NEW function, and Supabase
-- grants it to `anon` as well, so anything created afterwards reopens the door
-- by itself. Every function 0061 added carries its own revoke — except this
-- one, and it was found by `validate_schema.sql` (COBERTURA RLS 4), which is
-- exactly the check that exists because the blanket cannot reach forward.
--
-- WHAT WAS EXPOSED, honestly: little. `card_period_pending` is `security
-- invoker` and reads `transactions` and `period_payments` under RLS, so a call
-- with no session returns zero rows. That is the point of the invariant: it
-- makes RLS stop being a single point of failure. A function reachable without
-- a session is one policy mistake away from being a leak, and the boundary is
-- what keeps that mistake from mattering.
--
-- BOTH REVOKES ARE NEEDED. 0055 documents why: `revoke ... from public` does
-- not remove the privilege Supabase granted to `anon` DIRECTLY. Revoking only
-- PUBLIC leaves the door open and looks like it closed it.
--
-- `authenticated` keeps it, like every other RPC in 0061. Measured, not assumed:
-- the card payment flow survives WITHOUT this grant, because the callers that
-- matter (`pay_card_period_legs`, `confirm_running_cycle`,
-- `revert_card_period_payment`) are SECURITY DEFINER, so the trigger chain — and
-- this function inside it — runs as the definer and never as the caller. The
-- grant is about the API surface, not about the flow: PostgREST publishes the
-- function, the generated types carry it, and its three siblings in 0061 are
-- granted exactly this way. Dropping it here would be an inconsistency to
-- rediscover later, not a saving.
--
-- Safe to re-run: revoke and grant are idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

revoke execute on function public.card_period_pending(uuid) from public;
revoke execute on function public.card_period_pending(uuid) from anon;
grant  execute on function public.card_period_pending(uuid) to authenticated;

-- ── Self-check ─────────────────────────────────────────────────────────────
-- Both directions. Asserting only the revoke would pass on a database where the
-- function is unreachable for everyone, which breaks card payments instead of
-- securing them.
DO $check$
begin
  if has_function_privilege('anon', 'public.card_period_pending(uuid)', 'EXECUTE') then
    raise exception '0067 failed: anon still executes card_period_pending';
  end if;

  if not has_function_privilege('authenticated', 'public.card_period_pending(uuid)', 'EXECUTE') then
    raise exception '0067 failed: authenticated lost EXECUTE on card_period_pending — the function is part of the exposed API surface and its three siblings in 0061 are granted the same way';
  end if;

  raise notice '✓ 0067 — card_period_pending: closed to anon, kept for authenticated';
end $check$;

commit;
