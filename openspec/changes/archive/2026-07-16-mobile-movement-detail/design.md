# Design — mobile-movement-detail

## Contexto

Web tiene un detalle de movimiento rico (`apps/web/app/(app)/transactions/[txId]/`): un RSC que dispara ~8 reads y pinta un hero tonal + tiles "de un vistazo" por tipo (16 componentes `detail/*`). Casi toda la lógica de display ya es shared (`toFinancialMovement`, `resolveMovementView`, `Tone`, `getEditableFields`, `TRANSACTION_SELECT`, `attachLinkedExpenses`) y las keys `transactions.detail.*` ya están en `@grana/i18n-messages`. Lo único web-only es el **I/O de los reads** (tipados `DbClient`, RSC-only). Este change extrae los reads del **grafo de la transacción** y pinta una versión mobile read-only. La edición es C.2.

## Decisión 1 — Qué se extrae vs. qué se difiere

Se extraen sólo los reads que alimentan el **detalle propio del movimiento** (su grafo directo), no los de contexto:

| Read | C.1 | Por qué |
|---|---|---|
| `getTransactionDetail` | **extraer** | el movimiento + gasto vinculado; núcleo del detalle |
| `getInstallmentFamily` | **extraer** | madre + cuotas hermanas (tile de progreso) |
| `getReimbursementsForExpense` | **extraer** | reintegros vinculados (tile reintegro-neto) |
| `getMovementSharedInfo` | **mirror thin** en mobile | read del dominio Hogar; se espeja (no se extrae) hasta que aterrice el módulo Hogar |
| `getMonthCategoryBreakdown/IncomeBreakdown` | diferir | tile "Peso en el mes" — contexto del mes, no del movimiento |
| `getRecurrenceLink/Detail` | diferir | tile + banner de recurrencia |
| `getCardPeriodDetail` | diferir | composición de pago de resumen (kind nicho) |

Los reads extraídos pasan de `DbClient` (web) a `GranaSupabaseClient` (`@grana/supabase`) — la misma abstracción que usó la extracción del feed (`getGlobalMovementsPage`). El `select`/enrich ya vive en el package (`TRANSACTION_SELECT`, `attachLinkedExpenses`), así que extraer es mover el wrapper de query, no reescribir la forma.

## Decisión 2 — Web consume desde el package (una sola implementación)

Como con el feed y las mutations, web deja de tener su propia copia: `apps/web/lib/transactions/queries.ts` re-exporta (o borra) `getTransactionDetail`/`getInstallmentFamily`/`getReimbursementsForExpense` y la página los importa de `@grana/transactions`. Evita divergencia y mantiene los 466 tests web como red de seguridad de que el comportamiento no cambió.

## Decisión 3 — Detalle mobile: hero tonal + tiles core, RN-idiomático

Se replica la **anatomía** web (topbar / hero / grilla de tiles) con primitivos nativos, no el HTML:
- **Topbar**: `PageHeader` nativo con back que resuelve `?from=` (account/card/feed) — chrome visible desde el primer paint.
- **Hero**: card con banda tonal por tipo (`Tone` shared → color mobile), ícono de categoría, monto grande con signo (`−`/`+`/sin signo) y símbolo de moneda opaco, línea de contexto, y chips (fecha · medio · categoría · subcategoría).
- **Tiles core** (una columna, mobile): medio de pago, progreso de cuotas (barra pagadas/restantes), flujo transferencia/cambio + callout "no cuenta como gasto ni ingreso", reintegro-neto (pagaste + reintegro = neto, con el gasto vinculado **tappable** al detalle), reparto compartido ("Te toca pagar" + "Dividido entre"), descripción.
- **Tono/valores** salen de `resolveMovementView` + `Tone` (shared con web); los labels de `transactions.detail.*`. Cero i18n nuevo.

Los tiles diferidos (peso en el mes, recurrencia, composición de resumen) simplemente **no se renderizan** — la pantalla degrada sin romper para esos kinds.

## Decisión 4 — Filas navegables: prop de navegación, no `Link` en la fila

`MovementRow` nativo es hoy explícitamente no-navegable (lo dice su doc). Se agrega un prop opcional (`onPress`/handler por movimiento) que `MovementList` enhebra hacia cada fila; **la tab Movimientos** lo cablea para empujar `/transactions/[txId]?from=…`. Mantener la navegación en el caller (no un `Link` embebido) es el idiom RN y deja al `MovementRow` reutilizable por los panes que todavía lo quieren flat (account-detail, card-period) — esos adoptan el prop en un follow-up.

## Decisión 5 — Read cross-user, sin gate de edición

El detalle es **legible cross-user** (un movimiento compartido lo ven los dos miembros del hogar; el RLS ya lo permite). C.1 no toca edición, así que no hay gate `canManage` acá — eso es de C.2. El read mobile sólo hace fetch por id con el mismo anon-key/RLS path que web.

## Riesgos / notas

- **Sin tests nuevos de negocio**: los reads extraídos preservan comportamiento (cubiertos por los tests web al re-apuntarlos al package); el display ya está cubierto por los VMs shared. Verificación = typecheck (web+mobile), `pnpm --filter web test` verde, lint, y smoke en device.
- **`getMovementSharedInfo` espejado**: se acepta una segunda copia thin en mobile (como el household read) para no abrir la extracción del dominio Hogar en este change.
- **C.2** reusará el edit-context (extracción/mirror de `buildMovementEditContext` + `getEditableFields` ya shared) sobre esta misma pantalla (agrega la barra inferior de Editar + el menú ··· con Eliminar).
