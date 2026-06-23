-- Shared module (Compartido) — settlement reversal as CONTRAASIENTO (Paso 3 · Fase B).
--
-- Run AFTER 0043_shared_security_hardening.sql.
--
-- Until now reverting a completed settlement DELETED both legs (`reverse_settlement`).
-- The cuenta corriente models the household as a running ledger where "nunca se borra,
-- se contraasienta": a reversal PRESERVES the original (marked `reversed`) and adds an
-- opposite counter-entry that restores `disponible` and nets the debt back to where it
-- was. The original (reversed) and the contra both keep counting toward the debt, so they
-- cancel (net zero) without any special-casing in the debt math. See spec `shared`
-- "La reversión de una liquidación es un contraasiento, no un borrado".

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. settlement: reversal columns + widened status
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.settlement
  ADD COLUMN IF NOT EXISTS reversed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS reverses_settlement_id uuid references public.settlement(id) on delete set null;

ALTER TABLE public.settlement DROP CONSTRAINT IF EXISTS chk_settlement_status;
ALTER TABLE public.settlement
  ADD CONSTRAINT chk_settlement_status
    CHECK (status IN ('pending_receipt', 'completed', 'reversed', 'contra'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. reverse_settlement — preserve the original, add the counter-entry
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reverse_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $reverse$
declare
  v_household     uuid;
  v_payer         uuid;
  v_receiver      uuid;
  v_amount        numeric(18,2);
  v_currency      text;
  v_payer_mov     uuid;
  v_receiver_mov  uuid;
  v_status        text;
  v_payer_acct    uuid;
  v_receiver_acct uuid;
  v_today         date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_p_in          uuid;
  v_r_out         uuid;
begin
  select household_id, payer_id, receiver_id, amount, currency_code,
         payer_movement_id, receiver_movement_id, status
    into v_household, v_payer, v_receiver, v_amount, v_currency,
         v_payer_mov, v_receiver_mov, v_status
    from public.settlement where id = p_settlement_id;
  if not found then
    raise exception 'settlement % not found', p_settlement_id;
  end if;

  if not exists (
    select 1 from public.household_member
     where household_id = v_household and user_id = auth.uid()
  ) then
    raise exception 'not authorized to reverse this settlement';
  end if;
  if v_status <> 'completed' then
    raise exception 'only a completed settlement can be reversed';
  end if;
  if v_receiver_mov is null then
    raise exception 'settlement % has no receiver leg', p_settlement_id;
  end if;

  -- Restore the SAME accounts the original legs hit.
  select account_id into v_payer_acct    from public.transactions where id = v_payer_mov;
  select account_id into v_receiver_acct  from public.transactions where id = v_receiver_mov;

  -- Counter legs (opposite direction): payer gets the money back ('in'),
  -- receiver gives it back ('out'). Settlement-type → hits disponible, excluded
  -- from spending/income analytics.
  insert into public.transactions (
    user_id, account_id, type, settlement_direction, amount, currency_code, date, category_id
  ) values (
    v_payer, v_payer_acct, 'settlement', 'in', v_amount, v_currency, v_today, null
  ) returning id into v_p_in;

  insert into public.transactions (
    user_id, account_id, type, settlement_direction, amount, currency_code, date, category_id
  ) values (
    v_receiver, v_receiver_acct, 'settlement', 'out', v_amount, v_currency, v_today, null
  ) returning id into v_r_out;

  -- Preserve the original, marked reversed (NOT deleted).
  update public.settlement
     set status = 'reversed', reversed_at = now()
   where id = p_settlement_id;

  -- Counter-entry settlement row: swapped direction, linked to the original.
  insert into public.settlement (
    household_id, payer_id, payer_movement_id, receiver_id, receiver_movement_id,
    amount, currency_code, status, resolved_at, reverses_settlement_id
  ) values (
    v_household, v_receiver, v_r_out, v_payer, v_p_in,
    v_amount, v_currency, 'contra', now(), p_settlement_id
  );
end;
$reverse$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_ok boolean;
BEGIN
  -- columns exist
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'settlement'
     AND column_name IN ('reversed_at', 'reverses_settlement_id')
   GROUP BY table_name HAVING COUNT(*) = 2;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: reversal columns missing'; END IF;

  -- status check allows 'reversed' and 'contra'
  PERFORM 1 FROM pg_constraint
   WHERE conname = 'chk_settlement_status'
     AND pg_get_constraintdef(oid) ILIKE '%reversed%'
     AND pg_get_constraintdef(oid) ILIKE '%contra%';
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: status check not widened'; END IF;

  -- reverse_settlement still SECURITY DEFINER
  SELECT p.prosecdef INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reverse_settlement';
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: reverse_settlement missing or not SECURITY DEFINER';
  END IF;

  -- reverse_settlement no longer DELETEs transactions (it preserves + counter-entries)
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reverse_settlement'
     AND pg_get_functiondef(p.oid) ILIKE '%delete from public.transactions%';
  IF FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: reverse_settlement still deletes legs'; END IF;

  RAISE NOTICE 'settlement contraasiento validated: columns, status, reverse_settlement preserves.';
END $check$;

select '✓ 0044 settlement contraasiento applied' as status;
