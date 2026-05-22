## ADDED Requirements

### Requirement: La app web tiene un único shell de navegación lateral

`apps/web` SHALL renderizar la navegación de la app autenticada exclusivamente en un sidebar (no en un header). El sidebar SHALL ser el único contenedor de la navegación primaria, secundaria y de la acción de logout. La capability cubre la presentación visual y el comportamiento del shell; los items concretos (Dashboard, Cuentas, Tarjetas, Movimientos, Configuración) son provistos por las capabilities de dominio respectivas.

El sidebar SHALL contener, en orden vertical:

1. Un logo "grana" en el tope, clickable, que navega a `/dashboard`.
2. La navegación primaria al medio (links a destinos de la app).
3. Settings (Configuración) y Logout fijados al pie del sidebar, separados de la nav primaria por un divisor.

El componente `Header` previo (`apps/web/app/(app)/_components/header.tsx`) SHALL ser eliminado del repositorio. El layout autenticado (`apps/web/app/(app)/layout.tsx`) NO SHALL renderizar ningún header sobre el contenido principal.

#### Scenario: El layout autenticado no monta un header

- **WHEN** un usuario autenticado navega a cualquier ruta bajo `(app)/`
- **THEN** el DOM NO contiene ningún elemento `<header>` propio del shell sobre la región `<main>`
- **AND** el sidebar es el único contenedor de navegación visible

#### Scenario: El logo del sidebar lleva al dashboard

- **WHEN** un usuario hace click en el logo "grana" del sidebar
- **THEN** la app navega a `/dashboard` usando `next/link` (sin recarga de página)

#### Scenario: Settings y Logout se mantienen separados de la nav primaria

- **WHEN** un usuario abre el sidebar expandido
- **THEN** los items "Configuración" y "Logout" se renderizan al pie del sidebar
- **AND** un divisor (`<div>` o `<hr>` con `border-border-soft`) los separa visualmente de la nav primaria del medio

### Requirement: El sidebar tiene presentación visual de island flotante

El sidebar SHALL renderizarse como un panel flotante separado del viewport y del contenido principal:

- Margen exterior respecto a las paredes del viewport (~12px en cada lado).
- Esquinas redondeadas en los cuatro lados (no solo a la derecha).
- Sombra sutil (`shadow-sm` o equivalente).
- Padding interior superior e inferior que separe el logo del borde superior y los items de pie del borde inferior.
- Fondo `bg-card` y borde `border-border-soft`.

El contenido principal (`<main>`) SHALL renderizarse en un contenedor adyacente al sidebar, separado por un gap visual (no por borde compartido). En anchos `md` y mayores, sidebar y main coexisten en el mismo viewport.

#### Scenario: El sidebar se ve como un panel flotante en desktop

- **WHEN** un usuario carga la app en un viewport ≥ 768px
- **THEN** el sidebar tiene margen externo respecto al borde izquierdo, superior e inferior del viewport
- **AND** las cuatro esquinas del sidebar están redondeadas
- **AND** el sidebar muestra una sombra sutil

### Requirement: El sidebar usa la paleta de marca para estados

El sidebar SHALL aplicar la paleta de tokens de `@grana/ui-tokens` para todos sus estados visuales. En particular:

- **Item activo (nav primaria):** color de acento `--positive` (emerald) en texto, ícono, y una barra lateral izquierda de 3px sobre el item. El fondo del item activo SHALL ser una variante translúcida del mismo emerald.
- **Item inactivo:** texto `text-text`, ícono `text-text`, hover `bg-page`.
- **Logo:** color `text-navy`.
- **Logout:** texto `text-error`, hover `bg-error/8` (o variante translúcida equivalente).
- **Surface del sidebar:** `bg-card`, borde `border-border-soft`.

Ningún color SHALL estar hardcodeado como hex literal en el sidebar; todos los colores SHALL venir de tokens.

#### Scenario: El item activo se identifica con acento emerald

- **WHEN** un usuario navega a una ruta cubierta por un item del sidebar
- **THEN** ese item se renderiza con texto e ícono en color `--positive`
- **AND** muestra una barra lateral izquierda de 3px en color `--positive`
- **AND** el resto de los items se renderizan en color `text-text`

#### Scenario: El sidebar no contiene literales de color hex

