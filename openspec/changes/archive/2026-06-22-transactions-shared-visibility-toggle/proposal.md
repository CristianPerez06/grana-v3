## Why

En el módulo Movimientos, los gastos compartidos (del módulo Compartido) aparecen siempre mezclados con el resto del historial, marcados solo con un chip "Compartido". En QA de producción se pidió poder enfocarse en los movimientos propios escondiéndolos a voluntad. Hoy no hay forma de ocultarlos.

## What Changes

- Nuevo botón en la toolbar del listado global de movimientos (junto a buscar/filtros) que activa/desactiva la visibilidad de los movimientos compartidos (`is_shared = true`).
- El botón arranca **ON** (compartidos visibles, igual que hoy). Si el usuario lo apaga, los compartidos dejan de mostrarse en el listado **y la preferencia se persiste por usuario**: al volver a entrar sigue apagado hasta que el usuario lo reactive. A diferencia de los filtros (que se resetean al recargar), esta preferencia sobrevive a la recarga.
- El RPC `get_movements_page` acepta un flag para excluir compartidos; cuando el toggle está OFF, el listado consulta solo movimientos no compartidos.
- Scope solo web. Mobile lo maneja el tech lead.

## Capabilities

### Modified Capabilities
- `transactions`: el listado global gana un control de visibilidad de movimientos compartidos (botón en la toolbar, ON por defecto, persistido por usuario) que filtra `is_shared`. Modifica el requirement de búsqueda y filtros.

## Impact

- **UI:** `apps/web/lib/transactions/components/movement-filters.tsx` (botón en la toolbar) + i18n labels.
- **Estado/controller:** `apps/web/lib/transactions/filters-state.ts` (preferencia `showShared` + hidratación/persistencia en `localStorage`), su controller en `movement-filters-container.tsx`, y `adaptFiltersForQuery` (proyecta `excludeShared` cuando `showShared = false`).
- **Query:** `apps/web/lib/transactions/filters.ts` (`MovementFilters` gana `excludeShared?`), consumo en `queries.ts`/`movement-list-container.tsx` (entra naturalmente vía el queryKey existente).
- **DB:** nueva migración que recrea `get_movements_page` agregando el filtro `excludeShared` (aplicada a mano en Supabase, online-only). Sin cambios de esquema de tablas.
- **Persistencia:** preferencia UI-only en `localStorage` (no toca el ledger ni `account_currencies`); se documenta como follow-up la opción de promoverla a `settings` para cross-device.
