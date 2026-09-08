## Why

"Entró" y "Se fué" son dos montos grandes sin explicación. El usuario ve que se fueron $2.560.653,23 y no tiene forma de saber que $968.558,83 de eso fueron pagos de resumen —que cancelan deuda ya devengada, no gasto nuevo— y el resto gasto real. Lo mismo del otro lado: entre los $3.375.113,34 que entraron hay $446.002,12 que no se ganaron, volvieron.

Ese desglose ya está calculado. `summarize()` en `@grana/dashboard` compone `entro` sumando ingresos, devoluciones y el lado positivo de los baldes con signo, y `seFue` sumando gastos, pagos de tarjeta y el lado negativo — y después tira los términos. Exponerlos no necesita ninguna lectura nueva y la suma queda garantizada por construcción.

## What Changes

- `MonthSummary` gana `entroParts` y `seFueParts`, y los totales pasan a ser la suma de sus propias partes en vez de un cálculo paralelo.
- En la card de saldo, "Entró" y "Se fué" se vuelven desplegables: abren un panel con sus conceptos. Uno por vez, filas en cero omitidas, web y nativo.
- "Tenías" no se abre: no es un flujo.

### Alcance dejado afuera

**"Rendimientos" como fila propia de "Entró".** La idea original separaba lo ganado en sueldo contra rendimientos (los intereses de una cuenta remunerada). No se hizo porque no es un balde: es un subconjunto de `totalIncome` por categoría, así que necesita una lectura nueva y, antes que eso, una definición de qué categorías cuentan como rendimiento. Queda pendiente de decisión de producto; la apertura entregada es Ingresos / Devoluciones / Otros, que es lo que los datos sostienen hoy.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `dashboard`: nuevo requirement de apertura por concepto de los dos flujos del "Resumen del mes".

## Impact

- `@grana/dashboard`: `month-summary.ts` (`EntroParts`, `SeFueParts`, `summarize`), con tests en `packages/dashboard/__tests__/month-summary.test.ts`.
- `@grana/i18n-messages`: seis claves nuevas bajo `dashboard.month`, en `es` y `en`.
- Web: `apps/web/app/(app)/dashboard/_components/balance-card.tsx`.
- Nativo: `apps/mobile/components/dashboard/BalanceCard.tsx`.
- Fixtures de dos tests de `savings` que construían un `MonthSummary` a mano.
- Ninguna lectura cambia: los totales que la card ya mostraba siguen siendo los mismos.
