-- 0010_credit_cards.sql
-- Credit card support: extends account_type with 'credit', adds credit columns
-- to accounts, creates card_periods and period_payments tables, extends
-- transactions with credit-card fields and invariant triggers.
--
-- card_networks table + seed already created in 0004_seed_card_networks.sql.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Extend account_type enum with 'credit'
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'credit';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Credit-card columns on accounts
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS credit_limit       NUMERIC(18,2) NULL,
  ADD COLUMN IF NOT EXISTS network_id         UUID          NULL
    REFERENCES public.card_networks(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS other_network_name TEXT          NULL;

-- Only credit accounts may carry these fields
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_credit_columns_only_for_credit
    CHECK (
      type::text = 'credit' OR (
        credit_limit IS NULL AND network_id IS NULL AND other_network_name IS NULL
      )
    );

-- For credit accounts, exactly one of network_id / other_network_name must be set
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_network_xor
    CHECK (
      type::text != 'credit' OR (
        (network_id IS NULL     AND other_network_name IS NOT NULL) OR
        (network_id IS NOT NULL AND other_network_name IS NULL)
      )
    );

-- credit_limit, when provided, must be positive (ARS value)
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_credit_limit_positive
    CHECK (credit_limit IS NULL OR credit_limit > 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Trigger: I-CRED-1 — credit accounts must have initial_balance = 0
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_fn_credit_initial_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_account_type TEXT;
BEGIN
  SELECT type::text INTO v_account_type
    FROM public.accounts
   WHERE id = NEW.account_id;

  IF v_account_type = 'credit' AND NEW.initial_balance <> 0 THEN
    RAISE EXCEPTION
      'chk_credit_initial_balance: initial_balance must be 0 for credit accounts, got %',
      NEW.initial_balance;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_initial_balance
  BEFORE INSERT OR UPDATE ON public.account_currencies
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_credit_initial_balance();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. card_periods
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.card_periods (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  due_date     DATE        NOT NULL,
  is_estimated BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_period_dates CHECK (start_date < end_date AND end_date < due_date),
  UNIQUE (account_id, start_date)
);

CREATE INDEX idx_card_periods_account_start
  ON public.card_periods (account_id, start_date);

ALTER TABLE public.card_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own card_periods" ON public.card_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
       WHERE a.id = card_periods.account_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users insert own card_periods" ON public.card_periods
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts a
       WHERE a.id = card_periods.account_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users update own card_periods" ON public.card_periods
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
       WHERE a.id = card_periods.account_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts a
       WHERE a.id = card_periods.account_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users delete own card_periods" ON public.card_periods
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
       WHERE a.id = card_periods.account_id AND a.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Extend transactions for credit card support
-- ═══════════════════════════════════════════════════════════════════════════

-- is_parent column first (needed by constraints below)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_parent BOOLEAN NOT NULL DEFAULT false;

-- account_id becomes nullable: parent installment rows have no account
ALTER TABLE public.transactions
  ALTER COLUMN account_id DROP NOT NULL;

-- Remaining credit-card columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status             TEXT          NULL,
  ADD COLUMN IF NOT EXISTS due_date           DATE          NULL,
  ADD COLUMN IF NOT EXISTS parent_id          UUID          NULL
    REFERENCES public.transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS installment_n      SMALLINT      NULL,
  ADD COLUMN IF NOT EXISTS installments_total SMALLINT      NULL,
  ADD COLUMN IF NOT EXISTS card_period_id     UUID          NULL
    REFERENCES public.card_periods(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fx_rate_to_ars     NUMERIC(18,6) NULL;

-- status valid values (NULL for non-credit transactions)
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transaction_status_valid
    CHECK (status IS NULL OR status IN ('pending', 'paid'));

-- Non-parent rows must have an account
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_account_id_required_for_child
    CHECK (is_parent = true OR account_id IS NOT NULL);

-- I-CRED-9: installments > 1 must be in ARS only
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_installments_ars_only
    CHECK (
      installments_total IS NULL OR
      installments_total <= 1 OR
      currency_code = 'ARS'
    );

-- installment_n and installments_total must both be set or both NULL
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_installment_fields_consistent
    CHECK ((installment_n IS NULL) = (installments_total IS NULL));

-- Parent rows are off-ledger: no account, no period, no status
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_parent_row_is_off_ledger
    CHECK (
      is_parent = false OR (
        account_id     IS NULL AND
        card_period_id IS NULL AND
        status         IS NULL
      )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Indexes for credit card lookups
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_transactions_card_period
  ON public.transactions (card_period_id)
  WHERE card_period_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_parent
  ON public.transactions (parent_id)
  WHERE parent_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. period_payments (depends on card_periods and transactions)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.period_payments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id      UUID        NOT NULL UNIQUE REFERENCES public.card_periods(id) ON DELETE CASCADE,
  transaction_id UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_period_payments_transaction
  ON public.period_payments (transaction_id);

ALTER TABLE public.period_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own period_payments" ON public.period_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.card_periods cp
      JOIN public.accounts a ON a.id = cp.account_id
       WHERE cp.id = period_payments.period_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users insert own period_payments" ON public.period_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.card_periods cp
      JOIN public.accounts a ON a.id = cp.account_id
       WHERE cp.id = period_payments.period_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users update own period_payments" ON public.period_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.card_periods cp
      JOIN public.accounts a ON a.id = cp.account_id
       WHERE cp.id = period_payments.period_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.card_periods cp
      JOIN public.accounts a ON a.id = cp.account_id
       WHERE cp.id = period_payments.period_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "users delete own period_payments" ON public.period_payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.card_periods cp
      JOIN public.accounts a ON a.id = cp.account_id
       WHERE cp.id = period_payments.period_id AND a.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Trigger: enforce I-CRED-6 and I-CRED-11 on transactions
-- ═══════════════════════════════════════════════════════════════════════════

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
    -- I-CRED-11: non-ARS credit expense must have fx_rate_to_ars > 0
    IF NEW.currency_code <> 'ARS' THEN
      IF NEW.fx_rate_to_ars IS NULL OR NEW.fx_rate_to_ars <= 0 THEN
        RAISE EXCEPTION
          'I-CRED-11: non-ARS credit card expense must have fx_rate_to_ars > 0, got: %',
          NEW.fx_rate_to_ars;
      END IF;
    ELSE
      -- ARS credit expense must NOT have fx_rate_to_ars
      IF NEW.fx_rate_to_ars IS NOT NULL THEN
        RAISE EXCEPTION
          'I-CRED-11: ARS credit card expense must have fx_rate_to_ars = NULL';
      END IF;
    END IF;
  ELSE
    -- Non-credit or non-expense transaction must NOT have fx_rate_to_ars
    IF NEW.fx_rate_to_ars IS NOT NULL THEN
      RAISE EXCEPTION
        'I-CRED-11: fx_rate_to_ars must be NULL for non-credit or non-expense transactions';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_transaction_invariants
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_credit_transaction_invariants();

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT COUNT(*) = 1 INTO v_ok
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
   WHERE t.typname = 'account_type' AND e.enumlabel = 'credit';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: account_type missing credit value'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'credit_limit';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: accounts.credit_limit missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'network_id';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: accounts.network_id missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'other_network_name';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: accounts.other_network_name missing'; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'card_periods') INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: card_periods table missing'; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'period_payments') INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: period_payments table missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'status';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions.status missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'is_parent';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions.is_parent missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'card_period_id';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions.card_period_id missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'fx_rate_to_ars';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions.fx_rate_to_ars missing'; END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'trg_fn_credit_transaction_invariants';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: trg_fn_credit_transaction_invariants missing'; END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: 0010_credit_cards migration verified successfully';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Summary SELECT
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  (SELECT COUNT(*) = 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'account_type' AND e.enumlabel = 'credit')            AS credit_type_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts'
      AND column_name = 'credit_limit')                                      AS credit_limit_col_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'card_periods'))          AS card_periods_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'period_payments'))       AS period_payments_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'status')                                            AS tx_status_col_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'is_parent')                                         AS tx_is_parent_col_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'card_period_id')                                    AS tx_card_period_id_col_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'fx_rate_to_ars')                                    AS tx_fx_rate_col_ok;
