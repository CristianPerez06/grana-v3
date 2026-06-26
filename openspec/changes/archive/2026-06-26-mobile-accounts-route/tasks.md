## 0. Prerequisitos

- [x] 0.1 `accounts-mutations-neutral-errors` aplicada (contrato `messageKey` traducible por `useT`).
- [x] 0.2 `transactions-read-slice` aplicada (`@grana/transactions` expone `getAccountMovementsAscending`, `getPendingReimbursements`).

## 1. Deps + navegación

- [x] 1.1 Agregar `@grana/accounts` y `@grana/transactions` a `apps/mobile/package.json` (`workspace:*`); `pnpm install`; React en una sola versión.
- [x] 1.2 Convertir `app/(app)/accounts.tsx` en stack: `app/(app)/accounts/_layout.tsx` (`Stack { headerShown:false }`), mirror de `settings/categories/_layout.tsx`. Mantener `accounts` como hidden tab (`href:null`) en `(app)/_layout.tsx`.
- [x] 1.3 Confirmar que `AccountsCard` del dashboard sigue navegando con `router.push('/accounts')` al index del stack.

## 2. Capa de datos mobile (reads)

- [x] 2.1 `lib/accounts/query-keys.ts`: keys propios (`accountsList`, `accountDetail(id)`, `institutions`, `accountMovements(id)`, `accountPendingReimbursements(id)`).
- [x] 2.2 `lib/accounts/queries.ts`: hooks TanStack `useAccountsList` (`getCashAndBankAccounts`), `useArchivedAccounts` (`{ archivedOnly:true }`), `useAccountDetail` (`getAccountDetail`), `useInstitutions` (`getInstitutions`), `useAccountMovements` (`getAccountMovementsAscending` de `@grana/transactions`), `usePendingReimbursements` (`getPendingReimbursements`). Mirror de `useDashboardHero`.
- [x] 2.3 `lib/accounts/invalidation.ts` (o helper): invalidar `accountsList`/`accountDetail`/`institutions`/movimientos tras mutación.

## 3. Capa de datos mobile (mutator)

- [x] 3.1 `lib/accounts/mutations.ts`: tipo `ActionResult = { ok:true; id? } | { ok:false; errorKey; fieldErrors? }` (mirror `lib/categories.ts`). Helper `requireUserId()` (`supabase.auth.getUser()`).
- [x] 3.2 Wrappers para las 7 mutations de `@grana/accounts` (`createAccount`, `updateAccount`, `archiveAccount`, `reactivateAccount`, `deleteAccount`, `addCurrencyToAccount`, `deactivateCurrencyFromAccount`): inyectan `{ supabase, userId, input/id/accountId, today: getTodayAR() }`.
- [x] 3.3 Mapeo del resultado neutro: `messageKey` → `errorKey` directo; `errorCode` PG → `errorKey` (mismo mapeo que web: `23505`→`accounts.errors.duplicate`, else `accounts.errors.generic`); `reason` (p.ej. `pending_debt`) se preserva para ramificar UX; `fieldErrors` passthrough.
- [x] 3.4 Cada wrapper invalida los query keys correspondientes en éxito.

## 4. Lista (`accounts/index.tsx` + componentes)

- [x] 4.1 `accounts/index.tsx`: `SafeAreaView edges=['top']` + `PageHeader` (título "Cuentas", acción "Crear" → push `accounts/new`, disabled hasta cargar instituciones). Chrome visible desde first paint.
- [x] 4.2 `components/accounts/AccountSection.tsx` + `AccountRow.tsx`: secciones Efectivo / Cuentas bancarias (activas) y Archivadas (solo si existen); por fila avatar + nombre/institución + saldos ARS/USD (tabular).
- [x] 4.3 `components/accounts/AccountRowMenu.tsx`: `Popover` (bottom sheet) + `MenuItem`s — Editar (push edit), Archivar/Eliminar (según `is_active`/`has_transactions`) con `Alert.alert` de confirmación, Reactivar (directo). Patrón de `CategoryRow`.
- [x] 4.4 Empty state + hint de primer uso (paridad con web: una sola cuenta activa).

## 5. Detalle (`accounts/[id]/index.tsx` + componentes)

- [x] 5.1 `accounts/[id]/index.tsx`: `PageHeader` con `backLink` a la lista + acción Editar.
- [x] 5.2 Hero navy: avatar + nombre + institución/tipo + saldos ARS/USD; badge Archivada si aplica.
- [x] 5.3 Card de reintegros pendientes (`usePendingReimbursements`) — "A confirmar".
- [x] 5.4 Link "+ Agregar moneda" (condicional a monedas disponibles) → push `accounts/[id]/currency`.
- [x] 5.5 Lista de movimientos: `useAccountMovements`. **Decidido (parity web app en breakpoints mobile):** sin saldo corriente por fila — esa columna es `hidden md:block` en web; el saldo total vive en el hero. El signo/monto por fila usa `resolveMovementView` de `@grana/money-logic` (no se reimplementa). Spec #3 actualizado en consecuencia.
- [x] 5.6 Componente fila de movimiento nativo (fecha/descripción/monto con tono).

