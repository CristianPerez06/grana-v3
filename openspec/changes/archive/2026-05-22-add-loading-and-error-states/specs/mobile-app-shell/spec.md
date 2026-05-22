## ADDED Requirements

### Requirement: El root layout provee un QueryClientProvider a toda la app

`apps/mobile/app/_layout.tsx` SHALL montar un `QueryClientProvider` de `@tanstack/react-query` que envuelva el árbol completo de la app (auth, onboarding y app autenticada). El `QueryClient` SHALL ser instanciado una sola vez por sesión de la app (típicamente con `useState(() => new QueryClient(...))` en el componente raíz para sobrevivir hot reload sin recrearse).

Configuración por defecto del cliente:

- `staleTime`: valor explícito definido en `design.md` (no usar el default `0` — provoca refetch agresivo en RN).
- `retry`: política definida en `design.md` (ej. 1 reintento en errores de red, 0 en errores de autenticación).
- `refetchOnWindowFocus`: NO aplica en RN (no hay ventana). El equivalente para mobile se cubre con el siguiente requirement (`focusManager` + `useFocusEffect`).

La versión exacta de `@tanstack/react-query` SHALL ser compatible con `react@19.1.0` (pin estricto del workspace) — la versión seleccionada se documenta en `design.md`.

#### Scenario: Toda pantalla mobile puede usar useQuery

- **WHEN** una pantalla bajo `apps/mobile/app/` invoca `useQuery({ ... })`
- **THEN** el hook resuelve sin lanzar el error "No QueryClient set, use QueryClientProvider to set one"
- **AND** las queries comparten cache a través de las pantallas

#### Scenario: El QueryClient sobrevive hot reload en desarrollo

- **WHEN** un desarrollador edita un componente y Expo aplica fast refresh
- **THEN** el `QueryClient` se mantiene (no se recrea con cada refresh)
- **AND** los datos cacheados antes del refresh siguen disponibles después

### Requirement: TanStack Query refetch on focus está integrado con Expo Router

`apps/mobile` SHALL integrar el `focusManager` de TanStack Query con el ciclo de focus de Expo Router de modo que, cuando un usuario vuelve a una pantalla previamente montada, las queries marcadas como stale se refresquen automáticamente. La integración SHALL usar el helper recomendado por la documentación de TanStack Query para React Native + Expo Router (vía `focusManager.setEventListener` enganchado al estado de foreground/background de la app y/o al evento de focus de la pantalla).

La integración SHALL ser global (configurada una sola vez en `_layout.tsx` raíz). Pantallas individuales NO SHALL implementar manualmente refetch on focus — esa responsabilidad vive en el seam, no en cada feature.

#### Scenario: Volver a una pantalla refresca queries stale

- **WHEN** un usuario navega de `(app)/dashboard` a `(app)/movimientos` y luego vuelve a `(app)/dashboard`
- **AND** el `staleTime` de las queries del dashboard se cumplió
- **THEN** las queries del dashboard se reejecutan automáticamente al volver
- **AND** el usuario ve un indicador no intrusivo de refetch (estado `isFetching` sin `isPending`)

#### Scenario: La app vuelve de background y refresca queries

- **WHEN** la app pasa de background a foreground (usuario vuelve a la app desde el switcher del SO)
- **AND** hay queries stale en pantallas montadas
- **THEN** esas queries se refrescan automáticamente
