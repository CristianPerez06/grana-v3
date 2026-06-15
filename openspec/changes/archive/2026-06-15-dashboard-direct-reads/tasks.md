## 1. Audit RLS (no-op, pre-verificado)

- [x] 1.1 Confirmar que las tablas del read path migrado (`transactions`, `accounts`, `categories`) ya tienen RLS + policy de SELECT en uso por los reads directos de `/transactions` y `/accounts/[id]`; sin tablas nuevas → no se agrega migración.

## 2. Swap de los queryFn a lectura directa

- [x] 2.1 `dashboard/_components/spending-section.tsx`: importar `getMonthCategoryBreakdown` de `@/lib/transactions/queries` y `createClient` de `@/lib/supabase/client`; `queryFn: () => getMonthCategoryBreakdown(createClient(), monthKey(selected.year, selected.month))`; quitar el import de `getMonthCategoryBreakdownAction`. Conservar query key, `initialData` y `staleTime`.
- [x] 2.2 `dashboard/_components/month-balance-section.tsx`: importar `getMonthBalanceSeries` de `@grana/dashboard` y `createClient` de `@/lib/supabase/client`; `queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month)`; quitar el import de `fetchMonthBalanceSeries`. Conservar query key, `initialData` y `staleTime`.

## 3. Borrar wrappers legacy

- [x] 3.1 `app/_actions/queries.ts`: borrar `getMonthCategoryBreakdownAction` (y sus imports ya sin uso); actualizar el comentario de cabecera para indicar que la única ruta pendiente es `/transactions/recurring`.
- [x] 3.2 Borrar el archivo `app/_actions/dashboard.ts` (su único export `fetchMonthBalanceSeries` ya no tiene consumers).

## 4. Verificación

- [x] 4.1 `pnpm --filter web lint` y `pnpm --filter web typecheck` sin errores nuevos.
- [x] 4.2 Runtime: en `/dashboard`, cambiar de mes dispara dos GET concurrentes a `/rest/v1/...` (no POST a la ruta); el mes actual se sirve del `initialData` sin refetch; los estados loading/error in-card de ambos islands siguen OK.
- [x] 4.3 No-regresión: hero ("Para gastar") y "Dónde está" se renderizan igual (RSC, sin cambios); el FAB / quick-add sigue funcionando.
