## MODIFIED Requirements

### Requirement: El sistema rechaza registrar un consumo con fecha dentro de un período pagado

El sistema SHALL rechazar la inserción de cualquier transacción de tarjeta cuya `date` caiga dentro del rango (`start_date`, `end_date`) de un `card_periods` cuyo estado derivado sea `paid`. El sistema SHALL devolver un error tipado (`period_already_paid`) explicativo y ofrecer al usuario alternativas (elegir otra fecha, registrar como ajuste manual, o consultar un flujo futuro de corrección).

Este rechazo SHALL aplicarse en el **punto de asignación de período** (`getOrCreatePeriodForDate`), compartido por el consumo simple, las cuotas y la confirmación de instancias recurrentes. La asignación SHALL clasificar la fecha así:

- existe un `card_periods` **no pagado** cuyo rango contiene la fecha (día de cierre incluido) → se imputa a ese período;
- existe un `card_periods` **pagado** cuyo rango contiene la fecha → se **rechaza** con `period_already_paid`;
- la fecha es **anterior** al primer resumen conocido → se rechaza como fecha previa al historial de la tarjeta;
- la fecha es **estrictamente posterior** al `end_date` del último resumen conocido → se crea un período nuevo por rolling (`is_estimated=true`) y se imputa ahí;
- cualquier otra fecha no cubierta (un hueco entre resúmenes) → se rechaza.

El sistema NO SHALL crear un `card_periods` nuevo para una fecha que no sea estrictamente posterior al último resumen conocido. En particular, una fecha cubierta por un resumen pagado NO SHALL provocar la creación de un resumen en la frontera: eso imputaría el consumo a un resumen que no contiene su fecha.

#### Scenario: Backdating en período paid es rechazado

- **WHEN** el usuario intenta registrar un consumo con `date='2026-04-20'` y existe un `card_periods` con rango `2026-04-01` a `2026-04-30` en estado `paid`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no inserta la transacción
- **AND** no crea ningún `card_periods` nuevo

#### Scenario: Backdating en período no-paid es aceptado

- **WHEN** el usuario registra un consumo con `date='2026-05-05'` y el período de mayo está en estado `open`
- **THEN** la transacción se inserta normalmente

#### Scenario: Consumo en el día de cierre de un resumen pagado es rechazado, no imputado a futuro

- **WHEN** el usuario registra un consumo con `date='2026-06-25'`, existe un `card_periods` `2026-05-26 → 2026-06-25` en estado `paid`, y el último resumen conocido termina el `2026-10-23`
- **THEN** la action retorna error tipado `period_already_paid`
- **AND** no se crea ningún `card_periods` nuevo (ni en la frontera `2026-10-24 →` ni en ningún otro lado)
- **AND** el consumo no se inserta

#### Scenario: Consumo en el día de cierre de un resumen abierto entra en ese resumen

- **WHEN** el usuario registra un consumo con `date='2026-06-25'` y existe un `card_periods` `2026-05-26 → 2026-06-25` en estado `open` o `closed` (no pagado)
- **THEN** el consumo se imputa a ese período (`card_period_id` = ese resumen)
- **AND** no se crea ningún `card_periods` nuevo

#### Scenario: Consumo posterior al último resumen dispara rolling legítimo

- **WHEN** el usuario registra un consumo con `date='2026-08-01'` y el último `card_periods` conocido termina el `2026-07-16`
- **THEN** el sistema crea un `card_periods` nuevo (`is_estimated=true`) contiguo a partir del `2026-07-17`
- **AND** el consumo se imputa a ese período

#### Scenario: Confirmar una instancia recurrente con fecha en un resumen pagado es rechazado

- **WHEN** el usuario confirma una instancia recurrente cuya fecha (`2026-06-25`) cae en un `card_periods` en estado `paid`
- **THEN** la confirmación falla con un mensaje que indica que la fecha cae en un resumen ya pagado
- **AND** no se crea ninguna transacción ni ningún `card_periods` nuevo
- **AND** la instancia sigue `pending`, y el usuario puede editar su fecha antes de confirmarla

---

### Requirement: El usuario puede registrar un consumo en cuotas en una tarjeta de crédito

El sistema SHALL permitir registrar un consumo en N cuotas (N ≥ 2) en una tarjeta. El consumo en cuotas SHALL aplicar únicamente a `currency_code='ARS'` (las tarjetas argentinas no operan cuotas en monedas extranjeras). El sistema SHALL crear una transacción "madre" (`is_parent=true`, `account_id=NULL`, `status=NULL`, `card_period_id=NULL`, sin `due_date`) y N transacciones "hijas" (`is_parent=false`, `parent_id=<madre.id>`, `account_id=<tarjeta>`, `status='pending'`, `installment_n=i`, `installments_total=N`).

La distribución de montos SHALL ser: `cuota_base = floor(amount_total * 100 / N) / 100` (en centavos), `residuo = amount_total − cuota_base * N`, `cuota_1 = cuota_base + residuo`, cuotas 2..N = `cuota_base`. La cuota `i` SHALL tener `date = madre.date + (i-1) meses` (date virtual de imputación al resumen) y `card_period_id` del período cuyo rango contenga esa fecha. El período SHALL auto-generarse por rolling **solo cuando la fecha de la cuota supera el `end_date` del último resumen conocido**; si la fecha de una cuota cae dentro de un resumen **pagado**, la operación completa SHALL rechazarse con `period_already_paid` (ver "El sistema rechaza registrar un consumo con fecha dentro de un período pagado") sin insertar nada.

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

#### Scenario: Compra en cuotas cuya primera cuota cae en un resumen pagado es rechazada

- **WHEN** el usuario registra una compra en cuotas con fecha `2026-06-25` y esa fecha cae en un `card_periods` en estado `paid`
- **THEN** la operación se rechaza con `period_already_paid`
- **AND** no se inserta ni la madre ni ninguna hija
- **AND** no se crea ningún `card_periods` nuevo
