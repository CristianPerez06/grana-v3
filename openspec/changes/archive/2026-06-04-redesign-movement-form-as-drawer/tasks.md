# Tareas — Form de movimientos como drawer

> Depende de `add-custom-recurrence-frequency` (fase 1) y `add-overlay-primitives` (fase 2). No empezar grupos 4–7 hasta que esas fases estén mergeadas.

## Grupo 1 · Drawer wrapper (web) reusando el form actual — ✅ slice 1

- [x] 1.1. Montar `movement-form.tsx` existente dentro del primitivo `Drawer` en `apps/web/app/(app)/transactions/_components/movement-drawer.tsx`. Reusa la lógica intacta; se agregó solo un prop opcional `onSuccess` al form (cerrar+refrescar en vez de navegar).
- [x] 1.2. Estado de apertura elevado a `MovementDrawerProvider` (context en `lib/transactions/movement-drawer-context.ts`, provider en `_components/movement-drawer.tsx`) montado en el shell de `/transactions`.
- [x] 1.3. Wire de openers: **FAB** (mobile) y **CTA desktop** (`RegisterMovementButton` en el `PageHeader`) abren el drawer en create; ambos caen a `/transactions/new` si no hay provider (p. ej. dashboard). **Edición** (decisión de producto, opción 3): la fila sigue yendo a la página de **detalle** (reintegros/cuotas), y el botón "Editar" del detalle abre el **drawer de edición** en vez de navegar a `/[txId]/edit` (que queda como fallback).
- [x] 1.4. Header del drawer hi-fi: eyebrow (NUEVO/EDITAR) + título dinámico + botón cerrar; footer fijo con CTA dinámico (color por tipo + kbd ⌘↵) y "+ Otro" (oculto en edición). El chrome vive en `MovementForm` (prop `variant='drawer'`) para no divergir con las rutas página (`variant='page'`). **Borrado:** queda en el menú del detalle (`TxActionsMenu`), no en el header del drawer (decisión 6.2).

## Grupo 2 · Estructura visual e interacciones del prototipo (web)

- [x] 2.1. Selector de tipo con primitivo `Segmented` (5 opciones; deshabilitado en edición). Reconfigura color de monto, helper, labels de cuenta, toggles y CTA al cambiar.
- [x] 2.2. Amount hero con `MoneyAmountInput`, pill de moneda ARS/USD, color por tipo (ingreso verde, resto navy) + signo, autofocus al abrir (~360ms en drawer), helper por tipo (ingreso/ajuste).
- [x] 2.3. Sign toggle (Sumar/Restar) + context banner ámbar (tokens `--warning*`) + preview de saldo — solo Ajuste.
- [x] 2.4. Filas de campos clickeables (cuenta origen, cuenta destino + swap, categoría, fecha) que abren `Popover`. Cuentas con `AccountAvatar` (resuelto server-side, llevado en `MovementFormAccount.avatar`).
- [x] 2.5. Toggles con primitivo `Switch`: "Tiene reintegro" (Gasto) y "Repetir" (Gasto/Ingreso/Transferencia), con paneles desplegables (icono se tinta verde al activar).

## Grupo 3 · Selector de categoría con drill

- [x] 3.1. Popover de categoría de dos niveles reusando `getAllCategories` y el lenguaje visual de `spending-by-category` (chevron `›`, "Toda la categoría", volver con `‹`).
- [x] 3.2. Chip "Sugerida" alimentado por `suggestCategoryFromHistory` (on blur de descripción); se quita al elegir manualmente. Reusa `CategorySuggestionChip`.

## Grupo 4 · Quinto tab: Cambio de moneda

- [x] 4.1. Layout exchange reusando el lenguaje hi-fi compartido: filas cuenta origen ("Desde") / destino ("Hacia") + fecha (`FieldRow`/`Popover`), monto origen en el hero, y card "Monto recibido" como mini-hero (badge de moneda destino) con **helper de tasa implícita** (`1 USD = $X`, derivada de ambos montos). Reusa `createExchange`/`updateExchange`. (Adoptó los estilos existentes; queda sujeto a validación de Diseño si en el futuro hay mockup propio.)
- [x] 4.2. "Repetir" NO se ofrece en exchange (default: oculto) — el `togglesGroup` excluye `exchange`.

## Grupo 5 · Cuotas, reintegro, repetir (con Personalizado)

