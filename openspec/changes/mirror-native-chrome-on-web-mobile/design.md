# Design: mirror-native-chrome-on-web-mobile

Handoff visual: `docs/design/web-mobile-chrome/`. El `README.md` de ese bundle tiene el inventario de los dos shells, el mapeo componente→componente y los hallazgos completos. Este documento cubre solo las decisiones técnicas que la implementación necesita resueltas de antemano.

**Estado: las siete decisiones están cerradas y aprobadas.** Las cinco primeras son técnicas y se derivan del código; las decisiones 4 y 5 eran de producto y quedaron confirmadas explícitamente antes de arrancar la implementación. Ninguna se re-abre durante el apply: si algo no cierra, se para y se discute, no se improvisa una alternativa.

## Decisión 1 — El navy rompe el padding con negative margins, no reestructurando el `<main>`

El `PageHeader` web se monta dentro de `<main>`, adentro del wrapper `mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8` (`app-shell.tsx:92`). Una banda navy full-bleed no vive ahí sin romper ese padding.

**Opción A (elegida):** `-mx-4 -mt-5 md:mx-0 md:mt-0` dentro del propio `PageHeader`.
**Opción B (descartada):** el wrapper deja de padear y cada ruta recibe el padding de un `RouteBody` nuevo.

B es la forma correcta y deja el header desacoplado, pero toca todas las rutas y sale del alcance "chrome". A tiene un costo real: el header queda acoplado a los valores de padding del shell, y si alguien cambia `px-4 py-5` el header se desalinea sin que nada falle. Se compensa con un comentario cruzado en los dos archivos, apuntándose mutuamente.

Si B se hace alguna vez, es su propio change y este acoplamiento es lo primero que borra.

## Decisión 2 — Esconder la barra con el teclado se hace con `visualViewport`

El nativo usa `useKeyboardState` de `react-native-keyboard-controller` (`TabBar.tsx:84-92`). La web no tiene equivalente: hay que escuchar `visualViewport.resize` y comparar contra `window.innerHeight`.

**Es la única pieza del change sin referencia nativa reutilizable**, y de ella depende que la barra fija se sostenga: si el teclado la deja flotando sobre sí mismo, la barra no sirve. Por eso va **primero dentro de la fase 2**, no al final.

Consideraciones:

- `window.visualViewport` puede ser `undefined` — el fallback es no esconder nada, que es el comportamiento de hoy.
- El umbral no puede ser un valor fijo en px: se compara la razón entre `visualViewport.height` y `window.innerHeight`, porque las barras de URL de los navegadores mobile también cambian el alto.
- El listener va en el shell, no en cada ruta.

## Decisión 3 — El logout sigue siendo un server action

En el shell actual el logout es un `<form action={logoutAction}>` dentro de `SidebarContent`. Al pasar el menú a bottom sheet, el ítem tiene que seguir siendo un form con su server action, no un `onPress`.

En nativo es un `supabase.auth.signOut()` directo, así que **la referencia nativa no aplica acá**: es el único punto del change donde web no puede calcar al nativo. El sheet web y el `AppMenu` nativo van a tener el mismo aspecto y distinta mecánica, que es exactamente lo que la política Web ↔ Mobile del repo pide.

## Decisión 4 — El `ProfileBlock` se conserva, y se agrega al nativo — **confirmada**

El sidebar web muestra nombre y email arriba de settings/logout. El `AppMenu` nativo no muestra identidad, así que espejo exacto = se pierde en web-mobile.

**Se conserva**, arriba del primer ítem del sheet. Saber con qué cuenta estás logueado importa más en una PWA instalada —donde la sesión es invisible y el navegador puede tener varias— que en una app nativa, donde es evidente.

Consecuencia asumida: para que la paridad no se rompa por la otra punta, el `AppMenu` nativo tiene que sumarlo también. Ese ajuste es de una sola pieza y va en la fase 2, aunque toque `apps/mobile`.

## Decisión 5 — "Compartido" y "Hogar" se unifican en "Hogar" — **confirmada**

`nav.shared` = "Compartido" (sidebar web) y `nav.home` = "Hogar" (tab nativa) apuntan al mismo destino con dos nombres distintos. Espejar sin más dejaría a la web diciendo "Compartido" en desktop y "Hogar" en mobile: una inconsistencia nueva, dentro de la misma app.

Se unifica en **"Hogar"**: es el nombre que el nativo ya usa, y describe mejor un feature de grupo conviviente que un adjetivo genérico. El sidebar de desktop pasa a `nav.home`.

`nav.shared` queda sin uso en navegación. Se conserva en el catálogo: la palabra "Compartido" se sigue usando como adjetivo en otros contextos (badges de movimiento compartido) y sacarla arrastra más de lo que limpia.

## Decisión 6 — El `Drawer` cambia por dentro, el contrato no

`DrawerProps` ya tiene `side` y `widthPx`. Bajo `md` los dos se ignoran y el panel se ancla abajo. Los 17 consumidores siguen pasando lo mismo y **no se editan**. En `md+` no cambia nada.

Dos consumidores necesitan verificación manual: `bank-selector.tsx` y `money-calculator-popover.tsx` leen `useDrawerContainer()` para portalear su contenido dentro del panel — si no, el scroll-lock de `react-remove-scroll` no los deja scrollear (el motivo está en `drawer.tsx:8-15`). Al pasar a sheet ese contenedor cambia de forma y de alto. No rompen el contrato, pero son los únicos dos que hay que probar a mano.

## Decisión 7 — El `MovementDrawer` tapa la tab bar

Es el único overlay montado en el shell y no en una ruta (`MovementDrawerLoader`, `app-shell.tsx:91`), así que está disponible desde cualquier lado. Con barra fija hay que decidir si el sheet la respeta o la tapa.

**La tapa.** Es un flow de creación, no una vista: navegar a otra sección con el formulario a medio llenar no es algo que convenga ofrecer. Coincide con el nativo, que además manda el alta a una pantalla chromeless (`transactions/new`).

Como el sheet lleva campos de texto, depende del manejo de teclado de la decisión 2. Conviene resolverlo en la fase 3, cuando eso ya esté probado con la barra.

## Lo que este change no hace

- **No toca el contenido de ninguna ruta.** Ya se muestra bien en viewport mobile.
- **No toca desktop.** Todo vive bajo `md`.
- **No unifica el slot `actions` de `/transactions`.** Nativo pone ahí el ícono de recurrencias y deja el alta en el FAB; web pone recurrencias en `descriptionExtras` y el alta en el header y el FAB. Es una diferencia de qué se pone en el slot, no de la estructura del chrome. Queda anotada en `docs/design/web-mobile-chrome/mobile/chrome.html`.
- **No revisa el reparto de slots del nativo.** Que Cuentas y Tarjetas cuelguen del menú en vez de tener tab propia es la decisión que se espeja, no una que se re-abre acá.
