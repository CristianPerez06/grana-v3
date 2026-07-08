-- Shared module (Compartido) — unshare integrity: no orphan splits, symmetric invariant.
--
-- Run AFTER 0043_shared_security_hardening.sql and 0047_shared_split_allow_zero.sql.
--
-- Fixes the latent data-corruption bug when UN-sharing an expense (toggle "Compartir"
-- → off on an already-shared expense). The old paths deleted all splits and then set
-- is_shared=false in SEPARATE PostgREST calls: deleting every split transiently zeroed
-- sum(amount_assigned), tripping the DEFERRED trg_splits_sum_total invariant, so the
-- DELETE (its own transaction) rolled back and its error went unchecked — leaving the
-- splits as ORPHANS while is_shared was already false. Debt derivation reads splits by
-- household_id without filtering is_shared, so the "unshared" expense kept feeding the
-- household debt silently.
--
-- This migration:
--   1  Makes trg_splits_sum_total a SYMMETRIC invariant keyed on is_shared:
--        is_shared=true carrying splits ⇒ sum(amount_assigned)=amount
--        is_shared=false                ⇒ no split may survive
--      (The installment PARENT is shared but carries no splits — they live on the
--       children — so this check is never invoked for it.)
--   2  Adds a BEFORE UPDATE guard blocking the is_shared true→false transition while a
--      settlement is live in the household (twin of 0043's BEFORE DELETE guard: both
--      would retroactively change a debt a settlement already accounted for).
--   3  Adds a DEFERRED AFTER UPDATE constraint trigger catching "flag flipped to false
--      but splits not deleted" (no split row changes, so #1 wouldn't fire).
--   4  Adds unshare_movement(p_root_id) — an ATOMIC (single-transaction) SECURITY
--      INVOKER RPC that flips the flag and deletes the splits together, deriving all
--      affected transactions server-side from one root (simple expense + linked
--      reimbursements, or installment parent + children + their reimbursements).
--   5  Cleans up any pre-existing orphans in households WITHOUT settlements; ABORTS
--      (RAISE) if orphans exist in households WITH settlements (manual reconciliation).
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor, then
-- regenerate types. The whole migration runs in one transaction so a failed guarantee
-- (or a settlement-bound orphan) aborts the entire apply instead of a partial state.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Symmetric splits invariant (replace the function; the deferred constraint
--     trigger trg_splits_sum_total from 0043 stays as-is and picks up the new body)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_splits_sum_total()
returns trigger language plpgsql as $trg$
declare
  v_tx_id     uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
  v_amount    numeric(18,2);
  v_is_shared boolean;
  v_sum       numeric(18,2);
  v_count     int;
begin
  -- If the transaction itself is gone (cascade delete), nothing to check.
  select amount, is_shared into v_amount, v_is_shared
    from public.transactions where id = v_tx_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(amount_assigned), 0), count(*) into v_sum, v_count
    from public.shared_expense_split where transaction_id = v_tx_id;

  if v_is_shared then
    -- Shared transaction that carries splits: they must sum the amount exactly.
    -- The installment PARENT carries no splits (no split row references it), so this
    -- function is never invoked for it — it is naturally exempt.
    if v_sum <> v_amount then
      raise exception
        'shared splits for transaction % sum % but the amount is %', v_tx_id, v_sum, v_amount;
    end if;
  else
    -- Unshared transaction: no split may survive.
    if v_count > 0 then
      raise exception
        'transaction % is not shared but still has % split(s)', v_tx_id, v_count;
    end if;
  end if;
  return null;
