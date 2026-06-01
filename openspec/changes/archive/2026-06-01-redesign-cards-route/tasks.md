## 1. Lógica pura (money-logic)

- [x] 1.1 Agregar `classifyPeriodsLifecycle(periods, today): { apagar: P | null; curso: P; prox: P | null }` en `packages/money-logic/src/cards.ts`, reutilizando `derivePeriodStatus`. `apagar` = período sin pago `closed`/`overdue` con transacciones; `curso` = período `open` que contiene `today`; `prox` = primer período con `start_date > curso.end_date` (o `null`).
- [x] 1.2 Tests unitarios de `classifyPeriodsLifecycle` (con/sin "a pagar", múltiples cerrados, sin próximo real). 7 tests en `apps/web/lib/cards/__tests__/lifecycle.test.ts`.

## 2. Lectura (queries) — API real

- [x] 2.1 Extender `CreditCardSummary` con `activeInstallmentsCount` (parents con ≥1 hija `pending`) + `color_key`/`icon_key` (para el acento) en `apps/web/lib/cards/queries.ts`.
- [x] 2.2 `getCardsMonthSummary()`: agregado a nivel usuario del total "a pagar" por moneda (ARS/USD separados) + lista de próximos vencimientos (tarjeta, cierre, vencimiento, monto). Reusa `getCreditCards` (sin N+1).
- [x] 2.3 `getActiveInstallments(accountId)`: por compra (parent) → nombre/categoría/fecha de compra, cuota actual/total, monto por cuota, restante, próxima fecha; + total restante agregado.
- [x] 2.4 Helper `cardPeriodTransactionToMovement(tx)` que mapea `CardPeriodDetail.transactions` → `FinancialMovement` (`card-movement-mapper.ts`). Se extendió `MovementRow`/`MovementList` con `installmentChip`/`installmentChips` (aditivo, no afecta transactions); selects de `category` extendidos con `icon`/`color`.

## 3. Acento por tarjeta

- [x] 3.1 Resolver el acento por card vía `resolveAccountAvatar` (`cardAccent` en `card-presentation.ts`). Tiñe franja, avatar, barra de límite, ring de selección (timeline/heroes/mini) y dots de cuotas. Nunca hardcodeado por marca.

## 4. Listado `/cards` (wallet + hero)

- [x] 4.1 `cards-month-hero.tsx`: "A pagar este mes" (ARS grande + USD aparte, nunca sumados) + caja de próximo vencimiento + lista "Próximos vencimientos".
- [x] 4.2 `card-status-pill.tsx` (due/soon/ok) y `card-limit-bar.tsx` (barra teñida con acento), reusables.
- [x] 4.3 `wallet-card.tsx`: franja de acento, avatar+nombre+meta (sin número), pill de estado, stats (resumen/cierra/vence), barra de límite (si hay), footer "N compras en cuotas" + "Ver resumen". Hover según handoff. Click → `/cards/[id]`.
- [x] 4.4 `wallet-grid.tsx` (2-col desktop, 1-col bajo `md`) y reescritura de `apps/web/app/(app)/cards/page.tsx` con header + hero + "Mis tarjetas" + wallet. Sección "Archivadas" colapsable (`archived-cards-section.tsx`, nueva).

## 5. Detalle `/cards/[id]` (ciclo de vida)

- [x] 5.1 `card-detail-view.tsx` (client): estado `periodo`/`tab` y reglas (default `apagar ?? curso`, fallback a `curso`, click en timeline/cards cambia período y vuelve a `movs`). Sin `scrollIntoView` ni animación de entrada del pane.
- [x] 5.2 `card-detail-header.tsx` (avatar 54px + nombre + pill + banco).
- [x] 5.3 `lifecycle-timeline.tsx`: pasos Pagado→[A pagar]→En curso→Próximo, "A pagar" solo si existe, pasos clickeables, línea verde hasta el siguiente paso.
- [x] 5.4 `pay-hero-card.tsx` (terracota): monto 56px (ARS + USD aparte), "cerró el X · vence el Y", countdown (o "vencido hace N días"), CTA "Registrar pago" → `/cards/[id]/periods/[periodId]/pay` (con `stopPropagation`).
- [x] 5.5 `en-curso-card.tsx`: badge "● Sumando consumos" (pulso), monto (40/52px hero), "acumulado hasta hoy · incluye cuotas del período", stats (N movs · $ en cuotas del ciclo), panel de ciclo (cierra · en N días · barra · día X de N). Pasa a hero cuando no hay "a pagar".
- [x] 5.6 `proximo-mini-row.tsx`: fila punteada "PRÓXIMO · cierra X · ya comprometido en cuotas" + monto + chevron, clickeable.
- [x] 5.7 `card-limit-panel.tsx`: cargado (usado/total/%/disponible) o CTA "Cargar límite" → `/cards/[id]/edit`.
- [x] 5.8 Tabs vía `Segmented` (en `card-detail-view.tsx`): "Movimientos del período" | "Cuotas en curso · N".
- [x] 5.9 `period-movements-pane.tsx`: reusa `MovementList` + mapper (2.4), agrupado por fecha, chips cuota/recurrente, ARS terracota / USD subordinado, empty "Sin movimientos".
- [x] 5.10 `cuotas-en-curso-pane.tsx` + `cuota-progress-dots.tsx`: intro con total restante + card por compra con dots (pagadas acento / próxima acento .4 / futuras gris) + footer (por cuota · restante · próxima cae). Empty "Sin compras en cuotas".
- [x] 5.11 Reescritura de `apps/web/app/(app)/cards/[id]/page.tsx` componiendo back link → header → zona de resúmenes (hero a pagar + en curso + mini próximo) → panel de límite → tabs → pane. Casos `tarjeta_nueva` y archivada sin pendientes conservados.

