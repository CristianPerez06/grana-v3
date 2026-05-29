-- Custom recurrence frequency.
-- Generalises the four fixed frequencies (weekly/biweekly/monthly/annual) into a
-- single interval model: `interval_count` units of `interval_unit`. The named
-- frequencies become presets of this model so date generation has one path.
-- Adds an optional `max_occurrences` cap, complementary to `end_date`.

-- ============================================================================
-- 1. New columns on recurrences
-- ============================================================================

ALTER TABLE public.recurrences
  ADD COLUMN interval_count  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN interval_unit   TEXT    NOT NULL DEFAULT 'month',
  ADD COLUMN max_occurrences INTEGER NULL;

ALTER TABLE public.recurrences
  ADD CONSTRAINT chk_recurrences_interval_count_positive
    CHECK (interval_count >= 1),
  ADD CONSTRAINT chk_recurrences_interval_unit
    CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  ADD CONSTRAINT chk_recurrences_max_occurrences_positive
    CHECK (max_occurrences IS NULL OR max_occurrences >= 1);

-- ============================================================================
-- 2. Allow the 'custom' frequency label
-- ============================================================================

ALTER TABLE public.recurrences
  DROP CONSTRAINT chk_recurrences_frequency;

ALTER TABLE public.recurrences
  ADD CONSTRAINT chk_recurrences_frequency
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'annual', 'custom'));

-- ============================================================================
-- 3. Backfill existing rows to the interval equivalent of their preset
-- ============================================================================

UPDATE public.recurrences SET interval_count = 1, interval_unit = 'week'  WHERE frequency = 'weekly';
UPDATE public.recurrences SET interval_count = 2, interval_unit = 'week'  WHERE frequency = 'biweekly';
UPDATE public.recurrences SET interval_count = 1, interval_unit = 'month' WHERE frequency = 'monthly';
UPDATE public.recurrences SET interval_count = 1, interval_unit = 'year'  WHERE frequency = 'annual';

-- ============================================================================
-- 4. Self-check
-- ============================================================================

DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT COUNT(*) = 3 INTO v_ok
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'recurrences'
     AND column_name IN ('interval_count', 'interval_unit', 'max_occurrences');
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: recurrence interval columns missing'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_recurrences_frequency'
       AND pg_get_constraintdef(oid) LIKE '%custom%'
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: frequency check does not allow custom'; END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.recurrences
     WHERE (frequency = 'weekly'   AND (interval_count, interval_unit) <> (1, 'week'))
        OR (frequency = 'biweekly' AND (interval_count, interval_unit) <> (2, 'week'))
        OR (frequency = 'monthly'  AND (interval_count, interval_unit) <> (1, 'month'))
        OR (frequency = 'annual'   AND (interval_count, interval_unit) <> (1, 'year'))
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: preset rows not backfilled to matching interval'; END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: custom recurrence frequency schema verified successfully';
END $$;

SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recurrences'
      AND column_name IN ('interval_count', 'interval_unit', 'max_occurrences')) AS new_columns_present,
  (SELECT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recurrences_frequency'
      AND pg_get_constraintdef(oid) LIKE '%custom%')) AS frequency_allows_custom;
