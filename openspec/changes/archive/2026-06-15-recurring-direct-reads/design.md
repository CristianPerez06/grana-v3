## Context

`/transactions/recurring` es la última ruta pendiente del rollout de direct-reads (ver el spec canónico `web-data-access` y las migraciones ya archivadas de `/transactions`, `/accounts/[id]` y `/dashboard`). A diferencia de las anteriores, **no es una ruta client con cola de server-actions**: `page.tsx` es un Server Component que ya fetchea en una sola pasada paralela (`Promise.all`). Tiene, sin embargo, dos violaciones puntuales del patrón:

1. **Write-blocking-read**: `await generateDueRecurrenceInstances(supabase)` corre _antes_ del `Promise.all`, así que todas las lecturas del mount esperan a un write lazy de materialización de instancias. Esto viola "Ningún write bloquea el read path".
2. **Read-wrappers legacy**: `create-recurrence-button.tsx` (client) lee accounts+categories vía `getAccountsAction`/`getAllCategoriesAction`, las últimas dos funciones de `app/_actions/queries.ts` — server actions usadas como `queryFn` de lectura, justo lo que el spec prohíbe.

El patrón de fix para (1) ya existe y está probado en `transactions-shell.tsx` (fire-and-forget en `useEffect` + invalidación cuando `created > 0`). El patrón para (2) es el swap estándar `queryFn: () => queryFn(createClient(), …)` con el browser client de `lib/supabase/client.ts`.

## Goals / Non-Goals

**Goals:**
- Sacar la generación de instancias del camino crítico de lecturas de `/transactions/recurring` (fire-and-forget).
- Que la instancia recién materializada aparezca sin reload manual.
- Migrar los catálogos del botón de creación a reads directos browser→Supabase, preservando query keys y staleTime.
- Borrar `app/_actions/queries.ts` por completo (último consumidor migrado).

**Non-Goals:**
- Rework de UX de `/transactions/recurring/[id]` — es otro change ([[recurrence-detail-rework-brief]]), no se toca acá.
- Convertir `page.tsx` a una ruta client TanStack: el Server Component con `Promise.all` ya es el patrón canónico para reads RSC; solo se le quita el write bloqueante. No se migran sus tres lecturas (`getRecurrences`, `getPendingRecurrenceInstances`, `getAccounts`) a TanStack.
- Cambios de schema, migraciones SQL o RPC nuevas.

## Decisions

**Decisión 1 — La generación se dispara client-side con un componente trigger dedicado, no en el Server Component.**
El Server Component no puede hacer fire-and-forget útil (un `void promise` sin await igual demora el streaming y no tiene forma de refrescar). Se monta un client component mínimo (`'use client'`, render `null`) en `page.tsx` que en `useEffect` llama `generateDueRecurrenceInstancesAction()` (la action ya existente, reusada de `transactions-shell`), con un `useRef` guard para no dispararla dos veces. El `Promise.all` del Server Component deja de incluir el write.
- _Alternativa descartada_: `void generateDueRecurrenceInstances(supabase)` sin await dentro del Server Component. No sirve: en RSC la promesa quedaría huérfana al terminar el render y no hay manera de refrescar la UI cuando crea instancias.

**Decisión 2 — Refrescar la ruta con `router.refresh()`, no invalidar TanStack.**
A diferencia de `/transactions` (donde el pending block es un container TanStack y se invalida por queryKey), acá `PendingRecurrencesBlock` se renderiza server-side con props. El equivalente RSC de "invalidar la query afectada" es `router.refresh()`: re-ejecuta el Server Component (ahora sin el write bloqueante) y la nueva instancia entra por el `Promise.all`. Solo se refresca cuando `created > 0`, igual que la condición de invalidación del pilot.
- _Alternativa descartada_: convertir el pending block a container TanStack para invalidar por key. Fuera de scope y agranda el change sin beneficio — la ruta no necesita refetch parcial.

**Decisión 3 — El swap del botón conserva los query keys `accountsList` / `categoriesTree`.**
Cambiar el transporte no cambia la identidad de cache (regla del spec). `queryFn: () => getAccounts(createClient())` y `() => getAllCategories(createClient())`, importando `createClient` de `@/lib/supabase/client` y las query functions de `@/lib/accounts/queries` / `@/lib/categories/queries`. El resto del componente (memo de `accounts`, gating `ready`, disabled) queda igual.

**Decisión 4 — Borrar `app/_actions/queries.ts` entero.**
Grep confirma que `create-recurrence-button.tsx` es su único consumidor. Tras el swap, el archivo queda muerto y se elimina; ya no queda ningún read-wrapper en el repo (el comentario del archivo lo anticipaba).

## Risks / Trade-offs

- **[Eventual consistency de la instancia generada]** → En cold-load el primer render no incluye la instancia recién materializada; aparece tras el `router.refresh()` post-generación (o en la próxima visita si la generación falla). Es el mismo trade-off ya aceptado y documentado para `/transactions`.
- **[`router.refresh()` re-fetchea las tres lecturas, no solo el pending]** → Costo aceptable: solo ocurre cuando realmente se materializó algo (`created > 0`), que es infrecuente (una vez por período debido). El caso común `created === 0` no refresca nada.
- **[Doble disparo en React Strict Mode / re-mount]** → Mitigado con el `useRef` guard, idéntico a `transactions-shell.tsx`.

## Migration Plan

1. Swap de `create-recurrence-button.tsx` a browser-client reads.
2. Borrar `app/_actions/queries.ts` y verificar typecheck (sin imports colgando).
3. Crear el client trigger de generación y montarlo en `page.tsx`; quitar el `await generateDueRecurrenceInstances` y su import.
4. Actualizar el delta del spec `web-data-access`.
5. `pnpm lint` + `pnpm typecheck`; verificación manual del flujo (cold-load, abrir modal de creación, materialización de una instancia debida).

Rollback: revertir el commit; no hay estado persistente ni migraciones que deshacer.

## Open Questions

_Ninguna._ El patrón fire-and-forget y el swap de queryFn están establecidos por los pilotos previos; este change los aplica a la última ruta.
