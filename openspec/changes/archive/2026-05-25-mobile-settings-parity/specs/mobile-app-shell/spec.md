## ADDED Requirements

### Requirement: La app mobile respeta el safe-area top en todas las pantallas root

`apps/mobile` SHALL montar `<SafeAreaProvider>` (de `react-native-safe-area-context`) como wrapper outermost en `apps/mobile/app/_layout.tsx`, de modo que cualquier descendiente que llame `useSafeAreaInsets()` reciba los insets reales del dispositivo (no el fallback `{ top: 0, ... }`).

Cada pantalla **root de stack** SHALL envolver su contenido superior en `SafeAreaView edges={['top']}` (o aplicar `paddingTop: insets.top` manualmente) para que el contenido no quede debajo del notch / status bar. Las pantallas root del shell autenticado son al menos: `dashboard`, `accounts`, `tarjetas`, `movimientos`, `/(app)/settings`, `/(app)/settings/categories`.

Las pantallas **anidadas dentro de un stack que usa el native header** (ej. `/(app)/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`) NO necesitan `SafeAreaView` propio: el native stack header ya respeta el safe-area top de la plataforma.

Los headers visuales con fondo extendido (ej. `CurvedNavyHeader` de las pantallas de auth y onboarding) SHALL leer `useSafeAreaInsets()` para calcular su `paddingTop` dinámicamente, en lugar de usar valores hardcoded (`pt-12`) que solo funcionan en una fracción de dispositivos.

#### Scenario: SafeAreaProvider está mounteado en el root

- **WHEN** la app arranca en cualquier dispositivo (con o sin notch)
- **THEN** `useSafeAreaInsets()` invocado desde `TabBar` o `AppMenu` retorna `insets.top` y `insets.bottom` reales (no cero)

#### Scenario: La pantalla dashboard respeta el safe-area top

- **WHEN** un usuario abre la app en un iPhone con notch (o un Android con cutout)
- **THEN** el contenido del dashboard (header "Inicio" + secciones) arranca debajo del status bar / notch, no detrás

#### Scenario: Las pantallas root del shell autenticado no quedan tapadas

- **WHEN** un usuario navega a `/(app)/accounts`, `/(app)/tarjetas`, `/(app)/movimientos`, `/(app)/settings` o `/(app)/settings/categories`
- **THEN** el `PageHeader` aparece visible por debajo del notch en todos los casos

#### Scenario: El header de las pantallas auth respeta el inset

- **WHEN** un usuario abre `/login` en un dispositivo con notch
- **THEN** el título "Bienvenido" queda visible y NO clipped por el status bar, en lugar de depender del `pt-12` hardcoded

## MODIFIED Requirements

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

El `AppMenu` SHALL contener los siguientes items en este orden:

1. **Tarjetas** (route `/tarjetas`) — item habilitado; al press cierra el sheet y navega a la ruta.
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
