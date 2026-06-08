# Carrusel horizontal en el wallet web debajo de `md`

## Why

Hoy `/cards` en web renderiza el wallet como `grid grid-cols-1 md:grid-cols-2` — en viewports `< md` (mobile/tablet en portrait) las cards quedan apiladas como bloque vertical full-width, lo cual rompe la lectura del wallet como un objeto "tarjetas físicas" y obliga al usuario a hacer scroll vertical largo para revisar varias tarjetas.

El handoff `docs/design/cards/web/cards.html` y la spec original (`improve-cards-route-ui`, archivada 2026-06-07) explícitamente codificaron "1 columna debajo de `md`. NO carrusel" para el wallet web. Esa decisión fue defensiva (evitar duplicar la implementación mobile en web), pero en uso real el stack vertical no se siente como wallet — se siente como lista. La paridad con el carrusel mobile es la presentación correcta también en web cuando el viewport es angosto.

Este change corrige esa decisión: web `< md` pasa a **carrusel horizontal con snap y peek**, paridad de gesto con el carrusel mobile pero implementado en CSS (`overflow-x-auto` + `scroll-snap-type`) sobre el mismo componente `Wallet`. Web `md+` sigue siendo grilla 2 columnas (sin cambios). Mobile sigue siendo carrusel nativo (sin cambios).

## What Changes

- **MODIFICAR** dos requirements en `cards`:
  - `El listado de tarjetas se muestra como wallet con hero de pago mensual` — el bullet 4 (presentación del wallet) cambia "Web: grilla — 2 columnas en md+, 1 columna debajo de md" por "Web: grilla 2 columnas en md+, carrusel horizontal con snap y peek debajo de md (paridad de gesto con mobile, implementación CSS)". Agrega un scenario nuevo "Wallet en carrusel horizontal con tres tarjetas activas (web, < md)" y uno de "Resize de viewport cruzando md". El scenario existente "Wallet en grilla con dos tarjetas activas (web)" se mantiene pero acota su condición a `≥ md`.
  - `El estilo visual de /cards (raíz) sigue el handoff docs/design/cards/ y respeta sus no-goals` — sección "Reglas de presentación del wallet" cambia "Web: grilla — 2 columnas en md+, 1 columna debajo de md. NO carrusel" por la regla bimodal nueva. El scenario "El wallet sigue como grilla en web y carrusel en mobile" se reemplaza por "El wallet se adapta al breakpoint en web; mobile es siempre carrusel". Otros scenarios (cross-platform nav, no-goals, etc.) se mantienen idénticos.
- **CÓDIGO** en `apps/web/app/(app)/cards/_components/wallet.tsx`: el contenedor cambia de `grid grid-cols-1 gap-5 md:grid-cols-2` a un contenedor responsive que es flex+scroll-snap **contenido dentro del `px-8` del route shell** bajo `< md` y grid 2-col en `md+`. Cada card se envuelve en un wrapper con ancho fijo (`w-[70vw] max-w-[280px]`) + `snap-start` + `shrink-0` bajo `< md`, y `w-auto` en `md+`.
- **CÓDIGO** en `apps/web/app/(app)/cards/_components/wallet-card.tsx`: el header de la card pasa de `flex items-start gap-3` (avatar + title-block + pill en una fila) a una estructura de **CSS grid responsive**. Bajo `< md` el header se acomoda en 3 filas (avatar + pill, luego título, luego meta); en `md+` retoma la composición horizontal de una sola fila. Estructura DOM única; las clases responsive (`md:col-start-X md:row-start-1`) reordenan los items entre los breakpoints. El título usa `line-clamp-2` + `[overflow-wrap:anywhere]` en `< md` para evitar que nombres muy largos rompan la altura del carrusel; en `md+` retoma `break-words` sin clamp.
- **DOCS** `docs/design/cards/web/cards.html` y `docs/design/cards/shared.css` — actualizar el media query `@media (max-width: 760px)` para que `.wallet-grid` no colapse a 1-col sino a una variante carrusel (`.wallet-grid.is-narrow` o equivalente). Es un ajuste del mock para reflejar la decisión nueva; no impacta producción.
- **NO** se modifican: queries (`getCreditCards`, `getCardsMonthSummary`, `getInstitutions`, `getCardNetworks`), tipos (`CardListItem`, `CardsMonthSummary`), server actions, rutas (`/cards`, `/cards/new`, `/cards/[id]`), el componente `WalletCard` interno (no necesita props nuevos), el shell de Suspense ni `CardsErrorBoundary`. Mobile (`apps/mobile/components/cards/Wallet.tsx`) no se toca.
- **NO** se agregan: paginación con bullets, indicadores de scroll, controles de "siguiente/anterior", lazy loading. El carrusel es solo `overflow-x-auto + scroll-snap` puro CSS, sin JS de control.

## Capabilities

### New Capabilities

_Ninguna._ Esta propuesta modifica requirements existentes en la capability `cards`.

### Modified Capabilities

- `cards`: dos requirements modificados. Ambos exclusivamente para flexibilizar la regla "web wallet = grilla siempre" hacia "web wallet = grilla en md+, carrusel en < md". Sin cambios en el set de datos, en las queries, en las acciones, ni en mobile.

## Impact

- **Rutas afectadas**: `/cards` (raíz), web, viewports `< md`. Web `md+` y mobile (cualquier viewport) sin cambios visuales.
- **Código afectado**:
  - `apps/web/app/(app)/cards/_components/wallet.tsx` — el único archivo de código que cambia. Sustituye el contenedor `grid grid-cols-1 md:grid-cols-2` por un layout bimodal con scroll-snap bajo `< md`. Cada `WalletCard` se envuelve en un wrapper con clases responsive.
  - Posiblemente `apps/web/app/(app)/cards/_components/wallet-card.tsx` — solo si la card necesita ajustes responsive adicionales para verse bien en el carrusel (ancho fijo, padding interno). En principio NO, porque el wrapper externo controla el sizing.
- **Design refs actualizados**:
  - `docs/design/cards/web/cards.html` — el mock @media query para narrow viewport pasa de 1-col grid a flex carrusel con peek.
  - `docs/design/cards/shared.css` — selectores responsive del `.wallet-grid` o nuevos selectores `.wallet-carousel-on-narrow` (no autoritativo; referencia visual).
- **Data layer**: sin cambios. Sin nuevas queries, sin nuevos campos, sin nuevas server actions.
- **Dependencias**: ninguna nueva. Usa tokens existentes y Tailwind v4 nativo (`snap-x snap-mandatory snap-start overflow-x-auto`).
- **Tailwind classes nuevas usadas**: `snap-x`, `snap-mandatory`, `snap-start`, `overflow-x-auto`, `-mx-8 md:mx-0`, `shrink-0 md:shrink`. Todas son utilidades Tailwind v4 estándar.
- **i18n**: ninguna clave nueva.
- **Mobile**: cero cambios en `apps/mobile/`. El carrusel mobile sigue siendo RN nativo.
- **A11y**: el contenedor de scroll horizontal SHALL ser navegable por teclado (Tab + flechas siguen funcionando porque cada card es un `<a>` / `Link`). El primer focus dentro del wallet sigue siendo la primera card. NO se agregan controles "next/prev" en este change — el handoff actual no los pide y agregarlos abre scope que no necesitamos resolver acá.