- [x] 5.1. Cuotas card hi-fi: aparece con cuenta de crédito en Gasto; pills 1×–24× (scroll-x; activo navy); breakdown "N cuotas de $X". Reusa `registerInstallments`/`registerCardPurchase`. (Pendiente: "primera vence …" requiere datos de período en cliente.)
- [x] 5.2. Panel de reintegro (restyle): toggle `Switch` + panel desplegable, reusando los campos existentes (`reimbursementDeclarationSchema` anidado en el gasto).
- [x] 5.3. Repetir con **Personalizado**: el selector de frecuencia suma "Personalizado", que despliega el control `cada N · unidad` (día/semana/mes/año) + límite de ocurrencias opcional, consumiendo `add-custom-recurrence-frequency`. Al guardar, `createRecurrenceFromMovement` recibe `interval_count`/`interval_unit`/`max_occurrences`. (UI = select + inputs; el restyle a freq-pills hi-fi va con el slice de restyle.)

## Grupo 6 · "+ Otro", edición y atajos

- [x] 6.1. "+ Otro": guarda, limpia monto+descripción (y reset de toggles), mantiene cuenta/fecha/tipo/moneda, refoca el monto. Oculto en edición.
- [x] 6.2. Modo edición en el drawer (desde el detalle): reusa el `MovementForm` en modo edit con `editableFields`, tipo deshabilitado, CTA "Guardar cambios". El contexto se arma con `buildMovementEditContext` (compartido entre la página `/edit` y el drawer). Borrado: sigue en el menú del detalle (`TxActionsMenu`) con sus reglas. Cierra+refresca al guardar.
- [x] 6.3. Atajos: Esc (popover → drawer, vía Radix Popover/Dialog) y ⌘/Ctrl+Enter (submit, handler en el `<form>`).

## Grupo 7 · Capa compartida (extracción a paquetes)

> Renombrado y expandido respecto a la versión anterior ("Extracción + mobile" en un solo grupo). El `design.md` actualizado divide la capa de mutaciones en orquestadores compartidos vs. shells thin por plataforma, y aloja el hook en un package nuevo para no contaminar `@grana/money-logic` con un peerDep de React. Mobile queda en su propio grupo (8) porque puede pausarse sin bloquear el merge a web de esta extracción.

- [x] 7.0. **Audit previo**: confirmar qué helpers puros ya viven en `@grana/money-logic` (sospechosos: `splitAmountIntoInstallments`, `addMonthsToISO`, suma/resta de fechas AR). Lo que ya esté ahí no se duplica; lo que no, se mueve en 7.6. Solo lectura — no escribir nada en este paso; documentar hallazgos en el PR description.

      **Hallazgos del audit:**

      *Ya en `@grana/money-logic` — sin trabajo en 7.6:*
      - `splitAmountIntoInstallments` (`cards.ts:176`)
      - `addMonthsToISO` (`cards.ts:227`)
      - `suggestReimbursementAmount` (`reimbursements.ts:148`)
      - `getEditableFields` + tipo `EditableFields` (`movements.ts:153/169`)

      *Pure pero web-only — mover en 7.6:*
      - `checkNegativeBalance` (`apps/web/lib/transactions/negative-balance-warning.ts`). Solo depende de `Money` de `@grana/validation`. Sin tests propios — el form lo ejercita.
      - `normalizeDescription`, `categoryTypeMatches` (`apps/web/lib/transactions/category-suggestion.ts`). Puros, sin deps, con tests en `__tests__/category-suggestion.test.ts` — mover helpers + tests.

      *Duplicado web↔mobile (TODO ya marcado en código):*
      - `getTodayAR`, `formatDateISO` en `apps/web/lib/date.ts` y `apps/mobile/lib/date.ts`. La copia mobile tiene `TODO(@grana/date or @grana/transactions): duplicación temporal`. Worth consolidar en este change: crear módulo `dates` en `money-logic` (o package `@grana/date-utils`) y reemplazar ambas copias.

      *Inline en `movement-form.tsx` — mover en 7.6:*
      - `todayStr()` (línea 67) duplica `formatDateISO(getTodayAR())` — borrar y reemplazar por los helpers compartidos.
      - `eligibleFor(accounts, tab)` (línea 156) — ~3 líneas, pura.
      - `CURRENCY_SYMBOL`, `INSTALLMENT_OPTIONS`, `fmtBalance` — constantes/formatters puros.

      *NO mover en 7.6 — queda web-only:*
      - `buildMovementEditContext` (`apps/web/lib/transactions/edit-context.ts`). Orquesta queries con `@/lib/supabase/server`, `@/lib/transactions/queries`, etc. La parte pura ya está en `getEditableFields`; mobile escribe su propio wrapper en 8.x con sus propias queries.

      *Impacto en 7.6:* el scope baja sustancialmente. No hay que crear money/date helpers desde cero — solo mover ~2 helpers existentes (con sus tests) + ~4 helpers inline + decidir si consolidar `getTodayAR`/`formatDateISO` (recomendado: sí, el TODO mobile ya lo pide).
