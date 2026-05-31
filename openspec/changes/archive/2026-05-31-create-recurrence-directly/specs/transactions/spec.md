## ADDED Requirements

### Requirement: El usuario puede crear una regla recurrente directamente, sin movimiento de origen

El sistema SHALL permitir crear una regla recurrente desde cero, sin partir de un movimiento ya registrado ni de una sugerencia. La regla SHALL persistirse en `recurrences` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`, y NO SHALL crear ninguna transacción real ni ninguna instancia en el momento de la creación: la primera instancia la produce el generador de instancias.

La entrada SHALL validarse con el mismo modelo de datos que el resto del módulo (tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoría cuando aplique, descripción, frecuencia como par `interval_count`+`interval_unit` con etiqueta preset o `custom`, `start_date`, y condición de fin opcional `end_date` y/o `max_occurrences`).

El server action SHALL rechazar entradas que violen los invariantes contables:
- `movement_type` SHALL ser uno de `income`, `expense`, `transfer` (los ajustes y las compras en cuotas NO admiten recurrencia).
- `income` y `expense` SHALL requerir `category_id`; `transfer` SHALL requerir `transfer_destination_account_id` distinto de `account_id` y NO SHALL llevar categoría.
- `amount` SHALL ser positivo.
- `currency_code` SHALL ser `ARS` o `USD` y SHALL ser una moneda activa de la cuenta (la bimoneda nunca se mezcla).
- `end_date`, si está presente, SHALL ser ≥ `start_date`.
- `account_id` y la cuenta destino, si aplica, SHALL pertenecer al usuario y estar activas.

Las reglas en tarjeta de crédito en moneda no-ARS NO SHALL capturar tipo de cambio al crearse: el `fx_rate` se solicita al confirmar cada instancia.

El sistema SHALL ofrecer un punto de entrada para este flujo desde la pantalla de recurrencias (`/transactions/recurring`).

#### Scenario: Crear un gasto recurrente desde cero

- **WHEN** el usuario abre el flujo de creación directa en `/transactions/recurring` y completa un gasto mensual de `$10.000` en una cuenta cash con categoría, `start_date = 2026-06-01`
- **THEN** el sistema crea una regla recurrente de tipo `expense` con `created_from_transaction_id = NULL` y `last_generated_date = NULL`
- **AND** no crea ninguna transacción real en `transactions`
- **AND** no crea ninguna instancia en `recurrence_instances` en ese momento

#### Scenario: Crear una transferencia recurrente desde cero

- **WHEN** el usuario crea una transferencia recurrente con cuenta origen y cuenta destino distintas y sin categoría
- **THEN** el sistema crea una regla `transfer` con `transfer_destination_account_id` poblado y `category_id = NULL`

#### Scenario: Rechazo de ajuste como recurrencia

- **WHEN** el usuario o una API intenta crear una regla directa con `movement_type = adjustment`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de categoría faltante en gasto

- **WHEN** el usuario intenta crear un gasto recurrente sin `category_id`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Rechazo de fecha de fin anterior al inicio

- **WHEN** el usuario intenta crear una regla con `end_date` anterior a `start_date`
- **THEN** la action retorna error y no crea la regla

#### Scenario: Regla en tarjeta de crédito USD no captura fx_rate al crearse

- **WHEN** el usuario crea una regla recurrente `expense` en una tarjeta de crédito con `currency_code = USD`
- **THEN** la regla se crea sin tipo de cambio almacenado
- **AND** el tipo de cambio se solicitará al confirmar cada instancia

### Requirement: El detalle de una regla recurrente muestra el historial de sus instancias

El sistema SHALL mostrar, en la pantalla de detalle de una regla recurrente (`/transactions/recurring/<id>`), el historial de todas las instancias que la regla generó, cualquiera sea su estado (`pending`, `confirmed`, `skipped`). Cada instancia SHALL mostrar al menos su fecha programada, su monto y su estado. Una instancia omitida (`skipped`) SHALL seguir siendo visible en este historial (no se borra de la base al omitirla).

#### Scenario: Instancia omitida queda visible en el historial

- **WHEN** el usuario omite una instancia pendiente de una regla y luego abre el detalle de esa regla
- **THEN** el historial lista esa instancia con estado "Omitida", con su fecha y monto

#### Scenario: Regla sin instancias generadas

- **WHEN** el usuario abre el detalle de una regla recién creada que aún no generó ninguna instancia
- **THEN** el historial muestra un estado vacío en lugar de una lista

## MODIFIED Requirements

### Requirement: La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin

El sistema SHALL calcular la fecha de la siguiente instancia recurrente aplicando `interval_count` veces la `interval_unit`. La fecha base SHALL determinarse así:

- Si `last_generated_date` es NULL (regla creada directamente, sin ocurrencia semilla): la **primera** instancia se programa **exactamente en `start_date`** (no se suma intervalo).
- Si `last_generated_date` NO es NULL (reglas creadas desde un movimiento o desde una sugerencia, donde `start_date` ya está cubierto por una transacción real): la siguiente instancia se programa aplicando el intervalo sobre `last_generated_date`.

El cálculo SHALL aplicar clamping de fin de mes: avanzar por `month` o `year` desde un día que no existe en el mes destino SHALL caer al último día válido de ese mes (p. ej. 31-ene + 1 mes ⇒ 28/29-feb).

La generación SHALL cortar por la primera condición de fin que se cumpla (`end_date` o `max_occurrences`). Una sola instancia pendiente SHALL existir por regla a la vez; un `start_date` pasado en una regla directa NO SHALL generar instancias retroactivas por cada período vencido, sino una única instancia pendiente fechada en `start_date`.

#### Scenario: Primera instancia de una regla con semilla (last_generated_date no nulo)

- **WHEN** una regla tiene `start_date = 2026-01-15`, `last_generated_date = 2026-01-15` (creada desde un movimiento) y aún no generó instancias nuevas
- **THEN** la primera instancia generada se programa para `2026-02-15`

#### Scenario: Primera instancia de una regla directa (last_generated_date nulo)

- **WHEN** una regla mensual tiene `start_date = 2026-01-15`, `last_generated_date = NULL` (creada directamente) y hoy es ≥ `2026-01-15`
- **THEN** la primera instancia generada se programa **para `2026-01-15`**
- **AND** no se generan instancias adicionales mientras esa siga pendiente

#### Scenario: Regla directa con start_date futuro no genera todavía

- **WHEN** una regla directa tiene `start_date = 2026-12-01`, `last_generated_date = NULL` y hoy es anterior a esa fecha
- **THEN** no se genera ninguna instancia hasta que la fecha llegue

#### Scenario: Clamping de fin de mes en febrero

- **WHEN** una regla mensual tiene `start_date = 2026-01-31` y `last_generated_date = 2026-01-31`
- **THEN** la siguiente instancia after enero se programa para `2026-02-28`

#### Scenario: Corte por end_date

- **WHEN** una regla tiene `end_date = 2026-03-01` y la siguiente instancia caería el `2026-03-15`
- **THEN** no se genera ninguna instancia nueva

#### Scenario: La generación corta cuando alcanza max_occurrences

- **WHEN** una regla con `max_occurrences = 3` ya tiene 3 instancias materializadas
- **THEN** no se generan más instancias