## 6. Estados, loading, responsive

- [x] 6.1 Empty states: sin tarjetas (listado), período sin movimientos, sin cuotas en curso, límite no cargado, tarjeta nueva, archivada sin pendientes.
- [x] 6.2 Loading/error states: cubiertos por el boundary de grupo `(app)/loading.tsx` (`RouteLoading`) y `(app)/error.tsx` (`RouteError`) vía Suspense anidado de Next — patrón del módulo `route-loading-and-errors`. No se requieren `loading.tsx`/`error.tsx` por ruta.
- [x] 6.3 Responsive: wallet 2→1 col, hero apilado (`md`), timeline/tabs scrollables en mobile-web. _(revisar en verificación visual)_

## 6b. Convención `Button`/`Card` (consistencia)

- [x] 6b.1 Nueva regla de convención: las acciones tipo botón componen el primitivo `Button` (delta en `project-conventions` + fila en `AGENTS.md`). CTAs migrados: "Agregar tarjeta" (header), "Registrar primer consumo" (tarjeta nueva), "Agregar tarjeta" (empty del wallet).
- [x] 6b.2 Superficies tipo tarjeta componen `Card` (no shell inline): `cards-month-hero`, `card-limit-panel` (ambas ramas), `cuotas-en-curso-pane` (intro + cards por compra), `wallet-card` (`Card asChild` sobre `<Link>`), `en-curso-card` (`Card asChild` sobre `<button>`), `archived-cards-section`, estado vacío de tarjeta nueva. Se extendió el primitivo `Card` con `asChild` (Radix `Slot`, extensión web-local como `variant`); delta `MODIFIED` del requirement de `Card`.

## 6c. Limpieza de componentes huérfanos

- [x] 6c.1 Borrar la cadena del carrusel viejo: `credit-card-carousel.tsx`, `credit-card-item.tsx`, `card-dates-footer.tsx`. (Reemplazados por wallet grid.)
- [x] 6c.2 Borrar la cadena del detalle viejo (termómetro): `cards-thermometer.tsx`, `limit-summary.tsx`, `card-hero.tsx`, `payment-cta-block.tsx`, `periods-section.tsx`, `period-card.tsx`. Se conserva `estimated-date-badge.tsx` (lo usa `periods-list` de `/cards/[id]/periods`, ruta intacta).

## 7. Validación y archive

- [x] 7.1 `pnpm lint` y typecheck pasan (solo queda 1 warning preexistente ajeno en `credit-cards.ts:207`). `pnpm --filter web build` compila todas las rutas `/cards*`. 183 tests verdes (cards + transactions).
- [x] 7.2 Verificación visual en browser por el owner: validado el listado (incl. fix de "Próximos vencimientos" que ahora lista toda tarjeta activa) y el botón "Agregar tarjeta" migrado al primitivo `Button`. Resto de pantallas revisadas por el owner durante la sesión.
- [x] 7.3 Realineado: se separó "A pagar este mes" de "Próximos vencimientos" en `getCardsMonthSummary` (bug detectado en verificación); CTA "Agregar tarjeta" migrado a `Button`; superficies migradas a `Card`. Deltas realineados a lo implementado.
- [x] 7.4 `pnpm openspec:check` pasa.
- [x] 7.5 Archive: deltas de `cards` (RENAMED listado + MODIFIED detalle/mora + ADDED tabs) y `project-conventions` (ADDED Button + MODIFIED Card con `asChild`) integrados en sus master specs (sección plana, sin secciones de delta); `Purpose` de `cards` actualizado (listado=wallet, detalle=ciclo de vida); carpeta movida a `openspec/changes/archive/2026-06-01-redesign-cards-route/`. `AGENTS.md`: fila del módulo `cards` (#9) sigue válida (rediseño visual, no cambia capacidades) + fila nueva "Actions use the `Button` primitive" agregada.
