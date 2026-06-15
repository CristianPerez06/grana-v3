## 1. Catálogos del botón de creación → browser client

- [x] 1.1 En `create-recurrence-button.tsx`, reemplazar los imports de `getAccountsAction`/`getAllCategoriesAction` por `getAccounts` (`@/lib/accounts/queries`), `getAllCategories` (`@/lib/categories/queries`) y `createClient` (`@/lib/supabase/client`).
- [x] 1.2 Cambiar los `queryFn` de las dos queries a `() => getAccounts(createClient())` y `() => getAllCategories(createClient())`, conservando los query keys `QUERY_KEYS.accountsList` y `QUERY_KEYS.categoriesTree` y el resto del componente (memo de `accounts`, gating `ready`, disabled) sin tocar.
- [x] 1.3 Borrar `app/_actions/queries.ts` por completo (último consumidor migrado; grep confirma que no queda ningún import).

## 2. Generación de instancias fire-and-forget

- [x] 2.1 Crear un client component trigger mínimo (`'use client'`, render `null`) que en `useEffect` con `useRef` guard llame `generateDueRecurrenceInstancesAction()` (reusar la action existente de `@/app/_actions/recurrences`) y, cuando `created > 0`, dispare `router.refresh()`; en `catch`, no-op.
- [x] 2.2 En `transactions/recurring/page.tsx`, quitar `await generateDueRecurrenceInstances(supabase)` (línea 25) y su import; el `Promise.all` de lecturas queda intacto.
- [x] 2.3 Montar el trigger client en el render de `page.tsx`.

## 3. Spec y verificación

- [x] 3.1 Confirmar que el delta de `web-data-access` quedó aplicado (lista de rutas migradas incluye `/transactions/recurring`; scenarios de catálogos directos y de generación fire-and-forget presentes).
- [x] 3.2 Audit RLS: verificar que el read path no introduce tablas nuevas (`accounts`, `categories`, `recurrences` ya auditadas) — no-op confirmado: `getAccounts`/`getAllCategories` ya se leen directo browser→Supabase desde `/transactions` y `/accounts/[id]`.
- [x] 3.3 `pnpm lint` + `pnpm typecheck` limpios.
- [x] 3.4 Verificación manual: cold-load de `/transactions/recurring` (lecturas no esperan al write), abrir el modal "Crear recurrencia" (catálogos cargan, botón disabled→enabled), y materialización de una instancia debida apareciendo tras el refresh sin reload manual.
