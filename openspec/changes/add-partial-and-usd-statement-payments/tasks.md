# Tasks: add-partial-and-usd-statement-payments

## 1. Migración: patas de pago, pago mínimo y reversión (D0, D1, D2, D8, D9, D10)

- [x] 1.1 `0061_card_payment_legs.sql`: drop del `UNIQUE(period_id)` de `period_payments`, índice común sobre `(period_id, created_at)`
- [x] 1.2 Columnas `settles_currency` (`ARS`/`USD`), `settles_amount numeric(18,2) > 0`, `fx_rate_to_ars numeric(18,6) > 0`, `payment_group_id uuid not null`, `settlement_known boolean not null default true`
- [x] 1.3 CHECK local (lo que se ve desde la fila): `settles_currency`/`settles_amount` presentes ⟺ `settlement_known = true`, montos positivos, nullability de `fx_rate_to_ars`. Los cruces de moneda NO van acá: exigen leer `transactions.currency_code` (otra tabla) y viven en el trigger de 1.6
- [x] 1.3b Índice sobre `(period_id, payment_group_id)` y sobre `(period_id, created_at, id)` para el orden determinístico de reversión
- [x] 1.4 Backfill único: `settlement_known = false` en todas las filas existentes (sin backfill de montos — D9), y `payment_group_id = id` en cada fila, para poder declararla `NOT NULL`
- [x] 1.5 `card_periods.minimum_payment_ars` / `minimum_payment_usd`, nullables, sin default
- [x] 1.5b `card_period_pending(period_id)`: la ÚNICA definición SQL del pendiente por moneda, espejo de `computePeriodAmounts`. El total se lee de los consumos (`pending` **y** `paid`), no de su estado: mirando solo los `pending`, un resumen saldado daría pendiente negativo
- [x] 1.6 `trg_fn_period_payment_coverage`: trigger `BEFORE INSERT` por fila — `FOR UPDATE` sobre el `card_periods`, cobertura por moneda, cruce de monedas contra `transactions.currency_code`, pertenencia (las patas que comparten `transaction_id` comparten `period_id` y `payment_group_id`) y coherencia de cotización (la de la pata coincide con la de su transacción, y todas las patas pesificadas de un mismo gasto comparten cotización) — D1, D11
- [x] 1.6a `trg_fn_period_payment_amount_matches`: `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` con la identidad `transactions.amount = Σ round(settles_amount × fx_rate_to_ars, 2)`. Diferida a propósito: fila por fila, la primera pata de un gasto de dos nunca llega al total (D11)
- [ ] 1.6b `period_payments` sin policies de escritura: solo `SELECT`. Los dos RPC pasan a `SECURITY DEFINER` con verificación de propiedad adentro, y el self-check de la `0050` que exige INVOKER se actualiza con el motivo escrito (D13)
- [ ] 1.6c `pay_card_period_legs(...)`, `SECURITY DEFINER`, recibe pagos anidados (`payments[] → allocations[]`, D18) y corre en este orden exacto (D16): congelar base del sello → insertar sello → recalcular pendiente **con** el sello → validar e insertar transacciones y patas → barrido `pending → paid` solo si queda saldado. Todo en una transacción (D12); el calendario NO entra
- [ ] 1.6e `confirm_running_cycle(...)`: función SQL corta que toma el lock del período pagado y aplica el plan de fechas ya resuelto en TS. Existe porque un `FOR UPDATE` desde TS no sobrevive al round-trip de PostgREST (D17)
- [ ] 1.6f Revalidación de anclajes dentro de `confirm_running_cycle` antes de escribir: propiedad, identidad del período siguiente, fechas esperadas y `hasAnyPayment = false`. Si algo cambió, no-op controlado o error — nunca pisar con un plan stale (D17)
- [ ] 1.6d `revert_card_period_payment(p_period_id, p_group_id default null)`: reversión de todas las patas o del grupo más reciente completo, con el barrido `paid → pending` condicionado a que el resumen estuviera saldado y el borrado del sello atado al grupo que lo registró
- [ ] 1.7 Guarda cronológica: bloquea si un resumen posterior tiene **cualquier** pata (antes: "está pagado"); mantiene `GRN02` y el `DETAIL` con la fecha
- [ ] 1.8 Summary del RPC por moneda (`reverted` como lista de `{ amount, currency, account_name }`) en vez del escalar actual
- [ ] 1.9 Self-check `do $check$`: falla si vuelve el UNIQUE, si falta el CHECK de coherencia, si falta el trigger de cobertura, si existe **cualquier** policy de escritura sobre `period_payments`, o si alguno de los dos RPC deja de ser SECURITY DEFINER
- [ ] 1.9b Tests PGlite sobre el SQL real: cobertura excedida, dos inserts concurrentes sobre el mismo pendiente, cruce USD→deuda ARS rechazado, INSERT/UPDATE/DELETE directos rechazados, monto ≠ Σ patas rechazado **al COMMIT**, gasto con dos patas que sí cierra la identidad, patas del mismo gasto en dos resúmenes rechazadas, redondeo `round(x × fx, 2)` coincidiendo con `Money.multiply`, pata que paga el total con sello (orden de D16), barrido condicionado, reversión por grupo, `confirm_running_cycle` idempotente sobre un período con patas
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

