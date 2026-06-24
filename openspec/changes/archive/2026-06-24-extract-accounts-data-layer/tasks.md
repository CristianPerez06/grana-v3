## 0. Prerequisito

- [x] 0.1 `extract-cards-read-slice` aplicada y mergeada a main; `@grana/cards` exporta `getCreditCards`, `getCreditCardDebtCheck`, `CreditCardSummary`. Gate OK.

## 1. Scaffold del paquete

- [x] 1.1 Creado `packages/accounts/package.json` espejo de `@grana/transactions-mutations`: deps `@grana/cards`, `@grana/money-logic`, `@grana/supabase`, `@grana/validation`, `@grana/ui-contracts`, devDep `vitest`.
- [x] 1.2 `pnpm install` OK; React sigue en una sola versión.

## 2. Tipos y balance (mueven limpio)

- [x] 2.1 `packages/accounts/src/types.ts` con `AccountType`, `Account`, `AccountCurrency`, `Institution`, `AccountWithDetails`, `AccountWithBalances`, `GroupedAccounts` (import `ResolvedAccountAvatar` de `@grana/ui-contracts`).
- [x] 2.2 `packages/accounts/src/balance.ts` con `computeBalance` (vive aquí, no en money-logic).

## 3. Reads

- [x] 3.1 `packages/accounts/src/queries.ts` con `getAccounts`, `getCashAndBankAccounts`, `getAccountDetail`, `getInstitutions`. `supabase: GranaSupabaseClient`; `getAccounts` toma `{ today, includeArchived? }` y pasa `today` a `getCreditCards` de `@grana/cards`.
- [x] 3.2 `getTransactionSums` movido al paquete (sobre `calculateTransactionSums` de `@grana/money-logic`) + helpers internos `getAccountIdsWithTransactions`, `addMoneyAmounts`. **Confirmado:** accounts es el único consumer de `getTransactionSums` (besides su propio módulo) → web re-exporta desde `@grana/accounts` en `lib/transactions/balance.ts`.
- [x] 3.3 `packages/accounts/src/index.ts` exporta los 4 reads + `getTransactionSums` + `computeBalance` + tipos.

## 4. Mutations

- [x] 4.1 `packages/accounts/src/mutations.ts` (un archivo, no dir — 7 fns relacionadas) con las 7 mutaciones. Args por-fn `{ supabase, userId, (id|accountId|input), today? }`; sin `'use server'`/`createClient`/`revalidatePath`.
- [x] 4.2 `archiveAccount` consume `getCreditCardDebtCheck` de `@grana/cards` con `today` inyectado.
- [x] 4.3 Validación vía `@grana/validation`; `normalizeActionMoney` preservado.
- [x] 4.4 Resultado neutro `AccountMutationResult<T>` = `{ ok:true; id? } | { ok:false; fieldErrors?; formError?; errorCode?; reason? }`. **Decisión de apply:** los casos que en web usaban `translatePostgresError` devuelven `errorCode` (código PG crudo); el wrapper web traduce. Los mensajes hardcodeados/`.message` pasan como `formError`.
- [x] 4.5 Mutations + `AccountMutationResult` exportadas desde `src/index.ts`.

## 5. Rewire de web a wrappers thin

- [x] 5.1 `apps/web/app/_actions/accounts.ts`: 7 wrappers `'use server'` que resuelven `userId`, crean client, inyectan `today: getTodayAR()`, y un helper `finish()` mapea a `ActionResult` (traduce `errorCode` → `formError` vía `translatePostgresError`, revalida en éxito).
- [x] 5.2 `apps/web/lib/accounts/queries.ts`: `getCashAndBankAccounts`/`getAccountDetail`/`getInstitutions` re-exportan directo; `getAccounts` es wrapper que inyecta `getTodayAR()`. Firma pública web sin cambios.
- [x] 5.3 `lib/accounts/utils.ts` y `lib/accounts/types.ts` re-exportan `computeBalance` y los tipos desde `@grana/accounts`.
- [x] 5.4 `lib/transactions/balance.ts` re-exporta `getTransactionSums` desde `@grana/accounts`; conserva los re-exports de money-logic.
- [x] 5.5 Call sites compilan sin cambios de superficie (typecheck verde; 22 importadores de `@/lib/accounts/queries`). Se agregó `@grana/accounts: workspace:*` a `apps/web/package.json`.

## 6. Verificación

- [x] 6.1 `pnpm --filter web typecheck` pasa.
- [x] 6.2 `pnpm --filter web lint` pasa.
- [x] 6.3 `pnpm --filter web test` pasa: 43 files, 466 tests. **Sin tests que mover:** `account-schema` testea schemas (`@grana/validation`), `account-avatar` testea `resolveAccountAvatar` (`@grana/ui-contracts`); ninguno testea las unidades movidas (computeBalance / queries / mutations).
- [ ] 6.4 Render manual: `/accounts` (lista + balances + archivar/eliminar), `/accounts/[id]` (detalle + editar), alta de cuenta, agregar/quitar moneda, y selectores de cuenta en `transactions`/`shared`/`cards/.../pay` que consumen `getAccounts` con credit embebido. **Pendiente de pase manual con la app corriendo.**
- [x] 6.5 `pnpm openspec:check` → la change valida (`openspec validate extract-accounts-data-layer --strict` OK). **NOTA:** el gate global falla por un TBD pre-existente en `openspec/specs/shared-recurrences/spec.md` (heredado de main, change `add-shared-recurrences` archivada sin completar Purpose) — ajeno a esta change.
