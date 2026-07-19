# Design — mobile-recurring-hub

## Contexto

El motor de recurrencias está **enteramente web-local**:

```
apps/web/lib/recurrences/queries.ts        ~8 reads + generateDueRecurrenceInstances + detectRecurrenceSuggestions
apps/web/app/_actions/recurrences.ts       ~10 server actions (ciclo de vida de regla + instancias + sugerencias)
apps/web/lib/recurrences/types.ts          Recurrence, RecurrenceInstance, RecurrenceSummary, RecurrenceDetail, PendingRecurrenceInstance
apps/web/lib/recurrences/components/*      bloque de pendientes, banner de sugerencia (React/HTML)
@grana/money-logic/src/recurrences.ts      date-math (ya compartida): getNextExpectedOccurrence, projectUpcomingOccurrences, decideRecurrenceInstance
@grana/transactions-mutations              createRecurrenceFromMovement (único orquestador ya compartido) + thin creates que usa confirm
```

Modelo de datos (sin cambios): `recurrences` (regla; status `active|paused|deleted`), `recurrence_instances` (instancia/propuesta; status `pending|skipped|confirmed`; **un pending por regla** por índice único parcial), `recurrence_suggestion_dismissals` (fingerprints descartados). La instancia es un **snapshot** de la regla al generarse, con overrides al confirmar.

## Decisión 1 — Package nuevo `@grana/recurrences` (no fold en `@grana/transactions`)

El volumen y la cohesión justifican un package dedicado, espejando cómo `@grana/cards` es aparte de `@grana/transactions`. Estructura:

```
packages/recurrences/src/
  queries.ts        getRecurrences, getRecurrenceDetail, getPendingRecurrenceInstances,
                    getTopRecurrenceSuggestion, getRecurrenceLinkForTransaction,
                    getPendingInstancesByRecurrenceId, countPendingSharedRecurrenceInstances,
                    getRecurrenceLinkedTransactionIds
  generator.ts      generateDueRecurrenceInstances (+ buildPendingInstanceInsert)
  suggestions.ts    detectRecurrenceSuggestions
  mutations.ts      createRecurrence, confirmRecurrenceInstance, skipRecurrenceInstance,
                    updateRecurrence, pauseRecurrence, resumeRecurrence, deleteRecurrence,
                    acceptRecurrenceSuggestion, dismissRecurrenceSuggestion
  types.ts          Recurrence, RecurrenceInstance, RecurrenceSummary, RecurrenceDetail,
                    PendingRecurrenceInstance, enums
  index.ts
```

Todas las funciones toman `(supabase: GranaSupabaseClient, userId, …)` y devuelven data o un resultado tipo `{ ok, … }` (mismo shape que el resto de mutations thin). **Dependencia de package**: `@grana/recurrences` → `@grana/transactions-mutations` (los thin `createIncome/Expense/Transfer/registerCardPurchase` que `confirmRecurrenceInstance` invoca al materializar una instancia) + `@grana/money-logic` (date-math) + `@grana/supabase` (client/tipos). Es un grafo de dependencias descendente y sano.

`createRecurrenceFromMovement` **se queda** en `@grana/transactions-mutations` (ya lo consume el alta de movimiento); `@grana/recurrences` no lo re-exporta para no duplicar el owner.

## Decisión 2 — Web re-apunta, comportamiento preservado (el contrato de la extracción)

Cada server action web pasa a ser un **wrapper thin**: valida (schemas ya en `@grana/validation`), resuelve auth, llama a la función del package, y conserva su `revalidatePath(...)` / invalidación. Igual que hicimos con `deleteTransaction` (C.2) y los reads del detalle (C.1). Los reads en `apps/web/lib/recurrences/queries.ts` pasan a re-exportar desde el package. **La prueba de que la extracción no cambió comportamiento son los tests web** (`pnpm --filter web test`, 468 verdes) — no se agregan tests de negocio nuevos; se preserva la cobertura existente re-apuntando.

Riesgo: los reads web devuelven **tipos web** (su `RecurrenceSummary`, etc.). Al mover los tipos al package, web los importa desde ahí. Hay que verificar que no arrastren tipos web-only (p. ej. `CategoryWithSubcategories` de web); si alguno no es isomórfico, se mueve su definición o se parametriza — mismo criterio que las otras extracciones.

## Decisión 3 — Generación perezosa en mobile: `useFocusEffect`, fire-and-forget

Web materializa instancias con `RecurrenceGenerationTrigger`: en el mount del hub dispara `generateDueRecurrenceInstancesAction()` fire-and-forget y hace `router.refresh()` si `created > 0`. **El read path nunca espera la generación** (spec `web-data-access`).

