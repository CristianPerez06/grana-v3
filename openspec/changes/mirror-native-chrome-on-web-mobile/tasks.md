> Las fases 0→1→2 son secuenciales: cada una deja el terreno para la siguiente. La 3 no depende de la 2 y puede ir en paralelo. La 4 cierra. Cada fase es un issue hijo de [#60](https://github.com/CristianPerez06/grana-v3/issues/60) y se mergea sola.

## 1. Fase 0 — Safe areas

- [x] 1.1 En `apps/web/app/layout.tsx`, agregar `export const viewport: Viewport = { viewportFit: 'cover', themeColor: '#0B1A2B' }` importando `Viewport` de `next`, junto al `export const metadata` que ya vive ahí. El trabajo en vuelo sobre `manifest.ts` (íconos PWA) es otro archivo: no hay conflicto ni orden obligado
- [x] 1.2 En `packages/ui-tokens/src/theme.css`, agregar los tokens de safe area (`--safe-top`, `--safe-bottom`) resolviendo a `env(safe-area-inset-top, 0px)` / `env(safe-area-inset-bottom, 0px)`, y mapearlos en el bloque `@theme` para que existan como utilidades
- [x] 1.3 Confirmar por lectura que ningún componente web usa `env(safe-area-inset-*)` directo: el acceso es siempre vía token

## 2. Fase 1 — Header navy

- [x] 2.1 En `apps/web/components/ui/page-header.tsx`, borrar la rama narrativa completa (`:21-93`) y el `isNarrative`; queda solo la variante clásica
- [x] 2.2 En `packages/ui-contracts/src/index.ts`, sacar `eyebrow`, `monthLabel`, `monthLabelParts`, `prevMonthHref`, `nextMonthHref` y `descriptionExtras` de `PageHeaderProps` **solo si ningún consumidor las pasa** — verificar `descriptionExtras` aparte: `transactions-header.tsx:47` la usa, así que esa se queda
- [x] 2.3 En `page-header.tsx`, aplicar el tratamiento navy bajo `md`: `bg-navy` full-bleed con `-mx-4 -mt-5 md:mx-0 md:mt-0`, `pt-[--safe-top]`, título en blanco, `description` y back-link en `text-navy-muted`. En `md+` el render no cambia
- [x] 2.4 En `page-header.tsx`, reservar el espacio del back-link cuando no existe: un spacer de 20px bajo `md`, espejo de `<View className="h-5" />` del nativo. El header no cambia de alto entre rutas
- [x] 2.5 Agregar comentarios cruzados en `page-header.tsx` y `app-shell.tsx:92` documentando el acoplamiento de los negative margins con el padding del wrapper (decisión 1 del design)
- [x] 2.6 En `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx`, pasar a navy bajo `md` calcando el layout de `apps/mobile/components/dashboard/DashboardHeader.tsx:43-64`: saludo como título con la fecha debajo en `navy-muted`, y `MonthNavigator` + `EyeMaskToggle` compartiendo la fila a la derecha
- [x] 2.7 **`TopBarMobile` no se toca en esta fase.** Es el único acceso a la navegación mientras el drawer siga siendo el menú: sacarla acá deja la app sin salida hasta que aterrice la fase 2. El estado intermedio —topbar blanca sobre header navy— es redundante pero funcional y coherente. Se va en 3.6, junto con el drawer que la justifica
- [x] 2.8 Actualizar `apps/web/components/ui/page-header.stories.tsx`: no había ninguna historia de la variante narrativa que borrar, y se suman cinco del tratamiento navy (tab root, sección chromeless, pantalla anidada, cargando, solo título). El navy depende de una media query, así que las historias fijan el viewport del iframe con `globals: { viewport: { value: 'grana' } }` y reproducen el wrapper del shell (`max-w-5xl px-4 py-5`) para que la banda se vea en la caja donde realmente renderiza. El viewport de 390px se registra en `.storybook/preview.tsx`. **Sin dependencia nueva**: desde Storybook 9 el viewport es parte del core (`storybook/viewport`), no un addon aparte
- [x] 2.9 `pnpm typecheck` y `pnpm lint` sin errores

## 3. Fase 2 — Tab bar

- [x] 3.1 **Primero:** prototipar el hide por teclado. Hook que escuche `visualViewport.resize` y compare la razón `visualViewport.height / window.innerHeight` contra un umbral, con fallback a "no esconder" si `window.visualViewport` es `undefined` (decisión 2 del design). Si esto no se sostiene, la barra fija tampoco
- [x] 3.2 Crear `apps/web/app/(app)/_components/tab-bar.tsx`: 4 slots (`/dashboard`, `/transactions`, `/shared`, menú), barrita indicadora de 3px sobre el ícono activo, `bg-card rounded-t-xl border-t`, `padding-bottom` = `max(14px, --safe-bottom)`. Activo por prefix-match, misma regla que `findActiveHref`
- [x] 3.3 Crear `apps/web/app/(app)/_components/app-menu.tsx` como bottom sheet: grabber, encabezado con cerrar, Cuentas · Tarjetas · Configuración, divisor, y logout **como `<form action={logoutAction}>`** (decisión 3 del design)
- [x] 3.4 Sumar el `ProfileBlock` arriba del primer ítem del sheet (decisión 4 del design)
- [x] 3.5 En `apps/mobile/components/layout/AppMenu.tsx`, sumar el mismo bloque de identidad, para que la paridad no se rompa por la otra punta (decisión 4)
- [x] 3.6 En `app-shell.tsx`, montar `TabBar` + `AppMenu` bajo `md` y eliminar en el mismo commit `TopBarMobile`, el `Drawer` del shell y el estado `drawerOpen`. Los tres se van juntos: la topbar sin drawer no lleva a ningún lado, y el drawer sin topbar no se puede abrir
- [x] 3.7 Reglas chromeless en `apps/web/lib/nav.ts` (`isActive` + `isChromeless`), espejo de `CHROMELESS_SECTIONS` / `CHROMELESS_SCREENS` de `TabBar.tsx:16-30`. **Vive en `lib/` y no en el route group** porque `components/ui/fab.tsx` también lo necesita y un primitivo no puede importar desde `app/(app)/`. El chequeo lo hace el shell, no la barra: el FAB y el padding del contenido necesitan la misma respuesta, y el shell la publica como `--tab-bar-inset`
- [x] 3.8 Agregar `backLink={{ href: '/dashboard', label: t('nav.dashboard') }}` en `accounts/_components/accounts-header.tsx`, `cards/_components/cards-header.tsx` y `settings/_components/settings-header.tsx`. Sin barra, es la única salida: va en el mismo commit que 3.6
- [x] 3.9 En `apps/web/components/ui/fab.tsx:28`, cambiar `sm:hidden` por `md:hidden` y sumar al `bottom` el alto de la barra más `--safe-bottom`
- [x] 3.10 Unificar el label del destino compartido en `nav.home` ("Hogar"): cambiar el item del sidebar en `app-shell.tsx` de `labelKey: 'shared'` a `'home'`, y ajustar el tipo `NavItem` (decisión 5 del design). `nav.shared` queda en el catálogo
- [x] 3.11 Confirmar que la transición del sheet respeta `prefers-reduced-motion`, como hacía el drawer
- [x] 3.12 `pnpm typecheck` y `pnpm lint` sin errores
- [x] 3.13 **Corrección posterior a review.** La acción de crear de una ruta pasa al slot `actions` del `PageHeader`, visible en todos los anchos, y se le saca el FAB. Aplica a las seis rutas que lo tenían: `accounts`, `cards`, `settings/categories`, `settings/categories/[id]/subcategories`, `transactions/recurring` y `cards/[id]`. El `QuickAddFab` de `/dashboard`, `/transactions` y `/shared` queda como el único botón flotante del producto, que es lo que hace el nativo. `components/ui/fab.tsx` se conserva —lo usa `QuickAddFab`— con el doc reescrito para que la regla no se pierda. Ojo: `cards/[id]` ("Registrar compra") **no tiene espejo nativo**, porque los write flows de tarjetas todavía no existen en `apps/mobile`; se movió al header por la misma regla, no por paridad

## 4. Fase 3 — Overlays

- [x] 4.1 `apps/web/components/ui/drawer.tsx` presenta el panel como bottom sheet bajo `md`: anclado abajo, `rounded-t-[20px]`, alto que hugea el contenido con tope en 90dvh, grabber arriba. `side` y `widthPx` inertes bajo `md`; en `md+` nada cambia. Dos detalles: (a) `widthPx` pasó de `style={{ width }}` a la variable `--drawer-width`, porque un width inline le gana a la media query y dejaría el sheet de 528px en un teléfono; (b) la animación se cambia en `globals.css` sobreescribiendo solo el `animation-name` bajo 767px, así que duración, easing y los hooks `[data-state]` siguen compartidos y el elemento conserva su clase de lado
- [x] 4.2 Confirmar por lectura que ninguno de los 17 consumidores necesita editarse: `DrawerProps` no cambia
- [ ] 4.3 Verificar **en navegador** `accounts/_components/bank-selector.tsx` y `components/ui/money-calculator-popover.tsx`, los dos que portalean adentro del panel vía `useDrawerContainer()` (decisión 6 del design). Por lectura no requieren cambios: los dos son collision-aware y acotan su alto con `--radix-popover-content-available-height`, así que un contenedor más bajo los hace flipear hacia arriba en vez de recortarse. El panel ya tenía un `transform` persistente (`animation-fill-mode: both`) antes de este change, así que el containing block de los descendientes `fixed` no cambia. **Queda por confirmar a ojo** → ver 7.8
- [ ] 4.4 Verificar **en navegador** el `MovementDrawer` con el teclado abierto: el sheet tapa la barra y sube con el viewport (decisión 7 del design). No se puede confirmar sin un teclado virtual real → ver 7.4
- [x] 4.5 `drawer.stories.tsx` suma `SheetShort` y `SheetTall`, que fijan el viewport `grana` y muestran los dos casos que importan: contenido corto que el sheet hugea, y contenido que llega al tope de 90dvh y scrollea adentro
- [x] 4.6 `pnpm typecheck` y `pnpm lint` sin errores

## 5. Fase 4 — Documentación

- [ ] 5.1 En `docs/design/route-ui-system.md:43`, reescribir la regla de las tres vistas: pasan a ser **dos** (desktop y mobile compartida entre web y nativo), con el motivo escrito para que la pregunta no se re-abra sin datos nuevos
- [ ] 5.2 Actualizar la estructura de carpetas del mismo doc: `web/<feature>.html` pasa a cubrir desktop, y `mobile/<feature>.html` pasa a ser la vista mobile de las dos plataformas

## 6. Spec

- [ ] 6.1 Aplicar los deltas de `web-app-shell`, `page-header` y `overlay-primitives` sobre `openspec/specs/` (se hace al archivar el change, no antes)

## 7. Verificación en navegador (la corre el usuario)

- [ ] 7.1 Chrome DevTools a 390px → `/transactions`: header navy pegado al tope, tab bar fija abajo con Movimientos marcado, FAB sin apoyarse sobre la barra
- [ ] 7.2 Tocar `⋯` → el sheet sube por encima de la barra, muestra identidad y los cuatro ítems, cierra al tocar el scrim
- [ ] 7.3 Navegar a Cuentas desde el menú → sin tab bar, con back-link a Inicio que funciona
- [ ] 7.4 `/transactions` → abrir el alta y enfocar el monto: la barra se esconde, el sheet queda por encima del teclado, y la barra vuelve al cerrarlo
- [ ] 7.5 Redimensionar a 800px → sidebar de vuelta, sin tab bar, sin FAB, headers en el flujo del contenido
- [ ] 7.6 Instalar la PWA en un iPhone real → el navy llega hasta el notch y la barra respeta la home indicator. Es lo único que el DevTools no puede verificar
- [ ] 7.7 Repetir 7.1 y 7.4 en Android
- [ ] 7.8 A 390px, abrir el alta de cuenta → el selector de banco despliega su lista dentro del sheet y scrollea con el dedo; ídem la calculadora de monto. Son los dos únicos consumidores que portalean adentro del panel (tarea 4.3)
- [ ] 7.10 A 390px, recorrer `/accounts`, `/cards`, `/settings/categories`, `/transactions/recurring` y `/cards/[id]`: la acción de crear está en el header arriba a la derecha, en verde, y no hay ningún botón flotante. En `/dashboard`, `/transactions` y `/shared` el `QuickAddFab` sigue estando
- [ ] 7.9 A 390px, abrir cualquier drawer con poco contenido (ej. editar nombre del hogar) → el sheet hugea su alto en vez de ocupar la pantalla entera
