-- Shared recurrences: a recurrence rule of type 'expense' can belong to a
-- household and carry a per-member split, so its generated movements are shared.
--
-- The split travels rule.default_split -> instance.split -> the confirmed
-- transaction's shared_expense_split rows (reusing the existing shared-expense
-- creation path). Stored as jsonb [{ "user_id": uuid, "percentage": int }],
-- mirroring household.default_split (the established precedent for splits without
-- a dedicated table). Validation that user_ids are members and percentages sum
-- to 100 lives in TS (sharedExpenseSchema), same guarantee as a manual shared
-- expense.
--
-- Base caja: a pending instance does NOT generate debt; the split materializes
-- only at confirmation. All columns are nullable and additive — pre-existing
-- rules/instances were never shared, so no backfill is needed.

-- ============================================================================
-- 1. recurrences: household + default split (the template)
-- ============================================================================

ALTER TABLE public.recurrences
  ADD COLUMN IF NOT EXISTS household_id  UUID  NULL REFERENCES public.household(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_split JSONB NULL;

-- A shared rule must carry its split template; a non-shared rule must not.
ALTER TABLE public.recurrences
  ADD CONSTRAINT chk_recurrences_shared_has_split
    CHECK (
      (household_id IS NULL     AND default_split IS NULL) OR
      (household_id IS NOT NULL AND default_split IS NOT NULL)
    );

-- Only expense rules can be shared (income/transfer are out of scope).
ALTER TABLE public.recurrences
  ADD CONSTRAINT chk_recurrences_shared_expense_only
    CHECK (household_id IS NULL OR movement_type = 'expense');

CREATE INDEX idx_recurrences_household
  ON public.recurrences (household_id)
  WHERE household_id IS NOT NULL;

-- ============================================================================
-- 2. recurrence_instances: household + split snapshot (overridable per instance)
-- ============================================================================

ALTER TABLE public.recurrence_instances
  ADD COLUMN IF NOT EXISTS household_id UUID  NULL REFERENCES public.household(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split        JSONB NULL;

ALTER TABLE public.recurrence_instances
  ADD CONSTRAINT chk_recurrence_instances_shared_has_split
    CHECK (
      (household_id IS NULL     AND split IS NULL) OR
      (household_id IS NOT NULL AND split IS NOT NULL)
    );

-- ============================================================================
-- 3. Self-check
-- ============================================================================

DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT COUNT(*) = 2 INTO v_ok
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'recurrences'
     AND column_name IN ('household_id', 'default_split');
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrences shared columns missing'; END IF;

  SELECT COUNT(*) = 2 INTO v_ok
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'recurrence_instances'
     AND column_name IN ('household_id', 'split');
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrence_instances shared columns missing'; END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: shared recurrences schema verified successfully';
END $$;
