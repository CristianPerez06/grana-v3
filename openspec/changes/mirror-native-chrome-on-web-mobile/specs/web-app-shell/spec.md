## MODIFIED Requirements

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

## ADDED Requirements

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
