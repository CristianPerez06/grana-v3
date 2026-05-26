## MODIFIED Requirements

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

## ADDED Requirements

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
