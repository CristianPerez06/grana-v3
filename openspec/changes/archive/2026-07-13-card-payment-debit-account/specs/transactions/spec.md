## ADDED Requirements

### Requirement: La cuenta de débito de un pago de resumen es editable

Al editar un **pago de resumen** (el gasto-débito que salda un período de tarjeta), el sistema SHALL permitir cambiar la **cuenta desde donde salió el pago**. Cambiarla SHALL mover el débito a la cuenta nueva y recalcular los saldos de ambas cuentas; el vínculo del pago con el período (`period_payments`) y el estado `paid` de las cuotas/consumos del período NO SHALL verse afectados.

La cuenta nueva SHALL ser una cuenta de débito (efectivo o banco, no de crédito) con la moneda del pago activa. Esta editabilidad SHALL aplicar **solo** al pago de resumen: la cuenta del resto de los movimientos (incluido un consumo de tarjeta, cuya cuenta define el período) permanece inmutable en la edición.

#### Scenario: Corregir la cuenta desde donde se pagó el resumen

- **WHEN** el usuario edita un pago de resumen que salió de una cuenta equivocada y elige otra cuenta de débito
- **THEN** el pago queda registrado desde la cuenta nueva y los saldos de ambas cuentas se recalculan
- **AND** el período sigue pagado y sus cuotas siguen en estado `paid`

#### Scenario: La cuenta de un consumo de tarjeta sigue inmutable

- **WHEN** el usuario edita un consumo de tarjeta (no un pago de resumen)
- **THEN** la cuenta permanece como contexto de solo lectura, sin opción de cambiarla

#### Scenario: La cuenta nueva debe soportar la moneda del pago

- **WHEN** el usuario intenta mover el pago a una cuenta que no tiene la moneda del pago activa
- **THEN** el sistema rechaza el cambio y no altera la cuenta del pago
