## ADDED Requirements

### Requirement: El pago de resumen sugiere la cuenta de débito del mismo banco

Al abrir la pantalla de pago de un resumen, el sistema SHALL preseleccionar como cuenta de débito una cuenta activa del **mismo banco (institución) que la tarjeta** que se paga, cuando exista una con ARS activo. Si no existe una cuenta de esa institución, SHALL caer en la primera cuenta de débito disponible. La lista completa sigue disponible para que el usuario elija otra.

#### Scenario: Hay una cuenta del mismo banco que la tarjeta

- **WHEN** el usuario abre el pago del resumen de una tarjeta del banco X y tiene una cuenta activa del banco X con ARS
- **THEN** la cuenta de débito viene preseleccionada con esa cuenta del banco X

#### Scenario: No hay cuenta del mismo banco

- **WHEN** el usuario abre el pago y no tiene ninguna cuenta de la institución de la tarjeta
- **THEN** la cuenta de débito cae en la primera cuenta de débito disponible (comportamiento anterior)
