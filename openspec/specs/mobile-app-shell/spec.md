# mobile-app-shell Specification

## Purpose

Asegura las condiciones de base para que `apps/mobile` (Expo) pueda construir features sobre paquetes compartidos del workspace: arranque limpio de la app, resolución correcta de los paquetes `@grana/*` desde Metro sin un build step adicional, y type-check + lint pasando sin errores. No define features de producto; cada feature mobile se especifica dentro de la capability de su dominio (`auth`, `dashboard`, `onboarding`, etc.) con tags `(mobile)`.
## Requirements
### Requirement: La app mobile arranca correctamente

`apps/mobile` SHALL ser un proyecto Expo válido que arranque sin errores en el simulador de iOS o en un dispositivo Android. La pantalla raíz SHALL resolver el estado de sesión de Supabase y redirigir al usuario al área correspondiente — sin pasar por una pantalla placeholder.

La resolución inicial vive en `app/index.tsx`: se llama a `supabase.auth.getSession()` y se emite `<Redirect />` durante el render. El `app/_layout.tsx` raíz suscribe `supabase.auth.onAuthStateChange` y reacciona a `SIGNED_IN` / `SIGNED_OUT` redirigiendo a `(app)/dashboard` o `(auth)/login` respectivamente. Las rutas autenticadas viven bajo el grupo `(app)/`; las no autenticadas, bajo `(auth)/`.

Una vez aterrizado en `(app)/dashboard`, la pantalla SHALL renderizar el dashboard completo (las cuatro secciones definidas por la capability `dashboard`) y NO un placeholder de texto. La responsabilidad de implementar esa pantalla vive en la capability `dashboard`; el shell solo provee la ruta y el shell de tabs/menú a su alrededor.

#### Scenario: El dev server arranca desde la raíz del monorepo

- **WHEN** un desarrollador ejecuta `pnpm dev:mobile` desde la raíz del monorepo
- **THEN** el servidor de desarrollo de Expo arranca sin errores de resolución de módulos
- **AND** el QR code o la URL de dev client quedan disponibles en la terminal

#### Scenario: Arranque sin sesión activa lleva a login

- **WHEN** un usuario abre la app sin haber iniciado sesión nunca (o tras un `signOut`)
- **THEN** `app/index.tsx` resuelve `getSession()` con `null`
- **AND** la app aterriza en `(auth)/login` sin renderizar ninguna pantalla intermedia más allá del `ActivityIndicator` momentáneo

#### Scenario: Arranque con sesión activa lleva al dashboard renderizado

- **WHEN** un usuario abre la app con una sesión válida persistida en `expo-secure-store`
- **THEN** `app/index.tsx` resuelve `getSession()` con una sesión
- **AND** la app aterriza en `(app)/dashboard` con el dashboard renderizado (Hero, Lo que viene, Balance del mes, Tarjetas)
- **AND** la pantalla NO muestra el placeholder de texto "Dashboard"

### Requirement: El seam con los paquetes del workspace está preparado

`apps/mobile` SHALL tener Metro y TypeScript configurados de modo que cualquier importación futura de `@grana/*` resuelva correctamente, tanto en tiempo de compilación como en tiempo de ejecución, sin cambios adicionales de configuración.

#### Scenario: TypeScript resuelve los path aliases de @grana/*

- **WHEN** un desarrollador agrega `import type { Database } from '@grana/supabase'` en cualquier archivo de `apps/mobile`
- **THEN** `tsc --noEmit` no reporta errores de resolución de módulos para ese import

#### Scenario: Metro encuentra los paquetes del workspace

- **WHEN** el bundle de Metro se genera con al menos un import real de `@grana/*`
- **THEN** Metro resuelve el módulo sin `Unable to resolve module` ni errores de symlink

### Requirement: El proyecto pasa type-check y lint sin errores

`apps/mobile` SHALL pasar `tsc --noEmit` y ESLint sin errores en un checkout limpio. Esto asegura que el scaffold es una base sólida para trabajo futuro.

#### Scenario: Type-check limpio en checkout fresco

- **WHEN** un desarrollador ejecuta `pnpm --filter mobile typecheck` en un checkout limpio
- **THEN** TypeScript no reporta ningún error

#### Scenario: Lint limpio en checkout fresco

- **WHEN** un desarrollador ejecuta `pnpm --filter mobile lint` en un checkout limpio
- **THEN** ESLint no reporta ningún error ni warning que bloquee el build

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria. La composición de slots del tab bar SHALL ser, en orden:

1. **Inicio** (route `dashboard`) — pestaña habilitada.
2. **Movimientos** (route `transactions`) — pestaña habilitada.
3. **Hogar** (route `home`) — pestaña **habilitada**: navega al módulo Compartido (ver capability `shared`). La pantalla `home` NO SHALL renderizar un placeholder; el badge "Próximamente" NO SHALL mostrarse sobre este slot.
4. **Botón de menú** — acción que abre el `AppMenu` (bottom sheet modal).

Reglas:

