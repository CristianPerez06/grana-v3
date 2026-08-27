# Proposal: unify-movement-search-fields

## Why

Grana ofrece búsqueda de movimientos en tres superficies, y cada una matchea un set de campos distinto: la misma query devuelve resultados distintos en `/transactions` que en `/accounts/[id]`, y distintos otra vez en el detalle de cuenta nativo. No es una diferencia de matices —el feed global no alcanza subcategorías, el detalle nativo no alcanza el título derivado— y **ninguna de las tres alcanza la institución de la cuenta**, que es el texto más prominente de la cuenta en la fila: `movement-row.tsx:123-124` renderiza `institutionName?.trim() || name`, así que el usuario lee "Galicia", tipea "Galicia" y no encuentra nada.

La spec vigente ya pide lo contrario. `openspec/specs/transactions/spec.md:338` dice que el sistema filtra "los movimientos cuya **descripción o texto visible** coincida"; la implementación cumple la primera mitad. La divergencia entre superficies incluso quedó escrita como comportamiento esperado (`spec.md:3453`, `movement-filters.ts:62-68`) — este change la cierra y actualiza esas dos declaraciones.

Cierra el issue [#78](https://github.com/CristianPerez06/grana-v3/issues/78).

## What Changes

**Un solo set de campos buscables, idéntico en las tres superficies.** Dentro:

1. `title` derivado (categoría en ingreso/gasto, "Transferencia", "Pago de resumen"…)
2. `description` efectiva (el reintegro hereda la del gasto vinculado)
3. Nombre de la cuenta origen
4. **Institución de la cuenta origen** — nuevo, y el hueco que más se nota
5. Nombre de la cuenta destino, en `transfer` **y** `exchange`
6. **Institución de la cuenta destino** — nuevo, mismas dos kinds

**Categoría y subcategoría NO entran como eje explícito**, y esto es un recorte deliberado respecto de lo que proponía el issue. Dos razones. La primera: tienen filtro dedicado y preciso (`categoryId` / `subcategoryId`), así que llegar a ellas tipeando texto libre es el peor de los dos caminos disponibles. La segunda, y la que decide: **la categoría ya entra por `title`** en ingresos y gastos, que son la abrumadora mayoría de los movimientos —`coalesce(c.name, 'Ingreso')` / `coalesce(c.name, 'Gasto')` en la RPC, espejado en `movements.ts:303-318`—, y la fila renderiza `description ?? categoría` como línea principal (`movement-row.tsx:115-118`). O sea: en un gasto sin descripción, la categoría **es** el título, y buscarla ya funciona. Agregarla como eje separado sólo cambiaría algo en `transfer` / `exchange` / `card_payment` / `adjustment`, donde el título es una etiqueta fija y la categoría casi nunca es lo que el usuario está buscando.

Afuera, también a propósito:

- **Monto y fecha**: tienen filtros dedicados (`amountMin`/`amountMax`, mes/rango). Matchearlos como texto obligaría a normalizar formato (`1.234,56` vs `1234.56`) sin agregar nada sobre el filtro que ya existe.
- **`canonical_name`** de las categorías del sistema: es un slug interno, no texto visible. El matcher nativo hoy lo matchea; sacarlo unifica.
- **Acentos**: `ilike` y `toLocaleLowerCase` son ambos sensibles a diacríticos, así que "cafe" no encuentra "Café". Es otro eje —este change discute *qué campos* entran, ese discute *cómo se comparan*— y del lado SQL arrastra la extensión `unaccent` con su propia decisión sobre índices. Sale como [#87](https://github.com/CristianPerez06/grana-v3/issues/87).

**Un solo matcher en TypeScript, no dos alineados a mano.** Hoy hay tres implementaciones del match: el `ilike` de la RPC, `movementMatchesText` en `@grana/transactions` (detalle de cuenta web) y un duplicado nativo en `apps/mobile/lib/accounts/movement-filters.ts:69` que corre sobre `TransactionWithDetails`. El duplicado nativo **se borra**: es exactamente el patrón "mirror … keep in sync" que AGENTS.md prohíbe, y no hace falta, porque `applyAccountFilters` ya deriva `toFinancialMovement(tx)` por fila para armar el `kindById` (`MovementsSection.tsx:72-77`) y `FinancialMovement` ya trae institución, categoría y subcategoría aplanadas. Quedan dos implementaciones —SQL y TS—, que es el mínimo posible: la RPC filtra en la base porque el feed pagina, y filtrar la página en memoria respondería otra pregunta.

**Migración nueva de `get_movements_page`.** El `concat_ws` de la cláusula `ilike` suma `sai.name` y `dai.name`, y el destino pierde su `case when calc.kind = 'transfer'`. Los joins a `institutions` ya están en la query; no hace falta ninguno nuevo. El escapeo literal del patrón se preserva: `%` y `_` tipeados por el usuario siguen siendo texto.

**Un límite conocido queda enunciado, no resuelto.** El match corre sobre el texto subyacente. Con `locale = 'en'`, las categorías del sistema (guardadas en español, renderizadas traducidas vía `translateCategoryLabel`) y el label de tipo de la fila (`t(typeLabelKey[kind])`, que no es el `title` de la RPC) no matchean por su etiqueta traducida. Ya pasa hoy y este change no lo mueve; se escribe para que no se descubra dos veces.

## Capabilities

### New Capabilities

Ninguna. El change modifica requirements existentes.

### Modified Capabilities

- `transactions`: el set de campos buscables pasa a estar enunciado explícitamente y a ser el mismo en las tres superficies. Deroga la divergencia que hoy la spec declara esperada (feed global sin categorías vs. detalle de cuenta con ellas).
- `accounts`: el requirement del toolbar de movimientos del detalle nativo especifica hoy que el match es "un paso nativo puro sobre `TransactionWithDetails` (análogo de `movementMatchesText` del web, que son web-only sobre otro modelo)". Pasa a consumir el matcher compartido sobre `FinancialMovement`.

## Impact

**Base de datos**

- `supabase/migrations/0057_get_movements_page_search_fields.sql` — nueva. `CREATE OR REPLACE` de `get_movements_page` basado en el cuerpo vigente, que está en `0042_get_movements_page_exclude_shared.sql` (no en `0039`, que es lo que apunta el issue; `0055` sólo re-otorga grants). Cambia únicamente la cláusula `ilike` del `where`.

**Paquetes**

- `packages/transactions/src/filters.ts` — `movementMatchesText` suma las dos instituciones y deja de condicionar el destino a `kind === 'transfer'`. Es la declaración canónica del set; el SQL la referencia por comentario.

**Mobile**

- `apps/mobile/lib/accounts/movement-filters.ts` — se borra el `movementMatchesText` local. `applyAccountFilters` recibe un `Map<string, FinancialMovement>` en lugar del `Map<string, MovementTypeFilter>`. El comentario de divergencia (líneas 62-68) se reescribe: ya no divergen en campos, sólo en dónde corre el filtro.
- `apps/mobile/components/accounts/MovementsSection.tsx` — el memo que arma `kindById` pasa a guardar el `FinancialMovement` completo, que ya calcula.

**Tests**

- `apps/web/lib/transactions/__tests__/filters.test.ts` — casos nuevos: institución origen, institución destino, destino en `exchange`, y la contracara (categoría y subcategoría explícitas NO matchean).

**Sin impacto**

- El copy del placeholder (`search_placeholder`: "Descripción, cuenta o texto visible") sigue describiendo bien el comportamiento.
- Ningún contrato de filtros cambia: `MovementFilters.query` sigue siendo un string libre.
- RLS, grants y forma de la respuesta de la RPC quedan intactos.
