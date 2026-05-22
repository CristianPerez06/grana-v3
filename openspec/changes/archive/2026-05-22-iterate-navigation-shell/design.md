## Context

Esta change itera sobre `redesign-navigation-shell` (mergeada el 2026-05-22) que estableció el shell de navegación actual: sidebar floating-island sin colapso en web y tab bar mobile `[Inicio, Movimientos, Tarjetas, Menu]`. El proyecto tiene contexto adicional relevante:

- `apps/web/components/footer/index.tsx` solo monta `<LanguageSwitcher />`. El switcher es un Client Component que invoca `setLocaleAction` para escribir una cookie de locale que next-intl ya lee.
- `apps/mobile/lib/i18n.ts` provee un helper `t(path, params)` que lee del catálogo `es` de `@grana/i18n-messages` por dot-path. Es la forma idiomática del repo para traducciones en RN (no se usa `next-intl` directamente porque next-intl no aplica a Expo).
- `apps/web/app/(app)/settings/page.tsx` ya tiene secciones tematizadas ("Visualización", "Categorías") y consume preferencias persistidas en cookies (`show_cents`).
- La capability `mobile-app-shell` ya cubre la presentación visual del tab bar y de `AppMenu` tras el último archive.

## Goals / Non-Goals

**Goals:**

- Web: sidebar desktop colapsable con persistencia (cookie) y altura completa con scroll interno en `<main>`.
- Mobile: tab bar pasa a `[Inicio, Movimientos, Hogar (disabled), Botón de menú]`; AppMenu pasa a `[Tarjetas, Ahorros (próximamente), Configuración, Salir]`.
- Cross-platform: ambos apps leen labels desde `nav.*`. Unificación: web "Tarjetas" + mobile "Tarjetas" (antes "Mis tarjetas").
- Web: eliminar el `Footer` global; mover el `LanguageSwitcher` a `/settings` como una sección "Idioma".
- Web: el body NO scrollea; el contenedor `<main>` es el único scrollable.

**Non-Goals:**

- No implementar la feature "Hogar" (capability `shared`); solo presentar el slot como disabled.
- No cambiar la lógica de detección de locale ni `setLocaleAction` — solo cambia su punto de entrada.
- No introducir un sistema de feature-flags para tabs disabled; el estado es estático y vive en código.
- No reintroducir el `Header` web.
- No agregar animaciones nuevas al colapso del sidebar más allá del `transition-[width] duration-200` que ya existía en v1.
- No cambiar `Modal` ni `<dialog>` (drawer mobile sigue como está; topbar mobile sigue como está).

## Decisions

### D1. Sidebar colapsable: cookie persisted + server-read

**Decisión:** Persistir el estado de colapso en una cookie `sidebar_collapsed` (`'true'` | `'false'`, `maxAge` 1 año, `path /`, `sameSite: lax`). El valor se lee en el Server Component `apps/web/app/(app)/layout.tsx` y se pasa como `initialCollapsed` al Client Component `AppShell`. El toggle (button dentro del sidebar) llama a un server action `setSidebarCollapsedAction(value: boolean)` que escribe la cookie y dispara `revalidatePath('/', 'layout')`. El Client Component también mantiene su propio `useState` para feedback instantáneo, sincronizado con el server-action vía `startTransition`.

**Por qué:** El mismo patrón que `show_cents` ya usa en `settings`. Server-read elimina el flash de hidratación que tendría una solución basada en `localStorage` + `useEffect`. No requiere middleware ni context provider adicional.

**Alternativa considerada:** `localStorage` + Client Component que monta el sidebar después de leer el storage. Descartada por flash de UI.

**Trade-off:** Una cookie extra por usuario logueado. Minúscula (≤ 20 bytes).

### D2. Sidebar floating-island + altura completa + scroll interno

**Decisión:** El layout `apps/web/app/(app)/layout.tsx` (y/o el `<body>` raíz) pasa a usar `h-screen` (no `min-h-screen`). El contenedor del AppShell es `flex h-full md:flex-row`. El sidebar mantiene `md:my-3 md:ml-3` (margen externo en los tres lados visibles) + `md:rounded-3xl` + `md:shadow-sm` — sigue siendo island. El `<main>` recibe `flex-1 overflow-y-auto`. El sidebar mantiene su scroll interno propio solo si el contenido del sidebar supera el alto (caso poco probable con ~6 items).

