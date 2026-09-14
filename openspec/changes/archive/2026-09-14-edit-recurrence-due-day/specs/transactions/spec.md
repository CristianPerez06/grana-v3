## MODIFIED Requirements

### Requirement: El detalle de una regla recurrente usa vista read-only + edición en drawer

El sistema SHALL exponer la pantalla de detalle de una regla recurrente (`/transactions/recurring/[id]`) con el mismo lenguaje de interacción que el detalle de un movimiento (`/transactions/[txId]`): una **vista de solo lectura** del resumen de la regla por defecto, con las acciones en el header y la edición en un drawer. La pantalla NO SHALL abrir en modo edición.

La vista read-only SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (`RecurrenceInstancesList`) SHALL mantenerse debajo del resumen.

Las acciones SHALL vivir en el header del detalle como icon-buttons directos (no un dropdown): **Editar**, **Pausar/Reactivar** (un único control que togglea según el estado de la regla) y **Eliminar**. La acción Editar SHALL abrir un drawer; la acción Eliminar SHALL pedir confirmación mediante un diálogo (no un `confirm()` nativo).

El drawer de edición SHALL editar únicamente el field set mutable de la regla — monto, frecuencia, **fecha de referencia**, fecha de fin y descripción. La cuenta, la categoría y el tipo de movimiento se fijan al crear la regla y NO SHALL ser editables desde el detalle.

**La fecha de referencia es el ancla del calendario de la regla**, no una fecha histórica. SHALL llamarse así y no "día de vencimiento": una regla semanal o cada N días no tiene un día del mes, y ese nombre sería incorrecto justo en los casos donde el campo más hace falta. Una regla creada a partir de un movimiento hereda su fecha, y esa fecha puede ser atípica —un sueldo que un mes se acreditó antes por un feriado deja la regla anclada a ese día, y el recordatorio llega desfasado todos los meses—. Sin este campo la única salida es borrar la regla y recrearla, perdiendo su historial.

**Al cambiarla, el sistema SHALL preguntar desde qué vencimiento rige** y NO SHALL inferirlo. La pregunta SHALL ofrecer las **dos primeras fechas del cronograma nuevo** —la primera que cae hoy o después, y la siguiente— y SHALL nombrarlas como fechas concretas.

La razón es que la ambigüedad no se puede resolver por cálculo. Un ciclo cuyo vencimiento **ya se resolvió** no debe ganar otro con la fecha corregida —serían dos veces el mismo sueldo—, pero un ciclo **todavía sin resolver** sí debe pasar a la fecha nueva. Desde la base las dos situaciones son idénticas: dos fechas distintas de una misma regla. Y razonar por "período" no es una salida: una regla cada N días no tiene ninguno. Quien sabe si el vencimiento del ciclo ya está saldado es el usuario.

La elección SHALL persistirse como la vigencia de la versión nueva. Y el sistema SHALL poder **cortar la versión anterior antes** de que empiece la nueva: si la vigencia elegida es la fecha lejana, el cronograma viejo NO SHALL producir ninguna ocurrencia más en el intervalo intermedio —de otro modo el duplicado reaparece corrido un ciclo, con la fecha vieja del ciclo siguiente—. El hueco entre una versión y la que sigue NO SHALL producir nada.

Cambiarlo SHALL regir **desde el vencimiento elegido hacia adelante** y NO SHALL reinterpretar el pasado:

- Las ocurrencias **ya materializadas conservan su vencimiento**, resueltas o sin resolver. El vencimiento es inmutable —requirement "Cada ocurrencia recurrente tiene una identidad estable"—, así que una regla movida del 8 al 10 puede mostrar una ocurrencia vieja en el 8 y las siguientes en el 10. El formulario SHALL decirlo antes de guardar, en vez de dejar que el usuario lo descubra. NO SHALL decir qué hacer con esa ocurrencia: sigue disponible y el usuario la confirma u omite por separado, cuando decida.
- NO SHALL materializarse ninguna ocurrencia con fecha anterior al cambio. Mover el ancla no es reconstruir historial: el sistema ya distingue desde cuándo rige cada versión del cronograma.
- La regla SHALL poder editarse esté **activa o pausada**. Una pausa evita generar vencimientos durante ese intervalo, pero no debe impedir corregir el calendario que va a regir al reanudar.

