## 1. Preparación

- [x] 1.1 Verificar que las keys `nav.dashboard`, `nav.accounts`, `nav.cards`, `nav.movements`, `nav.settings`, `nav.logout` existen en `packages/i18n-messages/src/<locale>.json`; agregarlas en español si faltan
- [x] 1.2 Confirmar que las clases utilitarias usadas en el sidebar y tab bar (`text-positive`, `bg-positive`, `text-text-soft`, `bg-card`, `border-border-soft`, `text-error`, `bg-error/8`, `bg-positive/8`) están disponibles vía Tailwind + `@grana/ui-tokens` (web) y vía NativeWind (mobile). Si alguna no resuelve, ajustar la config correspondiente

## 2. Web — sidebar nuevo (desktop)

- [x] 2.1 Crear `apps/web/app/(app)/_components/app-shell.tsx` como Client Component que encapsula sidebar desktop + topbar mobile + drawer en un solo árbol
- [x] 2.2 Implementar el sidebar desktop dentro de `app-shell.tsx`: surface `bg-card`, margen externo (~`m-3`), `rounded-2xl` (o `rounded-3xl`), `shadow-sm`, borde `border-border-soft`, padding interior superior/inferior
- [x] 2.3 Renderizar el logo "grana" en el tope del sidebar como `<Link href="/dashboard">` con `text-navy`
- [x] 2.4 Renderizar la nav primaria (Dashboard, Cuentas, Tarjetas, Movimientos) leyendo labels desde `useTranslations('nav')`
- [x] 2.5 Renderizar Settings + Logout fijados al pie (`mt-auto`), separados de la nav primaria por un divisor `border-border-soft`
- [x] 2.6 Implementar el estado activo usando `usePathname` con prefix-match priorizando match más largo; aplicar `text-positive`, `border-l-[3px] border-positive`, `bg-positive/8` al item activo
- [x] 2.7 Verificar que el sidebar funciona correctamente en viewports ≥ 768px (Chrome DevTools y/o real device)

## 3. Web — topbar + drawer (mobile)

- [x] 3.1 Implementar la topbar mobile dentro de `app-shell.tsx` con visibilidad responsive (`flex md:hidden`): alto ~56px, logo a la izquierda (link a `/dashboard`), botón hamburger
- [x] 3.2 Implementar el drawer lateral izquierdo usando `<dialog>` nativo controlado por React state; el drawer contiene el mismo subárbol que el sidebar desktop (logo, nav, Settings, Logout)
- [x] 3.3 Cablear apertura desde el hamburger y cierre por: click en overlay, ESC (provisto nativamente por `<dialog>`), botón X interno
- [x] 3.4 Aplicar animación de entrada/salida — el drawer usa `@starting-style` (vía variante `starting:` de Tailwind v4) y `transition-behavior: allow-discrete` (utilidad `transition-discrete`) para que el slide-in y el fade del `::backdrop` sobrevivan al toggle `display: none ↔ block` nativo del `<dialog>`. Respeta `prefers-reduced-motion` con `motion-reduce:transition-none`.
- [x] 3.5 Asegurar que el sidebar desktop está oculto bajo `md` (`hidden md:flex`) y que la topbar mobile está oculta sobre `md`
- [x] 3.6 Verificar accesibilidad: el drawer atrapa focus, ESC lo cierra, el overlay tiene `aria-hidden="true"`, el hamburger tiene `aria-label` y `aria-expanded`

## 4. Web — integración con el layout

