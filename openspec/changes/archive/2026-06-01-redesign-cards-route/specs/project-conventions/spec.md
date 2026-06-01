## ADDED Requirements

### Requirement: Las acciones tipo botón componen el primitivo `Button`, no recrean su estilo

Cuando una superficie de UI necesita una **acción tipo botón** —un CTA primario, secundario, ghost, destructivo o un link estilizado como botón— SHALL **componer el primitivo `Button`** (`apps/web/components/ui/button.tsx`, contraparte mobile en `apps/mobile/components/ui/Button.tsx`) en lugar de re-tipear las clases de un botón (`bg-primary`/`bg-emerald`/`rounded-* px-* py-* text-… font-…`) inline en un `<button>` o un `<Link>`/`<a>`.

El estilo canónico de las acciones —color por variante, alto, padding, radio, estado de foco/disabled/loading— SHALL vivir en una sola fuente: el primitivo `Button` y sus `variant`/`size` (`primary | secondary | ghost | destructive | link` × `sm | md | lg | icon`). Las pantallas equivalentes en web y mobile SHALL usar el primitivo `Button` de su plataforma, nunca un control estilizado a mano (misma regla de uso que ya rige para `PasswordField` y `MoneyAmountInput`).

Cuando la acción navega (es un link), SHALL componerse como `<Button asChild><Link href=…>…</Link></Button>` en web, de modo que el `Link` reciba el estilo del primitivo sin duplicar clases. Esta regla es el gemelo, para acciones, de la regla de superficies tipo tarjeta (que compone `Card`).

Excepciones acotadas y legítimas (NO requieren `Button`): los links de navegación inline tratados como texto (breadcrumbs, "Ver todos →", links del footer admin) que NO pretenden la apariencia de un botón; y los controles internos de un primitivo que ya encapsula su propia interacción (`Segmented`, `Switch`, `Tabs`).

#### Scenario: Un CTA nuevo compone `Button`

- **WHEN** un colaborador agrega un CTA (p. ej. "Agregar tarjeta", "Registrar pago") en una pantalla web
- **THEN** compone `<Button variant=…>` (o `<Button asChild><Link…></Button>` si navega)
- **AND** NO re-tipea `bg-primary`/`bg-emerald rounded-* px-* py-* text-sm font-medium` inline en un `<button>` o `<Link>`

#### Scenario: Un link estilizado como botón usa `asChild`

- **WHEN** una acción que navega necesita la apariencia de botón primario
- **THEN** usa `<Button asChild><Link href=…>…</Link></Button>`
- **AND** el `Link` hereda el estilo del primitivo sin duplicar las clases del botón

#### Scenario: Un link de navegación inline no requiere `Button`

- **WHEN** una pantalla muestra un link de navegación tratado como texto (breadcrumb, "Ver todos los resúmenes →", link del footer admin)
- **THEN** PUEDE renderizarse como `<Link>` con estilo de texto (`text-… hover:…`)
- **AND** NO se exige componer `Button`, porque no pretende la apariencia de un botón

## MODIFIED Requirements

### Requirement: Las superficies tipo tarjeta componen el primitivo `Card`, no recrean su shell

Cuando una superficie de UI necesita la apariencia de tarjeta (un contenedor con borde, fondo, radio y sombra), SHALL **componer el primitivo `Card`** (y sus sub-partes `CardHeader`/`CardContent`/`CardFooter` cuando aplique) en lugar de re-tipear las clases del shell (`rounded-* border bg-card shadow-sm …`) inline en una `section`/`div`. El shell canónico —radio, borde, fondo y sombra— SHALL vivir en una sola fuente: el primitivo `Card` en `apps/web/components/ui/card.tsx` (y su contraparte mobile en `apps/mobile/components/ui/Card.tsx`).

El `Card` SHALL seguir el **modelo composable**: el shell NO lleva padding propio; el padding interno proviene de `CardHeader`/`CardContent`/`CardFooter`. Una superficie sin header SHALL reponer el padding superior vía `CardContent` con `pt-6`. Cada superficie SHALL conservar su layout propio (`min-h-*`, dirección flex, `overflow`) vía `className` sobre `Card` o sus hijos, sin re-declarar el shell.

El `Card` web SHALL usar `rounded-2xl` (token `--radius-2xl`) como radio canónico de tarjeta. El `Card` SHALL exponer variantes de superficie vía una prop `variant`: `default` (`border-border bg-card`) y `emerald` (`border-emerald/30 bg-emerald/5`) para superficies de énfasis/promoción. La prop `variant` PUEDE vivir como extensión web-local (intersection sobre `CardProps`) mientras mobile no la necesite; cuando mobile requiera la misma variante, `variant` SHALL promoverse al contrato `@grana/ui-contracts` e implementarse en ambas plataformas.

Cuando una superficie tipo tarjeta es **clickeable** (toda la tarjeta navega o dispara una acción — p. ej. una card del wallet que es un `<Link>`, o la card "En curso" que es un `<button>`), SHALL componer `Card` con la prop **`asChild`** (`<Card asChild><Link …>…</Link></Card>` / `<Card asChild><button …>…</button></Card>`), de modo que el elemento interactivo BE el shell de tarjeta sin re-tipear `rounded-* border bg-card shadow-sm` inline. `asChild` (sobre Radix `Slot`) es extensión web-local sobre `CardProps`, igual que `variant`; se promueve al contrato cuando mobile lo requiera. Es el gemelo, para superficies, del `asChild` de `Button`.

Las cinco superficies tipo tarjeta del dashboard web (Hero, "Lo que viene", "Balance del mes", la tarjeta de bienvenida y el teaser "En qué se fue") SHALL componer `Card`; ninguna SHALL retener el shell duplicado inline.

#### Scenario: Una nueva superficie tipo tarjeta compone `Card`

- **WHEN** un colaborador necesita una superficie con apariencia de tarjeta en web
- **THEN** compone `<Card>` (con `CardHeader`/`CardContent`/`CardFooter` según corresponda)
- **AND** NO re-tipea `rounded-* border bg-card shadow-sm` inline en una `section`/`div`
- **AND** pasa su layout propio (`min-h-*`, flex, `overflow`) vía `className`

#### Scenario: La tarjeta de énfasis usa la variante `emerald`

- **WHEN** una superficie de tarjeta necesita el tratamiento de énfasis verde (p. ej. la tarjeta de bienvenida del dashboard)
- **THEN** usa `<Card variant="emerald">`
- **AND** NO re-tipea `border-emerald/30 bg-emerald/5` inline

#### Scenario: Una superficie tipo tarjeta clickeable usa `asChild`

- **WHEN** toda una superficie de tarjeta navega o dispara una acción (p. ej. una card del wallet `<Link>` o la card "En curso" `<button>`)
- **THEN** compone `<Card asChild>` envolviendo el elemento interactivo
- **AND** NO re-tipea `rounded-* border bg-card shadow-sm` inline en el `<Link>`/`<button>`

#### Scenario: El teaser del dashboard se ve como tarjeta par

- **WHEN** se renderiza el teaser "En qué se fue" en el dashboard web
- **THEN** compone `<Card>` (variante `default`) y obtiene `bg-card` y `rounded-2xl` del primitivo
- **AND** NO muestra el fondo gris de página (`--page`) por carecer de `bg-card`

#### Scenario: Agregar `variant` web-local no rompe mobile

- **WHEN** se agrega la prop `variant` al `Card` web como extensión web-local (intersection sobre `CardProps`)
- **THEN** el contrato `@grana/ui-contracts` NO cambia
- **AND** `pnpm --filter mobile typecheck` sigue verde sin que mobile implemente `variant`
