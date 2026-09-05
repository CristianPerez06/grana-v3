## 1. Web

- [x] 1.1 `setOverviewMode` en `filters-state.ts`: limpiar `type`, `categoryId` y `subcategoryId` al cambiar de modo; reiniciar `limit` solo si había un filtro de drill; no-op si el modo es el mismo.
- [x] 1.2 Tests del reducer: limpia el drill de ingresos al volver a egresos, conserva mes/moneda/búsqueda/cuenta/montos, no colapsa el límite sin drill, no-op al mismo modo.

## 2. Nativo

- [x] 2.1 `onSetMode` en `CategorySpendingOverviewContainer.tsx`: misma regla en ambas direcciones (`type`, `categoryId`, `subcategoryId` a null), no-op al mismo modo.

## 3. Verificación

- [ ] 3.1 Reproducir en web: Ingresos → tocar "Sueldo" → Egresos: la lista vuelve al listado general y no queda chip de tipo ni de categoría.
- [ ] 3.2 Lo mismo en nativo.
- [x] 3.3 Lint, typecheck y tests en web y nativo; archivar la change; `pnpm openspec:check`.