- [x] 4.1 Actualizar `apps/web/app/(app)/layout.tsx`: eliminar el import y render de `<Header />`, sustituirlo por `<AppShell />` envolviendo el `<main>`
- [x] 4.2 Eliminar el archivo `apps/web/app/(app)/_components/header.tsx`
- [x] 4.3 Eliminar `apps/web/app/(app)/_components/sidebar.tsx`, `sidebar-context.tsx` y `sidebar-toggle.tsx` previos — sidebar.tsx unificaba los tres exports en un único archivo; ahora todo vive en `app-shell.tsx`
- [x] 4.4 Verificar que no quedan imports rotos en otras pantallas web (`grep -r "from.*header"` dentro de `app/(app)`)
- [x] 4.5 Smoke test manual: login → dashboard → navegar entre todos los items del sidebar → verificar estado activo correcto en cada uno
- [x] 4.6 Smoke test mobile: misma navegación bajo viewport 375px, abrir/cerrar drawer por hamburger, click fuera, ESC, botón X interno

## 5. Mobile — mirror de tokens

- [x] 5.1 Crear `apps/mobile/lib/colors.ts` exportando los valores hex de los tokens que la nav consume (`navy`, `positive`, `error`, `text`, `textSoft`, `card`, `borderSoft`) — manteniendo paridad con `packages/ui-tokens/src/theme.css`
- [x] 5.2 Documentar en el header del archivo que esto es un mirror temporal hasta que exista el codegen TS desde `theme.css` (referencia memoria `project_ui_tokens_tailwind_v4`)

## 6. Mobile — TabBar (visual y comportamiento)

- [x] 6.1 Reescribir `apps/mobile/components/layout/TabBar.tsx` para separar el renderizado en dos branches: pestañas de navegación (Dashboard / Movimientos / Tarjetas) vs slot de menú
- [x] 6.2 Renderizar el slot de menú como `<Pressable>` circular (~52px), `bg-positive` (importado desde `apps/mobile/lib/colors.ts`), ícono `MoreHorizontal` en blanco, sin label
- [x] 6.3 Eliminar los literales `#0B1A2B` y `#8A94A3`; reemplazarlos por imports de `apps/mobile/lib/colors.ts`
- [x] 6.4 Cambiar el estado activo de las pestañas de navegación: ícono y label en `colors.positive`, font weight bold en label
- [x] 6.5 Estado inactivo: `colors.textSoft` para ícono y label
- [x] 6.6 Agregar un indicador visual sobre el ícono activo (pill o barra corta) en `colors.positive`
- [x] 6.7 Agregar `rounded-t-xl` a la `<View>` del tab bar, mantener `bg-card` y `border-t border-border-soft`
- [x] 6.8 Aumentar el padding vertical superior del tab bar (`pt-[14px]` en lugar de `pt-[10px]`)
- [x] 6.9 Verificar visualmente en iOS simulator y Android emulator (o real device): proporción del botón circular, alineación con las pestañas, safe area respetada

## 7. Mobile — AppMenu sheet

- [x] 7.1 Reemplazar literales de color en `apps/mobile/components/layout/AppMenu.tsx` por tokens / imports de `apps/mobile/lib/colors.ts`
- [x] 7.2 Agregar feedback de press en los items del sheet: `active:bg-emerald-soft` para items normales; `active:bg-error-soft` para el item destructivo "Salir" (se usan los tokens soft pre-bakeados de `tokens.cjs`)
- [x] 7.3 Verificar visualmente que el sheet sigue abriendo y cerrando correctamente, y que el feedback se ve durante el press (incluyó fix Android: `statusBarTranslucent` + `navigationBarTranslucent` en el Modal para que el overlay cubra status/nav bar)

## 8. Verificación y cierre

- [x] 8.1 Correr `pnpm --filter web lint && pnpm --filter web build`; resolver errores que aparezcan
- [x] 8.2 Correr `pnpm --filter mobile typecheck && pnpm --filter mobile lint`; resolver errores
- [x] 8.3 Correr `pnpm openspec:check`; debe pasar (esta change todavía no se archiva, pero el check estático no debe romperse)
- [ ] 8.4 Tomar screenshots del sidebar desktop, drawer mobile, tab bar mobile y `AppMenu` para incluir en el PR
- [x] 8.5 Crear branch `feature/redesign-navigation-shell` (NO commitear en `main`); abrir PR siguiendo la convención del repo — branch creada; PR queda como follow-up del usuario tras revisión visual
