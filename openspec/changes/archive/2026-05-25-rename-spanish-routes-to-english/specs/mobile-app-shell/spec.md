## MODIFIED Requirements

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria. La composición de slots del tab bar SHALL ser, en orden:

1. **Inicio** (route `dashboard`) — pestaña habilitada.
2. **Movimientos** (route `transactions`) — pestaña habilitada.
3. **Hogar** (route `home`) — pestaña **disabled** hasta que la capability `shared` se implemente (ver requirement "El tab bar puede mostrar slots en estado disabled").
4. **Botón de menú** — acción que abre el `AppMenu` (bottom sheet modal).

Reglas:

- Las pestañas habilitadas (slots 1 y 2) SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot disabled (slot 3) SHALL respetar el treatment definido en la requirement de slots disabled.
- El slot de menú (slot 4) SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- "Tarjetas" NO SHALL aparecer como slot del tab bar; sigue navegable desde el `AppMenu` y vía deep link.
- El comportamiento funcional del botón de menú NO cambia: presionar abre el `AppMenu`.

Los nombres de archivo bajo `apps/mobile/app/(app)/` SHALL estar en inglés (`transactions.tsx`, `cards.tsx`, etc.), alineados con la regla "código en inglés" definida en `project-conventions`. La etiqueta visible al usuario ("Movimientos", "Tarjetas") se resuelve via `@grana/i18n-messages` y es independiente del nombre del archivo.

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

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/cards`) — item habilitado; al press cierra el sheet y navega a la ruta.
2. **Ahorros** — item **comingSoon** (no navegable hasta que la capability `savings` se implemente).
3. **Configuración** (route `/(app)/settings`) — item habilitado; al press cierra el sheet y navega a `/(app)/settings`. La pantalla destino existe y entrega las tres secciones de paridad con web (Visualización, Idioma, Categorías).
4. (divisor)
5. **Salir** — item destructivo que dispara `supabase.auth.signOut()`.

"Hogar" NO SHALL aparecer en el `AppMenu` (vive en el tab bar). "Mis tarjetas" NO SHALL aparecer como label (se renombra a "Tarjetas").

#### Scenario: El AppMenu contiene los items en el orden definido

- **WHEN** un usuario abre el `AppMenu`
- **THEN** ve, de arriba a abajo: Tarjetas, Ahorros (próximamente), Configuración, (divisor), Salir
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

#### Scenario: El overlay del menú cubre la pantalla completa en Android

- **WHEN** un usuario abre el `AppMenu` en un dispositivo Android
- **THEN** el dim del overlay se extiende detrás del status bar y la nav bar del sistema
- **AND** no queda ninguna franja del fondo de la app visible por encima ni por debajo del dim

### Requirement: La app mobile respeta el safe-area top en todas las pantallas root

`apps/mobile` SHALL montar `<SafeAreaProvider>` (de `react-native-safe-area-context`) como wrapper outermost en `apps/mobile/app/_layout.tsx`, de modo que cualquier descendiente que llame `useSafeAreaInsets()` reciba los insets reales del dispositivo (no el fallback `{ top: 0, ... }`).

Cada pantalla **root de stack** SHALL envolver su contenido superior en `SafeAreaView edges={['top']}` (o aplicar `paddingTop: insets.top` manualmente) para que el contenido no quede debajo del notch / status bar. Las pantallas root del shell autenticado son al menos: `dashboard`, `accounts`, `cards`, `transactions`, `/(app)/settings`, `/(app)/settings/categories`.

Las pantallas **anidadas dentro de un stack que usa el native header** (ej. `/(app)/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`) NO necesitan `SafeAreaView` propio: el native stack header ya respeta el safe-area top de la plataforma.

Los headers visuales con fondo extendido (ej. `CurvedNavyHeader` de las pantallas de auth y onboarding) SHALL leer `useSafeAreaInsets()` para calcular su `paddingTop` dinámicamente, en lugar de usar valores hardcoded (`pt-12`) que solo funcionan en una fracción de dispositivos.

#### Scenario: SafeAreaProvider está mounteado en el root

- **WHEN** la app arranca en cualquier dispositivo (con o sin notch)
- **THEN** `useSafeAreaInsets()` invocado desde `TabBar` o `AppMenu` retorna `insets.top` y `insets.bottom` reales (no cero)

#### Scenario: La pantalla dashboard respeta el safe-area top

- **WHEN** un usuario abre la app en un iPhone con notch (o un Android con cutout)
- **THEN** el contenido del dashboard (header "Inicio" + secciones) arranca debajo del status bar / notch, no detrás

#### Scenario: Las pantallas root del shell autenticado no quedan tapadas

- **WHEN** un usuario navega a `/(app)/accounts`, `/(app)/cards`, `/(app)/transactions`, `/(app)/settings` o `/(app)/settings/categories`
- **THEN** el `PageHeader` aparece visible por debajo del notch en todos los casos

#### Scenario: El header de las pantallas auth respeta el inset

- **WHEN** un usuario abre `/login` en un dispositivo con notch
- **THEN** el título "Bienvenido" queda visible y NO clipped por el status bar, en lugar de depender del `pt-12` hardcoded

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
