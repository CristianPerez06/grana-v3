## ADDED Requirements

### Requirement: El grafo de recurrencias es isomórfico en `@grana/recurrences`

Los reads, el generador de instancias, la detección de sugerencias y las mutations de recurrencias SHALL vivir en el package `@grana/recurrences` sobre `GranaSupabaseClient`, consumidos por **web y mobile** (una sola implementación). El package SHALL exponer: los reads (`getRecurrences`, `getRecurrenceDetail`, `getPendingRecurrenceInstances`, `getTopRecurrenceSuggestion`, `getRecurrenceLinkForTransaction`, y los auxiliares de listado/conteo), el **generador perezoso** `generateDueRecurrenceInstances`, la **detección** `detectRecurrenceSuggestions`, y las **mutations** de ciclo de vida e instancias (`createRecurrence`, `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence`, `acceptRecurrenceSuggestion`, `dismissRecurrenceSuggestion`) más los tipos del dominio.

Las funciones SHALL tomar `(supabase, userId, …)` y devolver data o un resultado `{ ok, … }`, **sin auth ni revalidación** (que quedan en el shell de cada plataforma). `confirmRecurrenceInstance` SHALL delegar en los thin creates de `@grana/transactions-mutations` al materializar una instancia; la matemática de fechas SHALL seguir en `@grana/money-logic`. `createRecurrenceFromMovement` SHALL permanecer en `@grana/transactions-mutations` (no se duplica su owner).

**Web SHALL re-apuntar** sus reads (`apps/web/lib/recurrences/queries.ts`) y server actions (`apps/web/app/_actions/recurrences.ts`) al package como wrappers thin, conservando su validación, auth y `revalidatePath`/invalidación. La extracción SHALL preservar comportamiento: la suite de tests web SHALL seguir verde sin tests de negocio nuevos.

#### Scenario: Web y mobile comparten el grafo de recurrencias

- **WHEN** se lee o muta una recurrencia desde web o desde mobile
- **THEN** ambos pasan por las funciones de `@grana/recurrences` (una sola implementación de los reads, el generador y las mutations)
- **AND** las server actions web conservan su auth + `revalidatePath` y no cambian de comportamiento (tests web verdes)

#### Scenario: Confirmar una instancia reusa los thin creates compartidos

- **WHEN** se confirma una instancia recurrente (desde web o mobile)
- **THEN** `confirmRecurrenceInstance` mapea la instancia a un plan de movimiento y delega en los thin creates de `@grana/transactions-mutations`
- **AND** la instancia queda `confirmed` con su `confirmed_transaction_id` y la regla avanza su `last_generated_date`

### Requirement: La app nativa expone el hub de recurrencias `/transactions/recurring`

La app nativa SHALL exponer una pantalla hub `/transactions/recurring` como thin consumer de `@grana/recurrences`. La pantalla SHALL listar las reglas del usuario agrupadas por **tabs de estado** (Activas / Pausadas / Finalizadas) con cards read-only que muestran el monto, la próxima fecha, la frecuencia, un badge de estado y un badge de **compartida** cuando la regla pertenece a un hogar. Cada tab SHALL mostrar su **estado vacío** propio cuando no hay reglas en ese estado.

El hub SHALL **materializar instancias vencidas de forma perezosa**: al enfocar la pantalla SHALL disparar `generateDueRecurrenceInstances` una sola vez por foco, fire-and-forget, e invalidar las queries del hub/pendientes cuando se generó al menos una instancia. El read path NO SHALL bloquearse esperando la generación (si falla, la instancia aparece en la próxima visita). El generador SHALL ser idempotente (un pending por regla), de modo que dobles disparos no dupliquen.

El chrome (`PageHeader` con back al feed) SHALL estar visible desde el primer paint; la carga SHALL usar un skeleton que NO tape el chrome. El hub SHALL ser accesible desde una afordancia "Recurrencias" en el header del feed de Movimientos (es una pantalla pushed, no una tab — las tabs nativas están fijas).

#### Scenario: El hub lista las reglas por estado

- **WHEN** el usuario abre `/transactions/recurring`
- **THEN** ve las tabs Activas / Pausadas / Finalizadas y, en la activa, las cards de sus reglas con monto, próxima fecha, frecuencia y badge de estado
- **AND** una regla compartida muestra además su badge de compartida
- **AND** una tab sin reglas muestra su estado vacío

#### Scenario: El hub materializa instancias vencidas al enfocar

- **WHEN** el usuario enfoca el hub y hay reglas activas con instancias vencidas sin generar
- **THEN** se dispara la generación perezosa una vez y, si se creó alguna instancia, la lista de pendientes se refresca sin recarga manual
- **AND** si la generación falla, el hub igual renderiza las reglas desde el read (no bloquea)

### Requirement: La app nativa expone el detalle de una regla recurrente con pausar/reanudar/eliminar

