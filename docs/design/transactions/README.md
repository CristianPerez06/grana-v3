# Propuesta visual `/transactions`

## Contexto

Esta propuesta aplica el sistema visual documentado en `docs/design/route-ui-system.md` a la ruta web `/transactions`. La ruta real es una pantalla interactiva con shell cliente, filtros en estado React y TanStack Query; no es una ruta RSC de secciones server.

La app mobile hoy solo tiene un placeholder en `apps/mobile/app/(app)/transactions.tsx` con `PageHeader` y `QuickAddFab`. El mock mobile de este bundle es una referencia de paridad futura, no evidencia de una implementación nativa existente.

## Implementacion inspeccionada

- `apps/web/app/(app)/transactions/page.tsx`
- `apps/web/app/(app)/transactions/layout.tsx`
- `apps/web/app/(app)/transactions/_components/transactions-header.tsx`
- `apps/web/app/(app)/transactions/_components/transactions-content.tsx`
- `apps/web/app/(app)/transactions/_components/category-spending-overview-container.tsx`
- `apps/web/app/(app)/transactions/_components/pending-recurrences-block-container.tsx`
- `apps/web/app/(app)/transactions/_components/pending-reimbursements-block-container.tsx`
- `apps/web/app/(app)/transactions/_components/recurrence-suggestion-banner-container.tsx`
- `apps/web/app/(app)/transactions/_components/movement-filters-container.tsx`
- `apps/web/app/(app)/transactions/_components/movement-list-container.tsx`
- `apps/web/lib/transactions/components/category-spending-overview.tsx`
- `apps/web/lib/transactions/components/movement-filters.tsx`
- `apps/web/lib/transactions/components/movement-list.tsx`
- `apps/web/lib/transactions/components/movement-row.tsx`
- `apps/web/lib/transactions/components/pending-reimbursements-block.tsx`
- `apps/web/lib/recurrences/components/pending-recurrences-block.tsx`
- `apps/web/lib/recurrences/components/recurrence-suggestion-banner.tsx`

## Datos disponibles

- Titulo de ruta: `transactions.title`.
- Link a recurrencias: `/transactions/recurring`.
- Accion primaria: `RegisterMovementButton`, abre el drawer cuando `accounts`, `categories` y `household` estan listos.
- FAB mobile web: `QuickAddFab`, abre el mismo drawer.
- Sugerencia de recurrencia condicional: tipo de movimiento, cuenta origen, cuenta destino cuando aplica, categoria, moneda, monto, frecuencia, fecha inicial, descripcion y cantidad de ocurrencias usadas como base.
- Reintegros pendientes condicionales: descripcion/categoria, icono/color de categoria, target, cuenta, monto estimado, moneda, fecha base, inputs de monto real y fecha real, confirmar/cancelar.
- Recurrencias pendientes condicionales: descripcion/categoria/tipo, cuenta origen, cuenta destino cuando aplica, monto, moneda, frecuencia, fecha programada, urgencia, edicion inline de monto/fecha/descripcion, confirmar/saltar, warning de saldo negativo.
- Overview mensual: mes, navegacion prev/next, modo `egresos` / `ingresos`, moneda ARS/USD cuando hay actividad USD, donut, total del breakdown actual, ranking top 5, resto agregado, empty por modo y nota off-ledger en egresos.
- Filtros de movimientos: busqueda, link a recurrencias, sheet de filtros, chips activos, tipo, categoria, subcategoria, cuenta si hay 2+ cuentas, moneda, monto minimo/maximo, limpiar/aplicar.
- Lista de movimientos: grupos por fecha, descripcion/categoria/tipo, subtitulo por taxonomia/cuenta/contraparte, monto con signo, moneda USD secundaria, badges de cuotas, recurrencia, revision, compartido y estado de reintegro, link a detalle si existe, cargar mas.
- Estados: loading de filtros/lista, empty sin movimientos, empty por busqueda, empty por filtros, error inline de lista.

## Direccion propuesta

Desktop:

- Subir el ancho de ruta de `max-w-3xl` a un ancho operativo cercano a `1080px`, igual que dashboard/cards detail.
- Mantener `PageHeader` simple: titulo, link a recurrencias y CTA primaria. No convertirlo en hero ni agregar metricas.
- Usar layout de dos columnas solo para organizar bloques ya existentes: columna principal para overview + toolbar + ledger; columna lateral para bloques condicionales de accion inmediata (`sugerencia`, `recurrencias`, `reintegros`).
- Mantener el overview como el unico resumen visual de la pagina. No agregar totales de ingresos/gastos fuera de ese componente.
- Acercar la toolbar a la lista, no al header. Los filtros actuan sobre el ledger.
- Darle a la lista una superficie de ledger consistente con `/accounts/[id]`: filas compactas, grupos por fecha, montos tabulares y badges que no compitan con el importe.

Mobile web:

- Una sola columna.
- Header compacto + FAB para registrar movimiento.
- Los bloques condicionales van arriba del overview porque son tareas pendientes.
- Overview apilado: selector de mes, modo/moneda, donut y ranking en una unica card.
- Toolbar iconica pegada al ledger.
- Filas con titulo/subtitulo arriba y monto debajo, para evitar comprimir textos largos con importes.

## Recomendaciones de implementacion

- Cambiar el shell de `transactions/layout.tsx` de `max-w-3xl` a un ancho operativo similar a dashboard/cards, por ejemplo `max-w-[1080px]`.
- Introducir un contenedor visual en `TransactionsContent` para poder ordenar main/side sin alterar queries ni estado.
- No crear nuevas queries, totales o indicadores.
- En `MovementFilters`, los campos de monto minimo/maximo hoy usan `Input type="number"`. AGENTS.md exige `MoneyAmountInput` para campos monetarios; conviene corregirlo durante la implementacion visual.
- En `PendingReimbursementsBlock`, los botones inline hoy estan estilados a mano. Si se toca ese bloque, migrarlos a `Button` para cumplir la regla de acciones.
- En `RecurrenceSuggestionBanner` y `PendingRecurrencesBlock` tambien hay botones estilados inline. No hace falta redisenar comportamiento, pero si se editan esas superficies conviene componer `Button`.
- La paridad mobile nativa requiere una propuesta/implementacion separada porque la ruta mobile actual es placeholder.

## Archivos del bundle

- `shared.css`
- `web/transactions.html`
- `mobile/transactions.html`
- `components/route-shell.html`
- `components/transactions-header.html`
- `components/recurrence-suggestion-banner.html`
- `components/pending-recurrences-block.html`
- `components/category-overview.html`
- `components/pending-reimbursements-block.html`
- `components/movement-toolbar.html`
- `components/filter-sheet.html`
- `components/movement-row.html`
- `components/movement-list.html`
- `components/empty-state.html`
- `components/loading-state.html`
- `components/error-state.html`
- `components/quick-add-fab.html`

