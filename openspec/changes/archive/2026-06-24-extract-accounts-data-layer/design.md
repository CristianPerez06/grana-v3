## Contexto

Segunda mitad de la secuencia de extracción de la capa de datos de cuentas. Depende de `extract-cards-read-slice` (`@grana/cards`) aplicada primero.

## El boundary: dos stacks, una línea (precedente del repo)

El repo ya cortó este seam con `@grana/dashboard` (reads) y `@grana/transactions-mutations` (writes). La regla:

```
┌──────────────── apps/web (platform shell) ─────────────────┐
│  'use server'   createClient()   getAuthenticatedUserId()  │
│  revalidateAfterAccountMutation()   ActionResult<>          │
│        │ pasa { supabase, userId, input, today }           │
│        ▼                                                    │
│  ┌──────────────── @grana/accounts ────────────────────┐   │
│  │ fns async puras. 1er arg = SupabaseClient<Database>.│   │
│  │ caller dueño de auth, client, today, cache.         │   │
│  │ NO 'use server' / createClient / revalidate / next/*│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │ depende de
        ▼
  @grana/cards (slice)  ·  @grana/money-logic  ·  @grana/ui-contracts  ·  @grana/validation
```

## Mapa de extracción

| Origen (apps/web) | Destino (@grana/accounts) | Notas |
|---|---|---|
| `lib/accounts/types.ts` | `src/types.ts` | Mueve limpio. Depende solo de `@grana/ui-contracts` (`ResolvedAccountAvatar`). |
| `lib/accounts/utils.ts` (`computeBalance`) | `src/balance.ts` | Ver decisión abajo. |
| `lib/accounts/queries.ts` (4 reads) | `src/queries.ts` | `getAccounts` → `@grana/cards`; todos toman `supabase` + `today` inyectado. |
| `app/_actions/accounts.ts` (7 mutations) | `src/mutations/*.ts` | `{ supabase, userId, input, today }`. Web retiene 7 wrappers `'use server'`. |

## Decisión: `computeBalance` → `@grana/accounts/src/balance.ts`, no money-logic

La regla decisiva es **hacia dónde apunta la dependencia de tipo**. `@grana/money-logic` es deliberadamente agnóstico de entidades de dominio: opera sobre rows anónimas (`BalanceTransactionRow`, `CategoryAggRow`), nunca sobre entidades nombradas. `computeBalance` está modelado alrededor de `AccountWithDetails` (lee `account.currencies[].initial_balance`). Meterlo en money-logic forzaría a money-logic a importar `AccountWithDetails` — una dependencia hacia arriba que rompe la capa. Por eso vive en `@grana/accounts`, componiendo el piso genérico de money-logic (`calculateTransactionSums`) con data account-shaped encima. Flecha unidireccional limpia.

## Decisión: opción A (accounts → cards), confirmada estructuralmente

`getAccounts` —el read de cuentas más consumido (8+ call sites: `shared/(home)`, `shared/settle`, `cards/.../pay`, drawer/header/pending/recurring de `transactions`)— embebe `credit: CreditCardSummary[]`. Un `@grana/accounts` completo **debe** incluir `getAccounts`, que **debe** depender de `@grana/cards`. A no es preferencia; es la forma del grafo. Descartadas en explore: B (caller compone balances → empuja composición a 8+ sites, deja accounts incompleto) y C (accounts core sin balances → seam sin payoff).

## Decisión: el read de tx-sums entra en `@grana/accounts`

`getCashAndBankAccounts` y `getAccountDetail` necesitan los netos de transacciones por cuenta (`getTransactionSums`, hoy un wrapper Supabase en `lib/transactions/balance.ts` sobre `calculateTransactionSums` de money-logic). Recomendación: `@grana/accounts/src/queries.ts` incluye este read (lee la tabla `transactions` + `calculateTransactionSums`), porque es intrínsecamente "balance de cuenta". `apps/web/lib/transactions/balance.ts` re-exporta desde el paquete para no duplicar. Alternativa (caller inyecta el map de sums) descartada por el mismo motivo que la opción B de cards: composición regada en cada call site. Marcado como detalle a confirmar en apply por si toca a otros consumers de `getTransactionSums` fuera de accounts.

## Decisión: `today` inyectado, auth en el caller

Espejo de `@grana/transactions-mutations`: las mutations reciben `{ supabase, userId, input, today }`; el wrapper web resuelve `userId` con `getAuthenticatedUserId()` y pasa `getTodayAR()`. El paquete no resuelve auth ni crea client. La envoltura `ActionResult` se mantiene en web (`app/_actions/types.ts`); las mutations del paquete devuelven un resultado neutro (`{ ok, ... } | { ok: false, fieldErrors?, formError? }`) que el wrapper mapea.

## Por qué no agrega trabajo antes de mobile

Este paquete ES la prep de las pantallas de cuentas en mobile, igual que `@grana/movement-form` + `@grana/transactions-mutations` fueron la prep del form de movimientos. No es un desvío previo a mobile: es ese trabajo. Lo que queda diferido (resto del read layer de cards) es otro dominio, change posterior, aditivo.

## Verificación

`pnpm --filter web typecheck` + `lint` + `test` (tests de cuentas: `account-schema`, `account-avatar`, `current-account`) pasan; `pnpm openspec:check`. Paridad validada porque los wrappers web preservan firma pública, `ActionResult` y `revalidatePath`.
