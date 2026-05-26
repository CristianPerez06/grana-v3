# page-header Specification

## Purpose

Define el componente reutilizable `PageHeader` para `apps/web` y `apps/mobile`. Cubre el contract de props compartido en `@grana/ui-contracts` (`PageHeaderProps` con `title`, `description?`, `backLink?` y `actions?`), las dos implementaciones idiomáticas (HTML en web, React Native en mobile), el estilo canónico de título de página y la regla de anti-regresión que prohíbe declarar títulos top-level por fuera de este componente (con excepciones explícitas para headers compuestos de detalle y para wizards/auth).

## Requirements

### Requirement: La app provee un componente PageHeader reutilizable con contract compartido

Cada app (web y mobile) SHALL exponer un componente `PageHeader` reutilizable en su librería local de componentes UI. El componente SHALL renderizar el título de una página y, opcionalmente, un back link y un slot de acciones a la derecha del título.

Las propiedades públicas SHALL coincidir entre plataformas. El tipo `PageHeaderProps` SHALL vivir en `packages/ui-contracts/src/index.ts` y SHALL ser idéntico entre web y mobile:

```ts
type PageHeaderProps = {
  /**
   * Title rendered as the page-level heading. Required.
   */
  title: string
  /**
   * Optional one-line description rendered immediately below the title,
   * inside the header block so the visual cohesion is preserved (the page
   * wrapper's gap does not separate them).
   */
  description?: string
  /**
   * Optional back link rendered above the title. When provided, both fields
   * are required (the type forbids the half-defined state).
   */
  backLink?: {
    href: string
    label: string
  }
  /**
   * Optional slot rendered on the right side of the title row. Intended for
   * page-level actions (a button, a dropdown, a small action group). Not for
   * arbitrary visual content.
   */
  actions?: ReactNode
  className?: string  // solo significativo en web; mobile lo acepta para paridad de API
}
```

El componente SHALL renderizar el `description` (cuando exista) como un párrafo de texto secundario inmediatamente debajo del título, dentro del mismo bloque que el título — NO debe estar separado por el gap del wrapper de la página. Cuando `actions` y `description` coexisten, las acciones se renderizan a la derecha del bloque {título + descripción} alineadas a la parte superior.

#### Scenario: PageHeaderProps es el mismo tipo en ambas plataformas

- **WHEN** se modifica `PageHeaderProps` en `packages/ui-contracts/src/index.ts`
- **THEN** TypeScript reporta error en `apps/web` y en `apps/mobile` simultáneamente si la nueva firma rompe el uso existente

#### Scenario: backLink obliga a proveer href y label juntos

- **WHEN** un desarrollador intenta renderizar `<PageHeader title="..." backLink={{ href: "/foo" }} />` (sin `label`)
- **THEN** TypeScript reporta error en compilación
- **AND** el componente no admite el estado inválido en runtime

#### Scenario: description renderiza pegado al título, no separado por el gap del wrapper

- **WHEN** se renderiza `<PageHeader title="Movimientos" description="Historial cronológico de ingresos, gastos, transferencias..." />`
- **THEN** el `<h1>` y el párrafo de descripción quedan agrupados en un mismo bloque con `gap-1` entre ellos (tightly coupled)
- **AND** el gap del wrapper de la página (típicamente `gap-6`) NO se interpone entre título y descripción

### Requirement: PageHeader web renderiza el estilo canónico de título de página

`apps/web` SHALL exponer `PageHeader` en `apps/web/components/ui/page-header.tsx`. El componente SHALL renderizar:

1. Si `backLink` está presente, una fila previa con un `next/link` apuntando a `backLink.href`, con label `← {backLink.label}` y clases `text-sm text-muted-foreground hover:text-foreground transition-colors`.
2. Un `<h1>` con clases exactamente `text-2xl font-semibold tracking-tight` conteniendo el `title`.
3. Si `description` está presente, un `<p>` con clases `text-sm text-muted-foreground` inmediatamente debajo del `<h1>`, agrupado en un bloque `flex flex-col gap-1` junto al título.
4. Si `actions` está presente, el slot SHALL renderizarse a la derecha del bloque {título + descripción} en la misma fila, alineado a `flex flex-wrap items-start justify-between gap-2`.

El componente SHALL ser un Server Component por defecto (no usar `'use client'`) — el `next/link` y los slots no requieren cliente.

#### Scenario: PageHeader sólo con título

- **WHEN** se renderiza `<PageHeader title="Cuentas" />` en una página
- **THEN** el DOM resultante contiene un `<h1>` con texto "Cuentas" y clases `text-2xl font-semibold tracking-tight`
- **AND** NO hay ningún `<a>` ni `<Link>` previo al `<h1>`
- **AND** NO hay ningún contenedor `flex` para acciones a la derecha del título

#### Scenario: PageHeader con back link

- **WHEN** se renderiza `<PageHeader title="Crear cuenta" backLink={{ href: "/accounts", label: "Cuentas" }} />`
- **THEN** el DOM contiene un `<a>` (renderizado por `next/link`) con href `/accounts` y texto `← Cuentas` arriba del `<h1>`
- **AND** el `<h1>` con texto "Crear cuenta" se renderiza debajo del back link
- **AND** los estilos del back link son `text-sm text-muted-foreground hover:text-foreground transition-colors`

#### Scenario: PageHeader con actions a la derecha

