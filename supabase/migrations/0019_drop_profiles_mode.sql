-- 0019_drop_profiles_mode.sql
--
-- Retira el flag de modo de usuario (`novato`/`experto`) de `public.profiles`.
-- Grana pasa a ser una sola app para todos: la profundidad la elige el usuario
-- creando o no más cuentas, no marcando un modo. El flag era solo-UI (no estaba
-- enforced en el server) y no esconde ningún diferencial del producto.
--
-- Ver el change OpenSpec `remove-user-modes`. El `DROP COLUMN` elimina también
-- su `CHECK (mode IN ('novato','experto'))`. Las otras columnas agregadas en la
-- migración 0012 (`financial_timezone`, `onboarding_completed_at`) se conservan.

alter table public.profiles
  drop column if exists mode;
