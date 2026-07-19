## ADDED Requirements

### Requirement: La app nativa crea una regla recurrente desde cero

La app nativa SHALL exponer una pantalla `/transactions/recurring/new` con un form **dedicado** (`RecurrenceForm`) que compone los primitivos de UI existentes (`Segmented`, `SelectField`/`SelectSheet`, `MoneyAmountInput`, `Switch`, `DateField`, `Input`, `AccountAvatar`) — NO SHALL reusar `MovementForm` (evita acoplar la creación de regla al hot path del alta de movimiento). El form SHALL cubrir tipo (ingreso/gasto/transferencia — sin ajuste/cambio/cuotas), cuenta (con la misma elegibilidad por tipo del alta: sólo el gasto admite tarjeta de crédito), moneda, monto, categoría+subcategoría (ingreso/gasto) o cuenta destino (transferencia, ≠ origen), descripción, **fecha de inicio** (default hoy), **frecuencia** (preset o `custom` con intervalo), **fecha de fin** opcional, **máximo de ocurrencias** opcional, y **compartir** (template de split; sólo gasto + hogar de dos miembros).

Al guardar, el form SHALL validar client-side los casos comunes (monto > 0; categoría requerida en ingreso/gasto; destino requerido y distinto del origen en transferencia; fin ≥ inicio) y luego invocar `createRecurrence` de `@grana/recurrences` (vía el mutator mobile, que resuelve auth y pasa el hogar). `createRecurrence` SHALL crear **sólo la regla** — sin movimiento hoy; la primera ocurrencia vencida se materializa como instancia **pendiente** (visible en el bloque de pendientes del feed y en el hub). Al éxito SHALL invalidar el cache de recurrencias y volver al hub. El chrome (`PageHeader` + back) SHALL estar visible desde el primer paint; el cuerpo del form SHALL esperar a que carguen sus inputs (cuentas, categorías, hogar).

El hub `/transactions/recurring` SHALL ofrecer la entrada a esta pantalla mediante una afordancia "+" en su header.

#### Scenario: Crear una regla desde el hub

- **WHEN** el usuario toca "+" en el hub y completa el form (tipo, cuenta, monto, categoría o destino, frecuencia, fecha de inicio)
- **THEN** al guardar se crea la regla vía `createRecurrence` (sin crear un movimiento hoy), se invalida el cache y vuelve al hub, donde la regla aparece en su tab de estado
- **AND** si la fecha de inicio es hoy/pasada, la primera instancia se materializa como **pendiente** y aparece en el bloque de pendientes del feed

#### Scenario: Frecuencia custom y fecha de fin

- **WHEN** el usuario elige frecuencia `custom` e ingresa intervalo (cantidad + unidad), o activa la fecha de fin
- **THEN** el payload incluye `interval_count`/`interval_unit` (sólo en custom) y `end_date` (sólo si se activó), y `createRecurrence` los persiste
- **AND** una fecha de fin anterior a la de inicio se rechaza client-side antes de enviar

#### Scenario: Regla compartida

- **WHEN** el usuario crea un **gasto** recurrente con un hogar de dos miembros y activa "compartir" con un split
- **THEN** el payload incluye el `shared` template (household_id + splits) que semillará el split de cada instancia generada
- **AND** en ingreso o transferencia la opción de compartir no se ofrece

### Requirement: La app nativa edita los campos mutables de una regla recurrente

La app nativa SHALL permitir editar una regla existente desde el detalle `/transactions/recurring/[id]` mediante un form (`RecurrenceEditForm`) montado en un `Drawer` (bottom sheet) que se abre con una afordancia **Editar** en el header del detalle. El form SHALL editar únicamente el **subconjunto mutable**: monto, frecuencia (sólo presets — weekly/biweekly/monthly/annual, sin `custom`), fecha de fin (opcional) y descripción. Cuenta, categoría y tipo de movimiento SHALL ser **inmutables** (fijados en la creación; la instancia es un snapshot de la regla) y NO SHALL aparecer en el form — paridad con el drawer de edición web.

Al guardar, el form SHALL validar el monto (> 0) y luego invocar `updateRecurrence` de `@grana/recurrences` (vía el mutator mobile). Al éxito SHALL invalidar el detalle (`['recurrences','detail',id]`) y el hub, y cerrar el sheet; el resumen read-only SHALL reflejar los valores nuevos.

#### Scenario: Editar el monto y la frecuencia de una regla

- **WHEN** el usuario toca Editar en el detalle, cambia el monto y/o la frecuencia y guarda
- **THEN** se invoca `updateRecurrence` con el patch, se invalida el detalle y el hub, el sheet se cierra y el resumen muestra los valores nuevos

#### Scenario: El form de edición no expone cuenta, categoría ni tipo

