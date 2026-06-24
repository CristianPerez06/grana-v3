## Contexto

Esta es la primera mitad de una secuencia de dos changes que extraen la capa de datos de cuentas a paquetes compartidos para que mobile pueda reutilizarla:

1. **`extract-cards-read-slice`** (esta change) — el slice de lectura de cards que cuentas consume.
2. **`extract-accounts-data-layer`** — `@grana/accounts` completo, que depende de (1).

La decisión de fondo (tomada en explore): bajo la **opción A** del análisis de boundary, `@grana/accounts` depende hacia abajo de `@grana/cards`, en vez de que el caller componga los balances (opción B) o de partir cuentas en core-sin-balances (opción C). A es estructuralmente inevitable porque `getAccounts` —el read de cuentas más consumido— embebe los resúmenes `credit`.

## La forma del boundary (precedente del repo)

El repo ya cortó este seam dos veces. La regla compartida:

```
apps/web (platform shell)         →  pasa { supabase, today }, inyecta getTodayAR()
  └─ @grana/cards (data slice)    →  fns async puras, 1er arg = SupabaseClient<Database>
       └─ @grana/money-logic      →  lógica pura (status de período, variantes, $ math)
       └─ @grana/transactions-mutations → period helpers (getCardPeriodsWithStatus, …)
```

- **NO** en el paquete: `'use server'`, `createClient()`, `revalidatePath`, `next/*`, `getTodayAR()` invocado internamente.
- **SÍ** en el paquete: orquestación de reads Supabase + tipos DB-row.

## Decisión: el slice, no el dominio cards completo

Solo se mueve el closure de lectura que `@grana/accounts` necesita:

| Símbolo | Por qué entra | Consumidor |
|---|---|---|
| `getCreditCards` | `getAccounts` embebe `credit: CreditCardSummary[]` | accounts read |
| `getCreditCardDebtCheck` | `archiveAccount` chequea deuda antes de archivar | accounts mutation |
| `CreditCardSummary` | tipo de retorno de `getCreditCards` | accounts |
| `CardPeriodWithPayment`, `PeriodVariant`, `CardPeriodAlert` | closure de tipos de `CreditCardSummary` | — |
| `month-summary.ts` (`summarizeCardsMonth` + tipos) | closure transitivo de `getCreditCards` | — |

**Se queda en `apps/web/lib/cards/`** (hasta que mobile haga pantallas de tarjetas): detalle de período, wallet hero mensual, pagos/reversión, cuotas en curso, todo lo de `/cards`.

### Por qué el slice es barato (hallazgo de explore)

`lib/cards/utils.ts` **no tiene lógica propia**: es un re-export de `@grana/money-logic` (`derivePeriodStatus`, `derivePeriodVariant`, `sumMoneyValues`, `subtractMoneyValues`, `formatDateISO`). `month-summary.ts` solo depende de `sumMoneyValues` (money-logic). `getTodayAR` ya vive en `@grana/money-logic`. Los period helpers (`getCardPeriodsWithStatus`, `getOrCreatePeriodForDate`) ya están en `@grana/transactions-mutations`. Es decir: **toda la lógica pesada ya está compartida**; el slice relocaliza wrappers Supabase + tipos DB-row, sin reescribir nada.

## Decisión: `today` inyectado, no `getTodayAR()` interno

Siguiendo el precedente de `@grana/transactions-mutations` (`RegisterInstallmentsArgs.today`), las fns del paquete reciben `today: Date`. Aunque `getTodayAR()` ya existe en `@grana/money-logic` y el paquete *podría* llamarlo, se inyecta para mantener las fns determinísticas/testeables y consistentes con el seam de mutations existente. El wrapper web pasa `getTodayAR()`; mobile pasará su equivalente.

## Costo aceptado: split temporal de cards

Tres fns de lectura quedan en `@grana/cards` mientras el resto del read layer de cards sigue en `apps/web/lib/cards/`. Es un smell de tidiness en web (lógica de cards en dos carpetas), **no** un bloqueo de mobile: el slice es exactamente lo que accounts-on-mobile necesita; completar cards es trabajo aditivo posterior, no rework del slice. La alternativa (extraer cards completo ahora) cambia el smell por una change mucho mayor que no se necesita todavía.

## Alternativas descartadas

- **Opción B (caller compone balances):** el caller pasa `cardSummaries` a `getAccounts`. Descartada: empuja la composición a cada uno de los 8+ call sites de `getAccounts` y deja `@grana/accounts` incompleto.
- **Opción C (accounts core sin balances):** partir cuentas en core + composición de balances. Descartada: el balance de tarjeta es parte intrínseca del catálogo de cuentas; partirlo crea un seam sin payoff.
- **Extraer el dominio cards completo en esta change:** descartado por scope; mobile no construye pantallas de tarjetas todavía.

## Verificación

`pnpm --filter web typecheck` + `pnpm --filter web lint` pasan; `pnpm openspec:check`. La paridad de comportamiento se valida porque los wrappers web re-exportan e inyectan `getTodayAR()`: misma firma efectiva, mismos query keys.
