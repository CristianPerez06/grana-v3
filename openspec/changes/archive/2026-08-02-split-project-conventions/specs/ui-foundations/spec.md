## ADDED Requirements

### Requirement: Capas de componentes UI y ubicación de componentes compuestos

Los componentes de UI de Grana SHALL organizarse en tres capas según su reutilización, y cada capa SHALL vivir en una ubicación canónica por plataforma:

1. **Primitivos de UI** — building blocks básicos (`Button`, `Card`, `Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, `Alert`, `Spinner`, `Label`, …). SHALL vivir en `apps/web/components/ui/` y `apps/mobile/components/ui/`, una implementación nativa por plataforma, con el prop type compartido en `@grana/ui-contracts`. En web cada primitivo SHALL tener una story de Storybook; mobile no tiene Storybook y SHALL espejar los primitivos por nombre. Los primitivos de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`) NO MAY incluir vertical margin propio (`mb-*`, `mt-*`, `my-*`); el ritmo vertical entre campos SHALL ser propiedad del contenedor padre (`flex-col gap-X` o equivalente).
2. **Componentes compuestos** — reutilizables entre rutas pero no lo bastante genéricos para `ui/` (sin Storybook). Se dividen en:
   - **Shells de app/route-group:** SHALL vivir en `apps/<app>/components/layout/` (`AuthShell`, `TabBar`, `AppMenu`). La ubicación coincide entre plataformas.
   - **Compartidos de feature:** compartidos entre rutas de una misma feature. En web SHALL vivir bajo el route group en `apps/web/app/(group)/_components/` (Next.js ignora los directorios con prefijo `_`). En mobile NO MAY colocarse bajo `app/` (Expo Router trata `app/` como rutas) y SHALL vivir en `apps/mobile/components/<feature>/`.
3. **Locales de ruta/pantalla** — de un solo uso, colocados junto a la ruta (`login/login-form.tsx` en web; inline en la pantalla en mobile).

La divergencia de ubicación de los compartidos de feature entre web y mobile es intencional y la fuerza el router; NO viola la política Web↔Mobile (que prohíbe compartir JSX y exige paridad de API por contratos, no rutas de carpeta idénticas).

Como regla de uso derivada: pantallas equivalentes en web y mobile SHALL usar el primitivo equivalente de su plataforma. En particular, un campo de contraseña SHALL usar el primitivo `PasswordField` (con toggle ver/ocultar) en ambas plataformas, NUNCA un input crudo con `secureTextEntry`. Un campo de dinero SHALL usar el primitivo `MoneyAmountInput` (sanitización de keystrokes + `inputMode="decimal"` / `keyboardType="decimal-pad"`) en ambas plataformas, NUNCA un `<input type="number">` (web) ni un `TextInput` crudo (mobile).

#### Scenario: Un primitivo nuevo vive en components/ui de ambas apps con story en web

- **WHEN** un colaborador agrega un primitivo de UI nuevo
- **THEN** crea la implementación en `apps/web/components/ui/` (con su `*.stories.tsx`) y en `apps/mobile/components/ui/`
- **AND** define el prop type compartido en `@grana/ui-contracts`

#### Scenario: Un componente compartido entre rutas de una feature se ubica según el router de la plataforma

- **WHEN** un colaborador necesita reutilizar un componente entre varias rutas de una misma feature (no genérico para `ui/`)
- **THEN** en web lo coloca en `apps/web/app/(group)/_components/`
- **AND** en mobile lo coloca en `apps/mobile/components/<feature>/`, no bajo `app/`

#### Scenario: Pantallas equivalentes usan el primitivo equivalente

- **WHEN** una pantalla de auth necesita un campo de contraseña en web y en mobile
- **THEN** ambas plataformas usan el primitivo `PasswordField` (con toggle ver/ocultar)
- **AND** ninguna usa un input crudo con `secureTextEntry`

#### Scenario: Un campo de dinero usa MoneyAmountInput en ambas plataformas

