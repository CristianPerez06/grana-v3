# web-app-shell Specification

## Purpose

Define el shell de navegación de `apps/web`: layout sidebar-only para la app autenticada, presentación visual del sidebar como island flotante con la paleta de marca, comportamiento responsive con drawer bajo el breakpoint `md`, y resolución del item activo desde la ruta actual. La capability cubre el envoltorio de navegación; los items concretos (Dashboard, Cuentas, Tarjetas, Movimientos, Configuración) los provee cada capability de dominio.

## Requirements

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

- Margen exterior respecto al viewport (~12px en los lados visibles: izquierdo, superior, inferior).
- Esquinas redondeadas en los cuatro lados.
- Sombra sutil (`shadow-sm` o equivalente).
- Padding interior superior e inferior que separe el logo del borde superior y los items de pie del borde inferior.
- Fondo `bg-card` y borde `border-border-soft`.
- El sidebar SHALL ocupar el alto completo del viewport (menos los márgenes externos).

El contenido principal (`<main>`) SHALL renderizarse en un contenedor adyacente al sidebar, separado por un gap visual (no por borde compartido). En anchos `md` y mayores, sidebar y main coexisten en el mismo viewport.

#### Scenario: El sidebar se ve como un panel flotante en desktop

- **WHEN** un usuario carga la app en un viewport ≥ 768px
- **THEN** el sidebar tiene margen externo respecto al borde izquierdo, superior e inferior del viewport
- **AND** las cuatro esquinas del sidebar están redondeadas
- **AND** el sidebar muestra una sombra sutil
- **AND** el sidebar ocupa el alto completo del viewport (menos el margen externo)

### Requirement: El sidebar usa la paleta de marca para estados

El sidebar SHALL aplicar la paleta de tokens de `@grana/ui-tokens` para todos sus estados visuales. En particular:

- **Item activo (nav primaria):** color de acento `--positive` (emerald) en texto e ícono. El fondo del item activo SHALL ser una variante translúcida del mismo emerald (`bg-positive/8`). El item activo NO SHALL usar barra lateral izquierda ni ningún otro indicador de borde; el realce es exclusivamente por color de texto + fondo translúcido.
- **Item inactivo:** texto `text-text`, ícono `text-text`, hover `bg-page`. Sin borde lateral.
- **Logo:** color `text-navy`.
- **Logout:** texto `text-error`, hover `bg-error/8` (o variante translúcida equivalente). Sin borde lateral.
- **Surface del sidebar:** `bg-card`, borde `border-border-soft`.

Ningún color SHALL estar hardcodeado como hex literal en el sidebar; todos los colores SHALL venir de tokens.

#### Scenario: El item activo se identifica con acento emerald

- **WHEN** un usuario navega a una ruta cubierta por un item del sidebar
- **THEN** ese item se renderiza con texto e ícono en color `--positive`
- **AND** el fondo del item es una variante translúcida del mismo emerald (`bg-positive/8`)
- **AND** el item NO muestra una barra lateral izquierda ni ningún otro borde de acento
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
- El botón hamburger SHALL abrir un drawer full-screen (100% del ancho del viewport) que se desliza desde el borde izquierdo y contiene exactamente el mismo conjunto de items que el sidebar de desktop (logo, nav primaria, Settings, Logout). El drawer ocupa el alto y el ancho completos del viewport mientras está abierto; no es un panel lateral parcial.
- El drawer SHALL cerrarse al presionar ESC o presionar un botón de cierre dentro del drawer. (Cuando el drawer ocupa el viewport completo no hay área de overlay fuera del drawer; el cierre por click-outside es relevante solo si una implementación futura reduce el ancho del drawer.)
- El estado activo dentro del drawer SHALL seguir la misma regla que en el sidebar de desktop.

En anchos ≥ 768px (`md` y mayores), la topbar y el drawer NO SHALL renderizarse; el sidebar de desktop ocupa su lugar.

#### Scenario: Bajo 768px aparece la topbar con hamburger

- **WHEN** un usuario carga la app en un viewport de 375px de ancho
- **THEN** el sidebar de desktop NO está visible
- **AND** una topbar de ~56px aparece en la parte superior con logo + botón hamburger

#### Scenario: El hamburger abre un drawer full-screen

- **WHEN** el usuario presiona el botón hamburger
- **THEN** un drawer se desliza desde el borde izquierdo
- **AND** el drawer ocupa el 100% del ancho y del alto del viewport mientras está abierto
- **AND** el drawer contiene logo, nav primaria, Settings y Logout

#### Scenario: El drawer se cierra con ESC

- **WHEN** el drawer está abierto y el usuario presiona la tecla `Escape`
- **THEN** el drawer se cierra

#### Scenario: Sobre 768px no se renderiza topbar ni drawer

- **WHEN** un usuario carga la app en un viewport de 1280px de ancho
- **THEN** la topbar mobile NO se renderiza
- **AND** el drawer mobile NO está disponible
- **AND** el sidebar de desktop se renderiza en su lugar

### Requirement: La transición del drawer respeta `prefers-reduced-motion`

