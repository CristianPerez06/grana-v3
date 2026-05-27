-- Reimbursements (reintegros / cashback) — part 2 of 2: schema + invariants.
--
-- Run AFTER 0017_reimbursements_type.sql (which commits the 'reimbursement'
-- enum value). A reintegro is a movement of its own type, linked to the origin
-- expense, that may be pending / received / cancelled, and materializes either
-- "a cuenta" (credits a cash/bank account) or "en resumen" (reduces a credit
-- card period total). See openspec/changes/add-reimbursements/design.md.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS linked_transaction_id uuid          NULL
    REFERENCES public.transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reimbursement_target  text          NULL,
  ADD COLUMN IF NOT EXISTS estimated_amount      numeric(18,2) NULL,
  ADD COLUMN IF NOT EXISTS received_at           timestamptz   NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz   NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CHECK constraints
-- ═══════════════════════════════════════════════════════════════════════════

-- subtype valid values
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_reimbursement_target_valid
    CHECK (reimbursement_target IS NULL OR reimbursement_target IN ('account', 'statement'));

-- a reimbursement cannot be received and cancelled at the same time
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_reimbursement_state
    CHECK (received_at IS NULL OR cancelled_at IS NULL);

-- reimbursement fields exist only (and are required) on reimbursement rows
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_reimbursement_fields
    CHECK (
      (
        type = 'reimbursement'
        AND linked_transaction_id IS NOT NULL
        AND reimbursement_target  IS NOT NULL
        AND estimated_amount      IS NOT NULL
      )
      OR
      (
        type <> 'reimbursement'
        AND linked_transaction_id IS NULL
        AND reimbursement_target  IS NULL
        AND estimated_amount      IS NULL
        AND received_at           IS NULL
        AND cancelled_at          IS NULL
      )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Index for category derivation / lookups by linked expense
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_transactions_linked
  ON public.transactions (linked_transaction_id)
  WHERE linked_transaction_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Trigger: reimbursement integrity
--    The existing card trigger (trg_fn_credit_transaction_invariants) already
--    permits a reimbursement on a credit account: it only enforces I-CRED-6 for
--    type='expense'; a reimbursement falls into its ELSE branch, which just
--    requires fx_rate_to_ars IS NULL (true for reimbursements). So no change to
--    that trigger is needed — reimbursement-specific rules live here instead.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_fn_reimbursement_invariants()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_linked_type         text;
  v_linked_user         uuid;
  v_linked_account      uuid;
  v_linked_is_parent    boolean;
  v_linked_account_type text;
BEGIN
  IF NEW.type::text <> 'reimbursement' THEN
    RETURN NEW;
  END IF;

  -- estimated_amount is immutable after creation
  IF TG_OP = 'UPDATE' AND NEW.estimated_amount IS DISTINCT FROM OLD.estimated_amount THEN
    RAISE EXCEPTION 'reimbursement.estimated_amount is immutable';
  END IF;

  -- linked transaction must exist, be an expense, and belong to the same user
  SELECT type::text, user_id, account_id, is_parent
    INTO v_linked_type, v_linked_user, v_linked_account, v_linked_is_parent
    FROM public.transactions
   WHERE id = NEW.linked_transaction_id;

  IF v_linked_type IS NULL THEN
    RAISE EXCEPTION 'reimbursement linked_transaction_id % not found', NEW.linked_transaction_id;
  END IF;
  IF v_linked_type <> 'expense' THEN
    RAISE EXCEPTION 'reimbursement must link to an expense, linked type is %', v_linked_type;
  END IF;
  IF v_linked_user <> NEW.user_id THEN
    RAISE EXCEPTION 'reimbursement must belong to the same user as the linked expense';
  END IF;

  -- statement reimbursements require the linked expense to be on a credit card
  -- (direct credit expense, or an installment parent whose children are on a card)
  IF NEW.reimbursement_target = 'statement' THEN
    IF v_linked_is_parent THEN
      SELECT a.type::text INTO v_linked_account_type
        FROM public.transactions c
        JOIN public.accounts a ON a.id = c.account_id
       WHERE c.parent_id = NEW.linked_transaction_id
       LIMIT 1;
    ELSIF v_linked_account IS NOT NULL THEN
      SELECT type::text INTO v_linked_account_type
        FROM public.accounts WHERE id = v_linked_account;
    END IF;

    IF v_linked_account_type IS DISTINCT FROM 'credit' THEN
      RAISE EXCEPTION
        'reimbursement_target=statement requires the linked expense to be on a credit card';
    END IF;

    -- once received, a statement reimbursement must be assigned to a period
    IF NEW.received_at IS NOT NULL AND NEW.card_period_id IS NULL THEN
      RAISE EXCEPTION 'received statement reimbursement must have card_period_id set';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reimbursement_invariants ON public.transactions;
CREATE TRIGGER trg_reimbursement_invariants
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reimbursement_invariants();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Retire the seeded "Reintegros / Cashback" income category
--    The reintegro is a movement type of its own and derives its category from
--    the origin expense, so this category contradicts the model. It is retired
--    (is_active=false), not deleted (ON DELETE RESTRICT + preserve history).
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.categories
   SET is_active = false
 WHERE user_id IS NULL
   AND canonical_name = 'reintegros-cashback';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok boolean;
BEGIN
  -- columns
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions'
     AND column_name IN ('linked_transaction_id','reimbursement_target',
                         'estimated_amount','received_at','cancelled_at')
   GROUP BY table_name HAVING COUNT(*) = 5;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: reimbursement columns missing'; END IF;

  -- constraints
  SELECT COUNT(*) = 3 INTO v_ok FROM information_schema.table_constraints
   WHERE table_schema = 'public' AND table_name = 'transactions'
     AND constraint_name IN ('chk_reimbursement_target_valid',
                             'chk_reimbursement_state','chk_reimbursement_fields');
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: reimbursement constraints missing'; END IF;

  -- trigger
  SELECT COUNT(*) = 1 INTO v_ok FROM pg_trigger
   WHERE tgname = 'trg_reimbursement_invariants' AND NOT tgisinternal;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: trg_reimbursement_invariants missing'; END IF;

  -- category retired
  SELECT is_active = false INTO v_ok FROM public.categories
   WHERE user_id IS NULL AND canonical_name = 'reintegros-cashback';
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: reintegros-cashback category not retired';
  END IF;

  RAISE NOTICE 'reimbursements migration validated: columns, constraints, trigger, category retired.';
END $$;

select '✓ 0018 reimbursements applied' as status;
