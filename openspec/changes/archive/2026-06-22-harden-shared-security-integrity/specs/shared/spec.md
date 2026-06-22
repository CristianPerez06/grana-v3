## MODIFIED Requirements

### Requirement: El usuario puede unirse a un hogar con un código

El sistema SHALL permitir que un usuario sin hogar se una a un hogar existente ingresando un código de invitación válido, **únicamente a través de una operación privilegiada (`SECURITY DEFINER`) acotada al código**. El código debe existir, no estar vencido, no haber sido usado, y el hogar debe estar activo y tener cupo. La operación SHALL, de forma atómica: agregar al usuario como segundo miembro, marcar la invitación como usada, y reconfigurar el split por defecto a 50·50. Un usuario NO SHALL poder sumarse a un hogar mediante escritura directa del cliente sin una invitación válida, ni descubrir hogares ajenos enumerando invitaciones (ver el requisito de RLS).

#### Scenario: Unión exitosa con código válido

- **WHEN** un usuario sin hogar ingresa un código vigente, no usado, de un hogar activo con cupo
- **THEN** la operación privilegiada agrega al usuario como segundo miembro, marca la invitación como usada, y reconfigura el split por defecto a 50·50, todo de forma atómica

#### Scenario: Código vencido o usado es rechazado

- **WHEN** un usuario ingresa un código vencido (más de 48 h) o ya utilizado
- **THEN** el sistema rechaza la unión con un error explicativo distinguible (vencido / usado) y no modifica el hogar

#### Scenario: No se puede unir si el hogar está completo

- **WHEN** un usuario ingresa un código de un hogar que ya tiene dos miembros
- **THEN** el sistema rechaza la unión

#### Scenario: No se puede sumar a un hogar sin una invitación válida

- **WHEN** un usuario logueado intenta insertarse como miembro de un hogar ajeno por escritura directa (sin pasar por la operación privilegiada y sin un código válido)
- **THEN** la base rechaza el INSERT: el self-insert directo solo está permitido para el creador como primer miembro de su propio hogar

### Requirement: El usuario puede saldar deuda registrando una liquidación

El sistema SHALL permitir que el miembro deudor registre una liquidación (total o parcial) seleccionando moneda, monto (≤ deuda actual en esa moneda) y la cuenta cash/bank de la que sale el dinero. El registro SHALL ejecutarse mediante una **operación privilegiada atómica** que crea la pata del pagador (un movimiento de tipo `settlement` real en su cuenta, con `user_id` y `payer_id` fijados server-side desde la identidad del caller) **y** la fila `settlement` (estado "pendiente de asignación de cuenta del receptor") en una sola transacción, sin posibilidad de dejar una pata huérfana. El movimiento `settlement` impacta el saldo pero NO se cuenta como gasto categorizable ni aparece en los desgloses de "en qué se fue". El monto SHALL ser mayor a cero y no exceder la deuda vigente en esa moneda (validación server-side previa a la operación).

#### Scenario: Registrar una liquidación total

- **WHEN** A debe `$50 ARS` y registra una liquidación de `$50 ARS` desde su cuenta cash
- **THEN** la operación privilegiada crea, en una sola transacción, un movimiento `settlement` de `$50 ARS` en la cuenta de A (su saldo baja, sin contar como gasto) y una fila `settlement` pendiente de asignación por B

#### Scenario: Monto que excede la deuda es rechazado

- **WHEN** A intenta registrar una liquidación por un monto mayor a su deuda vigente en esa moneda
- **THEN** el sistema rechaza la operación con error de validación

#### Scenario: El alta no puede dejar una pata huérfana

- **WHEN** falla la inserción de la fila `settlement` durante el registro
- **THEN** la pata del pagador tampoco persiste (la operación es atómica), y el saldo de A queda intacto

### Requirement: El receptor asigna la cuenta donde recibió la liquidación

El sistema SHALL mostrarle al miembro receptor las liquidaciones pendientes de asignar, y permitirle elegir la cuenta cash/bank donde recibió el dinero. La confirmación SHALL ejecutarse mediante una **operación privilegiada atómica** que valida que el caller es el receptor y que la liquidación está pendiente, crea un movimiento `settlement` real en esa cuenta (su saldo sube, sin contar como ingreso) con la fecha de asignación, y marca la liquidación como completada, en una sola transacción. La deuda neta se recalcula en consecuencia. No existe un paso de aceptar/rechazar.

La corrección de errores SHALL ser libre mientras la liquidación está **pendiente** (solo existe la pata del pagador, que es su propio movimiento). Una vez **completada**, la pata del receptor es un movimiento de otro usuario; revertir la liquidación SHALL realizarse mediante una operación privilegiada acotada al hogar que revierte ambas patas de forma atómica, no mediante escritura cross-user desde el cliente. La tabla `settlement` NO SHALL aceptar escritura directa del cliente (INSERT/UPDATE): todas sus transiciones de estado pasan por operaciones privilegiadas.

#### Scenario: El receptor asigna su cuenta y recibe el ingreso

- **WHEN** B ve una liquidación pendiente de `$50 ARS` de A y selecciona su cuenta cash
- **THEN** la operación privilegiada crea un movimiento `settlement` entrante de `$50 ARS` en la cuenta de B, marca la liquidación como completada, y la deuda neta se reduce en consecuencia

#### Scenario: Solo el receptor puede confirmar

- **WHEN** un miembro que no es el receptor de la liquidación intenta confirmarla
- **THEN** la operación privilegiada rechaza la confirmación

#### Scenario: Corrección libre mientras está pendiente

- **WHEN** A registró una liquidación equivocada que aún está pendiente de asignación por B
- **THEN** A puede eliminar la liquidación; eliminarla borra su propia pata `settlement` (gobernada por la RLS owner-only de `transactions`) y la fila `settlement` cascadea, restaurando su saldo

