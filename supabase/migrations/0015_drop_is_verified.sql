-- 0015_drop_is_verified.sql
--
-- Removes the dead `is_verified` column from `transactions`.
--
-- It was added in 0008 (inherited from grana-v2, where it meant "conciliado con
-- el banco" / bank-reconciled) but was never written or read by any code path:
-- no server action, query, mapper, component or filter ever touched it.
--
-- In v3 balance reconciliation is handled by the `adjustment` movement type, and
-- the "review states" spec requirement is fully derived (no persisted flag). The
-- column therefore backs no present or planned behavior. Keeping a dead column
-- contradicts "migrations are the schema truth" and misleads future readers into
-- believing a verification feature exists.
--
-- If manual verification/reconciliation is built later, re-add a boolean in its
-- own migration alongside the actual feature (UI + filter + action).

alter table public.transactions
  drop column is_verified;
