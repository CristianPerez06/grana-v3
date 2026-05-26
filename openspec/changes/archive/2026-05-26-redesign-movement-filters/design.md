## Context

El Change 1 reconstruyó la lista (`MovementList`/`MovementRow`, client) pero dejó la capa de filtros como estaba: `movement-filters.tsx`, un `<form>` server-side con siete campos en grilla y botón "Aplicar"; `parseMovementFilters` lee `q/period/type/account/category/from/to` de la URL; `getGlobalMovementsPage` resuelve esos filtros. La página `/transactions` es server: fetchea con los filtros de la URL y pasa los resultados al `MovementList` client.

Este change rediseña esa capa. Restricciones del dominio: bimoneda (el filtro por moneda solo acota la lista, nunca suma monedas), fechas contables + `getTodayAR()` para el "hoy", modo novato/experto (UI-only), estado de filtros en la URL (requirement existente).

## Goals / Non-Goals

**Goals:**
- Barra compacta (búsqueda + mes + botón Filtros) + chips de filtros activos + panel/sheet con el resto.
- Búsqueda instantánea (debounced) sobre todo el historial, sin botón "Aplicar".
- Filtro por moneda y rango de monto.
- Navegación por mes como período primario, default = mes actual.
- Mantener todo el estado en la URL.

**Non-Goals:**
- Form único / colapso de rutas (Change 3); quick-add, detalle drawer, empty states de 3 variantes (Change 4); resumen en dashboard.
- Cambiar el `MovementList`/`MovementRow` del Change 1 (solo se le pasan los filtros resueltos).
- Mobile.

## Decisions

### Decisión 1: la URL sigue siendo la fuente de verdad; la interactividad es client sobre `router.replace`

Los filtros NO se guardan en estado de componente: viven en la URL (query params). El control de búsqueda y el resto pasan a ser client (para debounce e interacción), pero su efecto es **actualizar la URL** (`router.replace`, sin recargar) — la página server re-renderiza con los nuevos `searchParams` y refetchea. Así se conserva el requirement de "filtros en la URL" (compartible, back/forward) y la búsqueda se siente instantánea sin un botón "Aplicar".

- **Alternativa descartada**: fetch client con TanStack Query y estado local. Rompe el "estado en URL" y duplica la lógica de fetch que ya vive en la página server. `router.replace` debounced es más simple y respeta el modelo actual.

### Decisión 2: búsqueda sobre todo el historial

La búsqueda de texto DEBE encontrar coincidencias en todo el historial del usuario, no solo en lo paginado. `getGlobalMovementsPage` ya filtra server-side recorriendo chunks hasta llenar la página; se mantiene/asegura ese comportamiento para que la búsqueda no "esconda" resultados existentes. El debounce (~300ms) es solo para no disparar una navegación por tecla.

### Decisión 3: período por mes (`month=YYYY-MM`), default mes actual

El control de período pasa a navegación por mes. Se introduce un parámetro `month=YYYY-MM`; la página deriva `from`/`to` (primer y último día del mes) y los pasa a la query. Si no hay `month` en la URL, default al **mes actual** computado con `getTodayAR()` (no `new Date()`). Las flechas ‹ › navegan a `month` ∓ 1. Se conserva un rango personalizado (`from`/`to` explícitos) para casos avanzados, que tiene prioridad sobre `month` si está presente.

- **Trade-off**: cambia el comportamiento por defecto (antes la lista mostraba todo). Es intencional: la navegación por mes como eje primario implica una vista mensual por defecto, alineada con el dashboard.

### Decisión 4: "filtros de contenido" vs "navegación temporal" para el running balance

El running balance de la vista de cuenta (Change 1) se oculta cuando hay filtros que harían incorrecto un acumulado parcial. Se distingue:
- **Navegación por mes**: NO oculta el saldo corriente. Se sigue mostrando, recalculado sobre el historial completo previo al mes visible (la query de la cuenta trae el historial para el running balance; el mes solo acota qué filas se muestran).
- **Filtros de contenido** (tipo, categoría, búsqueda de texto, rango de monto): SÍ ocultan el saldo corriente, porque saltean filas y el acumulado mentiría.

### Decisión 5: chips y contador derivados del estado de la URL

Los chips de filtros activos y el contador del botón "Filtros" se derivan de los params presentes en la URL (no de estado aparte). Quitar un chip = quitar ese param y `router.replace`. "Limpiar todo" = volver a la URL base (solo `month` actual). Mantiene una sola fuente de verdad.

## Risks / Trade-offs

- **[Default mes actual oculta movimientos viejos por defecto]** → Es el comportamiento deseado (vista mensual), pero hay que asegurar que la navegación ‹ › y el rango custom sean descubribles para llegar al historial. Mitigación: las flechas siempre visibles en la barra.
- **[Búsqueda que dispara navegaciones por tecla]** → Debounce ~300ms + `router.replace` (no `push`, para no llenar el historial del browser).
- **[Doble control de período si quedara algo del dropdown viejo]** → Se elimina el dropdown de período; el mes es el único control primario (+ rango custom en el panel). No coexisten.
- **[Interacción con la paginación "cargar más"]** → Al cambiar cualquier filtro/mes, el límite de paginación se resetea (no acumular resultados de filtros distintos).

## Open Questions

- ¿El rango de monto filtra por el monto mostrado (abs, en la moneda del movimiento) o requiere también elegir moneda? Probablemente abs + opcionalmente combinable con el filtro de moneda; a confirmar en implementación.
- ¿El panel de filtros es un sheet (drawer) en mobile-web y un popover en desktop, o el mismo componente en ambos? Decisión de presentación a coordinar con el tech lead.
