# Filtro por subcategoría + breakdown por subcategoría en /transactions

## Why

Hoy el módulo `/transactions` permite filtrar por categoría, y el componente "En qué se fue" (`CategorySpendingOverview`) muestra la composición del gasto agrupado por categoría. Cuando filtrás por una categoría (p. ej. "Comida"), no hay forma de ver cómo se compone ese 100% por subcategoría — ni en el panel de filtros, ni en el donut.

La subcategoría existe en el schema desde el inicio del módulo, está en el form de alta/edición, está en el detalle del movimiento, y desde el rediseño previo también es visible en cada fila del listado (`Comida › Almuerzo · Galicia`). Falta cerrar el loop: hoy ves la subcategoría en la fila pero no podés filtrar por ella, y el donut sigue mostrando "Comida 100%" cuando ya estás dentro de esa categoría — sin decirte qué subcategorías la componen.

En una sesión de exploración del owner (Cristian, mayo 2026) se decidió ir por el combo completo en un mismo change: agregar el filtro Y hacer que el donut switchee a desglose por subcategoría cuando filtrás por una sola categoría. El razonamiento: el filtro por sí solo soluciona la mitad del problema; sin el switch del breakdown, el donut deja de aportar info ("100% Comida") justo cuando más útil sería. Y agregar drill-down (click en slice de subcategoría → filtro aplicado) hace que la lectura del donut quede conectada con el listado de abajo.

Decisiones tomadas en la exploración:

1. **Auto-switch del breakdown** (no toggle manual): si filtraste por una sola categoría, lo natural es ver su composición interna. Un toggle agrega ruido para un caso que ya está implícito en el filtro.
2. **El switch se desactiva cuando `subcategoryId` también está filtrado**: ya filtraste a 1 subcategoría → mostrar "100% en X" sería absurdo. En ese caso volvemos al donut por categoría (que igual va a tener 1 sola slice, indicando que estás viendo subset).
3. **"Sin subcategoría" como bucket residual** del donut por subcategoría, no se omite, porque suma al 100% y es información útil ("este % de Comida no está clasificado").
4. **Drill-down con marker `subcategory=__none__`** para filtrar tx con `subcategory_id IS NULL`. Más explícito que un string vacío y robusto al re-parseo del URL.
5. **No se agrega un toggle de "Ver por subcategoría / Ver por categoría"** — el switch lo gobierna el estado de los filtros, no un control aparte. Si en el futuro hay pedido real, se suma sin romper este contrato.
6. **No se toca el detalle del movimiento** (la subcategoría ya se ve ahí desde el rediseño anterior) ni el form (ya guarda subcategoría).

## What Changes

### A — Filtro de subcategoría

- **ADDED** "El usuario puede filtrar por subcategoría dentro de una categoría seleccionada": agregar `subcategoryId?: string` a `MovementFilters`, parsing del URL param `?subcategory=<id>`, e incluirlo en `hasContentFilters` y `buildMovementLimitHref`.
- **ADDED** "El filtro de subcategoría aparece SOLO cuando hay una categoría seleccionada": en `movement-filters.tsx`, un select de subcategoría debajo del de categoría, alimentado por las subcategorías de la categoría activa. Cambiar la categoría limpia automáticamente la subcategoría.
- **ADDED** "Cuando hay subcategoría activa, se renderea un chip 'Subcategoría: <nombre>' con clear" en la barra de chips activos.
- **MODIFIED** la query de transactions (`queries.ts`) para aplicar `.eq('subcategory_id', filters.subcategoryId)` cuando el filtro está presente; y para el marker `__none__`, `.is('subcategory_id', null)`.

### B — El breakdown switchea a subcategoría cuando hay 1 categoría filtrada

- **ADDED** "`buildSubcategorySlices` en `@grana/money-logic`": función paralela a `buildCategorySlices` que recibe el input de transactions ya filtradas + el `categoryId` activo, y devuelve los slices por subcategoría (id + name + value + percentage), con un slice residual `{ subcategoryId: null, label: 'Sin subcategoría' }` cuando hay tx de esa categoría sin subcategoría asignada.
- **MODIFIED** "`CategorySpendingOverview` acepta `mode: 'category' | 'subcategory'`": cuando `mode='subcategory'`, el componente usa `buildSubcategorySlices` en lugar de `buildCategorySlices`, ajusta el título dinámicamente ("En qué se fue dentro de **<categoría>**"), y los slices muestran nombres de subcategoría.
- **MODIFIED** "`/transactions/page.tsx` resuelve `mode='subcategory'`" cuando hay exactamente UN `categoryId` activo Y NO hay `subcategoryId` activo. En cualquier otro caso (sin categoría, o con subcategoría también filtrada), `mode='category'`.
- **MANTIENE** el footer "Sin contar consumos en tarjeta sin pagar" y el resto del chrome del card.

### C — Drill-down: click en slice de subcategoría aplica filtro

- **MODIFIED** el href de cada slice en `CategorySpendingOverview`. Cuando `mode='subcategory'`, el href agrega `&subcategory=<id>` al URL preservando `month`, `currency`, `category`.
- **ADDED** "Slice 'Sin subcategoría' usa marker `__none__`": el href filtra por categoría y subcategoría nula. `parseMovementFilters` interpreta `subcategory=__none__` como "tx con `subcategory_id IS NULL`".

## Stakeholders

- **Producto** (Cristian): valida copy del título dinámico, auto-switch vs toggle, el marker `__none__`.
- **Diseño** (Julieta): ya validó el patrón en el listado (chevron `›`). Mismo lenguaje visual en filtros y donut.
- **Mobile** (tech lead): handoff via contracts — `MovementFilters` shape ahora incluye `subcategoryId`, `buildSubcategorySlices` está en `@grana/money-logic` (paquete compartido), y los i18n keys nuevos. La implementación mobile NO es scope de este change.

## Mobile work pendiente (handoff al tech lead)

Lo que queda disponible para mobile cuando el tech lead replique:

- **Contracts** (`@grana/money-logic`): `buildSubcategorySlices` y su input/output type ya quedan exportados — mobile puede consumirlos directo.
- **`MovementFilters`**: el campo `subcategoryId?: string` ahora forma parte del shape canónico del filtro. Mobile lo agrega a su parser de URL/params.
- **i18n keys** nuevas: `transactions.filters.subcategory`, `transactions.filters.no_subcategory`, `transactions.breakdown.title_with_category`, `transactions.breakdown.no_subcategory_slice`.

Lo que el tech lead implementa en `apps/mobile/`:

1. Sumar el filtro de subcategoría al sheet de filtros mobile (dependiente de categoría).
2. Aplicar el switch del breakdown si mobile tiene el `CategorySpendingOverview` portado.
3. Wire del drill-down si aplica.
