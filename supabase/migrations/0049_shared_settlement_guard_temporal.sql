-- Shared module (Compartido) — make the settlement guards TEMPORAL and per-currency.
--
-- Run AFTER 0043_shared_security_hardening.sql and 0048_shared_unshare_integrity.sql.
--
-- Both settlement guards (block DELETE — 0043; block UNSHARE — 0048) were broad:
-- ANY settlement in the household froze every shared expense, ignoring dates and
-- currency. That over-blocks: removing an expense that is NEWER than every
-- settlement cannot rewrite a debt those settlements already accounted for, and a
-- settlement in one currency has nothing to do with an expense in the other.
--
-- The net debt is order-independent, but the cuenta-corriente EXTRACT (running
-- balance) is ordered, and the product rule is "don't retroactively pull an
-- expense out from under a settlement that came at/after it". So the precise rule:
--
--   Block mutating a shared movement M (delete or unshare) iff there exists a
--   settlement S in the SAME household and SAME currency whose date (its payer
--   movement's date) is >= M's impact date (coalesce(due_date, date)).
--
-- Refinements that fall out of firing the trigger PER ROW:
--   · Only rows that CARRY splits are guarded (exists shared_expense_split). This
--     naturally exempts the installment PARENT (no splits) and settlement legs
--     (is_shared=false, no splits), and evaluates each child cuota / reimbursement
--     by ITS OWN impact date.
--   · Currency is compared per row, so an ARS settlement never locks a USD expense.
--
-- Both functions RAISE with a custom SQLSTATE 'GRN01' so the app can map it to a
-- friendly, on-brand message without re-implementing the temporal query.
--
-- Supabase is online-only: paste into the SQL Editor. Runs in one transaction.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Block DELETE of a shared movement covered by an at/after settlement (0043 v2)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_block_shared_delete_with_settlement()
returns trigger language plpgsql as $trg$
begin
  -- Only rows that carry debt (splits) can rewrite settled history. Exempts the
  -- installment parent and settlement legs, and keys each row by its own date.
  if OLD.is_shared
     and OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1
         from public.settlement s
         join public.transactions pm on pm.id = s.payer_movement_id
        where s.household_id = OLD.household_id
          and s.currency_code = OLD.currency_code
          and pm.date >= coalesce(OLD.due_date, OLD.date)
     ) then
    raise exception
      'cannot delete shared movement % covered by a later settlement in household %',
      OLD.id, OLD.household_id
      using errcode = 'GRN01';
  end if;
  return OLD;
end;
$trg$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Block UNSHARE (is_shared true→false) of a shared movement covered by an
-- at/after settlement (0048 v2). Fires per row via the WHEN clause on the flip.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_block_unshare_with_settlement()
returns trigger language plpgsql as $trg$
begin
  if OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1
         from public.settlement s
         join public.transactions pm on pm.id = s.payer_movement_id
        where s.household_id = OLD.household_id
          and s.currency_code = OLD.currency_code
          and pm.date >= coalesce(OLD.due_date, OLD.date)
     ) then
    raise exception
      'cannot unshare movement % covered by a later settlement in household %',
      OLD.id, OLD.household_id
      using errcode = 'GRN01';
  end if;
  return NEW;
end;
$trg$;

-- (The triggers themselves — trg_block_shared_delete_with_settlement from 0043 and
--  trg_block_unshare_with_settlement from 0048 — are unchanged; they pick up the
--  new function bodies.)

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
BEGIN
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_block_shared_delete_with_settlement' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: delete guard trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_block_unshare_with_settlement' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: unshare guard trigger missing'; END IF;

  -- Both functions must now reference the per-currency temporal join.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='trg_fn_block_shared_delete_with_settlement'
       AND pg_get_functiondef(p.oid) ILIKE '%payer_movement_id%'
       AND pg_get_functiondef(p.oid) ILIKE '%currency_code%'
  ) THEN RAISE EXCEPTION 'SELF-CHECK FAILED: delete guard is not temporal/per-currency'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='trg_fn_block_unshare_with_settlement'
       AND pg_get_functiondef(p.oid) ILIKE '%payer_movement_id%'
       AND pg_get_functiondef(p.oid) ILIKE '%currency_code%'
  ) THEN RAISE EXCEPTION 'SELF-CHECK FAILED: unshare guard is not temporal/per-currency'; END IF;

  RAISE NOTICE 'settlement guards are now temporal + per-currency (delete + unshare).';
END $check$;

select '✓ 0049 shared settlement guards temporal applied' as status;

commit;
