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
- [x] 1.10 `packages/supabase/src/types.ts`: columnas de pata a mano y `period_id` deja de ser `isOneToOne` — los tipos afirmaban que un resumen tiene UNA fila de pago. Regenerar contra la base cuando la migración se aplique

## 2. La regla de cobertura en TS (D2)

- [x] 2.1 **Verificado: `computePeriodAmounts` no necesita cambios.** Con settlement total, un resumen con pago tiene todos sus consumos en `paid`, así que `paidAmount*` sale de los consumos como hoy. Las patas no participan de la lectura en este alcance — participan del *write path*, donde las valida el trigger
- [x] 2.2 **Verificado: `derivePeriodStatus`, `derivePeriodVariant` y `classifyPeriodsLifecycle` no necesitan cambios.** `has_payment` sigue significando saldado mientras el RPC rechace toda operación que no deje el resumen en cero (`GRN04`)
- [x] 2.3 Test de regresión que ATA la equivalencia `existe pago ⟺ saldado`, en las dos direcciones y sobre el estado real de la base: pago total en una moneda, en dos con dos débitos, en dos con un débito, pago rechazado, reversión, pago legacy y el caso del sello. Si alguien relaja `GRN04`, se pone rojo antes de que una pantalla mienta

## 3. Lecturas de patas (D15)

- [x] 3.1 Auditoría completa de lecturas que asumían UNA fila de pago: 6 `.maybeSingle()` y 0 `.single()`. Los cuatro booleanos ("¿este resumen tiene pago?") pasan a `.limit(1).maybeSingle()`; los dos de `detail-queries` cambian de forma
- [x] 3.2 `detail-queries.ts`: `paymentDebits` — TODOS los débitos del pago, deduplicados por transacción (un débito puede llevar varias patas). Los escalares `payment*` se conservan derivados del primero, para las lecturas que todavía asumen uno
- [x] 3.3 **Dos asunciones de fila única que NO eran `.maybeSingle()`**: el `Map.set` por fila de `detail-queries.ts:201`, que se quedaba con la última pata en silencio; y el as-of de `dashboard/queries.ts:714`, que marcaba el resumen como saldado al corte si **alguno** de sus débitos era anterior — ahora exige que lo sean todos
- [x] 3.4 La regla del as-of se extrae a `derivePaidAtSnapshot` (pura) y se testea: dos débitos alrededor del corte, el día del corte, fecha ilegible, y que una ilegible NO salve a un resumen cuyo otro débito es posterior
- [x] 3.5 Un débito con varias imputaciones expone sus `allocations`, para que el detalle muestre **un** débito con sus dos imputaciones adentro y no el mismo gasto repetido

## 4. Schema y action de pago (D1, D6, D11, D12, D18)

- [x] 4.1 `payCardPeriodSchema`: `payments[]` anidado (`payment_account_id`, `payment_date`, `allocations[]`), con al menos una allocation
- [x] 4.2 `fx_rate_to_ars` requerida ⟺ la pata cancela USD con una transacción en ARS; rechazada en el resto
- [x] 4.3 `payCardPeriod`: el calendario se delega a `confirm_running_cycle` y corre antes; el dinero, entero a `pay_card_period_legs`. Se elimina la cadena de rollbacks manuales
- [x] 4.4 Mapeo de los errores del RPC a `messageKey`s neutrales, incluidos `GRN04` (no salda) y la colisión de cobertura
- [x] 4.5 La alícuota de sellos se deriva y persiste en TS desde `stamp_tax_base_ars`, que devuelve el RPC
- [x] 4.6 `revertCardPeriodPayment(periodId, groupId?)`, mapeando los errores del RPC
- [x] 4.7a Las shells web y nativa construyen el payload anidado con **un** débito en pesos: la app queda funcionando igual que hoy sobre el modelo nuevo, y el selector de cuenta en dólares entra en el bloque 5
- [x] 4.7b El monto a pagar deja de ser editable en las dos shells: es una consecuencia de lo que se cancela, no una entrada
- [x] 4.8 Tests de la action con Supabase falseado (16): payload viejo rechazado sin escribir nada, un débito ARS, mixto pesificado en un débito, dos débitos, cruces inválidos, el sello y la alícuota derivada, el orden calendario→dinero, el calendario que falla y no deja escribir el dinero, y los errores del RPC traducidos (`GRN04`, `GRN03`, moneda inactiva)

