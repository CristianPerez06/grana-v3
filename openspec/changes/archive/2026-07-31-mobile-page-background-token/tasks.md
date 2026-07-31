## 1. Espiga: confirmar que NativeWind resuelve `var()`

- [x] 1.1 Verificar que el compilador de NativeWind extrae custom properties de un `:root`. Hecho offline con `react-native-css-interop/dist/css-to-rn` en lugar de la prueba manual en emulador: un `:root { --page: #F6F7F9; }` produce `rootVariables: {"--page":{"light":"#f6f7f9"}}`.
- [x] 1.2 Verificar que una clase con alias compila a una instrucción de lookup: `.bg-background { background-color: var(--page) }` → `["var",["--page"]]`.
- [x] 1.3 Enfoque confirmado; no hace falta el fallback de migrar a tokens estructurales.

## 2. Codegen de las variables

- [x] 2.1 `packages/ui-tokens/scripts/codegen.mjs` emite `tokens.css` con el `:root` de `theme.css` (sólo custom properties; sin `@custom-variant`, `@theme` ni `.dark`).
- [x] 2.2 Exportado desde `packages/ui-tokens/package.json` como `./tokens.css`. Se emite en la **raíz** del package, no en `src/`: `postcss-import` resuelve subpaths literales y no lee el mapa `exports`.
- [x] 2.3 Codegen idempotente (dos corridas, mismo output). `tokens.cjs` sigue generándose igual — con la salvedad de que estaba desactualizado y la corrida agregó 27 líneas de tokens que faltaban (sólo agregados, ningún valor cambió).

## 3. Consumo desde mobile

- [x] 3.1 `apps/mobile/global.css` importa `@grana/ui-tokens/tokens.css` antes de las directivas `@tailwind`.
- [x] 3.2 Verificado offline: el CSS compilado de mobile pasado por `css-to-rn` produce 13 `rootVariables` y las reglas con alias resuelven contra ellas.
- [x] 3.3 **[usuario]** Confirmado — en el emulador que los links de auth y el label del `Button` se ven en navy.

## 4. Aliases en uso

- [x] 4.1 Inventario real, extraído del CSS compilado (no por grep sobre el fuente, que da falsos positivos: `text-muted` matchea dentro de `text-text-muted`). Clases en uso que resuelven a un `var()` suelto: `text-primary` (7 usos en `(auth)/login.tsx` ×3, `signup.tsx`, `forgot-password.tsx`, `ui/Button.tsx`, `auth/OtpVerifyForm.tsx`) y `text-muted-foreground` (1 uso en `auth/OtpVerifyForm.tsx`).
- [x] 4.2 No hace falta corregirlas: con el `:root` declarado apuntan al color correcto (`--navy` y `--text-muted` respectivamente). Se dejan como están, que es la premisa de la Decisión 1 del `design.md`.
- [x] 4.3 `bg-muted` aparecía en el CSS compilado pero sólo por menciones en **comentarios** de `components/ui/SkeletonBlock.tsx`. Ese archivo ya documenta un workaround a este mismo bug (usa `bg-border-soft`); se deja como está, funciona.

## 5. Fondo de la ventana (ya implementado)

- [x] 5.1 Pintar `bg-page` en el root de `apps/mobile/app/_layout.tsx`, dentro de `SafeAreaProvider`. — commit `5ff1c91`
- [x] 5.2 Reemplazar `bg-background` por `bg-page` en el root de las 13 pantallas mobile que lo usaban. — commit `5ff1c91`
- [x] 5.3 **[usuario]** Confirmado — en el emulador que las esquinas redondeadas del tab bar muestran el gris de página y no negro.

## 6. Cierre

- [x] 6.1 `pnpm typecheck` y `pnpm lint` en `apps/mobile` y `packages/ui-tokens`.
- [x] 6.2 `apps/mobile/lib/colors.ts` no cambia: sigue siendo el mirror JS para props `color`/`style` de RN, que no leen clases de NativeWind. El codegen TS que lo reemplazaría sigue pendiente.
- [x] 6.3 Archivar el change y sincronizar los deltas en `openspec/specs/{project-conventions,mobile-app-shell,page-header}/spec.md`.
