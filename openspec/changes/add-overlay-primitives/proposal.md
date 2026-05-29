# Primitivos de overlay: Drawer, Popover, Segmented, Switch

## Why

El rediseño del form de carga de movimientos se presenta como un **drawer lateral derecho** con **popovers anclados** (selector de cuenta, categoría con drill, fecha), un **segmented control** para el tipo de movimiento (tabs Gasto/Ingreso/Transferencia/Ajuste/Cambio) y **switches iOS** para los toggles de progressive disclosure (reintegro, repetir).

Ninguno de estos primitivos existe hoy en v3: `apps/web/components/ui/` tiene Button, Card, Input, FormField, Alert, Spinner, PageHeader, AccountAvatar, etc., pero **no hay Drawer/Sheet, Popover, Tabs/Segmented ni Switch**. Construirlos *ad hoc* dentro del feature de transactions sería deuda: son piezas reutilizables (settings, cards, filtros mobile ya piden sheets/switches) y deben respetar la Web↔Mobile policy.

El repo ya tiene **precedente** de capabilities para primitivos compartidos: `page-header` y `route-loading-and-errors` son módulos cuyo entregable es un primitivo UI con contrato compartido en `@grana/ui-contracts` y dos implementaciones (web HTML / mobile RN). Este change sigue ese patrón.

Es **fase 2** de la secuencia del rediseño: dependencia de `redesign-movement-form-as-drawer`. Se hace en su propio change para que el drawer del form quede enfocado en la lógica del movimiento y no mezcle la construcción de primitivos genéricos.

## What Changes

### A — Contratos compartidos (`@grana/ui-contracts`)

- **ADDED** `DrawerProps`, `PopoverProps`, `SegmentedProps`/`SegmentedOption`, `SwitchProps`. Callbacks en idioma RN (`onClose`, `onValueChange`, `onPress`), sin JSX compartido. Nombres y semántica idénticos en ambas plataformas.

### B — Implementación web (`apps/web/components/ui/`)

- **ADDED** `drawer.tsx` — panel lateral (default derecha) full-height con scrim, focus trap, cierre por scrim/Esc, animación de entrada/salida. Sobre Radix Dialog (ya disponible en deps) para a11y.
- **ADDED** `popover.tsx` — contenido anclado a un trigger, posicionado debajo del ancla con clamp al viewport (si no entra abajo, va arriba), cierre por click afuera / scroll / Esc. Sobre Radix Popover.
- **ADDED** `segmented.tsx` — selector segmentado de opción única (Radix ToggleGroup `type="single"`), activo con superficie blanca + sombra, opción deshabilitable individualmente (para "no cambiar tipo en edición").
- **ADDED** `switch.tsx` — switch on/off controlado, estilo iOS (track + knob), `on` verde emerald. Sobre Radix Switch.
- **ADDED** stories de Storybook para los cuatro (estados, variantes, disabled).

### C — Implementación mobile (`apps/mobile/components/ui/`)

- **ADDED** `Drawer`, `Popover`, `Segmented`, `Switch` en React Native (Modal/Pressable/Animated nativos), mismos props que web vía contratos. Sin Storybook (la convención mobile espeja por nombre).

## Stakeholders

- **Diseño** (Julieta): valida tokens (sombras del drawer/popover, knob del switch, sombra del segmento activo) contra `@grana/ui-tokens`.
- **Mobile** (tech lead): la implementación RN es parte de este change (paridad explícita pedida). Los contratos garantizan que web y mobile no diverjan.

## Out of scope

- El form de movimientos y sus selectores específicos (categoría con drill, cuotas) — viven en `redesign-movement-form-as-drawer`. Acá solo el primitivo genérico de Popover; el contenido drilleable lo arma el feature.
