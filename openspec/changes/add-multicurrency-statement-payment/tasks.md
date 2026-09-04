# Tasks: add-multicurrency-statement-payment

## 1. Migración: patas de pago, invariantes y RPC (D0, D1, D8, D9, D11, D12, D13, D16, D17)

- [x] 1.1 `0061_card_payment_legs.sql`: drop del `UNIQUE(period_id)` de `period_payments`, índices por grupo y por `(period_id, created_at, id)`
- [x] 1.2 Columnas `settles_currency`, `settles_amount`, `fx_rate_to_ars`, `payment_group_id`, `settlement_known`
- [x] 1.3 CHECK local (lo que se ve desde la fila); los cruces de moneda van en el trigger, porque exigen leer `transactions.currency_code`
- [x] 1.4 Backfill único: `settlement_known = false` y `payment_group_id = id` en las filas existentes, sin adivinar montos
- [x] 1.5 `card_period_pending(period_id)`: la ÚNICA definición SQL del pendiente por moneda, con el reintegro "en resumen" explícito. El total se lee de los consumos (`pending` **y** `paid`), no de su estado
- [x] 1.6 `trg_fn_period_payment_row_invariants` (`BEFORE INSERT`): `FOR UPDATE`, cobertura, cruces de moneda, pertenencia y coherencia de cotización
- [x] 1.6a `trg_fn_period_payment_amount_matches`: `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` con `transactions.amount = Σ round(settles_amount × fx, 2)`
- [x] 1.6b `period_payments` sin policies de escritura; los RPC pasan a `SECURITY DEFINER` con verificación de propiedad
- [x] 1.6c `pay_card_period_legs(...)`: lock al inicio → sello → recalcular pendiente **con** el sello → transacciones y patas → **rechazo si no salda** → barrido
- [x] 1.6e `confirm_running_cycle(...)`: el calendario, atómico e idempotente, con revalidación completa de anclajes
- [x] 1.6f Revalidación de P(n+2): fechas, `is_estimated`, si tiene pagos y si tiene consumos
- [x] 1.7 Guarda cronológica de la reversión: bloquea si un resumen posterior tiene patas
- [x] 1.8 `revert_card_period_payment(period_id, group_id)`: por grupo, con lock y resumen por moneda
- [x] 1.9 Self-check: falla si vuelve el UNIQUE, si faltan los triggers, si el de identidad deja de ser diferido, si aparece una policy de escritura o si un RPC deja de ser DEFINER
- [x] 1.9b Tests PGlite sobre el SQL real (59): cobertura, concurrencia, cruces, escrituras directas, identidad diferida, orden del sello, operación que no salda, reversión por grupo, anclajes del calendario
- [ ] 1.10 Regenerar `packages/supabase/src/types.ts` (requiere la migración aplicada)

## 2. La regla de cobertura en TS (D2)

- [x] 2.1 **Verificado: `computePeriodAmounts` no necesita cambios.** Con settlement total, un resumen con pago tiene todos sus consumos en `paid`, así que `paidAmount*` sale de los consumos como hoy. Las patas no participan de la lectura en este alcance — participan del *write path*, donde las valida el trigger
- [x] 2.2 **Verificado: `derivePeriodStatus`, `derivePeriodVariant` y `classifyPeriodsLifecycle` no necesitan cambios.** `has_payment` sigue significando saldado mientras el RPC rechace toda operación que no deje el resumen en cero (`GRN04`)
- [ ] 2.3 Test de regresión que ATA esa equivalencia: si alguien relaja el rechazo del RPC, algo tiene que ponerse rojo antes que una pantalla mienta

## 3. Lecturas de patas (D15)

- [x] 3.1 Auditoría completa de lecturas que asumían UNA fila de pago: 6 `.maybeSingle()` y 0 `.single()`. Los cuatro booleanos ("¿este resumen tiene pago?") pasan a `.limit(1).maybeSingle()`; los dos de `detail-queries` cambian de forma
- [x] 3.2 `detail-queries.ts`: `paymentDebits` — TODOS los débitos del pago, deduplicados por transacción (un débito puede llevar varias patas). Los escalares `payment*` se conservan derivados del primero, para las lecturas que todavía asumen uno
- [x] 3.3 **Dos asunciones de fila única que NO eran `.maybeSingle()`**: el `Map.set` por fila de `detail-queries.ts:201`, que se quedaba con la última pata en silencio; y el as-of de `dashboard/queries.ts:714`, que marcaba el resumen como saldado al corte si **alguno** de sus débitos era anterior — ahora exige que lo sean todos
- [ ] 3.4 Tests del as-of con dos débitos de fechas distintas alrededor del corte