- [ ] 4.1 `payCardPeriodSchema`: `payments[]` anidado (`payment_account_id`, `payment_date`, `allocations[]` con `settles_currency`, `settles_amount`, `fx_rate_to_ars?`), con al menos una allocation en total — no una lista plana de patas (D18)
- [ ] 4.2 `next_end_date` / `next_due_date` y `stamp_tax_amount` requeridos **solo** cuando el período no tiene patas
- [ ] 4.3 `fx_rate_to_ars` requerida ⟺ la pata cancela USD con una transacción en ARS; rechazada en el resto de los casos
- [ ] 4.4 `payCardPeriod`: el calendario sigue en TS y corre **antes**; el dinero se delega entero a `pay_card_period_legs` (D12). Se elimina la cadena de rollbacks manuales
- [ ] 4.5 Pre-validación de cobertura en la action **solo para UX** (`cards.errors.leg_exceeds_pending`, que dice cuánto resta); la garantía es el trigger (D11)
- [ ] 4.5b El paso de calendario se delega a `confirm_running_cycle`; `planRunningCycleConfirmation` sigue en TS y la función SQL solo ejecuta el plan (D17)
- [ ] 4.6 Mapeo de los errores del RPC a `messageKey`s neutrales, incluida la colisión de cobertura por concurrencia
- [ ] 4.7 Sello y confirmación de fechas solo cuando `hasAnyPayment` es falso
- [ ] 4.8 Verificación de que cada cuenta de pago tenga activa la moneda de su transacción, y que no sea de tipo `credit`
- [ ] 4.9 `revertCardPeriodPayment(periodId, groupId?)` en `@grana/cards`, mapeando los errores del RPC
- [ ] 4.10 Tests de la action: un pago con dos allocations (todo en pesos, resumen mixto), dos pagos de una allocation cada uno (pesos con pesos + dólares con dólares), parcial y luego saldo, exceso rechazado, segunda operación sin fechas ni sello, propagación de los errores del RPC

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
- [ ] 6.4 Verificar que los débitos de pago se muestran como "Pago de resumen" y siguen protegidos contra borrado, sin tocar `get_movements_page`: dos débitos reales → dos filas (una por moneda); un débito con dos patas → **una** fila, con sus dos imputaciones en el detalle (D7)

## 7. Paridad nativa

- [ ] 7.1 `apps/mobile/components/cards/PayCardPeriodForm.tsx`: bloques de pesos y dólares, atajos, avisos
- [ ] 7.2 Pantalla de pago nativa: cuentas elegibles por moneda (ARS y USD), con sus saldos
- [ ] 7.3 Detalle de período y de movimiento nativos, con remanente y patas
- [ ] 7.4 Deshacer pago nativo: deshacer todos los pagos o solo el último grupo de pago

## 8. Cierre

- [ ] 8.1 QA manual del caso que originó la change: resumen vencido con consumos ARS + USD, pagado en dos monedas
- [ ] 8.2 QA manual del pago mínimo: parcial, remanente visible, mora sobre el remanente, saldo posterior
- [ ] 8.3 QA manual de reversión: último grupo de pago (incluido uno de dos monedas, que revierte sus dos patas), todos los pagos, bloqueo por resumen posterior con pagos
- [ ] 8.4 Verificar que un pago anterior a esta change se sigue leyendo como resumen saldado
- [ ] 8.5 QA del as-of: parado en un mes pasado, un resumen con pago mínimo previo al corte cuenta por su remanente
- [ ] 8.6 Verificar que pagar un resumen mixto no rompe ninguna pantalla que lea patas (detalle de resumen, detalle de movimiento, listado)
- [ ] 8.7 `pnpm openspec:check`, lint, typecheck y tests en verde