La app nativa SHALL exponer una pantalla de detalle `/transactions/recurring/[id]` con el mismo lenguaje de interacción que el detalle de movimiento: una **vista read-only** del resumen de la regla y las acciones en el header como icon-buttons directos. La vista SHALL mostrar el monto como protagonista junto al tipo y, en filas de metadatos, la frecuencia, la cuenta (o cuenta → destino en transferencias), la categoría cuando aplique, la próxima fecha y la fecha de fin cuando exista. La lista de instancias generadas (pending/confirmed/skipped) SHALL mantenerse debajo del resumen.

Las acciones del header SHALL ser **Pausar/Reactivar** (un único control que togglea según el estado de la regla, vía `pauseRecurrence`/`resumeRecurrence`) y **Eliminar** (`deleteRecurrence`). Eliminar SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app) antes de ejecutar; al éxito SHALL invalidar el cache y volver al hub. El borrado SHALL ser soft-delete (preserva las instancias confirmadas, elimina las pendientes).

Esta pantalla NO SHALL exponer **editar** los campos de la regla ni **crear** una regla — la afordancia Editar y el form de creación llegan en una slice posterior (comparten un `useRecurrenceForm` dedicado que no reusa `useMovementForm`). El chrome SHALL estar visible desde el primer paint.

#### Scenario: El detalle de una regla muestra el resumen y el historial

- **WHEN** el usuario abre el detalle de una regla desde el hub
- **THEN** ve la vista read-only (monto, frecuencia, cuenta, categoría, próxima fecha, fin) y, debajo, la lista de sus instancias generadas
- **AND** el chrome (back + acciones) está presente desde el primer paint

#### Scenario: Pausar, reactivar y eliminar una regla

- **WHEN** el usuario toca Pausar en una regla activa
- **THEN** la regla pasa a pausada y el control ahora ofrece Reactivar (y viceversa)
- **AND** al tocar Eliminar, un `Alert.alert` destructivo pide confirmación; al confirmar, la regla se elimina (soft-delete), se invalida el cache y vuelve al hub

#### Scenario: El detalle no ofrece editar ni crear en esta slice

- **WHEN** el usuario abre el detalle de una regla
- **THEN** ve Pausar/Reactivar y Eliminar, pero NO una acción de Editar los campos de la regla
- **AND** no hay entrada de creación de regla desde cero en el hub

### Requirement: La app nativa muestra los pendientes recurrentes y la sugerencia en el feed

El feed de Movimientos nativo SHALL mostrar un **bloque de instancias recurrentes pendientes**, separado del historial, como thin consumer de `@grana/recurrences`. Por cada instancia pendiente el bloque SHALL ofrecer **Confirmar** y **Omitir**. Confirmar SHALL invocar `confirmRecurrenceInstance` (materializa el movimiento real vía los thin creates compartidos), invalidando el feed y el hub; Omitir SHALL invocar `skipRecurrenceInstance`. En esta slice, confirmar SHALL usar el **snapshot** de la instancia (sin edición inline de monto/fecha/descripción). Las instancias **compartidas** SHALL mostrarse con su badge y, al confirmarse, crear el gasto compartido con su split (paridad con `shared-recurrences`). El **warning de saldo negativo** al confirmar queda **diferido** (nicety read-only que requiere el read de saldos por cuenta); su ausencia no bloquea el confirmar.

El feed SHALL mostrar además un **banner de sugerencia de recurrencia** cuando `getTopRecurrenceSuggestion` detecta un patrón repetido, con **Aceptar** (crea la regla vía `acceptRecurrenceSuggestion`) y **Descartar** (`dismissRecurrenceSuggestion`, idempotente por fingerprint). El bloque de pendientes y el banner SHALL ofrecer un deep-link al hub / a la regla.

#### Scenario: Confirmar una instancia pendiente desde el feed

- **WHEN** el usuario toca Confirmar en una instancia recurrente pendiente
- **THEN** se crea el movimiento real (vía `confirmRecurrenceInstance`), la instancia queda confirmada, y el feed + el hub se invalidan
- **AND** confirmar usa el snapshot de la instancia (sin edición inline en esta slice)

#### Scenario: Omitir una instancia pendiente

- **WHEN** el usuario toca Omitir en una instancia pendiente
- **THEN** la instancia queda `skipped` (sin crear movimiento) y la regla avanza su cursor para no re-proponer esa fecha

#### Scenario: Aceptar o descartar una sugerencia

- **WHEN** el feed muestra un banner de sugerencia de recurrencia
- **THEN** Aceptar crea la regla (`acceptRecurrenceSuggestion`) y ofrece ir a ella; Descartar la oculta de forma idempotente (`dismissRecurrenceSuggestion`)

#### Scenario: Una instancia compartida se confirma como gasto compartido

- **WHEN** el usuario confirma una instancia recurrente **compartida** (con hogar + split)
- **THEN** se crea un gasto compartido con el split heredado de la regla
- **AND** la instancia se muestra con su badge de compartida en el bloque de pendientes
