## ADDED Requirements

### Requirement: El sistema usa un formulario único para crear y editar movimientos

El sistema SHALL usar **un único formulario** para crear y editar todo tipo de movimiento (ingreso, gasto, transferencia, ajuste, cambio de moneda, consumo de tarjeta y compra en cuotas). En **modo creación** el usuario elige el tipo y la cuenta dentro del formulario; en **modo edición** el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable y sólo se ofrecen los campos editables.

Qué campos son editables y cuáles visibles según el tipo y el estado del movimiento SHALL derivarse de una **función pura** (`getEditableFields`) en `@grana/money-logic`, única fuente de verdad de esas reglas, reutilizable por web y mobile. Esta función NO cambia las reglas de editabilidad ya especificadas (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota pagada, pago de resumen sin categoría); las centraliza.

En **modo creación**, el selector de cuenta SHALL mostrar el **saldo disponible actual de cada cuenta por moneda** (bimoneda). Las tarjetas de crédito NO muestran saldo (son off-ledger).

#### Scenario: El mismo formulario crea y edita

- **WHEN** el usuario crea un movimiento nuevo y, en otro momento, edita uno existente
- **THEN** ambas pantallas usan el mismo formulario
- **AND** en edición el tipo, la moneda y la cuenta se muestran como contexto no editable

#### Scenario: La editabilidad la decide una función pura

- **WHEN** el formulario renderiza un movimiento en modo edición
- **THEN** los campos editables y visibles se determinan por `getEditableFields` según el tipo y estado del movimiento
- **AND** un consumo de tarjeta `paid` o una compra en cuotas con alguna cuota `paid` sólo permite editar categoría/descripción (monto y fecha bloqueados)

#### Scenario: El selector de cuenta muestra el saldo por moneda

- **WHEN** el usuario abre el formulario de alta y despliega el selector de cuenta
- **THEN** cada cuenta de efectivo/banco muestra su saldo disponible actual por moneda
- **AND** las tarjetas de crédito no muestran saldo

### Requirement: Las rutas de movimiento son canónicas bajo `/transactions`

Cada movimiento SHALL tener **una única URL canónica** bajo `/transactions`: el detalle en `/transactions/<id>`, la edición en `/transactions/<id>/edit` y el alta en `/transactions/new`. El árbol scoped por cuenta `/accounts/<id>/transactions/*` (alta, detalle, edición) NO SHALL existir.

El contexto de cuenta SHALL transmitirse por query params, no por jerarquía de ruta: `?account=<id>` pre-selecciona la cuenta en el alta (lo usan los accesos desde el detalle de una cuenta o de una tarjeta), y `?from=<origen>` determina la navegación de retorno y la perspectiva de la pantalla (mecanismo del Change 1). Los accesos desde el detalle de cuenta y de tarjeta (filas, CTA de alta, pago de resumen) SHALL apuntar a las rutas canónicas con esos params.

#### Scenario: Una sola URL por movimiento

- **WHEN** el usuario abre un movimiento desde el listado global o desde la lista de una cuenta
- **THEN** llega a `/transactions/<id>`, la misma URL en ambos casos
- **AND** el `?from=` ajusta sólo el back-nav (al listado global o a la cuenta de origen)

#### Scenario: Alta pre-seleccionando una cuenta

- **WHEN** el usuario toca "registrar" desde el detalle de una cuenta o "registrar consumo" desde una tarjeta
- **THEN** se abre `/transactions/new?account=<id>` con esa cuenta ya elegida en el selector
- **AND** si la cuenta es una tarjeta de crédito, el formulario arranca en el tipo Gasto
- **AND** al guardar vuelve al origen indicado por `?from=` (la cuenta o la tarjeta), o a `/transactions` si no hay origen

#### Scenario: Las rutas scoped ya no existen

- **WHEN** se intenta acceder a `/accounts/<id>/transactions/...`
- **THEN** la ruta no existe (404); el árbol fue eliminado y los enlaces internos apuntan a las rutas canónicas

## MODIFIED Requirements

### Requirement: El usuario puede editar y eliminar un movimiento desde el módulo global

El detalle global de un movimiento (`/transactions/<id>`) SHALL ofrecer las acciones de Editar y Eliminar, sin obligar al usuario a navegar primero al detalle en contexto de cuenta. La edición SHALL abrir la ruta canónica `/transactions/<id>/edit`, renderizada por el **formulario único** en modo edición. Estas acciones SHALL respetar exactamente las mismas reglas de edición y eliminación ya definidas (campos mutables por tipo, propagación en compras en cuotas, bloqueos por estado `paid`), ahora gobernadas por la función pura `getEditableFields`. Ningún movimiento accesible desde el listado global SHALL quedar sin camino para editarse o eliminarse.

