## Why

En Movimientos, con el desglose en "Ingresos", tocar una categoría filtra la lista por esa categoría **y** por tipo ingreso. Al volver a "Egresos" el donut cambia, pero la lista sigue filtrada por ingresos con el chip "Ingresos" puesto: el usuario ve un donut de gastos sobre una lista de sueldos y no entiende por qué. Se reprodujo en la auditoría del 5/9 con los datos de agosto de Julieta. El cambio de modo solo tocaba `overviewMode` y dejaba intactos el tipo y la categoría que el drill de ingresos había fijado; en nativo pasaba lo mismo en la vuelta a egresos.

## What Changes

- Cambiar de modo (Egresos ↔ Ingresos) descarta los filtros que puso el drill del modo anterior: tipo, categoría y subcategoría, en ambas direcciones.
- Los filtros propios del usuario se conservan: mes, moneda, búsqueda, cuenta y rango de montos.
- El límite de la lista solo se reinicia si un filtro de drill efectivamente se fue; un toggle sin drill no colapsa una lista expandida.
- Web y nativo aplican la misma regla.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `spending-by-category`: el requirement "Tocar una categoría abre sus movimientos" suma la regla de limpieza de filtros de drill al cambiar de modo, con escenario web y nativo.

## Impact

- `apps/web/lib/transactions/filters-state.ts` (`setOverviewMode`) y su test.
- `apps/mobile/components/transactions/CategorySpendingOverviewContainer.tsx` (`onSetMode`).
- Sin cambios de base, de paquetes ni de i18n.
