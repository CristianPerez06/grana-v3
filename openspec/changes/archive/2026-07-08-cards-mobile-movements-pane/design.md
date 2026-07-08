## Context

El detalle de tarjeta nativo ya está shipeado (read-only), pero sin el pane de movimientos por período. El pane web (`apps/web/app/(app)/cards/_components/period-movements-pane.tsx`) mapea `period.transactions` → `FinancialMovement` vía `cardPeriodTransactionToMovement` (`card-movement-mapper.ts`) y los renderiza con `MovementList`/`MovementRow` (`apps/web/lib/transactions/`). Todo eso es web-only.

La lógica pura de vista ya está parcialmente compartida en `@grana/money-logic`: `resolveMovementView(input, perspective)` deriva `sign`/`amount`/`currencyCode`/`isCategorized`/`counterpartyDirection`; `MovementPerspective`/`MovementView` son tipos compartidos. Lo que falta compartir para el pane es: el **tipo** `FinancialMovement`, el bridge `toMovementViewInput` (FinancialMovement → `MovementViewInput`), `resolveTone` (kind+sign → `Tone`), y el mapper de tarjeta `cardPeriodTransactionToMovement` + `installmentChip`.

El row del pane de tarjeta es un **subconjunto chico** del `MovementRow` web: el mapper de tarjeta hard-setea `review_flags=[]`, `isShared=false`, `account_id=null`, y sólo produce `expense` (consumos) y `reimbursement` (reintegros recibidos del resumen). No hay saldo corriente, ni badges recurrente/review/compartido, ni línea de cuenta, ni los otros 6 kinds.

## Goals / Non-Goals

**Goals:**
- El pane de movimientos por período visible en el detalle de tarjeta nativo, dentro de un segmented `[Movimientos | Cuotas]`, read-only.
- `MovementList`/`MovementRow` nativos, acotados a los kinds de la tarjeta, reutilizables por la futura tab Movimientos.
- `FinancialMovement` + bridges puros de vista compartidos en `@grana/transactions`; el mapper de tarjeta en `@grana/cards`.
- Web behavior-preserving (`/transactions`, `/accounts/[id]`, `/cards/[id]` idénticos).

**Non-Goals:**
- La tab Movimientos de mobile (feed global, filtros, mes, FAB) y el `toFinancialMovement` global de 8 kinds — se quedan en web hasta que esa ruta exista.
- El dedup de `movement-view.ts`/`movement-filters.ts` de mobile hacia la capa compartida (va con la tab).
- Navegación al detalle de movimiento en mobile (no existe la ruta) — filas no navegables.
- Los write flows de tarjeta.

## Decisions

### D1 — Slice angosto, enfocado en el pane de la tarjeta
Se extrae y construye sólo lo que el pane de tarjeta requiere. El `MovementRow` nativo se construye una vez, acotado a `expense`/`reimbursement`; la tab Movimientos después lo **extiende** a los demás kinds y agrega su propio chrome (filtros, mes, FAB, saldo corriente), no lo reescribe. Alternativa descartada: construir la tab Movimientos completa ahora → scope mucho mayor y desacoplado del objetivo (cerrar el detalle de tarjeta).

### D2 — Homes de la extracción
- `@grana/transactions`: `FinancialMovement` (+ sub-uniones), `toMovementViewInput`, `resolveTone` + `Tone`. Es la capa display-VM sobre `TransactionWithDetails` (que ya vive ahí); ampliación natural del requirement de `web-data-access`. `toneToClass` (Tailwind) se queda en web; el row nativo mapea `Tone` → token con su propio helper.
- `@grana/cards`: `cardPeriodTransactionToMovement` + `installmentChip` (específicos de tarjeta; co-locados con `CardPeriodDetail`). `@grana/cards` importa `FinancialMovement` de `@grana/transactions` (dep nueva si no existe).
- Web: `toFinancialMovement` (mapper global) + `toInitialBalanceMovement` se quedan en `movements.ts`, importando el tipo del package. Sin consumer mobile todavía.

