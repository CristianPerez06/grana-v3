# Chrome web-mobile ↔ nativo

## Contexto

Handoff visual del issue [#60](https://github.com/CristianPerez06/grana-v3/issues/60): que `apps/web` en viewport mobile deje de tener su propio lenguaje de navegación y espeje el chrome de la app nativa.

**El alcance es el chrome, no el contenido.** El contenido de cada ruta ya se muestra correctamente en viewport mobile y no se toca. Lo que diverge es todo lo que lo envuelve: header, navegación primaria, forma de los overlays y safe areas.

Este bundle no es una propuesta de rediseño de rutas: es el inventario de las dos capas de chrome, el mapeo pieza por pieza, y el costo por fase. Los mocks representan el shell, no las pantallas.

## Implementación inspeccionada

Web:

- `apps/web/app/(app)/_components/app-shell.tsx` (406 líneas)
- `apps/web/components/ui/page-header.tsx`
- `apps/web/components/ui/drawer.tsx`, `dialog.tsx`, `fab.tsx`
- `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx`
- `apps/web/app/manifest.ts`
- `apps/web/lib/transactions/components/quick-add-fab.tsx`

Nativo:

- `apps/mobile/app/(app)/_layout.tsx`
- `apps/mobile/components/layout/TabBar.tsx`, `AppMenu.tsx`
- `apps/mobile/components/ui/PageHeader.tsx`, `BottomSheet.tsx`, `Drawer.tsx`
- `apps/mobile/components/dashboard/DashboardHeader.tsx`
- `apps/mobile/components/cards/CardsHeader.tsx`
- `apps/mobile/components/transactions/QuickAddFab.tsx`

Compartido:

- `packages/ui-contracts/src/index.ts:139` (`PageHeaderProps`)
- `packages/ui-tokens/src/theme.css:4-8`, `:173-176` (navy)

## Inventario: los dos shells

### Web — `app-shell.tsx`

| Pieza | Gate | Qué es |
|---|---|---|
| `Sidebar` | `hidden md:flex` | `<aside>` de 64px / 256px, colapsable, redondeado, con `SidebarEdgeToggle` flotante |
| `SidebarContent` | — | logo, 5 items de `PRIMARY_NAV`, divisor, `ProfileBlock`, `settings` + logout |
| `TopBarMobile` | `md:hidden` | header blanco `bg-card` con hamburguesa + wordmark "grana" |
| `Drawer` | `md:hidden` | `<dialog>` full-screen que entra desde la izquierda; reusa `SidebarContent` |
| `<main>` | — | `min-h-0 flex-1 overflow-y-auto`; envuelve `MovementDrawerLoader` y el wrapper `mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8` |

`PRIMARY_NAV`: `dashboard` · `accounts` · `cards` · `transactions` · `shared`. `settings` y logout van en el bloque de abajo, fuera del array.

### Nativo — `app/(app)/_layout.tsx` + `components/layout/`

| Pieza | Qué es |
|---|---|
| `<Tabs>` | `screenOptions={{ headerShown: false }}`; 4 screens visibles (`dashboard`, `transactions`, `home`, `menu`) + 3 con `href: null` (`cards`, `accounts`, `settings`) |
| `TabBar` | `bg-card rounded-t-xl border-t`, 3 tabs + `MenuButton` circular emerald de 52px; `paddingBottom: max(14, insets.bottom)`; barrita indicadora de 3px sobre el ícono activo |
| `AppMenu` | bottom sheet dentro de su propio `Modal` (`animationType="slide"`), con grabber, Cuentas · Tarjetas · Ajustes, divisor y Salir en `error` |
| `PageHeader` | `SafeAreaView edges={['top']}` + `bg-navy`; backLink `←` o spacer `h-5`, título `text-2xl` blanco, description `navy-muted`, slot de actions |

Dos reglas de visibilidad que el web no tiene, ambas en `TabBar.tsx:16-30` y `:84-92`:

- `CHROMELESS_SECTIONS` = `accounts`, `cards`, `settings` — las secciones que cuelgan del Menú renderizan **sin tab bar**, y a cambio están obligadas a declarar `backLink` en su root.
- `CHROMELESS_SCREENS` = `transactions/new`, `home/settle`, `home/settings`, `home/cuenta-corriente` — flows pushed que se leen como pantalla completa.
- Además la tab bar se esconde con el teclado abierto (`keyboardVisible`), porque el navegador la monta fuera del contenedor de la pantalla y si no se comería el espacio del campo enfocado.

## Mapeo componente → componente

| Web hoy | Nativo | Web-mobile destino | Fase |
|---|---|---|---|
| `TopBarMobile` | *no existe* | **se elimina** — el navy header lo reemplaza | 1 |
| `Drawer` del shell (`<dialog>` lateral) | `AppMenu` | `AppMenu` web, bottom sheet | 2 |
| *no existe* | `TabBar` | `TabBar` web, nueva, `md:hidden` | 2 |
| `Sidebar` / `SidebarContent` | *no existe* | **sin cambios** — queda `md:flex`, solo desktop | — |
| `PageHeader` (texto en el flujo) | `PageHeader` (banda navy) | `PageHeader` navy bajo `md` | 1 |
| `Drawer` de contenido (17 consumidores) | `BottomSheet` | sheet bajo `md`, lateral en `md+` | 3 |
| `Dialog` (2 confirmaciones) | `Modal` centrado | **sin cambios** | — |
| `Fab` (`sm:hidden`) | `QuickAddFab` | offset sobre la tab bar + gate a `md` | 2 |
| *no existe* | `insets` de `SafeAreaView` | `env(safe-area-inset-*)` | 0 |

## Respuestas a las preguntas abiertas del issue

### 1. La variante narrativa del `PageHeader` web no tiene ningún consumidor

El issue la marcaba como el gap más caro. **No lo es: es código muerto.** Ningún `<PageHeader>` en `apps/web/app` pasa `monthLabel`, `monthLabelParts`, `eyebrow`, `prevMonthHref` ni `nextMonthHref`. Las coincidencias de `monthLabel` en el árbol web son todas variables locales de componentes que no son el header (`balance-card`, `committed-section`, `hero-section`, `current-account-view`, …).

El dashboard web resuelve la navegación de mes exactamente como el nativo: un `DashboardHeader` propio con un `MonthNavigator` aparte, sin pasar por `PageHeader`.

→ **No se porta al navy: se borra.** Son ~73 líneas de la rama narrativa en `page-header.tsx` (`:21-93`, sobre 147 totales — la mitad del archivo) y 5 props del contrato compartido. Entra en la fase 1 como limpieza, y baja el riesgo de la fase en vez de subirlo.

### 2. Los headers por sección son casi simétricos — 5 de 6 heredan el navy gratis

| Sección | Web | Nativo | Hereda el navy tocando solo `page-header.tsx` |
|---|---|---|---|
| `dashboard` | `DashboardHeader` custom, sin `PageHeader` | `DashboardHeader` custom, **ya navy** | ✗ — necesita trabajo propio |
| `transactions` | `PageHeader` | `PageHeader` | ✓ |
| `shared` / `home` | `PageHeader` | `PageHeader` | ✓ |
| `accounts` | `PageHeader` | `PageHeader` | ✓ |
| `cards` | `cards-header.tsx` → `PageHeader` | `CardsHeader` → `PageHeader` | ✓ |
| `settings` | `PageHeader` | `PageHeader` | ✓ |

La única sección con header propio en las dos plataformas es `dashboard`, y el nativo (`components/dashboard/DashboardHeader.tsx:40`, `SafeAreaView edges={['top']} className="bg-navy"`) ya es la referencia terminada. No hay que diseñarla, hay que traducirla.

### 3. El navy tiene que romper el padding del `<main>` — es el costo real de la fase 1

El `PageHeader` web se monta dentro de `<main>`, adentro del wrapper `mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8` (`app-shell.tsx:92`). Una banda navy full-bleed no puede vivir ahí sin romper ese padding.

Dos salidas, a resolver en el mock:

- **A — negative margins en el header:** `-mx-4 -mt-5 md:mx-0 md:mt-0` dentro del propio `PageHeader`. Contenido, pero deja el header acoplado a los valores de padding del shell.
- **B — mover el padding del wrapper al contenido:** el wrapper deja de padear y cada ruta lo recibe de un `RouteBody`. Más limpio, pero toca todas las rutas y sale del alcance "chrome".

Recomendación: **A**, con el acoplamiento documentado como comentario en `app-shell.tsx` y en `page-header.tsx`, apuntándose mutuamente. B es la forma correcta y merece su propio change, no éste.

### 4. Chromeless: el contrato nativo se cumple, el web no lo tiene

En nativo, sección chromeless ⇒ `backLink` obligatorio en su root. Las 3 lo declaran:

- `accounts/index.tsx` → `backLink={{ href: '/(app)/dashboard', … }}`
- `settings/index.tsx` → idem
- `cards` → lo declara `CardsHeader.tsx:44`, no el screen, con el motivo escrito al lado

En web, **ninguna raíz de sección declara `backLink`** — ni `accounts`, ni `cards`, ni `settings`, ni las tres que sí van a tener tab bar. Es coherente con el shell actual: hoy la salida es el sidebar o el drawer, siempre presentes.

→ Si `accounts` / `cards` / `settings` pasan a colgar del Menú y renderizan chromeless, **quedan sin salida visible**. Agregar los 3 `backLink` es prerequisito de la fase 2, en el mismo commit que quita el drawer. No es opcional ni posterior.

### 5. Overlays: 17 drawers, 2 dialogs, y uno que vive en el shell

17 archivos importan `@/components/ui/drawer` (paneles laterales de 528px) y 2 importan `@/components/ui/dialog` (`account-confirm-dialog`, `leave-household-dialog`).

- Los **17 drawers** son todos contenedores de formulario o de detalle → pasan a bottom sheet bajo `md`, lateral en `md+`. El cambio es interno a `drawer.tsx`: el contrato `DrawerProps` no se toca, así que los 17 consumidores quedan intactos.
- Los **2 dialogs** son confirmaciones destructivas. En nativo también son modales centrados. **No se tocan.**
- El caso caro es `MovementDrawer`, porque `MovementDrawerLoader` está montado en el shell (`app-shell.tsx:91`), no en una ruta. Con la tab bar fija hay que decidir si el sheet la tapa o se abre por encima. En nativo el equivalente sube por encima de todo.

### 6. FAB: hay una inconsistencia de breakpoint preexistente

`fab.tsx:28` es `fixed bottom-10 right-10 z-40 sm:hidden`, mientras el shell mobile vive hasta `md`. Entre 640px y 767px no hay FAB **ni** sidebar: el usuario queda con la topbar de hamburguesa y ninguna acción primaria flotante. Es un bug preexistente, no algo que introduzca este change, pero la fase 2 lo toca igual → se arregla ahí (`sm:hidden` → `md:hidden`).

Además `fixed bottom-10` se apoyaría **sobre** la tab bar. En nativo el `QuickAddFab` usa `absolute bottom-10` relativo a la pantalla, y la tab bar queda afuera del contenedor, así que no colisiona. En web hay que sumar el alto de la tab bar al offset.

### 7. Safe areas: el bloqueo concreto de la fase 0

`apps/web` **no exporta `viewport` en ningún archivo**, y no hay una sola aparición de `env(safe-area-inset-*)` en `apps/web` ni en `packages/ui-tokens`. Sin `viewport-fit=cover` esas variables no resuelven en iOS standalone.

El manifest ya declara `display: 'standalone'` y `theme_color: '#0B1A2B'` — o sea, la PWA ya está instalable y ya pinta el navy en la barra de estado, pero el layout no lo sabe. Hoy no se nota porque no hay nada anclado a los bordes; con header navy arriba y tab bar fija abajo, se nota en el notch y en la home indicator.

→ Fase 0: `export const viewport = { viewportFit: 'cover', themeColor: '#0B1A2B' }` + tokens de safe area. Desbloquea 1 y 2.

### 8. Tokens: sin riesgo, confirmado

`--navy`, `--navy-muted`, `--navy-soft`, `--navy-border` viven en `theme.css:4-8` y están mapeados a utilidades en el bloque `@theme` (`:173-176`). Y la web ya los usa con soltura: `bg-hero-navy`, `text-navy-muted`, `border-navy-border` aparecen en `shared/(home)/_components/hero-section.tsx`, `spending-breakdown.tsx`, `cards/[id]/_components/card-header-actions.tsx` y varios más. No hace falta ningún literal ni ningún token nuevo salvo los de safe area.

## Hallazgos del paso de mock

Cuatro cosas que no aparecieron en el inventario y sí al dibujar las pantallas.

### 9. Esconder la barra con el teclado abierto no sale gratis en web

El nativo lo resuelve con `useKeyboardState` de `react-native-keyboard-controller` (`TabBar.tsx:84-92`), porque la barra la monta el navigator **fuera** del contenedor de la pantalla y si no quedaría entre el campo enfocado y el teclado.

En web el problema es el mismo con otra causa: una barra `fixed` se apoya sobre el teclado virtual. No hay hook equivalente — hay que escuchar `visualViewport.resize` y comparar contra `window.innerHeight`. **Es la pieza menos trivial de la fase 2** y conviene prototiparla antes que el resto de la fase, no después.

### 10. El logout es un server action, y se muda al sheet

En el shell actual el logout es un `<form action={logoutAction}>` dentro de `SidebarContent`. Al pasar el menú a bottom sheet, ese form se muda con él: el ítem del sheet tiene que seguir siendo un form con su server action, no un `onPress`. En nativo es un `supabase.auth.signOut()` directo, así que la referencia nativa **no aplica** acá — es el único punto donde la implementación web no puede calcar al nativo.

### 11. Espejar el menú pierde el `ProfileBlock`

El sidebar web muestra nombre y email arriba del bloque de settings/logout (`ProfileBlock`). El `AppMenu` nativo no muestra identidad. Espejo exacto = se pierde en web-mobile.

Es una decisión chica pero explícita: si se decide conservarlo, va arriba del primer ítem del sheet **y hay que agregarlo también al nativo**, o la divergencia vuelve por la otra punta. Recomendación: conservarlo en las dos, porque saber con qué cuenta estás logueado importa más en una PWA instalada que en una app nativa, donde la sesión es evidente.

### 12. Dos consumidores de `Drawer` portalean adentro del panel

`bank-selector.tsx` y `money-calculator-popover.tsx` leen `useDrawerContainer()` para portalear su contenido dentro del panel; si no, el scroll-lock de `react-remove-scroll` no los deja scrollear (el motivo está escrito en `drawer.tsx:8-15`). Al pasar a sheet ese contenedor cambia de forma y de alto. No rompen el contrato, pero son **los dos únicos de los 17 que hay que probar a mano** en la fase 3.

### Registrado, fuera de alcance

En `/transactions` el slot `actions` no lleva lo mismo en cada plataforma: nativo pone el ícono de recurrencias y deja el alta solo en el FAB; web pone recurrencias como link en `descriptionExtras` y el alta en el header **y** en el FAB. Es una diferencia de qué se pone en el slot, no de la estructura del chrome — decisión de producto por ruta. Queda anotada en `mobile/chrome.html` y no entra en el change.

## Costo por fase

| Fase | Alcance | Archivos | Riesgo |
|---|---|---|---|
| **0** | `export const viewport` + `viewport-fit=cover` + tokens de safe area | 2 | bajo — desbloquea todo lo demás |
| **1** | `PageHeader` navy bajo `md` (negative margins) · borrar la variante narrativa · `DashboardHeader` navy · eliminar `TopBarMobile` | ~6 | bajo — 5 de 6 secciones lo heredan |
| **2** | `TabBar` web + `AppMenu` sheet (con el form de logout) · quitar el `Drawer` del shell · 3 `backLink` nuevos · reglas chromeless · esconder con teclado · FAB `sm:`→`md:` + offset | ~12 | **alto** — cambia el modelo de navegación |
| **3** | `drawer.tsx`: bottom sheet bajo `md` | 1 + 17 sin tocar | medio — contrato intacto, pero superficie amplia |
| **4** | `route-ui-system.md`: tres vistas → dos | 1 | doc |

Las fases 0→1→2 son secuenciales. La 3 es independiente de la 2 y puede ir en paralelo. La 4 cierra.

Dentro de la fase 2, el orden importa: **primero el manejo de teclado**, después el resto. Es lo único de todo el change sin referencia nativa reutilizable, y si no se sostiene, la barra fija no se sostiene.

## Archivos de trabajo

- `shared.css` — tokens y primitivas de los mocks
- `components/route-shell.html` — anatomía del shell, antes y después
- `components/header.html` — `PageHeader` navy y sus variantes
- `components/tab-bar.html` — tab bar, menú sheet y estados chromeless
- `components/overlays.html` — drawer lateral → bottom sheet
- `web/chrome.html` — el chrome espejado en contexto: `transactions` y `accounts/[id]`
- `mobile/chrome.html` — la referencia nativa, para comparar lado a lado
