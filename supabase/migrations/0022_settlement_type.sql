-- Shared module (Compartido) — part 1 of 2: the 'settlement' enum value.
--
-- A debt settlement between two household members is a movement of its own type:
-- it impacts the account's `disponible` but is NOT a categorized expense/income,
-- so it stays out of spending/income analytics (same rationale as 'reimbursement'
-- and 'exchange'). Postgres does NOT allow USING a newly added enum value in the
-- same transaction that ADDs it, so — like 0017 split from 0018 — this lives in
-- its own file: run 0022 first (commits the value), then run 0023 (tables, columns,
-- RLS, functions that reference `type = 'settlement'`).
--
-- See openspec/changes/add-shared-expenses/.

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'settlement';

-- ─── Self-check ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT COUNT(*) = 1 INTO v_ok
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
   WHERE t.typname = 'transaction_type' AND e.enumlabel = 'settlement';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: transaction_type missing settlement value';
  END IF;

  RAISE NOTICE 'settlement type migration validated: transaction_type has settlement.';
END $$;

select '✓ 0022 settlement_type applied' as status;
