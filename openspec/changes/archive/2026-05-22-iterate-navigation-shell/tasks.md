## 1. i18n catalog

- [x] 1.1 Agregar `nav.home`, `nav.savings`, `nav.coming_soon` (más `nav.expand_sidebar` / `nav.collapse_sidebar` / `nav.more_options` consumidos por la implementación) a `packages/i18n-messages/src/es.json` y `en.json`
- [x] 1.2 Migrar keys `footer.language`, `footer.language_es`, `footer.language_en` a `settings.language.label`, `settings.language.es`, `settings.language.en` en ambos locales; eliminar la sección `footer` de los catálogos

## 2. Web — sidebar collapse + persistencia

- [x] 2.1 Crear `apps/web/lib/sidebar-preferences.ts` con `getSidebarCollapsed(): Promise<boolean>` (lee cookie `sidebar_collapsed`) — implementado dentro de `apps/web/lib/preferences.ts` para mantener un único módulo de cookie-prefs (junto a `getShowCents`)
- [x] 2.2 Crear server action `apps/web/app/_actions/set-sidebar-collapsed.ts` (`setSidebarCollapsedAction(value: boolean)` escribe cookie con `maxAge` 1 año) — implementado como export adicional `setSidebarCollapsed` en `apps/web/app/_actions/preferences.ts` (no llama `revalidatePath` para que el toggle sea instantáneo client-side)
- [x] 2.3 Modificar `apps/web/app/(app)/layout.tsx` para leer `getSidebarCollapsed()` y pasar `initialCollapsed` al `<AppShell />`
- [x] 2.4 Modificar `app-shell.tsx` para aceptar `initialCollapsed`, mantener estado local con `useState`, y disparar la server action en cada toggle (vía `startTransition`)
- [x] 2.5 Render condicional en el sidebar: `w-64` cuando expandido, `w-16` cuando colapsado; transición `transition-[width] duration-200`
- [x] 2.6 Botón toggle: ícono `PanelLeftClose` / `PanelLeftOpen`, ubicado en el chrome del sidebar; cuando colapsado el logo se reduce a una "g" tipográfica en navy
- [x] 2.7 Ocultar labels y centrar íconos cuando colapsado; mostrar tooltip nativo (`title` attr) con el label
- [ ] 2.8 Verificar que el item activo conserva su acento emerald en ambos estados

## 3. Web — scroll model (sidebar full-height + main scrollable)

- [x] 3.1 Modificar `apps/web/app/layout.tsx` para que el `<body>` use `h-full` y el wrapper interior use `flex-1 min-h-0` (en lugar de `min-h-full flex flex-col`)
- [x] 3.2 Modificar `app-shell.tsx` para que el contenedor outer use `flex h-full flex-1 flex-col md:flex-row md:overflow-hidden`
- [x] 3.3 Eliminar margen inferior/superior absoluto del sidebar de modo que ocupe el alto completo (mantener `md:my-3 md:ml-3` para margen externo)
- [x] 3.4 Aplicar `flex-1 md:overflow-y-auto` al `<main>` para que sea el único contenedor scrollable
- [x] 3.5 Verificar que `position: sticky` no se usa en pantallas existentes — `grep -rn "sticky" apps/web/app` no devuelve matches
- [ ] 3.6 Smoke test: navegar a una pantalla con contenido largo, verificar que el sidebar se mantiene fijo

## 4. Web — eliminar footer, mover LanguageSwitcher a /settings

- [x] 4.1 Mover `apps/web/components/footer/language-switcher.tsx` a `apps/web/app/(app)/settings/_components/language-switcher.tsx`
- [x] 4.2 Actualizar el componente movido para usar `useTranslations('settings.language')` en lugar de `useTranslations('footer')`
- [x] 4.3 Modificar `apps/web/app/(app)/settings/page.tsx` para agregar la sección "Idioma" (después de "Visualización", antes de "Categorías") que renderiza `<LanguageSwitcher />`
- [x] 4.4 Eliminar `apps/web/components/footer/index.tsx` y la importación + uso de `<Footer />` en `apps/web/app/layout.tsx`
- [x] 4.5 Eliminar el directorio `apps/web/components/footer/` si queda vacío

## 5. Mobile — tab bar reshuffle (Hogar disabled, sin Tarjetas)

- [x] 5.1 Modificar `apps/mobile/app/(app)/_layout.tsx`: cambiar el set de `<Tabs.Screen />` para que sea `dashboard`, `movimientos`, `home`, `menu` visibles, con `tarjetas` y `accounts` ocultos via `href: null`. Crear `apps/mobile/app/(app)/home.tsx` como placeholder (export `null`) ya que Expo Router requiere el archivo de ruta
- [x] 5.2 Modificar `apps/mobile/components/layout/TabBar.tsx` para que el mapeo de slots use `kind: 'tab' | 'tab-disabled' | 'menu'` y el slot `home` se renderice disabled (ícono `Users`, opacity-50, badge "Próximamente", no responde al press)
- [x] 5.3 Importar `t` desde `apps/mobile/lib/i18n.ts` en el TabBar y reemplazar todos los labels por `t('nav.<key>')`

## 6. Mobile — AppMenu reshuffle + i18n

- [x] 6.1 Modificar `apps/mobile/components/layout/AppMenu.tsx`: items pasan a ser Tarjetas, Ahorros (comingSoon), Configuración, divisor, Salir. "Hogar" deja de aparecer aquí
- [x] 6.2 Importar `t` desde `apps/mobile/lib/i18n.ts` y reemplazar todos los labels. "Más opciones" usa `nav.more_options`
- [x] 6.3 Para Tarjetas, usar la ruta `/tarjetas` (Expo Router) y `router.push()` desde el onPress
- [x] 6.4 Confirmar que "Salir" lee `nav.logout` (no "Salir" literal)
- [ ] 6.5 Smoke test mobile: abrir menu, presionar Tarjetas → la ruta `tarjetas` carga correctamente
- [x] 6.6 Configuración del menu queda sin navegación efectiva en mobile — el item cierra el sheet. La pantalla mobile `/settings` no existe todavía; navegación real es follow-up cuando el módulo settings tenga superficie mobile. Spec ajustada para reflejarlo

## 7. Verificación y cierre

- [x] 7.1 Correr `pnpm --filter web lint && pnpm --filter web build`
- [x] 7.2 Correr `pnpm --filter mobile typecheck && pnpm --filter mobile lint`
- [x] 7.3 Correr `pnpm openspec:check`
- [ ] 7.4 Smoke desktop: colapsar/expandir sidebar (verificar persistencia tras reload), navegar entre items, verificar que el sidebar se queda fijo cuando el contenido scrollea
- [ ] 7.5 Smoke desktop < `md`: verificar que el toggle no aparece, que la topbar mobile + drawer siguen funcionando como antes
- [ ] 7.6 Smoke mobile: tab bar muestra Inicio / Movimientos / Hogar (próximamente, no clickable) / botón de menú; el menú muestra Tarjetas / Ahorros / Configuración / Salir; navegación a Tarjetas funciona
- [ ] 7.7 Smoke /settings: la sección "Idioma" aparece y cambia el locale; el footer global ya no existe
- [x] 7.8 Crear branch `feature/iterate-navigation-shell` — branch creada al inicio del apply; commit + archive + PR quedan para confirmación del usuario tras la verificación visual
