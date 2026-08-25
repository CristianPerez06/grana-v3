## MODIFIED Requirements

### Requirement: PageHeader web renderiza el estilo canónico de título de página

`apps/web` SHALL exponer `PageHeader` en `apps/web/components/ui/page-header.tsx`. El componente SHALL renderizar:

1. Si `backLink` está presente, una fila previa con un `next/link` apuntando a `backLink.href`, con label `← {backLink.label}`.
2. Un `<h1>` conteniendo el `title`.
3. Si `description` o `descriptionExtras` están presentes, un párrafo de texto secundario inmediatamente debajo del `<h1>`, agrupado en un bloque `flex flex-col gap-1` junto al título.
4. Si `actions` está presente, el slot SHALL renderizarse junto al bloque {título + descripción} en un contenedor responsive: **bajo `< sm` (640px)** el contenedor SHALL ser `flex flex-col items-start gap-3`; **a partir de `sm` y hacia arriba** SHALL ser `flex flex-row flex-wrap items-start justify-between gap-2`. Esta regla aplica a todos los consumidores (no es una decisión por ruta).

El componente SHALL ser un Server Component por defecto (no usar `'use client'`).

**Tratamiento visual por breakpoint.** El componente SHALL renderizar dos tratamientos distintos según el ancho:

- **En `md` y hacia arriba** (desktop): el header vive en el flujo del contenido, sin fondo propio. `<h1>` con clases `text-2xl font-semibold tracking-tight`, back-link y descripción en `text-muted-foreground`.
- **Bajo `md`** (mobile): el header SHALL renderizarse como una **banda navy full-bleed** — fondo `bg-navy`, título en blanco, back-link y descripción en `text-navy-muted`, y el inset superior de safe-area sumado a su padding. La banda SHALL extenderse hasta los bordes del viewport, rompiendo el padding horizontal y superior del wrapper del `<main>` mediante margins negativos que se anulan a partir de `md`.

El acoplamiento entre esos margins negativos y el padding del wrapper de `app-shell.tsx` SHALL estar documentado con un comentario en los dos archivos, cada uno apuntando al otro.

**Reserva del back-link.** Bajo `md`, cuando `backLink` no está presente, el componente SHALL renderizar un spacer de la misma altura que ocuparía el link. El alto del header no SHALL variar según haya o no back-link, para que el chrome no salte al navegar entre rutas de la misma sección.

Ningún color SHALL estar hardcodeado como hex literal; todos SHALL venir de tokens de `@grana/ui-tokens`.

#### Scenario: PageHeader sólo con título

- **WHEN** se renderiza `<PageHeader title="Cuentas" />` en una página
- **THEN** el DOM resultante contiene un `<h1>` con texto "Cuentas"
- **AND** NO hay ningún `<a>` con el patrón de back-link previo al `<h1>`
- **AND** bajo `md` se renderiza un spacer en el lugar que ocuparía el back-link

#### Scenario: Bajo `md` el header es una banda navy full-bleed

- **WHEN** se renderiza `<PageHeader title="Movimientos" />` en un viewport de 375px
- **THEN** el contenedor del header tiene fondo `bg-navy`
- **AND** el `<h1>` se renderiza en blanco
- **AND** el fondo se extiende hasta los bordes izquierdo y derecho del viewport, sin respetar el padding horizontal del wrapper del `<main>`
- **AND** el padding superior del header incluye el inset superior de safe-area

#### Scenario: En `md` y hacia arriba el header no cambia

- **WHEN** el mismo header se renderiza en un viewport de 1280px
- **THEN** el contenedor NO tiene fondo navy
- **AND** el `<h1>` conserva las clases `text-2xl font-semibold tracking-tight`
- **AND** los margins negativos están anulados

#### Scenario: El alto del header no depende del back-link

- **WHEN** un usuario navega en viewport de 375px desde una ruta sin `backLink` a una ruta con `backLink`
- **THEN** el bloque {título + acciones} arranca a la misma altura en las dos rutas
- **AND** el chrome no salta verticalmente durante la navegación

#### Scenario: PageHeader con back link

- **WHEN** se renderiza `<PageHeader title="Crear cuenta" backLink={{ href: "/accounts", label: "Cuentas" }} />`
- **THEN** el DOM contiene un `<a>` con href `/accounts` y texto `← Cuentas` arriba del `<h1>`
- **AND** bajo `md` el link se renderiza en `text-navy-muted`

#### Scenario: PageHeader con actions apila bajo `< sm` y va al costado a partir de `sm`

- **WHEN** se renderiza `<PageHeader title="Cuentas" actions={<Button>+ Crear cuenta</Button>} />` en un viewport `< sm` (640px)
- **THEN** el `<h1>` y el slot `actions` quedan en un contenedor `flex flex-col items-start gap-3`
- **WHEN** el mismo header se renderiza en un viewport `≥ sm`
- **THEN** el contenedor pasa a `flex flex-row flex-wrap items-start justify-between gap-2`

#### Scenario: PageHeader con description y actions coexistiendo

- **WHEN** se renderiza `<PageHeader title="Categorías" description="Gestioná tus categorías de ingresos y gastos." actions={<Link>+ Agregar</Link>} />`
- **THEN** el bloque {título + descripción} queda agrupado en una columna con `gap-1` entre `<h1>` y el párrafo
- **AND** en viewport `≥ sm` el slot `actions` queda a la derecha del bloque, alineado al top

#### Scenario: El header no contiene literales de color

- **WHEN** un desarrollador inspecciona `page-header.tsx`
- **THEN** no encuentra ningún valor `#RRGGBB` ni `rgb(...)` hardcodeado
- **AND** el navy y sus derivados se referencian vía utilidades de token (`bg-navy`, `text-navy-muted`)

## ADDED Requirements

### Requirement: Las rutas raíz de las secciones chromeless usan el back-link canónico (web)

Espejo del requirement equivalente de mobile. Bajo `md`, las secciones alcanzadas desde el menú (`/accounts`, `/cards`, `/settings`) renderizan sin tab bar, de modo que el back-link del `PageHeader` es la **única salida visible** de la pantalla.

La ruta raíz de cada una de esas secciones SHALL declarar `backLink` en su `PageHeader`, con:

- `href` **fijo** a `/dashboard` — no un `history.back()` ni un href derivado del referrer, para que el destino sea el mismo viniendo del menú, de un deep link o de un link del dashboard.
- `label` leído de `nav.dashboard`.

El `backLink` SHALL declararse aunque en `md+` la sección tenga sidebar: el componente es el mismo en los dos anchos, y el link es inocuo en desktop.

Este requirement cubre las **raíces** de sección. Las rutas hijas ya están cubiertas por el requirement "Las rutas hijas bajo (app) usan el back-link canónico de PageHeader (web)", cuyo `backLink` apunta al padre y no al dashboard.

#### Scenario: La raíz de Cuentas declara su salida

- **WHEN** un usuario llega a `/accounts` desde el menú en un viewport de 375px
- **THEN** el `PageHeader` muestra un back-link con label "Inicio" apuntando a `/dashboard`
- **AND** ese link es el único control de navegación visible fuera del contenido de la ruta

#### Scenario: El back-link no depende de cómo se llegó

- **WHEN** un usuario abre `/cards` como deep link, sin historial previo
- **THEN** el back-link apunta igualmente a `/dashboard`
- **AND** la navegación no depende de `history.length`

#### Scenario: En desktop el back-link convive con el sidebar

- **WHEN** el mismo header se renderiza en un viewport de 1280px
- **THEN** el back-link sigue presente
- **AND** el sidebar también, sin que ninguno de los dos invalide al otro
