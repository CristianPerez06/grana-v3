# Tasks — mobile-recurring-hub

## 1. Extracción de `@grana/recurrences` (Decisión 1, 2)

- [x] 1.1 Crear el package `packages/recurrences` (`package.json`, `tsconfig`, `src/index.ts`) siguiendo el molde de `@grana/transactions`. Deps: `@grana/supabase`, `@grana/money-logic`, `@grana/transactions-mutations`, `@grana/validation`.
- [x] 1.2 Mover los **tipos** a `src/types.ts` (`Recurrence`, `RecurrenceInstance`, `RecurrenceSummary`, `RecurrenceDetail`, `PendingRecurrenceInstance`, enums). Verificar que ninguno arrastre tipos web-only; parametrizar/mover lo que haga falta para que sean isomórficos.
- [x] 1.3 Mover los **reads** a `src/queries.ts` (`getRecurrences`, `getRecurrenceDetail`, `getPendingRecurrenceInstances`, `getTopRecurrenceSuggestion`, `getRecurrenceLinkForTransaction`, `getPendingInstancesByRecurrenceId`, `countPendingSharedRecurrenceInstances`, `getRecurrenceLinkedTransactionIds`) como `(supabase, userId, …)`.
- [x] 1.4 Mover el **generador** a `src/generator.ts` (`generateDueRecurrenceInstances` + `buildPendingInstanceInsert`) y la **detección** a `src/suggestions.ts` (`detectRecurrenceSuggestions`), reusando la date-math de `@grana/money-logic`.
- [x] 1.5 Mover las **mutations** a `src/mutations.ts` (`createRecurrence`, `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence`, `acceptRecurrenceSuggestion`, `dismissRecurrenceSuggestion`). `confirmRecurrenceInstance` delega en los thin creates de `@grana/transactions-mutations`. Devuelven `{ ok, … }` sin auth ni revalidación (viven en el shell).

## 2. Web re-apunta (Decisión 2)

- [x] 2.1 `apps/web/lib/recurrences/queries.ts` re-exporta / delega en `@grana/recurrences` (sin lógica propia de read).
- [x] 2.2 `apps/web/app/_actions/recurrences.ts`: cada action pasa a wrapper thin (valida con los schemas de `@grana/validation`, resuelve auth, llama al package, conserva su `revalidatePath`/invalidación). Incluye `generateDueRecurrenceInstancesAction`.
- [x] 2.3 `pnpm --filter web test` verde (mismo conteo de antes), `pnpm --filter web typecheck` verde. Sin cambio de comportamiento.

## 3. Capa mobile thin (Decisión 3, 5)

- [x] 3.1 `apps/mobile/lib/recurrences/queries.ts`: reads con auth (`supabase.auth.getUser()`) delegando en el package (hub, detalle, pendientes, sugerencia top).
- [x] 3.2 `apps/mobile/lib/recurrences/mutators.ts`: `pause/resume/delete` regla, `confirm/skip` instancia, `accept/dismiss` sugerencia, y `generateDueInstances` — cada uno resuelve auth, delega al package, y localiza el resultado. Cache invalidation en `apps/mobile/lib/recurrences/invalidate.ts` (query keys del hub/pendientes + del feed de movimientos al confirmar).
- [x] 3.3 Query keys y contratos alineados con el patrón de `lib/transactions/`.

## 4. Hub nativo `/transactions/recurring` (Decisión 3, 6)

- [x] 4.1 Pantalla `apps/mobile/app/(app)/transactions/recurring/index.tsx`: `PageHeader` (back al feed) visible desde el primer paint; `useQuery` de reglas; skeleton (`SkeletonBlock`) durante la carga; estado de error.
- [x] 4.2 **Tabs de estado** (Activas/Pausadas/Finalizadas) con `Segmented`; cards de regla read-only (monto, próxima fecha, frecuencia, badge de estado, badge de compartida); estados vacíos por tab (keys `recurrences.empty*`).
- [x] 4.3 **Generación perezosa** al enfocar: `useFocusEffect` dispara `generateDueInstances` una vez por foco (guard `useRef`); si `created > 0`, invalida las queries del hub/pendientes. Best-effort; nunca bloquea el read.
- [x] 4.4 **Entry point**: afordancia "Recurrencias" en el header del feed de Movimientos (`app/(app)/transactions/index.tsx`) que empuja el hub.

## 5. Detalle de regla `/transactions/recurring/[id]` (Decisión 4)

- [x] 5.1 Pantalla `apps/mobile/app/(app)/transactions/recurring/[id].tsx`: `PageHeader` + resumen read-only (monto protagonista, frecuencia, cuenta/→destino, categoría, próxima, fin) desde `getRecurrenceDetail`; skeleton + estado not-found.
- [x] 5.2 Lista de instancias generadas (`RecurrenceInstancesList` nativa) debajo del resumen (pending/confirmed/skipped), reusando `MovementRow`/tono donde aplique.
- [x] 5.3 Acciones en el header: **Pausar/Reactivar** (un control que togglea según `status`) e **Eliminar** (`Alert.alert` destructivo → `deleteRecurrence`; al éxito invalida y vuelve al hub). **Sin Editar** (③.2). Chrome siempre visible.

## 6. Feed: pendientes + sugerencia (Decisión 5, 7)

- [x] 6.1 **Bloque de instancias pendientes** en el feed (`app/(app)/transactions/index.tsx`), separado del historial: por instancia, **Confirmar** (→ `confirmRecurrenceInstance`, materializa el movimiento e invalida feed+hub) y **Omitir** (→ `skipRecurrenceInstance`). Warning de saldo negativo DIFERIDO (nicety read-only). Confirma con el snapshot (sin override inline en esta slice). Instancias compartidas con su badge.
- [x] 6.2 **Banner de sugerencia** (`getTopRecurrenceSuggestion`): **Aceptar** (→ `acceptRecurrenceSuggestion`, crea la regla e invalida) / **Descartar** (→ `dismissRecurrenceSuggestion`). Deep-link a la regla creada / al hub.

## 7. i18n + verificación

- [x] 7.1 Auditar `recurrences.*` en `@grana/i18n-messages`: reusar las keys existentes (title/empty/statuses/actions/confirmations/suggestion/pending/history); agregar sólo las **native-only** faltantes (p. ej. label de carga del hub) en `es.json` **y** `en.json`.
- [x] 7.2 Typecheck web + mobile verde; `pnpm --filter web test` verde (mismo conteo); lint mobile/web verde (salvo warnings pre-existentes).
- [x] 7.3 Smoke en device: hub por tab (activas/pausadas/finalizadas) + estados vacíos; generación perezosa al enfocar; detalle con historial; **pausar/reactivar/eliminar** una regla; **confirmar/omitir** una instancia pendiente (incl. warning de saldo); **aceptar/descartar** una sugerencia; caso de regla/instancia **compartida** (badge + confirmar crea gasto compartido).
