# Delta — Frecuencia personalizada en recurrencias

## MODIFIED Requirements

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, **frecuencia**, fecha de inicio y condicion de fin opcional.

La **frecuencia** SHALL modelarse como un par `interval_count` (entero ≥ 1) e `interval_unit` (`day | week | month | year`). El campo `frequency` SHALL persistir la etiqueta de la regla: uno de los presets (`weekly`, `biweekly`, `monthly`, `annual`) o `custom`. Los presets SHALL resolver a un par intervalo+unidad fijo: `weekly`⇒`(1, week)`, `biweekly`⇒`(2, week)`, `monthly`⇒`(1, month)`, `annual`⇒`(1, year)`. `custom` SHALL usar el par elegido por el usuario.

La condicion de fin SHALL ser opcional y poder expresarse como `end_date` (fecha límite) y/o `max_occurrences` (entero ≥ 1, cantidad máxima de ocurrencias). Ambas pueden coexistir.

El movimiento registrado en ese momento SHALL crearse como transaccion real normal usando el flujo existente. La regla recurrente SHALL apuntar opcionalmente a ese movimiento mediante `created_from_transaction_id`.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso y activa "Recurrente"
- **THEN** crea una transaccion real de ingreso por ese movimiento
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Recurrencia con preset mensual persiste su intervalo derivado

- **WHEN** el usuario crea una recurrencia con `frequency = monthly`
- **THEN** la regla persiste `interval_count = 1` e `interval_unit = month`
- **AND** `frequency` queda como `monthly`

#### Scenario: Recurrencia personalizada cada 3 meses

- **WHEN** el usuario elige "Personalizado" con `cada 3 · meses`
- **THEN** la regla persiste `frequency = custom`, `interval_count = 3`, `interval_unit = month`

#### Scenario: Recurrencia personalizada con fin por ocurrencias

- **WHEN** el usuario crea una recurrencia personalizada `cada 2 · semanas` con límite de `6` ocurrencias
- **THEN** la regla persiste `interval_count = 2`, `interval_unit = week`, `max_occurrences = 6`

## ADDED Requirements

### Requirement: La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin

El sistema SHALL calcular la fecha de la siguiente instancia recurrente aplicando `interval_count` veces la `interval_unit` sobre la fecha de la instancia previa (o `start_date` para la primera). El cálculo SHALL aplicar clamping de fin de mes: avanzar por `month` o `year` desde un día que no existe en el mes destino SHALL caer al último día válido de ese mes (p. ej. 31-ene + 1 mes ⇒ 28/29-feb).

El generador secuencial SHALL detener la generación de nuevas instancias cuando se cumpla **la primera** de estas condiciones: (a) la próxima fecha supera `end_date`, o (b) la cantidad de instancias ya materializadas para la regla alcanza `max_occurrences`. Si ninguna condición de fin está seteada, la regla genera indefinidamente como hoy.

#### Scenario: Próxima ocurrencia con intervalo personalizado

- **WHEN** una regla `cada 10 · días` tiene su última instancia con fecha 2026-05-01
- **THEN** la siguiente instancia se genera con fecha 2026-05-11

#### Scenario: Clamping de fin de mes en intervalo mensual

- **WHEN** una regla `cada 1 · mes` tiene una instancia con fecha 2026-01-31
- **THEN** la siguiente instancia se genera con fecha 2026-02-28

#### Scenario: Corte por max_occurrences

- **WHEN** una regla con `max_occurrences = 3` ya materializó 3 instancias (confirmadas u omitidas)
- **THEN** el sistema no genera una cuarta instancia pendiente

#### Scenario: Corte por la primera condición que se cumple

- **WHEN** una regla tiene `end_date = 2026-12-31` y `max_occurrences = 5`, y la quinta ocurrencia caería en 2026-08-01
- **THEN** el sistema corta en la quinta ocurrencia (gana `max_occurrences` por ocurrir antes que `end_date`)
