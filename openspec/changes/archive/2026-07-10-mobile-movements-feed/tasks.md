## 1. Extraer el read del feed global a `@grana/transactions`

- [x] 1.1 Mover `toFinancialMovement` + `toInitialBalanceMovement` + `isInitialBalanceMovement` + `INITIAL_BALANCE_ID_PREFIX` (+ el helper interno `getReviewFlags` y `detailHref`) de `apps/web/lib/transactions/movements.ts` a `@grana/transactions` (ampliado `src/movements.ts`, co-locado con el tipo). Importan `FinancialMovement`/sub-uniones y `TransactionWithDetails` (ya en el package). Re-exportados desde `index.ts`.
- [x] 1.2 Mover el contrato de filtros de `apps/web/lib/transactions/filters.ts` al package (`src/filters.ts` nuevo): `MovementFilters`, `MovementTypeFilter`, `MovementCurrencyFilter`, `SUBCATEGORY_NONE_MARKER`, `DEFAULT_MOVEMENTS_LIMIT`/`MAX`/`STEP`, `MOVEMENT_TYPE_KEYS`, `monthOf`, `shiftMonth`, `movementMatchesText`, y el re-export de `resolveMonthRange` (de `@grana/dashboard`). Re-exportado desde `index.ts`.
- [x] 1.3 Mover `getGlobalMovementsPage`, `getGlobalMovements` y `hasAnyTransaction` de `apps/web/lib/transactions/queries.ts` al package (usan `toFinancialMovement`/`resolveMonthRange` internos). Reciben `supabase` como primer parámetro. Re-exportados desde `index.ts`.
- [x] 1.4 Verificado: el package no importa `next/*` / `server-only` / `'use server'`; `@grana/dashboard` es isomórfico (solo deps `@grana/*` + supabase) y sin ciclo (no depende de `@grana/transactions`). Agregada la dep `@grana/dashboard` a `packages/transactions/package.json`; `pnpm install` OK.
- [x] 1.5 Web recableado a re-exports thin: `movements.ts` re-exporta los mappers del package; `filters.ts` re-exporta el contrato; `queries.ts` re-exporta `getGlobalMovementsPage`/`getGlobalMovements`/`hasAnyTransaction` e imports huérfanos limpiados (conserva `resolveMonthRange` para los breakdowns). Los reads web-only (`getMovementFilterOptions`, breakdowns, `hasUsdAccount`, `getTransactions`) permanecen.
- [x] 1.6 `pnpm --filter web typecheck` + `lint` + `test` (449 passed) verdes; `/transactions` behavior-preserving (mismo RPC, mismo mapper, mismos query keys). El package no tiene test files (typecheck transitivo vía web).

## 2. Wrapper + hook de read en mobile

- [x] 2.1 Crear `apps/mobile/lib/transactions/queries.ts`: wrapper thin `getGlobalMovementsPage(supabase, { month, limit })` sobre el read compartido (patrón de `apps/mobile/lib/cards/queries.ts` — `import { supabase } from '../supabase'`, inyecta el mes seleccionado como `filters.month`).
- [x] 2.2 `useQuery` keyed por `['transactions','feed',{ month, limit }]` (inlineado en la pantalla, patrón del codebase); expone `{ movements, hasMore, nextLimit }`. Mes inicial = `monthOf(getTodayAR())`; cambiar de mes resetea `limit` a `DEFAULT_MOVEMENTS_LIMIT`.
- [x] 2.3 Read auxiliar para el empty-state: `hasAnyTransaction(supabase)` (welcome vs. mes-vacío), como query liviana propia o derivada.

## 3. `MonthNavigator` a ubicación compartida

- [x] 3.1 Levantado `apps/mobile/components/dashboard/MonthNavigator.tsx` → `components/ui/MonthNavigator.tsx` (vía `git mv`, historia preservada); presentacional, prop-driven, sin cambio de comportamiento.
- [x] 3.2 Repuntar el dashboard (`DashboardHeader.tsx`) a la nueva ubicación. `pnpm --filter mobile typecheck` verde; dashboard sin cambio visual.

