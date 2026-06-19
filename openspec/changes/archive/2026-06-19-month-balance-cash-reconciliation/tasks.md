## 1. Agregación: reconciliar el mes con el Disponible (`@grana/dashboard`)

- [x] 1.1 Ampliar `MonthBalanceTxInput` (`aggregations.ts`) a todos los tipos y campos de caja: `type` completo (`income|expense|transfer|adjustment|exchange|reimbursement|settlement`), `transfer_destination_account_id`, `destination_amount`, `destination_currency`, `reimbursement_target`, `received_at`, `cancelled_at`, `settlement_direction`, y una marca de pago de tarjeta (p. ej. `is_card_payment` derivada de `period_payments`).
- [x] 1.2 Cambiar la firma de `buildMonthBalanceSeries` a `(year, month, rows, ownedIds, currency)`: recibe TODOS los rows y resuelve la moneda **por pata** (no pre-particionar por `currency_code`).
- [x] 1.3 Aplicar las reglas de signo de `calculateTransactionSums` por tipo, bucketeando: `income`→Ingresos, `expense` sin `period_payments`→Gastos, `expense` con `period_payments`→`totalCardPayment`, `adjustment`→`totalAdjustment` (signado), `reimbursement` recibido-a-cuenta→`totalReimbursement`, `settlement` in/out→`totalSettlement` (neto), `exchange`→`totalExchange` (origen resta en su moneda, destino suma en `destination_currency`), `transfer`→ignorar (netea 0 entre propias).
- [x] 1.4 Calcular `finalBalance = totalIncome − totalExpense − totalCardPayment + totalAdjustment + totalReimbursement + totalSettlement + totalExchange`; acumular todos los baldes en `accumulatedBalance` diario.
- [x] 1.5 Agregar los nuevos totales a `MonthBalanceSeries` en `types.ts` (`totalCardPayment`, `totalReimbursement`, `totalSettlement`, `totalExchange`); actualizar `emptyMonthSeries`.
- [x] 1.6 Actualizar `getMonthBalanceSeries` (`queries.ts`): traer los campos extra + embed `period_payments(id)`; dejar de filtrar `arsTxs`/`usdTxs`; invocar `buildMonthBalanceSeries` una vez por moneda con el set completo.
- [x] 1.7 Arreglar `getTransactionSums` (Hero/Disponible): el `select` no traía `reimbursement_target`, `received_at`, `cancelled_at` ni `settlement_direction`, así que `calculateTransactionSums` descartaba los reintegros recibidos y las liquidaciones del Disponible. Agregar esos campos para que el Disponible cuente todo (el otro lado de la reconciliación).

## 2. Tests de reconciliación (`@grana/dashboard`)

- [x] 2.1 En `__tests__/aggregations.test.ts`: caso con income, expense real, pago de tarjeta, ajustes ±, reintegro recibido + uno pendiente + uno cancelado, settlement in/out y un exchange ARS↔USD.
- [x] 2.2 Asertar `finalBalance` ARS y USD == el Δ de `calculateTransactionSums` sobre las mismas filas/cuentas propias (guardrail anti-drift).
- [x] 2.3 Asertar: "Gastos" excluye el pago de tarjeta; reintegro pendiente/cancelado no suma; transfer entre propias netea 0; el `finalBalance` es idéntico al modelo viejo cuando NO hay reintegros/liquidaciones/exchange (no-regresión).

## 3. UI Balance del mes (web)

- [x] 3.1 En `month-balance-section.tsx`: agregar `FlowRow` para Pago de tarjeta, Reintegros recibidos, Liquidaciones y Cambio de moneda, renderizadas solo si su balde ≠ 0 (mismo patrón condicional que "Ajustes").
- [x] 3.2 Recalcular `maxFlow` incluyendo el valor absoluto de todos los baldes presentes; tonos vía tokens (sin hex inline); montos signados (Ajustes, Liquidaciones, Cambio de moneda) con su signo.
- [x] 3.3 Verificar que el strip USD y el eye-mask cubren los importes nuevos.

## 4. Mensaje de cada card (rótulo de la pregunta)

- [x] 4.1 Agregar claves i18n (`es`/`en`): `dashboard.month.card_payment`, `dashboard.month.reimbursement`, `dashboard.month.settlement`, `dashboard.month.exchange`, y los rótulos de pregunta por sección.
- [x] 4.2 Renderizar el rótulo de pregunta como subtítulo/caption atenuado en Hero ("¿Cuánto tengo?"), Balance del mes ("¿Cómo se movió mi plata este mes?") y En qué se fue ("¿En qué se me fue?"), sin alterar la jerarquía del titular.

## 5. Verificación

- [x] 5.1 Correr el suite del package (`@grana/dashboard`) y el typecheck/lint del repo.
- [x] 5.2 QA manual: con un mes que tenga reintegro/liquidación/exchange/pago, confirmar que el neto de Balance del mes coincide con el cambio del Disponible y que "Gastos" coincide con "En qué se fue".
- [x] 5.3 Confirmar render condicional: usuario sin esos movimientos sigue viendo solo Ingresos/Gastos (+ Ajustes si corresponde).
