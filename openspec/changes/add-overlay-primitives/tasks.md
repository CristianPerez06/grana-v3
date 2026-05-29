# Tareas — Primitivos de overlay

## Grupo 1 · Contratos (`@grana/ui-contracts`)

- [ ] 1.1. Agregar `DrawerProps`, `PopoverProps`, `SegmentedProps` + `SegmentedOption`, `SwitchProps` en `packages/ui-contracts/src/index.ts`.
- [ ] 1.2. Documentar en `packages/ui-contracts/README.md` los nuevos contratos y la convención de callbacks (`onClose`, `onValueChange`).

## Grupo 2 · Web (`apps/web/components/ui/`)

- [ ] 2.1. `drawer.tsx` sobre Radix Dialog: panel lateral (default derecha, `widthPx` default 528), scrim `rgba(11,26,43,.30)` + blur, animación `translateX` `.34s cubic-bezier(.32,.72,0,1)`, cierre por scrim/Esc, focus trap + retorno de foco. Body scrolleable.
- [ ] 2.2. `popover.tsx` sobre Radix Popover: anchored bajo el trigger con flip arriba, clamp al viewport, `min/max-width` (280/340), `max-height 60vh` con scroll, cierre por outside/Esc; exponer un mecanismo para cerrar on-scroll del contenedor host.
- [ ] 2.3. `segmented.tsx` sobre Radix ToggleGroup `type="single"`: activo con superficie `--card` + sombra, contenedor `#EEF1F5`/`--radius-lg`, soporte `disabled` por opción.
- [ ] 2.4. `switch.tsx` sobre Radix Switch: track 40×23, knob 19px, `on` = `--emerald`, controlado, `disabled`.
- [ ] 2.5. Stories: `drawer.stories.tsx`, `popover.stories.tsx`, `segmented.stories.tsx`, `switch.stories.tsx` (estados on/off, disabled, lados, flip).

## Grupo 3 · Mobile (`apps/mobile/components/ui/`)

- [ ] 3.1. `Drawer` con `Modal` + `Animated` (slide lateral), scrim Pressable que cierra, full-height.
- [ ] 3.2. `Popover` anclado (medición con `measureInWindow`), cierre por backdrop/scroll del host.
- [ ] 3.3. `Segmented` con Pressable y estado activo; `disabled` por opción.
- [ ] 3.4. `Switch` (puede envolver el `Switch` de RN o custom Animated) con la misma API del contrato.

## Grupo 4 · Tokens (si aplica)

- [ ] 4.1. Confirmar con Diseño si se agregan `--ease-drawer`/`--duration-drawer` a `@grana/ui-tokens` o se usan arbitrary values. Implementar la decisión.

## Grupo 5 · Verificación

- [ ] 5.1. `pnpm lint` y `pnpm build` (web) verdes; `pnpm storybook` renderiza los 4 primitivos.
- [ ] 5.2. Typecheck mobile verde (los contratos resuelven en ambas apps).
- [ ] 5.3. Archivar el change (integrar deltas en `openspec/specs/overlay-primitives/spec.md`, completar Purpose) y `pnpm openspec:check` antes del merge.
