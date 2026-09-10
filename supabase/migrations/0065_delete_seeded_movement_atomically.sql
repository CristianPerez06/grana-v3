-- ═══════════════════════════════════════════════════════════════════════════
-- 0065 · Deleting the movement that seeded a recurrence, atomically
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Deleting such a movement is TWO writes that must not come apart:
--
--   1. the rule is unlinked (`created_from_transaction_id` to null), because the
--      FK is ON DELETE RESTRICT since 0053 and the movement cannot go otherwise;
--   2. when the seed was dated in the FUTURE, the rule's reconstruction floor is
--      released one day, back to where it would have been with no seed at all.
--      Without that the generator never produces `start_date` — the period the
--      deleted movement was covering simply disappears.
--
-- …followed by the DELETE itself.
--
-- Done from the client these are three round trips with no transaction around
-- them, and every partial outcome is wrong in a way the user pays for:
--
--   · unlink + release succeed, DELETE fails ⇒ the movement still exists AND the
--     rule will materialize its occurrence when the date arrives. The same gasto
--     twice. Worse still, it cannot be retried into a correct state: the retry
--     finds no rule for that transaction, because the marker it looks it up by is
--     the very column step 1 cleared;
--   · unlink succeeds, release fails ⇒ the occurrence is lost, which is the
--     defect this repairs.
--
-- Rollback in the client cannot fix it either: 0064's guard only permits the
-- floor to move ONE WAY, so putting it back is not an option. One transaction is.
--
-- SECURITY INVOKER on purpose: this runs as the user, so RLS decides which rows
-- they may touch and this function adds no reach they did not already have. It
-- only makes writes they can already make happen together.

create or replace function public.delete_movement_unlinking_seed(
  p_transaction_id UUID
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule  public.recurrences;
  v_today DATE := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- No status filter, matching the client-side guard: RESTRICT blocks the DELETE
  -- for ANY rule still holding the link, a soft-deleted one included.
  select * into v_rule
    from public.recurrences
   where created_from_transaction_id = p_transaction_id
     and user_id = auth.uid();

  if found then
    update public.recurrences
       set created_from_transaction_id = null,
           -- The legacy cursor is nulled alongside, as the client did, only for
           -- the repair case. Nothing reads it; it goes with migration C.
           last_generated_date = case
             when v_rule.status <> 'deleted' and v_rule.start_date > v_today
               then null
             else v_rule.last_generated_date
           end,
           reconstruct_from = case
             when v_rule.status <> 'deleted' and v_rule.start_date > v_today
               then v_rule.start_date - 1
             else v_rule.reconstruct_from
           end
     where id = v_rule.id
       and user_id = auth.uid();
  end if;

  -- Same DELETE the client issued. Every guard on `transactions` — the temporal
  -- one that raises GRN01, the cascades, the FKs — fires here exactly as it did,
  -- and now inside the same transaction as the writes above.
  delete from public.transactions
   where id = p_transaction_id
     and user_id = auth.uid();
end $$;

revoke all on function public.delete_movement_unlinking_seed(UUID) from public;
grant execute on function public.delete_movement_unlinking_seed(UUID) to authenticated;
