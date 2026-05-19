-- Recurring movements module.
-- Recurrence instances are proposals, not ledger transactions.
-- IMPORTANT: do not reuse transactions.status; it remains reserved for credit-card summaries.

-- ============================================================================
-- 1. Recurrence rules
-- ============================================================================

CREATE TABLE public.recurrences (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_type                   TEXT        NOT NULL,
  account_id                      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  transfer_destination_account_id UUID        NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  currency_code                   TEXT        NOT NULL REFERENCES public.currencies(code),
  amount                          NUMERIC(18,2) NOT NULL,
  category_id                     UUID        NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id                  UUID        NULL REFERENCES public.subcategories(id) ON DELETE SET NULL,
  description                     TEXT        NULL,
  frequency                       TEXT        NOT NULL,
  start_date                      DATE        NOT NULL,
  end_date                        DATE        NULL,
  last_generated_date             DATE        NULL,
  status                          TEXT        NOT NULL DEFAULT 'active',
  created_from_transaction_id     UUID        NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_recurrences_movement_type
    CHECK (movement_type IN ('income', 'expense', 'transfer')),
  CONSTRAINT chk_recurrences_frequency
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'annual')),
  CONSTRAINT chk_recurrences_status
    CHECK (status IN ('active', 'paused', 'deleted')),
  CONSTRAINT chk_recurrences_amount_positive
    CHECK (amount > 0),
  CONSTRAINT chk_recurrences_end_after_start
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_recurrences_transfer_destination
    CHECK (
      (movement_type = 'transfer' AND transfer_destination_account_id IS NOT NULL) OR
      (movement_type <> 'transfer' AND transfer_destination_account_id IS NULL)
    ),
  CONSTRAINT chk_recurrences_transfer_different_accounts
    CHECK (
      movement_type <> 'transfer' OR account_id <> transfer_destination_account_id
    ),
  CONSTRAINT chk_recurrences_category_for_income_expense
    CHECK (
      movement_type = 'transfer' OR category_id IS NOT NULL
    )
);

CREATE INDEX idx_recurrences_user_status
  ON public.recurrences (user_id, status);

CREATE INDEX idx_recurrences_user_next
  ON public.recurrences (user_id, status, last_generated_date, start_date);

CREATE INDEX idx_recurrences_account
  ON public.recurrences (account_id);

CREATE INDEX idx_recurrences_created_from_transaction
  ON public.recurrences (created_from_transaction_id)
  WHERE created_from_transaction_id IS NOT NULL;

ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own recurrences"
  ON public.recurrences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own recurrences"
  ON public.recurrences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own recurrences"
  ON public.recurrences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own recurrences"
  ON public.recurrences FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 2. Recurrence instances
-- ============================================================================

CREATE TABLE public.recurrence_instances (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id                   UUID        NOT NULL REFERENCES public.recurrences(id) ON DELETE CASCADE,
  user_id                         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date                  DATE        NOT NULL,
  status                          TEXT        NOT NULL DEFAULT 'pending',
  amount                          NUMERIC(18,2) NOT NULL,
  account_id                      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  transfer_destination_account_id UUID        NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  currency_code                   TEXT        NOT NULL REFERENCES public.currencies(code),
  category_id                     UUID        NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id                  UUID        NULL REFERENCES public.subcategories(id) ON DELETE SET NULL,
  description                     TEXT        NULL,
  confirmed_transaction_id        UUID        NULL REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at                     TIMESTAMPTZ NULL,

  CONSTRAINT chk_recurrence_instances_status
    CHECK (status IN ('pending', 'skipped', 'confirmed')),
  CONSTRAINT chk_recurrence_instances_amount_positive
    CHECK (amount > 0),
  CONSTRAINT chk_recurrence_instances_pending_unresolved
    CHECK (
      (status = 'pending' AND resolved_at IS NULL AND confirmed_transaction_id IS NULL) OR
      (status = 'skipped' AND resolved_at IS NOT NULL AND confirmed_transaction_id IS NULL) OR
      (status = 'confirmed' AND resolved_at IS NOT NULL AND confirmed_transaction_id IS NOT NULL)
    ),
  CONSTRAINT chk_recurrence_instances_transfer_different_accounts
    CHECK (
      transfer_destination_account_id IS NULL OR
      account_id <> transfer_destination_account_id
    )
);

CREATE UNIQUE INDEX recurrence_instances_one_pending_per_rule
  ON public.recurrence_instances (recurrence_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX recurrence_instances_confirmed_transaction_unique
  ON public.recurrence_instances (confirmed_transaction_id)
  WHERE confirmed_transaction_id IS NOT NULL;

CREATE INDEX idx_recurrence_instances_user_status_date
  ON public.recurrence_instances (user_id, status, scheduled_date);

CREATE INDEX idx_recurrence_instances_recurrence
  ON public.recurrence_instances (recurrence_id, scheduled_date);

ALTER TABLE public.recurrence_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own recurrence_instances"
  ON public.recurrence_instances FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own recurrence_instances"
  ON public.recurrence_instances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own recurrence_instances"
  ON public.recurrence_instances FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own recurrence_instances"
  ON public.recurrence_instances FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. Suggestion dismissals
-- ============================================================================

CREATE TABLE public.recurrence_suggestion_dismissals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT        NOT NULL,
  reason      TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, fingerprint)
);

ALTER TABLE public.recurrence_suggestion_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own recurrence_suggestion_dismissals"
  ON public.recurrence_suggestion_dismissals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own recurrence_suggestion_dismissals"
  ON public.recurrence_suggestion_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own recurrence_suggestion_dismissals"
  ON public.recurrence_suggestion_dismissals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own recurrence_suggestion_dismissals"
  ON public.recurrence_suggestion_dismissals FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. Self-check
-- ============================================================================

DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'recurrences'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrences table missing'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'recurrence_instances'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrence_instances table missing'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'recurrence_suggestion_dismissals'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrence_suggestion_dismissals table missing'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'recurrence_instances'
       AND indexname = 'recurrence_instances_one_pending_per_rule'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: one pending recurrence instance index missing'; END IF;

  SELECT COUNT(*) = 12 INTO v_ok
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'recurrences',
       'recurrence_instances',
       'recurrence_suggestion_dismissals'
     );
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: expected 12 recurrence RLS policies'; END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: recurring movements schema verified successfully';
END $$;

SELECT
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recurrences')) AS recurrences_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recurrence_instances')) AS recurrence_instances_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recurrence_suggestion_dismissals')) AS suggestion_dismissals_ok,
  (SELECT EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'recurrence_instances'
      AND indexname = 'recurrence_instances_one_pending_per_rule')) AS one_pending_index_ok;