#### Scenario: Revertir una liquidación completada usa una operación privilegiada

- **WHEN** se necesita deshacer una liquidación que B ya completó
- **THEN** la reversión la realiza una operación privilegiada acotada al hogar que elimina ambas patas (la de A y la de B) de forma atómica
- **AND** el cliente no intenta borrar el movimiento del otro usuario directamente

#### Scenario: Un miembro no puede mutar campos arbitrarios de una liquidación

- **WHEN** un miembro intenta hacer UPDATE directo de una fila `settlement` (cambiar monto, receptor, estado, etc.)
- **THEN** la base rechaza la escritura: no existe policy de UPDATE directa sobre `settlement`

### Requirement: Un miembro puede leer los datos compartidos de su hogar

El sistema SHALL aplicar Row Level Security sobre las tablas del módulo (`household`, `household_member`, `household_invite`, `shared_expense_split`, `settlement`) de forma que un usuario solo acceda a los datos de su propio hogar. En particular, las **invitaciones** (`household_invite`) SHALL ser legibles **solo por miembros** del hogar al que pertenecen; un no-miembro NO SHALL poder enumerar ni leer invitaciones ajenas (la resolución de un código para unirse ocurre dentro de la operación privilegiada de unión, no por lectura directa). Adicionalmente, un miembro SHALL poder leer las cuentas del otro miembro estrictamente en la medida necesaria para seleccionar destino/origen al liquidar.

#### Scenario: Lectura acotada al propio hogar

- **WHEN** un usuario consulta `shared_expense_split` o `settlement`
- **THEN** Supabase retorna únicamente las filas cuyo `household_id` corresponde al hogar del usuario

#### Scenario: Un extraño no ve datos del hogar

- **WHEN** un usuario que no pertenece a un hogar consulta sus datos compartidos
- **THEN** Supabase no retorna ninguna fila de ese hogar

#### Scenario: Un no-miembro no puede enumerar invitaciones ajenas

- **WHEN** un usuario logueado consulta `household_invite` de un hogar del que no es miembro
- **THEN** Supabase no retorna ninguna invitación (la lectura de invitaciones está acotada a miembros)

## ADDED Requirements

### Requirement: No se puede borrar un gasto compartido con una liquidación viva en el hogar

El sistema SHALL impedir el borrado de un gasto compartido (`is_shared = true`) mientras exista **alguna** liquidación (`settlement`) en su hogar, porque la deuda se salda por **neto** y no se imputan pagos a gastos puntuales: borrar el gasto cambiaría en silencio una deuda que una liquidación ya contabilizó. La guarda SHALL vivir en la base (trigger `BEFORE DELETE` sobre `transactions`), y la capa de aplicación SHALL presentar un mensaje explicativo que indique revertir la liquidación antes de borrar. Las patas de los movimientos de tipo `settlement` (que son `is_shared = false`) quedan exentas de esta guarda, de modo que revertir o eliminar una liquidación sigue siendo posible.

#### Scenario: Borrado bloqueado por liquidación viva

- **WHEN** un usuario intenta borrar un gasto compartido y existe al menos una liquidación en su hogar
- **THEN** la base rechaza el borrado y la aplicación explica que primero debe revertir la liquidación

#### Scenario: Borrado permitido sin liquidaciones

- **WHEN** un usuario borra un gasto compartido y no existe ninguna liquidación en su hogar
- **THEN** el borrado procede y la deuda derivada se recalcula sin la parte de ese gasto

#### Scenario: Revertir una liquidación no queda bloqueado por la guarda

- **WHEN** una operación privilegiada revierte una liquidación borrando sus patas `settlement`
- **THEN** la guarda no se dispara (las patas son `is_shared = false`) y la reversión procede

### Requirement: Los splits de un gasto compartido suman exactamente su monto

El sistema SHALL garantizar en la base que, para cada transacción con splits, la suma de `amount_assigned` de sus `shared_expense_split` es **exactamente igual** al `amount` de la transacción. El chequeo SHALL ser un invariante diferido a fin de transacción (los splits se insertan fila por fila) y SHALL evaluarse por `transaction_id` (para cuotas, por cada cuota hija).

#### Scenario: Splits que no cubren el total son rechazados

- **WHEN** al cierre de una transacción los splits de un gasto compartido suman un monto distinto al `amount` de la transacción
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Reparto válido pasa el invariante

- **WHEN** un gasto de `$100,01` se reparte 50·50 en `$50,01` + `$50,00`
- **THEN** la suma es exactamente `$100,01` y el invariante se satisface

### Requirement: El dueño de un split de gasto compartido es miembro del hogar

El sistema SHALL garantizar en la base que el `user_id` de todo `shared_expense_split` sea miembro del `household_id` de ese split. No SHALL poder asignarse una parte a un usuario que no pertenece al hogar.

#### Scenario: Split a un no-miembro es rechazado

- **WHEN** se intenta insertar o actualizar un `shared_expense_split` cuyo `user_id` no es miembro del `household_id`
- **THEN** la base rechaza la operación con error de invariante

### Requirement: Un usuario pertenece a lo sumo a un hogar activo

El sistema SHALL garantizar en la base que un usuario sea miembro de **a lo sumo un hogar activo** (`household.is_active = true`) a la vez. El alta de membresía —tanto del creador como del segundo miembro vía la operación privilegiada de unión— SHALL respetar este invariante.

#### Scenario: No se puede pertenecer a dos hogares activos

- **WHEN** un usuario que ya es miembro de un hogar activo intenta agregarse a un segundo hogar activo
- **THEN** la base rechaza el alta de membresía con error de invariante
