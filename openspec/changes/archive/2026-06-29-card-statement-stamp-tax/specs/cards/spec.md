## ADDED Requirements

### Requirement: Cada tarjeta recuerda su alícuota de impuesto de sellos

El sistema SHALL almacenar por tarjeta una alícuota de impuesto de sellos (`stamp_tax_rate`), oculta para el usuario. El valor `NULL` significa que la tarjeta todavía no tiene alícuota conocida. La alícuota solo puede tener valor en cuentas de tipo crédito.

#### Scenario: Tarjeta sin alícuota conocida

- **WHEN** se crea una tarjeta de crédito
- **THEN** su `stamp_tax_rate` es `NULL` (todavía no conocida)

#### Scenario: La alícuota se persiste al confirmarse el primer sello

- **WHEN** el usuario confirma un monto de impuesto de sellos mayor a cero al pagar un resumen de una tarjeta cuya `stamp_tax_rate` es `NULL`
- **THEN** el sistema deriva la alícuota como `monto ÷ base` (base = total ARS del resumen) y la persiste en la tarjeta

#### Scenario: Una cuenta que no es de crédito no puede tener alícuota

- **WHEN** se intenta asignar una `stamp_tax_rate` a una cuenta cuyo `type` no es `credit`
- **THEN** la operación es rechazada por la restricción de integridad

### Requirement: El pago de un resumen incorpora el impuesto de sellos

Al pagar un resumen, el sistema SHALL ofrecer registrar el impuesto de sellos y, si el usuario confirma un monto mayor a cero, incluirlo en el monto total pagado. El monto del sello SHALL ser siempre editable antes de confirmar el pago.

La base de cálculo SHALL ser el total ARS del resumen (consumos `pending` en ARS menos reintegros), determinada **antes** de registrar el movimiento de sello.

#### Scenario: Primera vez — selector de monto sin mencionar el porcentaje

- **WHEN** el usuario va a pagar un resumen de una tarjeta cuya `stamp_tax_rate` es `NULL`
- **THEN** el sistema muestra un selector de montos en pesos (sugerencias calculadas a partir de las alícuotas más comunes, una opción de monto libre y una opción "No me cobraron sellos")
- **AND** muestra un aviso de que el dato se pide solo esta vez y que en los próximos resúmenes se sugerirá solo
- **AND** no se menciona ningún porcentaje al usuario

#### Scenario: Próximas veces — monto pre-cargado y editable

- **WHEN** el usuario va a pagar un resumen de una tarjeta con `stamp_tax_rate` conocida
- **THEN** el campo de impuesto de sellos viene pre-cargado con `round(base × stamp_tax_rate)`
- **AND** el usuario puede editar ese monto antes de confirmar

#### Scenario: El monto del sello se suma al total pagado

- **WHEN** el usuario confirma el pago con un monto de sello mayor a cero
- **THEN** el monto total pagado (la expensa en la cuenta de pago) es `consumos + sello`

### Requirement: El impuesto de sellos se registra como movimiento dentro del resumen pagado

Cuando el usuario confirma un monto de impuesto de sellos mayor a cero al pagar, el sistema SHALL registrar una transacción de la tarjeta asignada a ese período, con fecha igual al último día del resumen (`end_date` del período), categoría sistema `impuestos` y subcategoría `impuesto-de-sellos`, en ARS, y SHALL dejarla dentro del resumen pagado.

#### Scenario: El sello queda como movimiento pagado del período

- **WHEN** el usuario confirma el pago con un monto de sello mayor a cero
- **THEN** se inserta una transacción de tipo gasto en la tarjeta, asignada a ese período (`card_period_id`), con fecha igual al `end_date` del período, categoría `impuestos` / subcategoría `impuesto-de-sellos`, en ARS
- **AND** esa transacción queda en estado `paid` junto con el resto del resumen

#### Scenario: Monto cero no registra movimiento ni cambia la alícuota

- **WHEN** el usuario indica "No me cobraron sellos" o deja el monto en cero
- **THEN** no se inserta ningún movimiento de sello
- **AND** la `stamp_tax_rate` de la tarjeta no se modifica

#### Scenario: La base excluye el propio sello

- **WHEN** se calcula el monto del sello a partir de la alícuota
- **THEN** la base usada es el total del resumen previo a la inserción del sello, de modo que el sello no se incluye en su propia base
