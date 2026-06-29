## Why

`apps/web` se diseñó y ajustó mirando desktop. En celular (anchos 320–420px) la app se ve apretada y, en algunas pantallas, rota: el contenido global usa padding lateral fijo de 32px, los heros muestran montos a `text-[42px]` que desbordan, la cuenta corriente de Compartido es una tabla en grid que queda ilegible, y varios grids fijos (`grid-cols-3`, `grid-cols-2`, `grid-cols-6`) no colapsan. El detalle de Cuentas es el caso más visible. Hoy un usuario en el teléfono ve una experiencia de segunda; queremos que toda la app se vea bien en celular.

Alcance: **solo web responsive**. `apps/mobile` lo lleva el tech lead y no se toca.

## What Changes

- **Causas raíz transversales**
  - El contenedor de contenido del shell (`app-shell.tsx`, región `<main>`) deja de usar padding lateral/vertical fijo (`px-8 py-8`) y pasa a padding escalonado por breakpoint (apretado en mobile, holgado en `md+`).
  - Los paneles de overlay (drawers de alta/edición, modal de recurrencias) dejan de usar padding interno fijo (`px-7`) que se suma al del shell y aprieta los inputs en mobile.
  - Los primitivos de overlay (`dropdown-menu`, `popover`/`date-picker`) clampan su ancho al viewport (`maxWidth`/`min(..., 100vw - margen)`) para no desbordar en pantallas chicas.
- **Por módulo**
  - **Cuentas**: el saldo del hero (`account-detail-header`, `text-[42px]` fijo) escala en mobile; el input de monto del form (`w-[132px]` fijo) deja de tener ancho fijo.
  - **Compartido**: la cuenta corriente (grid tipo tabla `grid-cols-[58px_1fr_auto]`, anchos fijos `w-[88px]`/`w-[104px]`, label absoluto con `whitespace-nowrap` que se sale) se vuelve legible en mobile; los montos hero del home y de settle (`text-[38px]`/`text-[42px]` fijos) escalan.
  - **Tarjetas**: grids fijos que colapsan a 1 columna en mobile (`cuotas-en-curso` `grid-cols-3`, `create-card-form` `grid-cols-2`); `card-detail-header` deja el `pl-[70px]` que aprieta acciones; las columnas laterales que se activan en `md:` pasan a `lg:` para no apretujar tablets.
  - **Movimientos**: el hero de detalle (`detail-hero`, tamaños de texto/símbolo fijos) y el modal de recurrencias escalan en mobile.
  - **Ajustes**: `icon-picker` (`grid-cols-6`) y `color-picker` se adaptan a mobile.
  - **Dashboard**: 4 `CardHeader` con `flex-row` forzado sin `sm:` colapsan correctamente; el `month-navigator` deja de cortar con `whitespace-nowrap` en meses largos.
- **No alcanza**: cambios de comportamiento de negocio, datos, rutas o `apps/mobile`. Es un barrido de presentación/CSS responsive sin tocar lógica.

## Capabilities

### New Capabilities

- `web-responsive-layout`: Contrato transversal de responsive para `apps/web`. Establece que toda ruta autenticada renderiza sin desbordamiento horizontal y se mantiene legible/usable desde 320px de ancho hacia arriba, con reglas concretas para montos de hero que escalan, overlays que clampan al viewport, y superficies densas (grids tipo tabla / multi-columna) que colapsan a una columna en mobile.

### Modified Capabilities

- `web-app-shell`: La región de contenido principal (`<main>`) usa padding responsive por breakpoint en lugar de padding fijo, para no apretar el contenido en mobile.

## Impact

- **Código**: `apps/web/app/(app)/_components/app-shell.tsx` (padding global); componentes de overlay en `apps/web/components/ui/` (`drawer`/`dialog` consumidores, `dropdown-menu`, `popover`, `date-picker`); y componentes de presentación de los módulos accounts, cards, shared, transactions, settings, dashboard (clases Tailwind / breakpoints). Sin cambios de API, datos ni migraciones.
- **Specs**: nueva `web-responsive-layout`; delta en `web-app-shell`.
- **Riesgo**: bajo. Es CSS/markup de presentación. El riesgo está en regresiones de desktop al introducir breakpoints — se mitiga usando el patrón mobile-first (`clase-mobile sm:clase-desktop`) preservando el valor desktop existente.
- **Fuera de alcance**: `apps/mobile` (lo lleva el tech lead); dark mode (diferido).
