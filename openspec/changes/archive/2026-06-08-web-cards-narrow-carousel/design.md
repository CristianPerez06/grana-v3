# Design — `web-cards-narrow-carousel`

## Contexto

`improve-cards-route-ui` (archivado 2026-06-07) cerró explícitamente la puerta a un carrusel web con la frase "NO carrusel" en la sección de "Reglas de presentación del wallet" de la requirement nueva. Esa decisión defensiva está documentada en el design.md de ese change:

> **Web**: grilla — 2 columnas en `md+`, 1 columna debajo de `md`. NO carrusel.
> **Mobile**: carrusel horizontal con snap, una card por viewport, peek de la siguiente. NO grilla, NO paginación con bullets, NO tabs.

La motivación era evitar duplicar JSX o lógica entre web y mobile. En la práctica el resultado en web `< md` (teléfono) es una lista vertical apilada full-width que no se siente como un wallet — se siente como una lista de elementos. Para el usuario, ver el wallet en el teléfono es exactamente cuando más sentido tiene la metáfora "tarjetas físicas" + gesto de swipe.

Este change re-abre la puerta al carrusel en web `< md`, pero acota cuidadosamente cómo se implementa para no romper la regla "no JSX compartido" entre web y mobile.

## Decisión 1 — MODIFY los dos requirements existentes, no ADD uno nuevo

**Alternativas evaluadas:**

- A. ADD una requirement nueva ("Web wallet en viewports angostos renderiza como carrusel"). Deja los requirements existentes intactos pero los contradice en su contenido ("1 columna debajo de md" vs "carrusel debajo de md").
- B. **Elegida.** MODIFY los dos requirements existentes que contienen el statement actual sobre la presentación del wallet en `< md`. Resultado: la spec queda internamente consistente; no hay contradicción.

**Por qué B:**

- En OpenSpec, dos requirements que contradicen sobre el mismo aspecto del comportamiento son una mancha que se acumula. Hoy es una contradicción visible; mañana, cuando alguien lea solo uno de los requirements y no el otro, va a implementar la versión vieja.
- MODIFY es verbose (exige reproducir todo el requirement, incluyendo todos los scenarios que NO cambian), pero el costo se paga una vez y deja la spec limpia.
- La precedencia `improve-accounts-route-ui` ya estableció que MODIFY full-text es el patrón aceptado en este repo cuando hay que reescribir un requirement (ver `specs/page-header/spec.md` de ese change).

## Decisión 2 — Carrusel web implementado en CSS puro, no compartido con mobile

**Decisión:** el carrusel web se implementa con `overflow-x-auto` + `scroll-snap-type: x mandatory` + `scroll-snap-align: start` en cada card. Cero JS de control. Cero estado React. Cero `react-native-*`.

**Por qué:**

- La regla `Web ↔ Mobile policy` de `AGENTS.md` (codificada en memory como `feedback_cross_platform_components`) dice: "web y mobile comparten nombres/estructura/props públicas, pero cada uno usa lo idiomático de su stack". CSS `scroll-snap` es idiomático de web; `FlatList` con `snapToInterval` es idiomático de RN. NO compartir implementación es la regla, no la excepción.
- CSS `scroll-snap` tiene soporte nativo en Safari iOS, Chrome Android, todos los browsers modernos. Sin polyfill, sin librerías.
- Cero estado adicional. Si el browser maneja el scroll, no hay que sincronizar nada con React.
- Reutiliza el mismo componente `Wallet` para los dos breakpoints. La diferencia es puramente CSS responsive — el JSX es el mismo. NO hay un `<WalletGrid>` y un `<WalletCarousel>` separados.

## Decisión 3 — Carrusel contenido dentro del padding del route shell (sin offset negativo)

**Decisión:** el carrusel `< md` SHALL quedar **contenido dentro del `px-8` del route shell**. Sin negative margin. El primer card empieza en el borde izquierdo del área de contenido y el contenedor del carrusel termina en el borde derecho del área de contenido. Para que el peek siga siendo visible dentro de esa zona más angosta, cada card usa `w-[70vw] max-w-[280px]` (más angosto que el edge-to-edge donde estaba en `w-[78vw] max-w-[320px]`).

**Alternativas evaluadas:**

