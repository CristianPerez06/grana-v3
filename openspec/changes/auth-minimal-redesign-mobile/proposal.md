## Why

Las pantallas de auth de la app mobile (Expo) siguen usando el shell viejo con header navy de borde curvo (`CurvedNavyContainer`/`CurvedNavyHeader` de mobile) y **nunca muestran el logo de Grana**: el componente `GranaLogo` mobile existe pero no está cableado en ninguna pantalla. El web ya migró al shell "minimal centered card" (change `auth-minimal-redesign`). Este change lleva mobile a paridad: misma dirección de diseño, implementación nativa propia (política Web↔Mobile).

## What Changes

- Se introduce `apps/mobile/components/layout/AuthShell.tsx` (React Native): contenido centrado sobre `bg-page` con el `GranaLogo` arriba (wordmark navy / badge esmeralda), título, subtítulo y el contenido de la pantalla como `children`. Mantiene `KeyboardAvoidingView` + `ScrollView` para que el teclado no tape el form.
- Como la app mobile corre a ancho de teléfono (equivalente a "bajo `sm`" en web), el shell es **cardless**: contenido directo sobre el fondo, sin borde ni sombra de tarjeta — espejo de la rama responsive sub-`sm` del web.
- Las 6 pantallas de `(auth)` (`login`, `signup`, `forgot-password`, `signup-verify`, `recovery-verify`, `new-password`) pasan a usar `AuthShell` en lugar de `CurvedNavyContainer`.
- **BREAKING (solo visual, solo mobile):** se elimina el header navy de borde curvo; el logo pasa a verse en el shell; se quita el `showBack`/`backHref` del header (los links inline de cada pantalla ya cubren la navegación).
- Se elimina el código muerto mobile: `CurvedNavyContainer.tsx` y `CurvedNavyHeader.tsx`.
- **No cambian** handlers, llamadas a Supabase, validación, navegación ni copy. El `Button` primario mobile ya es esmeralda; `TextInput`/`FormError`/`OtpVerifyForm` se reutilizan tal cual.

## Capabilities

### New Capabilities

<!-- Ninguna: es el reskin mobile del shell de auth existente. -->

### Modified Capabilities

- `auth`: se modifica la requirement "El route group de auth tiene un layout dedicado" para que cubra **ambas plataformas** — el shell de auth (tarjeta centrada minimalista) en web y su equivalente nativo cardless en mobile, con escenarios etiquetados `(web)`/`(mobile)` donde divergen.

## Impact

- **Código (solo `apps/mobile`):**
  - Nuevo `apps/mobile/components/layout/AuthShell.tsx`.
  - Se borran `apps/mobile/components/layout/CurvedNavyContainer.tsx` y `CurvedNavyHeader.tsx`.
  - Se actualizan las 6 pantallas de `(auth)`.
- **Sin cambios** de base de datos, APIs, dependencias ni copy.
- **Dependencia / orden:** este change comparte la requirement de `auth` con el change web `auth-minimal-redesign` (todavía activo). El web SHALL archivarse primero; el delta de specs de este change contiene la versión completa final (web + mobile) de la requirement, de modo que al archivar mobile en segundo lugar quede integrada correctamente en el master spec.