end;
$trg$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Block UN-sharing a shared expense while a settlement is live (BEFORE UPDATE
--     twin of 0043's trg_block_shared_delete_with_settlement)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_block_unshare_with_settlement()
returns trigger language plpgsql as $trg$
begin
  -- Fires only on the is_shared true→false transition (WHEN clause). Settlement legs
  -- are is_shared=false, so they never reach this transition.
  if OLD.household_id is not null
     and exists (select 1 from public.settlement where household_id = OLD.household_id) then
    raise exception
      'cannot unshare movement % while a settlement exists in household %',
      OLD.id, OLD.household_id;
  end if;
  return NEW;
end;
$trg$;

drop trigger if exists trg_block_unshare_with_settlement on public.transactions;
create trigger trg_block_unshare_with_settlement
  before update on public.transactions
  for each row
  when (OLD.is_shared is true and NEW.is_shared is false)
  execute function public.trg_fn_block_unshare_with_settlement();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · No split may survive an unshare — catches "flag flipped, splits untouched"
--     (deferred: the RPC flips the flag then deletes the splits in one transaction;
--     an INCOMPLETE unshare fails at commit)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_no_splits_when_unshared()
returns trigger language plpgsql as $trg$
begin
  if exists (
    select 1 from public.shared_expense_split where transaction_id = NEW.id
  ) then
    raise exception 'transaction % was unshared but still has splits', NEW.id;
  end if;
  return null;
end;
$trg$;

drop trigger if exists trg_no_splits_when_unshared on public.transactions;
create constraint trigger trg_no_splits_when_unshared
  after update on public.transactions
  deferrable initially deferred
  for each row
  when (OLD.is_shared is true and NEW.is_shared is false)
  execute function public.trg_fn_no_splits_when_unshared();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · unshare_movement — atomic unshare (flag + splits in one transaction).
--     SECURITY INVOKER: the owner already holds the needed privileges via RLS
--     (own transactions + own splits). Because shared transactions are cross-user
--     READABLE, a foreign attempt would otherwise be a silent zero-row UPDATE, so we
--     validate auth.uid() and ownership EXPLICITLY.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.unshare_movement(p_root_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $unshare$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_ids   uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Explicit ownership of the root (do NOT rely on RLS turning a foreign attempt
  -- into a zero-row "success").
  select user_id into v_owner from public.transactions where id = p_root_id;
  if not found then
    raise exception 'movement_not_found';
  end if;
  if v_owner <> v_uid then
    raise exception 'not_owner';
  end if;

  -- Affected set, derived server-side from the single root:
  --   root  ∪  installment children (parent_id = root)  ∪  reimbursements linked to any.
  with roots as (
    select p_root_id as id
    union
    select id from public.transactions
     where parent_id = p_root_id and user_id = v_uid
  )
  select array_agg(id) into v_ids from (
    select id from roots
    union
    select r.id
      from public.transactions r
      join roots on r.linked_transaction_id = roots.id
     where r.type = 'reimbursement' and r.user_id = v_uid
  ) s;

  -- Deterministic lock order to avoid deadlocks between concurrent calls.
  perform 1 from public.transactions
   where id = any(v_ids)
   order by id
   for update;

  -- Flip the flag (the BEFORE UPDATE guard aborts here if a settlement is live) and
  -- drop the splits, atomically. The deferred invariants verify at commit that no
  -- split survives on an unshared transaction.
  update public.transactions
     set is_shared = false, household_id = null
   where id = any(v_ids);

  delete from public.shared_expense_split
   where transaction_id = any(v_ids);
end;
$unshare$;

revoke execute on function public.unshare_movement(uuid) from public;
grant  execute on function public.unshare_movement(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · Cleanup of pre-existing orphans — settlement-aware. Abort (never silently
--     delete) if any orphan lives in a household WITH settlements, since removing it
--     would retroactively change a debt a settlement already accounted for.
--     Reads household_id from the SPLIT (the transaction's household_id is now null).
-- ═══════════════════════════════════════════════════════════════════════════

DO $cleanup$
DECLARE
  v_blocked int;
BEGIN
  SELECT count(*) INTO v_blocked
    FROM public.shared_expense_split s
    JOIN public.transactions t ON t.id = s.transaction_id
   WHERE t.is_shared = false
     AND EXISTS (select 1 from public.settlement se where se.household_id = s.household_id);
  IF v_blocked > 0 THEN
    RAISE EXCEPTION
      'CLEANUP ABORTED: % orphan split(s) live in households with settlements — reconcile manually before migrating', v_blocked;
  END IF;

  DELETE FROM public.shared_expense_split s
   USING public.transactions t
   WHERE s.transaction_id = t.id
     AND t.is_shared = false;
END $cleanup$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_ok boolean;
BEGIN
  -- The three triggers exist
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_block_unshare_with_settlement' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: unshare-settlement guard trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_no_splits_when_unshared' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: no-splits-when-unshared trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_splits_sum_total' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: splits-sum-total constraint trigger missing'; END IF;

  -- unshare_movement exists and is SECURITY INVOKER (prosecdef=false)
  SELECT p.prosecdef INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='unshare_movement';
  IF v_ok IS NULL THEN RAISE EXCEPTION 'SELF-CHECK FAILED: unshare_movement missing'; END IF;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'SELF-CHECK FAILED: unshare_movement must be SECURITY INVOKER'; END IF;

  -- No orphans remain after cleanup
  IF EXISTS (
    SELECT 1 FROM public.shared_expense_split s
      JOIN public.transactions t ON t.id = s.transaction_id
     WHERE t.is_shared = false
  ) THEN RAISE EXCEPTION 'SELF-CHECK FAILED: orphan splits still present after cleanup'; END IF;

  RAISE NOTICE 'shared unshare integrity validated: symmetric invariant, unshare guard, atomic RPC, cleanup.';
END $check$;

select '✓ 0048 shared unshare integrity applied' as status;

commit;
