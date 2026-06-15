## Context

`/dashboard` ya nace casi todo server-rendered: `DashboardContent` (RSC) monta tres containers RSC bajo `Suspense` — hero ("Para gastar" + "Dónde está"), "Balance del mes" y "En qué se fue". Cada container fetchea su snapshot del mes actual en el server y lo pasa como `initialData` a su section client. El cold-load NO sufre el anti-patrón de cola de actions (las tres lecturas corren en el server, paralelas vía Suspense).

El anti-patrón vive solo en la **navegación de mes**: las dos sections con navegador de mes (`month-balance-section.tsx`, `spending-section.tsx`) son client y, al cambiar el mes seleccionado, refetchean vía server actions usadas como `queryFn`:
- `spending-section.tsx:47` → `getMonthCategoryBreakdownAction(monthKey(...))`
- `month-balance-section.tsx:152` → `fetchMonthBalanceSeries(year, month)`

Como ambos islands comparten el `DashboardMonthProvider`, un cambio de mes dispara los dos refetches a la vez; React serializa las dos server actions y la latencia del cambio de mes es la suma de ambos roundtrips.

Las dos query functions subyacentes ya son client-agnósticas y ya se usan server-side para el `initialData`:
- `getMonthCategoryBreakdown(supabase, month)` — `apps/web/lib/transactions/queries.ts` (delega en `@grana/dashboard`); lee `transactions` (+ `categories`).
- `getMonthBalanceSeries(supabase, year, month)` — `@grana/dashboard`; lee `accounts` + `transactions`.

## Goals / Non-Goals

**Goals:**
- Que el cambio de mes en `/dashboard` refetchee directo browser→Supabase, concurrente, sin cola de server actions.
- Borrar los dos últimos read-wrappers de `/dashboard` y dejar `app/_actions/queries.ts` solo con lo de `/transactions/recurring`.
- Conservar query keys, `staleTime` (60s) y el seeding de `initialData` del mes actual exactamente como están.

**Non-Goals:**
- Tocar hero / "Dónde está" (siguen RSC; no son anti-patrón).
- Cambiar firmas de query functions, agregar RPCs o migraciones SQL.
- Cambiar el comportamiento de cold-load (ya es server-rendered).
- Tocar el camino de mutaciones del FAB / quick-add.

## Decisions

### D1 — Swap mecánico de `queryFn` (mismo patrón que `/transactions` y `/accounts/[id]`)

En cada island, reemplazar la llamada a la action por la query function client-agnóstica invocada con el browser client:
- `spending-section.tsx`: importar `getMonthCategoryBreakdown` de `@/lib/transactions/queries` y `createClient` de `@/lib/supabase/client`; `queryFn: () => getMonthCategoryBreakdown(createClient(), monthKey(selected.year, selected.month))`. Quitar el import de `getMonthCategoryBreakdownAction`.
- `month-balance-section.tsx`: importar `getMonthBalanceSeries` de `@grana/dashboard` y `createClient` de `@/lib/supabase/client`; `queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month)`. Quitar el import de `fetchMonthBalanceSeries`.

`createClient()` del browser es síncrono y barato (no es roundtrip); se puede instanciar dentro del `queryFn`. Query key, `initialData`, `staleTime` y el resto del componente quedan idénticos.

**Alternativa descartada:** mover los reads a un solo `useQueries` compartido. No aporta — cada section ya tiene su propio query key y su `initialData`; con el swap directo TanStack ya dispara los dos refetches en paralelo. Agregar una capa compartida sería sobre-ingeniería.

### D2 — Borrar wrappers legacy

- `getMonthCategoryBreakdownAction` (en `app/_actions/queries.ts`): único consumer era spending-section → borrar. Quedan `getAccountsAction` + `getAllCategoriesAction` (de `/transactions/recurring`); actualizar el comentario de cabecera para que diga que la única ruta pendiente es `/transactions/recurring`.
- `fetchMonthBalanceSeries` (único contenido de `app/_actions/dashboard.ts`): único consumer era month-balance-section → borrar el archivo completo.

### D3 — Audit RLS: no-op (pre-verificado)

Las tablas del read path migrado — `transactions`, `accounts`, `categories` — ya se leen directo browser→Supabase desde `/transactions` y `/accounts/[id]`, con RLS habilitado y policies de SELECT auditadas en esos changes. Esta migración no introduce ninguna tabla nueva al path directo, así que el audit es no-op. Se deja registrado, no se agrega migración.

## Risks / Trade-offs

- **Los containers RSC siguen usando el server client** para el `initialData` del mes actual → la misma query function corre con dos clients distintos (server en el container, browser en el refetch). Es exactamente el contrato client-agnóstico de la capability; no hay riesgo, solo se nota que ambos caminos comparten implementación. → Sin mitigación necesaria.
- **Sesión revocada válida hasta expirar el token** → trade-off ya aceptado y documentado en la capability `web-data-access`; este change no lo cambia.
- **Superficie chica** → el riesgo de regresión se acota a verificar que (a) el mes actual no refetchea (sirve de `initialData`), (b) cambiar de mes pega a PostgREST y no hace POST a la ruta, (c) los estados de loading/error in-card siguen funcionando.

## Migration Plan

1. Swap de los dos `queryFn` (D1).
2. Borrar wrappers + archivo `dashboard.ts` (D2).
3. `pnpm lint` + `pnpm typecheck` en `apps/web`.
4. Verificación en runtime (network tab: cambio de mes = dos GET concurrentes a `/rest/v1/...`, sin POST a la ruta).

Rollback: revertir el commit; las query functions y los wrappers son independientes, sin migración SQL que deshacer.

## Open Questions

Ninguna. El patrón está establecido por los dos changes previos y las query functions ya son client-agnósticas.
