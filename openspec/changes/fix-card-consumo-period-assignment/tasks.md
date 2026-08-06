## 1. Ramificación de asignación de período (`@grana/transactions-mutations`)

- [ ] 1.1 En `packages/transactions-mutations/src/internal/card-periods.ts`, definir `CardConsumoInPaidPeriodError` (paralelo a `CardPurchasePredatesHistoryError`), llevando el rango (`start_date`, `end_date`) del resumen pagado que colisiona.
- [ ] 1.2 Reescribir `getOrCreatePeriodForDate` con la ramificación explícita tras `assignTransactionToPeriod(...) === null`: (a) período **pagado** que cubre la fecha → `throw CardConsumoInPaidPeriodError`; (b) fecha `< oldest.start_date` → `throw CardPurchasePredatesHistoryError` (sin cambios); (c) fecha `> last.end_date` → crear período por rolling (sin cambios); (d) cualquier otra fecha no cubierta (hueco) → rechazar, **nunca** fabricar frontera.
- [ ] 1.3 Garantizar el invariante: `insert` de un `card_periods` nuevo ocurre **solo** en la rama (c) (`targetDate > last.end_date`).
- [ ] 1.4 Tests unitarios de `getOrCreatePeriodForDate` (mock client, estilo `predates-history.test.ts`): fecha en período no pagado → devuelve ese id; fecha en período **pagado** → lanza `CardConsumoInPaidPeriodError` y no inserta; fecha en el **día de cierre** de un período abierto → devuelve ese id; fecha estrictamente posterior al último → crea período; fecha en un hueco (no cubierta, no futura) → rechaza sin insertar; fecha anterior al más viejo → `PredatesHistory`.

## 2. Superficie del rechazo en los orquestadores

- [ ] 2.1 `register-card-purchase.ts`: capturar `CardConsumoInPaidPeriodError` y devolver `formError` explicativo ("La fecha del consumo cae en un resumen ya pagado. Elegí otra fecha."). Eliminar el guard muerto `if (targetPeriod?.has_payment)` posterior a `getOrCreatePeriodForDate` (queda absorbido por el error tipado).
- [ ] 2.2 `register-installments.ts`: capturar `CardConsumoInPaidPeriodError` para la ruta de cuotas y devolver el mismo `formError`, garantizando que no se insertó ni madre ni hijas (rollback / orden de operaciones).
- [ ] 2.3 Verificar que `confirmRecurrenceInstance` (`packages/recurrences/src/mutations.ts`) propaga el `formError` del delegado `registerCardPurchase` hacia la UI de confirmación (hoy ya lo hace vía `delegated.formError`).
- [ ] 2.4 Revisar `updateTransaction` (cambio de fecha): ya rechaza mover a un resumen pagado con su propio mensaje; confirmar que sigue consistente y que no cae en la rama de rolling tras el cambio.

## 3. Copy e i18n

- [ ] 3.1 Estandarizar el mensaje de "fecha en resumen pagado" en `packages/i18n-messages` (es) si se comparte entre consumo simple, cuotas y confirmación de recurrencia, sin exponer nombres de columnas ni detalles técnicos.

## 4. Detección de data pre-existente (sin auto-reparación)

- [ ] 4.1 Documentar en `docs/qa/` (o en el propio change) la query de detección de consumos mal asignados: transacción de tarjeta (`account.type='credit'`, `is_parent=false`) cuya `date` **no** cae en el rango de su `card_period_id` y existe un `card_periods` `paid` que sí la cubre.
- [ ] 4.2 Correr la detección post-deploy y revisar con el dueño de cada cuenta. NO reasignar automáticamente. Registrar que el consumo "Finquality" (`2026-06-25`, tx `5d2d26cb-02dc-4d58-8e72-ba769bfe0a01`) ya fue corregido manualmente.

## 5. Verificación

- [ ] 5.1 `pnpm test` en `@grana/transactions-mutations` y `@grana/recurrences` verdes.
- [ ] 5.2 Verificación manual del caso real: intentar cargar un consumo con fecha dentro de un resumen pagado → aparece el cartel y no se crea un resumen futuro; cargar uno con fecha en un resumen abierto (día de cierre incluido) → entra; cargar uno con fecha posterior al último resumen → roll-forward normal.
- [ ] 5.3 Confirmar que ningún test existente de cuotas / consumo / recurrencia se rompe por el cambio de la rama de rolling.
