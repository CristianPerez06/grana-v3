## 1. Ramificación de asignación de período (`@grana/transactions-mutations`)

- [x] 1.1 En `packages/transactions-mutations/src/internal/card-periods.ts`, definir `CardConsumoInPaidPeriodError` (paralelo a `CardPurchasePredatesHistoryError`), llevando el rango (`start_date`, `end_date`) del resumen pagado que colisiona. (También `CardConsumoUnassignableError` para el caso de hueco.)
- [x] 1.2 Reescribir `getOrCreatePeriodForDate` con la ramificación explícita tras `assignTransactionToPeriod(...) === null`: (a) período **pagado** que cubre la fecha → `throw CardConsumoInPaidPeriodError`; (b) fecha `< oldest.start_date` → `throw CardPurchasePredatesHistoryError` (sin cambios); (c) fecha `> last.end_date` → crear período por rolling (sin cambios); (d) cualquier otra fecha no cubierta (hueco) → `throw CardConsumoUnassignableError`, **nunca** fabricar frontera.
- [x] 1.3 Garantizar el invariante: `insert` de un `card_periods` nuevo ocurre **solo** en la rama (c) (`targetDate > last.end_date`).
- [x] 1.4 Tests unitarios de `getOrCreatePeriodForDate` (mock client, estilo `predates-history.test.ts`): fecha en período no pagado (día de cierre incluido) → devuelve ese id; fecha en período **pagado** → lanza `CardConsumoInPaidPeriodError` y no inserta; fecha estrictamente posterior al último → crea período; fecha en un hueco → lanza `CardConsumoUnassignableError` sin insertar; fecha anterior al más viejo → `PredatesHistory`. → `__tests__/paid-period-assignment.test.ts`.

## 2. Superficie del rechazo en los orquestadores

- [x] 2.1 `register-card-purchase.ts`: capturar `CardConsumoInPaidPeriodError` y devolver `formError` explicativo. Eliminar el guard muerto `if (targetPeriod?.has_payment)` posterior a `getOrCreatePeriodForDate` (queda absorbido por el error tipado; se conserva el fetch solo para `due_date`).
- [x] 2.2 `register-installments.ts`: capturar `CardConsumoInPaidPeriodError` para la ruta de cuotas y devolver el mismo tipo de `formError`. El rechazo ocurre en el loop de asignación, antes de insertar madre o hijas. Se elimina el guard `paidPeriodIds` post-loop (inalcanzable); el fetch de `periods` se conserva para el `due_date` de cada hija.
- [x] 2.3 Verificar que `confirmRecurrenceInstance` (`packages/recurrences/src/mutations.ts`) propaga el `formError` del delegado `registerCardPurchase` hacia la UI de confirmación → confirmado (`mutations.ts:358-365` devuelve `delegated.formError`).
- [x] 2.4 Revisar `updateTransaction` (cambio de fecha): ya rechaza mover a un resumen pagado con su propio mensaje **antes** de llamar a `getOrCreatePeriodForDate` (`thin-mutations.ts:428-437`), así que el camino de edición queda consistente y no cae en la rama de rolling ni dispara el nuevo error para el caso pagado.

## 3. Copy e i18n

- [x] 3.1 Mensaje de "fecha en resumen pagado" como string literal en los orquestadores (mismo patrón que `CardPurchasePredatesHistoryError`), sin exponer nombres de columnas ni detalles técnicos. No requiere key de i18n nueva: los `formError` de estos orquestadores ya son literales.

## 4. Detección de data pre-existente (sin auto-reparación)

- [x] 4.1 Query de detección de consumos mal asignados documentada en `design.md` (sección "Query de detección"): transacción de tarjeta cuya `date` no cae en el rango de su `card_period_id` y existe un `card_periods` `paid` que sí la cubre.
- [ ] 4.2 (Operacional, post-deploy) Correr la detección y revisar con el dueño de cada cuenta. NO reasignar automáticamente. El consumo "Finquality" (`2026-06-25`, tx `5d2d26cb-02dc-4d58-8e72-ba769bfe0a01`) ya fue corregido manualmente.

## 5. Verificación

- [x] 5.1 `pnpm --filter @grana/transactions-mutations test` verde (36 tests, incl. los 5 nuevos). `pnpm --filter web typecheck` (`tsc --noEmit`) sin errores en el grafo completo. `pnpm openspec:check` OK.
- [ ] 5.2 (Operacional) Verificación manual en la app: consumo con fecha en resumen pagado → cartel y sin resumen futuro; fecha en resumen abierto (día de cierre incluido) → entra; fecha posterior al último resumen → roll-forward normal.
- [x] 5.3 Ningún test existente de cuotas / consumo / recurrencia se rompe por el cambio (`predates-history`, `register-installments`, `register-card-purchase`, `thin-mutations` verdes).
