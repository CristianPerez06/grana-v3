# Delta — cards

## ADDED Requirements

### Requirement: El alta de tarjeta captura solo las fechas del resumen actual y crea el siguiente período estimado

El formulario de alta de tarjeta SHALL pedir únicamente el cierre y el vencimiento del resumen actual (`current_end_date`, `current_due_date`) — las dos fechas que el último extracto emitido anunció. El alta NO SHALL pedir fechas del próximo resumen.

Al crear la tarjeta, el sistema SHALL insertar dos períodos:

- **P1 (real)**: `start_date = current_end_date − 30 días`, `end_date = current_end_date`, `due_date = current_due_date`, `is_estimated = false`.
- **P2 (estimado)**: `start_date = current_end_date + 1 día`, con `end_date` y `due_date` proyectados mediante el algoritmo de sugerencia sobre los períodos existentes, `is_estimated = true`.

#### Scenario: Alta con dos fechas crea P1 real y P2 estimado

- **WHEN** un usuario da de alta una tarjeta con `current_end_date='2026-06-16'` y `current_due_date='2026-06-22'`
- **THEN** se crea P1 con `start_date='2026-05-17'`, `end_date='2026-06-16'`, `due_date='2026-06-22'`, `is_estimated=false`
- **AND** se crea P2 con `start_date='2026-06-17'`, `is_estimated=true`, y `end_date`/`due_date` proyectados desde P1

#### Scenario: El formulario no ofrece campos del próximo resumen

- **WHEN** el usuario abre el drawer de alta de tarjeta
- **THEN** la sección de ciclo muestra solo cierre y vencimiento del resumen actual
- **AND** el submit se habilita sin ningún dato del próximo resumen

#### Scenario: Consumo posterior al cierre cae en el período estimado

- **WHEN** la tarjeta tiene P1 (`end_date='2026-06-16'`) y P2 estimado, y el usuario registra un consumo con `date='2026-06-18'`
- **THEN** la transacción se inserta con `card_period_id` apuntando a P2
- **AND** no se pide ninguna fecha al usuario

---

### Requirement: El pago de un resumen confirma las fechas del período en curso y crea el siguiente estimado

Cuando el resumen de un ciclo cierra, el banco emite el extracto e incluye en él las fechas del ciclo siguiente — el que está en curso al momento de pagar. El formulario de pago de P(n) SHALL pedir la **confirmación** de las fechas de P(n+1) (el período inmediatamente posterior al que se paga), pre-llenadas con las fechas persistidas de ese período. NO SHALL pedir fechas de períodos posteriores a P(n+1).

**Confirmación (pisado del estimado):** al registrar el pago, el sistema SHALL actualizar `end_date`/`due_date` de P(n+1) con las fechas ingresadas y marcar `is_estimated=false`. La actualización SHALL reusar la semántica de edición de fechas de período (cascada del borde y reasignación de transacciones):

- Si el cierre real es anterior al estimado, las transacciones de P(n+1) con `date` posterior al nuevo cierre SHALL reasignarse al período siguiente.
- Si P(n+2) existe con `is_estimated=true`, sin transacciones y sin pago, y el nuevo cierre de P(n+1) lo invadiera (`new_end_date >= P(n+2).end_date`), el sistema SHALL re-proyectarlo (`start_date = new_end_date + 1`, fechas re-estimadas) en lugar de rechazar. El rechazo existente de la edición de fechas aplica solo cuando el período siguiente tiene datos reales (transacciones, pago o fechas confirmadas).

**Período siguiente eager:** tras confirmar P(n+1), el sistema SHALL garantizar que exista P(n+2) con `is_estimated=true`, proyectado con el algoritmo de sugerencia desde los períodos confirmados. Si ya existía (generado lazy o re-proyectado), se conserva.

**Validación:** `next_end_date` SHALL ser posterior a `end_date` de P(n) (el `start_date` de P(n+1) es fijo: `P(n).end_date + 1`), y `next_due_date` posterior a `next_end_date`.

**Invariante resultante:** toda fecha de cierre/vencimiento confirmada (`is_estimated=false`) fue ingresada por el usuario en un momento en que el banco ya la había anunciado: P1 en el alta, P(n+1) al pagar P(n). `start_date` nunca se pide ni se estima.

#### Scenario: Pagar P1 confirma las fechas estimadas de P2 y crea P3 estimado

