## 1. Extraer la capa display-VM a `@grana/transactions`

- [x] 1.1 Mover el tipo `FinancialMovement` (+ sub-uniones `IncomeMovement`/`ExpenseMovement`/…/`ReimbursementMovement`, `MovementReviewFlag`, `ReimbursementState`/`Target`) de `apps/web/lib/transactions/movements.ts` a `@grana/transactions`; re-exportar desde su `index.ts`.
- [x] 1.2 Mover `toMovementViewInput` (bridge `FinancialMovement` → `MovementViewInput`) y `resolveTone` + tipo `Tone` (de `apps/web/lib/transactions/components/tone.ts`) a `@grana/transactions`. `toneToClass` **se queda en web**.
- [x] 1.3 Verificar que `@grana/transactions` no importa `next/*` ni declara `'use server'`; compone `resolveMovementView` de `@grana/money-logic`, no lo duplica.
- [x] 1.4 Recablear web: `movements.ts` conserva `toFinancialMovement`/`toInitialBalanceMovement` importando el tipo del package; `movement-row.tsx`/`movement-list.tsx` importan `FinancialMovement`/`resolveTone` del package; `tone.ts` conserva sólo `toneToClass`.
- [x] 1.5 `pnpm --filter web typecheck`/`lint` verdes (el package se typechequea transitivamente vía web; no tiene script propio ni test files).

## 2. Mover el mapper de tarjeta a `@grana/cards`

- [x] 2.1 Mover `cardPeriodTransactionToMovement` + `installmentChip` de `apps/web/app/(app)/cards/_components/card-movement-mapper.ts` a `@grana/cards`; importan `FinancialMovement` de `@grana/transactions` (agregar la dep si falta). Re-exportar desde `packages/cards/src/index.ts`.
- [x] 2.2 Borrar `card-movement-mapper.ts`; repuntar `period-movements-pane.tsx` (web) a `@grana/cards`.
- [x] 2.3 `@grana/cards` test (62 passed) + web typecheck/lint verdes; pane de movimientos web behavior-preserving (mismo mapper, mismo call site).

## 3. Componentes nativos `MovementList` / `MovementRow`

- [x] 3.1 Crear `apps/mobile/components/movements/MovementRow.tsx` acotado a `expense`/`reimbursement`: ícono de categoría (emoji con bg tintado / ícono fallback), primary (`description ?? categoryLabel ?? typeLabel`), secondary (taxonomía), chip "Cuota X de Y" (abajo), badge de reintegro `recibido`, monto + tono. Deriva vista con `resolveMovementView(toMovementViewInput(m), perspective)` de `@grana/money-logic`/`@grana/transactions`. Traducción de categoría inline (system→`categories.${canonical}`). Sin saldo corriente / recurrente / review / compartido / cuenta.
- [x] 3.2 Helper de tono nativo (mirror de `toneToClass`): `Tone` → token estructural (`positive`/`negative`/`text`/`text-muted`), en `components/movements/tone.ts`.
- [x] 3.3 Crear `apps/mobile/components/movements/MovementList.tsx`: agrupado por fecha (Hoy/Ayer/día vía `todayISO` + tablas locale — Hermes no tiene `Intl` completo), empty state (title/body inyectables), filas **no navegables** (ignora `detail_href`). Props espejan la web acotadas a lo que el pane usa (`installmentChipBelow` implícito: el chip siempre va abajo en el row nativo).
- [x] 3.4 `pnpm --filter mobile typecheck` verde; `lint` sin errores (sólo warning pre-existente en `scripts/gen-icons.mjs`).

## 4. Pane + segmented en el detalle nativo

- [x] 4.1 Crear `apps/mobile/components/cards/detail/PeriodMovementsPane.tsx`: recibe el `LifecyclePeriod` seleccionado; mapea `period.transactions` → `FinancialMovement` con `cardPeriodTransactionToMovement`, arma el mapa `installmentChips` con `installmentChip`, renderiza el `MovementList` nativo (`perspective={ kind:'account', accountId: cardId }`, `groupByDate`, empty state `cards.detail.movements_empty_*`).
- [x] 4.2 `CardDetailView` nativo: reintroducir el `Segmented` `[Movimientos | Cuotas]` (default **Movimientos**), reusando `apps/mobile/components/ui/Segmented`; Movimientos → `PeriodMovementsPane` del período seleccionado; Cuotas → `CuotasEnCursoPane` existente. La selección de período del timeline salta a Movimientos (`selectPeriod`) y elige qué período muestra el pane. `todayISO` se thread-ea desde `[id].tsx`.
- [x] 4.3 Sin reads nuevos (usa `period.transactions` ya en `CardPeriodDetail`); read-only (sin acciones de escritura).

## 5. Cierre

- [x] 5.1 `@grana/cards` test (62) + web typecheck/lint/test (449) + mobile typecheck/lint verdes (los packages se typechequean transitivamente vía web/mobile).
- [x] 5.2 Web behavior-preserving: el pane usa el mismo mapper (relocado, puro) y el mismo `MovementList`/`MovementRow` (tipos relocados); 449 tests web + typecheck verdes cubren `/transactions`, `/accounts/[id]`, `/cards/[id]`. (Smoke visual en navegador fuera del entorno.)
- [x] 5.3 Detalle mobile con segmented + pane verificado a nivel de código (typecheck/lint verdes): pestaña Movimientos agrupa por fecha con chips de cuota, badge de reintegro recibido, monto/tono; empty state inyectable; filas no navegables (ignora `detail_href`). (Smoke en dispositivo fuera del entorno.)
- [x] 5.4 Row/list nativo espeja la estructura del web (mismo primary/secondary/chip/badge/tono); sin hex literal suelto (scan limpio — tokens estructurales + mirror `lib/colors`).