- [x] 7.1. Crear package `@grana/transactions-mutations` (interno, no publicado). `package.json` con `peerDependencies`: `@grana/supabase`, `@grana/validation`, `@grana/money-logic`. Sin React, sin Next. `src/index.ts` exporta `{ registerInstallments, registerCardPurchase, createRecurrenceFromMovement }` (stubs por ahora).

      **Implementación:** se usó `dependencies` (no `peerDependencies`) por consistencia con `@grana/money-logic` y los demás packages internos del workspace — peerDeps tienen sentido en libs publicadas donde el host controla la versión; en este monorepo todos los consumers viven al lado y `workspace:*` es la convención. Cada orquestador en su propio archivo (`register-installments.ts`, `register-card-purchase.ts`, `create-recurrence-from-movement.ts`) con tipos `*Args`/`*Result` exportados; el stub lanza `Error('… not implemented (pending task 7.X)')` para que cualquier consumer prematuro reciba un mensaje claro. README documenta qué entra y qué NO (no auth, no revalidate, no React/Next). `pnpm typecheck` y `pnpm typecheck:mobile` verdes.
- [x] 7.2. Mover `registerInstallments` al package nuevo. Firma: `registerInstallments({ supabase, userId, input }): Promise<Result>`. Recibe `userId` ya verificado por el caller; el orquestador NO hace auth ni `revalidatePath`. Preserva la danza de rollback intacta (parent → children → shared splits). Tests unitarios del orquestador contra un cliente Supabase stub o el entorno de tests existente.

      **Implementación:**
      - Firma final: `registerInstallments({ supabase, userId, input, today })`. Se agregó `today: Date` porque `getTodayAR()` aún no está consolidado cross-platform (consolidación pendiente en 7.6); web lo pasa, mobile pasará el suyo cuando aterrice.
      - El orquestador valida internamente con `validateActionInput(registerInstallmentsSchema, input)` para que el shell sea uniformemente delgado (auth + client + call + revalidate). Mobile también obtiene la validación gratis.
      - Helpers internos movidos al package y expuestos por `index.ts`: `applySharedSplits`, `getCardPeriodsWithStatus`, `getOrCreatePeriodForDate`, `type CardPeriodWithPayment`. Web's `_lib/shared-splits.ts` ahora re-exporta desde el package; web's `lib/cards/queries.ts` mantiene las firmas zero-arg como wrappers que crean el client y delegan al package — sin cambios en los 4+ callers externos.
      - `CardPeriodWithPayment` en el package = `Database['public']['Tables']['card_periods']['Row'] & { has_payment, tx_count }` (full row). El tipo en `@grana/money-logic` es la versión narrow que solo necesitan las derivaciones; el package amplía porque `.select('*')` devuelve todo.
      - Web action `registerInstallments` ahora es shell de ~12 líneas (auth → client → orquestador → revalidate).
      - Tests smoke (3) cubren los fail-fast paths: validación, account-not-found, account-not-credit. La cobertura de la danza de rollback (parent/children/shared) se difiere al verify manual de 9.3 — armar el mock-supabase para esos escenarios sería desproporcionado para este package y la lógica es idéntica a la versión web ya cubierta por las pruebas existentes.
      - Verificado: `pnpm typecheck` (web), `pnpm typecheck:mobile`, `pnpm test` (web, 342/342), `pnpm --filter @grana/transactions-mutations test` (3/3) — todos verdes.
- [x] 7.3. Mover `registerCardPurchase` al package nuevo, mismo patrón que 7.2.

      **Implementación:**
      - Firma final igual a 7.2: `registerCardPurchase({ supabase, userId, input, today })`. Validación interna; el shell pasa a auth + client + call + revalidate.
      - `insertDeclaredReimbursement` también movido al package (`internal/declared-reimbursement.ts`) — el orquestador lo usa para crear el reintegro atómico-con-rollback junto al expense. Recibe `today: Date` por el mismo motivo que registerInstallments. Web `_lib/reimbursements.ts` queda como wrapper que inyecta `getTodayAR()` para que el otro caller (transactions.ts) no cambie.
      - Web action `registerCardPurchase` ahora ~12 líneas. Imports de `getCardPeriodsWithStatus`, `getOrCreatePeriodForDate`, `applySharedSplits`, `insertDeclaredReimbursement`, `registerCardPurchaseSchema` removidos del action — ya no se usan en el archivo (sus únicos consumers eran este shell y registerInstallments).
      - Tests smoke (3): validación, account-not-found, account-archived.
      - Verificado: `pnpm typecheck` (web), `pnpm typecheck:mobile`, `pnpm test` (web 342/342), `pnpm --filter @grana/transactions-mutations test` (6/6 acumulado).
