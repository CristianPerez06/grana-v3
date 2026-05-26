## MODIFIED Requirements

### Requirement: PageHeader mobile renderiza el estilo canónico para React Native

`apps/mobile` SHALL exponer `PageHeader` en `apps/mobile/components/ui/PageHeader.tsx`. El componente SHALL usar primitivas de React Native (`View`, `Text`) con clases NativeWind, y SHALL renderizar:

1. Una `SafeAreaView` con `edges={['top']}` y fondo `bg-navy` como wrapper externo. Esta `SafeAreaView` cubre la zona del top safe-area inset (status bar / notch / Dynamic Island), pintándola con `--navy`. **El componente es self-wrapping en el top inset**: las pantallas que lo usan NO deben envolver su contenido en una `SafeAreaView edges={['top']}` adicional — el header lo hace por ellas.
2. Si `backLink` está presente, una fila previa al título con un `Link` de `expo-router` apuntando a `backLink.href`, mostrando `← {backLink.label}` con clases `text-sm text-navy-muted`.
3. Si `backLink` NO está presente, en su lugar SHALL renderizar un spacer `<View className="h-5" />` para preservar la altura de la fila (ver requirement de altura constante).
4. Un `Text` con `accessibilityRole="header"`, peso semibold y tamaño `text-2xl`, color `text-white`, conteniendo el `title`.
5. Si `description` está presente, un `Text` de tamaño `text-sm` con color `text-navy-muted` inmediatamente debajo del título, agrupado en el mismo bloque que el título (no separado por el gap del wrapper de la pantalla).
6. Si `actions` está presente, el slot SHALL renderizarse a la derecha del bloque {título + descripción} en la misma fila, alineado al top.

Los colores SHALL leerse de tokens de `@grana/ui-tokens` vía clases NativeWind (`bg-navy`, `text-white`, `text-navy-muted`). NO SHALL haber literales de color hex hardcodeados en el componente.

El `Text` del título SHALL usar `accessibilityRole="header"` para anuncio correcto por screen readers nativos.

#### Scenario: PageHeader mobile pinta el top safe-area inset en navy

- **WHEN** una pantalla mobile bajo `(app)` renderiza `<PageHeader title="Movimientos" />`
- **THEN** la zona superior de la pantalla, incluyendo el notch / Dynamic Island y la barra de status (reloj, wifi, batería), aparece pintada con `--navy`
- **AND** la barra de header (donde vive el título) continúa la misma banda navy sin discontinuidad de color
- **AND** la pantalla NO necesita declarar `<SafeAreaView edges={['top']}>` propia para evitar overlap con el notch

#### Scenario: PageHeader mobile sólo con título

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Movimientos" />`
- **THEN** la jerarquía visual muestra el texto "Movimientos" en blanco arriba del contenido de la pantalla, sobre fondo navy
- **AND** el `Text` correspondiente expone `accessibilityRole="header"`
- **AND** no hay back link visible (pero el slot reservado de altura sí está presente — ver requirement de altura constante)

#### Scenario: PageHeader mobile con back link

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Detalle" backLink={{ href: "/movimientos", label: "Movimientos" }} />`
- **THEN** se renderiza un `Link` de `expo-router` con label `← Movimientos` y `href` `/movimientos` arriba del título, con clases `text-sm text-navy-muted`
- **AND** presionar el back link navega a `/movimientos`
- **AND** el título "Detalle" aparece debajo del back link en blanco (`text-white`)

#### Scenario: PageHeader mobile con actions

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Período" actions={<Pressable>...</Pressable>} />`
- **THEN** el título y el `Pressable` quedan en la misma fila, alineados horizontalmente con el título a la izquierda y la acción a la derecha
- **AND** ambos se renderizan sobre fondo navy

## ADDED Requirements

### Requirement: El bloque superior (status bar + header) tiene altura constante en mobile

El bloque superior de cada pantalla en `apps/mobile/app/(app)/**` (compuesto por el top safe-area inset y la barra de header renderizada por `PageHeader` o `DashboardHeader`) SHALL tener la misma altura total en todas las pantallas, independientemente de si el header concreto incluye o no un back link.