- A. Edge-to-edge con `-mx-8 px-8 md:mx-0 md:px-0`. El carrusel rompe el padding del shell y llega al viewport. Peek visible al borde derecho del viewport (~46px en teléfono típico).
- B. **Elegida (revisada).** Contenido dentro del padding `px-8`. Peek visible pero al borde derecho del área de contenido. Card más angosta (`w-[70vw] max-w-[280px]`) para preservar peek dentro del área restringida.

**Por qué B (después de ver el resultado de A):**

- En review visual, A se veía "demasiado mobile" — el carrusel rompía la lectura de la página como un objeto continuo, como si fuera una sección de otro origen pegada en medio del flujo.
- B mantiene el carrusel como parte natural del contenido, respetando la grilla visual del shell. El peek es más estrecho pero suficiente como affordance del gesto de swipe.
- El cambio entre A y B es solo de clases utilitarias (`-mx-8 px-8` removido) y un sizing de card más conservador. La estructura del componente y el comportamiento de scroll-snap son idénticos.
- Decisión inicial fue A (per la AskUserQuestion en la conversación de origen), pero el usuario pivoteó a B después de ver el resultado renderizado. Decisión actual: B.

## Decisión 4 — Sizing del card en el carrusel: ancho fijo intrínseco al viewport, calibrado al modo contenido

**Decisión:** cada card en el carrusel `< md` SHALL usar `w-[70vw] max-w-[280px] shrink-0`. En `md+`, el wrapper pasa a `md:w-auto md:max-w-none md:shrink`.

**Por qué:**

- Con el carrusel contenido dentro de `px-8` (Decisión 3), el área de scroll en un viewport de 390px es ~326px. Un card de 70vw (~273px) más un gap-4 (16px) deja ~37px de peek visible — suficiente como affordance del gesto.
- El máximo de 280px coincide con el card mobile RN (`CARD_MAX_WIDTH = 280` en `apps/mobile/components/cards/Wallet.tsx`). En un tablet en portrait el card se ve igual de "compacto" que en mobile, no gigante.
- `shrink-0` es obligatorio para que el flex container no comprima las cards al ancho disponible (lo cual mataría el peek).
- En `md+` el wrapper retoma el comportamiento de cell de grid (sin ancho fijo, sin shrink-0), respetando el `gap-5` y el `grid-cols-2`.

## Decisión 5 — NO se agregan controles de paginación, bullets, ni "next/prev"

**Decisión:** el carrusel es puro scroll-snap, sin controles explícitos. NO indicadores de página (dots), NO botones "siguiente / anterior", NO hint visual "swipe →".

**Por qué:**

- El handoff actual (web/cards.html, mobile/cards.html) no muestra controles. Agregarlos abre scope visual que no estaba en discusión.
- La affordance del peek de la siguiente card es suficiente — el usuario ve que hay más contenido y aprende el gesto.
- A11y por teclado funciona naturalmente: Tab pasa por cada card (cada una es un `<a>`), las flechas izq/der mueven el scroll horizontal cuando el foco está sobre el contenedor de scroll.
- Si en el futuro se decide agregar controles (e.g. para accesibilidad mejorada), entra como change separado.

## Decisión 6 — Mobile RN NO se toca en este change

**Decisión:** el archivo `apps/mobile/components/cards/Wallet.tsx` no se modifica. El carrusel mobile actual (FlatList horizontal con snapToInterval) sigue su comportamiento.

**Por qué:**

- El alcance de este change es estrictamente web `< md`.
- Si el carrusel mobile RN tiene bugs (e.g. la conversación previa sobre "FlatList horizontal podría no estar funcionando con N+1 cards"), eso es un change separado que necesita su propio análisis y test en simulador.
- Mantener mobile fuera del scope reduce el riesgo de regresión cruzada.

## Decisión 7 — Header del WalletCard en 3 filas bajo `< md` (avatar+pill, título, meta)

**Decisión:** en el carrusel web (`< md`), el header del `WalletCard` SHALL renderizarse en tres filas verticales:

1. Fila de chrome con avatar a la izquierda y `CardStatusPill` a la derecha (espacio entre ambos).
2. Fila del título (`line-clamp-2` + `overflow-wrap:anywhere`).
3. Fila de meta (`overflow-wrap:anywhere`, sin clamp).

En `≥ md` (grilla), el header retoma la composición horizontal de una sola fila (avatar + título-block + pill).