- [x] 7.4. Mover `createRecurrenceFromMovement` al package nuevo. Verificar que `lib/recurrences` no arrastre dependencias web-only.

      **Implementación:**
      - Firma: `createRecurrenceFromMovement({ supabase, userId, input })` — sin `today` porque este orquestador no usa reloj (toma `start_date`/`last_generated_date` del seed transaction).
      - **Verificación de deps web-only**: la función NO importa nada de `@/lib/recurrences/*` — los helpers de ese módulo (`mapInstanceToConfirmPlan`, `RecurrenceMapError`, etc.) son consumidos por `confirmRecurrenceInstance` y otros, no por `createRecurrenceFromMovement`. Las únicas deps eran `presetToInterval`/`IntervalUnit` de `@grana/money-logic` (ya shareable) y los schemas/types de `@grana/validation`.
      - Sin rollback (single insert, sin filas derivadas) — el más simple de los 3 orquestadores.
      - Web action es shell de ~12 líneas; import de `createRecurrenceFromMovementSchema` removido (era el único consumer en el archivo).
      - Tests smoke (3): validación, seed-not-found, adjustment rechazado.
      - Verificado: `pnpm typecheck` (web), `pnpm typecheck:mobile`, `pnpm test` (web 342/342), `pnpm --filter @grana/transactions-mutations test` (9/9 acumulado).
- [x] 7.5. **Adaptar server actions web a shells**: `registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement` en `apps/web/app/_actions/*` quedan como ~10–15 líneas: validar input con el schema existente, `getAuthenticatedUserId`, `await createClient()`, llamar al orquestador, `revalidatePath(s)`, return. Tests existentes deben seguir verdes sin cambios. **Verify deliberado en este punto** — es el load-bearing step para probar que la extracción no cambió comportamiento.

      **Implementación:**
      - La conversión a shells se hizo dentro de 7.2/7.3/7.4 — web no compilaba con la lógica fuera y el wrapper aún apuntando al cuerpo viejo. 7.5 es el audit + verify pass.
      - **Forma final de los 3 shells** (11–14 líneas cada uno, todos `auth → client → orquestador → revalidate`):
        - `registerInstallments` (credit-cards.ts:180): pasa `today: getTodayAR()`, revalida `/cards`, `/transactions`, `/shared`.
        - `registerCardPurchase` (credit-cards.ts:156): mismo patrón.
        - `createRecurrenceFromMovement` (recurrences.ts:73): sin `today` (no usa reloj), revalida vía helper `revalidateAfterRecurrenceMutation()`.
      - **Nota sobre revalidación**: los shells de tarjeta preservan los 3 paths originales del action pre-extracción (no `layout`, no `/dashboard`/`/accounts`). El helper `revalidateAfterMovementMutation` cubre más superficie y técnicamente sería más correcto para `registerCardPurchase`, pero cambiar el scope de invalidación queda fuera del alcance de "preservar comportamiento" — guardar para un cleanup futuro si se vuelve necesario.
      - **Audit de imports muertos**: tsconfig no usa `noUnusedLocals`, así que verifiqué con grep. credit-cards.ts y recurrences.ts limpios — todos los símbolos importados tienen body uses; los imports retirados de las extracciones (`registerInstallmentsSchema`, `registerCardPurchaseSchema`, `addMonthsToISO`, `applySharedSplits`, `insertDeclaredReimbursement`, `getCardPeriodsWithStatus`, `getOrCreatePeriodForDate`, `createRecurrenceFromMovementSchema`) ya fueron borrados en sus tareas respectivas.
      - **Verify**: estática (`pnpm typecheck` web + mobile, `pnpm test` web 342/342, `pnpm --filter @grana/transactions-mutations test` 9/9). El click-through end-to-end (alta de cuotas, consumo simple con reintegro/shared/recurrente) queda agendado para 9.3, donde se cubre web + mobile junto con el resto del flujo del drawer.
