## Why

Hasta ahora, al navegar al Dashboard la app mostraba sólo un spinner a pantalla completa hasta que terminaba el fetch server-side de todas las secciones. La sensación era de "pantalla vacía", aunque el header (saludo, fecha, eye toggle, "Nuevo movimiento") podía pintarse mucho antes. Queremos que el header se vea desde el primer paint, con los botones en estado disabled mientras la data del usuario y del contenido todavía no resolvió, y que el spinner/error vivan sólo en el área del contenido. Esto da contexto inmediato al usuario y prepara el camino para que cada sección del Dashboard pase a fetchear su propia data como cliente.

## What Changes

- `dashboard/page.tsx` deja de ser un async server component con `Promise.allSettled` y pasa a ser un shell sync: `EyeMaskProvider` + `<DashboardHeader>` + `<DashboardContent>` + `<QuickAddFab>`.
- `DashboardHeader` ahora es un client component que **se fetchea su propio `full_name`** vía el cliente browser de Supabase (`apps/web/lib/supabase/client.ts`). Mientras la query del nombre está en curso, el header se renderiza en estado disabled: saludo anon ("Hola."), `EyeMaskToggle` deshabilitado y "Nuevo movimiento" como `<Button disabled>` (sin `<Link>`).
- Se introduce `DashboardContent` (server component) que envuelve el fetching existente del body del Dashboard en un `<Suspense fallback={<RouteLoading />}>` y un `DashboardErrorBoundary` (client class). Así el header sigue visible durante loading y error del contenido en vez de ser tapado por `(app)/loading.tsx` / `(app)/error.tsx`.
- `EyeMaskToggle` deja de ser un `<button>` artesanal y pasa a usar el UI `<Button variant="ghost" size="icon" />`.
- Se agrega la size `'icon'` al contrato `ButtonSize` en `@grana/ui-contracts` y a las dos implementaciones (web `apps/web/components/ui/button.tsx`, mobile `apps/mobile/components/ui/Button.tsx`). En web la size aplica `h-9 w-9 p-0 rounded-full` sobreescribiendo el `w-full` y el radius `lg` del base. En mobile la size queda equivalente para mantener el contrato cross-platform, aunque no hay call-sites mobile todavía.

No es un cambio breaking visible para el usuario (la UI final es la misma); sí cambia el contrato de `DashboardHeader` (antes recibía `name` y `todayISO`, ahora sólo `todayISO`) y suma una size al contrato compartido del Button.

## Capabilities

### New Capabilities
<!-- No nuevas capabilities; el cambio reusa specs existentes. -->

### Modified Capabilities
- `dashboard`: el header del Dashboard ahora tiene un estado intermedio (disabled + saludo anon) mientras el cliente resuelve el nombre del perfil; el eye toggle y el botón "Nuevo movimiento" siguen montados pero disabled durante ese estado.
- `route-loading-and-errors`: se permite, como alternativa al par `loading.tsx`/`error.tsx` a nivel de segmento, montar loading y error in-page vía `<Suspense>` + un client error boundary cuando una ruta quiere mantener su chrome (header u otros elementos primarios) visible durante loading/error del contenido. El Dashboard es el primer caso de uso.

## Impact

- **Código afectado (web)**:
  - `apps/web/app/(app)/dashboard/page.tsx`
  - `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx`
  - `apps/web/app/(app)/dashboard/_components/eye-mask-toggle.tsx`
  - `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx` (nuevo)
  - `apps/web/app/(app)/dashboard/_components/dashboard-error-boundary.tsx` (nuevo)
  - `apps/web/components/ui/button.tsx`
  - `apps/web/components/ui/button.stories.tsx`
- **Código afectado (mobile)**:
  - `apps/mobile/components/ui/Button.tsx` (extensión de `containerSize`/`textSize` para `'icon'`; sin call-sites todavía)
- **Contratos compartidos**:
  - `packages/ui-contracts/src/index.ts`: `ButtonSize = 'sm' | 'md' | 'lg' | 'icon'`.
- **Loading/error model**: el Dashboard ya no depende de `(app)/loading.tsx` para su loading principal — usa Suspense in-page. `(app)/error.tsx` sigue siendo el catch-all de último recurso.
- **Data fetching**: el nombre del usuario pasa de fetch server-side (página) a fetch client-side (header). Una request adicional desde el browser, pero el header queda independiente del resto del contenido y prepara el patrón de "cada sección se fetchea sola".
- **No afecta**: i18n, eye mask semantics, transacciones, accounts/cards/settings.
