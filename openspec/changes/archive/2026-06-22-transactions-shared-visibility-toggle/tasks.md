## 1. Investigación previa

- [x] 1.1 Confirmar que ningún otro consumidor de `get_movements_page` asume que los compartidos siempre vienen (solo `getGlobalMovementsPage` lo llama; `adaptFiltersForQuery` lo comparten `/transactions` y `accounts/[id]`, pero el toggle es prop-opcional y solo lo pasa el container global)
- [x] 1.2 Confirmar el nombre/firma exacta de la columna `is_shared` en el SELECT base del RPC vigente (0039) — viaja vía `to_jsonb(t)`

## 2. Capa de datos (RPC)

- [x] 2.1 Crear migración `0042_get_movements_page_exclude_shared.sql` con `create or replace` del RPC: leer `coalesce((p_filters->>'excludeShared')::boolean, false)` y agregar `and (not f.exclude_shared or not coalesce(t.is_shared, false))` al join; resto idéntico a 0039
- [ ] 2.2 **(usuario)** Aplicar el SQL en el proyecto Supabase (online) — pegar `0042_*.sql` en el SQL Editor; verificar que el resto de filtros sigue funcionando
- [x] 2.3 Regenerar types solo si cambia la firma → no cambia (sigue `p_filters jsonb`), no hace falta

## 3. Estado y proyección de filtros

- [x] 3.1 Agregar `excludeShared?: boolean` a `MovementFilters` (`filters.ts`)
- [x] 3.2 Agregar `showShared: boolean` a `TransactionsFilters` + acción `setShowShared` en el reducer (`filters-state.ts`); default `true` en `createInitialFilters`
- [x] 3.3 Persistir en `localStorage` (`grana:tx:showShared`): hidratación en mount + escritura en el handler del toggle (solo cliente)
- [x] 3.4 En `adaptFiltersForQuery`, proyectar `excludeShared: true` cuando `showShared === false`; reenviar al RPC en `queries.ts`
- [x] 3.5 `showShared` NO entra en `hasActiveContentFilters` ni en los chips (verificado con test)

## 4. UI del toggle

- [x] 4.1 Botón en la toolbar de `movement-filters.tsx` (ícono `Users`, dos estados con `aria-pressed`, label i18n) como prop opcional `sharedToggle`
- [x] 4.2 Cablear `sharedToggle` (active + onToggle) en `movement-filters-container.tsx` (global only; el container de cuenta no lo pasa)
- [x] 4.3 Keys i18n `filters.show_shared` / `filters.hide_shared` en `@grana/i18n-messages` (en + es)

## 5. Verificación y cierre

- [x] 5.0 `pnpm lint`, `pnpm typecheck`, `pnpm test` (410, +5 nuevos) y `pnpm build` (web) en verde
- [x] 5.1 **(usuario)** Recorrido manual: default ON muestra compartidos; apagar los oculta y reconsulta; recargar mantiene la preferencia; reactivar los vuelve a mostrar; el toggle no aparece como chip (QA del usuario OK; migración 0042 aplicada)
- [x] 5.2 **(usuario)** Verificar paginación correcta con el toggle OFF (no quedan huecos por filtrado en cliente)
- [x] 5.3 Verificar que el detalle de cuenta (`accounts/[id]`) NO muestra el toggle y sigue trayendo compartidos
- [x] 5.4 Archivar el change en la branch (mover a `archive/`, integrar el requirement en `openspec/specs/transactions/spec.md`, `pnpm openspec:check` en verde) antes del merge