- [x] 7.6. Extraer helpers puros del form a `@grana/money-logic` (módulo nuevo `src/movement-form.ts`): mappers `form-state → action-payload` por tipo (income/expense/transfer/adjustment/exchange), cascadas (tab → eligible accounts, tab → default currency, tab → toggles válidos), `buildInitialStateFromEditContext`, validadores de submit por tipo. Sin React. Tests unitarios cubriendo cada cascada y cada mapper.

      **Implementación (scope ajustado vs. spec original):**

      El audit de 7.0 mostró que los mappers/cascadas/validadores que la spec listaba NO existen como funciones extraídas en el form — viven inlineadas en `useState` defaults, `onTabChange`, y `handleSubmit`. Extraerlos como funciones independientes ahora y después re-arreglarlos cuando 7.7 construya `useMovementForm` sería trabajo duplicado. Decisión: 7.6 cubre las migraciones de helpers que **ya están** extraídos y bien-localizados, y 7.7 absorbe el resto al diseñar el hook.

      *Movidos en este paso:*
      - `getTodayAR` → `packages/money-logic/src/cards.ts` (junto a `formatDateISO`/`addDaysToISO`/`addMonthsToISO`, sección "ISO date arithmetic + AR clock helpers"). Se consolida la duplicación web↔mobile que el TODO de `apps/mobile/lib/date.ts` señalaba. Los archivos `apps/{web,mobile}/lib/date.ts` quedan como re-exports finos (~3 líneas) para que los ~30 callers existentes no necesiten cambios.
      - `checkNegativeBalance` + `type NegativeBalanceCheck` → `packages/money-logic/src/balance.ts` (sección nueva "Negative-balance soft warning"). `apps/web/lib/transactions/negative-balance-warning.ts` queda como re-export shim para los 4 callers.
      - `normalizeDescription`, `categoryTypeMatches`, `type CategorySuggestion` → `packages/money-logic/src/category-suggestion.ts` (módulo nuevo) + agregado al barrel `index.ts`. `apps/web/lib/transactions/category-suggestion.ts` queda como re-export shim.

      *Diferidos a 7.7 (irán al hook como parte de su diseño natural):*
      - Mappers `form-state → action-payload` por tipo — hoy inlineados en el `handleSubmit` de `movement-form.tsx`.
      - Cascadas (tab → eligible accounts/currency/toggles) — inlineadas en defaults y handlers.
      - `buildInitialStateFromEditContext` — hoy inlineado en los useState defaults.
      - Helpers/constantes inline: `eligibleFor`, `CURRENCY_SYMBOL`, `INSTALLMENT_OPTIONS`, `fmtBalance`, `todayStr` — algunas son UI choices (INSTALLMENT_OPTIONS); otras (`eligibleFor`) dependen del tipo `MovementFormAccount` que el hook va a poseer.

      *Tests:* los tests existentes de `category-suggestion` y `negative-balance-warning` siguen verdes pasando por los re-export shims — el código del package queda ejercitado. No se duplica vitest en money-logic (mismo patrón que ya usaba el repo para `splitAmountIntoInstallments`).

      Verificado: `pnpm typecheck` (web), `pnpm typecheck:mobile`, `pnpm test` (web 342/342), `pnpm --filter @grana/transactions-mutations test` (9/9).
- [x] 7.7. Crear package `@grana/movement-form` (interno). `peerDependencies`: `react`, `@grana/money-logic`, `@grana/transactions-mutations`, `@grana/ui-contracts`. Expone:
      - `useMovementForm({ mutators, initialContext, household }): MovementFormState`
      - `type Mutators` exportado como tipo top-level (no inferido), para que web y mobile rompan en compile time si la interfaz crece. Incluye las ~8 actions thin + los 3 orquestadores. Cada propiedad: una función con firma explícita.
      - `type MovementFormState` con `{ tab, setTab, accountId, …, derived, onSubmit, onSubmitAndAddAnother, isSubmitting, formError }`.
      Tests del hook con un mutators stub.

      **Implementación:**
      - Package nuevo en `packages/movement-form/`. `react` como `peerDependencies`; `@grana/money-logic`/`@grana/transactions-mutations`/`@grana/ui-contracts`/`@grana/validation` como `dependencies` (mismo patrón que los otros packages internos — peerDeps reservados para `react` que la app host controla). DevDeps: `vitest`, `@testing-library/react`, `happy-dom`, `react`/`react-dom` pineados a `19.1.0` (RN 0.81 requirement).
      - **Mutators (14 entries, exportado top-level)**: createIncome/Expense/Transfer/Adjustment/Exchange, updateTransaction/Transfer/Adjustment/Exchange/InstallmentParent, registerCardPurchase, registerInstallments, createRecurrenceFromMovement, suggestCategoryFromHistory. Cada firma explícita usando los `*Input` types de `@grana/validation`. Web actions son directamente asignables a estas firmas (mismo `ActionResult<T>` shape).
      - **MovementFormState**: 28 fields de state + 27 setters + 19 derived values + 5 compound handlers + `onSubmit`/`onSubmitAndAddAnother`/`isSubmitting`/`formError`. Las cascadas viven en `setTab`/`setAccountId`/`setDestinationAccountId` (no en setters individuales).
      - **i18n boundary**: el hook recibe `translate: (key, values?) => string` para los mensajes de validación que genera (`errors.amount_positive`, etc.). Web wirea `next-intl`'s `t`; mobile wireará el suyo. Los `formError` de las mutators ya llegan traducidos por sus shells web.
      - **Cache invalidation**: `onMutationSuccess?: () => void` callback (web pasa `() => invalidateAfterMovementMutation(queryClient)`; mobile pasa su equivalente TanStack). El hook no conoce de query clients.
      - **Diferencias intencionales vs. el form actual**:
        - El autofocus del amount lo hace el caller (UI-specific, requiere `inputRef.current?.focus()`).
        - El `useEffect` que setea `reimbursementAccountId` se mantiene dentro del hook, pero el form puede pasar `accountId` real cuando lo necesite.
        - Sin acceso a `router`/`router.refresh`/`queryClient` — el caller wirea esos via `onMutationSuccess` y `onSuccess`.
      - **Tests smoke (9)**: defaults (tab/account/currency), cascada tab→eligible accounts, cascada tab→clear category, swap accounts, isInstallments derivation, validación (amount required, category required), dispatch a createIncome, dispatch a registerInstallments con 3 cuotas. Renderiza el hook con `renderHook` + `happy-dom`.
      - **Cobertura diferida a 7.8** (donde web ejerce el hook end-to-end): los 5 tabs completos de submit, edit mode (5 branches por type), reimbursement (account vs statement, % auto-calc), shared (split), recurrence dispatcher post-submit, "+ Otro" reset. Los tests actuales prueban la wireup; 7.8 prueba behavior en web.
      - **Verificado**: `pnpm --filter @grana/movement-form typecheck` (paquete con su propio tsconfig + tsc), `test` (9/9), `pnpm --filter web typecheck`, `pnpm --filter mobile typecheck`, `pnpm --filter web test` (342/342), `pnpm --filter @grana/transactions-mutations test` (9/9).
