## ADDED Requirements

### Requirement: El estilo visual de `/cards` (raíz) sigue el handoff `docs/design/cards/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/cards` (raíz, sin segmentos hijos) siguiendo el handoff visual versionado en `docs/design/cards/`. El handoff es **referencia normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock HTML.

El rediseño SHALL operar **solamente** sobre los componentes y datos que la ruta ya expone hoy. Los componentes habilitados son:

**Web** (`apps/web/app/(app)/cards/`):

- `CardsLayout` (`layout.tsx`, server component sync) y `loading.tsx` (skeletons shape-matched).
- `CardsHeader` (montado desde `layout.tsx`, client component con queries propias para count y catálogos).
- `AddCardButton` (acción primaria del header, usa `Button` primitivo).
- `CardsMonthHeroContainer` + `CardsMonthHero` (server async + presentational).
- `WalletContainer` + `WalletSection` + `Wallet` + `WalletCard`.
- `ArchivedCardsContainer` + `ArchivedCardsSection` (sección secundaria colapsable, `<details>` nativo).
- Skeletons `CardsMonthHeroSkeleton`, `WalletSkeleton`, `ArchivedCardsSkeleton`.
- `CardsErrorBoundary`, `RouteError`, `SectionFallback` (chrome de error — ver requirement existente "El header de /cards se renderiza desde el primer paint…").

**Mobile** (`apps/mobile/app/(app)/cards.tsx` + `apps/mobile/components/cards/`):

- `CardsHeader` (wrapper sobre `PageHeader` custom del app mobile; nunca el header nativo del stack).
- `CardsMonthHero` (con su react-query propia, key `['cards', 'month-summary']`).
- `Wallet` (carrusel horizontal con snap, react-query key `['cards']`).
- `CreditCardItem` (item del carrusel; equivalente mobile de `WalletCard`).
- `ArchivedCardsSection` (sección colapsable con `Pressable` + `useState`; NO usa `<details>`, que no existe en RN; react-query key `['cards', 'archived']`).
- `SectionFallback` del toolkit mobile.

Los datos habilitados son **exactamente** los que ya devuelven `getCreditCards()` y `getCardsMonthSummary()`, más `getInstitutions()` y `getCardNetworks()` para el drawer de alta: nombre de tarjeta, red, banco, monedas activas, período activo, monto pendiente ARS / USD, pill de estado, `credit_limit` opcional, cuotas activas, archivado, total ARS / USD a pagar del mes, próximo vencimiento, y lista de próximos vencimientos. El rediseño NO SHALL agregar campos a `CardListItem` ni a `CardsMonthSummary` ni queries nuevas.

**Reglas de jerarquía visual en `CardsMonthHero`.** El hero SHALL renderizar, en este orden:

1. Eyebrow / label "A pagar este mes".
2. Monto agregado: **ARS primario** en tipografía grande (semibold `text-text`); **USD subordinado** debajo o al costado, jerarquía menor (`text-text-soft`). ARS y USD NO SHALL sumarse, mezclarse ni convertirse. Si no hay deuda USD (`totalUSD === 0`), la línea USD MAY omitirse; si no hay deuda ARS, la línea ARS sigue mostrando `$ 0` y USD se renderiza igual.
3. Destacado del próximo vencimiento más cercano (tarjeta + fecha).
4. Lista "Próximos vencimientos" — filas con tarjeta, fecha de vencimiento, monto ARS, y monto USD si aplica.

**Layout responsive del hero.**

- **Web**: dos columnas en `md+` (monto agregado a la izquierda + lista de próximos vencimientos a la derecha), una columna debajo de `md`.
- **Mobile**: una sola columna; primero el monto agregado con el destacado del próximo vencimiento, luego la lista de próximos vencimientos como filas en el mismo container.

**Reglas de stacking de la fila de próximo vencimiento.** Bajo `< sm` (web) o por default (mobile), cada fila de próximo vencimiento SHALL apilarse en columna: bloque de identidad (nombre de tarjeta + fecha) arriba, bloque de monto (ARS primario / USD subordinado) abajo. NO SHALL competir nombre y monto por la misma línea horizontal cuando el ancho disponible no alcanza. En `≥ sm` (web), la fila vuelve a layout horizontal con el monto alineado a la derecha.