- **WHEN** el usuario abre el form de edición de una regla
- **THEN** ve monto, frecuencia, fecha de fin y descripción, pero NO controles para cambiar la cuenta, la categoría o el tipo de movimiento
- **AND** la frecuencia ofrece sólo los presets (sin `custom`)

## MODIFIED Requirements

### Requirement: La app nativa expone el hub de recurrencias `/transactions/recurring`

La app nativa SHALL exponer una pantalla hub `/transactions/recurring` como thin consumer de `@grana/recurrences`. La pantalla SHALL listar las reglas del usuario agrupadas por **tabs de estado** (Activas / Pausadas / Finalizadas) con cards read-only que muestran el monto, la próxima fecha, la frecuencia, un badge de estado y un badge de **compartida** cuando la regla pertenece a un hogar. Cada tab SHALL mostrar su **estado vacío** propio cuando no hay reglas en ese estado.

El hub SHALL **materializar instancias vencidas de forma perezosa**: al enfocar la pantalla SHALL disparar `generateDueRecurrenceInstances` una sola vez por foco, fire-and-forget, e invalidar las queries del hub/pendientes cuando se generó al menos una instancia. El read path NO SHALL bloquearse esperando la generación (si falla, la instancia aparece en la próxima visita). El generador SHALL ser idempotente (un pending por regla), de modo que dobles disparos no dupliquen.

El chrome (`PageHeader` con back al feed) SHALL estar visible desde el primer paint; la carga SHALL usar un skeleton que NO tape el chrome. El hub SHALL ser accesible desde una afordancia "Recurrencias" en el header del feed de Movimientos (es una pantalla pushed, no una tab — las tabs nativas están fijas). El header del hub SHALL ofrecer además una afordancia **"+"** para **crear una regla desde cero** → `/transactions/recurring/new`.

#### Scenario: El hub lista las reglas por estado

- **WHEN** el usuario abre `/transactions/recurring`
- **THEN** ve las tabs Activas / Pausadas / Finalizadas y, en la activa, las cards de sus reglas con monto, próxima fecha, frecuencia y badge de estado
- **AND** una regla compartida muestra además su badge de compartida
- **AND** una tab sin reglas muestra su estado vacío

#### Scenario: El hub materializa instancias vencidas al enfocar

- **WHEN** el usuario enfoca el hub y hay reglas activas con instancias vencidas sin generar
- **THEN** se dispara la generación perezosa una vez y, si se creó alguna instancia, la lista de pendientes se refresca sin recarga manual
- **AND** si la generación falla, el hub igual renderiza las reglas desde el read (no bloquea)

#### Scenario: El hub ofrece crear una regla

- **WHEN** el usuario toca la afordancia "+" del header del hub
- **THEN** navega a `/transactions/recurring/new` para crear una regla desde cero

### Requirement: La app nativa expone el detalle de una regla recurrente con pausar/reanudar/eliminar

La app nativa SHALL exponer una pantalla de detalle `/transactions/recurring/[id]` con el mismo lenguaje de interacción que el detalle de movimiento: una **vista read-only** del resumen de la regla y las acciones en el header como icon-buttons directos. La vista SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (pending/confirmed/skipped) SHALL mantenerse debajo del resumen.

Las acciones del header SHALL ser **Editar** (abre el form de edición en un `Drawer`; ver el requirement de edición), **Pausar/Reactivar** (un único control que togglea según el estado de la regla, vía `pauseRecurrence`/`resumeRecurrence`) y **Eliminar** (`deleteRecurrence`). Eliminar SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app) antes de ejecutar; al éxito SHALL invalidar el cache y volver al hub. El borrado SHALL ser soft-delete (preserva las instancias confirmadas, elimina las pendientes). El chrome SHALL estar visible desde el primer paint.

#### Scenario: El detalle de una regla muestra el resumen y el historial

- **WHEN** el usuario abre el detalle de una regla desde el hub
- **THEN** ve la vista read-only (monto, frecuencia, cuenta, categoría, próxima fecha, fin) y, debajo, la lista de sus instancias generadas
- **AND** el chrome (back + acciones) está presente desde el primer paint

#### Scenario: Pausar, reactivar y eliminar una regla

- **WHEN** el usuario toca Pausar en una regla activa
- **THEN** la regla pasa a pausada y el control ahora ofrece Reactivar (y viceversa)
- **AND** al tocar Eliminar, un `Alert.alert` destructivo pide confirmación; al confirmar, la regla se elimina (soft-delete), se invalida el cache y vuelve al hub

#### Scenario: El detalle ofrece editar la regla

- **WHEN** el usuario toca Editar en el header del detalle
- **THEN** se abre el form de edición (monto/frecuencia/fin/descripción) en un `Drawer`; al guardar, el detalle se invalida y el resumen refleja los cambios