## 5. Formulario de pago — web (D1, D6, D18)

- [x] 5.1 Bloque "Pesos del resumen": deuda ARS, cuenta ARS
- [x] 5.2 Bloque "Dólares del resumen": elección **En dólares** (cuenta USD, sin cotización) / **En pesos** (cotización). Por defecto **En dólares** cuando hay cuenta con USD activo; si hay varias candidatas y ninguna es del banco de la tarjeta, NO se elige una por el usuario: se le pide
- [x] 5.3 El monto de cada débito se DERIVA de las imputaciones y deja de ser un campo libre; la UI explica qué sale de cada cuenta
- [x] 5.4 Aviso de saldo negativo por cuenta y por moneda, reusando `checkNegativeBalance` y `NegativeBalanceNotice`
- [x] 5.5 Cierre del formulario: "Sale de tus cuentas" por moneda, sin ningún total combinado
- [x] 5.6 Copy nuevo en `packages/i18n-messages` (es/en), incluida la reescritura de `payment.usd_note_description`

## 6. Detalle de resumen y de movimiento (D7)

- [x] 6.1 Detalle de período: un renglón por DÉBITO real (fecha, cuenta, monto en su moneda), en web y en nativo
- [x] 6.2 Detalle de movimiento de pago: una fila por imputación de ESE débito, en la moneda de la deuda que canceló. Antes salía de la composición del RESUMEN, que con dos débitos habría repetido la misma cifra en los dos movimientos
- [x] 6.3 El diálogo de deshacer pago lista TODOS los débitos que vuelven, cada uno en su moneda: con dos, mostrar solo el primero subestimaba lo que la reversión hace

## 7. Paridad nativa

- [x] 7.1 `apps/mobile/components/cards/PayCardPeriodForm.tsx`: bloques de pesos y dólares, avisos
- [x] 7.2 Pantalla de pago nativa: cuentas elegibles por moneda, con sus saldos
- [x] 7.3 Detalle de período nativo con los débitos del pago
- [x] 7.4 **Verificado: mobile no tiene flujo de deshacer pago de resumen**, así que no hay copy ni shape viejo que pueda quedar desalineado — el único `revert` nativo es el de settlements de cuenta corriente. Es una brecha de paridad PREEXISTENTE (web sí puede deshacer), ajena a esta change: queda anotada abajo, no resuelta acá

## 8. Cierre

- [ ] 8.1 QA manual del caso que originó la change: resumen vencido con consumos ARS + USD, pagado en dos monedas
- [ ] 8.2 QA manual del rechazo: intentar pagar solo una de las dos monedas
- [ ] 8.3 QA manual de reversión: pago de dos monedas, bloqueo por resumen posterior con pagos
- [ ] 8.4 Verificar que un pago anterior a esta change se sigue leyendo como resumen saldado
- [ ] 8.5 Verificar que el dashboard, el hero de `/cards` y el resumen del mes dan lo mismo que antes
- [ ] 8.6 `pnpm openspec:check`, lint, typecheck y tests en verde

## Fuera de alcance, detectado en el camino

- **Deshacer el pago de un resumen no existe en la app nativa.** Web lo tiene desde la
  migración `0050`; mobile nunca lo expuso. No lo agrega esta change —sería superficie
  nueva, no el arreglo del bug— pero conviene un ticket: hoy un usuario que pagó mal
  desde el teléfono tiene que abrir la web para corregirlo.
- **CI corre solo `pnpm --filter web test`.** Ningún archivo de `packages/*` entra en esa
  suite, aunque varios paquetes tengan script de `test`. Por eso los tests de esta change
  viven en `apps/web/lib/**`. Cambiarlo puede poner en rojo tests viejos: es su propia
  conversación.
