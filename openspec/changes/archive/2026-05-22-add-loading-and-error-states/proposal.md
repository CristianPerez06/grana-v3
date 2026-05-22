## Why

Hoy, al navegar entre rutas en `apps/web`, el usuario percibe la app como "trabada": la URL anterior queda en pantalla mientras Next.js resuelve el RSC payload de la nueva ruta. Las páginas son Server Components que hacen `await` server-side (queries a Supabase, cómputos del dominio), y al no existir ningún `loading.tsx` ni `error.tsx` en todo `apps/web/app/`, no hay Suspense boundary que muestre feedback durante la transición. Si una query falla, el usuario ve el error overlay genérico de Next (o nada útil en producción).

En `apps/mobile`, el patrón actual es `useState` + `useEffect`/`useFocusEffect` — solo `dashboard.tsx` lo implementa de verdad; el resto de las pantallas son placeholders. Sin una capa de fetching cliente con caching y manejo unificado de loading/error, cada feature mobile que llegue va a reinventar el mismo boilerplate (estados manuales, refetch al volver, manejo de errores ad-hoc).

Este change ataca ambos problemas y deja plantadas las bases técnicas para que toda nueva ruta — web o mobile — tenga loading + error consistentes desde el día cero, sin esfuerzo extra por feature.

## What Changes

### Web (`apps/web`)

- **Spinner** (`apps/web/components/ui/spinner.tsx`): nuevo componente primitivo con 3 variantes de tamaño (`sm` / `md` / `lg`). `sm` queda reservado para uso dentro de botones (futuro). Usa tokens existentes de `@grana/ui-tokens` (sin tokens nuevos).
- **RouteError** (`apps/web/components/ui/route-error.tsx`): componente reutilizable con copy genérica ("Algo salió mal") + botón "Reintentar" que invoca el `reset()` del error boundary de Next. Mapeo de errores a copy específica queda como mejora futura.
- **`loading.tsx` y `error.tsx` por ruta**: agregar el par en cada segmento bajo `(app)/`, `(auth)/` y `(onboarding-wizard)/`. Estrategia inicial = **opción A**: un `loading.tsx` por ruta sin Suspense granular por sección dentro de páginas (mejora futura).
- **Storybook**: stories de `Spinner` (3 variantes + estados sobre fondos `bg-card` y `bg-page`) y `RouteError`.

### Mobile (`apps/mobile`)

- **Spinner** (`apps/mobile/components/ui/Spinner.tsx`): equivalente RN con las mismas 3 variantes (`sm` / `md` / `lg`). Implementación interna (custom SVG vs `ActivityIndicator`) se decide en `design.md`. NO tiene Storybook — mobile no tiene Storybook hoy.
- **RouteError** (`apps/mobile/components/ui/RouteError.tsx`): equivalente RN del componente web.
- **TanStack Query setup**: agregar `@tanstack/react-query` a `apps/mobile/package.json`. Configurar `QueryClient` + `QueryClientProvider` en `apps/mobile/app/_layout.tsx` (root). Habilitar refetch on focus integrando `useFocusEffect` de Expo Router con `queryClient.invalidateQueries` o el helper recomendado por TanStack (`focusManager`).
- **Migrar `dashboard.tsx`**: reemplazar `useState` + `useEffect` + `useFocusEffect` por `useQuery` por sección (Hero, Balance del mes, Lo que viene, Tarjetas). Cada sección queda con su propia query → invalidación granular.

### Contratos compartidos (`packages/ui-contracts`)

- `SpinnerProps { size: 'sm' | 'md' | 'lg' }`.
- `RouteErrorProps { error: Error; onRetry: () => void }` — naming `onRetry` (no `onPress`/`onClick`) porque el callback tiene semántica de dominio explícita, no es un wrapper genérico de interacción.

### Convenciones (`openspec/specs/project-conventions/spec.md`)

- Codificar la regla: toda nueva ruta de `apps/web` (Server Component con fetch) y `apps/mobile` (pantalla con queries cliente) SHALL incluir loading + error states desde su primera entrega.

## Capabilities

### New Capabilities

- `route-loading-and-errors`: estados de carga y error a nivel de ruta, cross-platform. Define los componentes primitivos (`Spinner`, `RouteError`), sus variantes, su API compartida vía `@grana/ui-contracts`, y la regla de presencia por ruta en cada plataforma. Las divergencias por plataforma se taggean con `(web)` / `(mobile)`.

### Modified Capabilities

- `mobile-app-shell`: el root layout suma la responsabilidad de proveer un `QueryClientProvider` configurado para toda la app. Se introduce el requirement del seam de fetching cliente (TanStack Query) y la integración de refetch on focus con Expo Router.
- `project-conventions`: agrega la convención "toda nueva ruta debe entregarse con loading + error states" al conjunto de reglas transversales del repo.

## Impact

- **Código afectado (web):**
  - Nuevos: `apps/web/components/ui/spinner.tsx`, `apps/web/components/ui/route-error.tsx`, `apps/web/components/ui/spinner.stories.tsx`, `apps/web/components/ui/route-error.stories.tsx`.
  - Nuevos pares `loading.tsx` + `error.tsx` por cada ruta bajo `(app)/`, `(auth)/`, `(onboarding-wizard)/` (~25 rutas, ver `tasks.md` para el inventario).
- **Código afectado (mobile):**
  - Nuevos: `apps/mobile/components/ui/Spinner.tsx`, `apps/mobile/components/ui/RouteError.tsx`.
  - Modificar: `apps/mobile/app/_layout.tsx` (montar `QueryClientProvider`, configurar `focusManager`).
  - Modificar: `apps/mobile/app/(app)/dashboard.tsx` (migrar fetching a `useQuery`).
- **Contratos compartidos:**
  - Modificar: `packages/ui-contracts/src/index.ts` (exportar `SpinnerProps`, `RouteErrorProps`).
- **Dependencias nuevas (solo mobile):**
  - `@tanstack/react-query` (peer of `react` 19 — verificar versión compatible en `design.md`).
- **Documentación / specs:**
  - Nuevo `openspec/specs/route-loading-and-errors/spec.md` (creado al archivar).
  - Modificar `openspec/specs/mobile-app-shell/spec.md` y `openspec/specs/project-conventions/spec.md` (deltas que se aplican al archivar).
- **Riesgo bajo — react-query en mobile:** TanStack Query v5 requiere `react ≥ 18`. El repo está en `react 19.1.0` (pin estricto, ver memoria del workspace). Verificar en `design.md` que la versión elegida soporte React 19 y no introduzca un peer warning.
- **Riesgo bajo — granularidad inicial:** opción A (un loader por ruta) puede sentirse "tosca" en páginas pesadas tipo dashboard. Está aceptado como tradeoff a favor de simplicidad inicial; mejora futura con `<Suspense>` granular ya identificada como follow-up.
- **No afecta:** datos en DB, migraciones, schema, lógica de negocio existente. Es un cambio puramente de presentación + capa de fetching cliente en mobile.
