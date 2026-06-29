-- 0046_card_stamp_tax_rate.sql
-- Impuesto de sellos por tarjeta: cada tarjeta de crédito recuerda su alícuota
-- de sellos (un ratio pequeño, p.ej. 0.001 = 0,1%, 0.012 = 1,2%), derivada del
-- monto que el banco cobró en un resumen dividido por el total del resumen.
-- NULL = todavía no conocida (se pregunta la primera vez al pagar).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Columna stamp_tax_rate en accounts
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stamp_tax_rate NUMERIC NULL;

-- La alícuota, cuando existe, es un ratio en (0, 1).
ALTER TABLE public.accounts
  ADD CONSTRAINT chk_stamp_tax_rate_range
    CHECK (stamp_tax_rate IS NULL OR (stamp_tax_rate > 0 AND stamp_tax_rate < 1));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Solo las tarjetas (type='credit') pueden llevar alícuota
--    Se reescribe el check existente para sumar stamp_tax_rate a la rama no-crédito.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS chk_credit_columns_only_for_credit;

ALTER TABLE public.accounts
  ADD CONSTRAINT chk_credit_columns_only_for_credit
    CHECK (
      type::text = 'credit' OR (
        credit_limit IS NULL
        AND network_id IS NULL
        AND other_network_name IS NULL
        AND stamp_tax_rate IS NULL
      )
    );