Mobile hace el espejo: en el hub, un efecto de foco (`useFocusEffect`) dispara el mutator de generación una vez por foco (guard con `useRef`), y si `created > 0` **invalida la query** de pendientes/reglas (TanStack, el equivalente nativo de `router.refresh()`). Best-effort: si falla, la instancia aparece en la próxima visita. La lista se renderiza siempre desde el read, sin bloquear.

## Decisión 4 — Detalle de regla read-only + ciclo de vida, SIN form (el seam de ③.1/③.2)

El detalle nativo espeja el **lenguaje de interacción** del requirement general (`transactions:2990`): vista read-only por defecto, acciones en el header como icon-buttons directos (no dropdown), Eliminar con confirmación (no `confirm()` nativo → `Alert.alert` destructivo). Pero **acota el field set a lo que no necesita form**:

- **Pausar/Reactivar**: un único control que togglea según `status` (`pauseRecurrence`/`resumeRecurrence`) — button-mutation, cero form.
- **Eliminar**: `Alert.alert` destructivo (patrón de `AccountRowMenu`/`CategoryRow`; sin `ConfirmSheet` nuevo) → `deleteRecurrence` (soft-delete; borra las instancias pendientes, preserva las confirmadas).
- **Editar**: **NO** en este change. La afordancia Editar (drawer de 4 campos monto/frecuencia/fin/descripción) llega en ③.2 junto con el form de creación, porque ninguno reusa `useMovementForm` y comparten el `useRecurrenceForm` a construir.

El detalle muestra el resumen (monto protagonista, frecuencia, cuenta/→destino, categoría, próxima, fin) + `RecurrenceInstancesList` nativa (historial pending/confirmed/skipped) reusando `MovementRow`/tono donde aplique.

## Decisión 5 — Bloque de pendientes: confirmar es un write real (pero sin form)

El bloque de **instancias pendientes** en el feed permite **Confirmar** (materializa el movimiento real) y **Omitir** una instancia. Confirmar rutea por el `confirmRecurrenceInstance` extraído, que mapea la instancia → plan de movimiento y delega en los thin creates de `@grana/transactions-mutations` — **el mismo grafo que ya usa el alta**. El warning de **saldo negativo** reusa el read de cuentas que el feed ya tiene disponible (o `getAccounts`). Overrides de monto/fecha/descripción al confirmar: web los permite inline; mobile puede empezar confirmando con el snapshot (sin edición inline) y dejar el override fino para después si agrega complejidad — se decide al implementar, pero el default es **confirmar tal cual el snapshot** para no arrastrar un mini-form al bloque.

## Decisión 6 — Entry point del hub (tabs locked)

Las tabs nativas están fijas (Inicio/Movimientos/Hogar/Menú); el hub es una pantalla **pushed**, no una tab. Entry desde el **feed de Movimientos**: una afordancia "Recurrencias" en el header (icon-button), más deep-links contextuales desde el bloque de pendientes ("ver la regla") y el banner de sugerencia. Es coherente con cómo las pantallas extra cuelgan de secciones existentes, no de tabs nuevas.

## Decisión 7 — Compartidas: badge sí, gestión de hogar no

Reglas/instancias **compartidas** (con `household_id` + `split`) se muestran con su badge (paridad con la spec `shared-recurrences`) y se pueden **confirmar** (el confirm extraído ya crea el gasto compartido con su split). Pero la gestión del hogar (editar split, ver miembros) sigue diferida al módulo Hogar. El hub "señala las instancias compartidas" sin abrir su gestión.

## Riesgos / notas

- **Tamaño**: es un change grande (package nuevo + re-point web + 2 pantallas + 2 bloques de feed). El grueso del riesgo está en la **extracción**; cada consumer mobile es thin. Si hace falta acotar durante el apply, los puntos de corte naturales son el **banner de sugerencia** y (ya diferido) el tile del detalle — el hub + detalle + bloque de pendientes son el núcleo irreductible.
- **Sin tests de negocio nuevos**: la extracción preserva comportamiento (cubierto por los tests web al re-apuntar). Verificación = typecheck web+mobile, `pnpm --filter web test` verde, lint, y smoke en device (hub por tab, detalle, pausar/reactivar/eliminar, confirmar/omitir pendiente, aceptar/descartar sugerencia, caso compartido).
- **i18n**: `recurrences.*` ya cubre casi todo; se auditan las keys al pintar y se agregan sólo las native-only faltantes (label de carga, quizá algún caption). No se promete cero-keys.
- **Generación en device**: la generación perezosa escribe en la DB desde el cliente mobile (mismo anon-key/RLS path que web). Es idempotente (índice único de un pending por regla), así que dobles disparos no duplican.
