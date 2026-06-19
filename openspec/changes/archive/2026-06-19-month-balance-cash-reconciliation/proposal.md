## Why

El "Disponible" (Hero) y el neto de "Balance del mes" **no cuadran**: el Hero (`calculateTransactionSums`) contabiliza todos los movimientos de caja, pero `buildMonthBalanceSeries` solo mira `income`/`expense`/`adjustment` y **descarta en silencio** los reintegros recibidos a cuenta, las liquidaciones de deuda compartida y los cambios de moneda. Entonces el `finalBalance` del mes no iguala el cambio real del Disponible cuando existe alguno de esos movimientos — el usuario ve dos números que deberían reconciliar y no lo hacen.

Además, dos cosas de claridad que salieron del trabajo de lentes: el **pago de resumen de tarjeta** hoy infla "Gastos" (es cancelación de deuda, no consumo nuevo), y **el mensaje de cada card** no deja claro qué pregunta responde — confusión que está en la raíz del "no cuadran".

## What Changes

- **Reconciliación CAJA (corrección)**: `buildMonthBalanceSeries`/`getMonthBalanceSeries` SHALL contabilizar **todo** movimiento de caja del mes con los **mismos signos** que `calculateTransactionSums` (la fuente del Disponible), por moneda, de modo que `finalBalance = Σ buckets = Δ Disponible del mes` por construcción. Nuevos baldes, mostrados como línea solo cuando el mes los tiene (mismo trato que "Ajustes"):
  - **Reintegros recibidos** (reimbursement target=account, `received_at` set, no cancelado): suma.
  - **Liquidaciones** (settlement: `out` resta, `in` suma).
  - **Cambio de moneda** (exchange): signado por moneda — en ARS la conversión saliente resta, en USD la entrante suma.
- **N1 — "Pago de tarjeta" como línea propia**: el pago de resumen (expense vinculado a `period_payments`) deja de contarse en "Gastos" y pasa a su balde `totalCardPayment`. El `finalBalance` NO cambia (sigue siendo salida de caja); solo se rotula aparte para que "Gastos" sea gasto de caja real, sin la cancelación de deuda. (Nota: "Gastos" de Balance es CAJA y NO coincide con "En qué se fue" cuando hay consumo de tarjeta — esa es CONSUMO/devengado e incluye la tarjeta; difieren a propósito.)
- **Mensaje de cada card**: cada sección del dashboard SHALL rotular la pregunta que ayuda a responder (Disponible → "¿Cuánto tengo?"; Balance del mes → "¿Cómo se movió mi plata este mes?"; En qué se fue → "¿En qué se me fue?"), reforzando que CAJA (Disponible/Balance) y CONSUMO (En qué se fue) son lentes distintas a propósito.
- `transfer` entre cuentas propias sigue netando 0 → se sigue ignorando (sin cambio).

## Capabilities

### New Capabilities
<!-- ninguna: todo vive dentro de la capability dashboard existente -->

### Modified Capabilities
- `dashboard`: el requirement "Balance del mes" cambia para reconciliar con el Disponible (contabilizar reintegros recibidos, liquidaciones y cambios de moneda) y para separar el pago de tarjeta en su propia línea. Se agrega un requirement para el rótulo de la pregunta que responde cada sección.

## Impact

- **`@grana/dashboard`** (`packages/dashboard`):
  - `aggregations.ts` `buildMonthBalanceSeries`: ampliar `MonthBalanceTxInput` a todos los tipos y campos relevantes (`reimbursement_target`, `received_at`, `cancelled_at`, `settlement_direction`, `destination_amount`, `destination_currency`, marca de `period_payments`); aplicar las mismas reglas de signo que `calculateTransactionSums`; nuevos totales `totalReimbursement`, `totalSettlement`, `totalExchange`, `totalCardPayment`; `finalBalance = Σ buckets`.
  - `queries.ts` `getMonthBalanceSeries`: traer los campos extra y el embed `period_payments(id)` (igual que `getMonthCategoryBreakdown`).
  - `types.ts` `MonthBalanceSeries`: nuevos campos de total.
- **Reusa** las reglas de signo ya definidas en `calculateTransactionSums` (`@grana/money-logic` balance.ts) y el patrón de detección de pago por `period_payments` (`getMonthCategoryBreakdown`). Idealmente se factoriza la regla de signos para no duplicarla.
- **`apps/web/app/(app)/dashboard/_components/month-balance-section.tsx`**: filas adicionales (Pago de tarjeta, Reintegros, Liquidaciones, Cambio de moneda) condicionadas a monto ≠ 0; cálculo de `maxFlow` con los nuevos baldes; rótulo de pregunta en el header.
- **i18n** (`@grana/i18n-messages`): nuevas claves `dashboard.month.card_payment`, `dashboard.month.reimbursement`, `dashboard.month.settlement`, `dashboard.month.exchange`, y los rótulos de pregunta por sección (`dashboard.*.question` o equivalente).
- **Tests**: `packages/dashboard/__tests__/aggregations.test.ts` (reconciliación: con reintegro/liquidación/exchange/pago el `finalBalance` iguala la suma por `calculateTransactionSums`).
- Mobile: la sección nativa consume los mismos totales; la paridad visual de las nuevas filas queda para el seguimiento de paridad mobile (no rompe: campos nuevos, render condicional).
