## ADDED Requirements

### Requirement: Las tarjetas no descuentan disponible hasta el pago del resumen

El sistema SHALL respetar el invariante `I-CRED-1` en todo el motor contable: las cuentas `accounts.type='credit'` tienen siempre `initial_balance=0` en todas sus monedas, y las transacciones `type='expense'` con `account.type='credit'` SHALL ser excluidas del cálculo del saldo de cualquier cuenta. El único efecto contable de una transacción de tarjeta sobre el saldo disponible del usuario SHALL ser indirecto, vía el `expense` que genera el flujo "pago de resumen" en una cuenta `cash`/`bank`.

Este invariante SHALL ser enforced en:

- Constraint `CHECK` que rechaza `initial_balance != 0` para cualquier `account_currencies` cuya cuenta padre tenga `type='credit'`.
- Todas las queries del motor contable (función helper centralizada) que computen saldos.
- Tests unitarios y de integración que validen el invariante.

#### Scenario: Inserción de transacción `pending` en tarjeta no cambia saldo

- **WHEN** se inserta una transacción `expense` con `status='pending'` en una cuenta `credit`
- **THEN** el saldo derivado de cualquier cuenta `cash`/`bank` propia no cambia

#### Scenario: initial_balance distinto de cero en cuenta credit es rechazado por DB

- **WHEN** se intenta insertar `account_currencies` con `initial_balance=100` para una cuenta `type='credit'`
- **THEN** la DB rechaza por la constraint `chk_credit_initial_balance`

---

### Requirement: Las cuotas N>1 usan el patrón madre/hija con la madre off-ledger

El sistema SHALL respetar el invariante `I-CRED-7`: una compra en N cuotas (N ≥ 2) en tarjeta SHALL generar una transacción "madre" (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`) y N transacciones "hijas" (`is_parent=false`, `parent_id=<madre.id>`, `account_id=<tarjeta>`, `status='pending'`, `installment_n=i`, `installments_total=N`).

La madre SHALL ser **off-ledger**: no impacta saldos, no aparece en listas de movimientos del listado general, no aparece en queries de cálculo de total del período. La madre existe únicamente para agrupar las hijas en la UI de "detalle de la compra" y para soportar edición/eliminación cascadeada.

Las hijas SHALL transitar `pending → paid` exclusivamente como efecto del flujo "pago de resumen" — nunca como UPDATE manual o directo.

#### Scenario: Madre con is_parent=true no aparece en queries de saldo

- **WHEN** se calcula el saldo de cualquier cuenta del usuario
- **THEN** las transacciones con `is_parent=true` se excluyen del SUM

#### Scenario: Madre con is_parent=true no aparece en lista de movimientos

- **WHEN** se renderiza la lista de movimientos de una tarjeta o del listado general
- **THEN** las transacciones con `is_parent=true` se omiten; solo se muestran las hijas

#### Scenario: UPDATE manual de status pending → paid en una hija es rechazado

- **WHEN** se intenta UPDATE directo (fuera del flujo `payCardPeriod`) que cambia `status` de una cuota
- **THEN** el sistema rechaza (vía trigger, RLS policy específica, o convención de código + revisión)

---

### Requirement: Toda transacción en tarjeta tiene un período asignado

El sistema SHALL respetar el invariante `I-CRED-6`: toda transacción con `type='expense'`, `is_parent=false` y `account.type='credit'` SHALL tener `card_period_id NOT NULL` apuntando a un `card_periods` existente, y `status` en `{ 'pending', 'paid' }`. El sistema SHALL enforce esto vía:

- Constraint NOT NULL en `transactions.card_period_id` condicional al `account.type` (vía trigger o constraint check con subquery).
- Validación en las actions de inserción (`registerCardPurchase`, `registerInstallments`).

#### Scenario: Inserción de consumo sin card_period_id es rechazada

- **WHEN** se intenta INSERT de un `expense` en tarjeta con `card_period_id=NULL`
- **THEN** la DB o action rechaza la operación

#### Scenario: Inserción de consumo con status inválido es rechazada

- **WHEN** se intenta INSERT de un `expense` en tarjeta con `status='posted'`
- **THEN** la DB o action rechaza (status válidos son `'pending'` y `'paid'`)

---

### Requirement: Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy

El sistema SHALL respetar el invariante `I-CRED-12`: para toda cuenta `accounts.type='credit'` con `is_active=true`, SHALL existir al menos un `card_periods` cuyo estado derivado sea `open` (`today ≤ end_date`) o, alternativamente, SHALL existir un período "actual" cuyo `start_date ≤ today` y la app SHALL haber generado el siguiente bajo demanda.

El invariante SHALL mantenerse vía el rolling automático (lazy on-demand): si una operación necesita un período cubriendo una fecha futura y no existe, el sistema lo genera al vuelo usando el algoritmo de sugerencia.

#### Scenario: Tarjeta sin períodos open dispara rolling al primer consumo

- **WHEN** una tarjeta tiene solamente un período `paid` y se intenta registrar un consumo con `date` después del `end_date` de ese período
- **THEN** el sistema genera un nuevo `card_periods` con fechas estimadas antes de insertar el consumo
- **AND** el consumo se asigna al nuevo período

#### Scenario: Tarjeta archivada (inactiva) no requiere períodos open

- **WHEN** una tarjeta tiene `is_active=false`
- **THEN** el invariante no exige períodos open (la tarjeta no acepta consumos nuevos)

---

### Requirement: Las cuotas N>1 solo aplican a transacciones en ARS

El sistema SHALL respetar el invariante `I-CRED-9`: una compra en N cuotas (N ≥ 2) en tarjeta SHALL tener `currency_code='ARS'`. El sistema SHALL rechazar cualquier intento de crear una compra en cuotas con moneda distinta a ARS.

#### Scenario: Cuotas en USD es rechazada

- **WHEN** un usuario intenta registrar una compra de US$500 en 3 cuotas
- **THEN** la action `registerInstallments` retorna error de validación
- **AND** no inserta ni la madre ni las hijas

---

### Requirement: La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS

El sistema SHALL respetar el invariante `I-CRED-11`: `transactions.fx_rate_to_ars` SHALL ser NOT NULL y mayor a cero si y solo si `account.type='credit'`, `currency_code != 'ARS'`, `type='expense'` y `is_parent=false`. En cualquier otra combinación, SHALL ser `NULL`.

El sistema SHALL enforce esto vía constraint `CHECK` con subquery sobre `accounts.type` (o trigger equivalente) y vía validación en las actions de inserción.

#### Scenario: Consumo ARS con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza por el constraint

#### Scenario: Consumo USD sin fx_rate_to_ars es rechazado

- **WHEN** se intenta INSERT con `currency_code='USD'` en tarjeta y `fx_rate_to_ars=NULL`
- **THEN** la DB rechaza por el constraint

#### Scenario: Income en cuenta cash con fx_rate_to_ars no nulo es rechazado

- **WHEN** se intenta INSERT con `type='income'`, `account.type='cash'`, y `fx_rate_to_ars=1400`
- **THEN** la DB rechaza
