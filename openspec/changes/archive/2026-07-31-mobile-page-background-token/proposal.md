## Why

`apps/mobile/global.css` contiene sólo las tres directivas `@tailwind`. Nunca declaró el bloque `:root` con las custom properties de la marca, que en web viven en `packages/ui-tokens/src/theme.css`. Como consecuencia, **toda clase de NativeWind cuyo token sea un alias queda sin color en el dispositivo**: los aliases de `@grana/ui-tokens` (`background`, `muted`, `primary`, `surface-*`, …) tienen como valor un string `var(--…)`, y sin `:root` esa variable no resuelve.

El alcance está medido compilando la config de Tailwind de mobile y filtrando las reglas emitidas cuya declaración es un `var(--…)` suelto. Sobre el código real, las clases en uso afectadas son **8 ocurrencias en 6 archivos**:

| Clase | Compila a | Usos |
| --- | --- | --- |
| `text-primary` | `var(--navy)` | 7 (`(auth)/login.tsx` ×3, `signup.tsx`, `forgot-password.tsx`, `ui/Button.tsx`, `auth/OtpVerifyForm.tsx`) |
| `text-muted-foreground` | `var(--text-muted)` | 1 (`auth/OtpVerifyForm.tsx`) |

Las clases estructurales (`bg-page`, `bg-card`, `text-text-muted`, `text-text-soft`) compilan a literales y siempre funcionaron. `bg-background` tenía 14 usos, ya corregidos.

El defecto no lo detecta `pnpm typecheck` ni `pnpm lint`, y el fallo es silencioso: el elemento no desaparece, pierde el color y cae al default. `components/ui/SkeletonBlock.tsx:50` documenta un workaround local a este mismo problema (`bg-border-soft` en lugar de `bg-muted`), señal de que ya se había topado con esto sin diagnosticar la causa.

Hay además una trampa de nombres que conviene dejar escrita: `text-muted` **no** es el token estructural `text-muted`, es el prefijo `text-` sobre el alias `muted` (un color de borde). El estructural se escribe `text-text-muted`, que es lo que el código usa correctamente.

El síntoma que disparó la investigación fue distinto y ya está resuelto: el fondo negro detrás de las esquinas `rounded-t-xl` del tab bar, causado por que nadie pintaba el window background.

## What Changes

- **Se declara el `:root` de tokens en mobile.** El codegen de `@grana/ui-tokens` (`scripts/codegen.mjs`, que ya parsea el `:root` de `theme.css` para generar `tokens.cjs`) SHALL emitir además un CSS con ese mismo bloque, que `apps/mobile/global.css` importa. Con eso los aliases resuelven en RN y **no hay que tocar ningún componente**.
- Se descarta explícitamente la alternativa de migrar las clases con alias a tokens literales (ver `design.md`).
- Se fija en spec quién pinta el fondo de la ventana en mobile (root de `app/_layout.tsx`), para que las esquinas del tab bar nunca revelen el window background nativo. **Ya implementado.**
- El root canónico de pantallas mobile en la spec `page-header` pasa de `bg-background` a `bg-page`. **Ya implementado.**
- Sin cambios de comportamiento de producto ni breaking changes.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `project-conventions`: se agrega el requirement de que `@grana/ui-tokens` sirve sus custom properties a **ambas** plataformas, y que mobile las declara vía codegen en lugar de prohibir los aliases.
- `mobile-app-shell`: se agrega el requirement de que el root layout pinta el fondo de página debajo de todo el árbol.
- `page-header`: el requirement del root de pantallas `(app)` cambia el token prescrito de `bg-background` a `bg-page`.

## Impact

- **Código pendiente**: `packages/ui-tokens/scripts/codegen.mjs` (emitir el CSS con `:root`), `packages/ui-tokens/package.json` (export del CSS generado), `apps/mobile/global.css` (importarlo).
- **Código ya implementado** (branch `bugfix/mobile-page-background-opaque`, commit `5ff1c91`): `apps/mobile/app/_layout.tsx` y 13 pantallas que usaban `bg-background`.
- **Sin impacto**: web (los aliases ya resuelven contra `theme.css`), DB, APIs, dependencias.
- **Verificación**: el pipeline está verificado offline — el CSS compilado de mobile pasado por el compilador de NativeWind (`react-native-css-interop/css-to-rn`) produce `rootVariables` con las 13 variables que las clases en uso referencian, y las reglas con alias quedan como instrucciones `var()` que resuelven contra ellas. Falta la confirmación visual en emulador, que hace el usuario.
- **Efecto visual esperado**: 8 elementos que hoy no toman color pasan a tomarlo (links de auth y label del `Button` en navy; un texto secundario en gris). No hay regresiones esperadas: ninguna clase que ya funcionaba cambia de valor.
