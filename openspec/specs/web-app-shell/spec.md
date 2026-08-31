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

`apps/web` SHALL ser usable en viewports menores a 768px. Bajo ese ancho, la navegación SHALL espejar la de la app nativa: el chrome de web-mobile y el de `apps/mobile` presentan la misma estructura, aunque cada plataforma la implemente con sus primitivos.

Bajo 768px:

- El sidebar de desktop SHALL ocultarse.
- NO SHALL renderizarse una topbar con logo y botón hamburger. El componente `TopBarMobile` SHALL ser eliminado del repositorio.
- NO SHALL renderizarse un drawer lateral de navegación. El `Drawer` de navegación del shell SHALL ser eliminado del repositorio.
- Una **tab bar fija** SHALL renderizarse anclada al borde inferior del viewport, con exactamente cuatro slots en este orden: `Inicio` (`/dashboard`), `Movimientos` (`/transactions`), `Hogar` (`/shared`) y un botón de menú. Los tres primeros son tabs de navegación; el cuarto es un botón circular visualmente diferenciado que abre el menú.
- La tab bar SHALL tener fondo `bg-card`, borde superior `border-border-soft`, esquinas superiores redondeadas, y un padding inferior igual a `max(14px, env(safe-area-inset-bottom))`.
- El slot activo SHALL marcarse con una barra indicadora de 3px sobre el ícono, más color `--positive` en ícono y label. Cuando el menú está abierto, ningún slot de tab SHALL marcarse activo.
- El botón de menú SHALL abrir un **bottom sheet** que contiene, en orden: la identidad del usuario (nombre y email), los destinos `Cuentas`, `Tarjetas` y `Configuración`, un divisor, y `Logout` en color `--error`. El sheet SHALL cerrarse al tocar el scrim o su botón de cierre.
- El item de logout del sheet SHALL seguir siendo un `<form>` con el server action `logoutAction`, no un handler de click.
- El estado activo de las tabs SHALL seguir la misma regla de prefix-match con prioridad al match más largo que el sidebar de desktop.

En anchos ≥ 768px (`md` y mayores), la tab bar y el menú sheet NO SHALL renderizarse; el sidebar de desktop ocupa su lugar.

#### Scenario: Bajo 768px aparece la tab bar fija

- **WHEN** un usuario carga la app en un viewport de 375px de ancho
- **THEN** el sidebar de desktop NO está visible
- **AND** NO se renderiza ninguna topbar con botón hamburger
- **AND** una tab bar fija aparece anclada al borde inferior con cuatro slots: Inicio, Movimientos, Hogar y el botón de menú

#### Scenario: El botón de menú abre un bottom sheet

- **WHEN** el usuario presiona el botón de menú de la tab bar
- **THEN** un bottom sheet sube desde el borde inferior por encima de la tab bar
- **AND** el sheet contiene la identidad del usuario, Cuentas, Tarjetas, Configuración, un divisor y Logout
- **AND** ninguna tab de la barra se muestra activa mientras el sheet está abierto

#### Scenario: El logout del sheet conserva el server action

- **WHEN** el usuario presiona Logout dentro del sheet
- **THEN** se envía un `<form>` cuyo action es `logoutAction`
- **AND** la sesión se cierra por el mismo camino que lo hacía desde el sidebar

#### Scenario: Una ruta hija activa la tab padre

- **WHEN** el usuario está en `/transactions/recurring`
- **THEN** la tab "Movimientos" se muestra activa
- **AND** ninguna otra tab se muestra activa

#### Scenario: Sobre 768px no se renderiza tab bar ni sheet

- **WHEN** un usuario carga la app en un viewport de 1280px de ancho
- **THEN** la tab bar NO se renderiza
- **AND** el menú sheet NO está disponible
- **AND** el sidebar de desktop se renderiza en su lugar
### Requirement: La transición del drawer respeta `prefers-reduced-motion`

La transición de entrada y salida del **menú sheet** bajo `md` SHALL respetar `prefers-reduced-motion`. Cuando el usuario declara preferencia por movimiento reducido, el sheet SHALL aparecer y desaparecer sin animación de desplazamiento.

La misma regla SHALL aplicar al scrim que lo acompaña.

#### Scenario: Con movimiento reducido el sheet no se desliza

