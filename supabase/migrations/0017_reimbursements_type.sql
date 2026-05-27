-- Reimbursements (reintegros / cashback) — part 1 of 2: the enum value.
--
-- Postgres does NOT allow USING a newly added enum value (e.g. in a CHECK
-- constraint literal like `type = 'reimbursement'`) in the same transaction
-- that ADDs it. Because v3 applies migrations by pasting SQL into the Supabase
-- dashboard, this is split into its own file: run 0017 first (it commits the
-- new enum value), then run 0018 (columns, constraints, triggers).
--
-- See openspec/changes/add-reimbursements/.

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'reimbursement';

-- ─── Self-check ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT COUNT(*) = 1 INTO v_ok
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
   WHERE t.typname = 'transaction_type' AND e.enumlabel = 'reimbursement';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: transaction_type missing reimbursement value';
  END IF;

  RAISE NOTICE 'reimbursements type migration validated: transaction_type has reimbursement.';
END $$;

select '✓ 0017 reimbursements_type applied' as status;