- Las pestañas habilitadas (slots 1, 2 y 3) SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot de menú (slot 4) SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- "Tarjetas" NO SHALL aparecer como slot del tab bar; sigue navegable desde el `AppMenu` y vía deep link.
- El comportamiento funcional del botón de menú NO cambia: presionar abre el `AppMenu`.
- Las subpantallas de Compartido (setup, saldar, configuración, cuenta corriente) se pushean chromeless desde el tab Hogar; sus segmentos de ruta SHALL registrarse en la detección de chromeless del tab bar (ver capability `shared`).

Los nombres de archivo bajo `apps/mobile/app/(app)/` SHALL estar en inglés (`transactions.tsx`, `cards.tsx`, etc.), alineados con la regla "código en inglés" definida en `project-conventions`. La etiqueta visible al usuario ("Movimientos", "Tarjetas") se resuelve via `@grana/i18n-messages` y es independiente del nombre del archivo.

#### Scenario: El tab bar contiene los 4 slots en el orden definido

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** ve, de izquierda a derecha: Inicio, Movimientos, Hogar, Botón de menú
- **AND** no ve un slot llamado "Tarjetas"
- **AND** el slot Hogar se ve habilitado (sin badge "Próximamente")

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario observa el tab bar
- **THEN** los primeros tres slots (Inicio, Movimientos, Hogar) muestran ícono + label vertical en colores normales
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

#### Scenario: El tab Hogar navega al módulo Compartido

- **WHEN** un usuario presiona el slot Hogar
- **THEN** navega a la pantalla `home`, que renderiza el módulo Compartido (uno de sus tres estados)
- **AND** no ve un placeholder de texto ni una pantalla vacía

#### Scenario: El botón de menú abre el AppMenu

- **WHEN** un usuario presiona el botón circular del cuarto slot
- **THEN** el `AppMenu` bottom sheet aparece desde la parte inferior de la pantalla

### Requirement: El tab bar usa la paleta de marca leyendo desde tokens

El tab bar SHALL aplicar la paleta de tokens definida en `@grana/ui-tokens`. En particular:

- **Pestaña activa (ícono + label):** color `--positive` (emerald).
- **Pestaña inactiva (ícono + label):** color `text-soft`.
- **Surface del tab bar:** `bg-card`.
- **Borde superior del tab bar:** `border-border-soft`.
- **Esquinas superiores del tab bar:** levemente redondeadas (`rounded-t-xl`, ~12px) para que el tab bar se lea como una sheet flotante sobre el contenido.

Ningún color del tab bar SHALL estar hardcodeado como hex literal. Los colores SHALL venir de un módulo compartido (`apps/mobile/lib/colors.ts` o equivalente) que sirve como mirror JS de los tokens CSS hasta que exista un codegen automático.

Una pestaña activa SHALL mostrar un indicador visual adicional (pill o barra superior corta) en color `--positive` sobre o debajo del ícono, para reforzar la identificación del estado activo.

#### Scenario: La pestaña activa se identifica con emerald

- **WHEN** un usuario está en la pantalla de Dashboard
- **THEN** el ícono y label de "Dashboard" en el tab bar se muestran en color `--positive`
- **AND** un indicador (pill o barra corta) en color `--positive` aparece sobre o debajo del ícono activo
- **AND** las otras pestañas se muestran en color `text-soft`

#### Scenario: El tab bar no contiene literales de color hex

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/TabBar.tsx`
- **THEN** no encuentra ningún valor `#RRGGBB` literal para colores de la paleta
- **AND** los colores se importan desde un módulo central (`apps/mobile/lib/colors.ts` o equivalente)

#### Scenario: El tab bar tiene esquinas superiores redondeadas

- **WHEN** un usuario observa el tab bar
- **THEN** las esquinas superiores del tab bar están redondeadas (~12px)
- **AND** las esquinas inferiores se mantienen rectas (el tab bar respeta el safe area inferior del dispositivo)

### Requirement: El root layout pinta el fondo de página debajo de todo el árbol

`apps/mobile/app/_layout.tsx` SHALL renderizar un contenedor opaco con el fondo de página (`<View className="flex-1 bg-page">`) dentro de `SafeAreaProvider` y por encima del resto de los providers, de modo que **ninguna superficie de la app deje ver el window background nativo**.

El motivo es estructural, no cosmético: el `TabBar` se monta como sibling del contenedor de pantallas del navigator, así que sus esquinas superiores redondeadas (`rounded-t-xl`, ver el requirement de paleta del tab bar) recortan el `bg-card` y revelan lo que haya **detrás del tab bar**, que no pertenece a ninguna pantalla. Sin un fondo pintado en el root, ese recorte muestra el window background nativo (negro). Lo mismo aplica a cualquier otro hueco transitorio: transiciones entre pantallas, overscroll y ramas de render que no cubran el viewport completo.

Este fondo del root es una **red de seguridad, no un reemplazo** del fondo de cada pantalla: las pantallas SHALL seguir declarando su propio fondo (ver capacidad `page-header`), para que el color correcto no dependa de qué haya debajo.

#### Scenario: Las esquinas redondeadas del tab bar muestran el fondo de página

