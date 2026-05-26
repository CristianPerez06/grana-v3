-- Migration: 0014_transactions_exchange
-- Adds the 'exchange' (currency conversion) movement type: extends the enum,
-- adds the destination-leg columns (destination_amount / destination_currency),
-- and the constraints that make an exchange a two-legged, two-currency movement.
-- The destination ACCOUNT reuses transfer_destination_account_id (shared by
-- transfer and exchange). An exchange MAY have the same source and destination
-- account (intra-account conversion), as long as the currencies differ.
-- All constraints use `type::text` to avoid "unsafe use of new enum value" when
-- run in a single transaction (same pattern as 0009).

-- ============================================================
-- 1. Extend enum
-- ============================================================

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'exchange';

-- ============================================================
-- 2. New columns: destination leg (amount + currency)
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS destination_amount   numeric(18,2),
  ADD COLUMN IF NOT EXISTS destination_currency text REFERENCES public.currencies(code);

-- ============================================================
-- 3. Allow a destination account for exchange too
--    (transfer_destination_account_id was transfer-only)
-- ============================================================

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_non_transfer_no_destination;

ALTER TABLE transactions
  ADD CONSTRAINT chk_non_transfer_no_destination
    CHECK (type::text IN ('transfer', 'exchange') OR transfer_destination_account_id IS NULL);

-- ============================================================
-- 4. Exchange integrity constraints
-- ============================================================

-- An exchange must carry a full destination leg.
ALTER TABLE transactions
  ADD CONSTRAINT chk_exchange_has_destination
    CHECK (
      type::text != 'exchange'
      OR (transfer_destination_account_id IS NOT NULL
          AND destination_amount IS NOT NULL
          AND destination_currency IS NOT NULL)
    );

-- An exchange converts between two DIFFERENT currencies.
ALTER TABLE transactions
  ADD CONSTRAINT chk_exchange_currencies_differ
    CHECK (type::text != 'exchange' OR currency_code != destination_currency);

-- Exchange destination amount must be positive (source amount is already
-- covered by chk_amount_positive_non_adjustment).
ALTER TABLE transactions
  ADD CONSTRAINT chk_exchange_destination_positive
    CHECK (type::text != 'exchange' OR destination_amount > 0);

-- Only exchanges may carry destination_amount / destination_currency
-- (a transfer reuses transfer_destination_account_id but never these columns).
ALTER TABLE transactions
  ADD CONSTRAINT chk_destination_fields_only_exchange
    CHECK (
      type::text = 'exchange'
      OR (destination_amount IS NULL AND destination_currency IS NULL)
    );

-- Note: chk_transfer_different_accounts already exempts non-transfers, so an
-- exchange with account_id = transfer_destination_account_id (intra-account)
-- passes — no change needed there.

-- ============================================================
-- 5. Self-check
-- ============================================================

DO $$
DECLARE
  v_enum_exchange   boolean;
  v_col_amount      boolean;
  v_col_currency    boolean;
  v_chk_no_dest     boolean;
  v_chk_has_dest    boolean;
  v_chk_diff_curr   boolean;
  v_chk_dest_pos    boolean;
  v_chk_only_exch   boolean;
BEGIN
  SELECT COUNT(*) = 1 INTO v_enum_exchange
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'exchange';

  SELECT COUNT(*) = 1 INTO v_col_amount
    FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'destination_amount';

  SELECT COUNT(*) = 1 INTO v_col_currency
    FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'destination_currency';

  SELECT COUNT(*) = 1 INTO v_chk_no_dest
    FROM pg_constraint WHERE conname = 'chk_non_transfer_no_destination';
  SELECT COUNT(*) = 1 INTO v_chk_has_dest
    FROM pg_constraint WHERE conname = 'chk_exchange_has_destination';
  SELECT COUNT(*) = 1 INTO v_chk_diff_curr
    FROM pg_constraint WHERE conname = 'chk_exchange_currencies_differ';
  SELECT COUNT(*) = 1 INTO v_chk_dest_pos
    FROM pg_constraint WHERE conname = 'chk_exchange_destination_positive';
  SELECT COUNT(*) = 1 INTO v_chk_only_exch
    FROM pg_constraint WHERE conname = 'chk_destination_fields_only_exchange';

  IF NOT v_enum_exchange THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transaction_type does not include ''exchange'''; END IF;
  IF NOT v_col_amount THEN RAISE EXCEPTION 'SELF-CHECK FAILED: column destination_amount missing'; END IF;
  IF NOT v_col_currency THEN RAISE EXCEPTION 'SELF-CHECK FAILED: column destination_currency missing'; END IF;
  IF NOT v_chk_no_dest THEN RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_non_transfer_no_destination missing'; END IF;
  IF NOT v_chk_has_dest THEN RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_exchange_has_destination missing'; END IF;
  IF NOT v_chk_diff_curr THEN RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_exchange_currencies_differ missing'; END IF;
  IF NOT v_chk_dest_pos THEN RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_exchange_destination_positive missing'; END IF;
  IF NOT v_chk_only_exch THEN RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_destination_fields_only_exchange missing'; END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: all 0014 objects verified';
END $$;

-- ============================================================
-- 6. Summary SELECT (for SQL Editor output)
-- ============================================================

SELECT
  (SELECT COUNT(*) = 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'exchange')        AS enum_exchange_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'destination_amount')  AS col_amount_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'destination_currency') AS col_currency_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint WHERE conname = 'chk_exchange_has_destination')        AS chk_has_dest_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint WHERE conname = 'chk_exchange_currencies_differ')       AS chk_diff_curr_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint WHERE conname = 'chk_exchange_destination_positive')    AS chk_dest_pos_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint WHERE conname = 'chk_destination_fields_only_exchange') AS chk_only_exch_ok;