**Implementación:** una **única estructura DOM** sobre CSS grid con `grid-template-columns: auto minmax(0,1fr) auto`. El avatar se ancla a `col-start-1 row-start-1`, el pill a `col-start-3 row-start-1`, y el bloque {título + meta} salta de `col-span-3 row-start-2` (bajo `< md`) a `md:col-start-2 md:row-start-1` (en `md+`). Cuando el bloque salta a row 1 en `md+`, row 2 deja de existir y CSS Grid auto-colapsa.

**Por qué CSS grid responsive sobre DOM única, no DOM duplicado:**

- DOM duplicado (un bloque `md:hidden` con el layered header + un bloque `hidden md:flex` con el horizontal) sería más legible pero duplica los componentes (avatar y pill renderizados dos veces) y crea dos árboles que pueden divergir si alguien edita uno y olvida el otro.
- CSS grid responsive resuelve el mismo problema con clases responsive en los items. El avatar y el pill se renderizan una vez; solo cambian su posición de grid según el breakpoint.
- Compromiso: el JSX queda menos auto-evidente (hay que entender CSS grid + responsive classes para leer la estructura). Mitigación: comentario inline en el componente describiendo la lógica.

**Por qué `line-clamp-2` + `overflow-wrap: anywhere` en el título bajo `< md`:**

- En el carrusel todas las cards deberían tener alturas similares (el peek visible y el snap se ven raros si la primera card es notablemente más alta que la segunda). Capear el título a 2 líneas garantiza que un nombre extremadamente largo no inflate una sola card.
- `overflow-wrap: anywhere` permite quebrar dentro de palabras (e.g. "VisaGaliciaPrincipalGastosFamiliaresMuyLargo") si el ancho de la card no permite quebrar entre palabras. Sin esto, una palabra larga sin espacios desbordaría la card.
- En `md+` (`line-clamp-none break-words`), el título puede crecer naturalmente — las celdas de grilla son más anchas y el clamp deja de ser necesario.

## Decisión 8 — Design refs actualizados para reflejar la decisión nueva

**Decisión:** actualizar `docs/design/cards/web/cards.html` y `docs/design/cards/shared.css` para que el media query `@media (max-width: 760px)` en `.wallet-grid` ya no colapse a 1-col sino a un carrusel horizontal. El mock pasa a ser ejemplo visual del comportamiento bimodal.

**Por qué:**

- El handoff es referencia normativa (per la spec). Si la spec dice "carrusel debajo de md" pero el mock muestra stack vertical, el handoff queda desactualizado y siembra confusión en futuras implementaciones.
- El cambio en CSS es chico (una regla en media query).

## Riesgos y mitigaciones

- **Riesgo**: scroll horizontal nested dentro del scroll vertical de la página puede ser confuso en touch devices (el dedo accidentalmente activa el wrong axis). **Mitigación**: `scroll-snap-type: x mandatory` ya orienta el gesto al eje horizontal una vez que empieza. Touch devices modernos detectan el ángulo inicial del swipe.
- **Riesgo**: el peek de la última card del carrusel queda "feo" (la card cortada al medio). **Mitigación**: agregar `scroll-padding-right` o un pseudo-elemento al final del carrusel para compensar; en este change inicial confiamos en que el comportamiento natural (última card alineada al snap más cercano cuando se hace scroll al final) es aceptable. Si en review visual se ve raro, se ajusta dentro de este change.
- **Riesgo**: la a11y por teclado en el carrusel CSS es funcional pero no descubrible (no hay hint que diga "usá flechas"). **Mitigación**: out of scope para este change. Si surge feedback de a11y, se abre change separado para controles explícitos.
- **Riesgo**: el `WalletCard` interno tiene `truncate` / `break-words` calibrado para ancho de cell de grilla (~400px en md+). En el carrusel `< md` cada card es ~78vw (~300px en teléfono típico). El `break-words` ya está implementado por `improve-cards-route-ui` para `< sm`. **Mitigación**: heredamos esa regla; no hace falta tocar `WalletCard`.

## Out of scope

- Carrusel en web `md+` (sigue siendo grilla).
- Cualquier cambio en mobile RN (`apps/mobile/`).
- Controles de paginación (bullets, next/prev, indicadores de progreso).
- Animaciones de transición entre breakpoints (reflow nativo del browser es suficiente).
- Carruseles en otras rutas (`/dashboard`, `/accounts`, etc.).
- A11y avanzada: ARIA roles `region` + label + announcer de cambio de card. Si surge necesidad, change separado.