- **WHEN** el usuario tiene `prefers-reduced-motion: reduce` y abre el menú
- **THEN** el sheet aparece sin transición de desplazamiento
- **AND** el scrim aparece sin transición de opacidad
### Requirement: Los labels de navegación leen del catálogo i18n

Los labels de la navegación —sidebar de desktop, tab bar y menú sheet— SHALL leerse del namespace `nav` de `@grana/i18n-messages`. Ningún label SHALL estar hardcodeado.

El destino compartido (`/shared`) SHALL usar la clave `nav.home` ("Hogar") en **todas** las superficies de navegación de las dos plataformas: sidebar de desktop, tab bar de web-mobile y tab bar nativa. La clave `nav.shared` ("Compartido") SHALL dejar de usarse en navegación; permanece en el catálogo para su uso como adjetivo en otros contextos.

#### Scenario: El destino compartido se llama igual en desktop y en mobile

- **WHEN** un usuario ve el item del destino compartido en el sidebar de desktop
- **AND** el mismo usuario reduce el viewport y ve la tab correspondiente
- **THEN** las dos superficies muestran el mismo label, resuelto desde `nav.home`
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

El elemento `<main>` SHALL ocupar el ancho completo del área disponible (todo el espacio horizontal que queda libre a la derecha del sidebar en desktop, y todo el ancho del viewport en mobile). El cap de ancho de contenido (`max-w-5xl` o el valor que defina el diseño), el centrado horizontal (`mx-auto`) y el padding horizontal SHALL aplicarse a un `<div>` hijo dentro de `<main>`, NO al `<main>` mismo. De esta forma `<main>` es el viewport scrolleable full-width y su scrollbar vertical se pinta pegado al borde derecho del área disponible (borde derecho del viewport, considerando el sidebar como el único hermano horizontal en desktop).

El padding horizontal y vertical del `<div>` hijo SHALL ser responsive: SHALL usar un valor reducido en mobile y un valor mayor a partir del breakpoint `md`, en lugar de un padding fijo igual para todos los anchos. En anchos de mobile (320–420px) el padding horizontal NO SHALL exceder ~16px por lado, de modo que el contenido no se apriete; en `md` y mayores SHALL recuperar el padding holgado de desktop.

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

#### Scenario: El scrollbar vertical se pinta al borde derecho del viewport

- **WHEN** un usuario en desktop (≥ 768px) está en una ruta autenticada con contenido que supera el alto del viewport
- **THEN** el scrollbar vertical del `<main>` se pinta pegado al borde derecho del viewport (no en el borde derecho del bloque de contenido capado por `max-w-5xl`)
- **AND** no queda una franja vertical sin scrollbar entre el bloque de contenido y el borde derecho del viewport

#### Scenario: El cap de ancho vive en un hijo de `<main>`, no en `<main>`

- **WHEN** un desarrollador inspecciona el JSX del shell autenticado
- **THEN** el elemento `<main>` NO contiene clases de ancho máximo (`max-w-*`), centrado horizontal (`mx-auto`) ni padding horizontal (`px-*`)
- **AND** un elemento hijo directo dentro de `<main>` aplica `mx-auto`, el `max-w-*` definido por el diseño y el padding horizontal/vertical
- **AND** `<main>` conserva las clases de viewport scrolleable (`flex-1`, `overflow-y-auto` o equivalentes)

#### Scenario: El padding del contenido se reduce en mobile

- **WHEN** un usuario carga una ruta autenticada en un viewport de 360px de ancho
- **THEN** el `<div>` hijo de `<main>` aplica un padding horizontal reducido (≤ ~16px por lado)
- **AND** en un viewport ≥ 768px el mismo `<div>` aplica el padding holgado de desktop
- **AND** el contenido no presenta scroll horizontal en el viewport de 360px

### Requirement: El sidebar organiza su contenido en header fijo, nav scrolleable y footer sticky

El sidebar island SHALL estructurar su contenido en tres zonas verticales:

- **Header fijo**: el logo `grana` arriba, que NO scrollea (`flex-shrink:0`).
- **Nav central scrolleable**: la navegación primaria ocupa la zona central flexible (`flex:1; min-height:0`) y SHALL scrollear internamente (`overflow-y:auto`) cuando los ítems superan el alto disponible del island.
- **Footer sticky**: Configuración + Cerrar sesión quedan anclados al fondo del island (`flex-shrink:0`), separados de la zona scrolleable por un divisor.

