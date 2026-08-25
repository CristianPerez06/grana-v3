# Proposal: mirror-native-chrome-on-web-mobile

## Why

`apps/web` en viewport mobile y `apps/mobile` son hoy dos productos distintos. La web instalada como PWA `display: standalone` compite de frente con la app nativa en el home screen de un teléfono, y se ve como otra cosa: topbar blanca con hamburguesa contra header navy, drawer lateral contra tab bar fija, paneles laterales contra bottom sheets.

Esa divergencia hoy es **intencional y está documentada**: `docs/design/route-ui-system.md:43` manda diseñar tres vistas y define web-mobile como "responsive en navegador, topbar + drawer" frente a la nativa "header navy + tab bar". El requirement "La app web es mobile-first bajo el breakpoint `md`" de `web-app-shell` la codifica. Este change la cierra: web-mobile pasa a espejar el chrome nativo.

**El alcance es el chrome, no el contenido.** El contenido de cada ruta ya se muestra correctamente en viewport mobile y no se toca. Handoff visual completo, con inventario y mapeo pieza por pieza: `docs/design/web-mobile-chrome/`.

## What Changes

- **`PageHeader` web pasa a banda navy bajo `md`** — full-bleed, comiéndose el safe-area top, con el back-link reservando su espacio aunque no exista. En `md+` no cambia nada.
- **La topbar y el drawer del shell desaparecen bajo `md`**, reemplazados por una tab bar fija de 4 slots (`Inicio` · `Movimientos` · `Hogar` · `⋯`) y un menú como bottom sheet. Espejo exacto del nativo: Cuentas, Tarjetas y Ajustes **bajan** del sidebar al menú.
- **Se importan las reglas chromeless del nativo**: las secciones que cuelgan del menú renderizan sin tab bar y a cambio declaran `backLink` obligatorio en su root; la barra también se esconde con el teclado abierto.
- **El `Drawer` pasa a bottom sheet bajo `md`.** Cambio interno al primitivo: `DrawerProps` no se toca y los 17 consumidores no se editan.
- **Se borra la variante narrativa de `PageHeader` web** (`eyebrow`, `monthLabel`, `monthLabelParts`, `prevMonthHref`, `nextMonthHref`). No tiene ningún consumidor y no está speceada en ningún lado: es spec drift, ~73 de las 147 líneas del archivo.
- **Se agrega `export const viewport` con `viewport-fit=cover`** — hoy no existe, y sin él `env(safe-area-inset-*)` no resuelve en iOS standalone.
- **Se arregla el gate del FAB** (`sm:hidden` → `md:hidden`) y su offset sobre la tab bar.

Sin cambios de datos, queries, validación ni contables. Desktop no se toca.

## Capabilities

### Modified Capabilities

- `web-app-shell`: el requirement "La app web es mobile-first bajo el breakpoint `md`" pasa de topbar + drawer full-screen a tab bar fija + menú sheet, con reglas de visibilidad chromeless y de teclado. "La transición del drawer respeta `prefers-reduced-motion`" pasa a aplicar al sheet.
- `page-header`: el requirement web suma el tratamiento navy bajo `md` y la reserva del back-link. Se agrega el requirement de back-link obligatorio en raíces de sección chromeless (web), espejo del que ya existe para mobile.
- `overlay-primitives`: el requirement "Drawer lateral con scrim y cierre estándar" suma la presentación como bottom sheet bajo `md`.

### New Capabilities

(ninguna)

**Pre-change check.** Las changes activas (`add-mobile-money-calculator`, `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps`, `fix-native-movement-form-spec-drift`) tocan `transactions` y superficies de `apps/mobile`. Este change no toca ninguna de las dos: su superficie es `apps/web` + los primitivos web. Sin solapamiento.

**Nota de coordinación.** Hay trabajo en vuelo sobre `apps/web/app/manifest.ts` (íconos PWA, `purpose: any` / `maskable` y un `apple-icon.png` nuevo). La fase 0 de este change toca el mismo archivo para agregar el `viewport`. Conviene que ese trabajo aterrice primero.

## Impact

Por fase. Las fases 0→1→2 son secuenciales; la 3 es independiente de la 2; la 4 cierra.

**Fase 0 — safe areas** (prerequisito de todo lo demás)

- `apps/web/app/layout.tsx` — `export const viewport` con `viewportFit: 'cover'` y `themeColor`.
- `packages/ui-tokens/src/theme.css` — tokens de safe area.

**Fase 1 — header navy**

- `apps/web/components/ui/page-header.tsx` — tratamiento navy bajo `md`, negative margins para romper el padding del `<main>`, borrado de la variante narrativa.
- `packages/ui-contracts/src/index.ts` — se van las 5 props narrativas.
- `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx` — navy, calcado de `apps/mobile/components/dashboard/DashboardHeader.tsx:40`.
- `apps/web/app/(app)/_components/app-shell.tsx` — el wrapper del `<main>` queda comentado como acoplado al header. `TopBarMobile` **no se toca acá**: es el único acceso a la navegación hasta que aterrice la tab bar.
- `apps/web/components/ui/page-header.stories.tsx` — se actualizan las historias.

**Fase 2 — tab bar**

- `apps/web/app/(app)/_components/` — `TabBar` y `AppMenu` nuevos; se eliminan `TopBarMobile` y el `Drawer` del shell, en el mismo commit que los reemplaza.
- `apps/mobile/components/layout/AppMenu.tsx` — suma el bloque de identidad, para que la paridad no se rompa por la otra punta.
- `apps/web/app/(app)/_components/app-shell.tsx` — monta la barra, aplica las reglas chromeless y el hide por teclado (`visualViewport.resize`).
- `apps/web/components/ui/fab.tsx` — `sm:hidden` → `md:hidden` y offset sobre la barra.
- `accounts/_components/accounts-header.tsx`, `cards/_components/cards-header.tsx`, `settings/_components/settings-header.tsx` — `backLink` al dashboard, obligatorio al quedar sin barra.
- `@grana/i18n-messages` — sin strings nuevas: `nav.*` ya tiene todo lo que el menú necesita.

**Fase 3 — overlays**

- `apps/web/components/ui/drawer.tsx` — bottom sheet bajo `md`. Los 17 consumidores no se editan.
- Verificación manual de `accounts/_components/bank-selector.tsx` y `components/ui/money-calculator-popover.tsx`: son los dos que portalean adentro del panel vía `useDrawerContainer()`.

**Fase 4 — doc**

- `docs/design/route-ui-system.md:43` — la regla de las tres vistas pasa a dos: desktop y mobile compartida.