- **WHEN** un usuario observa el tab bar en cualquier pantalla que lo renderice
- **THEN** el área recortada por las esquinas superiores redondeadas se ve del gris de página (`--page`)
- **AND** no se ve negro ni ningún color ajeno a la paleta

#### Scenario: El root layout declara un fondo opaco

- **WHEN** un colaborador inspecciona `apps/mobile/app/_layout.tsx`
- **THEN** el árbol contiene un `<View className="flex-1 bg-page">` dentro de `SafeAreaProvider` que envuelve a los demás providers
- **AND** el token usado compila a un valor literal, de modo que el fondo pinta sin depender de custom properties declaradas en runtime

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/cards`) — item habilitado; al press cierra el sheet y navega a la ruta.
2. **Configuración** (route `/(app)/settings`) — item habilitado; al press cierra el sheet y navega a `/(app)/settings`. La pantalla destino existe y entrega las tres secciones de paridad con web (Visualización, Idioma, Categorías).
3. (divisor)
4. **Salir** — item destructivo que dispara `supabase.auth.signOut()`.

"Ahorros" NO SHALL aparecer en el `AppMenu`: la capability `savings` no está en el roadmap por ahora, así que el item comingSoon se retira en lugar de anunciar una feature que no llega. "Hogar" NO SHALL aparecer en el `AppMenu` (vive en el tab bar). "Mis tarjetas" NO SHALL aparecer como label (se renombra a "Tarjetas").

#### Scenario: El AppMenu contiene los items en el orden definido

- **WHEN** un usuario abre el `AppMenu`
- **THEN** ve, de arriba a abajo: Tarjetas, Configuración, (divisor), Salir
- **AND** no ve un item llamado "Ahorros"
- **AND** no ve un item llamado "Hogar"
- **AND** no ve un item llamado "Mis tarjetas"

#### Scenario: Press del item Configuración navega a /settings

- **WHEN** un usuario presiona el item "Configuración" en el `AppMenu`
- **THEN** el sheet del menú se cierra
- **AND** la app navega a `/(app)/settings`
- **AND** la pantalla destino renderea el `PageHeader` con título "Configuración" y las tres secciones (Visualización, Idioma, Categorías)

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press

### Requirement: El tab bar puede mostrar slots en estado disabled

El tab bar SHALL soportar un estado "disabled" para slots que apuntan a features no implementadas. Un slot disabled SHALL:

- Renderizar el ícono y el label con `opacity-50` (visualmente atenuado).
- NO responder a tap (`onPress` no produce navegación).
- Anunciar el estado a tecnologías asistivas vía `accessibilityState={{ disabled: true }}`.
- Mostrar un badge "Próximamente" (texto pequeño) sobre o debajo del ícono que comunique al usuario que la feature viene pero todavía no está disponible. El string SHALL leerse de `nav.coming_soon`.

#### Scenario: Slot disabled no navega

- **WHEN** un usuario presiona un slot del tab bar marcado como disabled
- **THEN** la app NO navega a ninguna pantalla
- **AND** no ocurre cambio visual de estado activo

#### Scenario: Slot disabled se ve atenuado y muestra "Próximamente"

- **WHEN** un usuario observa un slot disabled en el tab bar
- **THEN** el ícono y label del slot se muestran con opacidad reducida
- **AND** un badge "Próximamente" (texto de `nav.coming_soon`) acompaña al slot

### Requirement: Los labels del tab bar y AppMenu se leen del catálogo i18n

Tanto el `TabBar` como el `AppMenu` mobile SHALL leer todos sus labels desde el catálogo `@grana/i18n-messages` vía el helper `t()` de `apps/mobile/lib/i18n.ts`. Ningún label SHALL estar hardcodeado como string literal en los componentes.

Las keys consumidas pertenecen al namespace `nav.*` (cross-platform con web): `nav.dashboard`, `nav.movements`, `nav.home`, `nav.cards`, `nav.savings`, `nav.settings`, `nav.logout`, `nav.coming_soon`.

Las labels SHALL coincidir 1-a-1 con las del sidebar web. En particular, el item de tarjetas SHALL llamarse "Tarjetas" en ambas plataformas (no "Mis tarjetas").

#### Scenario: El TabBar no contiene strings literales

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/TabBar.tsx`
- **THEN** los labels visibles se obtienen vía `t('nav.<key>')`
- **AND** no aparece ningún string en español ni inglés hardcodeado