- [x] 7.8. Migrar `apps/web/.../movement-form.tsx` a consumir el hook. El archivo queda como JSX + chrome (`variant='drawer'|'page'`) + el cableado del objeto `mutators` hacia las server actions web. No debería cambiar comportamiento visible — la red son los tests de actions + verify manual con `verify`/`run`.

      **Implementación:**
      - El archivo bajó de **1906 → 1483 líneas** (-423). Toda la JSX y los componentes UI (FieldRow, AccountValue, popovers, segmented, switches) se mantienen. Lo que se removió: 28 useState, 9 handlers (handleTabChange/AccountChange/DestinationChange/DescriptionBlur, submitEdit, handleSubmit, applySuggestion, pickCategory, applyReimbursementPercent), useTransition, y los derived computations (eligibleAccounts, selectedAccount, isCredit, exchangeDestCurrency, effectiveCurrency, currencyOptions, negativeWarning).
      - **Mutators wireup**: objeto literal `Mutators` con las 14 server actions bindead 1:1 (las firmas matchean ya por diseño — mismo `ActionResult<T>` shape entre web y package).
      - **Callback wiring**:
        - `translate`: `(key, values) => values ? t(key, values as ...) : t(key)` — wrap de `useTranslations('transactions')`.
        - `onMutationSuccess`: `invalidateAfterMovementMutation(queryClient) + router.refresh()`.
        - `onSuccess`: `onSuccess?.() ?? router.push(returnHref)`.
      - **MovementEditContext en web vs. package**: web extiende el package type con `returnHref: string` (navegación es web-only). Antes de pasar a `useMovementForm`, el form hace destructure-and-strip de `returnHref` (`{ returnHref: _, ...rest } = edit`).
      - **Lo que queda en el form (UI-only)**:
        - Refs (amountRef, formRef, addAnotherRef), autofocus useEffect, refocus-after-add-another useEffect.
        - `activePopover` + `catDrill` (popover open state).
        - `expenseCategories`/`incomeCategories`/`transactionCategories`/`selectedCategory` recomputadas localmente desde `categories` para preservar el tipo rico de web (icon, color, canonical_name, is_system); el hook narrowea esos para mobile.
        - `pickReimbursementAccount` helper local (espejo del que vive dentro del hook) usado en el toggle-on path del reintegro.
        - Wrappers UI: `pickCategory` (combina `hookPickCategory` con `setCatDrill(null) + setActivePopover(null)`), `handleSwap` (llama `swapAccounts`), `handleAddAnother` (set flag + `hookSubmitAndAddAnother`), `handleDescriptionBlur` (llama `fetchSuggestionForDescription`).
      - **Ajustes en el package gatillados por la migración**:
        - `EditableFields` ahora se re-exporta desde `@grana/money-logic` (no se redeclaraba). Agregué los campos faltantes (`subcategory`, `adjustmentDirection`).
        - `MovementFormState` ahora también expone `setSuggestion` y `setDescriptionHasNoHistory` (los necesita el `onChange` del input de descripción que limpia ambos).
      - **JSX renames mecánicos**: `handleTabChange` → `setTab`, `handleAccountChange` → `setAccountId`, `handleDestinationChange` → `setDestinationAccountId`. Form submit: `<form onSubmit={(e) => { e.preventDefault(); hookSubmit() }}>`.
      - **Verificado (static)**: `pnpm --filter web typecheck` ✓, `pnpm --filter mobile typecheck` ✓, `pnpm --filter web test` 342/342 ✓, `pnpm --filter @grana/transactions-mutations test` 9/9 ✓, `pnpm --filter @grana/movement-form test` 9/9 + `typecheck` ✓.
      - **Diferido a 9.3** (manual verify con `verify`/`run`): el click-through end-to-end por cada tab (income/expense/transfer/adjustment/exchange) en create + edit, con reintegro, shared, cuotas, recurrente, "+ Otro", y atajos ⌘↵ — esa es la red real para confirmar paridad de comportamiento.

