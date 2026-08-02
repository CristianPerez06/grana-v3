## MODIFIED Requirements

### Requirement: Las pantallas de `(app)` no envuelven con SafeAreaView edges=['top'] cuando renderizan PageHeader o DashboardHeader

Las pantallas bajo `apps/mobile/app/(app)/**` que renderizan `PageHeader` o `DashboardHeader` —directamente o **compuesto dentro de un shell de pantalla**— SHALL usar un `<View className="flex-1 bg-page">` (u otro contenedor sin gestión del top safe-area inset) como root. NO SHALL envolver el contenido en `<SafeAreaView edges={['top']}>` a nivel pantalla, porque el componente del header ya pinta y gestiona el top inset.

El token prescrito es `bg-page` y no su alias `bg-background`: `bg-page` compila a un valor literal, así que pinta correctamente sin depender de que las custom properties de `@grana/ui-tokens` estén declaradas para la plataforma (ver capacidad `project-conventions`).

El header SHALL renderizarse como **sibling del contenedor scrolleable** (no como primer hijo), de modo que la banda navy llegue de borde a borde y que el header no se scrollee con el contenido. Esta invariante vale cualquiera sea el contenedor scrolleable usado — `ScrollView` o el scroller keyboard-aware que provee el app shell (ver capacidad `mobile-app-shell`).

Estructura canónica de una pantalla de `(app)`:

```tsx
<View className="flex-1 bg-page">
  <PageHeader title="..." />          {/* fixed top: navy band + safe-area top */}
  <ScrollView contentContainerClassName="px-6 py-6">
    {/* contenido scrolleable */}
  </ScrollView>
</View>
```

Una pantalla MAY delegar esa estructura completa en un **shell de pantalla reutilizable** que la componga internamente (root `bg-page` + header + scroller keyboard-aware), en lugar de repetirla. Es el caso de las pantallas de formulario, que la delegan en el shell de formulario definido por `mobile-app-shell`. La delegación NO relaja ninguna de las invariantes de arriba: el shell SHALL satisfacerlas por la pantalla, y una pantalla que use el shell NO SHALL declarar `SafeAreaView edges={['top']}` propia ni meter el header dentro del `contentContainer`.

Excepciones permitidas:

- Una rama de render que NO monte un header (por ejemplo un estado de loading que sólo muestra un spinner centrado) MAY renderizar un `<SafeAreaView edges={['top']}>` propia, porque necesita gestionar su propio top inset.

#### Scenario: Una nueva pantalla en (app) no usa SafeAreaView edges=['top'] al nivel screen

- **WHEN** se agrega una pantalla nueva bajo `apps/mobile/app/(app)/` que renderiza `<PageHeader>` o `<DashboardHeader>`
- **THEN** el root de la pantalla es `<View className="flex-1 bg-page">` (u otro contenedor sin `edges={['top']}`)
- **AND** la pantalla NO importa `SafeAreaView` de `react-native-safe-area-context` para el top edge a nivel screen

#### Scenario: El header se renderiza fuera del ScrollView

- **WHEN** se inspecciona cualquier pantalla bajo `apps/mobile/app/(app)/**` que use `<PageHeader>` o `<DashboardHeader>`
- **THEN** el header es un sibling del contenedor scrolleable, no un hijo del `contentContainer`
- **AND** la banda navy ocupa todo el ancho del dispositivo de borde a borde, sin padding horizontal residual del scroller

#### Scenario: Una pantalla de formulario delega la estructura en el shell

- **WHEN** se inspecciona una pantalla de formulario bajo `apps/mobile/app/(app)/**` que usa el shell de formulario en lugar de componer el árbol a mano
- **THEN** la pantalla no declara `<View className="flex-1 bg-page">`, `<PageHeader>` ni el scroller por separado: le pasa al shell el `title` y el `backLink`
- **AND** el árbol renderizado sigue cumpliendo las invariantes: root sin `edges={['top']}`, header sibling del scroller, banda navy de borde a borde

### Requirement: Las pantallas no declaran títulos top-level por fuera de PageHeader (mobile)

`apps/mobile` SHALL renderizar los títulos de pantalla exclusivamente vía `<PageHeader>` en cualquier pantalla bajo `app/(app)/` que tenga un título de pantalla, sea renderizándolo directamente o vía un **shell de pantalla que lo componga internamente** y reciba el `title` como prop. Excepciones:

- `app/(app)/dashboard.tsx` — usa `DashboardHeader`.
- `app/(app)/home.tsx` y `app/(app)/menu.tsx` — pantallas vacías por diseño (placeholder no-renderizado), exentas hasta que ganen contenido.

Un shell de pantalla que componga `PageHeader` SHALL exponer el contract de `PageHeaderProps` (`title`, `description?`, `backLink?`, `actions?`) hacia la pantalla, sin reimplementar el estilo del título: el estilo canónico sigue viviendo en un único lugar, `PageHeader`. Un shell que dibuje su propio título a mano viola esta regla.

Las pantallas placeholder (`movimientos.tsx`, `accounts.tsx`, `tarjetas.tsx`) SHALL renderizar `<PageHeader>` con el título correspondiente en la parte superior de la pantalla, no centrado, y el resto del cuerpo PUEDE quedar vacío hasta que la feature real aterrice.

#### Scenario: Las pantallas placeholder usan PageHeader

- **WHEN** se inspeccionan `apps/mobile/app/(app)/movimientos.tsx`, `accounts.tsx` y `tarjetas.tsx`
- **THEN** los tres archivos importan y renderizan `<PageHeader>` con `title="Movimientos"`, `"Cuentas"` y `"Tarjetas"` respectivamente
- **AND** ninguno renderiza un `<Text>` centrado como única vista de la pantalla

#### Scenario: Una nueva pantalla mobile usa PageHeader

- **WHEN** se agrega una pantalla nueva bajo `apps/mobile/app/(app)/` que requiere un título
- **THEN** la pantalla importa y renderiza `<PageHeader>` con su `title`, o usa un shell que lo componga y al que le pasa el `title`
- **AND** la pantalla NO declara un `<Text>` ad-hoc con estilo de título a mano

#### Scenario: El shell de formulario no reimplementa el estilo del título

- **WHEN** se inspecciona el shell de pantalla de formulario de `apps/mobile`
- **THEN** el shell renderiza `<PageHeader>` y le reenvía `title`, `description`, `backLink` y `actions`
- **AND** el shell NO declara un `<Text>` propio con estilo de título ni duplica la banda navy
