## Why

El detalle de tarjeta nativo (`/cards/[id]`, shipeado en `cards-mobile-detail`) es read-only y **dejó fuera a propósito el pane de movimientos por período**: `FinancialMovement` + `MovementList`/`MovementRow` viven sólo en web (`apps/web/lib/transactions/`), y mobile no tiene ningún primitivo de lista de movimientos. Por eso el detalle muestra las cuotas inline, sin el segmented `[Movimientos | Cuotas]` del detalle web.

Este change aterriza ese pane en mobile. Es el **slice angosto, enfocado en la tarjeta**, del módulo de movimientos: extraer los bits puros de display-VM que el pane necesita (`FinancialMovement` + los bridges de vista), construir un `MovementList`/`MovementRow` nativo acotado a los 2 kinds que la tarjeta usa (`expense`/`reimbursement`), y reintroducir el segmented en el detalle nativo. **No** construye la tab Movimientos de mobile (el feed global sigue web-only hasta que esa ruta exista) — sólo toca lo que el pane de la tarjeta requiere, sembrando los primitivos que la tab reusará después.

`web-data-access` ya previó este momento: su requirement del slice de `@grana/transactions` dice que el feed/display de movimientos "PUEDE permanecer en `apps/web/lib/transactions/` **hasta que un segundo consumer (la tab Movimientos de mobile) lo requiera**". El pane de movimientos de la tarjeta nativa es ese segundo consumer para la **capa de display-VM** (no para el feed completo).

## What Changes

- **Extraer a `@grana/transactions`** (capa display-VM sobre `TransactionWithDetails`): el tipo `FinancialMovement` + sus sub-uniones (`ReimbursementState`/`Target`, `MovementReviewFlag`), `toMovementViewInput` (bridge a `resolveMovementView` de `@grana/money-logic`), y `resolveTone` + `Tone` (puro; `toneToClass` **se queda en web**, es Tailwind). Client-agnóstico, sin `next/*`. Web se recablea a importar el tipo desde el package (behavior-preserving).
- **Mover a `@grana/cards`**: `cardPeriodTransactionToMovement` + `installmentChip` (hoy en `apps/web/app/(app)/cards/_components/card-movement-mapper.ts`), co-locados con `CardPeriodDetail`. El pane web importa desde `@grana/cards`.
- **`toFinancialMovement` (el mapper global de 8 kinds) + `toInitialBalanceMovement` se quedan en web** (sin consumer mobile todavía); sólo pasan a importar el tipo desde el package.
- **Construir `MovementList` + `MovementRow` nativos** bajo `apps/mobile/components/movements/`, acotados a los kinds de la tarjeta: agrupado por fecha (Hoy/Ayer/día), empty state, filas `expense`/`reimbursement` con ícono de categoría (emoji + fallback), línea secundaria de taxonomía, chip "Cuota X de Y" (abajo), badge de reintegro recibido, monto + tono. **SIN** columna de saldo corriente, badges recurrente/review/compartido, subtítulo de cuenta, ni los otros 6 kinds. Filas **no navegables** (no existe ruta `/transactions/[id]` en mobile).
- **Detalle de tarjeta mobile**: reintroducir el segmented `[Movimientos | Cuotas]` (reusando el `Segmented` nativo), agregar `PeriodMovementsPane` nativo que mapea `period.transactions` → `FinancialMovement` vía el mapper compartido y renderiza el `MovementList` nativo. Sigue siendo read-only.

Behavior-preserving en web (renderiza idéntico en `/transactions`, `/accounts/[id]`, `/cards/[id]`); mobile gana el pane de movimientos.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `cards`: el requirement del detalle nativo se invierte en su cláusula de movimientos — la ruta AHORA muestra el pane de movimientos por período dentro de un segmented `[Movimientos | Cuotas]` (antes: omitido, cuotas inline). Sigue read-only.
- `web-data-access`: el requirement del slice de `@grana/transactions` se amplía — el **tipo `FinancialMovement`** + sus bridges puros de vista (`toMovementViewInput`, `resolveTone`) se mueven al package porque el pane de movimientos de la tarjeta nativa es el segundo consumer; los mappers/filtros del feed global siguen web-only hasta que la tab Movimientos los requiera.

## Impact

- **Packages**: `@grana/transactions` gana la capa display-VM (`FinancialMovement` + `toMovementViewInput` + `resolveTone`/`Tone`); `@grana/cards` gana el mapper de movimientos de tarjeta. Dep nueva `@grana/transactions` en `@grana/cards` si no existe.
- **Web**: `apps/web/lib/transactions/movements.ts` conserva `toFinancialMovement`/`toInitialBalanceMovement`, importa el tipo del package; `movement-row.tsx`/`movement-list.tsx` importan `FinancialMovement`/`resolveTone` del package; `card-movement-mapper.ts` se borra (movido a `@grana/cards`) y el pane web se repunta. Sin cambio de comportamiento.
- **Mobile**: `MovementList`/`MovementRow`/`PeriodMovementsPane` nativos + segmented en el detalle. Sin reads nuevos (`period.transactions` ya viene en `CardPeriodDetail` de `getCardPeriods`).
- **Specs**: delta de `cards` (pane ahora presente) + `web-data-access` (capa display-VM al package).
- **Dependencias entre changes**: depende de `cards-mobile-detail` (existe la pantalla) y `cards-detail-data-layer` (reads + `CardPeriodDetail.transactions`). Independiente de los write flows de tarjeta.
- **Fuera de scope**: la tab Movimientos de mobile (feed global, filtros, navegación de mes, FAB); el dedup de `apps/mobile/lib/accounts/movement-view.ts` + `movement-filters.ts` hacia la capa compartida (va con la tab); la ruta de detalle de movimiento mobile (las filas quedan no navegables); los otros 6 kinds en el row nativo; `toFinancialMovement` global.
