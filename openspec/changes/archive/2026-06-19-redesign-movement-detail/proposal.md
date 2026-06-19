## Why

La pantalla de detalle de un movimiento (`/transactions/[txId]`) hoy usa el patrón editorial centrado (`TxHero` + `TxDetailGroup`/`TxDetailRow`): correcto pero plano, todos los movimientos se ven casi iguales y el detalle no le devuelve al usuario una lectura "de un vistazo" de lo que importa según el tipo (cuánto te toca pagar de un compartido, cuánto te costó neto un gasto con reintegro, cómo viene la serie de cuotas, el peso del gasto en el mes). El handoff de diseño aprobado (`detalle-movimiento/`) reemplaza eso por una anatomía fija — hero con banda tintada + grilla de "tiles de un vistazo" que cambian por tipo — manteniendo el mismo lenguaje funcional de Grana.

## What Changes

- **Rediseño visual de `GlobalTransactionDetail`** a la nueva anatomía: TOPBAR (volver + acciones), HERO (ícono de categoría, título, monto grande tonal, línea de contexto, chips fecha · medio de pago · categoría · subcategoría) y GRILLA "de un vistazo" (tiles 2-col desktop / 1-col mobile que varían por tipo; "Peso en el mes" siempre al final).
- **Tone por tipo** vía clase en el contenedor raíz: gasto → terracotta, signo `−` (U+2212); ingreso → emerald-deep, signo `+`; transferencia → slate, sin signo.
- **Tiles por tipo** (gasto-simple, cuotas, compartido, reintegro, recurrencia, ingreso, transferencia) según el README del handoff.
- **Topbar de acciones**: solo **Editar** + **Eliminar** (se reusan los handlers existentes). En mobile las secundarias colapsan a "···" y Editar pasa a una barra fija inferior (thumb-reach). **Duplicar** y **"Convertir en recurrencia"/"Ver serie"** quedan **fuera de alcance** en este change (los flujos de navegación los maneja el tech lead).
- **Datos nuevos a obtener en `page.tsx`** (reusando queries existentes): breakdown mensual por categoría / ingresos para el ring "Peso en el mes", y el detalle de recurrencia (próximo cobro, activa desde, nº de cobros, acumulado, historial 6 meses) cuando el movimiento fue generado por una regla.
- **Compartido sin estado por persona**: el modelo no guarda quién pagó por transacción, así que el tile "Dividido entre" muestra cada persona con su parte **sin** badge Te debe/Saldado. Se deja un **TODO** explícito para el estado de liquidación real.
- **BREAKING (interno)**: se retira el patrón kebab de acciones y los componentes `TxDetailGroup`/`TxDetailRow`/`TxInstallmentRows` dejan de usarse en esta pantalla (se reemplazan por los tiles). No hay cambio de API pública ni de ruta.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `transactions`: cambia la **presentación visual** de la pantalla de detalle del movimiento — nueva anatomía hero-banda + grilla de tiles por tipo, el tone por tipo en el hero (con chips y signo), y el modelo de acciones (Editar/Eliminar en topbar + barra inferior mobile en lugar de kebab). La lógica de datos por `kind`, cuotas hermanas, reintegros vinculados y back-navigation se preserva.

## Impact

- **Código web**: `apps/web/app/(app)/transactions/[txId]/page.tsx` (fetches adicionales) y `.../_components/global-transaction-detail.tsx` (rewrite de presentación). Nuevos componentes de presentación bajo `_components/detail/` (hero, chips, tiles). Reuso de `TxActionsMenu` (handlers de editar/eliminar) y del drawer de edición.
- **Datos**: reuso de `getMonthCategoryBreakdown` / `getMonthIncomeBreakdown` (peso del mes), `getRecurrenceDetail` (tile de recurrencia), `getInstallmentFamily`, `getReimbursementsForExpense`, `getMovementSharedInfo`. Sin migraciones ni cambios de schema.
- **Estilos**: se portan los valores exactos de `detalle-movimiento/panel.css` a Tailwind + tokens de `@grana/ui-tokens` (sin duplicar colores). Plus Jakarta Sans, moneda AR vía `formatARS`/`formatUSD`.
- **Sin regresiones** esperadas en lista de movimientos, alta (drawer) ni dashboard. Mobile-first; desktop es el mismo layout a 2 columnas.
- **Deuda conocida (TODO)**: estado de liquidación por persona en compartido; acciones Duplicar / Convertir en recurrencia.
