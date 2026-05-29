# Tareas — Primitivos de overlay

## Grupo 1 · Contratos (`@grana/ui-contracts`)

- [x] 1.1. Agregar `DrawerProps`, `PopoverProps`, `SegmentedProps` + `SegmentedOption`, `SwitchProps` en `packages/ui-contracts/src/index.ts`.
- [x] 1.2. Documentar en `packages/ui-contracts/README.md` los nuevos contratos y la convención de callbacks (`onClose`, `onOpenChange`, `onValueChange`).

## Grupo 2 · Web (`apps/web/components/ui/`)

- [x] 2.1. `drawer.tsx` sobre Radix Dialog: panel lateral (default derecha, `widthPx` default 528), scrim `rgba(11,26,43,.30)` + blur, animación `translateX` `.34s cubic-bezier(.32,.72,0,1)` (keyframes en `globals.css`), cierre por scrim/Esc, focus trap + retorno de foco (Radix). Body scrolleable.
- [x] 2.2. `popover.tsx` sobre Radix Popover: anchored bajo el trigger con flip arriba (`collisionPadding`), `min/max-width` (280/340), `max-height 60vh` con scroll, cierre por outside/Esc/scroll (Radix dismiss layer).
- [x] 2.3. `segmented.tsx` sobre Radix ToggleGroup `type="single"`: activo con superficie `--card` + sombra, contenedor `#EEF1F5`/`--radius-lg`, soporte `disabled` por opción, ignora la deselección (mantiene 1 activo).
- [x] 2.4. `switch.tsx` sobre Radix Switch: track 40×23, knob 19px, `on` = `--emerald`, controlado, `disabled`.
- [x] 2.5. Stories: `drawer.stories.tsx`, `popover.stories.tsx`, `segmented.stories.tsx`, `switch.stories.tsx` (estados on/off, disabled, lados, lista). Validadas con `build-storybook`.

## Grupo 3 · Mobile (`apps/mobile/components/ui/`)

- [x] 3.1. `Drawer` con `Modal` + `Animated` (slide lateral de entrada), scrim Pressable que cierra, full-height anclado a `side`.
- [x] 3.2. `Popover` presentado como bottom sheet (placement divergente permitido por la Web↔Mobile policy), trigger Pressable, cierre por backdrop.
- [x] 3.3. `Segmented` con Pressable y estado activo; `disabled` por opción; `accessibilityRole="radiogroup"/"radio"`.
- [x] 3.4. `Switch` envuelve el `Switch` de RN con los colores del design system.

## Grupo 4 · Tokens (si aplica)

- [x] 4.1. Decisión tomada: se usan **keyframes + arbitrary values** en `apps/web/app/globals.css` (`grana-drawer-*`, `grana-pop-*`, `grana-scrim-*`) en vez de agregar tokens nuevos a `@grana/ui-tokens`. Sin dependencia de Diseño para avanzar; si más adelante se quieren tokens de motion, se promueven sin romper la API.

## Grupo 5 · Verificación

- [x] 5.1. `pnpm --filter web lint` 0 errores; `pnpm --filter web build` verde; `pnpm --filter web build-storybook` compila las 4 stories. Web typecheck limpio.
- [x] 5.2. `pnpm --filter mobile typecheck` verde (los contratos resuelven en ambas apps).
- [x] 5.3. Archivar el change (integrar deltas en `openspec/specs/overlay-primitives/spec.md`, Purpose completo) y `pnpm openspec:check` antes del merge.