## Grupo 8 · Mobile — DIFERIDO a un change nuevo

> **Out of scope para este change.** El usuario decidió en el archive (2026-06-04) splittear la parte mobile a una propuesta futura cuando el form mobile esté listo para consumir el package. La capa cross-platform (`@grana/movement-form` + `@grana/transactions-mutations`) ya está disponible y testeada; el work mobile es pegamento sobre esa capa.
>
> **Qué necesita el change nuevo (referencia):**
>
> - **8.1**: Mutators thin mobile (`apps/mobile/lib/transactions/mutators.ts` o similar): wrappers ~30 LoC sobre `@grana/supabase` para las 8 actions thin (createIncome/Expense/Transfer/Adjustment/Exchange + updateX + updateInstallmentParent + suggestCategoryFromHistory). Los 3 orquestadores se importan directamente de `@grana/transactions-mutations`.
> - **8.2**: `apps/mobile/components/transactions/MovementDrawer.tsx` montando `useMovementForm` sobre el primitivo `Drawer` mobile. PageHeader custom (nunca native stack header).
> - **8.3**: Openers — FAB (`QuickAddFab.tsx`) + fila de movimiento abren drawer en create/edit. Patrón web: fila → detalle, "Editar" del detalle → drawer con `buildMovementEditContext` equivalente mobile.

## Grupo 9 · i18n y verificación

> Era Grupo 8. Sin cambios de contenido salvo 9.2 (suma los tests nuevos de los paquetes) y 9.4 (puede haber spec nueva para la capa de mutaciones compartidas).

- [x] 9.1. i18n keys nuevas del drawer (títulos, CTAs, helpers, labels de tipo, exchange) en `packages/i18n-messages/src/{es,en}.json`.

      **Audit**: enumeré todas las keys que el form referencia (`t('...')` + `t(\`...\${var}\`)`) y las que el hook ahora genera via `translate(key)`. Total: **84 keys distintas** bajo el namespace `transactions`.

      *Por categoría*:
      - **Static keys** (62): `actions.*`, `drawer.*` (account_from/to/toward/to_adjust, eyebrow_new/edit, helper_*, balance_will_be, swap, today, close, credit_badge, credit_hint, repeat_*, whole_category, installments_breakdown, adjust_*), `labels.*` (type, currency, account, amount, category, date, description, destination_account, source_account, exchange_received, installments, make_recurrent, frequency), `placeholders.*`, `tabs.*` (5 tabs), `types.*` (5 tipos), `directions.*` (increase/decrease), `edit_title`, `empty.no_accounts`, `exchange.no_other_currency_hint`, `installment_purchase_label`, `installment_recalc_hint`, `installments_count`, `installments_options.ars_only_hint`.
      - **Dynamic keys** (3 prefijos): `drawer.cta.${tab}` (5 entries: income/expense/transfer/adjustment/exchange), `reimbursement.target.${tg}` (2 entries: account/statement), `frequencies.${f}` (5 entries: weekly/biweekly/monthly/annual/custom).
      - **Reimbursement keys** (11): `reimbursement.{toggle, target_label, estimated_amount, received_now, received_now_hint, pending_hint, percent_label, percent_hint, cap_label, credit_to, credit_to_placeholder, errors.{account_required, amount_positive}}`.
      - **Error keys generadas por el hook via translate(key)** (9): `errors.{amount_positive, category_required_short, destination_required_short, destination_amount_positive, destination_account_no_other_currency, recurrence_failed, recurrence_unknown_error, save_failed, save_failed_short}` (+ `reimbursement.errors.{account_required, amount_positive}` que ya estaban listados arriba).

      *Cobertura verificada* (script Python que recorre el JSON de ambos idiomas y resuelve cada path bajo `transactions.*`):
      - **Missing in es: 0**
      - **Missing in en: 0**

      *Conclusión*: la migración del Group 7 no introdujo strings nuevos — el hook relocó las llamadas pero usa las mismas keys que la versión inline del form ya tenía. Las keys del drawer/reimbursement/exchange ya se agregaron cuando los Groups 1–6 aterrizaron.