## 4. Schema y action de pago (D1, D6, D11, D12, D18)

- [ ] 4.1 `payCardPeriodSchema`: `payments[]` anidado (`payment_account_id`, `payment_date`, `allocations[]`), con al menos una allocation
- [ ] 4.2 `fx_rate_to_ars` requerida ⟺ la pata cancela USD con una transacción en ARS; rechazada en el resto
- [ ] 4.3 `payCardPeriod`: el calendario se delega a `confirm_running_cycle` y corre antes; el dinero, entero a `pay_card_period_legs`. Se elimina la cadena de rollbacks manuales
- [ ] 4.4 Mapeo de los errores del RPC a `messageKey`s neutrales, incluidos `GRN04` (no salda) y la colisión de cobertura
- [ ] 4.5 La alícuota de sellos se deriva y persiste en TS desde `stamp_tax_base_ars`, que devuelve el RPC
- [ ] 4.6 `revertCardPeriodPayment(periodId, groupId?)`, mapeando los errores del RPC
- [ ] 4.7 Tests de la action: un pago con dos allocations, dos pagos de una allocation cada uno, operación que no salda, propagación de errores del RPC

## 5. Formulario de pago — web (D1, D6, D18)

- [ ] 5.1 Bloque "Pesos del resumen": deuda ARS, cuenta ARS
- [ ] 5.2 Bloque "Dólares del resumen" (solo con `pendingAmountUSD > 0`): elección **En dólares** (cuenta USD) / **En pesos** (cotización + cuenta ARS)
- [ ] 5.3 El monto de cada débito se DERIVA de las imputaciones y deja de ser un campo libre; la UI explica qué sale de cada cuenta
- [ ] 5.4 Aviso de saldo negativo por cuenta y por moneda, reusando `checkNegativeBalance` y `NegativeBalanceNotice`
- [ ] 5.5 Cierre del formulario: "Sale de tus cuentas" por moneda, sin ningún total combinado
- [ ] 5.6 Copy nuevo en `packages/i18n-messages` (es/en), incluida la reescritura de `payment.usd_note_description`

## 6. Detalle de resumen y de movimiento (D7)

- [ ] 6.1 Detalle de período: lista de débitos del pago (fecha, cuenta, monto en su moneda, cotización cuando hubo)
- [ ] 6.2 Detalle de movimiento de pago: qué deuda del resumen canceló ese débito
- [ ] 6.3 Verificar que los débitos de pago se muestran como "Pago de resumen" y siguen protegidos contra borrado, sin tocar `get_movements_page`: dos débitos reales → dos filas; un débito con dos patas → una fila con dos imputaciones

## 7. Paridad nativa

- [ ] 7.1 `apps/mobile/components/cards/PayCardPeriodForm.tsx`: bloques de pesos y dólares, avisos
- [ ] 7.2 Pantalla de pago nativa: cuentas elegibles por moneda, con sus saldos
- [ ] 7.3 Detalle de período y de movimiento nativos
- [ ] 7.4 Deshacer pago nativo

## 8. Cierre

- [ ] 8.1 QA manual del caso que originó la change: resumen vencido con consumos ARS + USD, pagado en dos monedas
- [ ] 8.2 QA manual del rechazo: intentar pagar solo una de las dos monedas
- [ ] 8.3 QA manual de reversión: pago de dos monedas, bloqueo por resumen posterior con pagos
- [ ] 8.4 Verificar que un pago anterior a esta change se sigue leyendo como resumen saldado
- [ ] 8.5 Verificar que el dashboard, el hero de `/cards` y el resumen del mes dan lo mismo que antes
- [ ] 8.6 `pnpm openspec:check`, lint, typecheck y tests en verde
