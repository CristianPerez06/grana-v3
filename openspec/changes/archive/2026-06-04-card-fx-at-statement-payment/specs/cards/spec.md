## ADDED Requirements

### Requirement: La cotización de la deuda USD se captura al pagar el resumen, no al registrar el consumo

El registro de un consumo en USD en una tarjeta NO SHALL exigir cotización: la deuda del período se computa por moneda (`pendingAmountARS` / `pendingAmountUSD`) y la conversión real ocurre recién al pagar el resumen, con la cotización del día de pago. El campo `fx_rate_to_ars` del consumo queda como dato opcional/histórico, sin uso contable en el alta.

Al pagar un resumen cuyo período tiene deuda USD pendiente (`pendingAmountUSD > 0`), el sistema SHALL exigir la **cotización del día de pago** (decimal de hasta 6 posiciones, sin agrupado de miles) y SHALL computar el total sugerido como `pendiente ARS + pendiente USD × cotización`, mostrando el desglose (pendiente ARS, pendiente USD convertido, total). El gasto ARS resultante del pago SHALL persistir la cotización usada (`fx_rate_to_ars` en la transacción de pago) para trazabilidad. El monto final sigue siendo editable por el usuario (puede redondear o pagar parcial); la cotización es obligatoria, el monto no se fuerza.

Sin deuda USD pendiente, el flujo de pago no pide cotización y no cambia.

A nivel base de datos, el invariante I-CRED-11 SHALL reflejar este modelo: el consumo USD en tarjeta acepta `fx_rate_to_ars` nulo (cuando está presente debe ser > 0), el consumo ARS lo rechaza, los gastos no-credit lo aceptan cuando es > 0 (pago de resumen), y todo tipo no-expense lo rechaza.

#### Scenario: Alta de consumo USD sin cotización

- **WHEN** el usuario registra un gasto en USD con una tarjeta de crédito
- **THEN** el formulario no pide cotización y el consumo se guarda con `fx_rate_to_ars` nulo
- **AND** el consumo suma a la deuda USD del período, separada de la ARS

#### Scenario: Pago de resumen con deuda USD pide la cotización del día

- **WHEN** el usuario abre el pago de un período con `pendingAmountUSD > 0`
- **THEN** el formulario muestra un campo de cotización (ARS por 1 USD) obligatorio
- **AND** al cargarla muestra el desglose: pendiente ARS + (USD × cotización) = total sugerido
- **AND** el monto a pagar se autocompleta con ese total y sigue siendo editable

#### Scenario: El backend rechaza pagar deuda USD sin cotización

- **WHEN** llega un pago para un período con deuda USD pendiente y sin cotización (> 0)
- **THEN** la acción es rechazada con un error localizado
- **AND** no se crea el gasto de pago ni se marca el período como pagado

#### Scenario: La cotización queda registrada en el pago

- **WHEN** se confirma el pago de un período con deuda USD y cotización `1.230,50`
- **THEN** la transacción de pago (gasto ARS) persiste `fx_rate_to_ars = 1230.50`

#### Scenario: Confirmar recurrencia USD en tarjeta no pide cotización

- **WHEN** el usuario confirma una instancia recurrente de gasto USD sobre una tarjeta
- **THEN** el confirm no pide cotización y genera el consumo USD sin `fx_rate_to_ars`

#### Scenario: Resumen pagado muestra lo pagado por moneda

- **WHEN** el usuario pagó un período que tenía `$10.000,50` ARS y `u$s 50` de deuda
- **THEN** la lista de resúmenes y el detalle del período muestran `$10.000,50` y `u$s 50` pagados (no `u$s 0`)
- **AND** el detalle del movimiento de pago muestra la composición (pesos y dólares del resumen) y la cotización usada

#### Scenario: Editar la fecha de un consumo lo mueve al resumen correspondiente

- **WHEN** el usuario edita un consumo pendiente y la nueva fecha cae dentro de otro período sin pagar
- **THEN** el consumo se reasigna a ese período (`card_period_id` y `due_date` actualizados)
- **AND** si la nueva fecha cae en un resumen ya pagado, la edición se rechaza con un error localizado
