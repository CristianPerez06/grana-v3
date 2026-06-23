## MODIFIED Requirements

### Requirement: El usuario puede salir del hogar solo si no hay deuda viva

El sistema SHALL permitir que un miembro salga del hogar, desvinculándolo, siempre que no exista deuda neta pendiente en ninguna moneda ni dirección, **ni una regla de recurrencia compartida activa**. Los gastos compartidos históricos se conservan. Si el hogar queda sin miembros, se marca inactivo.

El sistema SHALL bloquear la salida mientras exista al menos una regla de recurrencia compartida activa (con `household_id` y estado activo), pidiendo al usuario que primero pause o elimine esa regla. Este bloqueo es server-side, consistente con el bloqueo por deuda viva y por liquidaciones pendientes.

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

#### Scenario: La salida requiere confirmación explícita (web)

- **WHEN** un usuario en `/shared/settings` presiona "Salir del hogar"
- **THEN** se abre un diálogo de confirmación y la salida todavía NO se ejecuta
- **WHEN** el usuario cancela el diálogo (botón cancelar, scrim o Esc)
- **THEN** el diálogo se cierra y el usuario permanece en el hogar, sin efecto alguno
- **WHEN** el usuario confirma desde el diálogo
- **THEN** el sistema ejecuta la salida (sujeta al bloqueo por deuda viva) y, en éxito, lo lleva de vuelta a `/shared`
