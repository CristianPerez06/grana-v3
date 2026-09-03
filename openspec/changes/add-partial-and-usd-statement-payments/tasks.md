# Tasks: add-partial-and-usd-statement-payments

## 1. Migración: patas de pago, pago mínimo y reversión (D0, D1, D2, D8, D9, D10)

- [ ] 1.1 `0061_card_payment_legs.sql`: drop del `UNIQUE(period_id)` de `period_payments`, índice común sobre `(period_id, created_at)`
- [ ] 1.2 Columnas `settles_currency` (`ARS`/`USD`), `settles_amount numeric(18,2) > 0`, `fx_rate_to_ars numeric(18,6) > 0`, `settlement_known boolean not null default true`
- [ ] 1.3 CHECK: `settles_currency`/`settles_amount` presentes ⟺ `settlement_known = true`; `fx_rate_to_ars` no nula solo cuando la transacción está en una moneda distinta de `settles_currency`
- [ ] 1.4 Backfill único: `settlement_known = false` en todas las filas existentes (sin backfill de montos — D9)
- [ ] 1.5 `card_periods.minimum_payment_ars` / `minimum_payment_usd`, nullables, sin default
- [ ] 1.6 `revert_card_period_payment(p_period_id, p_payment_id default null)`: reversión de todas las patas o solo de la más reciente, con el barrido `paid → pending` condicionado a que el resumen estuviera saldado y el borrado del sello atado a la pata que lo registró
- [ ] 1.7 Guarda cronológica: bloquea si un resumen posterior tiene **cualquier** pata (antes: "está pagado"); mantiene `GRN02` y el `DETAIL` con la fecha
- [ ] 1.8 Summary del RPC por moneda (`reverted` como lista de `{ amount, currency, account_name }`) en vez del escalar actual
- [ ] 1.9 Self-check `do $check$`: falla si vuelve el UNIQUE, si el CHECK de coherencia no existe, o si el RPC deja de ser SECURITY INVOKER
- [ ] 1.10 Regenerar `packages/supabase/src/types.ts`

## 2. La regla de cobertura, en un solo lugar (D1, D2, D4, D11)

- [ ] 2.1 `computePeriodAmounts(rows, legs)` en `@grana/money-logic`: pendiente y pagado por moneda descontando las patas, más el `settlement` (`unpaid` | `partial` | `settled`)
- [ ] 2.2 Una pata `settlement_known = false` satura el resumen (se lee como saldo total)
- [ ] 2.3 `derivePeriodStatus(period, today, settlement)` y `derivePeriodVariant`: `paid` solo con `settled`; el parcial deriva por fecha
- [ ] 2.4 Tests de `computePeriodAmounts`: parcial en una moneda, parcial en las dos, saldado exacto, pata legacy, reintegro recibido sobre resumen parcial, resumen solo-USD
- [ ] 2.5 Tests de `derivePeriodStatus`: parcial abierto, parcial cerrado, parcial vencido, saldado vencido

## 3. Migrar los call sites de `has_payment` (D2)

- [ ] 3.1 `packages/cards/src/queries.ts` y `detail-queries.ts`: traer las patas junto con los períodos, sin introducir N+1
- [ ] 3.2 `classifyPeriodsLifecycle`: un parcial sigue siendo candidato a "a pagar", por su remanente
- [ ] 3.3 `getCardsMonthSummary`: "A pagar" suma el remanente de los parciales; "En curso" sin cambios
- [ ] 3.4 `packages/dashboard`: compromisos del próximo mes y reconstrucción de ventanas pasadas leen el remanente
- [ ] 3.5 `transactions-mutations/internal/card-periods.ts`: un período parcial NO es destino de consumos nuevos (misma regla que uno saldado)
- [ ] 3.6 Revisar cada lectura restante de `has_payment` y dejarla apuntando al `settlement`

## 4. Schema y action de pago (D1, D5, D6, D11)

- [ ] 4.1 `payCardPeriodSchema`: `legs` como lista (`settles_currency`, `settles_amount`, `payment_account_id`, `payment_date`, `fx_rate_to_ars?`), con al menos una pata
- [ ] 4.2 `next_end_date` / `next_due_date` y `stamp_tax_amount` requeridos **solo** cuando el período no tiene patas
- [ ] 4.3 `fx_rate_to_ars` requerida ⟺ la pata cancela USD con una transacción en ARS; rechazada en el resto de los casos
- [ ] 4.4 `payCardPeriod`: verificación de saldo pendiente por moneda contra la base antes de insertar (D11), con `cards.errors.leg_exceeds_pending` que dice cuánto resta
- [ ] 4.5 Inserción de una transacción por pata, en la moneda de la cuenta de origen; rollback manual que alcanza todas las patas de la operación
- [ ] 4.6 Barrido `pending → paid` solo cuando la operación deja el resumen saldado
- [ ] 4.7 Sello y confirmación de fechas solo en la primera pata
- [ ] 4.8 Verificación de que cada cuenta de pago tenga activa la moneda de su transacción, y que no sea de tipo `credit`
- [ ] 4.9 `revertCardPeriodPayment(periodId, paymentId?)` en `@grana/cards`, mapeando los errores del RPC
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
- [ ] 8.5 `pnpm openspec:check`, lint, typecheck y tests en verde
