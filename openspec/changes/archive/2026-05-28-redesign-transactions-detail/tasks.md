# Tareas — Rediseño visual del detalle del movimiento

## Grupo 1 · Lógica pura y helpers

- [x] 1.1. Crear `apps/web/lib/transactions/components/tone.ts` con `toneClass(movement, view): Tone` (8 kinds). Y `fmtAmountParts(amount, currency, showCents)` que devuelve `{ symbol, int, dec, sign }` (decimales superscript-ready).
- [x] 1.2. Tests de `tone.ts` en `apps/web/lib/transactions/__tests__/tone.test.ts` — cubrir income, expense, transfer, exchange, adjustment positivo/negativo, card_payment, installment_purchase, reimbursement received/pending.
- [x] 1.3. Tests de `fmtAmountParts` con casos: ARS sin centavos, USD con centavos, valor 0, negativo, monto grande con separadores de miles.

## Grupo 2 · Dependencia de Radix DropdownMenu

- [x] 2.1. `pnpm add @radix-ui/react-dropdown-menu` en `apps/web/`. Verificar que sume sin conflictos.
- [x] 2.2. Confirmar que `@radix-ui/react-alert-dialog` ya está (lo usa `DeleteAction` actual). Si no, agregarlo.

## Grupo 3 · Componentes nuevos

- [x] 3.1. Crear `_components/tx-detail-row.tsx`: ícono cuadrado 32×32 + label uppercase + value. Acepta `valueNode` para casos custom.
- [x] 3.2. Crear `_components/tx-detail-group.tsx`: card blanco con eyebrow caps opcional + children (filas de `TxDetailRow`).
- [x] 3.3. Crear `_components/tx-installment-rows.tsx`: variant con número circular según estado (`pending` warning / `paid` income / otra muted) + chip de estado + monto.
- [x] 3.4. Crear `_components/tx-hero.tsx`: ícono circular 64px con sombra `0 8px 22px rgba(11,26,43,0.10)`, monto display con currency opaco y decimales superscript, descripción 18px bold navy centrada, context line 12px muted centrada. Recibe `tone`, `iconBg`, `icon`, `amount`, `currency`, `desc`, `context`.
- [x] 3.5. Crear `_components/tx-header.tsx`: `Link` con `ArrowLeft` 20px solo + slot `actions` a la derecha. Recibe `backHref` y `actions?: ReactNode`.
- [x] 3.6. Crear `_components/tx-actions-menu.tsx`: kebab `MoreHorizontal` con `@radix-ui/react-dropdown-menu`. Items "Editar" (link) y "Eliminar" (abre `AlertDialog`). Copy contextual del delete warning según `isParent` / `isCardPayment`. Cuando `!canEdit && !canDelete` → devuelve `null`.
- [x] 3.7. Crear `_components/tx-context-note.tsx`: componente chico que renderea el párrafo editorial in-context según la variant resuelta (`card-pending`, `card-paid-installment`, `card-payment`, `reimbursement-pending`, `reimbursement-cancelled`). Texto plano, 13px muted, centered, sin border ni bg. Renderea null cuando no aplica variant.
- [x] 3.8. Crear `_components/resolve-context-variant.ts`: helper puro que toma `movement` + `transaction` y devuelve la variant del `TxContextNote` (o null). Tests en `__tests__/resolve-context-variant.test.ts` cubriendo los 5 casos + casos no aplicables (income cash, expense cash, transfer, etc.).

## Grupo 4 · Storybook

- [x] 4.1. Story `TxHero` con los 4 tones (income/expense/neutral/pending), uno en ARS sin centavos, otro en USD con centavos.
- [x] 4.2. Story `TxDetailGroup` con 3 filas de `TxDetailRow` (variantes con `valueNode`).
- [x] 4.3. Story `TxInstallmentRows` con 3 cuotas en estados mixtos.
- [x] 4.4. Story `TxActionsMenu` (dropdown abierto, AlertDialog abierto).

## Grupo 5 · Refactor de `GlobalTransactionDetail`