**Por qué:** Resuelve dos cosas a la vez: (a) sidebar siempre visible (no hace falta scrollear hasta arriba para ver el logo cuando estás abajo del contenido), (b) lectura "app-like" donde el chrome es estable y solo el content scrollea. Mantiene la estética floating-island ya aprobada.

**Trade-off:** El body deja de scrollear. Cualquier `position: sticky` que dependa de scroll-on-body deja de funcionar. Hoy V3 no tiene ninguno (verificado durante propuesta), pero futuras pantallas con header sticky deberán usar el contenedor de scroll como ancestor.

### D3. Sidebar colapsado: solo íconos, ancho ~64px

**Decisión:** Cuando `collapsed === true`, el sidebar tiene `w-16` (≈ 64px), oculta los labels (`hidden`), centra los íconos (`justify-center`) y el logo se renderiza como un mark compacto (la "g" o el primer carácter de "grana"). Cuando `collapsed === false`, ancho `w-64` (≈ 240px). Transición `transition-[width] duration-200`. El botón toggle vive **dentro del sidebar**, en el header del mismo (al lado del logo cuando expandido, debajo del logo cuando colapsado), ícono `PanelLeftClose` / `PanelLeftOpen` según estado.

**Por qué:** Toggle dentro del sidebar es lo idiomático en SaaS (Linear, Notion, Stripe). Logo compacto evita texto recortado horrible cuando colapsa.

**Alternativa considerada:** logo se oculta cuando colapsa, dejando solo el toggle arriba. Descartada: pérdida de identidad visual.

### D4. Mobile tabs: Hogar disabled como slot visible

**Decisión:** El `Tabs.Screen` para `home` (Hogar) se mantiene como ruta registrada pero con `href: null` (igual al patrón usado por `accounts` hoy), por lo que Expo Router no genera link automático. El `TabBar` recibe la ruta y la renderiza con treatment "disabled": ícono y label con `opacity-50`, `onPress` no hace nada, `accessibilityState={{ disabled: true }}`, `accessibilityHint` indica "Próximamente".

Tarjetas deja de tener un `Tabs.Screen` en el shell de tabs; queda como ruta navegable solo desde el `AppMenu`. La ruta `apps/mobile/app/(app)/tarjetas/...` sigue existiendo y accesible vía deep link y navegación programática (`router.push('/tarjetas')`).

**Por qué:** No requiere meta-infra (feature flags, lookup tables). Mantiene la implementación cerca del código. Permite "activar" Hogar en el futuro con un cambio quirúrgico (sacar el `disabled` y agregar el `href`).

**Alternativa considerada:** ocultar Hogar hasta que esté implementada. Descartada por la decisión de producto: el usuario quiere comunicar que la feature viene, no esconderla.

### D5. Mobile labels desde `@grana/i18n-messages`

**Decisión:** El `AppMenu` y el `TabBar` mobile pasan a importar `t` desde `apps/mobile/lib/i18n.ts` y resolver los labels desde el catálogo. Las keys consumidas:

- `nav.dashboard` (existe) → "Inicio"
- `nav.movements` (existe) → "Movimientos"
- `nav.home` (NUEVA) → "Hogar"
- `nav.cards` (existe) → "Tarjetas"  *(reemplaza "Mis tarjetas")*
- `nav.savings` (NUEVA) → "Ahorros"
- `nav.settings` (existe) → "Configuración"
- `nav.logout` (existe) → "Cerrar sesión" *(reemplaza "Salir")*
- `nav.coming_soon` (NUEVA) → "Próximamente" (badge en items disabled)

**Por qué:** Single source para labels. Cuando se traduzca al inglés (o cualquier locale), no hay strings huérfanos en componentes RN.

**Trade-off:** El helper `t()` mobile hoy solo lee `es`. Cuando agreguemos selector de locale en mobile, este helper debe poder leer dinámicamente del locale activo. Out of scope para esta change; queda como follow-up cuando aterrice locale-switching en mobile.

### D6. Footer eliminado; Idioma en `/settings`

**Decisión:** Borrar `apps/web/components/footer/index.tsx`. Mover `apps/web/components/footer/language-switcher.tsx` a `apps/web/app/(app)/settings/_components/language-switcher.tsx` (junto a `show-cents-toggle.tsx`). Renombrar las keys i18n usadas internamente de `footer.language` / `footer.language_es` / `footer.language_en` a `settings.language.label` / `settings.language.es` / `settings.language.en`. La nueva sección "Idioma" en `/settings/page.tsx` renderiza el switcher debajo de "Visualización" siguiendo el mismo patrón de card.

