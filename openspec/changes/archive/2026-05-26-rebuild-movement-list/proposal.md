## Why

El listado de movimientos está **duplicado y ya divergido**. Hay dos componentes paralelos que renderizan lo mismo: `GlobalMovementList` (en `/transactions`, client, consume el union `FinancialMovement`) y `TransactionList` (en `/accounts/[id]`, server, consume `TransactionWithDetails` con su propia función `getRowMeta`). La lógica de "cómo se ve un movimiento" vive en dos lugares y ya empezó a desincronizarse: la lista de cuenta **no muestra** los review flags ni el indicador de recurrencia que la global sí muestra. Es un bug por omisión, y la divergencia solo va a crecer.

Además, la lista actual es **pobre de leer**: el ícono es el del *tipo* de movimiento (gris, genérico) en vez del emoji+color de la categoría que ya está seedeado en la base; el monto del gasto no tiene color (se ve igual que un movimiento neutro); el título primario es la categoría en vez de lo que el usuario escribió; no hay ningún resumen de cuánto entró/salió. Hoy `/transactions` no responde de un vistazo la pregunta básica "¿cómo vengo este mes?".

Es el momento de reconstruir: hay un `TODO` ya escrito en `packages/dashboard/src/aggregations.ts` que anticipa mover la lógica de sumas de transactions a un package compartido. Este change ejecuta ese plan y, de paso, viste la lista como corresponde.

## What Changes

**Reconstrucción (elimina la duplicación de raíz):**
- Nuevo resolver **puro** `resolveMovementView(tx, perspective)` en `@grana/money-logic`: concentra en un solo lugar la lógica de **perspectiva** (signo entrante/saliente, qué pata del `exchange` mostrar, contraparte). Reemplaza la lógica hoy duplicada en `getRowMeta` y en el mapper de `FinancialMovement`.
- Un solo componente de fila `MovementRow` y una sola lista `MovementList` (client) reemplazan a `GlobalMovementList` + `TransactionList`. **BREAKING** (interno): se eliminan los dos componentes actuales.
- **Perspectiva** como único parámetro que distingue las dos vistas: `global` (neutral, muestra ambas puntas de transfer/exchange y la cuenta en el subtítulo) y de cuenta (egocéntrica: reinterpreta signo/punta desde esa cuenta y oculta su propia cuenta). `/transactions` usa global; `/accounts/[id]` usa la de su cuenta. Mismo componente.

**Rediseño de la fila:**
- Ícono por **dos familias**: "categorizada" (income/expense/installment_purchase) muestra el emoji+color de la categoría (ya seedeado en `0006_seed_categories.sql`); "de estructura" (transfer/exchange/adjustment/card_payment) muestra ícono neutro gris.
- Jerarquía invertida: la **descripción del usuario** es el título; `categoría · cuenta` el subtítulo. Cae a la categoría si no hay descripción.
- **Color semántico** del monto: income verde; gastos (incl. tarjeta y cuotas) rojo; adjustment ±; transfer y exchange neutro.
- La **cuenta** en el subtítulo solo en modo experto.
- Etiqueta de moneda fiel a bimoneda: ARS sin etiqueta (primaria), USD etiquetada.
- Badge de cuota `3/6` y marcador **pendiente** nuevos; se **preservan** recurrencia (↻) y review flags (⚠).
- Fechas de grupo **relativas** (Hoy / Ayer / fecha).

**Resumen del período y saldos:**
- **El resumen del período NO se muestra en el listado**: duplicaría el panorama mensual del dashboard (decidido al verlo implementado, 2026-05-26). La lógica pura (`summarizePeriod`: entró/salió por moneda con la regla del dashboard + comprometido = cuotas devengadas) queda en `@grana/money-logic` lista para que el dashboard la consuma.
- Se **elimina el total-por-día**; el header de fecha queda solo con la fecha relativa (Hoy/Ayer).
- **Navegación por mes** ‹ › → se difiere al Change 2 (es un control de período = filtro).
- **Running balance** por fila en la vista de cuenta (por moneda, derivado, nunca persistido); se oculta cuando hay filtros activos. No aplica en la vista global.

## Capabilities

### Modified Capabilities
- `transactions`: cambia el comportamiento observable del **listado de movimientos** — anatomía de la fila (ícono de categoría, jerarquía, color semántico, etiqueta de moneda, marcadores, fechas relativas), resumen del período por moneda con "Comprometido en tarjetas", navegación por mes, y running balance por fila en la perspectiva de cuenta. La unificación de componentes y el resolver puro son implementación (van en design), no requisitos.

## Impact

- **`@grana/money-logic`**: nuevo `resolveMovementView(tx, perspective)` (puro, con tests); se **promueve** desde `apps/web/lib/transactions/balance.ts` la lógica de sumas (`calculateTransactionSums`) hoy duplicada en `@grana/dashboard` (resuelve el `TODO` de `aggregations.ts`). Nuevo cálculo de running balance por moneda (puro).
- **Web — componentes**: se eliminan `global-movement-list.tsx` y `transaction-list.tsx`; nacen `MovementRow` y `MovementList` (client) + un `PeriodSummary` (resumen por moneda). Páginas `/transactions/page.tsx` y `/accounts/[id]/page.tsx` pasan a renderizar `MovementList` con su perspectiva.
- **Web — datos**: las queries de listado deben proveer lo que la fila necesita (emoji+color de categoría, datos de cuota, estado pending/paid). El cálculo del running balance requiere traer los movimientos de la cuenta en orden cronológico ascendente por moneda.
- **i18n**: nuevas claves (Hoy/Ayer, "Entró"/"Salió"/"Comprometido en tarjetas", etiquetas de marcadores) en `@grana/i18n-messages`.
- **Sin migraciones de base**: es presentación + lógica derivada; no se persiste nada nuevo (respeta "derived balances, never persisted").
- **Sin cambios en mobile**: el tech lead maneja la paridad; el resolver puro queda disponible en `money-logic` para que mobile lo reúse sin re-duplicar.
- **Fuera de alcance** (changes posteriores ya explorados): filtros + búsqueda instantánea + filtro de moneda; form único crear/editar + colapso de rutas scoped; fricción (quick-add/FAB, detalle drawer, empty states de 3 variantes).