Para garantizar esta invariante, `PageHeader` y `DashboardHeader` SHALL reservar siempre el slot vertical equivalente a una fila de back link:

- `PageHeader`: cuando `backLink` está ausente, renderiza un `<View className="h-5" />` en lugar de la fila del back link.
- `DashboardHeader`: como no acepta `backLink`, renderiza un `<View className="h-5" />` arriba de la fila título + acciones, ocupando el mismo espacio que tendría la fila del back link en `PageHeader`.

`h-5` (20px) corresponde a la altura natural de un `Text className="text-sm leading-5">← Label</Text>`, que es exactamente lo que renderiza la fila del back link real.

#### Scenario: Pantalla sin back link reserva el mismo espacio que con back link

- **WHEN** un usuario navega de una pantalla A con `<PageHeader title="X" backLink={...} />` a una pantalla B con `<PageHeader title="Y" />` (sin backLink)
- **THEN** la altura total del bloque superior (desde el borde superior del dispositivo hasta el borde inferior de la banda navy) es idéntica en ambas pantallas
- **AND** el título de cada pantalla aparece a la misma posición vertical relativa al borde inferior de la banda navy
- **AND** no hay salto vertical perceptible del contenido scrolleable de la pantalla al alternar entre A y B

#### Scenario: DashboardHeader tiene la misma altura que PageHeader

- **WHEN** un usuario navega entre la pantalla `/dashboard` (que usa `DashboardHeader`) y la pantalla `/transactions` (que usa `<PageHeader title="Movimientos" />`)
- **THEN** la altura total del bloque navy superior es idéntica en ambas pantallas
- **AND** el título "Dashboard" y el título "Movimientos" aparecen a la misma posición vertical

### Requirement: Las pantallas de `(app)` no envuelven con SafeAreaView edges=['top'] cuando renderizan PageHeader o DashboardHeader

Las pantallas bajo `apps/mobile/app/(app)/**` que renderizan `PageHeader` o `DashboardHeader` SHALL usar un `<View className="flex-1 bg-background">` (u otro contenedor sin gestión del top safe-area inset) como root. NO SHALL envolver el contenido en `<SafeAreaView edges={['top']}>` a nivel pantalla, porque el componente del header ya pinta y gestiona el top inset.

El header SHALL renderizarse como **sibling del `ScrollView`** (no como primer hijo), de modo que la banda navy llegue de borde a borde y que el header no se scrollee con el contenido.

Estructura canónica de una pantalla de `(app)`:

```tsx
<View className="flex-1 bg-background">
  <PageHeader title="..." />          {/* fixed top: navy band + safe-area top */}
  <ScrollView contentContainerClassName="px-6 py-6">
    {/* contenido scrolleable */}
  </ScrollView>
</View>
```

Excepciones permitidas:

- La rama de loading inicial de `dashboard.tsx` MAY renderizar un `<SafeAreaView edges={['top']}>` propia, porque no monta `DashboardHeader` (sólo un spinner centrado) y por lo tanto necesita gestionar su propio top inset.

#### Scenario: Una nueva pantalla en (app) no usa SafeAreaView edges=['top'] al nivel screen

- **WHEN** se agrega una pantalla nueva bajo `apps/mobile/app/(app)/` que renderiza `<PageHeader>` o `<DashboardHeader>`
- **THEN** el root de la pantalla es `<View className="flex-1 bg-background">` (u otro contenedor sin `edges={['top']}`)
- **AND** la pantalla NO importa `SafeAreaView` de `react-native-safe-area-context` para el top edge a nivel screen

#### Scenario: El header se renderiza fuera del ScrollView

- **WHEN** se inspecciona cualquier pantalla bajo `apps/mobile/app/(app)/**` que use `<PageHeader>` o `<DashboardHeader>`
- **THEN** el header es un sibling del `ScrollView`, no un hijo del `contentContainer`
- **AND** la banda navy ocupa todo el ancho del dispositivo de borde a borde, sin padding horizontal residual del `ScrollView`
