# Proposal: committed-outlook-follows-month

## Why

La card "Compromisos del próximo mes" es la única del dashboard que **no sigue al navegador de mes**. Parado en cualquier mes dice siempre lo mismo: los compromisos del mes siguiente a **hoy**. Reportado sobre producción: en septiembre, navegando a agosto, la card sigue rotulando "Octubre" y mostrando los números de octubre.

La causa está escrita en el código y era deliberada: `committed-section-container.tsx` llama `getCommittedOutlook(supabase)` sin fecha, el default es `getTodayAR()`, y `nextMonthWindow()` deriva la ventana de ahí. El container es un RSC que no consume `DashboardMonthContext`, y encima web (`committed-section-container.tsx`) y mobile (`CommittedSection.tsx`) recalculan el label del mes **cada uno por su cuenta** con `new Date()`.

Es una asimetría con el resto de la pantalla: "Saldo disponible total" corta en el último día del mes seleccionado (`balanceCutISO`) y "Cuánto gastaste" reclave sus queries por `selected.year/month`. Las dos ya son **foto por mes**; Compromisos quedó anclada a hoy y contradice a sus vecinas en la misma pantalla.

El problema de fondo no es la ventana sino el parámetro: hoy `todayISO` cumple **dos roles a la vez** —"qué mes estoy mirando" y "cuándo es ahora, para decidir qué está impago"—. Mientras coincidían nadie lo notó. Separarlos es el cambio.

## What Changes

- **Nueva firma explícita**: `getCommittedOutlookForMonth(supabase, { year, month, todayISO })` reemplaza a `getCommittedOutlook(supabase, todayISO)`. El mes del dashboard es `{ year, month }` (igual que `getMonthBalanceSeries`), no una fecha disfrazada de mes.
- **Dos fechas, dos roles**: `window` = mes calendario siguiente al mes seleccionado; `snapshotDate` = último día del mes seleccionado, o `todayISO` cuando el seleccionado es el mes en curso. Viendo junio 2026 → foto al `2026-06-30`, compromisos de `2026-07-01..2026-07-31`.
- **El resultado trae su propia metadata**: `CommittedOutlook` gana `window { start, end }`, `snapshotDate`, `lens: 'live' | 'snapshot'` y `windowElapsed`. Son dos campos y no uno porque las dos mitades de la card parten las posiciones del navegador por lugares distintos: las tarjetas separan el mes en curso del resto, los gastos fijos separan la ventana ya terminada del resto. Web y mobile rotulan **desde el dato**; se elimina el `new Date()` duplicado en las dos plataformas, que es la causa de clase del bug.
- **Tarjetas: reconstrucción as-of.** El estado de pago se evalúa a la fecha financiera del pago (`period_payments.transaction_id → transactions.date`), no al estado de hoy ni a `period_payments.created_at`. Los consumos **no** se cortan por fecha: el resumen aporta su contenido completo, porque un corte por `date` dejaría afuera las cuotas ya conocidas al corte (se insertan en la compra, fechadas hacia adelante) y vaciaría el número para cualquiera que financie. Nueva agregación `aggregateCardDebtAsOf`, apoyada en `computePeriodAmounts` para no re-derivar el tratamiento del reintegro "en resumen".
- **Gastos fijos: registro materializado, no replay.** Qué instancias cuentan lo decide `lens` (`live` → sólo `pending`; `snapshot` → `confirmed` + `pending`, nunca `skipped`); si la proyección aporta lo decide `windowElapsed`. Parado en el mes en curso no cambia nada respecto de hoy.
- **La nota al pie no cambia de significado ni de tamaño.** Sigue siendo UNA línea con una sola regla en las tres posiciones: los resúmenes vencidos e impagos **al `snapshotDate`**. Con `lens: 'live'` el snapshot es hoy, así que es exactamente el arrastre de hoy. Bajo `snapshot` el arrastre NO desaparece: un resumen que venció el 28/07 y seguía impago al 31/08 estaba vencido ese día, y la card de ese día lo decía.
- **`computePeriodAmounts` se promueve a `@grana/money-logic`.** `@grana/dashboard` no puede importarla desde `@grana/cards` sin cerrar el ciclo `dashboard → cards → transactions → dashboard`. Es pura y sus dependencias ya viven en money-logic, así que el movimiento no agrega ninguna arista; `@grana/cards` la reexporta.
- **Web**: `CommittedSectionContainer` pasa a container RSC que resuelve el mes actual y lo entrega como `initialData` a un `useQuery` reclaveado por mes — el patrón exacto de `use-balance-month.ts`. **Mobile**: `useCommittedOutlook` toma `{ year, month }` y los suma a su `queryKey`. Las dos plataformas en el mismo commit.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `dashboard`: el requirement "La card «Comprometido» muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)" pasa de una ventana fija relativa a hoy a una ventana relativa al **mes seleccionado**, incorpora el `snapshotDate` y su regla de reconstrucción, y documenta las dos limitaciones conocidas del lado gastos fijos.

## Impact

- `packages/dashboard/src/queries.ts` — `getCommittedOutlook` → `getCommittedOutlookForMonth`, ramas de criterio por `lens` y por `windowElapsed`.
- `packages/dashboard/src/aggregations.ts` — `aggregateCardDebtAsOf` (nueva) + `aggregateCardDebtByCard` con la misma normalización.
- `packages/dashboard/src/types.ts` — `CommittedOutlook` gana `window`, `snapshotDate`, `lens`, `windowElapsed`.
- `packages/money-logic/src/` — recibe `computePeriodAmounts` desde `packages/cards/src/period-amounts.ts`, que pasa a reexportarla (evita el ciclo de packages).
- `apps/web/app/(app)/dashboard/_components/` — `committed-section-container.tsx`, `committed-section.tsx`, nuevo `use-committed-month.ts`.
- `apps/mobile/lib/dashboard/queries.ts`, `apps/mobile/components/dashboard/CommittedSection.tsx`.
- `packages/i18n-messages/src/es.json` / `en.json` — títulos en tres estados y nota al pie condicional.
- Tests: `packages/dashboard/__tests__/committed-outlook.test.ts` (los 15 casos existentes pasan a la firma nueva) + casos de ventana pasada.
- UX: navegar meses ahora mueve la card; el mes en curso muestra exactamente lo mismo que hoy.