**Reglas de jerarquía visual en `WalletSection`.** El header de la sección "Mis tarjetas" SHALL renderizarse con título compacto (caps + tracking, paridad visual con `AccountSection` de `/accounts`) seguido del hint subordinado "Tocá una para ver el resumen". Bajo `< sm` (web) o por default (mobile), título y hint SHALL apilarse o wrapearse en lugar de competir en una sola línea horizontal. NO SHALL refactorizarse `WalletSection` para reusar `AccountSection`; cada ruta mantiene su propio componente y solo comparte el lenguaje visual.

**Reglas de readability en `WalletCard` (web) / `CreditCardItem` (mobile).** Este requirement NO redefine el set de datos por card (eso vive en el requirement existente "El listado de tarjetas se muestra como wallet con hero de pago mensual"); refina cómo los datos existentes se acomodan bajo viewports angostos. Cada implementación parte del set de datos ya implementado en su plataforma (web full set; mobile el subset actual de `CreditCardItem` — name, pill de alerta, monto pendiente ARS / USD, barra de límite con disponible) y SHALL aplicar estas reglas:

- **Nombre de la tarjeta**: bajo viewports angostos (`< sm` web; default en mobile), el nombre SHALL wrappear a múltiples líneas en lugar de truncarse con elipsis cuando excede el ancho disponible. En web `≥ sm`, el nombre SHALL volver a truncate con elipsis para preservar el layout horizontal compacto.
- **Pill de estado**: tiene ancho intrínseco y SHALL NO competir por la misma línea que un nombre largo. Si no entra junto al nombre, SHALL bajar a su propia línea (o quedar alineado al inicio del header de la card), sin overlap con la franja de acento y sin desbordarse del slot.
- **Montos ARS / USD**: respetan bimoneda — ARS primario, USD subordinado, nunca sumados ni convertidos. Cuando la card muestra stats (la implementación web actual), bajo viewports angostos los stats SHALL apilarse verticalmente cuando el layout horizontal cómodo no entra. La implementación mobile actual no muestra stats triadas (resumen / cierra / vence); este requirement NO obliga a agregarlos.
- **Barra de límite (opcional)**: cuando `credit_limit` está cargado, ocupa todo el ancho útil de la card y muestra la copy de `% usado · disponible` ARS-only. Cuando `credit_limit === null`, la barra NO se renderiza (per requirement existente).

La paridad funcional completa del `CreditCardItem` mobile con el `WalletCard` web (meta `Crédito · <red>`, stats triada, footer de cuotas + "Ver resumen") queda **fuera de alcance** de este change. La rige el requirement existente y SHALL implementarse en un change futuro dedicado.

**Navegación de la card.** El click (web) y el tap (mobile) sobre cualquier zona tappable de la card SHALL navegar a `/cards/[id]` con el `id` de la tarjeta. Esto SHALL aplicar de forma idéntica en ambas plataformas; cualquier código que navegue a un destino distinto (e.g. `/cards`) está fuera de spec y SHALL corregirse. (El requirement existente "El listado de tarjetas se muestra como wallet con hero de pago mensual" ya lo exige; este requirement lo refuerza con un scenario cross-platform de regresión.)

**Reglas de presentación del wallet.**

- **Web**: grilla — 2 columnas en `md+`, 1 columna debajo de `md`. NO carrusel.
- **Mobile**: carrusel horizontal con snap, una card por viewport, peek de la siguiente. NO grilla, NO paginación con bullets, NO tabs.

**Sección "Archivadas".** Permanece secundaria y colapsable, debajo del wallet, solo cuando existe ≥1 tarjeta archivada. Web usa `<details>` nativo; mobile usa `Pressable` + `useState` (NO `<details>`, que no existe en RN). El encabezado muestra "Archivadas (N)" y la lista está cerrada por defecto. Cada item lista nombre + enlace al detalle (`/cards/[id]`).

**Acciones del header.** El botón "+ Agregar tarjeta" del header (`AddCardButton` web; equivalente mobile) SHALL seguir usando el primitivo `Button`. NO SHALL re-tipearse `bg-primary` / `bg-emerald` ni paddings ad-hoc sobre `<button>` o `<Pressable>` desnudos. El CTA mobile permanece en disabled placeholder mientras `/cards/new` mobile no exista (per requirement existente del listado).

