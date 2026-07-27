-- Cards — deshacer el pago de un resumen (atomic statement-payment reversal).
--
-- Run AFTER 0046_card_stamp_tax_rate.sql.
--
-- Paying a statement (payCardPeriod) writes TWO classes of things, and only one of
-- them is reversible:
--
--   CALENDAR (irreversible by design)  confirms P(n+1)'s dates + is_estimated=false,
--     creates the eager estimated P(n+2), reassigns consumos across periods, and
--     derives accounts.stamp_tax_rate. Those are real-world facts read off the paper
--     statement — they hold regardless of whether the payment was entered correctly,
--     and undoing them would degrade confirmed periods and un-do reassignments whose
--     prior state is persisted nowhere.
--   MONEY (what this migration reverts)  the debit expense on the payment account,
--     the impuesto de sellos movement, the period's pending→paid sweep, and the
--     period_payments row.
--
-- Until now the reversal was impossible: period_payments.transaction_id references
-- the debit expense with FK RESTRICT, so a plain delete from the movement detail just
-- failed — while the confirmation copy promised the period's cuotas would go back to
-- pending. This migration:
--
--   1  Adds period_payments.stamp_tax_transaction_id (ON DELETE SET NULL) so the sello
--      is identified by an explicit link instead of a category/period heuristic, plus
--      stamp_tax_link_known to mark the pre-migration rows that predate that link.
--   2  Adds revert_card_period_payment(p_period_id) — an ATOMIC, SECURITY INVOKER RPC
--      (twin of unshare_movement, 0048) that undoes the money side in one transaction
--      and returns a summary for the UI's feedback.
--   3  Guards reversal order: a statement cannot be un-paid while a LATER statement of
--      the same card is already paid (custom SQLSTATE 'GRN02', twin of 0049's GRN01),
--      so a reversal never rewrites a past that a later payment was built on.
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor, then
-- regenerate types. The whole migration runs in one transaction.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Explicit link between a payment and its impuesto de sellos movement
-- ═══════════════════════════════════════════════════════════════════════════

-- ON DELETE SET NULL (not RESTRICT): the sello IS an independently deletable movement.
-- If the user deletes it on their own the link simply clears and the reversal finds
-- nothing to delete — deleting the sello must never be blocked by the payment.
alter table public.period_payments
  add column if not exists stamp_tax_transaction_id uuid
    references public.transactions(id) on delete set null;

-- Marks whether this payment row is capable of recording the link at all. Rows that
-- existed BEFORE this migration cannot (they were written by the old payCardPeriod),
-- so a NULL there is ambiguous — "no sello" or "sello not recorded" — and only those
-- rows may fall back to the heuristic. For every payment written from now on, NULL
-- means "no sello", full stop, so a manually-entered sello is never mistaken for one.
-- No backfill of the link itself: guessing backwards has the same failure mode as
-- guessing forwards, but with nobody watching.
alter table public.period_payments
  add column if not exists stamp_tax_link_known boolean not null default true;

DO $mark_legacy$
BEGIN
  -- Only on first apply: everything already in the table predates the link.
  IF EXISTS (SELECT 1 FROM public.period_payments WHERE stamp_tax_link_known) THEN
    UPDATE public.period_payments SET stamp_tax_link_known = false;
  END IF;
END $mark_legacy$;

create index if not exists idx_period_payments_stamp_tax
  on public.period_payments (stamp_tax_transaction_id)
  where stamp_tax_transaction_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · revert_card_period_payment — atomic reversal of the money side
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.revert_card_period_payment(p_period_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $revert$
declare
  v_uid          uuid := auth.uid();
  v_account_id   uuid;
  v_start_date   date;
  v_owner        uuid;
  v_payment_tx   uuid;
  v_stamp_tx     uuid;
  v_link_known   boolean;
  v_blocking     date;
  v_amount       numeric(18,2);
  v_pay_account  text;
  v_candidates   uuid[];
  v_stamp_status text;
  v_reverted     int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select cp.account_id, cp.start_date
    into v_account_id, v_start_date
    from public.card_periods cp
   where cp.id = p_period_id;
  if not found then
    raise exception 'period_not_found';
  end if;

  -- Explicit ownership of the card (do NOT rely on RLS turning a foreign attempt
  -- into a zero-row "success").
  select a.user_id into v_owner from public.accounts a where a.id = v_account_id;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  select pp.transaction_id, pp.stamp_tax_transaction_id, pp.stamp_tax_link_known
    into v_payment_tx, v_stamp_tx, v_link_known
    from public.period_payments pp
   where pp.period_id = p_period_id;
  if not found then
    raise exception 'period_not_paid';
  end if;

  -- ── Chronological guard ───────────────────────────────────────────────────
  -- Un-paying an older statement while a newer one is paid leaves a state the model
  -- allows but no screen communicates, and that you only get out of by undoing the
  -- newer payment anyway. Same spirit as the settlement guards (0043 + 0049): a
  -- reversal must not rewrite a past something else was already built on. The
  -- blocking period's close date travels in DETAIL so the app can name it without
  -- parsing the message.
  select cp.end_date into v_blocking
    from public.card_periods cp
    join public.period_payments pp2 on pp2.period_id = cp.id
   where cp.account_id = v_account_id
     and cp.start_date > v_start_date
   order by cp.start_date asc
   limit 1;

  if v_blocking is not null then
    raise exception
      'cannot revert payment of period % while a later period (closing %) is already paid',
      p_period_id, v_blocking
      using errcode = 'GRN02', detail = v_blocking::text;
  end if;

  -- Feedback payload, read BEFORE the deletes.
  select t.amount, a.name
    into v_amount, v_pay_account
    from public.transactions t
    join public.accounts a on a.id = t.account_id
   where t.id = v_payment_tx;

  -- Deterministic lock order to avoid deadlocks between concurrent calls.
  perform 1 from public.transactions
   where id = v_payment_tx or card_period_id = p_period_id
   order by id
   for update;

  -- ── The reversal, mirroring payCardPeriod step by step ────────────────────

  -- (a) Release the RESTRICT FK that blocks deleting the debit expense.
  delete from public.period_payments where period_id = p_period_id;

  -- (b) The period's charges go back to pending. Symmetric and safe: period_id is
  --     UNIQUE in period_payments and paying is rejected when a payment exists, so a
  --     period can only ever have been swept to 'paid' ONCE — nothing here was paid
  --     for another reason. Runs BEFORE deleting the sello so every movement of the
  --     statement travels the same path back, exact mirror of the sweep.
  update public.transactions
     set status = 'pending'
   where card_period_id = p_period_id
     and status = 'paid';
  get diagnostics v_reverted = row_count;

  -- (c) The impuesto de sellos: by explicit link when the payment recorded one.
  if v_stamp_tx is not null then
    delete from public.transactions where id = v_stamp_tx;
    v_stamp_status := 'deleted';
    v_reverted := v_reverted - 1;
  elsif v_link_known then
    -- Payment written after the link existed: NULL means there was no sello.
    v_stamp_status := 'none';
  else
    -- Pre-migration payment: fall back to the heuristic, and only act when it is
    -- unambiguous. With more than one candidate we would rather leave the user an
    -- extra movement to review than delete the wrong one.
    select array_agg(t.id) into v_candidates
      from public.transactions t
      join public.subcategories s on s.id = t.subcategory_id
     where t.card_period_id = p_period_id
       and s.canonical_name = 'impuesto-de-sellos';

    if v_candidates is null then
      v_stamp_status := 'none';
    elsif array_length(v_candidates, 1) = 1 then
      delete from public.transactions where id = v_candidates[1];
      v_stamp_status := 'deleted';
      v_reverted := v_reverted - 1;
    else
      v_stamp_status := 'ambiguous';
    end if;
  end if;

  -- (d) The debit expense on the payment account.
  delete from public.transactions where id = v_payment_tx;

  return jsonb_build_object(
    'reverted_amount',      v_amount,
    'payment_account_name', v_pay_account,
    'movements_reverted',   greatest(coalesce(v_reverted, 0), 0),
    'stamp_tax',            v_stamp_status
  );
end;
$revert$;

revoke execute on function public.revert_card_period_payment(uuid) from public;
grant  execute on function public.revert_card_period_payment(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_secdef boolean;
  v_legacy int;
BEGIN
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='period_payments'
     AND column_name='stamp_tax_transaction_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: stamp_tax_transaction_id missing'; END IF;

  PERFORM 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='period_payments'
     AND column_name='stamp_tax_link_known';
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: stamp_tax_link_known missing'; END IF;

  -- Every pre-existing payment must be marked as predating the link.
  SELECT count(*) INTO v_legacy FROM public.period_payments WHERE stamp_tax_link_known;
  IF v_legacy > 0 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: % pre-existing payment(s) not marked as legacy', v_legacy;
  END IF;

  -- The RPC exists and is SECURITY INVOKER (prosecdef=false)
  SELECT p.prosecdef INTO v_secdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='revert_card_period_payment';
  IF v_secdef IS NULL THEN RAISE EXCEPTION 'SELF-CHECK FAILED: revert_card_period_payment missing'; END IF;
  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: revert_card_period_payment must be SECURITY INVOKER';
  END IF;

  RAISE NOTICE 'card statement payment reversal validated: stamp-tax link, atomic RPC, chronological guard.';
END $check$;

select '✓ 0050 revert card period payment applied' as status;

commit;
