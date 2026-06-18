## Context

`buildMonthBalanceSeries` (en `@grana/dashboard`) construye la serie mensual que alimenta la card "Balance del mes" en web y mobile. Hoy clasifica cada movimiento del mes en dos baldes diarios (`dailyIncome`, `dailyExpense`) y de ahí deriva `totalIncome`, `totalExpense`, `finalBalance` y la serie acumulada. Los `type='adjustment'` se ramifican según signo: positivo → income, negativo → expense. Eso mezcla correcciones de stock con flujo real e infla ambas barras (caso QA: $3.15M de ajustes dentro de un "Gastos" de $3.4M).

La serie diaria (`days`/`accumulatedBalance`) ya no alimenta ningún gráfico (el `MonthBalanceChart` se retiró); hoy solo la consumen los tests. Eso da libertad para reestructurar los baldes sin tocar UI más allá de agregar una fila.

## Goals / Non-Goals

**Goals:**
- Separar los ajustes de saldo en su propio total (`totalAdjustment`, neto con signo) sin alterar `finalBalance` ni la serie acumulada.
- Que "Gastos" e "Ingresos" reflejen solo flujo real, y "Gastos" reconcilie con "En qué se fue".
- Mostrar la línea "Ajustes" solo cuando el mes tiene ajustes, en web y mobile, con paridad.

**Non-Goals:**
- Cambiar cómo se crean/almacenan los ajustes (siguen siendo `type='adjustment'`).
- Tocar "En qué se fue" / `getMonthCategoryBreakdown` (ya excluye ajustes).
- Rediseñar el concepto "ajuste de saldo" a nivel modelo (eso sería un change mayor aparte).
- Renombrar la fila "Gastos" (decisión de copy, follow-up separado).

## Decisions

**1. Balde neto único (`totalAdjustment`) en vez de in/out separados.**
La UI muestra un solo número neto de ajustes con signo. Mantener `totalAdjustmentIn`/`totalAdjustmentOut` separados agregaría superficie sin consumidor. Si una vista futura lo necesita, la serie diaria (`dailyAdjustment`, con signo) permite reconstruir ambos lados. → Agregamos `totalAdjustment: number` (neto, con signo) y `dailyAdjustment: number` por día.

**2. La acumulación incluye los ajustes; las barras no.**
`accumulatedBalance` y `finalBalance` siguen siendo `Σ(income − expense + adjustment)`, porque el ajuste realmente movió el Disponible y el neto debe reconciliar. Solo cambia que el adjustment va a su propio acumulador en vez de contaminar income/expense. Invariante a testear: `finalBalance === totalIncome − totalExpense + totalAdjustment`.

**3. Convención de signo del balde.** `dailyAdjustment[d]` acumula `amount` tal cual viene firmado (positivo suma, negativo resta), y `totalAdjustment` es su suma. Así un ajuste de −$3.15M más uno de +$0.6M dan `totalAdjustment = −$2.54M`, que es exactamente lo que se muestra. La rama de income/expense para adjustment se elimina.

**4. Fila "Ajustes" condicional por `totalAdjustment !== 0`, con barra uniforme.**
Visible solo cuando hay ajustes en el mes. Para que quede visualmente uniforme con Ingresos/Gastos, se renderiza como una `FlowRow` más (dot + label + monto + barra), en color `warning`/ámbar para distinguirla. La barra comparte la escala: `maxFlow = max(totalIncome, totalExpense, |totalAdjustment|)` y el ancho usa `|totalAdjustment|` (el monto puede ser negativo, pero el ancho no). El monto se muestra firmado (la `FlowRow` ya formatea el "−"). El aviso educativo va como texto suelto debajo del bloque de barras (no repite el importe, que ya vive en la barra). Alternativa descartada: caja ámbar con importe propio + nota → rompía la uniformidad y duplicaba el monto.

**5. USD.** El mismo ruteo aplica a ambas monedas (es el mismo code path por serie). El strip USD hoy muestra "Ingresos · Gastos"; si el mes tuviera ajustes USD, el neto USD ya los refleja vía `finalBalance`. Para mantener el strip simple, NO se agrega un desglose de ajustes USD en el strip en este change; el neto USD sigue reconciliando porque `finalBalance` los incluye. (Los ajustes USD son raros; un desglose dedicado puede ser follow-up.)

## Risks / Trade-offs

- **[El neto USD del strip podría no “cuadrar” con Ingresos·Gastos USD si hay ajustes USD]** → Es el mismo comportamiento conceptual que ARS resuelve con la fila Ajustes; en ARS lo mostramos, en el strip USD lo dejamos implícito en el neto. Aceptable por rareza; documentado como follow-up.
- **[Consumidores del tipo `MonthBalanceSeries`]** → Solo se agregan campos; ningún consumidor existente rompe. `totalIncome`/`totalExpense` cambian de composición (ya no incluyen ajustes) pero mantienen su semántica declarada ("flujo real"), que es justamente la corrección buscada.
- **[Tests existentes de aggregations asumen ajustes en income/expense]** → Se actualizan en el mismo change; es parte del scope.

## Migration Plan

Sin migraciones de datos ni feature flags: es agregación de lectura + presentación. El cambio es retrocompatible a nivel tipo (campos nuevos) y se despliega con el merge normal de la branch. Rollback = revertir el commit.

## Open Questions

- ¿Mostrar también un desglose de ajustes en el strip USD? (Diferido; el neto ya reconcilia.)
- Copy de la fila "Gastos" ("Erogaciones"/algo más cálido) — fuera de scope, decisión de producto aparte.
