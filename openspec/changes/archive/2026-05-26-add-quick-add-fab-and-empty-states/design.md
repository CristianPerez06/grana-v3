## Context

Tras los Changes 1/2/3 el módulo Movimientos tiene la lista (`MovementList`/`MovementRow`), los filtros con navegación por mes y búsqueda instantánea (`MovementFilters` + `parseMovementFilters`/`hasContentFilters` en `filters.ts`), y el form único en rutas canónicas. Quedan dos fricciones de UX:

- El alta se dispara sólo desde headers (`/transactions` y dashboard tienen botón "Registrar"; cuenta/tarjeta tienen CTA). No hay acceso flotante.
- `MovementList` tiene **un solo** empty state (`empty.title` + `list.global_empty_description`) que se muestra siempre que `movements.length === 0`, sin importar si hay búsqueda o filtros activos.

`MovementFilters` ya expone `query`, `type`, `categoryId`, `accountId`, `currency`, `amountMin/Max`, `month`/`from`/`to`. `hasContentFilters(filters)` = `query || type || categoryId || amountMin/Max` (la moneda y el mes NO son filtros de contenido). El dashboard envuelve su árbol en `<EyeMaskProvider>`; un FAB `position: fixed` se monta como hermano sin afectar el layout.

## Goals / Non-Goals

**Goals:**
- FAB de alta en Movimientos y dashboard → `/transactions/new`.
- Tres empty states del listado global según el motivo del vacío, cada uno con su acción.
- Reusar el estado de filtros en la URL (Change 2) para las acciones "limpiar".

**Non-Goals:**
- Detalle como drawer/bottom-sheet (Change 5).
- Resumen por moneda en el dashboard.
- Mobile (lo maneja el tech lead).
- Cambiar la lógica de filtros/búsqueda del Change 2 (sólo se lee el estado para decidir la variante).

## Decisions

### Decisión 1: FAB por-pantalla, no en el shell

El FAB se muestra sólo en Movimientos y dashboard (decisión del usuario), no en toda la app. Como son dos pantallas, se monta un componente `QuickAddFab` en cada una en vez de meterlo en el layout del shell con lógica de "¿en qué ruta estoy?". Es un `Link` a `/transactions/new` con `position: fixed` (esquina inferior), ícono `Plus` y `aria-label`. Coexiste con el botón "Registrar" del header: el header es el acceso "formal" arriba; el FAB es el acceso a mano mientras se scrollea. El tech lead define los estilos exactos.

- **Alternativa descartada**: FAB global en el shell con gating por ruta. Más acoplamiento por sólo dos pantallas; si en el futuro se quiere global, se promueve.

### Decisión 2: la página decide el motivo del vacío; `MovementList` lo renderiza

`MovementList` no conoce los filtros (recibe `movements` ya resueltos). La página `/transactions` —que sí parsea los filtros— calcula la **variante de vacío** y se la pasa. Variantes y precedencia:

1. `filter` — si hay **otros filtros de contenido** activos (tipo, categoría, cuenta, moneda, rango de monto). Acción: "limpiar filtros".
2. `search` — si no hay otros filtros pero hay **término de búsqueda** (`query`). Acción: "limpiar búsqueda".
3. `none` — sin búsqueda ni filtros de contenido. Mensaje de bienvenida + CTA "registrar el primero" → `/transactions/new`.

Precedencia `filter > search > none`: si coexisten búsqueda y filtros, el mensaje habla de filtros (la acción de limpiar filtros es la más probable para recuperar resultados; limpiar búsqueda queda como chip del Change 2). La **navegación por mes** no cuenta como filtro para esto (es una ventana temporal; un mes sin movimientos y sin otros filtros es `none`). La **moneda sí cuenta** acá, a diferencia de `hasContentFilters` (que la excluye para el running balance): un USD sin resultados es un "filtro sin resultados", no "sin movimientos". Divergencia intencional — distinta finalidad. Se necesita separar `query` del resto, así que se agrega `hasSearch` y `hasOtherContentFilters` (tipo/categoría/cuenta/moneda/monto).

`MovementList` recibe un prop opcional `emptyState?: { variant: 'none' | 'search' | 'filter'; addHref?: string; clearHref?: string; query?: string }`. Sin el prop (p. ej. otros consumidores) cae al comportamiento actual (`none`).

### Decisión 3: las acciones "limpiar" navegan a una URL saneada (reusan el modelo del Change 2)

El estado de filtros vive en la URL (Change 2). "Limpiar filtros" = navegar a la URL sin los params de contenido (conservando el mes actual); "limpiar búsqueda" = quitar `q`. La página arma esos hrefs (server) y los pasa en `emptyState`. La empty-state los renderiza como `Link`/botón. Mantiene una sola fuente de verdad (la URL) y no duplica lógica de filtros en el componente.

### Decisión 4: la vista de cuenta conserva su empty "registrá el primero"

`/accounts/[id]` también usa `MovementList`. Su estado vacío ya está especificado (CTA para agregar la primera transacción en esa cuenta). Se mantiene: la vista de cuenta pasa `emptyState={{ variant: 'none', addHref: '/transactions/new?account=<id>&from=account:<id>' }}` (cuando no hay filtros de contenido) y, si hay filtros de contenido activos, la variante `filter`. Sin cambios de fondo, sólo se canaliza por el mismo prop.

## Risks / Trade-offs

- **[FAB redundante con el botón del header]** → Es intencional (alcance al pulgar mientras se scrollea). Si molesta, el tech lead puede ocultar el botón del header en mobile y dejar sólo el FAB.
- **[El FAB tapa contenido al final de la lista]** → El tech lead agrega padding inferior / safe-area en las pantallas con FAB.
- **[Variante mal clasificada cuando coexisten búsqueda + filtros]** → Precedencia explícita `filter > search > none`; los chips del Change 2 siguen mostrando todo lo activo, así que el usuario ve y puede quitar cada filtro individualmente igual.
- **[Mes vacío confundido con "sin movimientos nunca"]** → La variante `none` es "no hay movimientos en esta vista"; el copy puede ser neutro ("no hay movimientos para mostrar") + CTA registrar, sin afirmar que el usuario nunca cargó nada.

## Open Questions

- ¿El copy de `none` debería ser sensible al mes ("no hubo movimientos en <mes>") o genérico? Se resuelve al redactar las claves i18n; no cambia la estructura.
- ¿El FAB usa un contract compartido `@grana/ui-contracts` desde ya, o se deja web-only hasta que el tech lead haga la paridad mobile? Por defecto web-only (mobile fuera de alcance); si conviene, se extrae el contract al portarlo.
