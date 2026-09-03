# Tasks: add-partial-and-usd-statement-payments

## 1. Migración: patas de pago, pago mínimo y reversión (D0, D1, D2, D8, D9, D10)

- [ ] 1.1 `0061_card_payment_legs.sql`: drop del `UNIQUE(period_id)` de `period_payments`, índice común sobre `(period_id, created_at)`
- [ ] 1.2 Columnas `settles_currency` (`ARS`/`USD`), `settles_amount numeric(18,2) > 0`, `fx_rate_to_ars numeric(18,6) > 0`, `payment_group_id uuid not null`, `settlement_known boolean not null default true`
- [ ] 1.3 CHECK: `settles_currency`/`settles_amount` presentes ⟺ `settlement_known = true`; cruces de moneda como lista cerrada (ARS→ARS y USD→USD sin cotización, ARS→USD con cotización, USD→ARS rechazado)
- [ ] 1.3b Índice sobre `(period_id, payment_group_id)` y sobre `(period_id, created_at, id)` para el orden determinístico de reversión
- [ ] 1.4 Backfill único: `settlement_known = false` en todas las filas existentes (sin backfill de montos — D9)
- [ ] 1.5 `card_periods.minimum_payment_ars` / `minimum_payment_usd`, nullables, sin default
- [ ] 1.6 `trg_fn_period_payment_coverage`: trigger `BEFORE INSERT` que toma `FOR UPDATE` sobre el `card_periods`, recalcula la cobertura por moneda y rechaza el exceso — el piso vive acá, no en la action (D11)
- [ ] 1.6b Sin policy de `UPDATE` sobre `period_payments`: una pata es inmutable (D13). Conservar `INSERT`/`DELETE`, que la reversión INVOKER necesita
- [ ] 1.6c `pay_card_period_legs(...)`, `SECURITY INVOKER`: deuda por moneda → descuento de patas existentes → inserción de transacciones y patas → sello si corresponde → barrido `pending → paid` solo si queda saldado, todo en una transacción (D12). El calendario NO entra
- [ ] 1.6d `revert_card_period_payment(p_period_id, p_group_id default null)`: reversión de todas las patas o del grupo más reciente completo, con el barrido `paid → pending` condicionado a que el resumen estuviera saldado y el borrado del sello atado al grupo que lo registró
- [ ] 1.7 Guarda cronológica: bloquea si un resumen posterior tiene **cualquier** pata (antes: "está pagado"); mantiene `GRN02` y el `DETAIL` con la fecha
- [ ] 1.8 Summary del RPC por moneda (`reverted` como lista de `{ amount, currency, account_name }`) en vez del escalar actual
- [ ] 1.9 Self-check `do $check$`: falla si vuelve el UNIQUE, si falta el CHECK de coherencia, si falta el trigger de cobertura, si existe una policy de UPDATE sobre `period_payments`, o si alguno de los dos RPC deja de ser SECURITY INVOKER
- [ ] 1.9b Tests PGlite sobre el SQL real: cobertura excedida, dos inserts concurrentes sobre el mismo pendiente, cruce USD→deuda ARS rechazado, UPDATE de una pata rechazado, barrido condicionado, reversión por grupo
- [ ] 1.10 Regenerar `packages/supabase/src/types.ts`

## 2. La regla de cobertura, en un solo lugar (D1, D2, D4, D11)

- [ ] 2.1 `computePeriodAmounts(rows, legs)` en `@grana/money-logic`: pendiente y pagado por moneda descontando las patas, más el `settlement` (`unpaid` | `partial` | `settled`)
- [ ] 2.2 Una pata `settlement_known = false` satura el resumen (se lee como saldo total)
- [ ] 2.3 `derivePeriodStatus(period, today, settlement)` y `derivePeriodVariant`: `paid` solo con `settled`; el parcial deriva por fecha
- [ ] 2.3b Exponer `hasAnyPayment` **separado** de `settlement` (D2), y dejar en el tipo qué decide cada uno: `settlement` los montos y el estado, `hasAnyPayment` la primera pata, el sello, las fechas, el bloqueo de consumos y la guarda cronológica
- [ ] 2.4 Tests de `computePeriodAmounts`: parcial en una moneda, parcial en las dos, saldado exacto, pata legacy, reintegro recibido sobre resumen parcial, resumen solo-USD
- [ ] 2.5 Tests de `derivePeriodStatus`: parcial abierto, parcial cerrado, parcial vencido, saldado vencido

## 3. Migrar los call sites de `has_payment` (D2)

- [ ] 3.1 `packages/cards/src/queries.ts` y `detail-queries.ts`: traer las patas junto con los períodos, sin introducir N+1
- [ ] 3.2 `classifyPeriodsLifecycle`: un parcial sigue siendo candidato a "a pagar", por su remanente
- [ ] 3.3 `getCardsMonthSummary`: "A pagar" suma el remanente de los parciales; "En curso" sin cambios
- [ ] 3.4 `packages/dashboard`: compromisos del próximo mes y reconstrucción de ventanas pasadas leen el remanente
- [ ] 3.5 `transactions-mutations/internal/card-periods.ts`: un período con patas —parcial o saldado— **rechaza** el consumo backdated con `CardConsumoInPaidPeriodError`; NO se reasigna a otro período (D2)
- [ ] 3.6 Revisar cada lectura restante de `has_payment` y dejarla apuntando al concepto correcto de los tres (`settlement`, `hasAnyPayment` o `status`)
- [ ] 3.7 Barrer las seis lecturas `.maybeSingle()` sobre `period_payments` (`pay-card-period.ts:72`, `cards/mutations.ts:262` y `:292`, `detail-queries.ts:291`, `thin-mutations.ts:751` y `:903`) a lecturas de varias filas — con dos patas `.maybeSingle()` **falla** (D15)
- [ ] 3.8 `dashboard/queries.ts:714`: el as-of pasa a computar cobertura con las patas cuya `transaction.date <= snapshotDate`; el remanente sigue siendo compromiso (D14)
- [ ] 3.9 Test de regresión del as-of: pago mínimo anterior al corte que hoy borraría el remanente

