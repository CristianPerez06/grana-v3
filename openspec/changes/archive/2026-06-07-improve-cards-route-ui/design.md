# Design — `improve-cards-route-ui`

## Contexto

`/cards` ya existe y ya está specificada en dos requirements del capability `cards` relevantes para esta superficie:

- `El listado de tarjetas se muestra como wallet con hero de pago mensual` — estructura (header → hero → sección "Mis tarjetas" → wallet → archivadas), wallet web=grilla / mobile=carrusel, datos del hero (ARS primario, USD subordinado, próximo vencimiento + lista), datos del wallet card (franja de acento, avatar, nombre, meta, pill, stats, footer de cuotas), orden por fecha de cierre ascendente, separación activas/archivadas con sección colapsable, navegación tap → `/cards/[id]`.
- `El header de /cards se renderiza desde el primer paint y sus secciones cargan independientemente` — chrome de header en `layout.tsx` (web) o `PageHeader` custom (mobile), `loading.tsx` (web), scaffold de `<Suspense>` con `<SectionFallback>` por sección, `CardsErrorBoundary` como red de seguridad, react-query per sección en mobile.

Lo que falta es **fijar el handoff visual** (`docs/design/cards/`) como referencia normativa y dejar codificados los **límites de alcance** (no totales nuevos, no búsqueda, no filtros, no acciones nuevas, no datos nuevos) más las **reglas de densidad y stacking responsive** que el handoff introduce. Sin esa codificación, cualquier siguiente vuelta visual queda libre de re-abrir esas discusiones — exactamente el mismo riesgo que motivó `improve-accounts-route-ui`.

## Decisión 1 — Agregar **una** sola requirement nueva, no modificar las existentes

**Alternativas evaluadas:**

- A. Modificar el requirement existente `El listado de tarjetas se muestra como wallet con hero de pago mensual` para inyectar el handoff visual y los no-goals.
- B. Modificar ambos requirements existentes (`wallet con hero` + `header desde el primer paint`).
- C. **Elegida.** Agregar un requirement nuevo, focalizado en el handoff visual y los límites de alcance, complementario a los existentes.

**Por qué C:**

- Los requirements existentes ya describen comportamiento (datos, estructura, navegación, wallet web=grilla / mobile=carrusel, scaffold). Mezclar handoff visual + no-goals en esos requirements los infla y los aleja de su propósito.
- Un requirement nuevo, focalizado, deja un lugar canónico al que apunta este change y cualquier rediseño posterior.
- `MODIFIED Requirements` en OpenSpec exige reescribir el requirement completo (header + body + todos los scenarios), lo cual sería más superficie modificada por una mejora de estilo.
- Sigue la línea adoptada en `improve-accounts-route-ui` (mismo patrón, mismo tipo de change).

## Decisión 2 — Web y mobile **en este mismo change**, como implementaciones nativas en paralelo

A diferencia de `improve-accounts-route-ui`, que dejó mobile como follow-up porque no existía aún implementación mobile de `/accounts`, en `/cards` ya hay paridad web/mobile en producción (mobile cards.tsx + components/cards/). El handoff documenta ambas plataformas y el riesgo de implementar solo web sería dejar mobile sistemáticamente desfasada con el handoff.

Se sigue la política `Web ↔ Mobile policy` de `AGENTS.md`:

- JSX **no** se comparte entre web y RN.
- La paridad se mantiene en **estructura** (header → hero → sección "Mis tarjetas" → wallet → archivadas) y **jerarquía visual** (ARS primario, USD subordinado, pill de estado, franja de acento, footer de cuotas).
- Cada plataforma elige su presentación del wallet: **web** grilla en `md+`, **mobile** carrusel con peek (ya specificado).
- El handoff documenta web y mobile como dos archivos hermanos (`docs/design/cards/web/cards.html` y `docs/design/cards/mobile/cards.html`) sobre el mismo `shared.css` de referencia (no autoritativo).

## Decisión 3 — Bug de navegación mobile entra como tarea, **no** como cambio de requirement

El requirement existente ya dice: "El click/tap en una card SHALL navegar a `/cards/[id]`". El código mobile hoy hace `router.push('/cards')`. Ese gap es **código fuera de spec**, no un requirement nuevo. La corrección entra en tasks (sección 4) y se acompaña con un scenario de regresión en el spec delta que afirma explícitamente que tap → detalle funciona en ambas plataformas (afirmación cross-platform que el requirement original deja implícita).

**Alternativa descartada:** MODIFIED del requirement existente. Reescribirlo completo solo para subrayar mobile sería superficie modificada gratuita.

## Decisión 4 — No-goals codificados explícitamente como parte del requirement

Para que el rediseño no se convierta en vector de scope creep, el requirement incluye una sección explícita de scenarios "NO". Cubre:

- No se agregan totales nuevos al pie de la lista de próximos vencimientos ni al pie del wallet (los totales ARS / USD del hero ya están specificados y NO crecen).
- No se agregan búsqueda, filtros, ni ordenamiento. El orden de las cards del wallet sigue siendo por fecha de cierre ascendente (ya specificado).
- No se agregan métricas derivadas más allá de las que ya muestran el hero (próximo vencimiento + lista de próximos) y el wallet card (cantidad de compras en cuotas, "vence en N días" implícito en el pill).
- No se agregan acciones de tarjeta más allá del tap → detalle. No aparecen kebab por card, share, duplicar, exportar.
- No se introducen nuevos datos en las queries (`getCreditCards`, `getCardsMonthSummary`, `getInstitutions`, `getCardNetworks` quedan idénticas).
- No se agregan cards de resumen extras por encima o por debajo del hero.

