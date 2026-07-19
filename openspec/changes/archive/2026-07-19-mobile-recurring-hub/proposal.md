## Why

La web tiene un módulo de **recurrencias** completo (`/transactions/recurring`): hub con tabs por estado, detalle de regla con historial, bloque de pendientes en el feed, banner de sugerencias, y gestión (pausar/reanudar/eliminar). La app nativa **no tiene nada de esto** — sólo puede *crear* una recurrencia desde el toggle "Repetir" del alta de movimiento (`createRecurrenceFromMovement`, ya shipeado). Se crean reglas pero no hay dónde **verlas ni gestionarlas**, y las instancias generadas nunca se confirman en la app: quedan invisibles.

El bloqueo es de **arquitectura, no de UI**: a diferencia de los movimientos (cuyo grafo de reads/mutations ya se extrajo a `@grana/transactions` / `@grana/transactions-mutations`), **todo el motor de recurrencias vive web-local** en `apps/web/lib/recurrences/queries.ts` (≈8 reads + el generador perezoso) y `apps/web/app/_actions/recurrences.ts` (≈10 mutations). Lo único compartido hoy es `createRecurrenceFromMovement` (orquestador en `@grana/transactions-mutations`) y la matemática de fechas (`@grana/money-logic`). Este es el **segundo consumidor real** del motor de recurrencias → dispara su extracción a un package isomórfico.

Este change hace la extracción y entrega la **gestión de recurrencias** en mobile (hub + detalle + ciclo de vida + confirmación de pendientes). Deja **fuera** la *creación desde cero* y la *edición de campos de la regla* (el form dedicado de 19/4 campos que no reusa `useMovementForm`) — su propia slice (③.2).

## What Changes

- **Extracción de `@grana/recurrences`** (package nuevo, isomórfico sobre `GranaSupabaseClient`): se mueven los reads (`getRecurrences`, `getRecurrenceDetail`, `getPendingRecurrenceInstances`, `getTopRecurrenceSuggestion`, `getRecurrenceLinkForTransaction`, …), el **generador perezoso** (`generateDueRecurrenceInstances`), la **detección de sugerencias** (`detectRecurrenceSuggestions`), las **mutations** de ciclo de vida e instancias (`createRecurrence`, `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence`, `acceptRecurrenceSuggestion`, `dismissRecurrenceSuggestion`) y los **tipos**. `confirmRecurrenceInstance` sigue delegando en los thin creates de `@grana/transactions-mutations`; la date-math sigue en `@grana/money-logic`. **Web re-apunta** `apps/web/lib/recurrences/queries.ts` y `apps/web/app/_actions/recurrences.ts` a wrappers thin (auth + `revalidatePath`/invalidación quedan en web). **Sin cambio de comportamiento; los tests web siguen verdes.**
- **Capa mobile thin** en `apps/mobile/lib/recurrences/` (espejo de `lib/transactions/`): reads con auth vía `supabase.auth.getUser()`, mutators (auth + delegación al package + invalidación de cache TanStack), y las query keys.
- **Hub nativo `/transactions/recurring`**: lista de reglas por **tabs de estado** (Activas / Pausadas / Finalizadas) con cards read-only (monto, próxima fecha, frecuencia, badge de estado y de **compartida**), **generación perezosa** de instancias al enfocar la pantalla (mirror de `RecurrenceGenerationTrigger`), estados vacíos por tab, skeleton, y chrome (`PageHeader`) visible desde el primer paint. Entry point: una afordancia "Recurrencias" en el header del feed de Movimientos + deep-links desde el bloque de pendientes y el banner.
- **Detalle de regla nativo `/transactions/recurring/[id]`**: vista read-only del resumen (monto protagonista, frecuencia, cuenta/→destino, categoría, próxima y fin) + lista de instancias generadas; acciones en el header **Pausar/Reactivar** (toggle según estado) y **Eliminar** (`Alert.alert` destructivo, patrón ya usado en la app). **Sin editar ni crear** (③.2).
- **Bloque de pendientes + banner de sugerencia en el feed**: el bloque de **instancias recurrentes pendientes** (confirmar / omitir, con warning de saldo negativo; confirmar crea el movimiento real vía el `confirmRecurrenceInstance` extraído) y el **banner de sugerencia** (aceptar → crea la regla / descartar). Ambos thin consumers, separados del historial.

