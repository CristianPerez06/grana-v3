## 1. Preparación

- [x] 1.1 Re-diff los archivos web de referencia en el momento del apply (por si web siguió iterando): `git diff 0f549f3..HEAD -- "apps/web/app/(app)/dashboard/_components/committed-section.tsx" "apps/web/app/(app)/dashboard/_components/committed-skeleton.tsx" "apps/web/app/(app)/dashboard/_components/spending-donut.tsx" "apps/web/app/(app)/dashboard/_components/accounts-card.tsx"`.
- [x] 1.2 Verificar que toda key `dashboard.committed.*` que usa el web resuelve en mobile vía `useT(...)` (keys ya en `@grana/i18n-messages`): `total_label`, `card_label`, `card_hint`, `recurring_label`, `recurring_hint`, `view_cards`, `view_recurring`, `overdue`, `income_tile_title`, `income_tile_sub`, `net_surplus`, `net_deficit`, `empty`, `title`, `question`, `error`.
- [x] 1.3 Confirmar que `HeroAccountBalance.institutionName` y los campos `overdue` / `topCard` / `topRecurring` de `CommittedCurrency` llegan al consumidor mobile sin tocar `lib/dashboard/queries.ts`.

## 2. Donut auto-scale

- [x] 2.1 Crear `apps/mobile/lib/donut-amount.ts` con `donutAmountFontSize(formatted, donutSize, maxPx)` espejo verbatim de `apps/web/lib/donut-amount.ts`; agregar comentario de cross-reference en ambos archivos (web y mobile) para evitar drift.
- [x] 2.2 En `apps/mobile/components/dashboard/SpendingDonut.tsx`: formatear el total con `formatARS`/`formatUSD` de `@grana/i18n-messages` + `useShowCents()`, calcular el font-size con el helper y aplicarlo al `Text` del monto central (sin pisar el anillo). Mantener `MaskedAmount` para enmascarado.
- [x] 2.3 Verificar visualmente con un total largo (p. ej. `$10.287.377,77`) que el monto entra dentro de la dona en nativo.

## 3. AccountsCard — nombre de institución

- [x] 3.1 En `apps/mobile/components/dashboard/AccountsCard.tsx`: usar `account.institutionName ?? account.name` en la etiqueta del callout de concentración (cuenta dominante) y en cada celda de la grilla. Sin cambios de layout.
- [x] 3.2 Verificar: cuenta con institución muestra el banco; cuenta de efectivo (`institutionName` nulo) cae al nombre del usuario. (Cubre el escenario nuevo de la spec "Dónde está".)

## 4. CommittedSection — re-port al modelo "obligaciones pendientes"

- [x] 4.1 Reemplazar el `Tile` viejo (debt/recurring_expense + strip USD al pie) por un sub-componente `Section` (RN): header con ícono (CreditCard navy / Repeat terracotta, mirror de tokens) + label (`card_label`/`recurring_label`) + hint (`card_hint`/`recurring_hint`) + subtotal ARS y, cuando `showUsd`, subtotal USD; debajo la lista de movimientos y un link "ver más" (`view_cards`/`view_recurring`).
- [x] 4.2 Titular "Total a pagar" (`total_label`) con `MaskedAmountDisplay` (ARS) + USD consistente cuando `committedTotal(USD) > 0`; total = `debt + recurringExpense` (el ingreso recurrente nunca se suma).
- [x] 4.3 Lista de movimientos por sección: `ddmm(date)` · descripción (truncada, fallback "—") · `MaskedAmount`. Implementar la **prioridad de detalle**: si `topRecurring.length > 0`, listar Recurrencias y dejar Tarjeta sin lista; si no, listar `topCard` en Tarjeta. Los subtotales de ambas secciones siempre se muestran.
- [x] 4.4 Aviso de vencido: cuando `ARS.overdue > 0`, banner compacto terracotta-soft con `AlertTriangle` + frase rica `overdue` (reusar el split `<amount></amount>` del helper `NetBand` para inyectar el `MaskedAmount`). Ocultar cuando `overdue === 0`.
- [x] 4.5 Conservar la banda "Ya entra" + cierre neto (`NetBand`) tal cual, re-ubicada bajo las dos secciones; `hasIncome = ARS.recurringIncome > 0`, `net = recurringIncome − totalARS`.
- [x] 4.6 Conservar estados in-card: empty (`empty`), error (`error` + retry vía `query.refetch()`), y `CommittedSkeleton` mientras carga; mantener `SWAP_MIN_HEIGHT` estable.
- [x] 4.7 Links con `expo-router`: `view_cards` → `/cards`, `view_recurring` → `/transactions/recurring`.

## 5. CommittedSkeleton — reshape

- [x] 5.1 Re-formar `apps/mobile/components/dashboard/CommittedSkeleton.tsx` al shape nuevo: fila de total (label + monto) + dos bloques de sección (ícono + label + subtotal, luego dos filas de movimiento). Componer `SkeletonBlock` de `components/ui/` (no re-implementar pulse). Mantener alto estable acorde a `SWAP_MIN_HEIGHT`.

## 6. Verificación

- [x] 6.1 `pnpm --filter mobile typecheck` pasa.
- [x] 6.2 `pnpm --filter mobile lint` pasa.
- [x] 6.3 Render manual de `/dashboard` nativo cubriendo: (a) deuda con vencido > 0 (aviso visible), (b) con ingreso recurrente (Ya entra + neto), (c) sin ingreso, (d) estado vacío, (e) dona con total largo, (f) cuenta con y sin institución.
- [x] 6.4 Confirmar paridad de export names/props con web (`CommittedSection`, `CommittedSkeleton`, `SpendingDonut`, `AccountsCard`) — la convención de naming espejo de la spec del dashboard se mantiene.