**Web y mobile son implementaciones nativas en paralelo.** El handoff incluye `docs/design/cards/web/cards.html` y `docs/design/cards/mobile/cards.html`. Este change SHALL implementar ambas plataformas en paralelo (a diferencia de `improve-accounts-route-ui`, que dejó mobile como follow-up porque no existía implementación mobile). La paridad se mantiene en estructura y jerarquía visual, NO en JSX compartido. JSX SHALL NO compartirse entre `apps/web` y `apps/mobile`.

**No-goals (vinculantes).** El rediseño NO SHALL:

- Agregar totales nuevos al pie de la lista de próximos vencimientos, al pie del wallet, ni como card separada. Los únicos totales son ARS primario y USD subordinado del hero "A pagar este mes", ya specificados; estos totales NO SHALL crecer ni acompañarse de un total adicional (e.g. "límite agregado de todas las tarjetas", "deuda histórica acumulada").
- Agregar resumen / overview / hero extras por encima o por debajo del hero del mes.
- Agregar búsqueda, toolbar de filtros, chips de filtros activos, ni control de ordenamiento. El orden de las cards del wallet permanece el specificado: por fecha de cierre del período activo ascendente, tarjetas sin ciclo configurado al final alfabéticas.
- Agregar métricas derivadas más allá de las que ya muestran el hero (próximo vencimiento + lista de próximos) y el wallet card (cantidad de compras en cuotas, pill de estado).
- Agregar acciones de tarjeta nuevas. El único click/tap sobre la card sigue siendo navegar al detalle (`/cards/[id]`). NO SHALL aparecer kebab por card, share, duplicar, exportar, ni acciones primarias adicionales en el footer del wallet card.
- Agregar nuevos campos a `CardListItem` o `CardsMonthSummary`, nuevas queries en `lib/cards/`, ni nuevas server actions.

Cualquier propuesta que viole un no-goal SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse.

#### Scenario: La ruta sigue el handoff de docs/design/cards/

- **WHEN** un desarrollador implementa el rediseño visual de `/cards`
- **THEN** la composición sigue la estructura del handoff: header con título + acción primaria, hero "A pagar este mes" con monto agregado + próximos vencimientos, sección "Mis tarjetas" con título compacto + hint subordinado, wallet (grilla web / carrusel mobile), y sección archivadas opcional al final
- **AND** la implementación usa los componentes ya enumerados en el requirement, no JSX inline ni componentes nuevos creados ad-hoc
- **AND** los valores visuales se derivan de tokens en `@grana/ui-tokens` y primitivos en `apps/web/components/ui/` (web) y `@grana/ui-mobile` (mobile), no de hex literales copiados del mock

#### Scenario: El hero del mes respeta ARS primaria y USD secundaria

- **WHEN** el usuario tiene deuda agregada `$200.000` ARS y `US$ 200` USD a pagar este mes
- **THEN** el hero muestra `$200.000` como monto ARS primario con tipografía grande
- **AND** muestra `US$ 200` como total USD subordinado, separado del ARS, con jerarquía menor (`text-text-soft`)
- **AND** los valores SHALL NOT sumarse ni convertirse en un único número
- **AND** si la deuda USD es `0`, la línea USD MAY omitirse; si la deuda ARS es `0`, la línea ARS sigue mostrando `$ 0`

#### Scenario: Las filas de próximos vencimientos se apilan bajo viewports angostos

- **WHEN** el viewport es `< sm` (web) o por default (mobile) y una fila de próximo vencimiento contiene un nombre de tarjeta largo (e.g. "Visa Galicia Eminent World Black") junto con un monto largo (e.g. "$ 1.840.300,50")
- **THEN** el contenido interno de la fila se apila en columna: identidad (nombre + fecha) arriba, monto (ARS primario / USD subordinado) abajo
- **AND** el nombre de la tarjeta y el monto NO SHALL competir por la misma línea horizontal
- **AND** la regla bimoneda se respeta dentro del bloque de monto (ARS arriba, USD abajo)

#### Scenario: Las filas de próximos vencimientos vuelven al layout horizontal en `≥ sm` (web)

