## Why

Las pantallas de autenticación usan hoy un shell con header navy de borde curvo (`CurvedNavyContainer`) que se aleja del lenguaje que ya describe el propio spec de `auth` ("card centrada sobre un fondo limpio") y de la marca Grana renovada. Un shell de "tarjeta centrada minimalista" alinea la puerta de entrada del producto con la marca (el logo como único momento de display, un solo acento esmeralda) y con el spec, manteniendo la calma y la confianza que pide una app de finanzas.

## What Changes

- Se introduce el componente `AuthShell`: una tarjeta blanca centrada verticalmente sobre `bg-page`, con el `GranaLogo` centrado (wordmark navy / badge esmeralda), título, subtítulo y el formulario como `children`.
- Comportamiento responsive: la tarjeta se vuelve sin borde y a todo el ancho bajo `sm` (cardless en mobile) y se muestra como tarjeta con hairline + sombra suave en `sm+`.
- Las 6 rutas del grupo `(auth)` (`/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/forgot-password/verify`, `/reset-password`) se renderizan dentro de `AuthShell` en lugar de `CurvedNavyContainer`.
- **BREAKING (solo visual):** se elimina el header navy de borde curvo; el logo pasa a vivir dentro de la tarjeta; se quita el chevron de "volver" del header (los links inferiores ya cubren la navegación).
- Se elimina el código muerto resultante: `CurvedNavyContainer` y `CurvedNavyHeader`.
- **No cambian** comportamientos, server actions, validación, claves i18n ni los componentes de UI compartidos. El `Button` primario ya es esmeralda; `Input`/`FormField`/`PasswordField` se reutilizan tal cual. El signup conserva sus 4 campos reales.
- Las referencias de diseño de Paper (PNG/SVG/JSX) se versionarán bajo `design-refs/` cuando se reponga la cuota de Paper (dirección "minimal centered card" ya aprobada por el usuario).

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva: es un reskin del shell existente. -->

### Modified Capabilities

- `auth`: se modifica la requirement "El route group de auth tiene un layout dedicado" para especificar el shell de tarjeta centrada minimalista (logo + título + subtítulo dentro de la tarjeta, comportamiento responsive cardless-en-mobile), reemplazando el header navy de borde curvo. No cambia ninguna otra requirement de `auth` (registro, login, OTP, recovery, middleware permanecen idénticos).

## Impact

- **Código (solo `apps/web`):**
  - Nuevo `apps/web/components/layout/auth-shell.tsx`.
  - Se borran `apps/web/components/layout/curved-navy-container.tsx` y `curved-navy-header.tsx`.
  - Se actualizan los 6 `page.tsx` del grupo `(auth)` para usar `AuthShell`.
  - Posible ajuste menor de `apps/web/lib/auth-class-names.ts` (estilos de input sobre tarjeta blanca).
- **Sin cambios** de base de datos, migraciones, APIs, dependencias ni claves i18n.
- **Fuera de alcance:** la paridad del shell de auth en la app mobile (Expo) queda como follow-up; este change es solo web.
