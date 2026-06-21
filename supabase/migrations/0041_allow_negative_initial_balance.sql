-- Allow a negative opening balance on an account currency.
--
-- A bank account can legitimately open "en rojo" (overdraft / saldo negativo)
-- — it happens in real life. The original 0007 CHECK forced initial_balance >= 0,
-- which blocked that at the DB layer. We drop it; the form/Yup layers already
-- stopped rejecting negatives. Credit cards keep inserting 0, so relaxing the
-- bound is non-destructive for them.

alter table public.account_currencies
  drop constraint if exists chk_initial_balance_non_negative;
