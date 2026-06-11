# Delta — cards

## MODIFIED Requirements

### Requirement: La asignación de una transacción a un período se persiste como FK

El sistema SHALL persistir la asignación de cada transacción de tarjeta a su período como `transactions.card_period_id` (UUID, FK a `card_periods`). El sistema SHALL calcular la asignación al insertar la transacción y elegir el único período cuyo rango (`start_date ≤ date ≤ end_date`) contenga `transactions.date`. Si más de un período candidato existiera (caso anómalo por solapamiento), el sistema SHALL rechazar la operación.

Cuando ningún período existente cubre la fecha, el sistema SHALL distinguir dos casos:

- **Fecha posterior al período más nuevo**: el sistema genera el siguiente período hacia adelante (rolling forward, `is_estimated=true`, `start_date = último.end_date + 1`) y asigna la transacción ahí.
- **Fecha anterior al `start_date` del período más viejo**: el sistema SHALL rechazar la operación con un error claro que nombre la fecha de inicio del historial de la tarjeta. El sistema NO SHALL crear períodos hacia atrás ni asignar la transacción a un período que no contenga su fecha. Un consumo previo al historial pertenece a un ciclo que Grana no trackea (el registro empieza en el alta).

#### Scenario: Consumo cae en período actual

- **WHEN** existe un período con `start_date='2026-05-16'` y `end_date='2026-06-15'` y se inserta una transacción con `date='2026-05-30'` en esa tarjeta
- **THEN** la transacción se inserta con `card_period_id` apuntando a ese período

#### Scenario: Edición de fechas reubica transacción a otro período

- **WHEN** un usuario edita `end_date` de un período `open` y al recalcular, una transacción cuyo `date` antes caía dentro ahora cae en el período siguiente (existente)
- **THEN** la transacción se reubica: `card_period_id` se actualiza al nuevo período
- **AND** el sistema muestra al usuario un preview de impacto antes de confirmar

#### Scenario: Consumo con fecha anterior al historial de la tarjeta es rechazado

- **WHEN** la tarjeta tiene como período más viejo uno con `start_date='2026-05-17'` y se intenta registrar un consumo con `date='2026-04-10'`
- **THEN** la operación se rechaza con un error que nombra la fecha de inicio del historial (`17/05/2026`)
- **AND** no se crea ningún período nuevo
- **AND** no se inserta la transacción

#### Scenario: Cuota inicial anterior al historial es rechazada sin insertar el plan

- **WHEN** se intenta registrar una compra en cuotas cuya primera cuota (fecha de compra) es anterior al `start_date` del período más viejo
- **THEN** la operación se rechaza con el mismo error de fecha anterior al historial
- **AND** no se inserta el parent ni ninguna cuota
