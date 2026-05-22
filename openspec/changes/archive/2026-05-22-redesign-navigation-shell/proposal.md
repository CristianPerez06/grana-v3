## Why

La navegación actual de la app no transmite la identidad visual de Grana V3 y tiene problemas estructurales en ambas plataformas. En web, el `Header` concentra la navegación principal (Cuentas/Tarjetas/Movimientos) mientras el `Sidebar` queda relegado a Settings + logout — una inversión del patrón usual en SaaS de dashboard — y no existe ningún comportamiento responsive: por debajo del breakpoint `md` la UI directamente no funciona. En mobile, el botón "Más" del tab bar se ve idéntico a las pestañas de navegación, por lo que se confunde con un destino, y los colores del tab bar están hardcodeados en lugar de leer los tokens de `@grana/ui-tokens`, dejando la barra completamente neutra y desconectada de la paleta de marca.

## What Changes

### Web (`apps/web`)

- **BREAKING** Eliminar el componente `Header` (`apps/web/app/(app)/_components/header.tsx`). Toda la navegación se consolida en el sidebar.
- Rediseñar `Sidebar` como un panel flotante (island layout): margen interior respecto al viewport, esquinas redondeadas en los cuatro lados, sombra sutil, padding superior e inferior. Logo "grana" en el tope (clickable → `/dashboard`), nav primaria en el medio (Dashboard, Cuentas, Tarjetas, Movimientos), Settings + logout fijados al pie.
- Estado activo de cada item: acento emerald (barra lateral de 3px + texto emerald + fondo emerald sutil). Hover: tinte navy/slate suave.
- Comportamiento responsive mobile-first: por debajo de `md` (768px) el sidebar se oculta y aparece una barra superior delgada con logo + botón hamburger; el botón abre un drawer lateral con el mismo contenido del sidebar.

### Mobile (`apps/mobile`)

- El cuarto slot del tab bar (`menu`) deja de presentarse como pestaña: se renderiza como un botón circular con acento emerald, sin label, claramente diferenciado de las pestañas de navegación (Dashboard / Movimientos / Tarjetas).
- TabBar pasa a leer los colores de `@grana/ui-tokens` en lugar de hardcodear `#0B1A2B` / `#8A94A3`. Estado activo de las pestañas usa emerald (ícono + label) con un indicador pill o barra superior. Estado inactivo usa `text-soft`.
- Surface del tab bar: fondo `card`, borde superior `border-soft`, padding vertical aumentado, esquinas superiores levemente redondeadas (12px) para que se lea como una sheet flotante sobre el contenido.
- `AppMenu` (sheet modal): tokens en lugar de literales y un acento emerald sutil en los íconos de los items al presionar.

## Capabilities

### New Capabilities

- `web-app-shell`: define el shell de navegación de la app web — layout sidebar-only, comportamiento responsive con drawer, presentación visual del sidebar (forma, paleta, estado activo). Sigue el precedente single-platform de `mobile-app-shell` (prefijo `web-` porque la implementación es genuinamente platform-specific: HTML/CSS/Tailwind vs React Native).

### Modified Capabilities

- `mobile-app-shell`: agregar requirements de presentación del tab bar y del botón de menú (forma, paleta de marca, diferenciación visual entre pestañas y acción de menú). Hasta ahora la capability solo cubría arranque, resolución de paquetes y type-check/lint; ahora también cubre la presentación visual del shell de tabs/menú que la propia capability menciona pero no normaba.

## Impact

- **Código afectado (web):**
  - Eliminar: `apps/web/app/(app)/_components/header.tsx`.
  - Reescribir: `apps/web/app/(app)/_components/sidebar.tsx`, `apps/web/app/(app)/_components/sidebar-context.tsx`, `apps/web/app/(app)/_components/sidebar-toggle.tsx`, `apps/web/app/(app)/layout.tsx`.
  - Nuevo: componente `TopBarMobile` (logo + hamburger) y `SidebarDrawer` (variante mobile del sidebar). Posiblemente unificados con el sidebar de desktop tras un único componente que cambia su modo según breakpoint.
- **Código afectado (mobile):**
  - Reescribir: `apps/mobile/components/layout/TabBar.tsx` (tokens, estilo del 4to slot como botón).
  - Ajustes menores: `apps/mobile/components/layout/AppMenu.tsx` (tokens).
- **Tokens:** sin cambios al package `@grana/ui-tokens` — la paleta ya existe; el cambio es de uso.
- **i18n:** los labels del header eliminado (Cuentas/Tarjetas/Movimientos) hoy están hardcodeados en español; al moverlos al sidebar se aprovecha para integrarlos al catálogo `@grana/i18n-messages` (si aún no lo están).
- **Dependencias:** ninguna nueva. El drawer mobile se implementa con CSS + state, sin libraries adicionales.
- **Riesgos:** la eliminación del header es la modificación más visible; usuarios actuales perderán referencia visual temporalmente. Mitigación: el logo en el sidebar y la nav consolidada hacen el cambio intuitivo en segundos.
