## ADDED Requirements

### Requirement: El usuario puede registrar un consumo en una tarjeta de crédito

El sistema SHALL permitir registrar un consumo (`type='expense'`) en una cuenta `accounts.type='credit'`. El consumo requiere: cuenta (tarjeta), moneda activa en esa tarjeta, monto mayor a cero, fecha, y categoría. La descripción y subcategoría son opcionales. El consumo SHALL persistirse con `status='pending'`, `due_date` igual a la `due_date` del `card_periods` al que se asigna, `card_period_id` apuntando a ese período, y `fx_rate_to_ars` populado si la moneda del consumo no es ARS.

#### Scenario: Consumo en pesos en tarjeta

- **WHEN** el usuario registra un gasto de `$50.000 ARS` en su tarjeta de crédito con fecha `2026-05-20`
- **THEN** se inserta una fila en `transactions` con `type='expense'`, `status='pending'`, `account_id=<tarjeta>`, `currency_code='ARS'`, `card_period_id=<período cuyo rango contiene 2026-05-20>`, `fx_rate_to_ars=NULL`
- **AND** ningún saldo de cuentas cash/bank cambia

#### Scenario: Consumo en dólares en tarjeta

- **WHEN** el usuario registra un gasto de `US$100` en tarjeta con cotización del día `1400` ARS/USD
- **THEN** se inserta `transactions` con `currency_code='USD'`, `amount=100`, `fx_rate_to_ars=1400`
- **AND** el cálculo de "% límite disponible" usa `100 * 1400 = $140.000` ARS imputado al límite

#### Scenario: Consumo en moneda no activa en la tarjeta es rechazado

- **WHEN** el usuario intenta registrar un consumo USD en una tarjeta que solo tiene ARS activa
- **THEN** la action retorna error y no inserta

---

### Requirement: El usuario puede registrar un consumo en cuotas en una tarjeta de crédito

