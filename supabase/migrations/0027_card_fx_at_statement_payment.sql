-- Change card-fx-at-statement-payment: the cotización moves from the purchase
-- to the statement payment. Two trigger rules change:
--
--   1. I-CRED-11 (relaxed): a non-ARS credit card expense no longer REQUIRES
--      fx_rate_to_ars — the conversion happens at statement payment with the
--      payment-day rate. When present it must still be > 0 (historical data /
--      optional estimate).
--   2. Non-credit EXPENSES may now carry fx_rate_to_ars > 0: the statement
--      payment (an ARS expense on a cash/bank account) persists the
--      payment-day rate for traceability. The strict NULL rule stays for every
--      non-expense type (income, transfer, adjustment, reimbursement).
--
-- I-CRED-6 and the "ARS credit expense must NOT have fx" rule are unchanged.

CREATE OR REPLACE FUNCTION public.trg_fn_credit_transaction_invariants()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_account_type TEXT;
BEGIN
  -- Parent rows are off-ledger; skip all credit invariant checks
  IF NEW.is_parent = true THEN
    RETURN NEW;
  END IF;

  -- Resolve account type when account_id is set
  IF NEW.account_id IS NOT NULL THEN
    SELECT type::text INTO v_account_type
      FROM public.accounts
     WHERE id = NEW.account_id;
  END IF;

  IF v_account_type = 'credit' AND NEW.type::text = 'expense' THEN
    -- I-CRED-6: must have card_period_id and valid status
    IF NEW.card_period_id IS NULL THEN
      RAISE EXCEPTION 'I-CRED-6: credit card expense must have card_period_id set';
    END IF;
    IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'paid') THEN
      RAISE EXCEPTION
        'I-CRED-6: credit card expense status must be ''pending'' or ''paid'', got: %',
        NEW.status;
    END IF;
    -- I-CRED-11 (relaxed): fx is optional on non-ARS credit expenses; the real
    -- conversion happens at statement payment. When present it must be > 0.
    IF NEW.currency_code <> 'ARS' THEN
      IF NEW.fx_rate_to_ars IS NOT NULL AND NEW.fx_rate_to_ars <= 0 THEN
        RAISE EXCEPTION
          'I-CRED-11: fx_rate_to_ars must be > 0 when set, got: %',
          NEW.fx_rate_to_ars;
      END IF;
    ELSE
      -- ARS credit expense must NOT have fx_rate_to_ars
      IF NEW.fx_rate_to_ars IS NOT NULL THEN
        RAISE EXCEPTION
          'I-CRED-11: ARS credit card expense must have fx_rate_to_ars = NULL';
      END IF;
    END IF;
  ELSIF NEW.type::text = 'expense' THEN
    -- Non-credit expense: fx allowed (statement payments persist the
    -- payment-day rate); must be > 0 when present.
    IF NEW.fx_rate_to_ars IS NOT NULL AND NEW.fx_rate_to_ars <= 0 THEN
      RAISE EXCEPTION
        'I-CRED-11: fx_rate_to_ars must be > 0 when set, got: %',
        NEW.fx_rate_to_ars;
    END IF;
  ELSE
    -- Non-expense transaction must NOT have fx_rate_to_ars
    IF NEW.fx_rate_to_ars IS NOT NULL THEN
      RAISE EXCEPTION
        'I-CRED-11: fx_rate_to_ars must be NULL for non-expense transactions';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