Esta pantalla NO SHALL introducir mutaciones nuevas: reusa las operaciones existentes de actualizar, pausar, reactivar y eliminar reglas recurrentes.

#### Scenario: La pantalla abre en modo lectura

- **WHEN** el usuario abre `/transactions/recurring/[id]`
- **THEN** ve el resumen de la regla en modo solo lectura (monto, frecuencia, cuenta, categoría, próxima fecha y fin si aplica)
- **AND** no hay un formulario de edición visible por defecto

#### Scenario: Editar abre el drawer con el field set reducido

- **WHEN** el usuario activa la acción Editar en el header
- **THEN** se abre un drawer con los campos editables (monto, frecuencia, fecha de referencia, fecha de fin, descripción)
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

#### Scenario: Corregir el día de vencimiento rige desde el cambio

- **WHEN** una regla mensual anclada al día 8 se edita al día 10
- **THEN** el próximo vencimiento cae el 10 del mes que corresponda
- **AND** no aparece ninguna ocurrencia nueva con fecha anterior al cambio, ni en el inicio ni en el historial de la regla

#### Scenario: Las ocurrencias que ya existían conservan su vencimiento

- **WHEN** una regla anclada al día 8 tiene una ocurrencia sin resolver del 8 y su día se corrige al 10
- **THEN** esa ocurrencia sigue venciendo el 8 y se puede resolver como estaba
- **AND** las ocurrencias siguientes vencen el 10
- **AND** el formulario avisó antes de guardar que las que ya existen conservan su fecha
- **AND** esa ocurrencia se puede confirmar u omitir por separado, como cualquier otra

#### Scenario: Una regla pausada también se puede corregir

- **WHEN** el usuario abre el drawer de edición de una regla pausada y cambia su día de vencimiento
- **THEN** el cambio se guarda
- **AND** la regla sigue pausada

#### Scenario: El ciclo en curso ya se resolvió

- **WHEN** una regla mensual anclada al 8 tiene el vencimiento del 8 de septiembre ya confirmado, y el 10 de septiembre el usuario corrige la referencia al día 10 eligiendo **el 10 de octubre** como primer vencimiento nuevo
- **THEN** no se materializa ninguna ocurrencia del 10 de septiembre
- **AND** tampoco una del 8 de octubre, que es la que produciría el cronograma viejo si siguiera vigente
- **AND** el próximo vencimiento es el 10 de octubre

#### Scenario: El ciclo en curso todavía no se resolvió

- **WHEN** una regla mensual anclada al 8 no tiene aún el vencimiento de septiembre, y el 5 de septiembre el usuario corrige la referencia al día 10 eligiendo **el 10 de septiembre**
- **THEN** el vencimiento de septiembre es el 10
- **AND** no se materializa uno del 8 de septiembre

#### Scenario: Una regla con atraso conserva las fechas viejas del atraso

- **WHEN** una regla mensual anclada al 8 debe julio y agosto sin resolver, y se corrige la referencia al día 10
- **THEN** las ocurrencias de julio y agosto se materializan el día 8, como correspondía cuando vencieron
- **AND** solo las posteriores a la vigencia elegida usan el día 10

#### Scenario: Una regla cada N días también se corrige por fechas

- **WHEN** una regla cada 3 días se corre un día y el usuario elige entre las dos fechas que ofrece el formulario
- **THEN** el sistema aplica el cronograma nuevo desde la fecha elegida
- **AND** la pregunta no menciona meses ni períodos, porque esta regla no tiene ninguno
