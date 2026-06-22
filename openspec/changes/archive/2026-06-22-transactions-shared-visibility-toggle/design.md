## Context

El listado global (`/transactions`) es una ruta interactiva: client shell + `FiltersProvider` (`useReducer` + context) + TanStack `useQuery` que llama al RPC `get_movements_page(p_filters jsonb, p_limit, p_offset)`. Los filtros se proyectan de `TransactionsFilters` (React state) a la forma `MovementFilters` vía `adaptFiltersForQuery`, y esa proyección es la identidad del queryKey de TanStack.

Por convención del repo, los filtros viven en React state, no en URL, y **se resetean al recargar**. El movimiento compartido ya viaja con `is_shared: boolean` desde el RPC y se marca con un chip "Compartido" en `movement-row.tsx`. No existe hoy ningún control para ocultarlos.

Decisión de producto (del usuario): el toggle arranca ON, pero **persiste por usuario** — si lo apaga, queda apagado al volver. Eso lo distingue de los filtros resetables.

## Goals / Non-Goals

**Goals:**
- Botón visible en la toolbar para mostrar/ocultar compartidos, ON por defecto.
- Persistir la elección del usuario entre sesiones/recargas.
- Cuando está OFF, el listado trae solo `is_shared = false` (filtro en el RPC, no en cliente, para que la paginación y los conteos sean correctos).

**Non-Goals:**
- No tocar mobile.
- No cambiar el esquema de tablas ni el modelo de datos del Compartido.
- No agregar un modo "solo compartidos" (es un on/off de visibilidad, no un filtro de 3 estados).
- No persistir en DB en esta iteración (queda como follow-up para cross-device).

## Decisions

### D1 — Preferencia persistida, separada de los filtros resetables
`showShared` NO se modela como un filtro-chip más (esos se resetean al recargar y aparecen como chips removibles). Se modela como una **preferencia de vista**: vive en el state de filtros para alimentar el query, pero su valor inicial se **hidrata desde `localStorage`** y cada cambio se **escribe** ahí. Default cuando no hay nada guardado: `true` (ON). No aparece como chip removible ni cuenta en el contador de "Filtros"; su estado lo refleja el propio botón. Clave sugerida: `grana:tx:showShared`.

Alternativa descartada: persistir en `settings`/DB ahora. Más robusto (cross-device) pero implica migración + lectura server; para un toggle de vista, `localStorage` es el match pragmático y consistente con "filtros en cliente". Se deja como follow-up explícito.

### D2 — Filtro en el RPC, no en cliente
Cuando `showShared = false`, `adaptFiltersForQuery` agrega `excludeShared: true` a `MovementFilters`. El RPC `get_movements_page` se recrea (nueva migración) para leer `nullif(p_filters->>'excludeShared','')::boolean` y, si es true, agregar `AND NOT t.is_shared` (tratando `is_shared` null como false) al WHERE. Filtrar en SQL —y no descartando filas en cliente— mantiene correctos la paginación (`p_limit`/`offset`) y cualquier conteo derivado. Como `excludeShared` entra en la proyección, el queryKey de TanStack ya distingue ambos estados sin tocar el cableado de cache.

### D3 — Ubicación y forma del control
Botón en la toolbar compacta de `movement-filters.tsx`, junto a buscar/recurrencias/filtros, con dos estados claros (compartidos visibles / ocultos) e ícono `Users` (el mismo del chip), `aria-pressed` para accesibilidad y label i18n. No se mezcla dentro del panel de filtros para que sea descubrible de un vistazo (intención del usuario: "un botón").

## Risks / Trade-offs

- **`localStorage` es por navegador/dispositivo** → en otro dispositivo arranca ON de nuevo. Aceptable para una preferencia de vista; follow-up: promover a `settings`.
- **Hidratación en SSR/primer render** → leer `localStorage` solo en cliente (efecto/lazy init) para evitar mismatch de hidratación; el primer paint usa el default ON hasta hidratar. Mitigación: init perezoso en el provider cliente.
- **Migración manual del RPC** → online-only; el usuario aplica el SQL en el dashboard. Mitigación: la migración recrea la función de forma idempotente (`create or replace`) preservando el resto de filtros 1:1.
- **Interacción con conteos/teasers** → el toggle afecta solo el listado de `/transactions`; el dashboard y el desglose por categoría no cambian su semántica. Confirmar que ningún otro consumidor del RPC dependa de que compartidos siempre vengan.

## Migration Plan

1. Extender tipos/estado (`MovementFilters.excludeShared`, `TransactionsFilters.showShared`) + hidratación/persistencia en el provider.
2. `adaptFiltersForQuery` proyecta `excludeShared`.
3. Nueva migración `00XX_get_movements_page_shared_filter.sql` (create or replace) con el filtro; aplicar en Supabase; regenerar types si cambia la firma (no cambia: sigue siendo `p_filters jsonb`).
4. Botón en la toolbar + i18n + wiring del controller.
5. Verificación manual + `pnpm lint`/`build`.
- Rollback: revertir branch (UI/estado) y volver a aplicar la versión previa del RPC (0039) si fuera necesario.

## Open Questions

- ¿Algún otro consumidor del RPC asume que los compartidos siempre vienen? (revisar en la primera task antes de tocar el WHERE).
