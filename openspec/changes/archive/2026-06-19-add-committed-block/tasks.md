## 1. Data: outlook de compromiso (`@grana/dashboard`)

- [x] 1.1 `types.ts`: tipo `CommittedOutlook` = `{ ARS: CommittedCurrency; USD: CommittedCurrency }` con `CommittedCurrency = { debt: number; recurringExpense: number; recurringIncome: number }`.
- [x] 1.2 `queries.ts`: `getCommittedOutlook(supabase)` — deuda de tarjeta por moneda = suma del pendiente (consumos `pending` − reintegros recibidos imputados) de TODOS los períodos impagos (sin `period_payments`) de las tarjetas activas (en curso + cerrados + vencidos). Reusar la matemática de pendiente por período existente, sin duplicar el neto.
- [x] 1.3 En la misma `getCommittedOutlook`: recurrentes próx mes — traer reglas activas, proyectar con `projectUpcomingOccurrences` sobre la ventana del mes calendario siguiente a `getTodayAR()`, sumar `amount` por moneda y `movement_type` (`expense`→recurringExpense, `income`→recurringIncome, `transfer`→ignorar).
- [x] 1.4 Exportar `getCommittedOutlook` + tipos desde `packages/dashboard/src/index.ts`.

## 2. Tests (`@grana/dashboard`)

- [x] 2.1 Test de la proyección/agregación de recurrentes: reglas expense+income+transfer → suma correcta por moneda y tipo; transfer ignorado; bimoneda separada.
- [x] 2.2 Test de deuda de tarjeta: suma pendientes de períodos impagos (en curso + cerrado), resta reintegros recibidos; períodos pagados no cuentan; ARS/USD separados.

## 3. UI: card "Lo que se viene" (web)

- [x] 3.1 `committed-section-container.tsx` (server): llama `getCommittedOutlook`, maneja error compacto, pasa datos a la section.
- [x] 3.2 `committed-section.tsx` (client, para eye-mask): titular = total comprometido (`debt + recurringExpense`) por moneda; filas "Deuda de tarjeta", "Gastos recurrentes (próx mes)"; fila/contexto "Ingresos recurrentes" separada y no sumada; estado vacío neutral; strip USD (bimoneda). Reusa `FlowRow`/Card/eye-mask. NO consume el month context (estática).
- [x] 3.3 `committed-skeleton.tsx`: skeleton shape-matched (título + filas).
- [x] 3.4 `dashboard-content.tsx`: envolver "Balance del mes" + "Lo que se viene" en un grid de dos columnas (`lg:grid-cols-[…]`, apiladas en mobile), cada una con su `Suspense` + skeleton.
- [x] 3.5 Rótulo de pregunta de la card ("¿Qué debo / qué se viene?") vía i18n, mismo tratamiento que las otras cards.

## 4. UI: tira 💳 "financiado en tarjeta" (web)

- [x] 4.1 Componente `financed-on-card-note.tsx` (client, full-width, mes-scoped): lee balance-series + category-breakdown con los MISMOS queryKeys que las secciones (TanStack dedupea, sin fetch extra).
- [x] 4.2 Calcular `financiado = totalDevengado − totalExpense (caja)`; renderizar la tira solo si `financiado > 0` (eye-mask) y colocarla en `dashboard-content` debajo de la fila de las dos cards.
- [x] 4.3 Rename: card "En qué se fue" → título "¿En qué gasté este mes?" (i18n), sin subtítulo de pregunta aparte.

## 5. i18n

- [x] 5.1 Claves `dashboard.committed.*` (título, pregunta, labels deuda/recurrentes/ingresos, vacío, loading, error) en `es`/`en`.
- [x] 5.2 Clave `dashboard.month.financed_on_card` (es/en) con interpolación de los tres montos y la aclaración "se paga en los próximos resúmenes".

## 6. Verificación

- [x] 6.1 `pnpm --filter @grana/dashboard test`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter mobile typecheck`.
- [x] 6.2 QA manual: card "Lo que se viene" con deuda + recurrentes (incluí un mes con ingreso recurrente para ver el contexto); mensaje 💳 cierra los tres números; card estática al navegar meses; estado vacío sin deuda/recurrencias; eye-mask.
- [x] 6.3 Confirmar layout de dos columnas en desktop y apilado en mobile-web sin que Balance del mes quede roto.
