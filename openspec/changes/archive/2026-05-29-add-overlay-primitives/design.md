# Diseño — Primitivos de overlay

## Base técnica

**Web**: construir sobre **Radix UI** (las deps ya incluyen `@radix-ui/react-*` para alert-dialog y dropdown-menu). Radix aporta focus trap, manejo de Esc, `aria-*` y portal sin reinventarlos. Cada primitivo es un wrapper delgado que aplica tokens de `@grana/ui-tokens` vía Tailwind v4.

**Mobile**: React Native nativo (`Modal`, `Animated`, `Pressable`). No hay Radix en RN; la paridad la garantiza el contrato, no la implementación.

## Contratos (`@grana/ui-contracts`)

```ts
interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: 'right' | 'left'        // default 'right'
  widthPx?: number               // default 528 (web); mobile ignora / full-width
  ariaLabel: string
  children?: ReactNode
  className?: string
}

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: unknown             // ref al trigger (tipado por plataforma)
  minWidthPx?: number            // default 280
  maxWidthPx?: number            // default 340
  children?: ReactNode
  className?: string
}

interface SegmentedOption { value: string; label: string; disabled?: boolean }
interface SegmentedProps {
  value: string
  options: SegmentedOption[]
  onValueChange: (value: string) => void
  ariaLabel: string
  className?: string
}

interface SwitchProps {
  checked: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  ariaLabel: string
  className?: string
}
```

## Decisiones

### D1 — Drawer sobre Dialog, no un componente nuevo de scrim

El Drawer reusa Radix Dialog (overlay + content + focus trap + Esc) y solo cambia la animación a `translateX`. Scrim: `rgba(11,26,43,.30)` + `backdrop-filter: blur(2px)`, fade `--duration-normal`. Entrada del panel `.34s cubic-bezier(.32,.72,0,1)` (token de motion nuevo si hace falta, o arbitrary value). Sombra `--shadow-xl` adaptada a `-24px 0 60px -20px`. Click en scrim ⇒ `onClose`.

### D2 — Popover con posicionamiento anclado

Radix Popover ya hace el anchoring y el flip (abajo→arriba si no entra) y el cierre por outside-click / Esc. El cierre por **scroll del contenedor** (el body del drawer) se cablea con `onScroll` del contenedor llamando `onClose`, porque el popover usa `position: fixed` y no debe quedar flotando al scrollear. `min-width 280`, `max-width 340`, `max-height 60vh` con scroll interno, radius `--radius-xl`, sombra fuerte.

### D3 — Segmented de opción única con disabled por opción

Radix ToggleGroup `type="single"` con `disabled` por item (necesario para "en edición no se cambia el tipo": todas las opciones salvo la activa quedan disabled, o el grupo entero disabled). Activo: superficie `--card` + `box-shadow` sutil; contenedor `#EEF1F5`, radius `--radius-lg`.

### D4 — Switch controlado, sin estado interno

`checked` + `onValueChange` controlados (sin estado interno) para que el feature gobierne el panel de progressive disclosure. `on` = `--emerald`, knob blanco 19px, track 40×23.

## Accesibilidad

- Drawer: `role=dialog`, `aria-modal`, focus al primer foco lógico, retorno de foco al cerrar, Esc cierra (lo da Radix).
- Popover: `aria-expanded`/`aria-controls` en el trigger; foco gestionado por Radix.
- Segmented: `role=radiogroup`; Switch: `role=switch` + `aria-checked`.

## Tokens nuevos (si aplican)

- `--ease-drawer: cubic-bezier(.32,.72,0,1)` y `--duration-drawer: 340ms` en `@grana/ui-tokens` (o arbitrary values si Diseño prefiere no agregar tokens). A confirmar con Julieta.
