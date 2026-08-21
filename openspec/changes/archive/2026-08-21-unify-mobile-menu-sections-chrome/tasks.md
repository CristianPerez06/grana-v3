## 1. Spec

- [x] 1.1 Delta `specs/mobile-app-shell/spec.md` con los dos requirements `ADDED`: el contrato de dos mitades (tab bar sólo en los tabs reales + toda sección de `CHROMELESS_SECTIONS` declara `backLink` al dashboard, con la aclaración de que `['home', 'settings']` es otra regla) y la compensación del safe-area inferior
- [x] 1.2 Delta `specs/page-header/spec.md` con el requirement `ADDED` del back-link canónico en raíces de sección chromeless (mobile): `href` fijo, visible desde el primer paint, altura de header sin cambios, tabs reales sin back-link
- [x] 1.3 `openspec validate unify-mobile-menu-sections-chrome` pasa

## 2. Tab bar — Configuración pasa a chromeless

- [x] 2.1 Agregar `'settings'` a `CHROMELESS_SECTIONS` en `apps/mobile/components/layout/TabBar.tsx` y actualizar el comentario de arriba: la lista es exactamente "las secciones alcanzables desde el botón … del tab bar"
- [x] 2.2 Verificar que la entrada `['home', 'settings']` de `CHROMELESS_SCREENS` queda intacta y que la detección por `parts[0]` no la cruza

## 3. Back-link en las tres pantallas raíz

- [x] 3.1 `apps/mobile/components/cards/CardsHeader.tsx`: pasar `backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}` al `PageHeader` (dentro del componente, sin back-link suelto encima)
- [x] 3.2 `apps/mobile/app/(app)/settings/index.tsx`: mismo `backLink` en su `PageHeader`
- [x] 3.3 Verificar que `apps/mobile/app/(app)/accounts/index.tsx` sigue igual — es la referencia de forma, no se toca
- [x] 3.4 Confirmar que no se usa `onBackPress`/`router.back()` en ninguna de las tres y que `nav.dashboard` existe en `es` y `en`

## 4. Safe-area inferior en las secciones chromeless

- [x] 4.1 `accounts/index.tsx`: partir el `py-6` del `ScrollView` raíz en `pt-6` (className) + `contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}` vía `useSafeAreaInsets`, como `AuthShell`
- [x] 4.2 `cards/index.tsx`: idem
- [x] 4.3 `settings/index.tsx`: idem
- [x] 4.4 Verificar que las pantallas pusheadas por `FormScreen` no se tocan (ya traen `pb-28`)

## 5. Verificación

- [x] 5.1 Por cada sección (Cuentas, Tarjetas, Configuración) entrando desde el botón …: sin tab bar, `← Inicio` arriba del título con `text-sm text-navy-muted`, y presionarlo lleva al dashboard
- [x] 5.2 El back-link se ve desde el primer paint en `/cards`, antes de que resuelva el conteo de tarjetas
- [x] 5.3 La altura del header no cambió en `/cards` ni `/settings` respecto de antes (el spacer `h-5` se reemplaza por la fila del link)
- [x] 5.4 Los tres tabs reales (Inicio, Movimientos, Hogar) siguen con tab bar y sin back-link
- [x] 5.5 Las hijas de las tres secciones (`/cards/new`, `/cards/[id]`, `/accounts/[id]`, `/settings/categories/**`) siguen con su back-link al parent, sin doble header y sin tab bar
- [x] 5.6 `/transactions/new` y las subpantallas de Hogar (`settle`, `settings`, `cuenta-corriente`) siguen chromeless como hoy
- [x] 5.7 En Configuración, la última fila del scroll no queda tapada por el home indicator
- [x] 5.8 Web: sin cambios en `/accounts`, `/cards` ni `/settings`
- [x] 5.9 `pnpm lint:mobile`, `pnpm typecheck:mobile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm openspec:check` en verde

## 6. Archivo

- [x] 6.1 Mover la carpeta a `openspec/changes/archive/2026-08-21-unify-mobile-menu-sections-chrome/`
- [x] 6.2 Integrar los deltas en `openspec/specs/mobile-app-shell/spec.md` y `openspec/specs/page-header/spec.md` (sin secciones de delta en el master)
- [x] 6.3 `pnpm openspec:check` pasa en la rama
