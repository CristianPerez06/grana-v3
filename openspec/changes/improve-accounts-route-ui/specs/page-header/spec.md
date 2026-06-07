## MODIFIED Requirements

### Requirement: PageHeader web renderiza el estilo canónico de título de página

`apps/web` SHALL exponer `PageHeader` en `apps/web/components/ui/page-header.tsx`. El componente SHALL renderizar:

1. Si `backLink` está presente, una fila previa con un `next/link` apuntando a `backLink.href`, con label `← {backLink.label}` y clases `text-sm text-muted-foreground hover:text-foreground transition-colors`.
2. Un `<h1>` con clases exactamente `text-2xl font-semibold tracking-tight` conteniendo el `title`.
3. Si `description` está presente, un `<p>` con clases `text-sm text-muted-foreground` inmediatamente debajo del `<h1>`, agrupado en un bloque `flex flex-col gap-1` junto al título.
4. Si `actions` está presente, el slot SHALL renderizarse junto al bloque {título + descripción} en un contenedor responsive: **bajo `< sm` (640px)** el contenedor SHALL ser `flex flex-col items-start gap-3` — el slot `actions` aparece **debajo** del bloque {título + descripción} en una línea separada, alineado al inicio — para evitar que un nombre de acción largo compita con el título en viewports angostos; **a partir de `sm` y hacia arriba** el contenedor SHALL ser `flex flex-row flex-wrap items-start justify-between gap-2` — el slot queda a la derecha del bloque {título + descripción} con wrapping defensivo. Esta regla aplica a todos los consumidores de `PageHeader` (no es una decisión por ruta).

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

#### Scenario: PageHeader con actions apila bajo `< sm` y va al costado a partir de `sm`

- **WHEN** se renderiza `<PageHeader title="Cuentas" actions={<Button>+ Crear cuenta</Button>} />` en un viewport `< sm` (640px)
- **THEN** el `<h1>` y el slot `actions` quedan en un contenedor `flex flex-col items-start gap-3`
- **AND** el slot `actions` aparece debajo del `<h1>`, alineado al inicio
- **WHEN** el mismo header se renderiza en un viewport `≥ sm` (640px o más)
- **THEN** el contenedor pasa a `flex flex-row flex-wrap items-start justify-between gap-2`
- **AND** el slot `actions` queda a la derecha del `<h1>`
- **AND** el `<h1>` conserva las clases `text-2xl font-semibold tracking-tight` en ambos viewports

#### Scenario: PageHeader con description y actions coexistiendo

- **WHEN** se renderiza `<PageHeader title="Categorías" description="Gestioná tus categorías de ingresos y gastos." actions={<Link>+ Agregar</Link>} />`
- **THEN** el bloque {título + descripción} queda agrupado en una columna con `gap-1` entre `<h1>` y `<p>`
- **AND** en viewport `≥ sm` el slot `actions` queda a la derecha del bloque, alineado al top del bloque (no centrado verticalmente)
- **AND** en viewport `< sm` el slot `actions` queda debajo del bloque {título + descripción}, alineado al inicio

#### Scenario: Abrir un overlay no reflowa el header en viewports angostos

- **WHEN** un consumidor renderiza `<PageHeader title="X" actions={<KebabTrigger />} />` en viewport `< sm` y el usuario abre el menú anclado al trigger
- **THEN** el contenedor del header sigue siendo `flex flex-col` y el trigger no salta de posición por compresión de ancho del body
- **AND** un overlay (e.g. `DropdownMenu`) que ajuste body padding via `react-remove-scroll` no SHALL desencadenar reflows del header (los consumidores de overlays anclados a `actions` deberían usar `modal={false}` cuando el overlay no requiere modal real)