#### Scenario: Editar desde el detalle global

- **WHEN** el usuario abre un ingreso, gasto, transferencia, ajuste o cambio desde `/transactions` y elige "Editar"
- **THEN** el sistema navega a `/transactions/<id>/edit` y abre el formulario único con los campos editables según el tipo del movimiento (resueltos por `getEditableFields`)
- **AND** al guardar, recalcula los saldos afectados y vuelve al origen indicado por `?from=`

#### Scenario: Eliminar desde el detalle global

- **WHEN** el usuario elige "Eliminar" en el detalle global de un movimiento
- **THEN** el sistema pide confirmación antes de borrar
- **AND** al confirmar, elimina el movimiento, recalcula los saldos afectados y vuelve a `/transactions`

#### Scenario: Una compra en cuotas es accionable desde el detalle global

- **WHEN** el usuario abre una compra en cuotas (la madre, `is_parent=true`, `account_id=NULL`) desde `/transactions`
- **THEN** el detalle global ofrece Editar y Eliminar sin quedar en un callejón sin salida
- **AND** la eliminación solo procede si todas las hijas están `pending`, según las reglas existentes de compras en cuotas

#### Scenario: El monto es editable salvo en compras/consumos de tarjeta ya pagados

- **WHEN** el usuario edita un movimiento
- **THEN** el monto es editable para movimientos normales (efectivo/banco) y para consumos o compras de tarjeta **no pagados**
- **AND** al editar el monto de una compra en cuotas no pagada, el sistema re-divide el total entre las N cuotas (el residuo en la primera)
- **AND** si es un consumo simple de tarjeta `paid` o una compra en cuotas con alguna cuota `paid`, el monto y la fecha quedan bloqueados y solo se permite editar categoría/descripción

#### Scenario: Las acciones globales respetan los bloqueos existentes

- **WHEN** el usuario intenta editar un campo bloqueado o eliminar un movimiento no eliminable (p. ej. un consumo de tarjeta `paid` o una cuota individual)
- **THEN** el sistema rechaza la operación con el mismo criterio de siempre
- **AND** no se produce ningún cambio de estado ni de saldo

### Requirement: El usuario puede registrar un movimiento desde el módulo global

El módulo global de Movimientos (`/transactions`) SHALL ofrecer el **punto de entrada único** para registrar un nuevo movimiento, de modo que el usuario no esté obligado a entrar primero a una cuenta para cargar un ingreso, gasto, transferencia, ajuste o cambio. El alta SHALL vivir en la ruta canónica `/transactions/new`; no existe un alta scoped por cuenta. La cuenta puede venir **pre-seleccionada** vía `?account=<id>` cuando el alta se lanza desde el detalle de una cuenta o de una tarjeta.

#### Scenario: Punto de entrada visible en el módulo global

- **WHEN** el usuario autenticado abre `/transactions`
- **THEN** ve una acción para registrar un nuevo movimiento
- **AND** al activarla accede a `/transactions/new`

#### Scenario: La cuenta se elige dentro del formulario, después del tipo

- **WHEN** el usuario abre el flujo de registro desde el módulo global sin cuenta pre-seleccionada
- **THEN** el formulario muestra primero el selector de tipo (ingreso/gasto/transferencia/ajuste/cambio) y, debajo, la cuenta como un campo que se elige mientras se carga el movimiento (sin un paso previo de selección de cuenta)
- **AND** para gasto, el selector de cuenta incluye tarjetas de crédito; al elegir una, aparecen las cuotas (ARS) o la cotización (USD) inline
- **AND** para ingreso/transferencia/ajuste el selector ofrece solo cuentas de efectivo/banco

#### Scenario: Alta con cuenta pre-seleccionada

- **WHEN** el usuario abre `/transactions/new?account=<id>` desde una cuenta o una tarjeta
- **THEN** el selector arranca con esa cuenta elegida
- **AND** si es una tarjeta de crédito, el formulario arranca en el tipo Gasto

#### Scenario: Al guardar se vuelve al origen

- **WHEN** el usuario guarda un movimiento desde `/transactions/new`
- **THEN** si había `?from=` (una cuenta o una tarjeta), el sistema vuelve a ese origen
- **AND** si no había origen, vuelve a `/transactions` (el listado), no al detalle de la cuenta ni de la tarjeta

#### Scenario: El registro respeta las reglas de creación existentes

- **WHEN** el usuario registra un movimiento desde `/transactions/new`
- **THEN** se aplican las mismas validaciones de creación vigentes (moneda activa en la cuenta, monto válido, categoría obligatoria para ingreso/gasto, fecha contable)
- **AND** el movimiento creado aparece en el listado global
