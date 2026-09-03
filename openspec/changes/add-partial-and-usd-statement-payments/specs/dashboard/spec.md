## ADDED Requirements

### Requirement: La cobertura parcial de un resumen se descuenta al corte, y el remanente sigue siendo compromiso

Un resumen de tarjeta puede tener **varios** pagos parciales. La card "Comprometido" SHALL evaluar su
estado al `snapshotDate` por **cobertura**, no por la existencia de un pago: SHALL sumar las patas de
pago cuya transacción tiene `date <= snapshotDate` y contar el resumen por lo que a esa fecha
**restaba**.

El sistema NO SHALL tratar un resumen como saldado al corte por el solo hecho de existir un pago con
fecha anterior o igual al `snapshotDate`. Un pago mínimo previo al corte dejaba una deuda real, y
sacar el resumen entero de la lectura borraría ese remanente de los compromisos.

Un resumen cuya cobertura al corte cubría la deuda completa SHALL seguir excluyéndose, como hoy. La
regla existente —el estado de pago se evalúa a la fecha financiera del pago, nunca al estado actual
del resumen ni a la fecha en que se registró en la app— SHALL seguir valiendo sin cambios: lo que se
refina es qué significa "pagado" cuando un resumen tiene varias patas.

#### Scenario: Un pago mínimo previo al corte deja el remanente como compromiso

- **WHEN** el usuario mira junio 2026, y un resumen que vencía el 10/07 por $265.805,42 recibió un pago de $40.000 el 05/06
- **THEN** el resumen cuenta en esa lectura por $225.805,42
- **AND** no desaparece de los compromisos por tener un pago anterior al corte

#### Scenario: Un resumen cubierto por completo antes del corte no cuenta

- **WHEN** un resumen fue saldado con dos pagos, ambos anteriores al `snapshotDate`
- **THEN** el resumen no cuenta en esa lectura

#### Scenario: Un pago posterior al corte no descuenta nada

- **WHEN** un resumen de la ventana recibió un pago parcial después del `snapshotDate`
- **THEN** el resumen cuenta por su deuda completa
- **AND** el monto de esa ventana no cambia por ese pago