- **WHEN** una pantalla necesita capturar un monto de dinero (saldo, importe, límite) en web o en mobile
- **THEN** la pantalla usa el primitivo `MoneyAmountInput` de su plataforma, que sanitiza keystrokes a dígitos + un único separador decimal
- **AND** web NO usa `<input type="number">` (riesgo de spinner/wheel/arrows perdiendo centavos por aritmética float)
- **AND** mobile NO usa un `TextInput` crudo de React Native con `keyboardType="decimal-pad"` ni un primitivo de campo bespoke equivalente

#### Scenario: Un primitivo de campo no bakea margen vertical propio

- **WHEN** un colaborador agrega o modifica un primitivo de campo (`Input`, `FormField`, `PasswordField`, `MoneyAmountInput`, o un futuro primitivo equivalente)
- **THEN** el primitivo NO incluye clases `mb-*`, `mt-*`, ni `my-*` en su root
- **AND** las pantallas que componen varios campos SHALL controlar el ritmo vertical mediante un contenedor padre con `flex-col gap-X` (o equivalente nativo de la plataforma)
- **AND** las pantallas NO MAY envolver primitivos en `<View>` / `<div>` auxiliares solo para agregar margen vertical alrededor de un campo

### Requirement: `@grana/ui-tokens` sirve sus custom properties a ambas plataformas

`@grana/ui-tokens` expone dos familias de color. Los **tokens estructurales** (`page`, `card`, `navy`, `border-soft`, `text`, `text-muted`, `text-soft`, `positive`, `terracotta`, la paleta `cat-*`, la paleta `account-*`, …) tienen valores literales. Los **aliases** de estilo shadcn (`background`, `foreground`, `primary`, `secondary`, `muted`, `muted-foreground`, `input`, `ring`, `destructive`, `success`, `info`, `surface-*`, y sus `*-foreground`) tienen como valor un string `var(--…)` que apunta a un token estructural.

Los aliases SHALL resolver en **ambas** plataformas. Para eso, el bloque `:root` de custom properties declarado en `packages/ui-tokens/src/theme.css` SHALL estar disponible también para `apps/mobile`: el codegen del package (`scripts/codegen.mjs`) SHALL emitir, junto al `tokens.cjs` que ya genera, un CSS con ese mismo `:root`, y `apps/mobile/global.css` SHALL importarlo. NativeWind resuelve `var()` en runtime contra las variables declaradas en `:root`.

Sin ese `:root`, cualquier clase cuyo token sea un alias compila a `var(--…)`, la variable no existe en React Native y la superficie o el texto **no toman color** — un fallo silencioso que NO detectan `pnpm typecheck` ni `pnpm lint`.

`apps/mobile` MAY usar indistintamente aliases y tokens estructurales una vez declarado el `:root`. NO SHALL asumirse que el nombre de la clase revela a qué token apunta: el utility prefix se concatena con la key del color, así que `text-muted` es el prefijo `text-` sobre el alias `muted` (un color de **borde**), mientras que el token estructural `text-muted` se escribe `text-text-muted`. Ante la duda, la resolución SHALL verificarse compilando la config de Tailwind, no leyendo el nombre.

#### Scenario: Un alias resuelve en mobile

- **WHEN** un componente de `apps/mobile` aplica una clase cuyo token es un alias (por ejemplo `bg-background` o `bg-muted`)
- **THEN** la superficie renderiza con el color del token estructural al que apunta el alias
- **AND** no queda sin color ni deja ver el window background nativo

#### Scenario: El codegen emite el CSS de variables para mobile

- **WHEN** un colaborador corre el codegen de `@grana/ui-tokens` tras editar `theme.css`
- **THEN** se regeneran tanto `tokens.cjs` como el CSS con el bloque `:root`
- **AND** ambos quedan derivados de la misma fuente, sin listas de colores mantenidas a mano

#### Scenario: El nombre de la clase no revela el token

- **WHEN** un colaborador necesita el color de texto secundario en `apps/mobile`
- **THEN** sabe que `text-muted` apunta al alias `muted` (`var(--border-soft)`, un color de borde) y que el token de texto es `text-text-muted`
- **AND** elige la clase compilando la config o consultando `tokens.cjs`, no por el nombre

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