- **WHEN** un desarrollador inspecciona el código fuente del sidebar
- **THEN** no encuentra ningún valor `#RRGGBB` ni `rgb(...)` hardcodeado para colores de la paleta
- **AND** todos los colores se referencian vía clases utilitarias de Tailwind o variables CSS de `@grana/ui-tokens`

### Requirement: El estado activo se computa desde la ruta actual

El sidebar SHALL determinar el item activo a partir del pathname actual usando `usePathname` de `next/navigation`. La regla de matching SHALL ser prefix-match con prioridad al match más largo:

- Un item con `href="/cuentas"` está activo cuando el pathname es `/cuentas` o cualquier ruta hija (`/cuentas/123`, `/cuentas/nueva`).
- Si dos items hacen prefix-match al mismo tiempo (ej. `/` y `/dashboard`), gana el de prefix más largo.

#### Scenario: La ruta raíz activa el item Dashboard

- **WHEN** el usuario está en `/dashboard`
- **THEN** el item "Dashboard" del sidebar se muestra activo
- **AND** ningún otro item se muestra activo

#### Scenario: Una ruta hija activa el item padre

- **WHEN** el usuario está en `/cuentas/123/editar`
- **THEN** el item "Cuentas" del sidebar se muestra activo

### Requirement: La app web es mobile-first bajo el breakpoint `md`

`apps/web` SHALL ser usable en viewports menores a 768px. Bajo ese ancho:

- El sidebar de desktop SHALL ocultarse.
- Una topbar delgada (~56px de alto) SHALL aparecer en la parte superior, conteniendo el logo "grana" (clickable → `/dashboard`) y un botón hamburger a la izquierda.
- El botón hamburger SHALL abrir un drawer lateral izquierdo que contiene exactamente el mismo conjunto de items que el sidebar de desktop (logo, nav primaria, Settings, Logout).
- El drawer SHALL cerrarse al: hacer click fuera de su área, presionar ESC, o presionar un botón de cierre dentro del drawer.
- El estado activo dentro del drawer SHALL seguir la misma regla que en el sidebar de desktop.

En anchos ≥ 768px (`md` y mayores), la topbar y el drawer NO SHALL renderizarse; el sidebar de desktop ocupa su lugar.

#### Scenario: Bajo 768px aparece la topbar con hamburger

- **WHEN** un usuario carga la app en un viewport de 375px de ancho
- **THEN** el sidebar de desktop NO está visible
- **AND** una topbar de ~56px aparece en la parte superior con logo + botón hamburger

#### Scenario: El hamburger abre un drawer lateral

- **WHEN** el usuario presiona el botón hamburger
- **THEN** un drawer se desliza desde el borde izquierdo
- **AND** el drawer contiene logo, nav primaria, Settings y Logout

#### Scenario: El drawer se cierra al hacer click fuera

- **WHEN** el drawer está abierto y el usuario hace click en el overlay (fuera del drawer)
- **THEN** el drawer se cierra

#### Scenario: El drawer se cierra con ESC

- **WHEN** el drawer está abierto y el usuario presiona la tecla `Escape`
- **THEN** el drawer se cierra

#### Scenario: Sobre 768px no se renderiza topbar ni drawer

- **WHEN** un usuario carga la app en un viewport de 1280px de ancho
- **THEN** la topbar mobile NO se renderiza
- **AND** el drawer mobile NO está disponible
- **AND** el sidebar de desktop se renderiza en su lugar

### Requirement: Los labels de navegación leen del catálogo i18n

Los labels visibles de los items del sidebar (Dashboard, Cuentas, Tarjetas, Movimientos, Configuración, Logout) SHALL leer de `@grana/i18n-messages` bajo un namespace `nav.*` (ej. `nav.dashboard`, `nav.accounts`, `nav.cards`, `nav.movements`, `nav.settings`, `nav.logout`). El sidebar NO SHALL contener strings hardcodeados en español ni en ningún idioma.

#### Scenario: Los labels del sidebar son traducibles

- **WHEN** un desarrollador inspecciona el código del sidebar
- **THEN** cada label visible se obtiene vía `useTranslations('nav')` (o `getTranslations` en server)
- **AND** los strings concretos existen en el catálogo de locale por default
