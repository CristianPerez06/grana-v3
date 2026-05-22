## Why

Tras la primera iteración del shell de navegación (change `redesign-navigation-shell`, mergeada en `main` el 2026-05-22), surgieron cinco ajustes que no son polish — cambian *qué* hace el shell y cómo se relacionan los items entre plataformas. Sin ellos, la nav tiene ergonomía limitada en desktop (sidebar fijo ocupa horizontal aún para usuarios que prefieren más espacio para contenido), la jerarquía de tabs mobile prioriza Tarjetas por encima de Hogar (cuando la estrategia de producto es justo al revés: Hogar es diferencial y Tarjetas es funcionalidad core que cabe en el menú), y los labels entre web y mobile divergen (web "Tarjetas" vs mobile "Mis tarjetas"). Además, el `LanguageSwitcher` vive hoy en un footer que sobrevivió de una etapa anterior y rompe la lectura visual del app shell.

## What Changes

### Web (`apps/web`)

- **Sidebar colapsable**: traer de vuelta el toggle icon-rail (~64px) ↔ labeled (~240px) que existía en v1 de la app. Default expandido. La preferencia SHALL persistir entre sesiones mediante una cookie leída en server-side (sin flash de hidratación). Toggle accionable desde un botón dentro del sidebar.
- **Altura completa + scroll interno**: el sidebar floating-island SHALL ocupar el alto completo del viewport (manteniendo `m-3` y `rounded-3xl`). El `<main>` SHALL tener su propio scroll vertical; el body NO scrollea cuando el contenido excede el viewport.
- **Topbar mobile**: se mantiene como está, sin cambios.

### Mobile (`apps/mobile`)

- **Tabs reshuffle**: el tab bar SHALL renderizar `[Inicio, Movimientos, Hogar (disabled), Botón de menú]`. "Tarjetas" deja de ser pestaña.
- **Hogar disabled state**: la pestaña "Hogar" SHALL renderizarse visible pero no presionable (treatment visual de "próximamente") hasta que la capability `shared` se implemente.
- **AppMenu reshuffle**: el sheet SHALL contener `[Tarjetas, Ahorros (próximamente), Configuración, Salir]`. "Hogar" deja de aparecer en el sheet (subió al tab bar). "Mis tarjetas" se renombra a "Tarjetas" para unificar.

### Cross-platform — labels (`@grana/i18n-messages`)

- Agregar keys `nav.home` y `nav.savings` al namespace `nav.*` existente.
- Tanto el sidebar web como el `AppMenu` mobile SHALL leer todos sus labels desde `nav.*`. Hoy el `AppMenu` los tiene hardcodeados — pasan a `useTranslations('nav')`.

### Settings + root layout (`apps/web`)

- **BREAKING** Eliminar el componente `Footer` (`apps/web/components/footer/index.tsx`) y su uso en `apps/web/app/layout.tsx`. La barra inferior con el `LanguageSwitcher` deja de existir.
- **Configuración**: agregar una sección "Idioma" en `/settings` que aloja al `LanguageSwitcher`. La preferencia ya está persistida (next-intl cookie); solo cambia el punto de entrada visual.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-app-shell`: el sidebar pasa de ser siempre expandido a soportar colapso persistente (cookie); cambia el modelo de scroll para que el body no scrollee y el `<main>` sea el contenedor scrollable; el sidebar floating-island ahora ocupa altura completa del viewport. Estas son modificaciones a los requirements de presentación visual y comportamiento existentes.
- `mobile-app-shell`: cambia el conjunto de slots del tab bar y el set de items del `AppMenu`. Se introduce un estado "disabled" para slots de tab que apuntan a features no implementadas. Los labels del `AppMenu` pasan a leerse desde `nav.*` (hoy están hardcodeados en el componente).
- `settings`: agrega "Idioma" como preferencia accesible desde `/settings`. El `LanguageSwitcher` ya existe; solo cambia su ubicación.

## Impact

- **Código afectado (web):**
  - Modificar: `apps/web/app/(app)/_components/app-shell.tsx` (colapso, scroll layout, altura completa).
  - Modificar: `apps/web/app/(app)/layout.tsx` (leer cookie de colapso, pasarla como prop al Client Component).
  - Modificar: `apps/web/app/layout.tsx` (quitar `<Footer />`, ajustar wrapper si es necesario).
  - Modificar: `apps/web/app/(app)/settings/` (agregar la sección de Idioma; ubicación exacta a decidir en design.md).
  - Eliminar: `apps/web/components/footer/index.tsx`. Mover `apps/web/components/footer/language-switcher.tsx` a `apps/web/components/settings/language-switcher.tsx` (o equivalente) si conserva utilidad fuera del footer.
- **Código afectado (mobile):**
  - Modificar: `apps/mobile/app/(app)/_layout.tsx` (cambiar `Tabs.Screen` slots).
  - Modificar: `apps/mobile/components/layout/TabBar.tsx` (renderizar Hogar disabled; quitar Tarjetas como tab).
  - Modificar: `apps/mobile/components/layout/AppMenu.tsx` (cambiar items y leer labels desde i18n).
  - Posible nuevo: helper para hook de traducciones mobile (`useTranslations` provisto por `next-intl` no aplica directamente en RN; el repo tiene un helper en `@grana/i18n-messages` — confirmar en design.md).
- **i18n:**
  - Agregar keys `nav.home`, `nav.savings`, `nav.coming_soon` (badge "Próximamente") a `packages/i18n-messages/src/{es,en}.json`.
- **Cookies:**
  - Nueva cookie `sidebar_collapsed` (`'true'` | `'false'`), `maxAge` 1 año, `path /`, `sameSite: lax`. Server action para escribir.
- **Riesgo:** el cambio de scroll model (`body` deja de scrollear; `<main>` scrollea) puede afectar comportamiento de páginas con `position: sticky` ya colocadas (no hay ninguna identificada en V3 al momento, pero verificar en implementación).
- **Riesgo bajo:** Sub-rutas internas de `cards/` siguen accesibles desde `/cards`; la única superficie afectada es la navegación primaria visible. Deep links a `/cards/...` siguen funcionando.
