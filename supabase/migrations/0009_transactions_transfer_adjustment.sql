-- Migration: 0009_transactions_transfer_adjustment
-- Extends transaction_type enum with 'transfer' and 'adjustment',
-- adds transfer_destination_account_id column, updates constraints and indexes.

-- ============================================================
-- 1. Extend enum
-- ============================================================

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'adjustment';

-- ============================================================
-- 2. New column: transfer_destination_account_id
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transfer_destination_account_id uuid
    REFERENCES accounts(id) ON DELETE RESTRICT;

-- ============================================================
-- 3. Replace amount constraint
-- ============================================================

-- Drop old constraint (amount > 0 unconditionally)
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_amount_positive;

-- New: amount > 0 for everything except adjustments
-- Uses ::text cast to avoid "unsafe use of new enum value" error when run in a single transaction.
ALTER TABLE transactions
  ADD CONSTRAINT chk_amount_positive_non_adjustment
    CHECK (type::text = 'adjustment' OR amount > 0);

-- Adjustments must be nonzero (positive or negative, never 0)
ALTER TABLE transactions
  ADD CONSTRAINT chk_adjustment_amount_nonzero
    CHECK (type::text != 'adjustment' OR amount != 0);

-- ============================================================
-- 4. Transfer integrity constraints
-- ============================================================

-- If type='transfer', destination must be present
ALTER TABLE transactions
  ADD CONSTRAINT chk_transfer_has_destination
    CHECK (type::text != 'transfer' OR transfer_destination_account_id IS NOT NULL);

-- Source and destination accounts must differ
ALTER TABLE transactions
  ADD CONSTRAINT chk_transfer_different_accounts
    CHECK (type::text != 'transfer' OR account_id != transfer_destination_account_id);

-- Only transfers may have a destination account
ALTER TABLE transactions
  ADD CONSTRAINT chk_non_transfer_no_destination
    CHECK (type::text = 'transfer' OR transfer_destination_account_id IS NULL);

-- ============================================================
-- 5. Partial index for transfer destination lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_destination
  ON transactions (transfer_destination_account_id)
  WHERE transfer_destination_account_id IS NOT NULL;

-- ============================================================
-- 6. Self-check
-- ============================================================

DO $$
DECLARE
  v_enum_transfer  boolean;
  v_enum_adj       boolean;
  v_col_exists     boolean;
  v_chk_non_adj    boolean;
  v_chk_nonzero    boolean;
  v_chk_has_dest   boolean;
  v_chk_diff_accts boolean;
  v_chk_no_dest    boolean;
  v_idx_exists     boolean;
BEGIN
  -- Enum values
  SELECT COUNT(*) = 1 INTO v_enum_transfer
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'transfer';

  SELECT COUNT(*) = 1 INTO v_enum_adj
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'adjustment';

  -- Column existence
  SELECT COUNT(*) = 1 INTO v_col_exists
    FROM information_schema.columns
    WHERE table_name = 'transactions'
      AND column_name = 'transfer_destination_account_id';

  -- Constraints
  SELECT COUNT(*) = 1 INTO v_chk_non_adj
    FROM pg_constraint WHERE conname = 'chk_amount_positive_non_adjustment';

  SELECT COUNT(*) = 1 INTO v_chk_nonzero
    FROM pg_constraint WHERE conname = 'chk_adjustment_amount_nonzero';

  SELECT COUNT(*) = 1 INTO v_chk_has_dest
    FROM pg_constraint WHERE conname = 'chk_transfer_has_destination';

  SELECT COUNT(*) = 1 INTO v_chk_diff_accts
    FROM pg_constraint WHERE conname = 'chk_transfer_different_accounts';

  SELECT COUNT(*) = 1 INTO v_chk_no_dest
    FROM pg_constraint WHERE conname = 'chk_non_transfer_no_destination';

  -- Index
  SELECT COUNT(*) = 1 INTO v_idx_exists
    FROM pg_indexes
    WHERE tablename = 'transactions'
      AND indexname = 'idx_transactions_destination';

  -- Fail if any check is false
  IF NOT v_enum_transfer THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: transaction_type does not include ''transfer''';
  END IF;
  IF NOT v_enum_adj THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: transaction_type does not include ''adjustment''';
  END IF;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: column transfer_destination_account_id missing from transactions';
  END IF;
  IF NOT v_chk_non_adj THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_amount_positive_non_adjustment missing';
  END IF;
  IF NOT v_chk_nonzero THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_adjustment_amount_nonzero missing';
  END IF;
  IF NOT v_chk_has_dest THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_transfer_has_destination missing';
  END IF;
  IF NOT v_chk_diff_accts THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_transfer_different_accounts missing';
  END IF;
  IF NOT v_chk_no_dest THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: constraint chk_non_transfer_no_destination missing';
  END IF;
  IF NOT v_idx_exists THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: index idx_transactions_destination missing';
  END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: all 0009 objects verified';
END $$;

-- ============================================================
-- 7. Summary SELECT (for SQL Editor output)
-- ============================================================

SELECT
  (SELECT COUNT(*) = 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'transfer')          AS enum_transfer_ok,
  (SELECT COUNT(*) = 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'transaction_type' AND e.enumlabel = 'adjustment')        AS enum_adjustment_ok,
  (SELECT COUNT(*) = 1 FROM information_schema.columns
    WHERE table_name = 'transactions'
      AND column_name = 'transfer_destination_account_id')                      AS column_dest_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint
    WHERE conname = 'chk_amount_positive_non_adjustment')                       AS chk_non_adj_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint
    WHERE conname = 'chk_adjustment_amount_nonzero')                            AS chk_nonzero_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint
    WHERE conname = 'chk_transfer_has_destination')                             AS chk_has_dest_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint
    WHERE conname = 'chk_transfer_different_accounts')                          AS chk_diff_accts_ok,
  (SELECT COUNT(*) = 1 FROM pg_constraint
    WHERE conname = 'chk_non_transfer_no_destination')                          AS chk_no_dest_ok,
  (SELECT COUNT(*) = 1 FROM pg_indexes
    WHERE tablename = 'transactions'
      AND indexname = 'idx_transactions_destination')                           AS idx_dest_ok;
