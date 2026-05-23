## ADDED Requirements

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

1. Si `backLink` está presente, una fila previa con un `Link` de `expo-router` apuntando a `backLink.href`, mostrando `← {backLink.label}` con tamaño de texto análogo al `text-sm text-muted-foreground` de web.
2. Un `Text` con peso semibold y tamaño análogo a `text-2xl` web conteniendo el `title`.
3. Si `description` está presente, un `Text` análogo a `text-sm text-muted-foreground` web inmediatamente debajo del título, agrupado en el mismo bloque que el título (no separado por el gap del wrapper de la pantalla).
4. Si `actions` está presente, el slot SHALL renderizarse a la derecha del bloque {título + descripción} en la misma fila, alineado al top.

Los colores SHALL leerse de tokens de `@grana/ui-tokens` (o del puente actual del proyecto entre tokens CSS y RN, ver memoria sobre `@grana/ui-tokens`). NO SHALL haber literales de color hex hardcodeados.

El `Text` del título SHALL usar `accessibilityRole="header"` para anuncio correcto por screen readers nativos.

#### Scenario: PageHeader mobile sólo con título

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Movimientos" />`
- **THEN** la jerarquía visual muestra el texto "Movimientos" arriba del contenido de la pantalla
- **AND** el `Text` correspondiente expone `accessibilityRole="header"`
- **AND** no hay back link visible

#### Scenario: PageHeader mobile con back link

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Detalle" backLink={{ href: "/movimientos", label: "Movimientos" }} />`
- **THEN** se renderiza un `Link` de `expo-router` con label `← Movimientos` y `href` `/movimientos` arriba del título
- **AND** presionar el back link navega a `/movimientos`

#### Scenario: PageHeader mobile con actions

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Período" actions={<Pressable>...</Pressable>} />`
- **THEN** el título y el `Pressable` quedan en la misma fila, alineados horizontalmente con el título a la izquierda y la acción a la derecha

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
