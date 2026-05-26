## ADDED Requirements

### Requirement: El sistema sugiere una categoría según el historial del usuario

Al registrar un ingreso o un gasto, cuando el usuario ingresa una descripción que coincide (exacta, normalizada a minúsculas y sin espacios extremos) con la de una transacción anterior suya, el sistema SHALL ofrecer la categoría (y subcategoría, si la había) usada en esa transacción anterior como una **sugerencia no bloqueante** (un chip que el usuario puede tocar para aplicar). El sistema NO SHALL autocompletar la categoría: la sugerencia se aplica solo si el usuario la acepta. La sugerencia se muestra únicamente cuando existe una coincidencia **y** el usuario todavía no eligió categoría. La categoría sugerida SHALL ser compatible con el tipo del movimiento (un gasto no sugiere una categoría de ingreso). Aplica solo a ingreso y gasto.

#### Scenario: Sugiere la categoría usada la última vez para esa descripción

- **WHEN** el usuario escribe la descripción "Coto" en un gasto, y su última transacción con descripción "coto" estaba categorizada como "Supermercado"
- **THEN** el sistema muestra un chip que sugiere "Supermercado" (con el porqué: la última vez se usó esa categoría)
- **AND** al tocar el chip, la categoría del formulario queda en "Supermercado"

#### Scenario: La sugerencia incluye la subcategoría si la había

- **WHEN** la transacción anterior coincidente tenía categoría y subcategoría
- **THEN** tocar el chip aplica tanto la categoría como la subcategoría

#### Scenario: Sin historial coincidente no hay sugerencia

- **WHEN** el usuario escribe una descripción que nunca usó antes (o no usó con una categoría)
- **THEN** el sistema no muestra ninguna sugerencia (la Capa de keywords es otra capacidad futura)

#### Scenario: El tipo de la categoría debe coincidir con el del movimiento

- **WHEN** una descripción coincide con una transacción anterior, pero su categoría es de tipo ingreso y el movimiento actual es un gasto
- **THEN** el sistema no sugiere esa categoría

#### Scenario: La sugerencia no se impone

- **WHEN** hay una sugerencia disponible y el usuario la ignora
- **THEN** el formulario queda sin categoría (la sugerencia nunca se aplica sola)

#### Scenario: No aplica a transferencias, ajustes ni cambios

- **WHEN** el usuario registra una transferencia, un ajuste o un cambio de moneda
- **THEN** el sistema no ofrece sugerencia de categoría (esos movimientos no tienen categoría)