## 4. Schema y action de pago (D1, D5, D6, D11)

- [ ] 4.1 `payCardPeriodSchema`: `legs` como lista (`settles_currency`, `settles_amount`, `payment_account_id`, `payment_date`, `fx_rate_to_ars?`), con al menos una pata
- [ ] 4.2 `next_end_date` / `next_due_date` y `stamp_tax_amount` requeridos **solo** cuando el período no tiene patas
- [ ] 4.3 `fx_rate_to_ars` requerida ⟺ la pata cancela USD con una transacción en ARS; rechazada en el resto de los casos
- [ ] 4.4 `payCardPeriod`: el calendario sigue en TS y corre **antes**; el dinero se delega entero a `pay_card_period_legs` (D12). Se elimina la cadena de rollbacks manuales
- [ ] 4.5 Pre-validación de cobertura en la action **solo para UX** (`cards.errors.leg_exceeds_pending`, que dice cuánto resta); la garantía es el trigger (D11)
- [ ] 4.6 Mapeo de los errores del RPC a `messageKey`s neutrales, incluida la colisión de cobertura por concurrencia
- [ ] 4.7 Sello y confirmación de fechas solo cuando `hasAnyPayment` es falso
- [ ] 4.8 Verificación de que cada cuenta de pago tenga activa la moneda de su transacción, y que no sea de tipo `credit`
- [ ] 4.9 `revertCardPeriodPayment(periodId, groupId?)` en `@grana/cards`, mapeando los errores del RPC
- [ ] 4.10 Tests de la action: pata USD con dólares, pata USD pesificada, dos patas en una operación, parcial y luego saldo, exceso rechazado, segunda pata sin fechas ni sello, rollback

## 5. Formulario de pago — web (D1, D5, D6, D10)

- [ ] 5.1 Bloque "Pesos del resumen": deuda pendiente ARS, monto editable, selector de cuenta ARS
- [ ] 5.2 Bloque "Dólares del resumen" (solo con `pendingAmountUSD > 0`): monto en USD editable y elección **En dólares** (selector de cuenta USD) / **En pesos** (cotización + cuenta ARS)
- [ ] 5.3 Atajos "Total" y "Pago mínimo" que precargan los montos de las dos patas
- [ ] 5.4 Campo de pago mínimo del resumen (por moneda), persistido en el período
- [ ] 5.5 Aviso no bloqueante al pagar menos que el mínimo informado, y aviso de remanente financiado al pagar de menos
- [ ] 5.6 Aviso de saldo negativo por cuenta y por moneda, reusando `checkNegativeBalance` y `NegativeBalanceNotice`
- [ ] 5.7 Sello y sección de fechas del ciclo solo cuando el resumen no tiene patas
- [ ] 5.8 Cierre del formulario: "Sale de tus cuentas" por moneda y "Queda impago" por moneda, sin ningún total combinado
- [ ] 5.9 Copy nuevo en `packages/i18n-messages` (es/en), incluida la reescritura de `payment.usd_note_description`

## 6. Detalle de resumen y de movimiento (D3, D7)

- [ ] 6.1 Detalle de período: lista de patas (fecha, cuenta, monto en su moneda, cotización cuando hubo) y remanente por moneda
- [ ] 6.2 Badge de resumen parcial y CTA "Registrar otro pago" en el detalle y en el hero de la tarjeta
- [ ] 6.3 Detalle de movimiento de pago: qué deuda canceló esa pata y el estado del resumen (`pagado X de Y`), reemplazando la composición actual
- [ ] 6.4 Verificar que las dos patas se muestran como "Pago de resumen" en el listado y que las dos siguen protegidas contra borrado (sin tocar `get_movements_page` — D7)

## 7. Paridad nativa

- [ ] 7.1 `apps/mobile/components/cards/PayCardPeriodForm.tsx`: bloques de pesos y dólares, atajos, avisos
- [ ] 7.2 Pantalla de pago nativa: cuentas elegibles por moneda (ARS y USD), con sus saldos
- [ ] 7.3 Detalle de período y de movimiento nativos, con remanente y patas
- [ ] 7.4 Deshacer pago nativo: deshacer todo o solo la última pata

## 8. Cierre

- [ ] 8.1 QA manual del caso que originó la change: resumen vencido con consumos ARS + USD, pagado en dos monedas
- [ ] 8.2 QA manual del pago mínimo: parcial, remanente visible, mora sobre el remanente, saldo posterior
- [ ] 8.3 QA manual de reversión: última pata, todas las patas, bloqueo por resumen posterior con pagos
- [ ] 8.4 Verificar que un pago anterior a esta change se sigue leyendo como resumen saldado
- [ ] 8.5 QA del as-of: parado en un mes pasado, un resumen con pago mínimo previo al corte cuenta por su remanente
- [ ] 8.6 Verificar que pagar un resumen mixto no rompe ninguna pantalla que lea patas (detalle de resumen, detalle de movimiento, listado)
- [ ] 8.7 `pnpm openspec:check`, lint, typecheck y tests en verde
