## ADDED Requirements

### Requirement: El detalle de una regla recurrente usa vista read-only + edición en drawer

El sistema SHALL exponer la pantalla de detalle de una regla recurrente (`/transactions/recurring/[id]`) con el mismo lenguaje de interacción que el detalle de un movimiento (`/transactions/[txId]`): una **vista de solo lectura** del resumen de la regla por defecto, con las acciones en el header y la edición en un drawer. La pantalla NO SHALL abrir en modo edición.

La vista read-only SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (`RecurrenceInstancesList`) SHALL mantenerse debajo del resumen.

Las acciones SHALL vivir en el header del detalle como icon-buttons directos (no un dropdown): **Editar**, **Pausar/Reactivar** (un único control que togglea según el estado de la regla) y **Eliminar**. La acción Editar SHALL abrir un drawer; la acción Eliminar SHALL pedir confirmación mediante un diálogo (no un `confirm()` nativo).

El drawer de edición SHALL editar únicamente el field set mutable de la regla — monto, frecuencia, fecha de fin y descripción. La cuenta, la categoría y el tipo de movimiento se fijan al crear la regla y NO SHALL ser editables desde el detalle.

Esta pantalla NO SHALL introducir mutaciones nuevas: reusa las operaciones existentes de actualizar, pausar, reactivar y eliminar reglas recurrentes.

#### Scenario: La pantalla abre en modo lectura

- **WHEN** el usuario abre `/transactions/recurring/[id]`
- **THEN** ve el resumen de la regla en modo solo lectura (monto, frecuencia, cuenta, categoría, próxima fecha y fin si aplica)
- **AND** no hay un formulario de edición visible por defecto

#### Scenario: Editar abre el drawer con el field set reducido

- **WHEN** el usuario activa la acción Editar en el header
- **THEN** se abre un drawer con los campos editables (monto, frecuencia, fecha de fin, descripción)
- **AND** no se ofrecen controles para cambiar la cuenta, la categoría ni el tipo de movimiento
- **AND** al guardar con éxito, el drawer se cierra y el detalle refleja los nuevos valores

#### Scenario: Pausar y reactivar desde el header

- **WHEN** la regla está activa y el usuario activa la acción de estado en el header
- **THEN** la regla se pausa y el control pasa a ofrecer Reactivar
- **WHEN** la regla está pausada y el usuario activa la acción de estado
- **THEN** la regla se reactiva y el control vuelve a ofrecer Pausar

#### Scenario: Eliminar pide confirmación por diálogo

- **WHEN** el usuario activa la acción Eliminar en el header
- **THEN** el sistema muestra un diálogo de confirmación con copy contextual de la regla
- **AND** al confirmar, la regla se elimina/desactiva y el usuario vuelve a `/transactions/recurring`
- **AND** al cancelar, no se realiza ninguna mutación

#### Scenario: Las instancias generadas se mantienen visibles

- **WHEN** el usuario está en el detalle de una regla con instancias generadas
- **THEN** la lista de instancias se muestra debajo del resumen, igual que antes del rework