El sistema SHALL permitir registrar un consumo en N cuotas (N ≥ 2) en una tarjeta. El consumo en cuotas SHALL aplicar únicamente a `currency_code='ARS'` (las tarjetas argentinas no operan cuotas en monedas extranjeras). El sistema SHALL crear una transacción "madre" (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`, sin `due_date`) y N transacciones "hijas" (`is_parent=false`, `parent_id=<madre.id>`, `account_id=<tarjeta>`, `status='pending'`, `installment_n=i`, `installments_total=N`).

La distribución de montos SHALL ser: `cuota_base = floor(amount_total * 100 / N) / 100` (en centavos), `residuo = amount_total − cuota_base * N`, `cuota_1 = cuota_base + residuo`, cuotas 2..N = `cuota_base`. La cuota `i` SHALL tener `date = madre.date + (i-1) meses` (date virtual de imputación al resumen) y `card_period_id` del período cuyo rango contenga esa fecha (auto-generando el período si no existe vía rolling).

#### Scenario: Compra en 3 cuotas de $1000

- **WHEN** el usuario registra una compra en 3 cuotas de `$1000` con fecha `2026-05-30`
- **THEN** se crea una madre con `is_parent=true`, `amount=1000`, `account_id=NULL`, `status=NULL`
- **AND** se crean tres hijas con `amount=333.34, 333.33, 333.33` (residuo a la primera)
- **AND** cada hija tiene `date='2026-05-30'`, `2026-06-30'`, `2026-07-30'` respectivamente
- **AND** cada hija tiene `installment_n=1, 2, 3` y `installments_total=3`

#### Scenario: Compra en cuotas en USD es rechazada

- **WHEN** el usuario intenta registrar una compra en USD en 3 cuotas
- **THEN** la action retorna error de validación con copy "Las cuotas solo están disponibles en pesos"
- **AND** no se inserta nada

#### Scenario: Compra en cuotas que sobrepasa el último período conocido dispara rolling

- **WHEN** el usuario registra una compra en 6 cuotas el `2026-05-30` y solo existen períodos hasta `2026-07-15`
- **THEN** el sistema auto-genera los períodos que falten (con `is_estimated=true`) para imputar todas las cuotas
- **AND** la transacción completa se inserta atómicamente

---

### Requirement: El usuario paga un resumen de tarjeta como operación atómica

El sistema SHALL exponer una operación `payCardPeriod(periodId, data)` que ejecute, en una única transacción DB, los siguientes cinco efectos:

1. INSERT de una transacción `expense` en la cuenta de pago (cash o bank) con `amount`, `payment_date`, sin categoría, sin `card_period_id`.
2. INSERT de una fila en `period_payments` vinculando el período con la transacción.
3. UPDATE `status='paid'` de todas las transacciones con `card_period_id=periodId` y `status='pending'`.
4. INSERT de un nuevo `card_periods` con `start_date = current.end_date + 1 día`, `end_date = next_end_date` (input), `due_date = next_due_date` (input), `is_estimated=false`.

El pago SHALL ejecutarse sobre un período cuyo estado derivado sea `closed` u `overdue`. Si cualquier paso falla, SHALL hacerse rollback completo y el sistema SHALL devolver error.

El operacion `payCardPeriod` SHALL retornar `{ paymentId, newPeriodId, expenseId }`.

#### Scenario: Pago exitoso de resumen cerrado

- **WHEN** el usuario paga un resumen `closed` por `$150.000` desde su cuenta "Galicia" en fecha `2026-06-25`, cargando `next_end_date='2026-07-20'` y `next_due_date='2026-08-05'`
- **THEN** se inserta el expense en "Galicia" (que baja su saldo en `$150.000`)
- **AND** se inserta `period_payments`
- **AND** todas las cuotas del período pagado pasan a `status='paid'`
- **AND** se inserta un nuevo `card_periods` para el siguiente resumen

#### Scenario: Pago bloqueado en período open o paid

- **WHEN** el usuario intenta pagar un período cuyo estado derivado es `open` o `paid`
- **THEN** la action retorna error `invalid_period_state`
- **AND** no modifica nada

#### Scenario: Cuotas de períodos posteriores no se marcan paid

- **WHEN** se paga el período P1 que contiene la cuota 1 de una compra en 6 cuotas; las cuotas 2..6 están imputadas a P2..P6
- **THEN** sólo la cuota 1 pasa a `paid`
- **AND** las cuotas 2..6 siguen `pending` en sus períodos respectivos

#### Scenario: Falla en cualquier paso hace rollback

- **WHEN** durante la operación atómica falla el INSERT del nuevo `card_periods` (ej.: violación de UNIQUE)
- **THEN** se hace rollback de todos los pasos anteriores
- **AND** el resumen queda sin pago registrado

---

### Requirement: El usuario puede revertir un pago de resumen

El sistema SHALL exponer una operación `reverseCardPayment(paymentId)` que ejecute, en una única transacción DB:

1. UPDATE `status='pending'` de todas las transacciones con `card_period_id = payment.period_id` que estaban en `paid`.
2. DELETE de la fila en `period_payments`.
3. DELETE de la transacción `expense` original del pago.

El período "siguiente" creado durante el pago NO SHALL borrarse automáticamente — vive como `card_periods` independiente y el usuario puede borrarlo manualmente si está `open` y vacío.

#### Scenario: Reversión limpia de pago reciente

- **WHEN** el usuario revierte un pago que marcó las cuotas del período X como paid
- **THEN** todas las cuotas vuelven a `status='pending'`
- **AND** la fila en `period_payments` se elimina
- **AND** el expense que registró el pago se elimina, recuperando el saldo de la cuenta de pago

#### Scenario: Período siguiente creado durante el pago sobrevive a la reversión

- **WHEN** el usuario revierte un pago que había generado el período siguiente Y
- **THEN** la reversión no toca el `card_periods` del período Y
- **AND** si Y tiene transacciones imputadas, esas transacciones se conservan

#### Scenario: Reversión falla si hay tx imputadas al período siguiente Y, no — la reversión sigue siendo válida

- **WHEN** el período Y creado durante el pago tiene una transacción imputada (un consumo nuevo entre el pago y la reversión)
- **THEN** la reversión se ejecuta exitosamente
- **AND** Y queda intacto con su transacción

---

### Requirement: El sistema rechaza registrar un consumo con fecha dentro de un período pagado

El sistema SHALL rechazar la inserción de cualquier transacción de tarjeta cuya `date` caiga dentro del rango (`start_date`, `end_date`) de un `card_periods` cuyo estado derivado sea `paid`. El sistema SHALL devolver un error explicativo y ofrecer al usuario alternativas (registrar como ajuste manual, o consultar un flujo futuro de corrección).

#### Scenario: Backdating en período paid es rechazado

- **WHEN** el usuario intenta registrar un consumo con `date='2026-04-20'` y existe un `card_periods` con rango `2026-04-01` a `2026-04-30` en estado `paid`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no inserta la transacción

#### Scenario: Backdating en período no-paid es aceptado

- **WHEN** el usuario registra un consumo con `date='2026-05-05'` y el período de mayo está en estado `open`
- **THEN** la transacción se inserta normalmente

---

### Requirement: Las transacciones de tarjeta NO impactan el saldo disponible del usuario

El sistema SHALL excluir del cálculo de saldo de cualquier cuenta a las transacciones de `type='expense'` con `account.type='credit'` (tanto `pending` como `paid`). El saldo de las cuentas `cash`/`bank` SHALL afectarse únicamente por:

- Sus propias transacciones `income` y `expense` (no de tarjeta).
- Transferencias entrantes/salientes con esa cuenta.
- Ajustes con esa cuenta.
- El `expense` generado por el flujo de "pago de resumen" (que vive en cash/bank, no en credit).

#### Scenario: 100 consumos en tarjeta no cambian el saldo de "Galicia"

- **WHEN** el usuario tiene `$500.000` en "Galicia" y registra 100 consumos por un total de `$2.000.000` en su tarjeta
- **THEN** "Galicia" sigue mostrando `$500.000`

#### Scenario: Pago de resumen por `$300.000` desde "Galicia" baja el saldo

- **WHEN** el usuario paga el resumen por `$300.000` desde "Galicia"
- **THEN** "Galicia" baja a `$200.000`

---

### Requirement: Editar una compra en cuotas propaga campos no monetarios y bloquea cambios monetarios si hay cuotas paid

El sistema SHALL permitir editar la transacción madre de una compra en cuotas. Los campos `category_id`, `subcategory_id` y `description` SHALL propagarse automáticamente a todas las hijas. Los campos `amount`, `date` y la cantidad de cuotas (`installments_total`) SHALL ser editables únicamente si TODAS las hijas están en estado `pending` (ninguna `paid`); si alguna cuota ya pasó a `paid`, esos campos SHALL ser rechazados por la action.

#### Scenario: Edición de categoría propaga a hijas

- **WHEN** el usuario cambia la categoría de una compra en 6 cuotas
- **THEN** las 6 cuotas hijas reflejan la nueva categoría

#### Scenario: Edición de monto rechazada si alguna cuota está paid

- **WHEN** el usuario intenta cambiar el monto de una compra cuya cuota 1 ya está `paid`
- **THEN** la action retorna error
- **AND** el resto de los campos editables (categoría, descripción) sí se aceptan

---

### Requirement: Eliminar una compra en cuotas sólo es posible si todas las hijas están pending

El sistema SHALL permitir eliminar una transacción madre con `is_parent=true` únicamente si TODAS sus hijas están en estado `pending`. La eliminación SHALL cascadear: borra la madre y todas las hijas en una sola operación (vía `ON DELETE CASCADE` del FK `parent_id`).

#### Scenario: Eliminación válida con todas las cuotas pendientes

- **WHEN** el usuario elimina una compra en 6 cuotas donde todas las cuotas están `pending`
- **THEN** la madre y las 6 hijas se borran permanentemente
- **AND** ningún saldo cambia (las cuotas pending no afectaban al disponible)

#### Scenario: Eliminación rechazada si hay cuota paid

- **WHEN** el usuario intenta eliminar una compra en cuotas donde al menos una cuota está `paid`
- **THEN** la action retorna error con copy "No se puede eliminar — al menos una cuota ya fue pagada"

#### Scenario: Eliminar cuota individual no es posible

- **WHEN** un usuario o API intenta eliminar directamente una cuota hija (no la madre)
- **THEN** la action retorna error con copy "Para eliminar esta compra, eliminá la operación completa desde el detalle de la compra"

---

### Requirement: El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS

El sistema SHALL validar mediante constraint `CHECK` y/o lógica de action que `transactions.fx_rate_to_ars` esté populado (NOT NULL, > 0) si y solo si `account.type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`. En cualquier otro caso, `fx_rate_to_ars` SHALL ser `NULL`.

#### Scenario: Consumo USD en tarjeta exige fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='USD'` y `fx_rate_to_ars=NULL`
- **THEN** la DB o action rechaza con error

#### Scenario: Consumo ARS en tarjeta no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `expense` en tarjeta con `currency_code='ARS'` y `fx_rate_to_ars=1400`
- **THEN** la DB o action rechaza con error

#### Scenario: Income en cuenta cash no debe tener fx_rate_to_ars

- **WHEN** se intenta insertar `income` con `fx_rate_to_ars` no nulo
- **THEN** la DB o action rechaza

---

### Requirement: Las transacciones de pago de resumen y reversión preservan el orden determinístico

El sistema SHALL preservar el ordering determinístico (`date ASC, created_at ASC, id ASC`) en todas las queries de listados de movimientos, incluyendo movimientos generados por el pago de resumen y por la reversión. Los `expense` de pago SHALL aparecer en la cuenta de pago con la fecha del pago.

#### Scenario: Lista de movimientos de "Galicia" muestra el pago como expense ordinario

- **WHEN** el usuario abre el detalle de "Galicia" después de pagar un resumen
- **THEN** la lista muestra ese `expense` en la posición correspondiente a su `date` (no agrupado aparte)
- **AND** el ordering respeta `date ASC, created_at ASC, id ASC`

## MODIFIED Requirements

### Requirement: El usuario puede registrar un gasto en una cuenta

El sistema SHALL permitir registrar un gasto (plata que sale) en una cuenta. Para `type='cash'` o `type='bank'`, el gasto requiere: cuenta, moneda activa, monto mayor a cero, fecha y categoría; la subcategoría y descripción son opcionales; el sistema persiste con `status=NULL` (no aplica) e impacta saldo inmediatamente. Para `type='credit'` (tarjeta), el gasto sigue el requirement específico de consumos en tarjeta (con `status='pending'`, `card_period_id`, eventualmente cuotas, y SIN impacto al saldo disponible) — ver requirement separado.

#### Scenario: Gasto en cash creado correctamente

- **WHEN** el usuario completa el formulario con cuenta cash, moneda, monto > 0, fecha y categoría válidos y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='expense'`, `status=NULL`, `amount > 0`, y el saldo de la cuenta disminuye en ese monto para la moneda indicada

#### Scenario: Gasto sin categoría es rechazado

- **WHEN** el usuario intenta crear un gasto sin seleccionar categoría
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Subcategoría pertenece a la categoría seleccionada

- **WHEN** el usuario selecciona una subcategoría que no pertenece a la categoría elegida
- **THEN** el sistema rechaza el input con error de validación

#### Scenario: Gasto en cuenta credit (tarjeta) se dispatcha al requirement específico

- **WHEN** el usuario selecciona una cuenta `type='credit'` al registrar un gasto
- **THEN** la operación se rige por el requirement "El usuario puede registrar un consumo en una tarjeta de crédito"
- **AND** el saldo de la tarjeta y de cuentas cash/bank no cambia

---

### Requirement: El usuario puede editar una transacción

El sistema SHALL permitir editar los campos mutables de una transacción según su tipo:

- **Ingresos y gastos en cash/bank**: monto, fecha, descripción, categoría y subcategoría. Los campos `type`, `account_id` y `currency_code` son inmutables.
- **Transferencias**: ver requirement específico.
- **Ajustes**: ver requirement específico.
- **Consumos en tarjeta (1 cuota, `status='pending'`)**: monto, fecha, descripción, categoría, subcategoría. NO editable: cuenta, moneda, cuotas. Si `status='paid'`, sólo editables descripción y categoría.
- **Compras en cuotas (madre)**: ver requirement específico "Editar una compra en cuotas".

Los campos `type`, `account_id`, `currency_code`, `is_parent` y `parent_id` SHALL ser siempre inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un gasto cash/bank de $100 a $150
- **THEN** el saldo de la cuenta disminuye $50 adicionales respecto al saldo previo

#### Scenario: Cambio de tipo es rechazado

- **WHEN** el usuario intenta cambiar un ingreso a gasto mediante la acción de edición
- **THEN** el sistema rechaza el input; el tipo es inmutable

#### Scenario: Cambio de cuenta es rechazado

- **WHEN** el usuario intenta mover la transacción a otra cuenta mediante la acción de edición
- **THEN** el sistema rechaza el input; la cuenta es inmutable

#### Scenario: Edición de consumo en tarjeta pending

- **WHEN** el usuario edita el monto de un consumo de tarjeta con `status='pending'`
- **THEN** la action acepta el cambio
- **AND** se recalcula el período asignado si la fecha cambió (con potencial reubicación al período correspondiente)

#### Scenario: Edición de consumo en tarjeta paid solo permite descripción y categoría

- **WHEN** el usuario intenta editar el monto de un consumo con `status='paid'`
- **THEN** el sistema rechaza el cambio de monto (campo inmutable post-pago)
- **AND** acepta cambios de descripción o categoría
