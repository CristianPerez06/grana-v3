## Why

`apps/mobile/global.css` contiene sólo las tres directivas `@tailwind`. Nunca declaró el bloque `:root` con las custom properties de la marca, que en web viven en `packages/ui-tokens/src/theme.css`. Como consecuencia, **toda clase de NativeWind cuyo token sea un alias queda sin color en el dispositivo**: los aliases de `@grana/ui-tokens` (`background`, `muted`, `primary`, `surface-*`, …) tienen como valor un string `var(--…)`, y sin `:root` esa variable no resuelve.

El alcance está medido, compilando la config de Tailwind de mobile contra los tokens reales:

| Clase | Compila a | ¿Resuelve en RN hoy? |
| --- | --- | --- |
| `bg-page`, `bg-card`, `text-text-muted`, `text-text-soft` | `rgb(246 247 249 / …)` | Sí |
| `bg-background`, `bg-muted` | `var(--page)`, `var(--border-soft)` | No |
| `text-muted` | `var(--border-soft)` | No |
| `text-primary` | `var(--navy)` | No |

Hay ~230 usos de `text-muted` y una decena de `text-primary` en `apps/mobile`. La trampa que lo hizo invisible: `text-muted` **no** es el token estructural `text-muted` — es el prefijo `text-` sobre el alias `muted`, y apunta a un color de borde. El defecto no lo detecta `pnpm typecheck` ni `pnpm lint`, y el fallo es silencioso (el texto no desaparece: pierde su color y cae al default).

El síntoma que disparó la investigación fue distinto y ya está resuelto: el fondo negro detrás de las esquinas `rounded-t-xl` del tab bar, causado por que nadie pintaba el window background.

## What Changes

- **Se declara el `:root` de tokens en mobile.** El codegen de `@grana/ui-tokens` (`scripts/codegen.mjs`, que ya parsea el `:root` de `theme.css` para generar `tokens.cjs`) SHALL emitir además un CSS con ese mismo bloque, que `apps/mobile/global.css` importa. Con eso los aliases resuelven en RN y **no hay que tocar ningún componente**.
- Se descarta explícitamente la alternativa de migrar las ~230 clases a tokens literales (ver `design.md`).
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
- **Verificación**: el efecto sólo se comprueba en dispositivo/emulador — `typecheck` y `lint` pasan igual con el bug presente. La verificación la hace el usuario.
- **Riesgo abierto**: que NativeWind no resuelva `var()` desde un `:root` importado como se espera. El runtime de `react-native-css-interop` expone `rootVariables`/`universalVariables`, lo que indica que sí, pero NO está verificado en dispositivo. Si no funcionara, el fallback es la migración a tokens literales descartada en `design.md`.
