## 1. Extraer a `@grana/cards`

- [x] 1.1 Crear `packages/cards/src/grouping.ts` con el contenido de `apps/web/lib/cards/grouping.ts` (bank grouping, ordering, `cardTone`, `cardHasBalance`, `cardUsePercent`, `sortCardsByDue`, `applyFilter`, `groupCardsByBank` + tipos `CardTone`, `ViewFilter`, `BankGroup`, `NO_BANK_KEY`); import de `CreditCardSummary` pasa a `./types`.
- [x] 1.2 Crear `packages/cards/src/presentation.ts` con el contenido de `apps/web/app/(app)/cards/_components/card-presentation.ts` (`cardAccent`, `cardMonogram`, `pillTone`, `formatDayMonth`, `resolveEditCycle`); `resolveAccountAvatar` desde `@grana/ui-contracts`, `CardPeriodAlert`/`CardTone` desde el package.
- [x] 1.3 Crear `packages/cards/src/month-summary.ts` con el contenido de `apps/web/lib/cards/month-summary.ts` (`summarizeCardsMonth` + tipos `MonthSummaryCard`, `CardsMonthSummary`, `UpcomingDue`, `NEXT_CLOSES_CAP`); `sumMoneyValues` desde `@grana/money-logic`.
- [x] 1.4 Mover los tests a `packages/cards/src/__tests__/` (`grouping.test.ts` + `month-summary.test.ts`) y ajustar imports.
- [x] 1.5 Re-exportar `grouping` + `presentation` + `month-summary` (símbolos y tipos) desde `packages/cards/src/index.ts`.
- [x] 1.6 Verificar/añadir `@grana/ui-contracts` en `dependencies` de `packages/cards/package.json`.
- [x] 1.7 `pnpm --filter @grana/cards test` verde.

## 2. Consolidar la unión de tono

- [x] 2.1 `card-status-pill.tsx` importa `CardTone` desde `@grana/cards` y elimina la definición local `CardPillTone` (re-alias local opcional, sin redefinir la unión).
- [x] 2.2 Grep `CardPillTone` en web: cualquier referencia restante apunta al tipo del package.

## 3. Rewire web (behavior-preserving)

- [x] 3.1 Borrar `apps/web/lib/cards/grouping.ts`, `apps/web/app/(app)/cards/_components/card-presentation.ts` y `apps/web/lib/cards/month-summary.ts`.
- [x] 3.2 Reapuntar imports en los ~13 componentes de `apps/web/app/(app)/cards/**` (`cards-compact-view`, `cuotas-en-curso-pane`, `archived-cards-section`, `pay-hero-card`, `proximo-mini-row`, `en-curso-card`, `cards-month-hero`, `card-detail-header`, `lifecycle-timeline`, `create-card-form`, `[id]/page`, `[id]/_components/edit-card-form`, `[id]/edit/page`) a `@grana/cards`.
- [x] 3.3 Reapuntar `apps/web/lib/cards/queries.ts`: `getCardsMonthSummary` importa `summarizeCardsMonth` + tipos desde `@grana/cards`; mantener el re-export `export type { UpcomingDue, CardsMonthSummary }` para no romper consumidores.
- [x] 3.4 `pnpm --filter web typecheck` + `lint` verdes.
- [ ] 3.5 Smoke visual web `/cards`: agrupamiento por banco, orden, tono de urgencia, filtros (`all`/`in-use`/`due-soon`/`with-balance`), auto-collapse, `cardUsePercent` y el hero del mes (a pagar / en curso / próximos cierres) idénticos a antes.

## 4. Rewire mobile + borrar mirror — DIFERIDO A SLICE 2

> Hallazgo durante la implementación: el `getCreditCards` de mobile es un **read
> reducido** (su `CreditCardSummary` no tiene `inProgress` ni
> `activeInstallmentsCount`; su month-summary no calcula "en curso" y capea cierres
> en 3, no 6). Las funciones puras del package (`groupCardsByBank`,
> `summarizeCardsMonth`) están tipadas sobre la forma completa y `summarizeCardsMonth`
> **usa** `inProgress`. Por eso mobile no puede consumir la lógica compartida sin
> **subir su read** a la forma completa — eso es un cambio de read (con cambio de
> comportamiento del hero mobile), que pertenece a Slice 2, no a este refactor
> behavior-preserving. El mirror mobile (`grouping.ts` + summary inline) se borra en
> `cards-detail-data-layer` cuando se actualiza el read de mobile. Mobile sigue
> compilando con sus mirrors locales hasta entonces.

## 5. Política (AGENTS.md) y cierre

- [x] 5.1 Corregir `AGENTS.md` (línea "Supabase queries stay in each app's `lib/`…"): reemplazar por la frontera real — glue acoplado a plataforma por app; lógica isomórfica (funciones puras + reads inyectados por cliente) en `@grana/<domain>` — consistente con `web-data-access`.
- [x] 5.2 Verificar que la prosa de `AGENTS.md` no contradice los scenarios del delta `project-conventions`.
- [x] 5.3 Typecheck + lint + tests verdes en `@grana/cards` y web (refactor behavior-preserving del lado web; mobile sin cambios en este slice — ver Sección 4).