- **WHEN** el viewport web es `≥ sm` (640px o más)
- **THEN** cada fila de próximo vencimiento renderiza identidad y monto en la misma línea horizontal con el monto alineado a la derecha
- **AND** la regla bimoneda se respeta dentro del bloque de monto (ARS arriba, USD abajo)

#### Scenario: El header de sección "Mis tarjetas" + hint se apilan bajo viewports angostos

- **WHEN** el viewport es `< sm` (web) o por default (mobile)
- **THEN** el título "Mis tarjetas" (caps + tracking) y el hint subordinado "Tocá una para ver el resumen" se renderizan apilados o wrapeados, no competiendo por la misma línea horizontal
- **AND** la jerarquía se mantiene: título principal con peso semibold, hint con `text-text-soft` y tamaño menor

#### Scenario: Un nombre largo wrappea a una segunda línea en el wallet card y no se desborda

- **WHEN** el viewport es angosto (web `< sm` o mobile) y el nombre de la tarjeta excede el ancho disponible (e.g. "Visa Galicia Eminent World Black sueldo")
- **THEN** el nombre se continúa en una nueva línea debajo de la primera, sin truncarse con elipsis
- **AND** el texto NO SHALL desbordarse sobre la franja de acento, sobre el pill de estado, ni sobre el footer
- **AND** el subtítulo de meta "Crédito · <red>" sigue aplicando la misma regla bajo el nombre

#### Scenario: El pill de estado baja a su propia línea si no entra junto al nombre

- **WHEN** el viewport es angosto y el ancho disponible no permite renderizar el nombre y el pill de estado en la misma línea
- **THEN** el pill SHALL bajar a su propia línea
- **AND** el pill conserva su ancho intrínseco (no se estira al ancho del slot)
- **AND** NO SHALL overlappear con la franja de acento ni con el monto principal

#### Scenario: Los stats del wallet card apilan bajo viewports angostos (web)

- **WHEN** el viewport web es `< sm` y los stats del `WalletCard` (resumen del mes · cierra · vence) no caben cómodamente en una sola línea horizontal
- **THEN** los stats se apilan verticalmente, uno por línea
- **AND** cada stat de monto respeta bimoneda (ARS primario / USD subordinado)
- **AND** los stats no de monto (fechas de cierre / vencimiento) mantienen su jerarquía de label + valor
- **AND** la regla NO aplica al `CreditCardItem` mobile actual, que no muestra stats triada y queda fuera de alcance de este change

#### Scenario: La barra de límite se omite cuando `credit_limit=null`

- **WHEN** una tarjeta tiene `credit_limit=null`
- **THEN** su wallet card no renderiza la barra de límite
- **AND** el resto de la card (franja, avatar, nombre, meta, pill, stats, footer) se renderiza normalmente

#### Scenario: Cross-platform — tap/click en la card navega a `/cards/[id]`

- **WHEN** el usuario hace click (web) o tap (mobile) sobre cualquier zona tappable del wallet card / carrusel item de una tarjeta con `id='abc-123'`
- **THEN** el router navega a `/cards/abc-123`
- **AND** NO navega a `/cards`, ni a `/cards/[id]/edit`, ni a cualquier otro destino
- **AND** la regla aplica idénticamente en `apps/web/app/(app)/cards/_components/wallet-card.tsx` y en `apps/mobile/components/cards/CreditCardItem.tsx`

#### Scenario: El wallet sigue como grilla en web y carrusel en mobile

- **WHEN** el usuario abre `/cards` con dos o más tarjetas activas
- **THEN** en web el wallet se renderiza como grilla (2 columnas en `md+`, 1 columna debajo)
- **AND** en mobile el wallet se renderiza como carrusel horizontal con snap, una card por viewport, peek de la siguiente
- **AND** NO SHALL cambiar el modo de presentación entre plataformas (web nunca usa carrusel, mobile nunca usa grilla)

#### Scenario: La sección "Archivadas" sigue siendo secundaria y colapsable

- **WHEN** el usuario tiene al menos una tarjeta archivada
- **THEN** la sección "Archivadas (N)" se renderiza debajo del wallet de activas, con la lista contraída por defecto
- **AND** en web la sección usa `<details>` nativo; en mobile usa `Pressable` + `useState`
- **AND** la sección NO SHALL subirse al mismo nivel visual que el wallet de activas

#### Scenario: La sección "Archivadas" se omite cuando no hay archivadas