- [x] 9.2. `pnpm lint`, `pnpm build` (web), tests de transactions verdes; typecheck mobile verde. Tests nuevos: orquestadores extraídos (7.2–7.4), pure helpers del form (7.6), hook (7.7).

      **Verificado:**
      - `pnpm --filter web lint` — 0 errores, 0 warnings (limpié 5 unused-vars que quedaron de la migración del form: `eligibleFor` local, `setCategoryId`/`setSubcategoryId` destructurados pero ya no llamados directo, `activeCurrencies`/`sharedCurrencies` destructurados pero solo usados vía `currencyOptions`).
      - `pnpm --filter web build` — completo, todas las routes compilan (transactions/new, transactions/[txId]/edit, transactions/[txId], cards/*, etc.). Sin warnings de Server Component boundary; los server actions binden limpio en el client component.
      - `pnpm --filter web typecheck` ✓
      - `pnpm --filter mobile typecheck` ✓
      - `pnpm --filter web test` — 342/342
      - `pnpm --filter @grana/transactions-mutations test` — 9/9 (orquestadores: registerInstallments, registerCardPurchase, createRecurrenceFromMovement)
      - `pnpm --filter @grana/movement-form test` — 9/9 (hook defaults, cascades, swap, isInstallments, dispatch routing, validación)
      - `pnpm --filter @grana/movement-form typecheck` ✓
- [x] 9.3. Verificación manual (skill `verify`/`run`): alta de cada tipo en web y mobile, edición, "+ Otro", cuotas, reintegro, repetir custom, exchange, atajos.

      **Verificado en web**: el usuario corrió el checklist completo (`9.3-verify-checklist.md`) y reportó "all validated. Works great". Comportamiento del form preservado tras la migración a `useMovementForm` — submit dispatcher en los 5 tabs, edit mode (incluyendo parent de cuotas), reintegro a-cuenta y en-resumen, shared, cuotas, recurrencia custom, "+ Otro", y atajos ⌘↵ todos funcionan como antes.

      **Mobile**: pendiente con el resto del Group 8 (no hay drawer mobile todavía — bloqueado por el plan de desarrollo de la app).
- [x] 9.4. Archivar el change. Integrar deltas en:
      - `openspec/specs/transactions/spec.md` (drawer + edit + atajos)
      - Decidir si `@grana/transactions-mutations` justifica spec propia (tiene invariantes reales — rollback) o vive implícita bajo `transactions`.
      - `AGENTS.md` Modules: agregar `@grana/transactions-mutations` y `@grana/movement-form` a la lista de packages.
      Correr `pnpm openspec:check` antes del merge.

      **Implementación:**
      - **Spec sync**: agregué 8 nuevos requirements a `openspec/specs/transactions/spec.md` cubriendo: alta/edición en drawer, monto hero, tab Cambio de moneda, drill de categoría, "+ Otro", Repetir custom, atajos ⌘↵/Esc, chrome de edición (CTA "Guardar cambios" + "+ Otro" oculto), y un nuevo requirement explícito sobre la arquitectura `@grana/movement-form` + `@grana/transactions-mutations` con scenarios para el contract `Mutators`, los orquestadores compartidos, y el drift detector.
      - **Decisión sobre spec propia para `@grana/transactions-mutations`**: vive implícita bajo `transactions`. La invariante de rollback ya está expresada como scenario del requirement de arquitectura; agregarle un capability/spec propio fragmentaría la lectura sin ganar nada (todo cambio en los orquestadores arranca desde el módulo transactions).
      - **AGENTS.md**: agregué las 2 nuevas líneas en el árbol `packages/` (lines 23-24) con descripciones breves del propósito de cada package.
      - **Group 8 mobile** fue splitteado a un change futuro (decisión del usuario en este archive); el detalle del scope queda en este tasks.md + en el project memory `project_movement_form_mobile_pending.md` para no perderse cuando mobile arranque.
      - **Checks**: `pnpm openspec:check` ✓, `openspec validate redesign-movement-form-as-drawer` ✓, `openspec validate transactions --type spec` ✓.