El footer (Configuración, Cerrar sesión) SHALL permanecer alcanzable sin importar cuántos ítems de navegación existan. Este requirement complementa el requirement "El `<main>` es el contenedor scrollable; el body no scrollea": el scroll de la nav es **interno al island** y es independiente del scroll del `<main>`.

#### Scenario: El sidebar muestra header arriba, nav al medio y footer al fondo

- **WHEN** un usuario carga la app en un viewport ≥ 768px
- **THEN** el logo `grana` aparece fijo en la parte superior del island
- **AND** la navegación primaria aparece en la zona central
- **AND** Configuración y Cerrar sesión aparecen al fondo del island, separados por un divisor

#### Scenario: La nav scrollea internamente cuando los ítems superan el alto

- **WHEN** la cantidad de ítems de navegación supera el alto disponible del island
- **THEN** la zona de navegación scrollea internamente
- **AND** el logo (header) y el footer (Configuración, Cerrar sesión) permanecen fijos y visibles

#### Scenario: El footer es siempre alcanzable

- **WHEN** el island tiene muchos ítems de navegación
- **THEN** Configuración y Cerrar sesión siguen visibles al fondo sin necesidad de scrollear el contenido de la página

### Requirement: La tab bar se muestra sólo en los tabs reales, y toda sección del menú declara su propia salida

La tab bar de web-mobile SHALL ocultarse en las rutas que no pertenecen a un tab, espejando la regla de `mobile-app-shell`. Son dos conjuntos disjuntos:

- **Secciones chromeless:** todo pathname bajo `/accounts`, `/cards` o `/settings` — exactamente las secciones alcanzadas desde el menú. Ninguna es un tab, así que la barra solo se mostraría desapegada y sin ningún slot marcado.
- **Pantallas chromeless:** `/transactions/new`, `/shared/settle`, `/shared/settings` y `/shared/cuenta-corriente` — flows que viven dentro del stack de un tab pero se leen como pantalla completa, no como sub-vista del tab.

Ocultar la barra es la mitad del contrato. La otra mitad es obligatoria: **la ruta raíz de cada sección chromeless SHALL declarar un `backLink`** en su `PageHeader`, porque sin tab bar es la única salida visible. El `backLink` SHALL apuntar a un href fijo (`/dashboard`), no a un `history.back()`, para que el destino sea el mismo viniendo del menú, de un deep link o de un link del dashboard.

#### Scenario: Las secciones del menú renderizan sin tab bar

- **WHEN** un usuario navega a `/accounts`, `/cards` o `/settings` en un viewport de 375px
- **THEN** la tab bar NO se renderiza
- **AND** el `PageHeader` de la ruta raíz muestra un back-link al dashboard

#### Scenario: Un flow de pantalla completa esconde la barra sin salir del tab

- **WHEN** un usuario está en `/transactions` y navega a `/transactions/new`
- **THEN** la tab bar NO se renderiza
- **AND** el `PageHeader` muestra un back-link a `/transactions`

#### Scenario: Una sección chromeless sin back-link es un defecto

- **WHEN** un desarrollador agrega una sección alcanzada desde el menú
- **AND** la ruta raíz de esa sección no declara `backLink`
- **THEN** la pantalla queda sin ninguna salida visible, y eso constituye un incumplimiento de este requirement

### Requirement: La tab bar no se interpone entre el contenido y el teclado

La tab bar SHALL ocultarse mientras el teclado virtual está abierto. Anclada al borde inferior, quedaría apoyada sobre el teclado o entre el teclado y el campo enfocado, comiéndose el espacio vertical que el campo necesita; y no ofrece navegación útil en medio de una edición.

La detección SHALL apoyarse en `window.visualViewport`: se compara la razón entre `visualViewport.height` y `window.innerHeight` contra un umbral, en lugar de un valor fijo en píxeles, porque las barras de URL de los navegadores mobile también alteran el alto disponible. Cuando `window.visualViewport` no existe, el comportamiento SHALL ser no ocultar la barra.

El listener SHALL vivir en el shell, no en cada ruta.

#### Scenario: La barra se retira con el teclado abierto

