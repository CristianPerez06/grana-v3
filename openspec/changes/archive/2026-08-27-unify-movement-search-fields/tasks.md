# Tasks: unify-movement-search-fields

## 1. El matcher compartido (declaración canónica del set)

- [x] 1.1 En `packages/transactions/src/filters.ts:79`, extender el haystack de `movementMatchesText` con `account_institution_name` y `destination_account_institution_name`, y reemplazar `movement.kind === 'transfer' ? movement.destination_account_name : null` por el acceso incondicional al destino (los kinds sin destino lo traen `null` y el `.filter(Boolean)` ya los descarta).
- [x] 1.2 Reescribir el docblock de la función para que enumere el set canónico completo, diga qué queda afuera y por qué (categoría/subcategoría tienen filtro dedicado; la categoría ya entra vía `title` en ingreso/gasto), y advierta que la RPC `get_movements_page` mantiene el mismo set en SQL.

## 2. La RPC

- [x] 2.1 Confirmar el número de migración libre (`ls supabase/migrations | tail`, más `gh pr list` por si una rama abierta ya lo ocupa) y crear `supabase/migrations/0057_get_movements_page_search_fields.sql` como `CREATE OR REPLACE` de `get_movements_page` partiendo del cuerpo de `0042_get_movements_page_exclude_shared.sql` — **no** del de `0039`, que está desactualizado.
- [x] 2.2 En la cláusula de texto del `where` (`0042:167-173`), sumar `sai.name` y `dai.name` al `concat_ws` y quitar el `case when calc.kind = 'transfer'` que envuelve `da.name`. Verificar que el resto de la función quede byte a byte igual a `0042`: el diff debe tocar sólo esas líneas.
- [x] 2.3 Encabezar la migración con el comentario de bloque del repo, explicando el cambio y apuntando a `packages/transactions/src/filters.ts` como declaración canónica del set.
- [x] 2.4 Verificar que el escapeo literal del patrón (`0042:34-40`) sigue intacto y que el `DO $$` de self-check de `SECURITY INVOKER` viaja en la migración nueva.

## 3. Mobile — borrar el matcher duplicado

- [x] 3.1 En `apps/mobile/components/accounts/MovementsSection.tsx:72-77`, cambiar el memo `kindById` por un `movementById: Map<string, FinancialMovement>` que guarde el `toFinancialMovement(tx)` completo (misma pasada, mismo momento). Renombrar la variable y ajustar el comentario que explica por qué se deriva una sola vez por carga.
- [x] 3.2 En `apps/mobile/lib/accounts/movement-filters.ts`, borrar el `movementMatchesText` local (líneas 62-83) y cambiar la firma de `applyAccountFilters` a `(movements, filters, movementById: Map<string, FinancialMovement>)`. El eje de tipo pasa a leer `movementById.get(tx.id)?.kind`; el match de búsqueda llama al `movementMatchesText` de `@grana/transactions` con el `FinancialMovement` de esa fila.
- [x] 3.3 Reescribir el comentario de divergencia (líneas 62-68): las superficies ya no difieren en **qué** campos matchean, sólo en **dónde** corre el filtro (base en el feed porque pagina, memoria en el detalle porque tiene el historial completo). Mantener la advertencia de no "arreglar" el feed filtrando su página en memoria.
- [x] 3.4 Limpiar los imports que quedan colgando en ambos archivos (`TransactionWithDetails` puede seguir usándose por otras firmas; `MovementTypeFilter` probablemente ya no).

## 4. Tests

- [x] 4.1 En `apps/web/lib/transactions/__tests__/filters.test.ts`, poblar el fixture de `transfer` con `account_institution_name` y `destination_account_institution_name` (hoy están en `null`) y agregar casos de que ambas matchean.
- [x] 4.2 Agregar un fixture de `exchange` y verificar que su cuenta destino y la institución de su cuenta destino matchean — es la regresión concreta que el `case when kind = 'transfer'` causaba.
- [x] 4.3 Agregar un fixture de gasto **sin descripción**, con categoría, subcategoría e institución: verificar que matchea por su `title` (que es el nombre de la categoría), por el nombre de cuenta y por la institución.
- [x] 4.4 Agregar los casos de borde de abajo: buscar el nombre de la **subcategoría** NO matchea, y buscar el `canonical_name` NO matchea. Sin estos, un cambio futuro que reintroduzca el set ancho pasa el test suite entero.
- [x] 4.5 Correr `pnpm --filter web test` y dejarlo en verde.

## 5. Specs y cierre

- [x] 5.1 Correr `pnpm --filter web lint` y `pnpm --filter web typecheck`.
- [x] 5.2 Correr `pnpm --filter mobile typecheck` y `pnpm --filter mobile lint` — el cambio de firma del `Map` es lo que detecta un caller sin actualizar.
- [x] 5.3 Verificación manual del invariante que hoy se rompe: cargar un gasto sin descripción, con categoría, subcategoría e institución; buscar cada uno de esos términos en `/transactions` y en `/accounts/[id]`; confirmar que institución y categoría lo devuelven en las dos superficies y que subcategoría no lo devuelve en ninguna.
- [x] 5.4 Verificación manual del escapeo: buscar `%` y `_` sigue matcheando literal, no como comodín.
- [ ] 5.5 Archivar el change en la rama antes del merge: mover a `openspec/changes/archive/YYYY-MM-DD-unify-movement-search-fields/`, aplicar las deltas de `transactions` y `accounts` a sus master specs (sin dejar secciones `## ADDED` / `## MODIFIED`), y correr `pnpm openspec:check`.
