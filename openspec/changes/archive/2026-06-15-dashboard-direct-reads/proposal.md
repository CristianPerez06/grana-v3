## Why

`/dashboard` es mayormente RSC (hero + "Dónde está" se renderizan en el server y no refetchean), pero los dos islands con navegación de mes — "Balance del mes" y "En qué se fue" — refetchean vía server actions usadas como `queryFn`. Cuando el usuario cambia de mes, ambos disparan su action y React las serializa: la latencia del cambio de mes es la **suma** de los dos roundtrips, no el máximo. Es el último anti-patrón pendiente del read path web y deja vivos los dos últimos wrappers de lectura legacy de `/dashboard`.

## What Changes

- `dashboard/_components/spending-section.tsx`: el `queryFn` deja de llamar `getMonthCategoryBreakdownAction` y pasa a leer directo browser→Supabase con `getMonthCategoryBreakdown(createClient(), …)` (query function ya client-agnóstica, la misma que el container usa para el `initialData`).
- `dashboard/_components/month-balance-section.tsx`: el `queryFn` deja de llamar `fetchMonthBalanceSeries` y pasa a `getMonthBalanceSeries(createClient(), year, month)` (idem, ya client-agnóstica).
- Se borran los dos últimos read-wrappers de `/dashboard`: `getMonthCategoryBreakdownAction` de `app/_actions/queries.ts` y `fetchMonthBalanceSeries` (único contenido de `app/_actions/dashboard.ts` → se elimina el archivo).
- Se preservan sin cambios los query keys (`['dashboard','category-breakdown',…]`, `['dashboard','balance-series',…]`), el `staleTime` (60s) y el seeding de `initialData` del mes actual desde los containers RSC.
- **Sin cambios** en hero/accounts card (siguen RSC, no son anti-patrón) ni en el camino de mutaciones.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-data-access`: agregar `/dashboard` al conjunto de rutas migradas al patrón canónico de lectura directa browser→Supabase, con un scenario propio para la navegación de mes (los dos refetches corren concurrentes, no serializados).

## Impact

- **Código**: 2 islands client de `/dashboard` (swap de `queryFn` + imports), `app/_actions/queries.ts` (borra 1 wrapper, queda solo lo de `/transactions/recurring`), `app/_actions/dashboard.ts` (se elimina).
- **RLS**: no-op. Las tablas del read path migrado (`transactions`, `accounts`, `categories`) ya tienen RLS + policy de SELECT auditadas y en uso por los reads directos de `/transactions` y `/accounts/[id]`.
- **Sin migraciones SQL**, sin nuevas RPCs, sin cambios de firma en query functions, sin cambios de identidad de cache.
- **Cache/UX**: el cold-load del dashboard ya era server-rendered (no cambia); mejora el cambio de mes (dos refetches concurrentes en vez de en cola).
