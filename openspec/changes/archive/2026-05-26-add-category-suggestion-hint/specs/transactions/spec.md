# transactions (delta)

## ADDED Requirements

### Requirement: El sistema anticipa que recordará la categoría para la próxima vez

Al registrar un ingreso o un gasto, cuando el usuario ingresa una descripción que **no coincide** con ninguna transacción anterior suya (es decir, la sugerencia por historial no encontró nada) y luego elige una categoría, el sistema SHALL mostrar un **aviso informativo y no bloqueante** indicando que la próxima vez que cargue esa misma descripción se le va a sugerir esa categoría. El aviso es puramente informativo: NO es accionable, NO cambia el guardado, NO autocompleta ni persiste nada. Aplica solo a ingreso y gasto.

Este aviso SHALL ser mutuamente excluyente con la sugerencia por historial: el chip de sugerencia aparece cuando hay coincidencia; el aviso aparece cuando NO la hay. Nunca se muestran simultáneamente.

#### Scenario: Avisa al categorizar una descripción nueva

- **WHEN** el usuario escribe la descripción "Verdulería del barrio" (que nunca usó antes) en un gasto y elige la categoría "Comida"
- **THEN** el sistema muestra un aviso informativo de que la próxima vez que cargue "Verdulería del barrio" se le va a sugerir "Comida"
- **AND** el aviso no bloquea ni modifica el guardado del gasto

#### Scenario: No avisa si la descripción ya tenía historial

- **WHEN** la descripción que el usuario escribe SÍ coincide con una transacción anterior (por lo que ya apareció el chip de sugerencia)
- **THEN** el sistema NO muestra el aviso (mostrar la promesa sería redundante con el chip que ya cumplió)

#### Scenario: No avisa sin categoría elegida

- **WHEN** el usuario escribe una descripción nueva pero todavía no eligió ninguna categoría
- **THEN** el sistema NO muestra el aviso (no hay categoría futura que prometer)

#### Scenario: No avisa sin descripción

- **WHEN** el usuario elige una categoría pero no escribió descripción (o es demasiado corta para normalizar)
- **THEN** el sistema NO muestra el aviso (no hay descripción que recordar)

#### Scenario: No aplica a transferencias, ajustes ni cambios

- **WHEN** el usuario registra una transferencia, un ajuste o un cambio de moneda
- **THEN** el sistema no muestra el aviso (esos movimientos no tienen categoría)