- **WHEN** la query de tarjetas archivadas resuelve con cero filas
- **THEN** ni el header de sección "Archivadas (N)" ni el contenedor se renderizan, en web ni en mobile
- **AND** no queda un slot vacío ni un separador visual fantasma

#### Scenario: Las acciones tipo CTA usan el primitivo Button

- **WHEN** se renderiza la acción "+ Agregar tarjeta" del header (en web y mobile) o el CTA del estado vacío del wallet
- **THEN** ambos composan el primitivo `Button` (directamente o vía `asChild` con `<Link>` en web; el equivalente del toolkit mobile en mobile)
- **AND** no se aplican clases `bg-primary` / `bg-emerald` ni paddings ad-hoc inline sobre `<button>` / `<Link>` / `<Pressable>` desnudos
- **AND** el CTA "Agregar tarjeta" mobile permanece en disabled placeholder mientras `/cards/new` mobile no exista (per requirement existente)

#### Scenario: El rediseño NO agrega totales nuevos

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** los únicos totales agregados visibles son ARS primario y USD subordinado del hero "A pagar este mes", ya specificados en el requirement existente del listado
- **AND** NO existe un total al pie de la lista de próximos vencimientos
- **AND** NO existe un total al pie del wallet (e.g. "límite agregado", "deuda histórica acumulada")
- **AND** NO existe una card separada de totales por encima o por debajo del hero

#### Scenario: El rediseño NO agrega búsqueda, filtros ni ordenamiento

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** no aparece un input de búsqueda en el header ni en las secciones
- **AND** no aparecen toolbars de filtros, chips de filtros activos, ni controles de ordenamiento
- **AND** el orden de las cards del wallet permanece por fecha de cierre del período activo ascendente, con tarjetas sin ciclo configurado al final alfabéticas

#### Scenario: El rediseño NO agrega acciones de tarjeta nuevas

- **WHEN** se revisa una card del wallet
- **THEN** el único gesto que dispara acción es el click/tap sobre la card, que navega a `/cards/[id]`
- **AND** NO aparece un kebab por card, ni botones secundarios de share / duplicar / exportar / archivar / eliminar
- **AND** el link "Ver resumen" del footer sigue siendo un link al detalle, no un botón con acción propia

#### Scenario: El rediseño NO introduce datos ni queries nuevas

- **WHEN** se inspecciona la implementación de la ruta tras este change
- **THEN** las queries usadas son exclusivamente `getCreditCards()` (sin flags) en active, `getCreditCards({ archivedOnly: true })` en archived, `getCardsMonthSummary()` en el hero, y `getInstitutions()` + `getCardNetworks()` para el drawer de alta
- **AND** los tipos `CardListItem` y `CardsMonthSummary` NO incluyen campos nuevos respecto al estado pre-change
- **AND** NO se agregan server actions ni endpoints nuevos en `lib/cards/`

#### Scenario: Estados de carga y error usan los componentes existentes

- **WHEN** una de las secciones está cargando o falla
- **THEN** en web cada sección muestra su `<SectionFallback>` o su skeleton shape-matched (`CardsMonthHeroSkeleton`, `WalletSkeleton`, `ArchivedCardsSkeleton`) según el momento; en mobile cada react-query maneja su propio `isPending` / `isError` con `SectionFallback` del toolkit mobile
- **AND** un throw fuera de los `try/catch` de los containers web es capturado por `CardsErrorBoundary` y reemplaza el área del contenido por `<RouteError>`, sin tapar el header
- **AND** ningún estado de carga o error introduce datos, queries ni componentes nuevos

#### Scenario: Web y mobile se implementan en paralelo en este change

- **WHEN** se implementa el rediseño bajo este change
- **THEN** los componentes web en `apps/web/app/(app)/cards/_components/` y los componentes mobile en `apps/mobile/components/cards/` se actualizan en el mismo PR
- **AND** la paridad se mantiene en estructura (header → hero → sección "Mis tarjetas" → wallet → archivadas) y jerarquía visual (ARS primario, USD subordinado, pill de estado, franja de acento, footer de cuotas)
- **AND** NO se introduce un módulo compartido de JSX entre `apps/web` y `apps/mobile`
- **AND** la presentación del wallet sigue siendo grilla en web y carrusel en mobile, sin convergir
