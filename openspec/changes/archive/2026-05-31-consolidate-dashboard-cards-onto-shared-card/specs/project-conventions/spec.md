# Delta — Las superficies tipo tarjeta componen el primitivo `Card`

## ADDED Requirements

### Requirement: Las superficies tipo tarjeta componen el primitivo `Card`, no recrean su shell

Cuando una superficie de UI necesita la apariencia de tarjeta (un contenedor con borde, fondo, radio y sombra), SHALL **componer el primitivo `Card`** (y sus sub-partes `CardHeader`/`CardContent`/`CardFooter` cuando aplique) en lugar de re-tipear las clases del shell (`rounded-* border bg-card shadow-sm …`) inline en una `section`/`div`. El shell canónico —radio, borde, fondo y sombra— SHALL vivir en una sola fuente: el primitivo `Card` en `apps/web/components/ui/card.tsx` (y su contraparte mobile en `apps/mobile/components/ui/Card.tsx`).

El `Card` SHALL seguir el **modelo composable**: el shell NO lleva padding propio; el padding interno proviene de `CardHeader`/`CardContent`/`CardFooter`. Una superficie sin header SHALL reponer el padding superior vía `CardContent` con `pt-6`. Cada superficie SHALL conservar su layout propio (`min-h-*`, dirección flex, `overflow`) vía `className` sobre `Card` o sus hijos, sin re-declarar el shell.

El `Card` web SHALL usar `rounded-2xl` (token `--radius-2xl`) como radio canónico de tarjeta. El `Card` SHALL exponer variantes de superficie vía una prop `variant`: `default` (`border-border bg-card`) y `emerald` (`border-emerald/30 bg-emerald/5`) para superficies de énfasis/promoción. La prop `variant` PUEDE vivir como extensión web-local (intersection sobre `CardProps`) mientras mobile no la necesite; cuando mobile requiera la misma variante, `variant` SHALL promoverse al contrato `@grana/ui-contracts` e implementarse en ambas plataformas.

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

#### Scenario: El teaser del dashboard se ve como tarjeta par

- **WHEN** se renderiza el teaser "En qué se fue" en el dashboard web
- **THEN** compone `<Card>` (variante `default`) y obtiene `bg-card` y `rounded-2xl` del primitivo
- **AND** NO muestra el fondo gris de página (`--page`) por carecer de `bg-card`

#### Scenario: Agregar `variant` web-local no rompe mobile

- **WHEN** se agrega la prop `variant` al `Card` web como extensión web-local (intersection sobre `CardProps`)
- **THEN** el contrato `@grana/ui-contracts` NO cambia
- **AND** `pnpm --filter mobile typecheck` sigue verde sin que mobile implemente `variant`
