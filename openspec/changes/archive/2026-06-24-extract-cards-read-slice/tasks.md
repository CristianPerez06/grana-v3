## 1. Scaffold del paquete

- [x] 1.1 Crear `packages/cards/package.json` espejo de `@grana/transactions-mutations`: `name: "@grana/cards"`, `private`, `main`/`types` → `./src/index.ts`, `exports` `"."` → `./src/index.ts`, deps `@grana/money-logic`, `@grana/supabase`, `@grana/transactions-mutations` (`workspace:*`), devDep `vitest`.
- [x] 1.2 `pnpm install` para registrar el workspace; confirmar que resuelve sin tocar la versión de React (ver `project_pnpm_workspace_gotchas`). → React sigue en 19.1.0.

## 2. Mover el closure de lectura

- [x] 2.1 Determinar el closure transitivo exacto de `getCreditCards` + `getCreditCardDebtCheck`. **Hallazgo:** `month-summary.ts` NO es parte del slice (lo consume el `getCardsMonthSummary` web-retained, no `getCreditCards`). `derivePeriodAlert` (helper privado) SÍ es compartido por el slice y por funciones web-retained → debe exportarse del paquete. `CardPeriodWithPayment`/`PeriodVariant` ya son canónicos en `@grana/transactions-mutations` / `@grana/money-logic` → re-export, no redefinir.
- [x] 2.2 Crear `packages/cards/src/types.ts` con `CardPeriodAlert`, `CreditCardSummary`, `CreditCardDebtCheck`, y re-export de `CardPeriodWithPayment` (de tx-mutations) + `PeriodVariant` (de money-logic). (`CardPeriod`/`PeriodStatus` quedan locales en web, no son parte del slice público.)
- [x] ~~2.3 month-summary~~ **N/A:** `month-summary.ts` no es parte del slice (consumido por el hero web-retained); se queda intacto en `apps/web/lib/cards/`.
- [x] 2.4 Crear `packages/cards/src/queries.ts` con `getCreditCards`, `getCreditCardDebtCheck` y el helper exportado `derivePeriodAlert`. `supabase: GranaSupabaseClient` (= `SupabaseClient<Database>`); `today: Date` inyectado; lógica desde `@grana/money-logic` y tipos de período desde `@grana/transactions-mutations`. Sin `getTodayAR()` interno.
- [x] 2.5 Crear `packages/cards/src/index.ts` exportando `getCreditCards`, `getCreditCardDebtCheck`, `derivePeriodAlert`, y los tipos `CreditCardSummary`, `CreditCardDebtCheck`, `CardPeriodAlert`, `CardPeriodWithPayment`, `PeriodVariant`.

## 3. Rewire de web a wrappers thin

- [x] 3.1 En `apps/web/lib/cards/queries.ts`: borrados los cuerpos movidos; `getCreditCards`/`getCreditCardDebtCheck` re-exportan desde `@grana/cards` inyectando `getTodayAR()`. Tipos `CreditCardSummary`/`CreditCardDebtCheck`/`CardPeriodAlert` re-exportados. Firma pública web idéntica. Funciones web-retained importan `derivePeriodAlert` del paquete.
- [x] 3.2 En `apps/web/lib/cards/types.ts`: re-exportar `CardPeriodWithPayment`, `PeriodVariant` desde `@grana/cards`; conservar `CardPeriod`, `PeriodStatus` locales.
- [x] 3.3 **N/A:** `month-summary.ts` se quedó intacto en web (no se movió); no requiere re-apuntado.
- [x] 3.4 Verificado: la firma pública web de `getCreditCards`/`getCreditCardDebtCheck` no cambió (wrappers thin, sin `today`); `CreditCardSummary` se sigue importando desde `@/lib/cards/queries`; `CardPeriodAlert` (card-presentation) y `PeriodVariant` (periods-list) resuelven vía re-export. Typecheck + lint verde sobre todos los call sites. Se agregó `@grana/cards: workspace:*` a `apps/web/package.json`.

## 4. Verificación

- [x] 4.1 `pnpm --filter web typecheck` pasa. (Los errores de `.next/types/validator.ts` eran caché stale de Next; se resolvieron borrando `.next`.)
- [x] 4.2 `pnpm --filter web lint` pasa.
- [x] 4.3 `pnpm --filter web test` pasa: 41 files, 445 tests (incluye `lib/cards/*` y `lib/accounts/*`).
- [x] 4.4 Confirmado en vivo: `/cards` (wallet + hero) y `/accounts` (credit embebido vía `getAccounts`) renderizan igual; archive guard de tarjeta verificado contra la regla (bloquea solo statement cerrado/vencido impago con consumos).
- [x] 4.5 `pnpm openspec:check` → OK.
- [x] 4.6 Confirmado que NO se movió lógica de más: `lib/cards/queries.ts` conserva `getCardPeriodsWithStatus`, `getOrCreatePeriodForDate`, `getCardsMonthSummary`, `getActiveInstallments`, `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getCardPeriodTransactionCount`, `getCardNetworks` (+ tipos). Solo el slice (`getCreditCards`/`getCreditCardDebtCheck` bodies + tipos + `derivePeriodAlert`) se relocalizó.
