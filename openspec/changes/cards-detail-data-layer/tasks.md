## 1. Tipos de detalle al package

- [ ] 1.1 Mover a `@grana/cards` los tipos de retorno de detalle: `CardPeriodDetail`, `CreditCardDetail`, `ActiveInstallment`, `ActiveInstallmentsResult`, `CardNetwork` (hoy en `apps/web/lib/cards/queries.ts`).
- [ ] 1.2 Mover los tipos del view-model `CardDetailViewModel`, `PeriodKey`, `LifecyclePeriod` (hoy en `apps/web/app/(app)/cards/_components/card-detail-types.ts`) a `@grana/cards`.
- [ ] 1.3 Re-exportar todos los tipos desde `packages/cards/src/index.ts`.

## 2. Reads de detalle al package (client-agnósticos)

- [ ] 2.1 Crear `packages/cards/src/detail-queries.ts` con `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getActiveInstallments`, `getCardNetworks`, `getCardPeriodTransactionCount`, recibiendo `supabase: GranaSupabaseClient` y `today: Date`/`todayISO` inyectado (sin `getTodayAR()` interno).
- [ ] 2.2 Verificar que el módulo no importa `next/*`, no declara `'use server'`, no crea client ni invoca `revalidatePath`; compone `derivePeriodVariant`/`derivePeriodStatus`/aritmética desde `@grana/money-logic`.
- [ ] 2.3 Re-exportar los reads desde `index.ts`.

## 3. Builder puro del view-model

- [ ] 3.1 Crear `packages/cards/src/detail-vm.ts` con `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` que devuelve `{ kind: 'new-card' } | { kind: 'archived-empty' } | { kind: 'active'; vm: CardDetailViewModel }` + campos compartidos (`cardHasHistory`, `committedARS`, `institutionName`, `editCycle`).
- [ ] 3.2 Portar los helpers inline de `page.tsx` (`daysBetweenISO`, `installmentsARSOf`, resolución `apagar`/`curso`/`prox` vía `classifyPeriodsLifecycle`, `cursoCycle*`, `apagarDaysToDue`, `hasUSD`) dentro del builder; sin I/O.
- [ ] 3.3 Tests del builder: los tres `kind` (tarjeta nueva, archivada sin pendientes, activa) + derivados de ciclo (día/total/días a cierre/días a vencimiento) + `committedARS`.
- [ ] 3.4 Re-exportar `resolveCardDetailState` desde `index.ts`. `pnpm --filter @grana/cards test` verde.

## 4. Rewire web (behavior-preserving)

- [ ] 4.1 `apps/web/lib/cards/queries.ts`: los 6 reads pasan a wrappers thin que inyectan `getTodayAR()` y re-exportan los tipos desde `@grana/cards`; conservar firma pública + query keys.
- [ ] 4.2 Adelgazar `apps/web/app/(app)/cards/[id]/page.tsx`: fetch → `resolveCardDetailState(...)` → `switch (state.kind)` de render; quitar los helpers inline y la derivación del VM; mantener en web el `EditCardDrawerProvider`, el ensamblado de `editCardData` con `institutions`, `backLink` y la JSX.
- [ ] 4.3 Borrar `apps/web/app/(app)/cards/_components/card-detail-types.ts`; reapuntar `CardDetailView` y demás consumidores a `@grana/cards`.
- [ ] 4.4 `pnpm --filter web typecheck` + `lint` verdes.
- [ ] 4.5 Smoke visual de `/cards/[id]` en sus tres estados: tarjeta nueva sin historial (CTA primer consumo), archivada sin pendientes, y activa (hero, ciclo apagar/curso/prox, cuotas en curso, panel de límite) idénticos a antes.

## 5. Subir el read de mobile + borrar mirrors de listado (heredado de Slice 1)

- [ ] 5.1 Reemplazar el `getCreditCards` reducido de `apps/mobile/lib/cards/queries.ts` por el `getCreditCards` compartido de `@grana/cards` (inyectando el cliente nativo + `getTodayAR()`); la forma pasa a ser la `CreditCardSummary` completa (con `inProgress` + `activeInstallmentsCount`).
- [ ] 5.2 Borrar `apps/mobile/lib/cards/grouping.ts` y el `summarizeCardsMonth` inline (+ tipos `CardsMonthSummary`/`UpcomingDue`) de `lib/cards/queries.ts`; `getCardsMonthSummary` mobile usa `summarizeCardsMonth` de `@grana/cards`.
- [ ] 5.3 Reapuntar `apps/mobile/components/cards/Wallet.tsx`, `CardsMonthHero.tsx` y `app/(app)/cards/index.tsx` a `@grana/cards`; eliminar comentarios "Mirror of …/MUST stay in sync".
- [ ] 5.4 Verificar el cambio de comportamiento intencional del hero mobile (gana "en curso", cierres hasta 6) en el smoke; CardsMonthHero renderiza la línea de en-curso como en web.

## 6. Retirar el mirror de detalle mobile + cierre

- [ ] 6.1 `apps/mobile/lib/cards/queries.ts`: eliminar los shapes de detalle declarados a mano; importar tipos + reads de `@grana/cards`.
- [ ] 6.2 `pnpm --filter mobile typecheck` + `lint` verdes (la pantalla `/cards/[id]` nativa es el change follow-up; acá la capa de datos queda lista y sin mirror).
- [ ] 6.3 Typecheck + lint + tests verdes en `@grana/cards`, web y mobile (verificación final).
