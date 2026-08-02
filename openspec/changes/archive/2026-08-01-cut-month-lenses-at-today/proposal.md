# Proposal: cut-month-lenses-at-today

## Why

`exclude-future-dated-from-balance` (0052) cortó el **saldo** en hoy, pero dejó fuera de scope las lentes de período: "Sin cambios en las lentes de período (`summarizePeriod`, `buildMonthBalanceSeries`): siguen operando sobre la ventana del mes". Esa exclusión es el defecto.

Caso real (1-ago-2026, cuenta del autor): el Disponible ya excluía correctamente las filas futuras, pero "Balance del mes" mostraba **−$1.992.744** en un mes donde no se había gastado nada. Los $1.992.743,78 eran exactamente **todos** los gastos de agosto, ninguno de ellos con fecha ≤ hoy: recurrencias sin confirmar y semillas futuras. La sección que responde "cómo vengo este mes" contaba como hecho consumado lo que todavía no pasó, y contradecía al Hero de la misma pantalla.

El problema es de lectura, no de datos: las filas futuras deben seguir existiendo y siendo visibles en listados. Lo que no pueden es entrar en un número que responde "qué gasté" o "cómo vengo".

## What Changes

- **Corte temporal en las lentes del mes**: las secciones "Balance del mes", "¿En qué gasté?" (dona + drill de subcategorías + lista drilleada) y "De dónde vino" pasan a leer hasta **hoy** (fecha financiera AR) en vez de hasta el fin del mes calendario. Meses pasados no cambian; el mes en curso corta en hoy; un mes que todavía no empezó da serie vacía.
- **El corte es de CAJA, no universal**: aplica a las filas on-ledger (`status IS NULL` — efectivo/débito). Las filas de tarjeta (`status` 'pending'/'paid') **no** se cortan: para la lente devengado la unidad de acumulación es el **mes**, no el día, así que una cuota fechada el 20 devenga en su mes desde el día 1 (spec `spending-by-category`). Cortarlas vaciaría la dona a principio de mes escondiendo consumo ya incurrido.
- **Serie diaria**: `buildMonthBalanceSeries` acepta `cutoffDay` y emite días solo hasta él. Un día que todavía no llegó no se dibuja — un día futuro y un día sin movimientos son hechos distintos y no deben verse igual.
- **La regla vive una sola vez**: `packages/money-logic/src/temporal-cut.ts` (`financialTodayISO`, `earlierISO`, `isCardAccrualRow`, `countsUnderTemporalCut`, `cajaCutOrFilter`). Los cinco reads que la aplican la importan; ninguno reescribe el predicado a mano.
- **Sin migración**: 0052 ya cortó el saldo en SQL. Estas lecturas van por PostgREST, así que el corte viaja como predicado de query (`.or('status.not.is.null,date.lte.<hoy>')`), no como cambio de esquema.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `dashboard`: el requirement "La sección «Balance del mes» muestra el neto del mes con barras de ingresos y gastos" incorpora el corte a hoy y su consecuencia sobre la reconciliación con el Disponible (ambos lados cortan en el mismo día, así que la reconciliación se **preserva** — antes se rompía en un mes con filas futuras).
- `spending-by-category`: el requirement "El desglose pesa por el neto de cada categoría, por moneda" distingue el corte CAJA (gasto cash/débito futuro no cuenta) de la lente devengado de tarjeta (la cuota del mes cuenta el mes entero).
- `web-data-access`: el requirement de reads completos por construcción suma el corte temporal de las lecturas mensuales vía PostgREST y la obligación de derivarlo del helper compartido.

## Impact

- `packages/money-logic/src/temporal-cut.ts` (nuevo) + export en `index.ts`.
- `packages/dashboard/src/queries.ts` (`getMonthBalanceSeries` gana `todayISO`; `getMonthCategoryBreakdown` gana `todayISO` + `.or(cut)`).
- `packages/dashboard/src/aggregations.ts` (`buildMonthBalanceSeries` gana `cutoffDay`).
- `apps/web/lib/transactions/queries.ts` (`getMonthCategoryBreakdown` wrapper, `getMonthCategoryLines`, `getMonthSubcategoryBreakdown`, `getMonthIncomeBreakdown`).
- Mobile hereda el fix sin cambios propios: consume los mismos reads compartidos.
- Tests: `packages/dashboard/__tests__/month-lens-temporal-cut.test.ts` (nuevo), `apps/web/lib/transactions/__tests__/temporal-cut.test.ts` (nuevo).
- UX: en el mes en curso los totales del mes "crecen" a medida que las fechas llegan; el usuario que carga recurrencias futuras ya no ve un mes en rojo por gastos que no hizo.
