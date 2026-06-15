## Why

`/transactions/recurring` es la última ruta que todavía viola el patrón canónico de `web-data-access` en dos puntos concretos: el server component bloquea sus lecturas detrás de un write lazy (`generateDueRecurrenceInstances`), y el botón de creación lee sus catálogos vía los **últimos 2 server-action wrappers de lectura legacy** que quedan en el repo. Migrarla cierra el rollout de direct-reads y permite borrar `app/_actions/queries.ts` por completo.

## What Changes

- **Generación fire-and-forget**: sacar `await generateDueRecurrenceInstances(supabase)` del camino crítico de lecturas del server component `transactions/recurring/page.tsx`. El `Promise.all` de lecturas deja de esperar al write; la materialización de instancias debidas se dispara client-side al montar (fire-and-forget) y, cuando crea algo (`created > 0`), refresca la ruta para que la nueva instancia "A confirmar" aparezca sin reload.
- **Catálogos por browser client**: `create-recurrence-button.tsx` deja de llamar `getAccountsAction`/`getAllCategoriesAction` y pasa a invocar `getAccounts`/`getAllCategories` directo con el browser client como `queryFn`, conservando los mismos query keys (`accountsList`, `categoriesTree`) y su política de frescura.
- **Borrado de los wrappers legacy**: eliminado `app/_actions/queries.ts` entero (sus dos funciones eran las últimas read-wrappers; `create-recurrence-button` era su único consumidor). Ya no queda ningún server action usado como `queryFn` de lectura en el repo.
- **Audit RLS**: no-op verificado — el read path no introduce tablas nuevas (`accounts`, `categories`, `recurrences` ya estaban auditadas por los pilotos previos).

## Capabilities

### New Capabilities

_(ninguna — este change adopta el patrón canónico existente en una ruta más)_

### Modified Capabilities

- `web-data-access`: actualizar la lista de rutas migradas para incluir `/transactions/recurring`; sumar un scenario de catálogos del botón de creación fetcheados directo browser→Supabase, y un scenario del write de generación de instancias corriendo fire-and-forget fuera del camino de lecturas de `/transactions/recurring`.

## Impact

- **Código**: `app/(app)/transactions/recurring/page.tsx` (quita el await bloqueante, monta el trigger client), nuevo client component fire-and-forget de generación, `app/(app)/transactions/recurring/_components/create-recurrence-button.tsx` (swap de queryFns), **borrado** de `app/_actions/queries.ts`.
- **Mutaciones**: sin cambios — `generateDueRecurrenceInstancesAction` (ya existente en `app/_actions/recurrences.ts`) se reusa tal cual para el disparo client-side.
- **Datos / RLS / migraciones SQL**: ninguno. No hay tablas nuevas en el read path ni cambios de schema.
- **Cache TanStack**: query keys y staleTime intactos; solo cambia el transporte del fetch.