## 6. Crear / Editar (`accounts/new.tsx`, `accounts/[id]/edit.tsx`)

- [x] 6.1 `components/accounts/CreateAccountForm.tsx`: nombre (opcional, fallback a institución), institución (`BankSelector`), saldos iniciales ARS/USD (`MoneyAmountInput`, permite negativo). Preview opcional. Submit → `createAccount` → invalidar → navegar al detalle.
- [x] 6.2 `components/accounts/EditAccountForm.tsx`: nombre + institución editables; saldos **locked**. Submit → `updateAccount`.
- [x] 6.3 `components/accounts/BankSelector.tsx`: búsqueda + lista de instituciones + alta de institución custom inline (nombre + color picker, `ACCOUNT_COLOR_KEYS`). Confirmar fidelidad con mock nativo.
- [x] 6.4 `components/accounts/AccountAvatar.tsx` + color picker para crear/editar. (Avatar = `ui/AccountAvatar` con `resolveAccountAvatar` para el preview; el color picker vive en el alta de institución custom del `BankSelector`, igual que web — crear/editar no exponen picker propio.)
- [x] 6.5 Pantallas `new.tsx` / `[id]/edit.tsx`: `PageHeader` + `backLink`, `ScrollView keyboardShouldPersistTaps="handled"`. Errores de form vía `useT(errorKey)` + `fieldErrors`.

## 7. Moneda (`accounts/[id]/currency.tsx`)

- [x] 7.1 Agregar moneda (`addCurrencyToAccount`, con saldo inicial) y desactivar moneda (`deactivateCurrencyFromAccount`), con sus guards (última moneda, saldo ≠ 0) mostrando el mensaje traducido.

## 7b. Entry point (Menú) + toolbar de movimientos

- [x] 7b.1 Agregar item "Cuentas" (`nav.accounts`, ícono `Wallet`) al `AppMenu` mobile → `router.push('/accounts')`. (Realiza el entry point que el requirement de navegación ya asumía.)
- [x] 7b.2 `lib/accounts/movement-filters.ts`: estado `AccountMovementFilters`, helpers de mes (`currentMonth`/`shiftMonth`/`monthLabel`), `applyAccountFilters` + `movementMatchesText` (paso nativo puro sobre `TransactionWithDetails`; `resolveMonthRange` de `@grana/dashboard`), `activeFilterCount`.
- [x] 7b.3 `components/accounts/MovementsSection.tsx`: toolbar (mes ‹ label ›, Buscar, Recurrencias, Filtros con badge) + búsqueda inline + chips activos removibles + lista filtrada. Opciones de categoría/subcategoría derivadas de los movimientos.
- [x] 7b.4 `components/accounts/MovementFiltersSheet.tsx`: hoja (modal) con tipo/categoría/subcategoría/moneda/monto mín-máx + Limpiar/Aplicar. Reusa keys `transactions.filters.*` y `transactions.types.*`.
- [x] 7b.5 `app/(app)/accounts/recurring.tsx`: ruta placeholder vacía (destino de "Ver recurrencias"); sin construir el módulo de recurrencias todavía.

## 8. i18n + tokens

- [x] 8.1 Confirmar que las keys de cuentas usadas existen en `@grana/i18n-messages`; agregar las de labels nativos nuevos (es + en, paridad). (Las 70 keys referenciadas ya existían en es+en — el bloque `accounts` se construyó completo en web; no hizo falta agregar ninguna.)
- [x] 8.2 Verificar que toda la UI usa tokens estructurales (no aliases shadcn) y `lib/colors.ts` para props RN no-className. (Grep confirmó 0 usos de aliases web-only `var(--)`.)

## 9. Verificación

- [x] 9.1 `pnpm --filter mobile typecheck` pasa.
- [x] 9.2 `pnpm --filter mobile lint` pasa. (0 errores; 2 warnings preexistentes en `lib/cards/queries.ts` y `scripts/gen-icons.mjs`, ajenos a esta change.)
- [x] 9.3 Pase manual en simulador (paridad flujo por flujo, ver design): navegación desde Menú; lista (activas+archivadas); crear (banco + institución custom + saldos); detalle (saldos + movimientos + reintegros + toolbar de filtros); editar; agregar/desactivar moneda (guards); archivar/eliminar/reactivar (confirmación + guard de movimientos); flujos de error traducidos por `useT`. (Confirmado por el usuario.)
- [x] 9.4 `openspec validate mobile-accounts-route --strict` OK.
