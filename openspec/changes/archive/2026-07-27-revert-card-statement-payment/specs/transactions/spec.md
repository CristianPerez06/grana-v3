## MODIFIED Requirements

### Requirement: El usuario puede eliminar una transacción

El sistema SHALL permitir eliminar permanentemente una transacción. El sistema solicita confirmación antes de ejecutar. El saldo de la cuenta se recalcula automáticamente tras la eliminación.

El sistema NO SHALL permitir eliminar desde el detalle del movimiento aquellas transacciones cuyo borrado aislado rompería una operación mayor de la que forman parte. En esos casos SHALL rechazar la operación con un mensaje que indique **dónde** se resuelve, sin exponer detalles técnicos:

- una **cuota hija** de una compra en cuotas se elimina desde el movimiento padre;
- un **consumo ya pagado** en un resumen no se elimina;
- una **pata de liquidación** del hogar se revierte desde la cuenta corriente;
- un **pago de resumen de tarjeta** se deshace desde el detalle del período de la tarjeta.

El pago de un resumen NO SHALL eliminarse desde el detalle del movimiento: es la contrapartida de una operación que también dejó movimientos del resumen en `paid`, un registro en el pago del período y, eventualmente, un impuesto de sellos. Deshacerlo es la operación de la capability `cards`.

#### Scenario: Eliminar transacción actualiza el saldo

- **WHEN** el usuario confirma la eliminación de un gasto de $200 ARS
- **THEN** el sistema borra la fila y el saldo ARS de la cuenta aumenta $200

#### Scenario: Eliminación requiere confirmación

- **WHEN** el usuario toca "Eliminar" en el detalle de la transacción
- **THEN** el sistema muestra un diálogo de confirmación antes de ejecutar el borrado

#### Scenario: Eliminar un pago de resumen redirige a la tarjeta

- **WHEN** el usuario toca "Eliminar" en el detalle de un movimiento que es el pago de un resumen de tarjeta
- **THEN** el sistema rechaza la eliminación
- **AND** informa que se trata del pago de un resumen y que debe deshacerse desde el detalle del período de la tarjeta

#### Scenario: La confirmación no promete una reversión que no ocurre

- **WHEN** el usuario abre el diálogo de eliminación de un pago de resumen
- **THEN** el sistema NO afirma que las cuotas del período volverán a pendientes