El drawer SHALL animarse al abrir y cerrar (slide-in horizontal + fade del backdrop) usando CSS nativo basado en `@starting-style` y `transition-behavior: allow-discrete`, de modo que `<dialog>` pueda animar a pesar del toggle `display: none ↔ block`. Cuando el usuario tiene `prefers-reduced-motion: reduce`, la animación SHALL deshabilitarse y la transición SHALL ser instantánea.

#### Scenario: La animación del drawer respeta la preferencia de movimiento reducido

- **WHEN** el sistema operativo del usuario tiene activado "reduce motion"
- **AND** el usuario presiona el botón hamburger
- **THEN** el drawer aparece sin animación de slide
- **AND** el backdrop no realiza un fade visible

### Requirement: Los labels de navegación leen del catálogo i18n

Los labels visibles de los items del sidebar (Dashboard, Cuentas, Tarjetas, Movimientos, Configuración, Logout) SHALL leer de `@grana/i18n-messages` bajo un namespace `nav.*` (ej. `nav.dashboard`, `nav.accounts`, `nav.cards`, `nav.movements`, `nav.settings`, `nav.logout`). El sidebar NO SHALL contener strings hardcodeados en español ni en ningún idioma.

#### Scenario: Los labels del sidebar son traducibles

- **WHEN** un desarrollador inspecciona el código del sidebar
- **THEN** cada label visible se obtiene vía `useTranslations('nav')` (o `getTranslations` en server)
- **AND** los strings concretos existen en el catálogo de locale por default

### Requirement: El sidebar de desktop es colapsable y la preferencia persiste

El sidebar de desktop SHALL soportar dos estados: **expandido** (ancho ~240px, labels visibles junto a los íconos) y **colapsado** (ancho ~64px, solo íconos visibles, logo compacto). El estado por default SHALL ser expandido.

El sidebar SHALL incluir un botón toggle que pertenece al shell de navegación (su DOM y su comportamiento son parte del sidebar, no del `<main>`) y que mantiene su posición relativa al sidebar en ambos estados — el botón NO SHALL cambiar de ubicación dentro del sidebar cuando el usuario alterna entre expandido y colapsado. Visualmente el botón PUEDE renderizarse como un handle en el borde derecho del sidebar (overhanging sobre el límite entre sidebar y `<main>`) o íntegramente dentro del chrome interior; la implementación elige una de las dos opciones y la mantiene. La transición SHALL animar el cambio de ancho (`transition-[width]`, ~200ms).

La preferencia SHALL persistir entre sesiones mediante una cookie `sidebar_collapsed` con valor `'true'` o `'false'`, `maxAge` 1 año, `path /`, `sameSite: lax`. La cookie SHALL leerse en Server Components antes de hidratar el sidebar para evitar flash visual al recargar.

El estado de colapso aplica ÚNICAMENTE al sidebar de desktop (≥ `md`). El drawer mobile NO tiene estado colapsado.

#### Scenario: El usuario colapsa el sidebar

- **WHEN** el usuario presiona el botón toggle del sidebar
- **THEN** el sidebar transiciona a ~64px de ancho
- **AND** los labels se ocultan, solo quedan visibles los íconos
- **AND** la cookie `sidebar_collapsed` se escribe con valor `'true'`

#### Scenario: La preferencia persiste tras recargar

- **WHEN** un usuario con `sidebar_collapsed=true` recarga la página
- **THEN** el sidebar se renderiza ya colapsado desde el primer paint
- **AND** no se produce un flash de sidebar expandido seguido de colapso

#### Scenario: Mobile no usa la preferencia de colapso

- **WHEN** un usuario con `sidebar_collapsed=true` carga la app en un viewport < 768px
- **THEN** el sidebar de desktop NO se renderiza (igual que cuando la cookie está `false`)
- **AND** la topbar + drawer mobile aparecen sin alteraciones

### Requirement: El `<main>` es el contenedor scrollable; el body no scrollea

El `<body>` y los contenedores raíz del layout autenticado (`(app)/layout.tsx`) SHALL tener altura limitada al viewport (`h-screen` o equivalente). Cuando el contenido de una pantalla supera el alto disponible, el scroll vertical SHALL ocurrir dentro del elemento `<main>` (`overflow-y-auto`), NO en el body.

El sidebar SHALL permanecer visible y fijo en pantalla mientras el `<main>` scrollea internamente. El logo y los items de pie del sidebar SHALL ser siempre alcanzables sin scrollear el contenido.

#### Scenario: Scroll de contenido largo no mueve el sidebar

- **WHEN** un usuario está en una pantalla con contenido que supera el alto del viewport
- **AND** scrollea dentro del `<main>`
- **THEN** el sidebar permanece estacionario
- **AND** el logo del sidebar sigue siendo visible en su posición original
- **AND** los items de pie (Configuración, Logout) siguen siendo visibles en su posición original

#### Scenario: El body no scrollea

- **WHEN** un usuario está en una pantalla con contenido largo
- **THEN** la barra de scroll del navegador NO aparece sobre el body
- **AND** la barra de scroll aparece, si acaso, dentro del `<main>`
