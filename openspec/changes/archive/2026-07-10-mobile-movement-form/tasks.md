# Tasks — mobile-movement-form

## 1. Extraer las thin mutations a `@grana/transactions-mutations` (Decisión 1)

- [x] 1.1 Crear `packages/transactions-mutations/src/thin-mutations.ts` con las creates isomórficas `createIncome`, `createExpense`, `createTransfer`, `createAdjustment`, `createExchange` — firma `(supabase, userId, validatedInput) → { ok, id?, formError?, fieldErrors? }`, portando el cuerpo `.insert({...})` de `apps/web/app/_actions/transactions.ts` sin cambios de comportamiento. Incluir `verifyActiveCurrency` (helper de dominio) co-locado.
- [x] 1.2 Portar las updates isomórficas `updateTransaction`, `updateTransfer`, `updateAdjustment`, `updateExchange`, `updateInstallmentParent` con la misma firma/frontera (existing-row checks + status guards incluidos).
- [x] 1.3 Reusar `applySharedSplits` / `insertDeclaredReimbursement` (ya en el package) desde `createExpense`/`registerCardPurchase` — no duplicar la danza de rollback.
- [x] 1.4 Exportar todo desde `packages/transactions-mutations/src/index.ts`.
- [x] 1.5 Reescribir `apps/web/app/_actions/transactions.ts` para que cada action sea un wrapper thin: `validate(schema) → getAuthenticatedUserId() → shared.fn(sb, userId, data) → revalidateAfterMovementMutation()`. Firma pública y query keys sin cambios.
- [x] 1.6 Agregar tests vitest en `packages/transactions-mutations/__tests__/thin-mutations.test.ts` (al menos las creates: fila insertada correcta, propagación de reintegro/split, `verifyActiveCurrency` bloqueante).

## 2. Household read thin en mobile (Decisión 2)

- [x] 2.1 Crear `apps/mobile/lib/shared/queries.ts` con `getHousehold(supabase): Promise<Household | null>` — espejo del web (`apps/web/lib/shared/queries.ts`), proyectando al shape `Household` de `@grana/movement-form`. Comentario apuntando al trigger de extracción (módulo Hogar mobile).

## 3. Mutators + cache invalidation mobile (Decisión 1)

- [x] 3.1 Agregar `@grana/movement-form` y `@grana/transactions-mutations` a `apps/mobile/package.json`; `pnpm install`.
- [x] 3.2 Crear `apps/mobile/lib/transactions/mutators.ts` — objeto `Mutators` que bindea cada slot a `validate(schema) → supabase.auth.getUser() → shared.fn(sb, userId, data) → { ok, ... }`. Wirear `suggestCategoryFromHistory` a la query de sugerencia (o stub que devuelve `null` si aún no hay read nativo — el hook lo tolera).
- [x] 3.3 Crear `apps/mobile/lib/transactions/invalidate.ts` con `invalidateAfterMovementMutation(queryClient)` — invalida las query keys del feed (`['transactions','feed']`), dashboard y accounts (mirror semántico del helper web).

## 4. Pantalla `/transactions/new` (Decisión 3 + 4)

- [x] 4.1 Crear `apps/mobile/app/(app)/transactions/new.tsx` (o `transactions/new` según el layout de la ruta actual) full-screen: `PageHeader` navy (chrome visible desde el primer paint) + `ScrollView` con `pb-28`.
- [x] 4.2 Cargar `accounts` (proyectadas a `MovementFormAccount`, filtradas a cash/bank), `categories` (`getAllCategories`), `household` (`getHousehold`) vía TanStack Query; montar `useMovementForm` cuando resuelven (cold-load con placeholders, sin tapar la chrome).
- [x] 4.3 Tabs `Gasto · Ingreso · Transferencia` (`Segmented`) wire a `form.setTab`.
- [x] 4.4 Campos: monto (`MoneyAmountInput`, hero, color por tono) · cuenta (picker cash/bank) · fecha (`DateField`) · descripción (`Input` + `fetchSuggestionForDescription` on blur, `applySuggestion`) · categoría con drill a subcategoría (Gasto/Ingreso) · destino (Transferencia).
- [x] 4.5 Aviso de saldo negativo (`form.negativeWarning`) no bloqueante.
- [x] 4.6 Toggle "Compartir gasto" + slider de split (Gasto, cuando `household` tiene 2 miembros) wire a `form.sharedEnabled` / `form.splitFirstPct` — el 100%-al-otro es alcanzable (0/100).
- [x] 4.7 CTA de submit (`form.onSubmit`, `form.isSubmitting`, `FormError` con `form.formError`); `onSuccess` → `router.back()` al feed; `onMutationSuccess` → `invalidateAfterMovementMutation`.

## 5. Encender el FAB

- [x] 5.1 `apps/mobile/components/transactions/QuickAddFab.tsx`: `DISABLED = false` — sin `opacity-50`/`accessibilityState.disabled`; el tap navega a `/transactions/new`.

## 6. i18n

- [x] 6.1 Verificar que las keys de error del hook ya existan en `@grana/i18n-messages` (las usa web); agregar las keys de la pantalla (labels de tabs/campos/CTA/split) a `es.json` y `en.json` si faltan.

## 7. Verificación

- [x] 7.1 `pnpm --filter @grana/transactions-mutations test` en verde (creates/updates + los suites existentes).
- [x] 7.2 Typecheck web + mobile en verde (`pnpm -r typecheck` o los filtros equivalentes); tests web en verde (behavior-preservation de las actions).
- [x] 7.3 Lint en verde.
- [x] 7.4 Smoke manual en mobile: alta de gasto (cash), ingreso, transferencia; gasto compartido 50/50 y 100-al-otro; aviso de saldo negativo; el feed se refresca tras el alta.
