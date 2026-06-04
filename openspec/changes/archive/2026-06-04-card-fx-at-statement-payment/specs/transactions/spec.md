## MODIFIED Requirements

### Requirement: El módulo global de movimientos destaca movimientos que requieren revisión

El sistema SHALL poder marcar movimientos con estados de revisión funcionales cuando detecta que podrían requerir atención del usuario. Estos estados no cambian el impacto contable del movimiento: solamente ayudan a priorizar revisión, corrección o categorización.

Un movimiento MAY requerir revisión por motivos como: falta de categoría, monto inusualmente alto, posible duplicado, datos incompletos, ajuste frecuente o inconsistencia funcional detectada. La **cotización faltante NO es un motivo de revisión**: un consumo USD en tarjeta sin cotización es el estado normal (la conversión ocurre al pagar el resumen, con la cotización del día de pago — ver capability `cards`).

#### Scenario: Movimiento sin categoría requiere revisión

- **WHEN** existe un movimiento de tipo gasto o ingreso que debería tener categoría pero no la tiene
- **THEN** el listado global puede mostrarlo como "Sin categoría"
- **AND** puede incluirlo en un filtro de revisión

#### Scenario: Posible duplicado requiere revisión

- **WHEN** existen dos movimientos del mismo usuario con fecha, monto, moneda, cuenta y descripción muy similares
- **THEN** el sistema puede marcarlos como posibles duplicados
- **AND** no los elimina ni los fusiona automáticamente

#### Scenario: Consumo USD en tarjeta sin cotización NO requiere revisión

- **WHEN** existe un consumo USD en tarjeta sin `fx_rate_to_ars`
- **THEN** el sistema no lo marca como movimiento a revisar
- **AND** la conversión se resuelve al pagar el resumen con la cotización del día

#### Scenario: Revisión no altera saldos

- **WHEN** un movimiento es marcado como requiere revisión
- **THEN** el saldo de las cuentas no cambia
- **AND** la marca funciona únicamente como ayuda operativa para el usuario