## Capabilities

### Added Capabilities

- `transactions`: **"El grafo de recurrencias es isomórfico en `@grana/recurrences`"** — reads + generador + detección de sugerencias + mutations viven en el package sobre `GranaSupabaseClient`, consumidos por **web y mobile** (una sola implementación; web re-apunta sin cambio de comportamiento).
- `transactions`: **"La app nativa expone el hub de recurrencias `/transactions/recurring`"** — lista por tabs de estado, cards read-only, generación perezosa al enfocar, estados vacíos/skeleton, entry desde el feed.
- `transactions`: **"La app nativa expone el detalle de una regla recurrente con pausar/reanudar/eliminar"** — detalle read-only + historial de instancias + acciones de ciclo de vida en el header; sin editar/crear.
- `transactions`: **"La app nativa muestra los pendientes recurrentes y la sugerencia en el feed"** — bloque de instancias pendientes (confirmar/omitir) + banner de sugerencia (aceptar/descartar), thin consumers del package.

## Impact

- **Packages**: nuevo `@grana/recurrences` (queries + generator + suggestions + mutations + types). Depende de `@grana/supabase`, `@grana/money-logic` y `@grana/transactions-mutations` (para los thin creates que usa `confirmRecurrenceInstance`). Sin cambios de datos/API/RLS/migraciones.
- **Web**: `apps/web/lib/recurrences/queries.ts` y `apps/web/app/_actions/recurrences.ts` pasan a delegar en el package (thin wrappers con auth + revalidación). Sin cambio de comportamiento; `pnpm --filter web test` verde.
- **Mobile**: nuevo `apps/mobile/lib/recurrences/` + pantallas `app/(app)/transactions/recurring/index.tsx` y `[id].tsx` + componentes de hub/detalle + bloque de pendientes y banner en el feed (`app/(app)/transactions/index.tsx`). Reusa primitivos existentes (`Segmented`, `MovementList`/`MovementRow`, `SkeletonBlock`, `Alert.alert`, `PageHeader`, `MonthNavigator` no aplica). Sin deps nuevas.
- **i18n**: el namespace `recurrences.*` de `@grana/i18n-messages` ya existe casi completo (title, empty states, statuses, actions, confirmations, suggestion, pending, history…). Se **reusa**; se agregan sólo keys native-only que el catálogo no tenga (p. ej. label de carga del hub). No es un change de cero-keys garantizado, pero cercano.
- **Dependencias entre changes**: reusa la creación desde movimiento ya shipeada. Habilita ③.2 (form de creación/edición de regla) como thin consumer del mismo package.

### Fuera de scope

- **Creación de regla desde cero** (`/transactions/recurring/new`, form de 19 campos) y **edición de los campos de la regla** (drawer de 4 campos) — requieren un `useRecurrenceForm` dedicado (no reusa `useMovementForm`); es la slice ③.2.
- **Tile de recurrencia en el detalle de movimiento** (`/transactions/[txId]`: next charge / active-since / count + historial de 6 + link a la regla) — se difiere al bundle de "tiles de contexto del detalle" (junto con "Peso en el mes"); no fuerza modificar el requirement grande del detalle de C.1 acá.
- **Módulo Hogar/Shared**: las instancias/reglas **compartidas** se muestran con su badge (paridad con `shared-recurrences`) y se pueden confirmar, pero la gestión del hogar en sí sigue diferida.
- **Filtros del feed, breakdown/donut, y confirmar/cancelar reintegro** — otras slices de §4.