- [x] 5.1. Refactor del componente para orquestar los subcomponentes nuevos. La función `detailRows` se mantiene como helper interno (mismo shape, alimenta `TxDetailGroup`).
- [x] 5.2. Mapeo del `kind` del movimiento a `iconBg` + `icon` para el `TxHero` (emoji con bg-tinted para categorizables, ícono lucide con bg-muted para estructurales).
- [x] 5.3. Mapeo del `kind` a `desc` y `context` del hero:
  - `expense`/`income`: desc = movement.description ?? category.name; context = fecha + cuenta.
  - `transfer`: desc = "Transferencia"; context = origen → destino.
  - `exchange`: desc = "Cambio de moneda"; context = origen → destino con fx_rate.
  - `card_payment`: desc = "Pago de resumen"; context = período + cuenta cash que pagó.
  - `installment_purchase` (parent): desc = movement.description; context = N cuotas + tarjeta.
  - `installment_purchase` (child): desc = movement.description; context = cuota n/N.
  - `adjustment`: desc = "Ajuste"; context = sign + cuenta.
  - `reimbursement`: desc = "Reintegro de" + linked.description; context = estado + cuenta.
- [x] 5.4. Renderear `TxInstallmentRows` solo cuando el movimiento es madre o hija de cuotas (`is_parent` o `parent_id != null`).
- [x] 5.5. Renderear `TxDetailGroup` para reembolsos solo cuando `reimbursements.length > 0`.
- [x] 5.6. Renderear `TxContextNote` entre el `TxHero` y el primer `TxDetailGroup`, alimentándolo con la variant que devuelve `resolveContextVariant` y la copy i18n del `transactions.detail.context.{variant}`.

## Grupo 6 · Página `[txId]/page.tsx`

- [x] 6.1. Sacar el back link inline (`flex items-center gap-3` con `<Link>`). Lo asume `TxHeader` adentro del componente del detalle.
- [x] 6.2. Mantener el banner de recurrencia arriba como está (no se mueve).
- [x] 6.3. Pasar el `TxHeader` al detalle: el detalle recibe el `backHref` y lo arma adentro.

## Grupo 7 · i18n

- [x] 7.1. Agregar las claves `transactions.detail.*` (acciones, groups, labels) en `packages/i18n-messages/src/es.json` y `en.json`. Lista exacta en `design.md` § 8.
- [x] 7.2. Agregar las claves `transactions.detail.context.*` (5 variantes de pedagogía in-context) en `es.json` y `en.json`. Lista exacta en `design.md` § 7.5.

## Grupo 8 · Verificación

- [x] 8.1. `pnpm typecheck` verde.
- [x] 8.2. `pnpm lint` verde.
- [x] 8.3. `pnpm test` verde (tests nuevos de `tone.ts` + `fmtAmountParts` incluidos).
- [x] 8.4. `pnpm build` (web) verde.
- [x] 8.5. Verificación visual en navegador (`pnpm dev`):
  - Detalle de un gasto cash simple.
  - Detalle de una compra en cuotas (madre): tabla de cuotas con numeración.
  - Detalle de una cuota hija (navegando desde la madre): muestra info de la madre.
  - Detalle de una transferencia: tone neutral.
  - Detalle de un cambio USD: tone neutral, context con fx_rate.
  - Detalle de un pago de resumen: tone expense, context con período.
  - Detalle de un ajuste positivo y uno negativo.
  - Detalle de un reintegro pendiente: tone pending, etiqueta "esperado", copy contextual "Esperás que te lo devuelvan…".
  - Detalle de un reintegro recibido: tone income, sin copy contextual.
  - Kebab `⋯` abre dropdown; "Editar" navega; "Eliminar" abre confirm; copy contextual.
  - Copy contextual debajo del hero aparece SOLO en los kinds correspondientes (consumo de tarjeta no pagado, cuota paid no-primera, pago de resumen, reintegro pendiente, reintegro cancelado). En income/expense cash, transfer, exchange y ajuste NO aparece.

## Grupo 9 · Archive

- [x] 9.1. Mover el change a `openspec/changes/archive/YYYY-MM-DD-redesign-transactions-detail/`.
- [x] 9.2. Aplicar deltas a `openspec/specs/transactions/spec.md` (integrar ADDED y MODIFIED a la sección flat).
- [x] 9.3. Confirmar que no quedan placeholders `Purpose: TBD`.
- [x] 9.4. Verificar que el master spec no contiene delta sections (`## ADDED Requirements`, etc.).
- [x] 9.5. Actualizar `AGENTS.md` si aplica (probablemente no — el módulo `transactions` ya está ✅ Done).
