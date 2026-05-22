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
2. **Movimientos** (route `movimientos`) — pestaña habilitada.
3. **Hogar** (route `home`) — pestaña **disabled** hasta que la capability `shared` se implemente (ver requirement "El tab bar puede mostrar slots en estado disabled").
4. **Botón de menú** — acción que abre el `AppMenu` (bottom sheet modal).

Reglas:

- Las pestañas habilitadas (slots 1 y 2) SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot disabled (slot 3) SHALL respetar el treatment definido en la requirement de slots disabled.
- El slot de menú (slot 4) SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- "Tarjetas" NO SHALL aparecer como slot del tab bar; sigue navegable desde el `AppMenu` y vía deep link.
- El comportamiento funcional del botón de menú NO cambia: presionar abre el `AppMenu`.

#### Scenario: El tab bar contiene los 4 slots en el orden definido

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** ve, de izquierda a derecha: Inicio, Movimientos, Hogar (disabled), Botón de menú
- **AND** no ve un slot llamado "Tarjetas"

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario observa el tab bar
- **THEN** los primeros dos slots (Inicio, Movimientos) muestran ícono + label vertical en colores normales
- **AND** el tercer slot (Hogar) muestra ícono + label vertical pero atenuado, con badge "Próximamente"
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

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

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/tarjetas`) — item habilitado; al press cierra el sheet y navega a la ruta.
2. **Ahorros** — item **comingSoon** (no navegable hasta que la capability `savings` se implemente).
3. **Configuración** — item visible; al press cierra el sheet. La navegación efectiva a una pantalla mobile de settings es follow-up cuando la pantalla exista en mobile (hoy `apps/mobile/app/(app)/settings.tsx` no existe; la presencia del item comunica al usuario que la sección viene).
4. (divisor)
5. **Salir** — item destructivo que dispara `supabase.auth.signOut()`.

"Hogar" NO SHALL aparecer en el `AppMenu` (vive en el tab bar). "Mis tarjetas" NO SHALL aparecer como label (se renombra a "Tarjetas").

#### Scenario: El AppMenu contiene los items en el orden definido

- **WHEN** un usuario abre el `AppMenu`
- **THEN** ve, de arriba a abajo: Tarjetas, Ahorros (próximamente), Configuración, (divisor), Salir
- **AND** no ve un item llamado "Hogar"
- **AND** no ve un item llamado "Mis tarjetas"

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press

#### Scenario: El overlay del menú cubre la pantalla completa en Android

- **WHEN** un usuario abre el `AppMenu` en un dispositivo Android
- **THEN** el dim del overlay se extiende detrás del status bar y la nav bar del sistema
- **AND** no queda ninguna franja del fondo de la app visible por encima ni por debajo del dim

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
