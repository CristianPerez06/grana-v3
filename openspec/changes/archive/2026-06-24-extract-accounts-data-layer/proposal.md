## Why

La capa de datos del dominio `accounts` (reads + mutations + tipos + cálculo de balance) vive hoy dispersa en `apps/web/lib/accounts/` y `apps/web/app/_actions/accounts.ts`, importable solo desde web. Para que mobile pueda construir sus pantallas de cuentas reutilizando la misma lógica —el patrón ya probado con `@grana/movement-form` + `@grana/transactions-mutations`— hay que extraerla a un paquete compartido `@grana/accounts`.

Esta es la **segunda mitad** de una secuencia de dos changes. Depende de `extract-cards-read-slice` (`@grana/cards`), que debe estar aplicada primero: `getAccounts` —el catálogo de cuentas más consumido del repo— embebe los resúmenes `credit` (`getCreditCards`), y `archiveAccount` consulta `getCreditCardDebtCheck`. Bajo la **opción A** del análisis de boundary, `@grana/accounts` depende hacia abajo de `@grana/cards`, en vez de empujar la composición de balances al caller.

El boundary sigue el precedente del repo: el paquete contiene **lógica de datos client-agnóstica** (fns que reciben el client Supabase + `userId` verificado + `today` inyectado); `apps/web` retiene el **platform shell** (`'use server'`, `createClient()`, resolución de auth, `revalidatePath`). Las 7 server actions de cuentas se encogen a wrappers thin, igual que ya hicieron `recurrences.ts` y `credit-cards.ts` sobre `@grana/transactions-mutations`.

## What Changes

- **Nuevo paquete `@grana/accounts`** (`packages/accounts/`), shape espejo de `@grana/transactions-mutations`. Deps: `@grana/cards`, `@grana/money-logic`, `@grana/supabase`, `@grana/validation`, `@grana/ui-contracts`.
- **`src/types.ts`** — mover `Account`, `AccountCurrency`, `Institution`, `AccountWithDetails`, `AccountWithBalances`, `GroupedAccounts` (y los grouped-with-balances) desde `lib/accounts/types.ts`.
- **`src/balance.ts`** — mover `computeBalance` desde `lib/accounts/utils.ts`. Decisión tomada en explore: vive en `@grana/accounts`, **no** en `@grana/money-logic` (money-logic es el piso genérico que opera sobre rows anónimas; `computeBalance` está modelado alrededor del tipo `AccountWithDetails`, así que mover la dependencia de tipo hacia money-logic rompería la capa).
- **`src/queries.ts`** — mover `getAccounts` (embebe `credit` vía `@grana/cards`), `getCashAndBankAccounts`, `getAccountDetail`, `getInstitutions`. Reciben `supabase` como primer parámetro y `today` inyectado donde haga falta. Incluye el read Supabase de tx-sums (`getTransactionSums`-equivalente) construido sobre `calculateTransactionSums` de `@grana/money-logic`.
- **`src/mutations/`** — mover la lógica de `createAccount`, `updateAccount`, `archiveAccount`, `reactivateAccount`, `deleteAccount`, `addCurrencyToAccount`, `deactivateCurrencyFromAccount`. Reciben `{ supabase, userId, input, today }`; el caller es responsable de auth. Sin `'use server'`, sin `createClient`, sin `revalidatePath`.
- **`apps/web/app/_actions/accounts.ts`** — las 7 actions pasan a wrappers thin (`'use server'`) que resuelven `userId` vía `getAuthenticatedUserId()`, crean el client, invocan el orquestador del paquete, mapean a `ActionResult`, y llaman `revalidateAfterAccountMutation()`.
- **`apps/web/lib/accounts/{queries,utils,types}.ts`** — re-exportan desde `@grana/accounts` (wrappers que inyectan `getTodayAR()` donde aplique) para no churnar los imports del resto de web.
- **Sin cambios de comportamiento ni de RLS.** Refactorización estructural; misma data, mismos query keys.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva. -->

### Modified Capabilities
- `web-data-access`: se agrega el contrato de que la capa de datos del dominio accounts (reads + mutations client-agnósticas) vive en `@grana/accounts`, consumible desde web (wrappers + server actions) y mobile, dependiendo hacia abajo de `@grana/cards`.

## Impact

- **Código (nuevo paquete):** `packages/accounts/` (`package.json`, `src/index.ts`, `src/types.ts`, `src/balance.ts`, `src/queries.ts`, `src/mutations/*.ts`).
- **Código (web, thin):** `app/_actions/accounts.ts` (7 wrappers `'use server'`), `lib/accounts/{queries,utils,types}.ts` (re-exports), call sites que importan tipos de `lib/accounts/types` no cambian de superficie.
- **Dependencia:** requiere `extract-cards-read-slice` aplicada (`@grana/accounts → @grana/cards → @grana/money-logic`).
- **Sin cambios de datos/API/RLS.** `revalidateAfterAccountMutation` (`/accounts`, `/cards`, `/dashboard`) se conserva en web.
- **Prep mobile:** este paquete ES el trabajo de habilitación de las pantallas de cuentas en mobile (espejo de cómo `@grana/movement-form` habilitó el form de movimientos). No agrega trabajo previo a mobile; lo constituye.
- **Detalle a resolver (ver design):** dónde vive el read Supabase de tx-sums (`getTransactionSums`) — recomendación: dentro de `@grana/accounts`, web re-exporta.
- **Riesgos:** medio-bajo. Las mutations tocan dinero (normalización de montos) y el guard de deuda de tarjeta; los tests existentes de cuentas + typecheck cubren la equivalencia. La paridad se valida porque los wrappers web preservan firma y `revalidatePath`.
