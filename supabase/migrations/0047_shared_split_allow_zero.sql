-- 0047_shared_split_allow_zero.sql
-- Permitir que un miembro tenga 0% en el split de un gasto compartido: modela el
-- caso "lo pagué yo, pero corresponde 100% al otro" (el pagador adelanta un gasto
-- que es enteramente del otro miembro). La suma de porcentajes sigue siendo 100 y
-- la app sigue listando a ambos miembros; solo se relaja el piso por miembro.
--
-- Antes: chk_split_percentage check (percentage between 1 and 100)
-- Ahora: chk_split_percentage check (percentage between 0 and 100)

ALTER TABLE public.shared_expense_split
  DROP CONSTRAINT IF EXISTS chk_split_percentage;

ALTER TABLE public.shared_expense_split
  ADD CONSTRAINT chk_split_percentage CHECK (percentage BETWEEN 0 AND 100);