## 4. Generalizar `MovementRow` / `MovementList` a los 8 kinds (surgido en apply)

Decisión del usuario: **correct + feed enrichments** (ver design §6). El row nativo estaba acotado a `expense`/`reimbursement` (pane de tarjeta); el feed produce los 8.

- [x] 4.1 `MovementRow`: `typeLabelKey` completo (8 kinds) + `structureIcon` (transfer/exchange/adjustment/card_payment) + `categorizedFallbackIcon` (income/expense/installment/reimbursement); primary usa `movement.title` para `adjustment`; secondary maneja transfer/exchange (`origen → destino` vía `counterpartyDirection`) y card_payment (`list.card_payment_from`); chip de cuotas auto-derivado para `installment_purchase` (`installments_count`). Mirror del web row, RN-idiomatic.
- [x] 4.2 Enriquecimientos del feed detrás de props opt-in (default off, el pane no las pasa → queda idéntico): `showAccount?` (subtítulo de cuenta) y `showFeedBadges?` (badges "Revisar"/`review_flags` + "Compartido"/`isShared`). Badge recurrente diferido (sin dato de recurrencia).
- [x] 4.3 `MovementList`: forwardear `showAccount?`/`showFeedBadges?` a cada `MovementRow` (default off). Sin cambio para el call site del pane de tarjeta.
- [x] 4.4 Verificar que el pane de tarjeta (`PeriodMovementsPane`) renderiza idéntico (no pasa las props nuevas); i18n de los 8 type-labels + `list.card_payment_from`/`list.review_short`/`list.shared_short` ya en el catálogo compartido.

## 5. Pantalla Movimientos (feed A-minimal)

- [x] 5.1 Reescribir `apps/mobile/app/(app)/transactions.tsx`: root `bg-page` (no `bg-background`, alias web-only) + `PageHeader` (chrome siempre visible) + selector de mes (`MonthNavigator` con estado local `useState<month>`) + `MovementList` nativo (reusado, `perspective` global, `showAccount`/`showFeedBadges`) sobre superficie `bg-card` (contraste para el skeleton, mirror del pane/detalle; empty-state sin wrapper) + acción "cargar más" (sube `limit` a `nextLimit`, tope `MAX`).
- [x] 5.2 Empty states: welcome (sin historial, `transactions.empty.welcome.*`) vs. mes-vacío (hay historial, `transactions.empty.month.*` con `{month}`), del catálogo compartido `@grana/i18n-messages`.
- [x] 5.3 Loading/first-paint: header + navegador de mes presentes desde el primer frame (nunca tapados por skeleton); la lista muestra `MovementListSkeleton` nativo (twin del web `movement-list-skeleton`, con `SkeletonBlock` + anatomía de `MovementRow` en day-groups) en `isPending` — no un spinner, para no joltear cuando aterriza la data. Padding inferior suficiente para no tapar la última fila con el FAB.
- [x] 5.4 El `QuickAddFab` sigue `DISABLED=true` (write = change B). Las filas son **no navegables** (ignoran `detail_href`; detalle = change C).
- [x] 5.5 `pnpm --filter mobile typecheck` + `lint` verdes.

## 6. Cierre

- [x] 6.1 Web behavior-preserving verificado: 449 tests + typecheck + lint verdes cubren `/transactions`, `/accounts/[id]`, `/dashboard` (el read del feed relocado es puro/isomórfico; mismo RPC y query keys).
- [x] 6.2 Mobile verificado a nivel de código (typecheck/lint verdes): feed navega por mes, "cargar más" pagina dentro del mes, empty states correctos, filas no navegables, FAB deshabilitado. (Smoke en dispositivo fuera del entorno.)
- [x] 6.3 Sin hex literal suelto en la pantalla nueva (tokens estructurales + mirror `lib/colors`); `MonthNavigator` reusado sin fork visual; pane de tarjeta sin regresión (no pasa las props nuevas).
- [x] 6.4 `openspec validate mobile-movements-feed --strict` verde.
