## Why

Los filtros del módulo global de Movimientos son **siete inputs crudos siempre desplegados en grilla** (búsqueda, período, tipo, cuenta, categoría, desde, hasta) con un botón "Aplicar": saturan visualmente y obligan a un submit para cada búsqueda. En una app que se usa para escanear y encontrar movimientos rápido, eso es fricción.

Además faltan dos cosas que el dominio pide: **no hay filtro por moneda** (siendo Grana bimoneda) y el control de período es un dropdown poco fluido, cuando lo natural para revisar finanzas es **navegar mes a mes**.

Este change (Change 2 del rediseño de Movimientos, sobre el Change 1 que reconstruyó la lista) rediseña la capa de filtros: barra compacta, búsqueda instantánea, chips de lo activo, y navegación por mes como eje temporal.

## What Changes

- **Barra de filtros compacta**: búsqueda + navegación por mes ‹ › + botón "Filtros" con contador de filtros activos. El resto se mueve a un **panel/sheet** desplegable (tipo, categoría, cuenta, moneda, rango de monto).
- **Chips de filtros activos** debajo de la barra, cada uno con ✕ para quitarlo, más "Limpiar todo".
- **Búsqueda instantánea** (debounced ~300ms) que filtra mientras se tipea y busca en **todo el historial**, no solo en lo paginado. **BREAKING** (UX): se elimina el botón "Aplicar".
- **Filtro por moneda** (ARS / USD / ambas) como un filtro más del panel.
- **Navegación por mes ‹ ›** como control de período primario, reemplazando el dropdown. **BREAKING** (comportamiento): la vista por defecto pasa a mostrar el **mes actual** (hoy muestra todo el historial); se conserva un rango personalizado para casos avanzados. El mes actual se computa con `getTodayAR()`.
- **Modo novato**: el filtro "Cuenta" no se muestra (las cuentas default están ocultas).
- Todos los filtros siguen **representados en la URL** (compartible, recargable, back/forward).
- **Running balance** (vista de cuenta, del Change 1): navegar por mes **no** lo oculta (es navegación temporal, se recalcula con el historial previo); solo lo ocultan los filtros de contenido (tipo, categoría, búsqueda, monto).

## Capabilities

### Modified Capabilities
- `transactions`: cambia el comportamiento observable de **búsqueda y filtros del módulo global** (barra compacta + chips + panel, búsqueda instantánea sobre todo el historial, filtro por moneda, rango de monto, navegación por mes con default = mes actual, filtro de cuenta oculto en novato) y precisa la interacción del **running balance** con la navegación por mes (la navegación temporal no oculta el saldo corriente; sí los filtros de contenido).

## Impact

- **Web — componentes**: se reescribe `movement-filters.tsx` (de grilla server-form a barra compacta client + panel/sheet + chips). Nuevo control de navegación por mes. La búsqueda pasa a client interactivo (debounced) que actualiza la URL; la página (server) sigue resolviendo los filtros desde la URL y refetcheando (`getGlobalMovementsPage`).
- **Web — filtros/parseo**: `parseMovementFilters` y `MovementFilters` (en `filters.ts`) suman `currency` y `amountMin`/`amountMax`; el período pasa a derivarse del mes seleccionado (`month=YYYY-MM`) con default al mes actual (`getTodayAR`), manteniendo rango custom.
- **Web — query**: `getGlobalMovementsPage` filtra por moneda y rango de monto; la búsqueda de texto se asegura sobre todo el historial (no solo la página). La vista de cuenta (`/accounts/[id]`) aplica los filtros de contenido y oculta el running balance cuando hay alguno activo (la navegación por mes no).
- **i18n**: claves nuevas para los meses / navegación, etiquetas de filtros (moneda, monto), "Filtros", "Limpiar todo", chips.
- **Sin migraciones de base**: es presentación + parámetros de query.
- **Sin cambios en mobile**: lo maneja el tech lead.
- **Se apila sobre el Change 1** (`rebuild-movement-list`): debe mergearse después de él.
- **Fuera de alcance**: form único + colapso de rutas (Change 3); quick-add/FAB, detalle drawer, empty states de 3 variantes (Change 4); resumen por moneda en el dashboard.