- **WHEN** el usuario enfoca un campo de texto en un viewport de 375px
- **AND** el teclado virtual se abre
- **THEN** la tab bar deja de renderizarse
- **WHEN** el teclado se cierra
- **THEN** la tab bar vuelve, sin salto de layout

#### Scenario: Sin soporte de visualViewport la barra no se esconde

- **WHEN** la app corre en un navegador donde `window.visualViewport` es `undefined`
- **THEN** la tab bar permanece visible en todo momento
- **AND** no se lanza ningún error

### Requirement: La acción de crear de una ruta vive en su header, no en un FAB

El único botón flotante del producto SHALL ser el de **registrar un movimiento** (`QuickAddFab`), y SHALL aparecer únicamente en las tres raíces de tab: `/dashboard`, `/transactions` y `/shared`.

La acción de crear la entidad que una ruta lista —una cuenta, una tarjeta, una categoría, una subcategoría, una recurrencia— SHALL renderizarse en el slot `actions` del `PageHeader` de esa ruta, **visible en todos los anchos**. NO SHALL alternarse entre un botón de header en desktop y un FAB en mobile.

El fundamento es el mismo que sostiene el resto de esta capability: la acción primaria de una ruta es parte de su chrome, y el chrome no cambia de forma según el viewport. Espeja además lo que ya hace `apps/mobile`, donde ninguna sección alcanzada desde el menú tiene FAB.

Mientras la acción no está disponible (catálogos cargando), el botón SHALL renderizarse `disabled`, no ausente — igual que el resto del chrome del header.

#### Scenario: Crear una cuenta se ofrece desde el header en mobile

- **WHEN** un usuario abre `/accounts` en un viewport de 375px
- **THEN** el header muestra el botón de crear cuenta en su slot `actions`, arriba a la derecha
- **AND** NO se renderiza ningún botón flotante sobre el contenido

#### Scenario: El botón de crear no cambia de forma al ensanchar el viewport

- **WHEN** el mismo usuario ensancha el viewport por encima de `md`
- **THEN** el botón sigue siendo el mismo elemento en el mismo slot
- **AND** no aparece ni desaparece ningún control

#### Scenario: El FAB de movimientos sobrevive donde corresponde

- **WHEN** un usuario abre `/dashboard`, `/transactions` o `/shared` en un viewport de 375px
- **THEN** el `QuickAddFab` se renderiza flotante, despejado de la tab bar
- **AND** es el único botón flotante de toda la app

#### Scenario: Cargando, el botón está pero deshabilitado

- **WHEN** un usuario abre `/cards` y el catálogo de bancos y redes todavía no resolvió
- **THEN** el botón de agregar tarjeta se renderiza en el header en estado `disabled`
- **AND** no aparece de la nada cuando la data llega

### Requirement: El shell compensa el safe-area en viewports con notch

`apps/web` SHALL declarar `export const viewport` en `apps/web/app/layout.tsx` con `viewportFit: 'cover'`. Sin esa declaración, las variables `env(safe-area-inset-*)` resuelven a `0px` y el chrome anclado a los bordes queda tapado por el notch y por la home indicator cuando la PWA corre en modo `standalone`.

Los insets SHALL consumirse mediante tokens de `@grana/ui-tokens`, no mediante llamadas directas a `env()` desde los componentes.

- El `PageHeader` navy SHALL sumar el inset superior a su padding.
- La tab bar SHALL sumar el inset inferior a su padding, con un mínimo de 14px.
- Las rutas de secciones chromeless —que no tienen tab bar que compense— SHALL sumar el inset inferior al padding de su contenedor scrolleable.

#### Scenario: El header navy llega hasta el borde superior

- **WHEN** la PWA corre en modo standalone en un dispositivo con notch
- **THEN** el fondo navy del `PageHeader` se extiende por debajo del notch
- **AND** el título y el back-link quedan por debajo del área ocupada por el notch

#### Scenario: La tab bar respeta la home indicator

- **WHEN** la PWA corre en modo standalone en un dispositivo con home indicator
- **THEN** el padding inferior de la tab bar es al menos el alto de la home indicator
- **AND** ningún slot queda parcialmente cubierto

#### Scenario: Una sección chromeless no termina pegada al borde

- **WHEN** el usuario scrollea hasta el fondo de `/accounts` en un dispositivo con home indicator
- **THEN** el último elemento del contenido queda por encima de la home indicator
