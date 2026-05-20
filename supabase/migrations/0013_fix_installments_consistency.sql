-- 0013_fix_installments_consistency.sql
-- Fix: la constraint chk_installment_fields_consistent agregada en 0010
-- rechazaba el INSERT de la fila madre (is_parent=true) de una compra en
-- cuotas, porque la madre lleva installments_total = N pero installment_n
-- NULL (no representa una cuota específica).
--
-- La constraint original (0010_credit_cards.sql:180-182) era:
--   CHECK ((installment_n IS NULL) = (installments_total IS NULL))
--
-- Se reemplaza por una versión que permite tres casos válidos:
--   1. Ambas NULL → transacción normal sin cuotas
--   2. Ambas NOT NULL → fila hija (cuota individual)
--   3. is_parent=true + installment_n NULL + installments_total NOT NULL
--      → fila madre off-ledger
--
-- Síntoma reproducido por el usuario al registrar una compra en cuotas
-- desde la UI:
--   new row for relation "transactions" violates check constraint
--   "chk_installment_fields_consistent"

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Drop old constraint
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS chk_installment_fields_consistent;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Add relaxed constraint
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD CONSTRAINT chk_installment_fields_consistent
    CHECK (
      -- Caso 1: transacción normal sin info de cuotas
      (installment_n IS NULL AND installments_total IS NULL)
      OR
      -- Caso 2: fila hija con ambos campos seteados y coherentes
      (
        installment_n IS NOT NULL
        AND installments_total IS NOT NULL
        AND installment_n >= 1
        AND installment_n <= installments_total
      )
      OR
      -- Caso 3: fila madre off-ledger (lleva total pero no n)
      (
        is_parent = true
        AND installment_n IS NULL
        AND installments_total IS NOT NULL
        AND installments_total >= 1
      )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Self-check: constraint instalada
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_installment_fields_consistent'
       AND conrelid = 'public.transactions'::regclass
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: chk_installment_fields_consistent not installed';
  END IF;

  RAISE NOTICE 'SELF-CHECK PASSED: chk_installment_fields_consistent updated successfully';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Summary
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_installment_fields_consistent'
       AND conrelid = 'public.transactions'::regclass
  ) AS chk_installment_fields_consistent_ok;
