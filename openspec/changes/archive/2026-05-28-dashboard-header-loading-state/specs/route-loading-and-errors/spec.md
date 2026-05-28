## ADDED Requirements

### Requirement: Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible

`apps/web` MAY, para una ruta específica donde se justifique, reemplazar el patrón estándar de `loading.tsx` / `error.tsx` a nivel de segmento por **loading y error montados in-page**, usando `<Suspense fallback={<RouteLoading />}>` y un Client Component error boundary co-localizado. Esta alternativa SHALL usarse únicamente cuando la ruta necesita mantener visible su chrome (header, hero, navegación interna u otros elementos primarios) durante los estados de carga y error del contenido, en vez de tapar todo el segmento con un fallback de pantalla completa.

Cuando una ruta adopta este patrón:

1. Su `page.tsx` SHALL devolver un shell sync que monta el chrome más un componente "content" wrapper.
2. El wrapper de contenido SHALL envolver al async server component que hace el fetch en `<Suspense fallback={<RouteLoading />}>` para cubrir el loading.
3. El wrapper SHALL envolver además al Suspense en un Client Component error boundary (mini `Component` con `getDerivedStateFromError`) que renderiza `<RouteError error={…} onRetry={…} />` cuando el server component throw-ea. El `onRetry` SHALL resetear el state del boundary para reintentar el render.
4. La ruta SHALL seguir cubierta por el `error.tsx` del layout group para errores que ocurran fuera del wrapper (por ejemplo, durante el render del propio chrome o del shell).

Esta variante NO reemplaza al requirement de que cada layout group tenga `loading.tsx` y `error.tsx`; los reemplaza **solo para esa ruta** en lo que respecta al loading/error del contenido.

El primer caso de uso es `apps/web/app/(app)/dashboard/`, que aplica este patrón para que el header del dashboard se vea desde el primer paint y permanezca visible durante el loading y los errores de su contenido (ver requirements del header en el spec `dashboard`).

#### Scenario: El dashboard mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/dashboard` y el fetch server-side del contenido aún no resolvió
- **THEN** el header del dashboard ya está visible
- **AND** el área del contenido muestra `<RouteLoading />` (`<Spinner size="lg" />` centrado)
- **AND** el `(app)/loading.tsx` de segment-level NO tapa el header

#### Scenario: El dashboard mantiene el header durante un error del contenido

- **WHEN** el server component que renderiza el contenido del dashboard throw-ea durante el render
- **THEN** el client error boundary in-page captura el throw
- **AND** el área del contenido muestra `<RouteError error={…} onRetry={…} />`
- **AND** el header del dashboard sigue visible y funcional
- **AND** el `(app)/error.tsx` de segment-level NO se monta (porque el error fue capturado adentro)

#### Scenario: Reintentar desde el error boundary in-page vuelve a renderizar el contenido

- **WHEN** el usuario hace click en "Reintentar" en el `<RouteError>` in-page
- **THEN** el error boundary resetea su state interno
- **AND** el `<Suspense>` vuelve a intentar el render del contenido
- **AND** el usuario ve `<RouteLoading />` mientras el reintento corre

#### Scenario: Un error fuera del wrapper sigue cayendo en error.tsx del segment

- **WHEN** un error ocurre durante el render del shell de la ruta (no del wrapper de contenido) — por ejemplo, el render del propio header throw-ea
- **THEN** el `error.tsx` del layout group más cercano se monta y reemplaza el segmento completo
- **AND** ese fallback se comporta como cualquier otro `error.tsx` del layout group (regla preexistente)