- **WHEN** una tarjeta tiene P1 (`end_date='2026-06-16'`, closed) y P2 estimado (`end_date='2026-07-14'` proyectado), y el usuario paga P1 ingresando `next_end_date='2026-07-16'`, `next_due_date='2026-07-22'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `due_date='2026-07-22'`, `is_estimated=false`
- **AND** se crea P3 con `start_date='2026-07-17'`, `is_estimated=true`, fechas proyectadas
- **AND** P1 queda en estado `paid`

#### Scenario: El formulario de pago se pre-llena con las fechas persistidas del período en curso

- **WHEN** el usuario abre el formulario para pagar P1 y P2 existe con `end_date='2026-07-14'`, `due_date='2026-07-20'`
- **THEN** el formulario muestra `2026-07-14` y `2026-07-20` como valores iniciales de cierre y vencimiento
- **AND** el copy indica que son las fechas del ciclo en curso a confirmar con el resumen recibido

#### Scenario: Cierre real anterior al estimado reubica consumos al período siguiente

- **WHEN** P2 estimado tiene `end_date='2026-07-20'` con un consumo del `2026-07-18`, y al pagar P1 el usuario confirma `next_end_date='2026-07-16'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `is_estimated=false`
- **AND** el consumo del `2026-07-18` queda asignado a P3 (estimado), creado o re-proyectado en la misma operación

#### Scenario: Validación rechaza un cierre que no es posterior al período pagado

- **WHEN** el usuario paga P1 (`end_date='2026-06-16'`) e ingresa `next_end_date='2026-06-10'`
- **THEN** la acción retorna un error localizado que nombra el cierre de P1 como ancla
- **AND** no se registra el pago ni se modifica ningún período

#### Scenario: P3 estimado vacío se re-proyecta en lugar de bloquear la confirmación

- **WHEN** existen P2 estimado (`end_date='2026-07-14'`) y P3 estimado sin transacciones ni pago (`end_date='2026-08-12'`), y al pagar P1 el usuario confirma `next_end_date='2026-08-15'` para P2
- **THEN** la confirmación procede: P2 queda con `end_date='2026-08-15'`, `is_estimated=false`
- **AND** P3 se re-proyecta con `start_date='2026-08-16'` y fechas re-estimadas

---

### Requirement: Los períodos estimados se señalizan en el detalle y la edición de la tarjeta

El sistema SHALL señalizar de forma discreta que las fechas de un período son estimadas (`is_estimated=true`) en el timeline de ciclo de vida del detalle de tarjeta y en el drawer de edición (sección fechas del ciclo). La señalización NO SHALL aparecer en el hero de `/cards`, en las cards del wallet ni en el dashboard.

#### Scenario: Timeline marca el período estimado

- **WHEN** el detalle de una tarjeta renderiza el timeline y el período "En curso" o "Próximo" tiene `is_estimated=true`
- **THEN** ese paso muestra una marca discreta de fechas estimadas (p. ej. "cierra ~DD/MM" o un sufijo "estimado")

#### Scenario: El drawer de edición distingue fechas estimadas

- **WHEN** el usuario abre el drawer de edición de una tarjeta cuyo próximo período es estimado
- **THEN** los campos de fechas de ese período indican que son estimadas y que se confirman al pagar el resumen

#### Scenario: Las superficies de lectura no señalizan

- **WHEN** el hero de `/cards` o el dashboard muestran vencimientos provenientes de períodos estimados
- **THEN** los montos y fechas se muestran sin badge ni marca adicional

## REMOVED Requirements

### Requirement: El pago de un resumen crea el período que le sigue al último período conocido

**Reason**: Su invariante central ("al pagar P(n) el formulario DEBE pedir las fechas de P(n+2)") contradice el propio "Contexto del banco" del requirement: las fechas de un ciclo se anuncian recién cuando cierra el ciclo anterior, por lo que al pagar P(n) el usuario tiene en mano las fechas de P(n+1), no las de P(n+2). El flujo completo (tabla alta→P1+P2, pago→P(n+2)) obligaba a cargar cada fecha adivinada un resumen antes de ser anunciada, persistiéndola como real.

**Migration**: Reemplazado por "El pago de un resumen confirma las fechas del período en curso y crea el siguiente estimado" (ADDED) y "El alta de tarjeta captura solo las fechas del resumen actual y crea el siguiente período estimado" (ADDED). Los períodos existentes en producción con fechas adivinadas no se migran: convergen al confirmarse en el próximo pago o al editarse desde el drawer.