Cualquier cambio que viole un no-goal exige un change nuevo y modificar este requirement (no se hace en este change).

## Decisión 5 — Mantener el `Button` primitivo y la regla bimoneda como restricciones del requirement

Estas dos reglas ya están en `AGENTS.md` como cross-cutting principles, pero quedan repetidas en el requirement por dos razones:

1. **Discoverability**: al releer el spec en frío en seis meses, no hay que cruzar con AGENTS.md para ver que el hero respeta bimoneda y que el header / empty state usan `Button`.
2. **Detectabilidad**: un scenario explícito hace que un futuro reviewer pueda apuntar a "este scenario lo prohíbe" si alguien intenta inline-stylizar un botón o sumar monedas.

## Decisión 6 — No tocar el shell de carga ni el error boundary

Los skeletons (`CardsMonthHeroSkeleton`, `WalletSkeleton`, `ArchivedCardsSkeleton`) MAY actualizarse para matchear los nuevos paddings y la nueva densidad interna (tarea 2.6 / 3.6), pero el contrato del scaffold (header en `layout.tsx` web o `PageHeader` mobile, `loading.tsx` cubriendo el área de contenido en web, `<Suspense>` per sección en web, react-query per sección en mobile, `SectionFallback` y `CardsErrorBoundary`) NO cambia. Esa parte está specificada en el otro requirement de `cards` (`El header de /cards se renderiza desde el primer paint…`) y queda intacta.

## Decisión 7 — Stacking responsive bajo `< sm` aplica a tres lugares distintos

El handoff hace tres ajustes de readability sobre viewports angostos. El spec los codifica como reglas separadas porque cada una resuelve un problema distinto:

1. **Filas de próximos vencimientos en el hero**: bajo `< sm`, el bloque de identidad (tarjeta + fecha) y el bloque de monto (ARS primario / USD subordinado) SHALL apilarse en columna en lugar de competir en una sola línea horizontal.
2. **WalletCard interno**: bajo viewports angostos (en mobile, donde la card del carrusel rara vez excede 320–360 px de ancho útil), el nombre largo, el pill de estado, los montos grandes (`pendingAmountARS` puede llegar a `$ 1.840.300,50`) y el límite opcional SHALL acomodarse sin overlap ni truncado agresivo. La regla concreta: nombre y banco wrap a múltiples líneas; pill flota al inicio o pasa a su propia línea si no entra; stats apilados verticalmente cuando el ancho no alcanza.
3. **Header de sección "Mis tarjetas" + hint**: bajo `< sm`, el título y el hint subordinado SHALL stackear o wrapear en lugar de competir en una sola línea horizontal.

Las tres reglas usan tokens y primitivos existentes; no introducen nuevas variantes de Button, Card, ni custom CSS.

## Decisión 8 — La sección "Mis tarjetas" se alinea con el lenguaje de `/accounts` pero **no** comparte componente

El handoff sugiere alinear `WalletSection` con el patrón de `AccountSection` (caps + tracking en el título, hint subordinado, separación visual entre header de sección y contenido). El spec captura el resultado visual (jerarquía, hint subordinado) pero NO obliga a refactorizar `WalletSection` para reusar el componente `AccountSection`. Web y mobile siguen siendo implementaciones nativas; un primitivo compartido entre rutas se justificaría con un change propio si la duplicación real apareciera en `≥ 2` rutas (regla codificada en memory `feedback_reusable_components`).

## Riesgos y mitigaciones

- **Riesgo**: implementar el rediseño y a último momento agregar un "total mensual de tarjetas activas" o un "total de límite agregado" porque visualmente cierra. **Mitigación**: scenarios "NO" del requirement nuevo + auditoría 5.x de tareas.
- **Riesgo**: el rediseño se aplica primero a web y mobile queda desfasada de nuevo. **Mitigación**: este change implementa ambas plataformas en el mismo PR; tasks 2.x y 3.x están en paralelo y validación 6.x cubre ambos.
- **Riesgo**: el fix de navegación mobile se atrasa porque entra mezclado con cambios visuales. **Mitigación**: el fix está aislado a una sub-task (4.1) y a un scenario propio en el spec delta para que aparezca en code review claramente.
- **Riesgo**: scope creep encubierto vía "ajustes menores al wallet card". **Mitigación**: este change NO toca `card-presentation.ts`, `card-detail-*`, `wallet-container.tsx` (solo composición) ni `add-card-button.tsx` (solo verifica que usa `Button`). El set de datos del `WalletCard` queda fijo en el requirement.

## Out of scope

- `/cards/new` (drawer de creación web; mobile aún no implementada) — su look y comportamiento se mantienen como están.
- `/cards/[id]` (detalle de tarjeta) — rediseñado en `2026-05-25-redesign-card-detail-page` y siguientes.
- `/cards/[id]/edit` y `/cards/[id]/periods/...` — quedan fuera.
- Cualquier cambio de query, action, o tipo en `lib/cards/`.
- Implementar `/cards/new` mobile (el CTA del header mobile sigue en disabled placeholder per requirement existente).