**Por qué:** El `LanguageSwitcher` ya es un componente client autónomo y solo se usa dentro del footer. Moverlo es un rename + re-import.

**Trade-off:** Las keys `footer.*` en `i18n-messages` quedan obsoletas tras el move. Se pueden eliminar como parte de la misma change (compatibilidad innecesaria — no hay consumidores externos).

### D7. Naming convention para items del menú: alineado con el catálogo

**Decisión:** Una sola lista canónica de tuples `{ key, route, icon, where }` (ej. `[{ key: 'cards', route: '/cards', icon: CreditCard, where: 'menu' }, ...]`) en cada app. Los labels SHALL venir del catálogo via `nav[key]`. Si un item cambia de "tab" a "menu" en mobile (como Tarjetas en esta change), solo cambia el campo `where` en la lista; el label, la ruta y el ícono quedan iguales.

**Por qué:** Facilita futuras reorganizaciones (otra change que quiera mover X de menu a tab no necesita cambiar más que un campo). También deja explícito el contrato cross-platform: ambos apps tienen el mismo set de keys, aunque su distribución (tab vs sheet vs sidebar) sea distinta.

## Risks / Trade-offs

- **[Scroll model change rompe sticky en futuras pantallas]** → si alguien usa `position: sticky` con scroll-on-body, dejará de funcionar. Mitigación: documentar en el spec que el scroll vive en `<main>`. No requiere refactor inmediato.
- **[Sidebar colapsado en mobile no aplica]** → bajo `md` el sidebar está oculto; el toggle es relevante solo en desktop. El estado `sidebar_collapsed` se aplica únicamente al sidebar de desktop, no al drawer mobile.
- **[Cookie de colapso vs primera visita SSR]** → si la cookie no existe, default expandido (`collapsed = false`). Sin flash porque el server ya lee la decisión.
- **[Hogar visible pero disabled puede generar confusión]** → mitigación: badge "Próximamente" + opacity reducida + sin response al press. Usuario entiende que la cosa "viene" sin pensar que es un bug.
- **[next-intl ya tiene `footer.*` keys en uso]** → al migrar a `settings.language.*`, hay que actualizar los catálogos `es` + `en` y borrar las keys viejas en el mismo commit. Riesgo bajo, mecánico.

## Migration Plan

No hay datos a migrar. Pasos en orden:

1. Catálogos i18n: agregar `nav.home`, `nav.savings`, `nav.coming_soon`, mover `footer.*` → `settings.language.*` en `{es,en}.json`.
2. Web: Server action `setSidebarCollapsedAction`; helper `getSidebarCollapsed`. Wire en `layout.tsx`.
3. Web: refactor `app-shell.tsx` para recibir `initialCollapsed`, render condicional w-16 / w-64, toggle button, transición, sidebar full-height, `<main>` scrollable.
4. Web: borrar `Footer`, mover `LanguageSwitcher`, agregar sección Idioma en `/settings`.
5. Mobile: actualizar `Tabs.Screen` en `_layout.tsx` (sacar `tarjetas`, agregar `home` con `href: null`).
6. Mobile: `TabBar.tsx` rendea `home` con treatment disabled; remueve `tarjetas` del slot map. Lee labels desde `t('nav.*')`.
7. Mobile: `AppMenu.tsx` actualiza set de items (`Tarjetas`, `Ahorros`, `Configuración`, `Salir`), labels desde `t('nav.*')`.
8. Verificación: navegación a `/tarjetas` desde el menú abre la ruta correcta; click en la pestaña Hogar no navega; toggle del sidebar persiste tras reload.

**Rollback:** revertir el commit antes del merge a main. Sin datos a deshacer.

## Open Questions

- ¿La sección "Idioma" en `/settings` debería estar antes o después de "Visualización"? Default propuesto: después de Visualización, antes de Categorías.
- ¿El badge "Próximamente" en la pestaña Hogar va arriba del ícono, debajo del label, o sobrepuesto en la esquina? Decisión final en implementación tras review visual.
- ¿La compactación del logo en sidebar colapsado va a ser un SVG monograma `g` o el ícono `LayoutDashboard` del item Dashboard? Default propuesto: una "g" tipográfica en navy que conserva la marca.
