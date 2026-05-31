# Consolidar las tarjetas del dashboard sobre el primitivo `Card` compartido

## Why

Hoy cada sección del dashboard web **re-tipea el shell de tarjeta a mano** —`rounded-2xl border border-border bg-card p-6 shadow-sm`— directamente en su `section`/`div`. No hay una sola fuente de verdad para "cómo se ve una tarjeta", a pesar de que el primitivo `Card` (`apps/web/components/ui/card.tsx`) **ya existe** y nadie lo importa (es un leftover de shadcn).

Ese hand-rolling es exactamente el suelo donde creció el bug visible: el teaser "En qué se fue" se escribió sin `bg-card` (queda con el fondo gris de página, `--page: #F6F7F9`), con radio `rounded-lg` (12px) en vez de `rounded-2xl` (18px) y `p-4` en vez de `p-6`. No se ve como una tarjeta par, se ve roto. Cuando cinco secciones repiten el mismo shell a mano, tarde o temprano una lo escribe mal.

La spec de `project-conventions` ya manda que los primitivos de UI vivan en `components/ui/` con su contrato en `@grana/ui-contracts`. Falta la regla complementaria: **las superficies tipo tarjeta componen ese primitivo, no recrean su shell**. Este change adopta el `Card` existente como única fuente del shell, migra las cinco secciones del dashboard a componerlo, y codifica la regla para que el próximo teaser no pueda volver a derivar.

## What Changes

### A — Reshape del primitivo `Card` (modelo composable)

- **MODIFIED** convención de capas de UI: el shell canónico de tarjeta —radio, borde, fondo, sombra— vive **solo** en el primitivo `Card`; las superficies tipo tarjeta lo componen en vez de re-tipear sus clases inline.
- El `Card` web mantiene el **modelo composable** (shell sin padding + `CardHeader`/`CardContent`/`CardFooter` que llevan el padding). Cambios mínimos:
  - Radio del shell: `rounded-[var(--radius-lg)]` (12px) → **`rounded-2xl`** (token `--radius-2xl`, 18px), que es lo que todas las tarjetas del dashboard ya renderizan y lo que la referencia de Paper indica.
  - Nueva prop **`variant: 'default' | 'emerald'`** sobre el shell: `default` = `border-border bg-card`; `emerald` = `border-emerald/30 bg-emerald/5` (superficies de énfasis). `shadow-sm` se mantiene en ambas.
  - Las sub-partes `CardHeader`/`CardContent`/`CardFooter` **se conservan**. El caso sin header usa `CardContent` con `pt-6` (patrón ya presente en la story).

### B — Las cinco secciones del dashboard componen `Card`

- **ADDED** comportamiento: Hero, "Lo que viene", "Balance del mes", la tarjeta de bienvenida y el teaser "En qué se fue" SHALL componer `Card`; ninguna retiene el shell duplicado inline. Cada una conserva su layout propio (`min-h-*`, dirección flex, `overflow`) vía `className`. La tarjeta de bienvenida usa `variant="emerald"`. El teaser, al componer `Card` default, **gana `bg-card`** — desaparece el fondo gris (el fix).

## Scope & cross-platform

- **Web-only.** La prop `variant` se agrega como **extensión web-local** (intersection sobre `CardProps`), de modo que **no** se toca el contrato `@grana/ui-contracts` ni se fuerza a mobile a implementarla (la convención permite props extra por plataforma vía intersection). Se promueve al contrato cuando mobile necesite la misma variante.
- No hay cambio funcional del dashboard: sigue read-only, con las mismas secciones, datos y estados de carga/error.

## Out of scope

- **Paridad mobile del teaser "En qué se fue"** — ya tiene su propio change (`add-spending-teaser-to-mobile-dashboard`). Este change no lo toca.
- **Alinear el radio del `Card` mobile** (hoy `rounded-xl`) con el web — follow-up menor, no este change.
- **Promover `variant` al contrato `@grana/ui-contracts`** — se hace cuando mobile adopte la variante emerald.

## Stakeholders

- **Web**: reshape del primitivo + migración de las cinco secciones.
- **Producto/Diseño** (Cristian/Julieta): el radio canónico `rounded-2xl` y el `bg-card` del teaser confirman la intención de Paper; no requiere pasada nueva de Paper.
