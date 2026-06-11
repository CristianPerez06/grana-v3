# Tasks: transactions-direct-reads

## 1. Fundación — auth y RLS (sin tocar UI)

- [x] 1.1 Verificar el algoritmo de firma del JWT del proyecto Supabase; si usa el secret legacy (HS256), rotar a signing keys asimétricas desde el dashboard (resuelve la Open Question de design D3)
- [x] 1.2 Migrar `proxy.ts` (vía `lib/supabase/middleware.ts`) de `auth.getUser()` a validación local de claims, conservando el refresh del token expirado y el redirect a login para sesión ausente/inválida
- [x] 1.3 Migrar `getAuthenticatedUserId()` (`app/_actions/_lib/auth.ts`) al mismo mecanismo de validación local (incluye `lib/auth/guards.ts` y el gate de `(app)/layout.tsx`, que corrían `getUser()` de red en cada render)
- [x] 1.4 Audit de RLS de las tablas del read path de `/transactions` (`transactions`, `accounts`, `categories`, `subcategories`, `recurrences`, `recurrence_instances`, `recurrence_suggestion_dismissals`, `period_payments`, `card_periods`, `household`, `household_member`): RLS habilitado + policy de SELECT correcta (owner/household) por tabla; documentar el resultado en el change → `rls-audit.md`
- [x] 1.5 Corregir por migración cualquier hallazgo del audit (policies faltantes o más abiertas que el contrato server actual) → sin hallazgos; no se requieren migraciones

## 2. RPC de la página de movimientos

- [x] 2.1 Escribir la migración con `get_movements_page(...)` (`SECURITY INVOKER`): filtros completos en SQL (fechas/mes, categoría, subcategoría + marker "sin subcategoría", moneda, cuenta con parents y card payments, tipo funcional, texto `ilike`, rango de montos), exclusión de reimbursements no recibidos/cancelados, linked expense embebido por `LEFT JOIN`, `limit + 1` para `hasMore`
- [x] 2.2 Implementar la query function TS client-agnóstica `getGlobalMovementsPage(supabase, options)` que invoca la RPC y mapea a `FinancialMovement` (reutiliza `toFinancialMovement`)
- [x] 2.3 (migración `0029` aplicada por el usuario en el dashboard) Verificar paridad de resultados RPC vs implementación actual sobre datos reales (mismos filtros → mismas filas y orden) y cubrir el contrato con tests del mapeo

## 3. Query functions client-agnósticas

- [x] 3.1 Refactorizar las funciones de lectura de `lib/transactions/queries.ts` usadas por `/transactions` (`getMovementFilterOptions`, `hasAnyTransaction`, `hasUsdActivityInMonth`, `getMonthCategoryBreakdown` wrapper, `getMonthIncomeBreakdown`, `getMonthSubcategoryBreakdown`, `getPendingReimbursements`) a firma `(supabase, …)` sin `createClient` interno
- [x] 3.2 Ídem para las lecturas de `lib/recurrences/queries.ts` que usa la ruta (`getPendingRecurrenceInstances`, `getRecurrenceLinkedTransactionIds`, `getTopRecurrenceSuggestion`)
- [x] 3.3 Ídem para `getAccounts`, `getAllCategories`, `getHousehold` (consumidas por el drawer loader y los pending blocks); ajustar los callers server-side existentes pasándoles el server client
- [x] 3.4 Typecheck + lint del monorepo verdes tras el refactor de firmas

## 4. Migración de containers de /transactions

- [x] 4.1 Migrar `movement-list-container.tsx` y `movement-filters-container.tsx` a las queries directas (RPC page + filter options + has-any + linked recurrence ids), conservando query keys y `staleTime`
- [x] 4.2 Migrar `category-spending-overview-container.tsx` (usd activity, breakdowns de categoría/ingresos/subcategoría, categories tree)
- [x] 4.3 Migrar `pending-recurrences-block-container.tsx`, `pending-reimbursements-block-container.tsx` y `recurrence-suggestion-banner-container.tsx` (esta última con `staleTime` ≥ 30 min)
- [x] 4.4 Migrar `movement-drawer-loader.tsx` (accounts / categories / household) — beneficia a todas las rutas `(app)` por vivir en `AppShell` (incluye `transactions-header.tsx`, que comparte las mismas tres queries)
- [x] 4.5 Sacar `generateDueRecurrenceInstances()` de `getMovementsPageAction`: exponerla como server action de mutación independiente, dispararla fire-and-forget al montar `/transactions` e invalidar pending recurrences + movements cuando `created > 0`

## 5. Cleanup y verificación

- [x] 5.1 Eliminar de `app/_actions/queries.ts` los wrappers de lectura que quedaron sin consumers, y el código muerto de `lib/transactions/queries.ts` (loop de chunks, `attachLinkedExpenses` para el listado global) → quedan solo los wrappers legacy con consumers en rutas no migradas (/accounts/[id], /dashboard, /transactions/recurring), marcados como legacy; AGENTS.md actualizado con el patrón canónico
- [x] 5.2 Verificar con la app corriendo: cold-load de `/transactions` dispara requests paralelas a Supabase (Network tab), sin POSTs seriales de actions de lectura ni llamadas a `auth/v1/user` en el camino de datos
- [x] 5.3 Smoke test funcional de la ruta: filtros (mes, categoría, subcategoría, cuenta, tipo, texto, montos), load more, empty states, pending blocks, sugerencia, drawer de alta/edición e invalidaciones post-mutación
- [x] 5.4 `pnpm openspec:check` + suite de tests verde; commit squasheado con título conventional-commits en la rama feature (sin merge a main)