### D3 — El `MovementRow` nativo se acota a 2 kinds
Renderiza: ícono de categoría (emoji con bg tintado, o ícono fallback), primary (`description ?? categoryLabel ?? typeLabel`), secondary (taxonomía `categoría › subcategoría`), chip "Cuota X de Y" (debajo), badge de reintegro (`recibido`), y monto + tono vía `resolveMovementView` + `resolveTone`. **Omite** saldo corriente, badges recurrente/review/compartido, subtítulo de cuenta, y los kinds transfer/exchange/adjustment/card_payment/income/installment_purchase. Razón: el mapper de tarjeta nunca los produce; construir el row completo sería sobre-ingeniería. Traducción de categoría vía los helpers nativos existentes (`getCategoryName`/`resolveCategoryLabel`).

### D4 — Filas no navegables en mobile
El `MovementList` web envuelve cada fila en `<Link href="/transactions/{id}">`. Mobile no tiene ruta `/transactions/[id]`, así que el `MovementList` nativo ignora `detail_href` y renderiza filas planas (sin navegación) en este slice. Cuando aterrice el detalle de movimiento nativo, cablear la navegación es un cambio mínimo (envolver en `Pressable` + `router.push`).

### D5 — Reintroducir el segmented en el detalle nativo
`CardDetailView` nativo pasa de "cuotas inline" a un segmented `[Movimientos | Cuotas]` (reusando el `Segmented` de `apps/mobile/components/ui`), con default en **Movimientos** (paridad con web). La pestaña Movimientos renderiza el `PeriodMovementsPane` nativo del período seleccionado; Cuotas renderiza el `CuotasEnCursoPane` ya existente. La selección de período del timeline sigue manejando cuál período muestra el pane.

### D6 — Sin reads nuevos
`period.transactions` ya viene embebido en `CardPeriodDetail` (de `getCardPeriods`, ya consumido por la pantalla). El `PeriodMovementsPane` nativo mapea en memoria (`cardPeriodTransactionToMovement` + arma el mapa de `installmentChips`); no agrega queries ni query keys.

## Risks / Trade-offs

- **Mover el tipo `FinancialMovement` (unión grande) ripplea imports en web** → Mitigación: es un type-only move; web importa desde el package; typecheck marca todos los call sites. Los mappers globales no se mueven, sólo el tipo.
- **`resolveMovementView`/`toMovementViewInput` mal aplicados en las filas de tarjeta** → Mitigación: son las mismas funciones que usa web hoy; los kinds de tarjeta son simples (`expense`/`reimbursement`); smoke contra el pane web a ancho angosto.
- **Paridad visual del row nativo (ícono emoji/fallback, tono)** → Mitigación: mapear `Tone` → tokens estructurales (helper nativo, mirror de `toneToClass`); emoji desde `category_icon` con ícono lucide fallback como web; smoke visual.
- **Deriva de tokens en mobile** → Mitigación: tokens estructurales + hexes centralizados donde haga falta (patrón `detail/format.ts`); nunca hex literal suelto.

## Migration Plan

Sin migración de datos. Orden: (1) mover el tipo `FinancialMovement` + `toMovementViewInput` + `resolveTone`/`Tone` a `@grana/transactions`, recablear web (behavior-preserving), typecheck/lint web + `@grana/transactions`; (2) mover `cardPeriodTransactionToMovement` + `installmentChip` a `@grana/cards`, borrar `card-movement-mapper.ts`, repuntar el pane web; (3) construir `MovementList`/`MovementRow` nativos + helper de tono; (4) `PeriodMovementsPane` nativo + reintroducir el segmented en `CardDetailView`; (5) typecheck/lint mobile + smoke de las cuatro ramas y del pane. Rollback = revertir el commit.

## Open Questions

- **Home físico de los componentes nativos**: `apps/mobile/components/movements/` (`MovementList`, `MovementRow`) vs `components/transactions/`. Propuesta: `components/movements/` (nuevo), paralelo al naming web. Confirmar al implementar.
- **Badge de reintegro**: en el resumen sólo entran reintegros **recibidos** (el read filtra `received`), así que el badge sería siempre "recibido". Propuesta: mostrarlo igual (paridad con web); es barato y consistente si el filtro cambiara.
- **Mapa `Tone` → color nativo**: definir el helper en mobile (mirror de `toneToClass`). Los valores de `Tone` se resuelven al implementar; usar tokens `positive`/`negative`/`text`/`text-muted` según corresponda.
