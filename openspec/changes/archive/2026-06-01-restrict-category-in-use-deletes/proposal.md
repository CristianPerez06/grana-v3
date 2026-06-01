# Bloquear el borrado de categorías/subcategorías en uso

## Why

Borrar una categoría o subcategoría que todavía está referenciada destruía clasificación histórica en silencio. Los FK de `category_id`/`subcategory_id` en `transactions`, `recurrences` y `recurrence_instances` eran `ON DELETE SET NULL`, así que un hard delete dejaba movimientos y recurrencias sin clasificar. El guard de aplicación existía solo en web y solo miraba `transactions`; mobile borraba directo, sin ningún guard. En una app contable, la garantía de no perder historia no puede depender de que cada frontend recuerde consultar tres tablas.

## What Changes

- **DB como autoridad:** nueva migración `0026` que convierte a `ON DELETE RESTRICT` los 5 FK que eran `SET NULL` (`transactions.subcategory_id`, `recurrences.category_id`, `recurrences.subcategory_id`, `recurrence_instances.category_id`, `recurrence_instances.subcategory_id`). `transactions.category_id` ya era RESTRICT. El bloqueo aplica a todos los clientes (web, mobile, SQL manual, futuros) en un solo lugar.
- **Guards de aplicación (web + mobile):** antes de borrar, ambos consultan las tres tablas y, si la categoría/subcategoría está en uso, devuelven un mensaje accionable ("archivá en lugar de eliminar") en vez de un error de FK crudo. El FK queda como última barrera ante carreras o caminos no previstos.
- **Strings i18n (es/en):** `delete_in_use_category` y `delete_in_use_subcategory`.
- **Validador integral:** `supabase/validate_schema.sql` suma el check de que existan exactamente los 6 FK RESTRICT (sección 8.1G).

## Capabilities

### New Capabilities

(ninguna — el comportamiento ajusta la capacidad existente `categories`)

### Modified Capabilities

- `categories`: se MODIFICA el requisito de archivar/eliminar para definir "en uso" como referenciada en `transactions`, `recurrences` o `recurrence_instances`, y para fijar que la garantía está enforced en DB (`ON DELETE RESTRICT`) además del guard de aplicación.

## Impact

- Affected specs: `categories`.
- Affected code:
  - `supabase/migrations/0026_restrict_category_subcategory_deletes.sql` — nueva migración (RESTRICT + self-check de los 6 FK).
  - `supabase/validate_schema.sql` — nuevo bloque 8.1G.
  - `apps/web/app/_actions/categories.ts` — guard sobre las 3 tablas en `deleteCategory`/`deleteSubcategory`.
  - `apps/mobile/lib/categories.ts` — guard gemelo (mobile no tenía ninguno).
  - `packages/i18n-messages/src/{es,en}.json` — strings `delete_in_use_*`.
- La migración `0026` debe aplicarse manualmente en el SQL Editor de Supabase (online-only) antes de considerar activa la "última barrera".
- Tipos de Supabase: NO requieren regeneración — cambiar la acción `ON DELETE` de un FK no altera los tipos generados (solo cambian con columnas/nullability).
