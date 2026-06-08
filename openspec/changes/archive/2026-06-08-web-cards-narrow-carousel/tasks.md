# Tasks — `web-cards-narrow-carousel`

> Cambio focal: dos archivos de código web (`wallet.tsx` y `wallet-card.tsx`) más updates de los mocks de diseño. La spec hace MODIFY x2 para mantener consistencia interna; agrega scenarios de header layered en `< md`.

## 1. Alineación previa

- [x] 1.1 Confirmar con el usuario la dirección del carrusel web `< md`. Resultado: **contenido dentro del padding del route shell** (no edge-to-edge), tras review visual del primer intento.
- [x] 1.2 Validar que el `WalletCard` ya soporta ancho angosto vía las reglas responsive de `improve-cards-route-ui` (name `break-words`, pill `items-start`, stats `grid-cols-1 sm:grid-cols-3`, footer `flex-col sm:flex-row`).
- [x] 1.3 Confirmar con el usuario la estructura del header del wallet card en `< md`. Resultado: **3 filas** (chrome con avatar+pill, título, meta), implementado con CSS grid responsive sobre DOM única.

## 2. Implementación — web

- [x] 2.1 `apps/web/app/(app)/cards/_components/wallet.tsx`: cambiar el contenedor de `grid grid-cols-1 gap-5 md:grid-cols-2` a un layout bimodal:
  - **`< md`**: `flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2` (contenido dentro del padding del route shell, sin offset negativo).
  - **`md+`**: `md:grid md:grid-cols-2 md:gap-5 md:overflow-x-visible md:pb-0`.
  Resultado final: clases responsive combinadas en un único `<div>` que cambia el modo de presentación al cruzar `md`.
- [x] 2.2 Envolver cada `<WalletCard>` en un `<div>` wrapper con:
  - **`< md`**: `w-[70vw] max-w-[280px] shrink-0 snap-start`.
  - **`md+`**: `md:w-auto md:max-w-none md:shrink`.
  El wrapper es solo para sizing/snap; el `WalletCard` interno no recibe props nuevos.
- [x] 2.3 `apps/web/app/(app)/cards/_components/wallet-card.tsx`: el header pasa de `flex items-start gap-3` a una estructura CSS grid responsive:
  - **`< md`** (3 filas): fila 1 chrome (avatar `col-start-1 row-start-1`, pill `col-start-3 row-start-1`), fila 2 título (`col-span-3 col-start-1 row-start-2`), fila 3 meta (dentro del mismo bloque del título). El bloque {título + meta} usa `col-span-3` para ocupar todo el ancho.
  - **`md+`** (1 fila): el bloque {título + meta} salta a `md:col-start-2 md:row-start-1 md:col-span-1`; CSS Grid auto-colapsa row 2.
  - Título: `line-clamp-2 [overflow-wrap:anywhere] md:line-clamp-none md:break-words`.
  - Meta: `[overflow-wrap:anywhere] md:break-words` (sin clamp).
- [x] 2.4 Verificar que el empty state (cuando `cards.length === 0`) y el `WalletSection` (header "Mis tarjetas" + hint) NO se ven afectados — siguen siendo el bloque previo + posterior al wallet.
- [x] 2.5 Verificar que el `border-dashed` empty state NO usa los hooks del carrusel (es un branch separado en `wallet.tsx`).

## 3. Design refs

- [x] 3.1 `docs/design/cards/shared.css`: actualizar `.wallet-grid` para que bajo `@media (max-width: 760px)` colapse a `display: flex` con scroll-snap, contenido dentro del padding del stage (sin negative margin), cards `width: 70vw; max-width: 280px`. Mantener el grid base en `min-width: 761px`. **Ya aplicado por el usuario**.
- [x] 3.2 `docs/design/cards/mobile/cards.html` y `docs/design/cards/components/wallet-card.html`: mover `.wallet-title` fuera de `.wallet-card-head` para reflejar la estructura layered (avatar+pill en el head, título y meta como bloques siguientes). **Ya aplicado por el usuario**.
- [x] 3.3 `docs/design/cards/shared.css` selectores `.phone .wallet-card-head` y `.phone .wallet-title strong` + `.phone .wallet-title span`: agregar `justify-content: space-between` al head, `-webkit-line-clamp: 2` + `overflow-wrap: anywhere` al título, `overflow-wrap: anywhere` al span de meta. **Ya aplicado por el usuario**.
- [x] 3.4 `docs/design/cards/README.md`: incorporar el bullet sobre header layered de la card mobile + la frase en la sección "Dirección visual". **Ya aplicado por el usuario**.

## 4. Auditoría de no-goals

- [x] 4.1 Confirmar que no se agregaron paginación con bullets, controles next/prev, ni hints de scroll visibles.
- [x] 4.2 Confirmar que `mobile/Wallet.tsx` no se modificó.
- [x] 4.3 Confirmar que `WalletCard` no recibe props nuevos (la nueva estructura del header es interna).
- [x] 4.4 Confirmar que no se introdujo JS de scroll-sync ni estado React adicional.
- [x] 4.5 Confirmar que el orden de las cards en el carrusel es el mismo que en la grilla (por fecha de cierre del período activo ascendente, sin tarjeta sin ciclo al final alfabéticas — orden del query existente).
- [x] 4.6 Confirmar que el header layered es web-only — `apps/mobile/components/cards/CreditCardItem.tsx` no se modificó.

## 5. Validación

- [x] 5.1 `pnpm openspec validate web-cards-narrow-carousel --strict` pasa.
- [x] 5.2 `pnpm openspec:check` pasa.
- [x] 5.3 `pnpm --filter web lint` pasa.
- [x] 5.4 `pnpm --filter web typecheck` pasa.
- [ ] 5.5 Snapshot manual en navegador (`pnpm --filter web dev`) — verificar en estos viewports:
  - **390px (teléfono)**: una card visible + peek del siguiente, swipe izq/der hace snap entre cards.
  - **600px (tablet portrait angosto)**: una card visible (cap 320px) + peek más amplio.
  - **768px (md breakpoint)**: justo en el borde — debería pasar a grid 2-col. Resize fluido cruzando el breakpoint sin reflows raros.
  - **1024px+ (desktop)**: grid 2-col estándar, sin overflow.
- [ ] 5.6 Verificar empty state en mobile width (todavía debe verse como card border-dashed centrada, no como ítem de carrusel).
