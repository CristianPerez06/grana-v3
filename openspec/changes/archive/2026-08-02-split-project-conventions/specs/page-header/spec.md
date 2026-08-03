## MODIFIED Requirements

### Requirement: Las pantallas de `(app)` no envuelven con SafeAreaView edges=['top'] cuando renderizan PageHeader o DashboardHeader

Las pantallas bajo `apps/mobile/app/(app)/**` que renderizan `PageHeader` o `DashboardHeader` —directamente o **compuesto dentro de un shell de pantalla**— SHALL usar un `<View className="flex-1 bg-page">` (u otro contenedor sin gestión del top safe-area inset) como root. NO SHALL envolver el contenido en `<SafeAreaView edges={['top']}>` a nivel pantalla, porque el componente del header ya pinta y gestiona el top inset.

El token prescrito es `bg-page` y no su alias `bg-background`: `bg-page` compila a un valor literal, así que pinta correctamente sin depender de que las custom properties de `@grana/ui-tokens` estén declaradas para la plataforma (ver capacidad `ui-foundations`).

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
