## Context

El dashboard tiene dos números de la lente CAJA que deberían reconciliar y no lo hacen:

- **Disponible** (Hero): `aggregateHero` + `calculateTransactionSums` (`@grana/money-logic/balance.ts`). Suma por cuenta/moneda **todos** los tipos con reglas de signo bien definidas (income +, expense −, transfer −/+, exchange −origen/+destino, adjustment ±, reimbursement-recibido-a-cuenta +, settlement out −/in +).
- **Balance del mes**: `buildMonthBalanceSeries` (`@grana/dashboard/aggregations.ts`). Solo maneja `income`/`expense`/`adjustment` y **descarta** el resto (los rows llegan de la query pero caen fuera del `if/else`). `finalBalance = totalIncome − totalExpense + totalAdjustment`.

Por eso, ante un reintegro recibido, una liquidación o un cambio de moneda en el mes, el `finalBalance` no iguala el Δ Disponible. La query (`getMonthBalanceSeries`) hoy además **pre-particiona los rows por `currency_code`** y construye cada serie por separado — lo que rompe el caso `exchange`, cuya pata destino vive en `destination_currency` (otra moneda).

Restricción de dominio: ARS y USD **nunca** se combinan ni convierten; cada moneda es su propia serie. El cálculo considera solo transacciones confirmadas (`status IS NULL`, excluye consumos `pending` de tarjeta).

## Goals / Non-Goals

**Goals:**
- `finalBalance` del mes = Δ Disponible del mes, por moneda, por construcción (mismas reglas de signo que `calculateTransactionSums`).
- Surfacer los movimientos hoy invisibles (reintegros recibidos, liquidaciones, cambios de moneda) y el pago de tarjeta (N1) como baldes/filas propias, condicionadas a monto ≠ 0.
- Rótulo de la pregunta que responde cada card (CAJA vs CONSUMO).
- Un test que ancle la reconciliación y atrape drift futuro.

**Non-Goals:**
- Refactorizar `calculateTransactionSums` (battle-tested, alimenta el Hero) — se deja intacto.
- Reintroducir el chart de línea acumulada (sigue sin existir).
- Paridad visual mobile de las filas nuevas (campos nuevos + render condicional; no rompe nativo). Seguimiento aparte.
- El bloque "Comprometido" (lente COMPROMISO) — es la fase siguiente.

## Decisions

### 1. Espejar las reglas de signo en `buildMonthBalanceSeries`, no compartir el core con `calculateTransactionSums`

`buildMonthBalanceSeries` SHALL manejar **todos** los tipos con los mismos signos que `calculateTransactionSums`, bucketeando por tipo. NO se extrae un núcleo compartido entre ambas funciones porque tienen formas distintas: `calculateTransactionSums` es **por cuenta** (las transferencias importan por cuenta), mientras la serie del mes suma **across cuentas propias** (las transferencias netean 0 y se ignoran). Un core común para transfer/exchange agregaría ramas condicionales que oscurecen ambas.

**Mitigación del drift** (el riesgo real de espejar): un test de reconciliación (decisión 4) que, sobre un set representativo de rows, asserta `buildMonthBalanceSeries(...).finalBalance === Σ_owned calculateTransactionSums(...)` por moneda.

_Alternativa considerada_: factorizar `signedContribution(row, currency, ownedSet)` usado por las dos. Descartada por ahora: tocar `calculateTransactionSums` arriesga el Hero, y la diferencia per-cuenta vs per-moneda hace que el helper no sea tan limpio. Queda anotado como refactor futuro si aparece una tercera consumidora.

### 2. La serie recibe TODOS los rows + la moneda objetivo (no pre-particionar por `currency_code`)

`getMonthBalanceSeries` SHALL dejar de pre-filtrar `arsTxs`/`usdTxs` por `currency_code`. En cambio, `buildMonthBalanceSeries(year, month, rows, ownedIds, currency)` recibe el set completo y resuelve la moneda **por pata**, igual que `calculateTransactionSums`: para `exchange`, la pata origen contribuye a la serie de `currency_code` y la pata destino a la de `destination_currency`. Así el cambio de moneda reconcilia per-moneda (ARS resta, USD suma).

La query SHALL traer los campos que faltan: `destination_amount`, `destination_currency`, `reimbursement_target`, `received_at`, `cancelled_at`, `settlement_direction`, y el embed `period_payments(id)` (para detectar el pago de tarjeta, igual que `getMonthCategoryBreakdown`).

### 3. Baldes nuevos y `finalBalance`

`MonthBalanceSeries` suma a sus totales: `totalCardPayment`, `totalReimbursement`, `totalSettlement` (neto in−out), `totalExchange` (neto signado por moneda). `totalExpense` pasa a excluir el pago de tarjeta (expense con `period_payments`). 

`finalBalance = totalIncome − totalExpense − totalCardPayment + totalAdjustment + totalReimbursement + totalSettlement + totalExchange`. El `accumulatedBalance` diario SHALL incluir todos los baldes (correctitud de la serie aunque el chart no se pinte). El desglose **por día** de los baldes nuevos es opcional (el chart no existe): basta el total mensual para la UI.

### 4. Test de reconciliación como guardrail

En `packages/dashboard/__tests__/aggregations.test.ts`: dado un set de rows que incluya income, expense, pago de tarjeta, adjustment ±, reintegro recibido (y uno pendiente/cancelado que NO debe contar), settlement in/out y un exchange ARS↔USD, asertar:
- `finalBalance` ARS y USD == el Δ que produce `calculateTransactionSums` sobre las mismas filas y cuentas propias.
- "Gastos" excluye el pago de tarjeta; el reintegro pendiente/cancelado no suma; transfer entre propias netea 0.

### 5. UI: filas condicionales reusando el patrón existente

`month-balance-section.tsx` agrega filas (`FlowRow`) para Pago de tarjeta / Reintegros recibidos / Liquidaciones / Cambio de moneda, renderizadas solo si su balde ≠ 0 (igual que "Ajustes" hoy). `maxFlow` se recalcula incluyendo el valor absoluto de todos los baldes presentes. Tonos vía tokens (sin hex inline). Los signados muestran su signo. El rótulo de pregunta de cada card sale de i18n.

## Risks / Trade-offs

- **Drift entre las dos funciones de signo** → Mitigado por el test de reconciliación (decisión 4); cualquier nueva regla en `calculateTransactionSums` que no se replique rompe el test.
- **Demasiadas filas ensucian la card** → Render condicional: solo aparecen los baldes con movimiento; el usuario típico (sin reintegros/liquidaciones/exchange) sigue viendo Ingresos/Gastos (+ Ajustes/Pago si corresponde).
- **Cambio de firma de `buildMonthBalanceSeries`** (ahora recibe moneda + todos los rows) → Es interno al package; el único caller es `getMonthBalanceSeries`. Se actualizan juntos. Mobile consume `getMonthBalanceSeries`/los totales, no la firma interna.
- **Paridad mobile** → Los nuevos totales viajan en `MonthBalanceSeries`; la sección nativa hoy no renderiza las filas nuevas hasta el seguimiento de paridad. No rompe (campos nuevos ignorados).

## Open Questions

- Ninguna bloqueante. El tono/color exacto de las filas nuevas se resuelve con tokens existentes en implementación (no requiere decisión de producto).
