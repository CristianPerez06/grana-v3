## Why

La lógica view-model pura del listado de tarjetas está **hand-synced entre apps**: `apps/web/lib/cards/grouping.ts` y `apps/mobile/lib/cards/grouping.ts` son 167 líneas casi idénticas (sin React, sin Supabase) con comentarios "Mirror of … keep the two in sync". Es una violación directa de la convención que ya existe (`project-conventions`: "se evita duplicar el código copiándolo a `apps/mobile/lib/`"). La causa de fondo es doble: (1) `AGENTS.md` todavía afirma "Supabase queries stay in each app's `lib/` … Only the pure functions move to `packages/`", una frase obsoleta que contradice la política ya codificada (`web-data-access` ya aloja read slices en `@grana/cards`/`@grana/accounts`/`@grana/transactions`); y (2) la regla de no-duplicación pura está scopeada sólo a `@grana/money-logic` (cálculo financiero), sin nombrar explícitamente el hogar de la lógica **view-model de dominio** (agrupamiento, urgencia, presentación, mappers), que es el package de dominio.

Esta es la Slice 1 de 3 de la extracción de la capa compartida de cards (prep para la ruta mobile de detalle de tarjeta). Arranca por lo más limpio y de menor riesgo —lógica pura, cero Supabase— y deja asentada la política antes de que las Slices 2 (reads) y 3 (mutations) la citen.

## What Changes

- **Mover `grouping.ts` a `@grana/cards`** (módulo puro nuevo, p. ej. `src/grouping.ts`): bank grouping, ordering, urgencia (`cardTone`), auto-collapse, `cardUsePercent`, `cardHasBalance`, `applyFilter`, `groupCardsByBank`, y los tipos `CardTone` / `ViewFilter` / `BankGroup` / `NO_BANK_KEY`. Sólo depende de `CreditCardSummary` (ya en el package).
- **Mover `card-presentation.ts` a `@grana/cards`** (módulo puro nuevo, p. ej. `src/presentation.ts`): `cardAccent`, `cardMonogram`, `pillTone`, `formatDayMonth`, `resolveEditCycle`. Todo puro; `cardAccent` ya consume `resolveAccountAvatar` de `@grana/ui-contracts` y `pillTone` ya consume `CardPeriodAlert` de `@grana/cards`.
- **Mover `month-summary.ts` a `@grana/cards`** (módulo puro nuevo, p. ej. `src/month-summary.ts`): `summarizeCardsMonth` (agregación pura del hero del mes, sin I/O) + tipos `MonthSummaryCard`, `CardsMonthSummary`, `UpcomingDue`, `NEXT_CLOSES_CAP`. Toma `CreditCardSummary[]` + `todayStr`; sólo depende de `sumMoneyValues` (`@grana/money-logic`). Mobile lo mirrorea inline en `lib/cards/queries.ts` ("Mirror of … getCardsMonthSummary; keep shapes in sync") — se borra el mirror. El wrapper de read `getCardsMonthSummary` (que hace `getCreditCards` + `summarizeCardsMonth`) queda por app e importa `summarizeCardsMonth` del package.
- **Consolidar la unión de tono** `CardTone` (`'due' | 'soon' | 'ok'`): hoy existe duplicada como `CardPillTone` en `card-status-pill.tsx`. Pasa a vivir una sola vez en `@grana/cards`; la UI web la importa del package.
- **Mobile: DIFERIDO a Slice 2.** Durante la implementación se descubrió que el `getCreditCards` de mobile es un read **reducido** (su `CreditCardSummary` no tiene `inProgress` ni `activeInstallmentsCount`; su summary no calcula "en curso" y capea cierres en 3). Las funciones puras del package están tipadas sobre la forma completa y `summarizeCardsMonth` usa `inProgress`, así que mobile no puede consumirlas sin **subir su read** — eso es un cambio de read (con cambio de comportamiento del hero mobile) que pertenece a `cards-detail-data-layer`, no a este refactor behavior-preserving. El mirror mobile (`grouping.ts` + summary inline) se borra allí.
- **Rewire web** (sin cambio de comportamiento): los ~13 componentes de `apps/web/app/(app)/cards/**` que importan de `lib/cards/grouping` y `_components/card-presentation` pasan a importar de `@grana/cards`. Los archivos web `grouping.ts` / `card-presentation.ts` se borran (o quedan como thin re-export si reduce el churn de imports — a decidir en design).
- **Mover los tests** `lib/cards/__tests__/grouping.test.ts` a `packages/cards` (vitest ya configurado en el package).
- **Corregir `AGENTS.md`**: la línea "Supabase queries stay in each app's `lib/`…" se reemplaza por la frontera real — *glue acoplado a plataforma queda por app; la lógica isomórfica (funciones puras Y reads inyectados por cliente) vive en `@grana/*`*. Alinea la prosa con `web-data-access`.

Refactor behavior-preserving: web renderiza idéntico; se verifica con typecheck + lint + tests del package y de web.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `project-conventions`: se codifica que la lógica view-model **pura cross-platform** (agrupamiento, urgencia, presentación, mappers — no sólo cálculo financiero) vive en el package de dominio (`@grana/cards`, …) y no se hace mirror por app; y que la frontera `apps/`↔`packages/` se decide por acoplamiento a plataforma, no por "es una query Supabase" — `AGENTS.md` debe describirla de forma consistente con `web-data-access` y NO afirmar que las queries Supabase quedan por app.

## Impact

- **Paquetes**: `@grana/cards` gana `src/grouping.ts` + `src/presentation.ts` + `src/month-summary.ts` (+ tests), y exporta sus símbolos y tipos desde `index.ts`. Sin nuevas dependencias (ya tiene `@grana/money-logic`; `resolveAccountAvatar` viene de `@grana/ui-contracts`, que pasa a ser dependencia explícita del package si no lo era).
- **Web**: borrado de `apps/web/lib/cards/grouping.ts`, `_components/card-presentation.ts` y `lib/cards/month-summary.ts`; rewire de imports en ~13 componentes + `card-status-pill.tsx` (importa `CardTone`) + `lib/cards/queries.ts` (importa `summarizeCardsMonth`/tipos del package). Sin cambio funcional.
- **Mobile**: sin cambios en este slice (diferido a `cards-detail-data-layer`). Mobile sigue compilando con sus mirrors locales (`grouping.ts` + summary inline) hasta que su read se suba a la forma compartida completa.
- **Docs**: corrección de una línea en `AGENTS.md` (frontera apps/↔packages/).
- **Specs**: delta de `project-conventions` (lógica view-model pura en package de dominio + consistencia de la frontera en AGENTS.md).
- **Config de package**: añadir `@grana/cards` a `transpilePackages` (ya está, por ser consumido) y verificar `paths`; no aplica package nuevo.
- **Fuera de scope** (Slices 2 y 3): reads de detalle (`getCreditCardDetail`, `getCardPeriods`, …) y `buildCardDetailViewModel` (Slice 2); mutaciones de tarjeta (Slice 3); `card-movement-mapper.ts` (bloqueado por la extracción de `FinancialMovement` de transactions).
