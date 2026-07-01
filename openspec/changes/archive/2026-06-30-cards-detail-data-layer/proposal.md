## Why

La pantalla de detalle de tarjeta (`apps/web/app/(app)/cards/[id]/page.tsx`) ensambla su view-model **a mano dentro del Server Component**: ~100 líneas de lógica pura (resolución del ciclo de vida `apagar`/`curso`/`prox`, días de ciclo / días a cierre / días a vencimiento, `committedARS`, `installmentsARSOf`, ramas de empty-state) sobre reads que viven **sólo en web** (`apps/web/lib/cards/queries.ts`: `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getActiveInstallments`, `getCardNetworks`, `getCardPeriodTransactionCount`). Cuando aterrice la ruta mobile de detalle, tendría que **re-derivar todo** ese view-model y **re-implementar** esos reads — el mismo anti-patrón mirror que ya estamos eliminando en el listado.

El spec `web-data-access` ya previó este momento: su requirement del read slice de cards dice que el detalle "PUEDE permanecer en `apps/web/lib/cards/` **hasta que un segundo consumer (mobile) lo requiera**". La ruta mobile de detalle es ese segundo consumer. Slice 2 de 3: extrae el read layer de detalle + el builder puro del view-model a `@grana/cards`, parametrizando los reads por `GranaSupabaseClient` (patrón read slice ya codificado). Depende de Slice 1 (presentación pura ya en el package).

## What Changes

- **Extraer los 6 reads de detalle a `@grana/cards`**, client-agnósticos (`supabase: GranaSupabaseClient` como primer parámetro, `today: Date` inyectado): `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getActiveInstallments`, `getCardNetworks`, `getCardPeriodTransactionCount`. El package no importa `next/*`, no declara `'use server'`, no crea client ni invoca `revalidatePath`.
- **Mover los tipos de retorno** a `@grana/cards`: `CardPeriodDetail`, `CreditCardDetail`, `ActiveInstallment`, `ActiveInstallmentsResult`, `CardNetwork`. (Tras el merge de main, `CardPeriodDetail` carga campos extra de pago/sellos — `stampTaxRate`, `paidAmount*`, `paymentDate`, `paymentRecordId`, `paymentExpenseId`, `nextPeriodStart`, `nextPeriodIsPaid`; se mueve igual, en bloque. Los reads de detalle no ganaron imports nuevos en main, sólo campos, así que siguen siendo extraíbles como slice inyectado por cliente.)
- **Extraer el builder puro del view-model** a `@grana/cards` (p. ej. `src/detail-vm.ts`): una función `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` que devuelve un discriminated union — `{ kind: 'new-card' } | { kind: 'archived-empty' } | { kind: 'active', vm: CardDetailViewModel }` — más los derivados compartidos (`cardHasHistory`, `committedARS`, ciclo `apagar`/`curso`/`prox`, días de ciclo/cierre/vencimiento, `installmentsARSOf`, `daysBetweenISO`). Compone `classifyPeriodsLifecycle` de `@grana/money-logic`, no la duplica.
- **Mover los tipos del view-model** (`CardDetailViewModel`, `PeriodKey`, `LifecyclePeriod`) de `apps/web/app/(app)/cards/_components/card-detail-types.ts` a `@grana/cards`.
- **Web `page.tsx` adelgaza** a: resolver auth + fetch (vía wrappers que inyectan `getTodayAR()`) → `resolveCardDetailState(...)` → `switch` de render (JSX y orquestación del `EditCardDrawerProvider` quedan en web). Sin cambio de comportamiento observable.
- **Wrappers web** en `apps/web/lib/cards/queries.ts`: thin, inyectan `getTodayAR()`, conservan firma pública y query keys; re-exportan tipos desde `@grana/cards`.
- **Retirar el mirror mobile**: `apps/mobile/lib/cards/queries.ts` deja de re-implementar shapes de detalle a mano; pasa a consumir los reads + el builder de `@grana/cards` (el consumer mobile de la ruta de detalle es el change follow-up, pero la capa de datos queda lista y el header "MUST stay in sync" desaparece).
- **Subir el `getCreditCards` de mobile a la forma compartida completa** (heredado de Slice 1): hoy mobile devuelve un `CreditCardSummary` reducido (sin `inProgress` ni `activeInstallmentsCount`) y un month-summary inline reducido (sin "en curso", cierres capeados en 3). Para consumir la lógica pura compartida de `@grana/cards` (`groupCardsByBank`, `summarizeCardsMonth`, presentación), mobile pasa a usar el `getCreditCards` compartido de `@grana/cards` (parametrizado por cliente), borra `apps/mobile/lib/cards/grouping.ts` y el `summarizeCardsMonth` inline, y reapunta `Wallet.tsx` / `CardsMonthHero.tsx` al package. **Cambio de comportamiento intencional en mobile**: el hero gana la figura "en curso" y muestra hasta 6 próximos cierres (paridad con web), revisado como parte de este change.

Refactor behavior-preserving: web renderiza idéntico; se verifica con typecheck + lint + tests.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `web-data-access`: el requirement "El read slice cross-dominio de cards vive en `@grana/cards`" se amplía — el read layer de **detalle** de tarjeta (detalle de cuenta, períodos, detalle de período, cuotas en curso, networks, conteo de transacciones de período) deja de ser opcionalmente web-retained y se mueve a `@grana/cards` parametrizado por cliente, porque el segundo consumer (mobile detalle) lo requiere; el builder puro del view-model (`resolveCardDetailState`/`CardDetailViewModel`) vive en `@grana/cards` (cubierto además por la regla de lógica view-model pura de `project-conventions`).

## Impact

- **Paquetes**: `@grana/cards` gana `src/detail-queries.ts` (o se amplía `queries.ts`) con los 6 reads + tipos, y `src/detail-vm.ts` con `resolveCardDetailState` + `CardDetailViewModel`/`PeriodKey`/`LifecyclePeriod` (+ tests del VM builder y de los empty-states). Sin nuevas dependencias.
- **Web**: `apps/web/lib/cards/queries.ts` adelgaza a wrappers + re-exports; `[id]/page.tsx` pierde ~100 líneas de derivación inline; `card-detail-types.ts` se borra (tipos vienen del package). Sin cambio funcional en `/cards/[id]` ni en sus rutas anidadas.
- **Mobile**: `apps/mobile/lib/cards/queries.ts` deja de mirrorear shapes de detalle; consume reads + builder de `@grana/cards`. Eliminación de comentarios "MUST stay in sync". (La ruta `/cards/[id]` nativa es el change follow-up.)
- **Specs**: delta de `web-data-access` (read slice de cards ampliado al detalle).
- **Dependencias entre changes**: depende de **Slice 1** (`cards-list-pure-logic`) por `cardAccent`/`pillTone`/`resolveEditCycle` ya en el package (el VM builder y el render los usan). No depende de Slice 3.
- **Fuera de scope**: mutaciones de tarjeta (Slice 3); el pane de movimientos del resumen (`period-movements-pane` / `card-movement-mapper.ts`), bloqueado por la extracción de `FinancialMovement` de transactions — la ruta mobile de detalle v1 puede diferir ese pane.
