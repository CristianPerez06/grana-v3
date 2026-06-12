-- ═══════════════════════════════════════════════════════════════════════════
-- 0031 — Renombrar la subcategoría de sistema "Nafta" → "Combustible"
--
-- A nivel general (sistema), no por usuario. El término "Combustible" es más
-- abarcativo (nafta, gasoil, GNC, eléctrico). El `canonical_name` es inmutable
-- (lo usa el autocategorizador y la clave i18n `subcategories.nafta`), así que
-- solo cambia el `name` legible. El display real de las subcategorías de
-- sistema viene de i18n (es.json: subcategories.nafta → "Combustible"); esta
-- migración alinea el `name` de la fila para que el dato crudo coincida.
--
-- Scope: solo la fila de SISTEMA (user_id is null). Las subcategorías que un
-- usuario haya creado por su cuenta no se tocan.
-- ═══════════════════════════════════════════════════════════════════════════

update subcategories
   set name = 'Combustible'
 where canonical_name = 'nafta'
   and user_id is null;