- **WHEN** se renderiza `<PageHeader title="Período" actions={<button>Editar</button>} />`
- **THEN** el `<h1>` y el `<button>` quedan en una misma fila con `flex flex-wrap items-start justify-between gap-2`
- **AND** el `<h1>` conserva las clases `text-2xl font-semibold tracking-tight`

#### Scenario: PageHeader con description y actions coexistiendo

- **WHEN** se renderiza `<PageHeader title="Categorías" description="Gestioná tus categorías de ingresos y gastos." actions={<Link>+ Agregar</Link>} />`
- **THEN** el bloque {título + descripción} queda a la izquierda en una columna con `gap-1`
- **AND** el slot `actions` queda a la derecha alineado al top del bloque, no centrado verticalmente

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

### Requirement: Las pages no declaran títulos top-level por fuera de PageHeader (web)

`apps/web` SHALL renderizar los títulos de página exclusivamente vía `<PageHeader>` en cualquier ruta bajo `app/(app)/**/page.tsx`, **excepto** en las páginas listadas como excepciones explícitas:

- `app/(app)/dashboard/page.tsx` — usa `DashboardHeader`.
- `app/(app)/accounts/[id]/page.tsx` — usa `AccountDetailHeader`.
- `app/(app)/cards/[id]/page.tsx` — usa `CardHero`.
- `app/(app)/transactions/[txId]/page.tsx` — usa `GlobalTransactionDetail` con su propio header interno.
- `app/(app)/accounts/[id]/transactions/[txId]/page.tsx` — usa `TransactionDetailHeader`.

Las páginas del wizard de onboarding (`app/(onboarding-wizard)/**/page.tsx`) y de auth (`app/(auth)/**/page.tsx`) tienen su propio contexto visual y NO están cubiertas por esta regla en esta iteración.

Una page nueva bajo `app/(app)/` que necesite mostrar un título de página SHALL usar `<PageHeader>`. Una page que declare un `<h1>` directo con estilo distinto al de `PageHeader` viola esta regla y SHALL ser corregida en review.

#### Scenario: Ninguna page bajo (app) declara `<h1>` ad-hoc

- **WHEN** se inspecciona `apps/web/app/(app)/**/page.tsx`
- **THEN** ningún archivo (salvo los listados como excepción) contiene la cadena literal `<h1`
- **AND** los archivos exceptuados renderizan su título vía un componente header dedicado, no vía `<h1>` directo en la page

#### Scenario: Una nueva ruta usa PageHeader

- **WHEN** se agrega una page nueva bajo `app/(app)/` que requiere un título
- **THEN** la page importa y renderiza `<PageHeader>` con su `title` (y opcionalmente `backLink` y `actions`)
- **AND** la page NO declara un `<h1>` propio

### Requirement: Las pantallas no declaran títulos top-level por fuera de PageHeader (mobile)

`apps/mobile` SHALL renderizar los títulos de pantalla exclusivamente vía `<PageHeader>` en cualquier pantalla bajo `app/(app)/` que tenga un título de pantalla, **excepto**:

- `app/(app)/dashboard.tsx` — usa `DashboardHeader`.
- `app/(app)/home.tsx` y `app/(app)/menu.tsx` — pantallas vacías por diseño (placeholder no-renderizado), exentas hasta que ganen contenido.

Las pantallas placeholder (`movimientos.tsx`, `accounts.tsx`, `tarjetas.tsx`) SHALL renderizar `<PageHeader>` con el título correspondiente en la parte superior de la pantalla, no centrado, y el resto del cuerpo PUEDE quedar vacío hasta que la feature real aterrice.

#### Scenario: Las pantallas placeholder usan PageHeader

- **WHEN** se inspeccionan `apps/mobile/app/(app)/movimientos.tsx`, `accounts.tsx` y `tarjetas.tsx`
- **THEN** los tres archivos importan y renderizan `<PageHeader>` con `title="Movimientos"`, `"Cuentas"` y `"Tarjetas"` respectivamente
- **AND** ninguno renderiza un `<Text>` centrado como única vista de la pantalla

#### Scenario: Una nueva pantalla mobile usa PageHeader

- **WHEN** se agrega una pantalla nueva bajo `apps/mobile/app/(app)/` que requiere un título
- **THEN** la pantalla importa y renderiza `<PageHeader>` con su `title`
- **AND** la pantalla NO declara un `<Text>` ad-hoc con estilo de título a mano

### Requirement: PageHeader tiene una historia de Storybook en web

`apps/web` SHALL incluir una historia de Storybook en `apps/web/components/ui/page-header.stories.tsx` con cuatro variantes que cubren el contract:

1. Sólo `title`.
2. `title` + `backLink`.
3. `title` + `actions`.
4. `title` + `backLink` + `actions`.

Cada variante SHALL renderizar el componente real con props representativas. La historia sirve como referencia visual y como contrato vivo del componente.

`apps/mobile` NO tiene Storybook hoy, por lo que esta regla no aplica a mobile en esta iteración.

#### Scenario: Las cuatro variantes existen en Storybook

- **WHEN** un desarrollador corre `pnpm storybook` y navega al árbol del componente `PageHeader`
- **THEN** ve al menos cuatro stories distintas correspondientes a las variantes definidas
- **AND** cada story monta sin error y renderiza el componente real (no un mock)
