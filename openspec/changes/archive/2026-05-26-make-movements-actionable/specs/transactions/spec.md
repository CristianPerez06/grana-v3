## ADDED Requirements

### Requirement: El usuario puede editar y eliminar un movimiento desde el módulo global

El detalle global de un movimiento (`/transactions/<transaction_id>`) SHALL ofrecer las acciones de Editar y Eliminar, sin obligar al usuario a navegar primero al detalle en contexto de cuenta. Estas acciones SHALL respetar exactamente las mismas reglas de edición y eliminación ya definidas para el detalle en-cuenta (campos mutables por tipo, propagación en compras en cuotas, bloqueos por estado `paid`). Ningún movimiento accesible desde el listado global SHALL quedar sin camino para editarse o eliminarse.

#### Scenario: Editar desde el detalle global

- **WHEN** el usuario abre un ingreso, gasto, transferencia o ajuste desde `/transactions` y elige "Editar"
- **THEN** el sistema abre el formulario de edición con los campos mutables según el tipo del movimiento
- **AND** al guardar, recalcula los saldos afectados y vuelve al origen global

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
- **THEN** el sistema rechaza la operación con el mismo criterio que en el detalle en-cuenta
- **AND** no se produce ningún cambio de estado ni de saldo

### Requirement: El usuario puede registrar un movimiento desde el módulo global

El módulo global de Movimientos (`/transactions`) SHALL ofrecer un punto de entrada para registrar un nuevo movimiento, de modo que el usuario no esté obligado a entrar primero a una cuenta para cargar un ingreso, gasto, transferencia o ajuste.

#### Scenario: Punto de entrada visible en el módulo global

- **WHEN** el usuario autenticado abre `/transactions`
- **THEN** ve una acción para registrar un nuevo movimiento
- **AND** al activarla accede al flujo de registro de movimiento

#### Scenario: La cuenta se elige dentro del formulario, después del tipo

- **WHEN** el usuario abre el flujo de registro desde el módulo global
- **THEN** el formulario muestra primero el selector de tipo (ingreso/gasto/transferencia/ajuste) y, debajo, la cuenta como un campo que se elige mientras se carga el movimiento (sin un paso previo de selección de cuenta)
- **AND** para gasto, el selector de cuenta incluye tarjetas de crédito; al elegir una, aparecen las cuotas (ARS) o la cotización (USD) inline
- **AND** para ingreso/transferencia/ajuste el selector ofrece solo cuentas de efectivo/banco

#### Scenario: Al registrar desde el módulo global se vuelve al listado

- **WHEN** el usuario guarda un movimiento desde el flujo de registro iniciado en `/transactions`
- **THEN** el sistema lo redirige a `/transactions` (el listado de movimientos), no al detalle de la cuenta ni al de la tarjeta

#### Scenario: El registro respeta las reglas de creación existentes

- **WHEN** el usuario registra un movimiento desde el flujo iniciado en el módulo global
- **THEN** se aplican las mismas validaciones de creación vigentes (moneda activa en la cuenta, monto válido, categoría obligatoria para ingreso/gasto, fecha contable)
- **AND** el movimiento creado aparece en el listado global

### Requirement: El sistema avisa sin bloquear cuando una operación dejaría el disponible de la cuenta en negativo

Cuando una operación reduciría el `disponible` de la cuenta origen por debajo de 0, el sistema SHALL mostrar un aviso no bloqueante antes de confirmar. El aviso informa al usuario; NO impide registrar la operación (el saldo negativo está permitido). La comparación SHALL hacerse contra el `disponible` actual de **esa cuenta puntual** (la cuenta origen del movimiento) y **por moneda** (ARS y USD se evalúan por separado, nunca combinados), NO contra un total agregado entre cuentas. Las operaciones cubiertas son: gasto, transferencia saliente, ajuste negativo, confirmación de instancia recurrente y pago de resumen de tarjeta. Las transacciones de tarjeta de crédito son off-ledger y NO disparan el aviso.

#### Scenario: Gasto que supera el disponible de la cuenta muestra aviso

- **WHEN** la cuenta "Galicia" tiene `disponible` ARS = `$8.000` y el usuario está por registrar un gasto de `$10.000 ARS`
- **THEN** el sistema muestra un aviso de que la operación deja el saldo de esa cuenta en negativo antes de confirmar

#### Scenario: El aviso no impide registrar

- **WHEN** el usuario confirma la operación a pesar del aviso
- **THEN** el sistema registra el movimiento normalmente
- **AND** el `disponible` de la cuenta queda en negativo (`-$2.000 ARS`), mostrado tal cual

#### Scenario: La comparación es por cuenta y por moneda, no por total

- **WHEN** el usuario tiene `disponible` ARS = `$8.000` en "Galicia" y `$50.000` en "Efectivo", y registra un gasto de `$10.000 ARS` en "Galicia"
- **THEN** el aviso se dispara porque la cuenta origen "Galicia" queda en negativo
- **AND** el saldo de otras cuentas o el total entre cuentas no se usa para decidir si avisar
- **AND** el `disponible` en USD de la misma cuenta no interviene en la evaluación

#### Scenario: Operación que no deja la cuenta en negativo no muestra aviso

- **WHEN** la cuenta tiene `disponible` ARS = `$50.000` y el usuario registra un gasto de `$10.000 ARS`
- **THEN** el sistema no muestra el aviso de saldo negativo

#### Scenario: El aviso cubre transferencia saliente, ajuste negativo, confirmar recurrencia y pago de resumen

- **WHEN** una transferencia saliente, un ajuste negativo, la confirmación de una instancia recurrente o un pago de resumen dejarían el `disponible` de la cuenta origen por debajo de 0
- **THEN** el sistema muestra el aviso no bloqueante antes de confirmar
- **AND** permite completar la operación si el usuario insiste

#### Scenario: Los consumos de tarjeta de crédito no disparan el aviso

- **WHEN** el usuario registra un consumo (simple o en cuotas) en una cuenta `type='credit'`
- **THEN** el sistema no muestra el aviso de saldo negativo
- **AND** el consumo no afecta el `disponible` de ninguna cuenta cash/bank (off-ledger)
