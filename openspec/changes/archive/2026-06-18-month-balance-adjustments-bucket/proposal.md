## Why

En la card "Balance del mes" del dashboard, los ajustes de saldo se cuelan dentro de "Ingresos" (ajuste positivo) y "Gastos" (ajuste negativo), inflando ambos con correcciones que no son flujo real. En datos reales de QA (usuario de primer mes, sin pagos de tarjeta), "Gastos" mostraba `$3.406.683,26` de los cuales `$3.152.222,01` eran ajustes de saldo y solo `$254.461,25` gasto real. El resultado: el "Gastos" de "Balance del mes" no coincide con el de "En qué se fue" (que sí excluye ajustes), el número es inexplicable para el usuario y no se puede drillear.

Un ajuste de saldo es una **corrección del stock** ("tenía menos plata de la que el sistema creía"), no un ingreso ni un gasto. Mezclarlo en esos baldes rompe el modelo mental y hace que "Balance del mes" y "Disponible" pierdan identidad.

## What Changes

- `buildMonthBalanceSeries` rutea los movimientos `type='adjustment'` a su **propio balde** (`totalAdjustment` neto + `dailyAdjustment` por día), en vez de mezclarlos en `totalIncome`/`totalExpense`. El saldo acumulado y el `finalBalance` **no cambian** (el ajuste sigue impactando el neto del mes, solo deja de contaminar las barras).
- El tipo `MonthBalanceSeries` gana `totalAdjustment` (neto, con signo) y `MonthBalanceDay` gana `dailyAdjustment`.
- La UI de "Balance del mes" (web + mobile) muestra una **línea "Ajustes"** con el neto del mes, visible **solo cuando hay ajustes** en el mes seleccionado (no ensucia la card de quien nunca ajusta). "Ingresos" y "Gastos" pasan a reflejar solo flujo real; "Gastos" coincide con "En qué se fue".
- Nuevo label i18n para "Ajustes" (`dashboard.month.adjustment`).
- Tests de `aggregations` actualizados para cubrir el nuevo balde y la reconciliación del neto.

No es breaking para consumidores: los campos nuevos se agregan; `totalIncome`/`totalExpense`/`finalBalance` mantienen su contrato (cambia su composición, no su forma).

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `dashboard`: el requirement "La sección 'Balance del mes' muestra el neto del mes con barras de ingresos y gastos" pasa a separar los ajustes de saldo de Ingresos/Gastos en un balde propio, mostrando una línea "Ajustes" condicional; el requirement del eye-mask incluye el monto de Ajustes entre los importes enmascarables; el requirement del package documenta los nuevos campos de la serie.

## Impact

- `packages/dashboard/src/types.ts` — `MonthBalanceSeries.totalAdjustment`, `MonthBalanceDay.dailyAdjustment`.
- `packages/dashboard/src/aggregations.ts` — `buildMonthBalanceSeries` (ruteo del balde + acumulación).
- `packages/dashboard/__tests__/aggregations.test.ts` — cobertura nueva.
- `apps/web/app/(app)/dashboard/_components/month-balance-section.tsx` — línea "Ajustes" condicional.
- `apps/mobile/components/dashboard/MonthBalanceSection.tsx` — paridad de la línea "Ajustes".
- `packages/i18n-messages/src/es.json` — key `dashboard.month.adjustment`.
- Sin migraciones ni cambios de datos: es puramente de presentación/agregación de lectura.
