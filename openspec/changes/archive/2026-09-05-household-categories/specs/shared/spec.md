## ADDED Requirements

### Requirement: Un movimiento compartido solo referencia categorías legibles por todo el hogar

El sistema SHALL garantizar que la categoría y la subcategoría de todo movimiento compartido (`is_shared = true`) sean del sistema o del hogar de ese movimiento, nunca propias de un miembro. La garantía SHALL vivir en la base: al crear o modificar un movimiento compartido cuya categoría o subcategoría es propia de quien lo carga, esa categoría o subcategoría SHALL pasar automáticamente al hogar del movimiento. La misma regla aplica a las reglas de recurrencia compartidas.

La regla es automática y silenciosa a propósito: pedirle al usuario que decida la propiedad de la categoría antes de compartir es una pregunta que no entiende, y compartir "después" un gasto ya categorizado es un camino tan válido como compartir al cargar.

La migración de este cambio SHALL aplicar la misma regla sobre lo ya cargado, de modo que después de aplicarla no exista ningún movimiento ni recurrencia compartida con categoría o subcategoría propia.

#### Scenario: Compartir un gasto con categoría propia la pasa al hogar

- **WHEN** Cristian carga o marca como compartido un gasto con su categoría propia "Hogar - La Foresta"
- **THEN** la categoría pasa al hogar en la misma operación
- **AND** Julieta ve el gasto con su nombre de categoría en la dona, la lista y los chips de filtro

#### Scenario: Compartir un gasto con subcategoría propia bajo categoría del sistema

- **WHEN** Julieta comparte un gasto clasificado como "Comida > Verdulería", con "Verdulería" subcategoría propia
- **THEN** "Verdulería" pasa al hogar
- **AND** Cristian ve el gasto con su subcategoría

#### Scenario: La migración deja cero compartidos con categoría privada

- **WHEN** se aplica la migración sobre una base con movimientos compartidos que usan categorías propias
- **THEN** cada una de esas categorías y subcategorías queda con el `household_id` del movimiento
- **AND** no queda ningún movimiento ni recurrencia compartida que referencie una categoría o subcategoría propia

## MODIFIED Requirements

### Requirement: El usuario puede salir del hogar solo si no hay deuda viva

El sistema SHALL permitir que un miembro salga del hogar, desvinculándolo, siempre que no exista deuda neta pendiente en ninguna moneda ni dirección, **ni una regla de recurrencia compartida activa**. Los gastos compartidos históricos se conservan. Si el hogar queda sin miembros, se marca inactivo.

El sistema SHALL bloquear la salida mientras exista al menos una regla de recurrencia compartida activa (con `household_id` y estado activo), pidiendo al usuario que primero pause o elimine esa regla. Este bloqueo es server-side, consistente con el bloqueo por deuda viva y por liquidaciones pendientes.

**Quien sale no pierde el nombre de sus movimientos.** Antes de desvincularlo, el sistema SHALL crear para el miembro que sale una copia propia de cada categoría y subcategoría del hogar que sus movimientos o recurrencias **no compartidos** referencian, y SHALL apuntar esos movimientos y recurrencias a la copia. Los movimientos compartidos históricos siguen apuntando a la categoría del hogar. Las categorías del hogar no se borran ni cambian de dueño al salir un miembro.

En `apps/web`, la ruta `/shared/settings` SHALL pedir **confirmación explícita** antes de ejecutar la salida: el botón "Salir del hogar" abre un `Dialog` (primitivo de confirmación definido en `overlay-primitives`) y la mutación de salida SHALL invocarse únicamente al confirmar desde el diálogo. Cancelar, cerrar por scrim o presionar `Esc` SHALL descartar la confirmación sin efecto. El bloqueo por deuda viva SHALL seguir siendo server-side; cuando la salida se bloquea, el motivo SHALL renderizarse como error inline dentro del cuerpo del diálogo, que permanece abierto. El CTA de confirmación SHALL usar `<Button variant="destructive">`.

#### Scenario: Salida bloqueada por deuda viva

- **WHEN** un miembro con deuda neta distinta de cero en alguna moneda intenta salir del hogar
- **THEN** el sistema bloquea la salida y explica que primero debe saldar la deuda

#### Scenario: Salida bloqueada por regla recurrente compartida activa

- **WHEN** un miembro sin deuda viva intenta salir del hogar pero existe una regla de recurrencia compartida activa
- **THEN** el sistema bloquea la salida y explica que primero debe pausar o eliminar esa regla recurrente compartida

#### Scenario: Salida exitosa sin deuda

- **WHEN** un miembro sin deuda viva ni reglas recurrentes compartidas activas confirma salir del hogar
- **THEN** el sistema lo desvincula, conserva los gastos compartidos históricos, y marca el hogar inactivo si queda sin miembros

#### Scenario: Quien sale conserva sus categorías del hogar como propias

- **WHEN** Julieta sale del hogar teniendo gastos propios clasificados con la categoría del hogar "Hogar - La Foresta"
- **THEN** el sistema crea la categoría propia "Hogar - La Foresta" para Julieta y apunta esos gastos a ella
- **AND** los gastos compartidos históricos del hogar siguen apuntando a la categoría del hogar
- **AND** Cristian sigue viendo y usando la categoría del hogar sin cambios

#### Scenario: La salida requiere confirmación explícita (web)

- **WHEN** un usuario en `/shared/settings` presiona "Salir del hogar"
- **THEN** se abre un diálogo de confirmación y la salida todavía NO se ejecuta
- **WHEN** el usuario cancela el diálogo (botón cancelar, scrim o Esc)
- **THEN** el diálogo se cierra y el usuario permanece en el hogar, sin efecto alguno
- **WHEN** el usuario confirma desde el diálogo
- **THEN** el sistema ejecuta la salida (sujeta al bloqueo por deuda viva) y, en éxito, lo lleva de vuelta a `/shared`
