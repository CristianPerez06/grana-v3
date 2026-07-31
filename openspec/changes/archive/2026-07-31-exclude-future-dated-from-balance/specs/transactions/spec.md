# transactions — delta

## MODIFIED Requirements

### Requirement: El usuario puede registrar un gasto en una cuenta

El sistema SHALL permitir registrar un gasto (plata que sale) en una cuenta. Para `type='cash'` o `type='bank'`, el gasto requiere: cuenta, moneda activa, monto mayor a cero, fecha y categoría; la subcategoría y descripción son opcionales; el sistema persiste con `status=NULL` (no aplica) e impacta saldo según el corte temporal del requirement "El saldo de la cuenta refleja las transacciones en tiempo real": inmediatamente si `date <= hoy_AR`, y recién cuando la fecha llegue si `date > hoy_AR`. Para `type='credit'` (tarjeta), el gasto sigue el requirement específico de consumos en tarjeta (con `status='pending'`, `card_period_id`, eventualmente cuotas, y SIN impacto al saldo disponible) — ver requirement separado.

#### Scenario: Gasto en cash creado correctamente

- **WHEN** el usuario completa el formulario con cuenta cash, moneda, monto > 0, fecha de hoy y categoría válidos y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='expense'`, `status=NULL`, `amount > 0`, y el saldo de la cuenta disminuye en ese monto para la moneda indicada

#### Scenario: Gasto con fecha futura se persiste pero no descuenta saldo todavía

- **WHEN** el usuario registra un gasto con `date` posterior a la fecha financiera AR de hoy
- **THEN** el sistema inserta la fila en `transactions` con `type='expense'`, `status=NULL`
- **AND** el saldo de la cuenta no cambia hasta que `date` llegue

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

### Requirement: El saldo de la cuenta refleja las transacciones en tiempo real

El sistema SHALL calcular el saldo de cada cuenta como `initial_balance + Σ income − Σ expense − Σ transfer saliente + Σ transfer entrante + Σ adjustment` en la moneda correspondiente, considerando únicamente transacciones con `date <= hoy_AR` (la fecha calendario en `America/Argentina/Buenos_Aires`, el mismo "hoy" que `getTodayAR()`). Una transacción con fecha futura NO SHALL aportar al saldo hasta que su fecha llegue; ese día entra automáticamente. No existe columna de saldo cacheada.

El **saldo corriente** por fila del listado de movimientos (running balance) NO cambia con este corte: sigue siendo la proyección cronológica "saldo después de este movimiento" en orden `date ASC, created_at ASC, id ASC`, de modo que una fila futura muestra el saldo proyectado a su fecha. Por construcción, cuando existen movimientos futuros el saldo del header de la cuenta (corte a hoy) puede diferir del saldo corriente de la fila más reciente (proyección).

#### Scenario: Saldo después de crear un ingreso

- **WHEN** el usuario crea un ingreso de $100 ARS con fecha de hoy en una cuenta con `initial_balance_ars = 500`
- **THEN** la pantalla de detalle de esa cuenta muestra saldo ARS = $600

#### Scenario: Saldo después de crear un gasto

- **WHEN** el usuario crea un gasto de $200 ARS con fecha de hoy en una cuenta con `initial_balance_ars = 500` y sin transacciones previas
- **THEN** la pantalla de detalle muestra saldo ARS = $300

#### Scenario: Saldo después de crear una transferencia saliente

- **WHEN** el usuario crea una transferencia de `$150 ARS` con fecha de hoy desde la cuenta A (saldo $500) hacia la cuenta B (saldo $0)
- **THEN** la pantalla de detalle de A muestra saldo ARS = `$350` y la de B muestra saldo ARS = `$150`

#### Scenario: Saldo después de crear un ajuste

- **WHEN** el usuario crea un ajuste de `+$30 ARS` con fecha de hoy en una cuenta con saldo de `$500`
- **THEN** la pantalla de detalle muestra saldo ARS = `$530`

#### Scenario: Saldo puede ser negativo

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: ARS y USD se calculan por separado

- **WHEN** la cuenta tiene transacciones en ARS y en USD
- **THEN** el sistema muestra saldos independientes por moneda; nunca los convierte ni combina

#### Scenario: Un movimiento futuro no altera el saldo de hoy

- **WHEN** hoy es `2026-07-31` y existe un gasto de `$200 ARS` con `date = 2026-08-05` en una cuenta con saldo `$500`
- **THEN** el saldo mostrado (header de cuenta, Hero/Disponible, "Dónde está") sigue siendo `$500`
- **AND** la fila futura del listado muestra su saldo corriente proyectado (`$300`)

---

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, frecuencia, fecha de inicio y condicion de fin opcional.

La frecuencia SHALL modelarse como un par `interval_count` (entero ≥ 1) e `interval_unit` (`day | week | month | year`). El campo `frequency` SHALL persistir la etiqueta de la regla: uno de los presets (`weekly`, `biweekly`, `monthly`, `annual`) o `custom`. Los presets SHALL resolver a un par intervalo+unidad fijo: `weekly`⇒`(1, week)`, `biweekly`⇒`(2, week)`, `monthly`⇒`(1, month)`, `annual`⇒`(1, year)`. `custom` SHALL usar el par elegido por el usuario.

La condicion de fin SHALL ser opcional y poder expresarse como `end_date` (fecha límite) y/o `max_occurrences` (entero ≥ 1, cantidad máxima de ocurrencias). Ambas pueden coexistir.

El movimiento semilla SHALL depender de la fecha elegida:

- **`date <= hoy_AR`**: el movimiento registrado SHALL crearse como transaccion real normal usando el flujo existente, y la regla SHALL apuntar a ese movimiento mediante `created_from_transaction_id` (comportamiento actual, sin cambios).
- **`date > hoy_AR`**: el sistema NO SHALL crear ninguna transaccion real ni ninguna instancia en ese momento. SHALL crear únicamente la regla, con la semántica de la creación directa: `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date =` la fecha elegida, de modo que la primera instancia pendiente la produzca el generador **exactamente en esa fecha** y pase por el gate de confirmación de instancias ("Las instancias recurrentes pendientes no son transacciones reales"). El saldo NO SHALL cambiar hasta que el usuario confirme esa instancia.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el ingreso real en `transactions` con `status=NULL`
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Gasto de tarjeta recurrente creado desde registro

- **WHEN** el usuario registra un consumo simple en tarjeta con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea el consumo real de tarjeta con `status='pending'` y `card_period_id`
- **AND** crea una regla recurrente de tipo `expense` asociada a esa tarjeta
- **AND** la regla no modifica el estado del resumen

#### Scenario: Transferencia recurrente creada desde registro

- **WHEN** el usuario registra una transferencia con fecha de hoy y activa "Recurrente"
- **THEN** el sistema crea la transferencia real
- **AND** crea una regla recurrente con cuenta origen y cuenta destino

#### Scenario: Movimiento recurrente con fecha futura no crea semilla

- **WHEN** hoy es `2026-07-31` y el usuario registra un gasto en cuenta cash con `date = 2026-08-10` y activa "Recurrente"
- **THEN** el sistema NO inserta ninguna fila en `transactions`
- **AND** crea una regla recurrente con `created_from_transaction_id = NULL`, `last_generated_date = NULL` y `start_date = 2026-08-10`
- **AND** el saldo de la cuenta no cambia

#### Scenario: La primera instancia de una regla sembrada a futuro cae en la fecha elegida

- **WHEN** existe una regla creada desde el form con `start_date = 2026-08-10` (fecha futura, sin semilla) y la fecha financiera AR llega a `2026-08-10`
- **THEN** el generador produce una única instancia pendiente con `scheduled_date = 2026-08-10`
- **AND** el saldo cambia recién cuando el usuario confirma esa instancia

#### Scenario: Consumo recurrente de tarjeta con fecha futura tampoco crea semilla

- **WHEN** el usuario registra un consumo simple en tarjeta con `date` futura y activa "Recurrente"
- **THEN** el sistema NO inserta ningún consumo con `card_period_id`
- **AND** crea la regla `expense` asociada a la tarjeta con `start_date =` la fecha elegida
- **AND** el resumen de la tarjeta no cambia hasta que el usuario confirme la instancia cuando llegue la fecha