#### Scenario: El AppMenu no contiene strings literales

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/AppMenu.tsx`
- **THEN** los labels visibles se obtienen vía `t('nav.<key>')`
- **AND** los labels de Tarjetas, Ahorros, Configuración y Salir coinciden con `nav.cards`, `nav.savings`, `nav.settings` y `nav.logout` respectivamente

#### Scenario: Cards usa el mismo label que el sidebar web

- **WHEN** un usuario abre el `AppMenu` mobile
- **AND** otro usuario abre el sidebar web
- **THEN** el item de tarjetas se llama "Tarjetas" en ambos
- **AND** ninguna plataforma muestra "Mis tarjetas"

### Requirement: El root layout provee un QueryClientProvider a toda la app

`apps/mobile/app/_layout.tsx` SHALL montar un `QueryClientProvider` de `@tanstack/react-query` que envuelva el árbol completo de la app (auth, onboarding y app autenticada). El `QueryClient` SHALL ser instanciado una sola vez por sesión de la app (típicamente con `useState(() => new QueryClient(...))` en el componente raíz para sobrevivir hot reload sin recrearse).

Configuración por defecto del cliente:

- `staleTime`: valor explícito definido en `design.md` (no usar el default `0` — provoca refetch agresivo en RN).
- `retry`: política definida en `design.md` (ej. 1 reintento en errores de red, 0 en errores de autenticación).
- `refetchOnWindowFocus`: NO aplica en RN (no hay ventana). El equivalente para mobile se cubre con el siguiente requirement (`focusManager` + `useFocusEffect`).

La versión exacta de `@tanstack/react-query` SHALL ser compatible con `react@19.1.0` (pin estricto del workspace) — la versión seleccionada se documenta en `design.md`.

#### Scenario: Toda pantalla mobile puede usar useQuery

- **WHEN** una pantalla bajo `apps/mobile/app/` invoca `useQuery({ ... })`
- **THEN** el hook resuelve sin lanzar el error "No QueryClient set, use QueryClientProvider to set one"
- **AND** las queries comparten cache a través de las pantallas

#### Scenario: El QueryClient sobrevive hot reload en desarrollo

- **WHEN** un desarrollador edita un componente y Expo aplica fast refresh
- **THEN** el `QueryClient` se mantiene (no se recrea con cada refresh)
- **AND** los datos cacheados antes del refresh siguen disponibles después

### Requirement: TanStack Query refetch on focus está integrado con Expo Router

`apps/mobile` SHALL integrar el `focusManager` de TanStack Query con el ciclo de focus de Expo Router de modo que, cuando un usuario vuelve a una pantalla previamente montada, las queries marcadas como stale se refresquen automáticamente. La integración SHALL usar el helper recomendado por la documentación de TanStack Query para React Native + Expo Router (vía `focusManager.setEventListener` enganchado al estado de foreground/background de la app y/o al evento de focus de la pantalla).

La integración SHALL ser global (configurada una sola vez en `_layout.tsx` raíz). Pantallas individuales NO SHALL implementar manualmente refetch on focus — esa responsabilidad vive en el seam, no en cada feature.

#### Scenario: Volver a una pantalla refresca queries stale

- **WHEN** un usuario navega de `(app)/dashboard` a `(app)/transactions` y luego vuelve a `(app)/dashboard`
- **AND** el `staleTime` de las queries del dashboard se cumplió
- **THEN** las queries del dashboard se reejecutan automáticamente al volver
- **AND** el usuario ve un indicador no intrusivo de refetch (estado `isFetching` sin `isPending`)

#### Scenario: La app vuelve de background y refresca queries

- **WHEN** la app pasa de background a foreground (usuario vuelve a la app desde el switcher del SO)
- **AND** hay queries stale en pantallas montadas
- **THEN** esas queries se refrescan automáticamente

### Requirement: La app mobile respeta el safe-area top en todas las pantallas root

`apps/mobile` SHALL montar `<SafeAreaProvider>` (de `react-native-safe-area-context`) como wrapper outermost en `apps/mobile/app/_layout.tsx`, de modo que cualquier descendiente que llame `useSafeAreaInsets()` reciba los insets reales del dispositivo (no el fallback `{ top: 0, ... }`).

En el shell autenticado (`(app)`), la responsabilidad del top safe-area inset vive en el **componente de header** (`PageHeader` y `DashboardHeader`), no en cada pantalla. Esos componentes renderizan internamente `<SafeAreaView edges={['top']}>` con fondo `bg-navy` (ver capacidad `page-header`). En consecuencia, las pantallas de `(app)` —tanto las root de stack (`dashboard`, `accounts`, `cards`, `transactions`, `/(app)/settings`, `/(app)/settings/categories`) como las anidadas (`/(app)/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`)— NO SHALL envolver su contenido en una `SafeAreaView edges={['top']}` propia; usan un `<View>` plano como root y delegan el inset superior al header. Los stacks anidados de `(app)` corren con `headerShown: false` (no usan el native stack header).

Única excepción dentro de `(app)`: una rama de render que NO monte un header (ej. el estado de loading inicial de `dashboard.tsx`, que sólo muestra un spinner centrado) MAY envolver su contenido en `SafeAreaView edges={['top']}` propia, porque no hay header que gestione el inset.

Los headers visuales con fondo extendido fuera de `(app)` (ej. `CurvedNavyHeader` de las pantallas de auth y onboarding) SHALL leer `useSafeAreaInsets()` para calcular su `paddingTop` dinámicamente, en lugar de usar valores hardcoded (`pt-12`) que solo funcionan en una fracción de dispositivos.

#### Scenario: SafeAreaProvider está mounteado en el root

- **WHEN** la app arranca en cualquier dispositivo (con o sin notch)
- **THEN** `useSafeAreaInsets()` invocado desde `TabBar` o `AppMenu` retorna `insets.top` y `insets.bottom` reales (no cero)

#### Scenario: La pantalla dashboard respeta el safe-area top

- **WHEN** un usuario abre la app en un iPhone con notch (o un Android con cutout)
- **THEN** el contenido del dashboard (header "Inicio" + secciones) arranca debajo del status bar / notch, no detrás
- **AND** el inset superior lo provee `DashboardHeader`, no una `SafeAreaView` declarada en `dashboard.tsx`

#### Scenario: Las pantallas root del shell autenticado no quedan tapadas

- **WHEN** un usuario navega a `/(app)/accounts`, `/(app)/cards`, `/(app)/transactions`, `/(app)/settings` o `/(app)/settings/categories`
- **THEN** el `PageHeader` aparece visible por debajo del notch en todos los casos
- **AND** el inset superior lo provee el propio `PageHeader`, no una `SafeAreaView` declarada en la pantalla

#### Scenario: Las pantallas anidadas de settings no declaran SafeAreaView propia

- **WHEN** un usuario abre `/(app)/settings/categories/new` o `/(app)/settings/categories/[id]/edit`
- **THEN** la pantalla usa un `<View>` plano como root y renderiza `<PageHeader>` (que provee el inset superior)
- **AND** la pantalla NO declara `<SafeAreaView edges={['top']}>` propia
- **AND** el stack de settings corre con `headerShown: false` (sin native stack header)

#### Scenario: El header de las pantallas auth respeta el inset

- **WHEN** un usuario abre `/login` en un dispositivo con notch
- **THEN** el título "Bienvenido" queda visible y NO clipped por el status bar, en lugar de depender del `pt-12` hardcoded

### Requirement: El layout de (app) configura StatusBar style="light"

`apps/mobile/app/(app)/_layout.tsx` SHALL renderizar `<StatusBar style="light" />` (de `expo-status-bar`) dentro del subárbol del grupo `(app)`. Esto asegura que el reloj, los iconos de wifi / señal / batería y demás contenido del status bar nativo se rendericen en color claro, manteniendo la legibilidad sobre el fondo `--navy` que pinta el header (ver capacidad `page-header`).

La directiva NO se aplica al `_layout.tsx` raíz para no afectar las rutas fuera de `(app)` (`(auth)`, `(onboarding)`), que tienen su propio chrome visual.

#### Scenario: StatusBar es light dentro de (app)

- **WHEN** un usuario abre cualquier pantalla bajo `apps/mobile/app/(app)/**` en un dispositivo iOS o Android
- **THEN** el reloj, la señal de wifi, la batería y demás iconos del status bar nativo se renderizan en color claro (blanco / light)
- **AND** los iconos son legibles sobre el fondo navy de la banda superior del header

#### Scenario: StatusBar no es forzado a light fuera de (app)

- **WHEN** un usuario está en una pantalla bajo `apps/mobile/app/(auth)/**` o `apps/mobile/app/(onboarding)/**`
- **THEN** el estilo del status bar es el que la pantalla / layout de esa ruta determine (no es sobreescrito por `(app)/_layout.tsx`)

### Requirement: Ninguna superficie con campos de texto queda tapada por el teclado

`apps/mobile` SHALL garantizar que, en toda superficie que contenga al menos un campo de texto, el campo enfocado, su mensaje de error asociado y la acción primaria de submit queden visibles por encima del teclado nativo, sin que el usuario tenga que cerrar el teclado ni scrollear a ciegas.

La garantía SHALL cubrir **las tres familias de superficie** que existen hoy en la app, sin excepciones por plataforma:

- Pantallas pusheadas con formulario (alta/edición de cuenta, tarjeta, movimiento, recurrencia, categoría, subcategoría, pago de resumen, liquidación, monedas de una cuenta).
- Pantallas root de tab con formulario inline (p. ej. el alta de hogar en la pestaña Hogar).
- Superficies de overlay: `Drawer`, `BottomSheet` y cualquier `Modal` que contenga inputs.

La garantía SHALL valer por igual en **iOS y en Android**, incluyendo Android en modo edge-to-edge. Una superficie que compense el teclado solo en una plataforma NO satisface este requirement.

Además del desplazamiento, la superficie SHALL **scrollear el campo enfocado a la vista**: desplazar o paddear el contenedor no alcanza cuando el formulario es más alto que la pantalla. Al enfocar un campo que quedaría bajo el teclado, el contenido SHALL reposicionarse para dejarlo visible con un margen de respiro respecto del borde superior del teclado.

La responsabilidad SHALL vivir en el **seam del shell** (un shell de pantalla de formulario y un cuerpo de overlay reutilizables), no en cada pantalla. Una pantalla o un overlay nuevos NO SHALL tener que resolver el teclado por su cuenta ni replicar la lógica de compensación.

Toda superficie scrolleable con inputs SHALL declarar `keyboardShouldPersistTaps="handled"`, de modo que un tap sobre un control del formulario (chip, selector, submit) se procese en el primer toque en vez de consumirse cerrando el teclado.

#### Scenario: El campo enfocado a media altura de un formulario largo queda visible

- **WHEN** un usuario abre el alta de movimiento y enfoca el campo de monto, que en reposo queda a media altura de un formulario más alto que la pantalla
- **THEN** el contenido se reposiciona para que el campo de monto quede visible por encima del teclado
- **AND** el usuario puede ver lo que está tipeando sin cerrar el teclado

#### Scenario: El submit sigue siendo alcanzable con el teclado abierto

- **WHEN** un usuario está tipeando en el último campo de un formulario y el teclado está abierto
- **THEN** puede scrollear hasta el botón de submit y tocarlo con el teclado todavía abierto
- **AND** el tap dispara el submit en el primer toque, sin consumirse en cerrar el teclado

#### Scenario: La compensación funciona igual en Android edge-to-edge

- **WHEN** un usuario en un dispositivo Android (con `edgeToEdgeEnabled`) enfoca cualquier campo de cualquiera de las superficies con formulario
- **THEN** el campo enfocado queda visible por encima del teclado
- **AND** el comportamiento es equivalente al de iOS, sin superficies que queden sin compensación en Android

#### Scenario: Un formulario dentro de un overlay compensa el teclado

- **WHEN** un usuario abre el `Drawer` de alta de categoría (o cualquier overlay con inputs, como el sheet de filtros de movimientos) y enfoca un campo
- **THEN** el contenido del overlay se reposiciona para que el campo quede visible por encima del teclado
- **AND** el overlay no queda parcialmente fuera de pantalla ni pierde su header

#### Scenario: Una pantalla de formulario nueva hereda la compensación sin escribirla

- **WHEN** se agrega una pantalla de formulario nueva bajo `apps/mobile/app/(app)/` usando el shell de formulario del app shell
- **THEN** la pantalla compensa el teclado sin declarar ninguna lógica de teclado propia
- **AND** NO importa ni monta un `KeyboardAvoidingView` a nivel pantalla

### Requirement: El root layout provee el contexto de teclado a toda la app

`apps/mobile/app/_layout.tsx` SHALL montar el provider de contexto de teclado envolviendo el árbol completo de la app (auth, onboarding y app autenticada), de modo que cualquier superficie descendiente pueda leer el estado y la altura del teclado sin configuración adicional.

El provider SHALL montarse **dentro de `SafeAreaProvider`** — que se mantiene como wrapper outermost según el requirement de safe-area — y por fuera del resto de los providers de la app.

Las superficies renderizadas dentro de un `Modal` nativo viven en una ventana propia y por lo tanto SHALL montar su propio contexto de teclado dentro del modal. Esa responsabilidad SHALL estar encapsulada en el cuerpo de overlay reutilizable del shell, no repetida en cada sheet.

Los campos que abren un teclado numérico SHALL exponer una acción visible para cerrarlo. El teclado decimal de iOS no tiene tecla de retorno, así que sin una barra accesoria el único modo de cerrarlo es tocar fondo vacío — lo cual no es descubrible y en un formulario denso puede no existir.

#### Scenario: Cualquier superficie puede leer el estado del teclado

- **WHEN** un componente bajo `apps/mobile/app/` consulta el estado del teclado
- **THEN** resuelve sin lanzar un error de provider ausente
- **AND** obtiene la altura y el estado de visibilidad reales del teclado

#### Scenario: El campo de monto se puede cerrar sin tocar el fondo

- **WHEN** un usuario enfoca un campo de monto (teclado decimal) en iOS
- **THEN** hay una acción visible y explícita para cerrar el teclado
- **AND** el usuario no depende de encontrar un área de fondo vacía para hacerlo

### Requirement: El tab bar no se interpone entre el contenido y el teclado

El `TabBar` de `apps/mobile` lo renderiza el navigator por fuera del contenedor de pantalla, de modo que permanece anclado al borde inferior aunque el teclado esté abierto. Cuando el teclado está visible, el tab bar SHALL ocultarse: no aporta navegación útil durante la edición de un campo y, de quedar visible, se interpone entre el contenido del formulario y el borde superior del teclado, consumiendo alto vertical justo donde hace falta.

El tab bar SHALL reaparecer al cerrarse el teclado, sin salto de layout perceptible y sin alterar la regla de rutas chromeless ya especificada (una ruta chromeless sigue sin tab bar, haya teclado o no).

#### Scenario: El tab bar se oculta al abrir el teclado en una pantalla de tab

- **WHEN** un usuario está en una pantalla root de tab con formulario inline y enfoca un campo de texto
- **THEN** el tab bar se oculta mientras el teclado está visible
- **AND** el espacio que ocupaba queda disponible para el contenido del formulario

#### Scenario: El tab bar vuelve al cerrarse el teclado

- **WHEN** el usuario cierra el teclado en esa misma pantalla
- **THEN** el tab bar vuelve a mostrarse en su posición habitual
- **AND** la pestaña activa sigue siendo la misma que antes de abrir el teclado

### Requirement: La app corre siempre sobre un development build, nunca sobre Expo Go

`apps/mobile` SHALL ejecutarse exclusivamente sobre un **development build** propio (`expo run:ios` / `expo run:android`, o un build de EAS). Expo Go NO SHALL considerarse un entorno de ejecución soportado, ni siquiera para pruebas rápidas.

La razón es estructural, no circunstancial: Expo Go es un binario fijo con un set cerrado de módulos nativos, y la app depende de módulos que no están en ese set (`react-native-keyboard-controller`, entre otros). No existe configuración que lo habilite, y la decisión no se revisa cuando cambie la lista de dependencias — sumar módulos nativos es el camino esperado del proyecto.

La documentación de `apps/mobile` NO SHALL ofrecer Expo Go como alternativa de ejecución en ninguna sección (requisitos, scripts, troubleshooting u onboarding).

#### Scenario: El README no ofrece Expo Go como forma de correr la app

- **WHEN** un desarrollador nuevo lee `apps/mobile/README.md` para levantar la app
- **THEN** encuentra que el entorno soportado es un development build y que Expo Go no se usa en el proyecto
- **AND** no encuentra ninguna instrucción que lo mande a instalar Expo Go

#### Scenario: El script de desarrollo apunta al dev client

- **WHEN** un desarrollador corre el script `dev` de `apps/mobile`
- **THEN** Metro arranca en modo dev-client (`expo start --dev-client`) contra el build ya instalado
- **AND** no se ofrece un flujo alternativo vía Expo Go

---

### Requirement: Una dependencia nativa nueva exige recompilar el binario

Agregar, actualizar o eliminar una dependencia con código nativo SHALL requerir **recompilar el binario** de la app (`expo run:ios` / `expo run:android`), porque el autolinking ocurre en tiempo de build. Instalar el paquete con `pnpm install` trae únicamente el JavaScript; recargar Metro NO SHALL considerarse suficiente.

Esto SHALL aplicar también al **traer cambios de otra persona** que hayan agregado una dependencia nativa: el rebuild es parte del flujo normal, no la señal de un defecto.

La documentación de `apps/mobile` SHALL registrar esta regla junto con los síntomas que produce omitirla, de modo que el diagnóstico no tenga que re-derivarse: `doesn't seem to be linked` (binario compilado antes de que existiera la dependencia) y `Failed to get the SHA-1` (file map de Metro apuntando a un `node_modules` reinstalado).

#### Scenario: Traer una dependencia nativa nueva y no recompilar

- **WHEN** un desarrollador hace `git pull` de un cambio que agregó una dependencia nativa, corre `pnpm install` y levanta Metro sin recompilar
- **THEN** la app falla en runtime con `The package 'X' doesn't seem to be linked`
- **AND** el README de `apps/mobile` documenta ese síntoma y su fix (`pnpm ios` / `pnpm android`)

#### Scenario: La tabla de scripts describe lo que cada script hace

- **WHEN** un desarrollador consulta la tabla de scripts de `apps/mobile/README.md`
- **THEN** `ios` y `android` figuran como builds nativos completos (`expo run:*`), no como atajos para abrir un simulador
- **AND** `dev` figura como "solo Metro, contra un build ya instalado"

---

### Requirement: El layout `hoisted` de node_modules es parte del contrato de resolución

El monorepo SHALL usar `nodeLinker: hoisted` (definido en `pnpm-workspace.yaml`), de modo que las dependencias de `apps/mobile` se instalan en el `node_modules` de la **raíz del repo** y NO en `apps/mobile/node_modules/`. `metro.config.js` SHALL resolver ambas rutas (`nodeModulesPaths`) y observar la raíz del workspace (`watchFolders`).

La ausencia de un paquete bajo `apps/mobile/node_modules/` SHALL entenderse como el layout esperado y NO como un install incompleto. La documentación SHALL advertirlo explícitamente, porque la lectura equivocada lleva a reinstalar `node_modules` sin necesidad — y ese borrado invalida el file map de Metro, produciendo un segundo error (`Failed to get the SHA-1`) sin relación con el problema original.

#### Scenario: Verificar si un paquete está instalado

- **WHEN** un desarrollador busca una dependencia de mobile bajo `apps/mobile/node_modules/` y no la encuentra
- **THEN** el README le indica que el layout `hoisted` la instala en el `node_modules` de la raíz
- **AND** le advierte que reinstalar `node_modules` por esa ausencia es innecesario y rompe el cache de Metro

#### Scenario: Metro resuelve desde la raíz del workspace

- **WHEN** Metro bundlea un módulo instalado en el `node_modules` de la raíz del repo
- **THEN** lo resuelve sin `Unable to resolve module`, porque `metro.config.js` incluye esa ruta en `nodeModulesPaths` y la raíz en `watchFolders`

### Requirement: El tab bar se muestra sólo en los tabs reales, y toda sección del Menú declara su propia salida

La navegación de `apps/mobile` SHALL responder a una regla de dos mitades que se mueven juntas.

**Mitad 1 — visibilidad del tab bar.** El tab bar SHALL renderizarse únicamente en las pantallas de los tres tabs reales (`dashboard`, `transactions`, `home`). Toda sección top-level alcanzable desde el botón de menú del tab bar (el `AppMenu`) SHALL estar registrada en `CHROMELESS_SECTIONS` de `apps/mobile/components/layout/TabBar.tsx`, de modo que la lista sea exactamente "las secciones que se abren desde el botón …". Al momento de este change son `accounts`, `cards` y `settings`. El chromeless alcanza a la sección completa, subrutas incluidas (`/settings/categories/**`, `/accounts/[id]`, `/cards/new`, …): ninguna de ellas es un tab, así que el tab bar sólo podría mostrarse detached, sin slot resaltado.

**Mitad 2 — salida visible.** Toda sección listada en `CHROMELESS_SECTIONS` SHALL declarar un `backLink` al dashboard en su **pantalla raíz**, con `href` fijo `'/(app)/dashboard'` y label `t('nav.dashboard')` (ver capability `page-header` para el estilo canónico y el requisito de primer paint). Sin esta mitad, ocultar el tab bar deja a la pantalla sin ninguna navegación visible: sólo quedan las salidas de sistema (botón físico Atrás en Android, gesto de swipe en iOS), que no son affordances en pantalla.

Agregar una sección al `AppMenu` SHALL implicar las dos mitades a la vez. Cumplir una sola es un defecto: sin la mitad 1 el tab bar aparece detached; sin la mitad 2 la pantalla queda sin salida.

Las rutas hijas de una sección chromeless SHALL seguir declarando su propio back-link al parent inmediato, no al dashboard.

`CHROMELESS_SECTIONS` (secciones enteras alcanzables desde el Menú) y `CHROMELESS_SCREENS` (pantallas pusheadas dentro del stack de un tab, como `['transactions', 'new']` o las subpantallas de Compartido) son dos listas con reglas distintas y SHALL mantenerse separadas. En particular, la entrada `['home', 'settings']` de `CHROMELESS_SCREENS` es la pantalla de **configuración del Hogar** pusheada sobre el tab Hogar, y NO tiene relación con la sección `settings`; agregar `settings` a `CHROMELESS_SECTIONS` no la reemplaza ni la vuelve redundante.

#### Scenario: Cada sección del Menú se abre sin tab bar y con back-link

- **WHEN** un usuario abre el `AppMenu` desde el botón … del tab bar y navega a Cuentas, Tarjetas o Configuración
- **THEN** la pantalla se renderiza sin tab bar
- **AND** el header muestra el back-link `← Inicio` (`← Home` en `en`) arriba del título
- **AND** presionarlo navega al dashboard

#### Scenario: Los tabs reales conservan el tab bar y no muestran back-link

- **WHEN** un usuario está en `dashboard`, `transactions` o `home`
- **THEN** el tab bar se muestra con el slot correspondiente resaltado
- **AND** el header de esas pantallas NO declara `backLink`

#### Scenario: Las rutas hijas de una sección chromeless mantienen su propio back-link

- **WHEN** un usuario navega a `/cards/new`, `/cards/[id]`, `/accounts/[id]` o `/settings/categories/**`
- **THEN** la pantalla sigue sin tab bar
- **AND** su header muestra el back-link al parent inmediato (no al dashboard)
- **AND** no se apilan dos headers

#### Scenario: Una sección nueva del Menú cumple las dos mitades

- **WHEN** se agrega al `AppMenu` una entrada que navega a una sección top-level nueva
- **THEN** el segmento de esa sección SHALL sumarse a `CHROMELESS_SECTIONS`
- **AND** su pantalla raíz SHALL declarar `backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}`

#### Scenario: La configuración del Hogar sigue siendo una pantalla pusheada del tab Hogar

- **WHEN** un usuario entra a la configuración del Hogar desde el tab Hogar
- **THEN** la pantalla sigue renderizándose chromeless por la entrada `['home', 'settings']` de `CHROMELESS_SCREENS`
- **AND** su back-link sigue apuntando al Hogar, no al dashboard

### Requirement: Las secciones chromeless compensan el safe-area inferior en su contenido scrolleable

En una sección chromeless no hay tab bar, y con él desaparece el único elemento que pintaba el safe-area inferior (el tab bar aplica `paddingBottom: Math.max(14, insets.bottom)`). El contenedor scrolleable raíz de cada sección de `CHROMELESS_SECTIONS` SHALL agregar un padding inferior de al menos `insets.bottom` a su `contentContainer`, de modo que la última fila del contenido quede alcanzable y no tapada por el home indicator de iOS ni por la barra de gestos de Android.

Las pantallas de formulario pusheadas ya cumplen esta regla vía el `contentClassName` por defecto de `FormScreen` (`pb-28`) y NO requieren cambios.

#### Scenario: La última fila de una sección chromeless queda por encima del home indicator

- **WHEN** un usuario scrollea hasta el final de Cuentas, Tarjetas o Configuración en un dispositivo con safe-area inferior mayor a cero
- **THEN** la última fila del contenido se ve completa por encima del home indicator / barra de gestos
- **AND** el espacio libre bajo esa fila es al menos `insets.bottom`

