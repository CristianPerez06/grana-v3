## ADDED Requirements

### Requirement: El onboarding en modo novato auto-crea una cuenta cash y una tarjeta default

El sistema SHALL ejecutar, al completar el onboarding con `users.mode='novato'`, una operación atómica que cree:

1. Una cuenta `accounts` con `type='cash'`, `name='Mi plata'`, `institution_id=NULL`, `is_active=true`, propiedad del usuario.
2. Las filas en `account_currencies` correspondientes a las monedas seleccionadas por el usuario (ARS siempre + USD si activó la segunda moneda), ambas con `initial_balance=0`.
3. Una cuenta `accounts` con `type='credit'`, `name='Mi tarjeta'`, `institution_id=NULL`, `network_id=NULL`, `other_network_name='Mi tarjeta'`, `credit_limit=NULL`, `is_active=true`.
4. La fila en `account_currencies` para esa tarjeta con `currency_code='ARS'` e `initial_balance=0` (USD adicional si el usuario activó la segunda moneda en el onboarding).
5. Dos filas en `card_periods` correspondientes al período actual y al próximo, con fechas calculadas a partir de la única fecha que cargó el usuario (ver requirement de fechas estimadas).

La operación SHALL ser atómica: si cualquier paso falla, todo se rolea hacia atrás.

#### Scenario: Onboarding novato exitoso crea las dos entidades default

- **WHEN** un usuario completa el onboarding eligiendo modo novato, con ARS como moneda principal y la fecha de cierre cargada
- **THEN** existen en `accounts` exactamente dos filas para ese usuario: una `type='cash'` con `name='Mi plata'` y una `type='credit'` con `name='Mi tarjeta'`
- **AND** existe al menos una fila en `account_currencies` para cada cuenta (ARS), con `initial_balance=0`
- **AND** existen exactamente dos filas en `card_periods` para "Mi tarjeta", ambas con `is_estimated=true`

#### Scenario: Falla en cualquier paso del onboarding hace rollback

- **WHEN** durante la operación atómica de onboarding novato falla el INSERT de `card_periods` (por error de constraint)
- **THEN** la cuenta "Mi plata" no queda creada
- **AND** la cuenta "Mi tarjeta" no queda creada
- **AND** el usuario ve un error y puede reintentar

#### Scenario: Onboarding experto no crea entidades default

- **WHEN** un usuario completa el onboarding con modo experto
- **THEN** no se crean "Mi plata" ni "Mi tarjeta" automáticamente
- **AND** el flujo del usuario continúa con las pantallas de gestión manual de cuentas

---

### Requirement: El onboarding novato pide una única fecha para configurar el ciclo de tarjeta

El sistema SHALL incluir en el flujo del onboarding novato un paso con la pregunta literal "¿Cuándo cierra tu actual resumen?" (en presente/futuro, no en pasado) acompañada de un único campo `<input type="date">` que acepta una fecha en el futuro (puede ser hoy, no puede ser anterior a hoy − 7 días por sanity).

A partir de esa fecha cargada (`closeDate`), el sistema SHALL calcular las cuatro fechas del modelo:

- Período actual: `start_date = closeDate − 30 días` (técnico), `end_date = closeDate` (lo cargado), `due_date = closeDate + 15 días`.
- Período próximo: `start_date = closeDate + 1 día`, `end_date = closeDate + 30 días`, `due_date = closeDate + 45 días`.

Ambos períodos SHALL marcarse `is_estimated=true` para indicar que las fechas no fueron confirmadas explícitamente por el usuario (excepto `closeDate` que sí fue cargada).

#### Scenario: Usuario carga fecha de cierre el 15 del mes

- **WHEN** un usuario en modo novato carga `closeDate='2026-06-15'`
- **THEN** el período actual se crea con `start_date='2026-05-16'`, `end_date='2026-06-15'`, `due_date='2026-06-30'`
- **AND** el período próximo se crea con `start_date='2026-06-16'`, `end_date='2026-07-15'`, `due_date='2026-07-30'`
- **AND** ambos tienen `is_estimated=true`

#### Scenario: Fecha cargada en el pasado lejano es rechazada

- **WHEN** un usuario carga `closeDate` con valor anterior a `today − 7 días`
- **THEN** el form muestra error "Tomá la fecha del próximo cierre que figura en tu resumen del banco"
- **AND** no avanza el onboarding

#### Scenario: Fecha cargada en el futuro lejano es aceptada

- **WHEN** un usuario carga `closeDate='2026-06-30'` con `today='2026-05-15'` (45 días en el futuro)
- **THEN** el form acepta la fecha y crea los períodos correspondientes

---

### Requirement: La UI muestra una marca visual cuando las fechas de un período son estimadas

El sistema SHALL renderizar un indicador visual (iconito 📅 o equivalente discreto) en las fechas de cualquier período con `is_estimated=true`. El indicador SHALL aparecer en:

- La card del listado de tarjetas (footer con las fechas).
- El hero del detalle de tarjeta.
- La sección "Períodos" del detalle.
- El historial de resúmenes.
- El detalle de período.

El indicador SHALL desaparecer cuando `is_estimated` pase a `false` (lo cual ocurre al confirmar las fechas via pago de resumen o edición manual).

#### Scenario: Tarjeta novato recién creada muestra fechas marcadas como estimadas

- **WHEN** un usuario novato termina el onboarding y abre el detalle de "Mi tarjeta"
- **THEN** las fechas del período actual y próximo se muestran con un iconito 📅 al lado

#### Scenario: Confirmar fechas al pagar el resumen elimina el indicador

- **WHEN** el usuario paga el primer resumen y carga manualmente las fechas del próximo período (no acepta los sugeridos por la app)
- **THEN** el nuevo `card_periods` queda con `is_estimated=false`
- **AND** la UI ya no muestra el iconito en esas fechas

---

### Requirement: El selector de "cuenta de pago" en el flujo de pago de resumen filtra según modo de usuario

El sistema SHALL adaptar el selector de "cuenta de pago" en el formulario de pago de resumen según el modo del usuario:

- **Modo novato**: el selector SHALL fijarse a "Mi plata" sin permitir cambio (ya que es la única cuenta cash/bank que tiene el novato).
- **Modo experto**: el selector SHALL mostrar todas las cuentas `cash` y `bank` activas del usuario que tengan ARS habilitada.

En ambos modos, el sistema SHALL excluir las cuentas `credit` y las cuentas `bank` con función `ahorro` (cuando ese flag exista).

#### Scenario: Novato paga resumen desde Mi plata fija

- **WHEN** un usuario novato abre el flujo de pago de resumen
- **THEN** el campo "Cuenta de pago" muestra "Mi plata" en estado read-only

#### Scenario: Experto elige entre todas sus cash/bank

- **WHEN** un usuario experto con 3 cuentas (1 cash, 2 bank) abre el flujo de pago
- **THEN** el campo "Cuenta de pago" muestra un selector con las 3 cuentas como opciones
