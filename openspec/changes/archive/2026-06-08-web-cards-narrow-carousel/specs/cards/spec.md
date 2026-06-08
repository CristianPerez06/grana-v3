## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) con esta estructura, de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resúmenes de <mes>"). Acciones a la derecha: "Resúmenes anteriores" (ghost, solo web — opcional en mobile) y "Agregar tarjeta" (primario). En web el CTA navega a `/cards/new`. En mobile el CTA SHALL renderizarse en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista (no abre nada al press); cuando esa ruta aterrice, pasa a habilitado.
2. **Hero "A pagar este mes"**: agrega el total a pagar de **todas** las tarjetas activas (períodos sin pago `closed`/`overdue`). El monto ARS se muestra como primario en tipografía grande; el total USD se muestra **subordinado y por separado**, NUNCA sumado ni convertido (principio Bimoneda). El hero destaca el próximo vencimiento más cercano y lista los siguientes vencimientos.
   - **Layout web**: dos columnas (monto agregado a la izquierda + lista de próximos vencimientos a la derecha) en `md+`, una columna debajo.
   - **Layout mobile**: una sola columna; primero el monto agregado con el destacado del próximo vencimiento, luego la lista de próximos vencimientos como filas en el mismo container.
3. **Sección "Mis tarjetas"** + hint "Tocá una para ver el resumen".
4. **Wallet** de tarjetas activas. El componente público SHALL llamarse `Wallet` en ambas plataformas; cada implementación elige internamente la presentación:
   - **Web**:
     - En `md+` (768px o más): grilla de 2 columnas.
     - Debajo de `md`: **carrusel horizontal con snap y peek** de la siguiente card. Paridad visual y de gesto con el carrusel mobile, pero implementado con CSS (`overflow-x-auto` + `scroll-snap-type: x mandatory` + `scroll-snap-align: start` por card), NO con `FlatList`. El carrusel SHALL quedar **contenido dentro del padding del route shell** (sin offset negativo); el primer card empieza en el borde izquierdo del área de contenido y el carrusel termina en el borde derecho del área de contenido, con el peek de la siguiente card visible dentro de esa zona. Cada card debajo de `md` SHALL tener ancho fijo (intrínseco al tamaño del viewport, sin estirarse) y `shrink-0`. En `md+`, las cards retoman su sizing de cell de grilla (ancho automático, `shrink` por default).
   - **Mobile**: carrusel horizontal con snap, que muestra una card por viewport y deja peek de la siguiente. Implementación nativa RN.

Cada **card del wallet** SHALL mostrar: una franja lateral con el acento de la tarjeta (`--cc-accent` derivado de `resolveAccountAvatar`, no hardcodeado por marca), avatar con la inicial del banco, nombre, meta "Crédito · <red>" (**sin número de tarjeta** — la app no lo almacena), un pill de estado (a pagar / cierra pronto / al día), stats (resumen del mes · cierra · vence), barra de límite teñida con el acento **solo si `credit_limit` está cargado**, y un footer con la cantidad de compras en cuotas activas ("N compras en cuotas" o "Sin cuotas activas") + link "Ver resumen". El click/tap en una card SHALL navegar a `/cards/[id]`.

El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado van al final, alfabéticas. El orden SHALL ser el mismo en grilla (web `md+`), carrusel web (`< md`), y carrusel mobile.

El wallet SHALL incluir únicamente tarjetas activas (`is_active=true`). Las archivadas (`is_active=false`) NO aparecen en el wallet, pero el sistema SHALL exponerlas en una sección secundaria **"Archivadas"** debajo, colapsable (cerrada por defecto), con encabezado `Archivadas (N)`, solo cuando existe al menos una, listando cada una con enlace a su detalle (`/cards/[id]`) para que `[Reactivar]` sea alcanzable.
- **Web**: la sección colapsable usa `<details>` nativo (no requiere JS).
- **Mobile**: la sección colapsable usa un `Pressable` que togglea state local (`useState`); no hay `<details>` en React Native.

#### Scenario: Hero agrega el total a pagar con ARS y USD separados

- **WHEN** el usuario tiene dos tarjetas con resúmenes a pagar: una con `$120.000` ARS y otra con `$80.000` ARS + `US$ 200`
- **THEN** el hero "A pagar este mes" muestra `$200.000` como monto ARS primario
- **AND** muestra `US$ 200` como total USD subordinado y por separado
- **AND** en ningún caso suma ni convierte ARS y USD en un solo número

#### Scenario: Hero destaca el próximo vencimiento y lista los siguientes

- **WHEN** el usuario tiene tarjetas con vencimientos `10/06`, `18/06` y `25/06`
- **THEN** el hero destaca el vencimiento del `10/06`
- **AND** la lista "Próximos vencimientos" muestra las tres filas con día/mes, tarjeta y monto

#### Scenario: Wallet en grilla con dos tarjetas activas (web, md+)

- **WHEN** el usuario abre `/cards` en web con dos tarjetas activas en un viewport `≥ md` (768px)
- **THEN** se renderiza una grilla de cards de 2 columnas (no un carrusel), ordenadas por fecha de cierre ascendente
- **AND** cada card muestra franja de acento, avatar, nombre, meta sin número de tarjeta, pill de estado, stats, y footer de cuotas

#### Scenario: Wallet en carrusel horizontal con tres tarjetas activas (web, < md)

- **WHEN** el usuario abre `/cards` en web con tres tarjetas activas en un viewport `< md` (típicamente un teléfono o un tablet en portrait angosto)
- **THEN** se renderiza un carrusel horizontal con scroll-snap (no una grilla apilada en 1 columna), ordenado por fecha de cierre ascendente
- **AND** se ve una card ocupando la mayor parte del ancho útil del área de contenido y se asoma una porción ("peek") de la siguiente
- **AND** el carrusel queda **contenido dentro del padding del route shell** — el primer card empieza en el borde izquierdo del área de contenido y el contenedor del carrusel termina en el borde derecho del área de contenido. NO usa offset negativo para extenderse hasta los bordes del viewport
- **AND** el scroll horizontal hace snap (`scroll-snap-type: x mandatory` + `scroll-snap-align: start` por card); el dedo / trackpad arrastra una card por vez
- **AND** cada card muestra los mismos elementos visuales que en la grilla (franja, avatar, nombre, meta, pill, stats, barra de límite, footer)

#### Scenario: Wallet en carrusel con tres tarjetas activas (mobile)

- **WHEN** el usuario abre `/cards` en mobile con tres tarjetas activas
- **THEN** se renderiza un carrusel horizontal con snap, ordenado por fecha de cierre ascendente
- **AND** se ve una card por viewport y se asoma una porción ("peek") de la siguiente
- **AND** cada card muestra los mismos elementos visuales que en web (franja, avatar, nombre, pill, stats, barra de límite, footer)

#### Scenario: Resize de viewport cruzando `md` reordena entre carrusel y grilla en web

- **WHEN** el usuario tiene `/cards` abierto en web y cambia el tamaño del viewport cruzando el breakpoint `md` (por ejemplo, rota un tablet, redimensiona una ventana de browser, o desconecta un monitor externo)
- **THEN** debajo de `md` el wallet pasa a carrusel horizontal con snap y peek; en `≥ md` vuelve a grilla de 2 columnas
- **AND** el conjunto de cards visibles y su orden NO cambia, solo cambia el modo de presentación

#### Scenario: Card sin límite cargado omite la barra de límite

- **WHEN** una tarjeta tiene `credit_limit=null`
- **THEN** su card del wallet no renderiza la barra de límite

#### Scenario: Card muestra la cantidad de compras en cuotas activas

- **WHEN** una tarjeta tiene 2 compras en cuotas con cuotas pendientes y otra tarjeta no tiene ninguna
- **THEN** la primera card muestra "2 compras en cuotas" en el footer
- **AND** la segunda muestra "Sin cuotas activas"

#### Scenario: Tarjeta archivada aparece en la sección "Archivadas" y no en el wallet

- **WHEN** el usuario tiene una tarjeta activa y una archivada
- **THEN** el wallet muestra solo la activa
- **AND** debajo se renderiza la sección colapsable "Archivadas (1)" con enlace al detalle de la archivada

#### Scenario: Usuario sin tarjetas archivadas no ve la sección

- **WHEN** el usuario tiene solo tarjetas activas (o ninguna)
- **THEN** la sección "Archivadas" NO se renderiza

#### Scenario: Sección "Archivadas" colapsada por defecto en mobile

- **WHEN** el usuario abre `/cards` en mobile y tiene al menos una tarjeta archivada
- **THEN** la sección "Archivadas (N)" se renderiza con la lista contraída
- **AND** un tap en el encabezado expande la lista
- **AND** otro tap la vuelve a contraer

#### Scenario: CTA "Agregar tarjeta" disabled placeholder en mobile

- **WHEN** el usuario abre `/cards` en mobile y la ruta `/cards/new` mobile aún no existe
- **THEN** el header muestra el botón "Agregar tarjeta" visible pero en estado disabled
- **AND** un tap sobre el botón no abre ningún drawer, ruta ni hoja de creación

---

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

- **Header del `WalletCard` (web)** — estructura responsive:
  - **`< md`** (carrusel): el header SHALL renderizarse en **tres filas** dentro de la card: (1) fila de chrome con el avatar a la izquierda y el `CardStatusPill` a la derecha (espacio entre ambos, nada en el medio); (2) fila del **título** con el nombre de la tarjeta usando `line-clamp: 2` + `overflow-wrap: anywhere` (cap de 2 líneas con quiebre dentro de palabras si hace falta para no desbordar); (3) fila de **meta** con la copy "Crédito · <red>" usando `overflow-wrap: anywhere` (sin clamp). El título y la meta NO SHALL compartir línea horizontal con el avatar ni con el pill — toman todo el ancho útil de la card.
  - **`≥ md`** (grilla 2-col): el header retoma la composición horizontal de **una sola fila** — avatar a la izquierda, bloque {título + meta} en el medio (ancho flexible, con `min-w-0` para permitir wrap natural), pill a la derecha. Sin line-clamp; el título usa `break-words` por defecto.
  - La transición entre ambos modos SHALL implementarse con una **única estructura** (CSS grid responsive) sobre el mismo componente `WalletCard`, NO con DOM duplicado. Las clases responsive (`md:col-start-X md:row-start-1` etc.) reordenan los items entre filas/columnas según el breakpoint.
- **Nombre de la tarjeta** (regla general que el header detalla): bajo viewports angostos (`< md` web; default en mobile), el nombre SHALL acomodarse en hasta 2 líneas (line-clamp) en lugar de truncarse con elipsis. En web `≥ md`, el nombre SHALL renderizarse sin clamp, usando `break-words` para wrap natural en líneas.
- **Pill de estado**: tiene ancho intrínseco y SHALL NO competir por la misma línea que un nombre largo. En `< md` esto se garantiza con la fila de chrome dedicada (el pill SIEMPRE está en la fila 1, fila propia respecto al título). En `≥ md` el pill queda al extremo derecho de la fila horizontal con `shrink-0`.
- **Montos ARS / USD**: respetan bimoneda — ARS primario, USD subordinado, nunca sumados ni convertidos. Cuando la card muestra stats (la implementación web actual), bajo viewports angostos los stats SHALL apilarse verticalmente cuando el layout horizontal cómodo no entra. La implementación mobile actual no muestra stats triadas (resumen / cierra / vence); este requirement NO obliga a agregarlos.
- **Barra de límite (opcional)**: cuando `credit_limit` está cargado, ocupa todo el ancho útil de la card y muestra la copy de `% usado · disponible` ARS-only. Cuando `credit_limit === null`, la barra NO se renderiza (per requirement existente).

La paridad funcional completa del `CreditCardItem` mobile con el `WalletCard` web (meta `Crédito · <red>`, stats triada, footer de cuotas + "Ver resumen") queda **fuera de alcance** de este change. La rige el requirement existente y SHALL implementarse en un change futuro dedicado.

**Navegación de la card.** El click (web) y el tap (mobile) sobre cualquier zona tappable de la card SHALL navegar a `/cards/[id]` con el `id` de la tarjeta. Esto SHALL aplicar de forma idéntica en ambas plataformas; cualquier código que navegue a un destino distinto (e.g. `/cards`) está fuera de spec y SHALL corregirse. (El requirement existente "El listado de tarjetas se muestra como wallet con hero de pago mensual" ya lo exige; este requirement lo refuerza con un scenario cross-platform de regresión.)

**Reglas de presentación del wallet.**

- **Web**:
  - `md+`: grilla 2 columnas.
  - `< md`: **carrusel horizontal con snap y peek**, contenido dentro del padding del route shell (CSS `overflow-x-auto` + `scroll-snap-type: x mandatory` + `scroll-snap-align: start`). Paridad de gesto con mobile, NO implementación compartida.
  - NO SHALL renderizarse como lista vertical apilada en 1 columna bajo `< md`. La transición entre grilla (`md+`) y carrusel (`< md`) ocurre puramente vía CSS responsive sobre el mismo `Wallet` componente — NO se duplica JSX entre breakpoints.
- **Mobile**: carrusel horizontal con snap, una card por viewport, peek de la siguiente. NO grilla, NO paginación con bullets, NO tabs. Implementación nativa RN (FlatList o ScrollView horizontal), NO comparte JSX con web.

**Sección "Archivadas".** Permanece secundaria y colapsable, debajo del wallet, solo cuando existe ≥1 tarjeta archivada. Web usa `<details>` nativo; mobile usa `Pressable` + `useState` (NO `<details>`, que no existe en RN). El encabezado muestra "Archivadas (N)" y la lista está cerrada por defecto. Cada item lista nombre + enlace al detalle (`/cards/[id]`).

**Acciones del header.** El botón "+ Agregar tarjeta" del header (`AddCardButton` web; equivalente mobile) SHALL seguir usando el primitivo `Button`. NO SHALL re-tipearse `bg-primary` / `bg-emerald` ni paddings ad-hoc sobre `<button>` o `<Pressable>` desnudos. El CTA mobile permanece en disabled placeholder mientras `/cards/new` mobile no exista (per requirement existente del listado).

**Web y mobile son implementaciones nativas en paralelo.** El handoff incluye `docs/design/cards/web/cards.html` y `docs/design/cards/mobile/cards.html`. Este requirement aplica a ambas plataformas; cada cambio visual SHALL implementarse en su plataforma nativa. La paridad se mantiene en estructura y jerarquía visual, NO en JSX compartido. JSX SHALL NO compartirse entre `apps/web` y `apps/mobile`. El carrusel web (`< md`) y el carrusel mobile comparten **intención** (carrusel con snap + peek), pero NO comparten implementación: web usa CSS `scroll-snap`, mobile usa RN `FlatList` / `ScrollView` horizontal con `snapToInterval`.

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
- **THEN** la composición sigue la estructura del handoff: header con título + acción primaria, hero "A pagar este mes" con monto agregado + próximos vencimientos, sección "Mis tarjetas" con título compacto + hint subordinado, wallet (grilla en web `md+` / carrusel en web `< md` / carrusel en mobile), y sección archivadas opcional al final
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

#### Scenario: El header del wallet card en `< md` usa tres filas (chrome, título, meta)

- **WHEN** el viewport es web `< md` (carrusel) y el wallet card renderiza una tarjeta con nombre largo (e.g. "Visa Galicia principal de gastos familiares") y pill "A pagar"
- **THEN** el header se renderiza en tres filas verticales:
  1. Fila de chrome: avatar cuadrado a la izquierda, `CardStatusPill` a la derecha, espacio flexible entre ambos.
  2. Fila del título: nombre de la tarjeta, ocupando todo el ancho útil de la card, con `line-clamp: 2` y `overflow-wrap: anywhere` (cap de 2 líneas; quiebre dentro de palabras si hace falta).
  3. Fila de meta: copy "Crédito · <red>", ocupando todo el ancho útil, con `overflow-wrap: anywhere` y sin line-clamp.
- **AND** ni el título ni la meta comparten línea horizontal con el avatar ni con el pill
- **AND** el resto del cuerpo de la card (stats, barra de límite, footer) renderiza debajo del header sin solaparse

#### Scenario: El header del wallet card en `≥ md` usa una sola fila horizontal

- **WHEN** el viewport es web `≥ md` (grilla 2-col)
- **THEN** el header se renderiza en una sola fila horizontal: avatar a la izquierda, bloque {título + meta} en el medio con ancho flexible (`min-w-0`), pill a la derecha
- **AND** el título NO usa line-clamp en `md+` (se permite wrap natural a más de 2 líneas si la celda es muy angosta, aunque típicamente cabe en 1–2)
- **AND** la transición entre `< md` y `md+` SHALL ocurrir reactivamente vía CSS responsive sobre la misma estructura DOM — NO mediante DOM duplicado con `hidden` / `md:hidden`

#### Scenario: Nombre largo en `< md` se contiene a 2 líneas y no rompe el carrusel

- **WHEN** el viewport es `< md` y el nombre de la tarjeta excede dos líneas en el ancho disponible (e.g. una concatenación de palabras como "Visa Galicia Eminent World Black sueldo y gastos del hogar familia")
- **THEN** el texto se trunca después de la segunda línea con elipsis (efecto de `-webkit-line-clamp: 2`)
- **AND** el alto de la card permanece consistente entre cards del carrusel (el clamp impide que una card crezca arbitrariamente alta y rompa el alineamiento visual del carrusel)
- **AND** el subtítulo de meta NO usa clamp y MAY wrappear a más líneas si hace falta

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

#### Scenario: El wallet se adapta al breakpoint en web; mobile es siempre carrusel

- **WHEN** el usuario abre `/cards` con dos o más tarjetas activas
- **THEN** en web `md+` el wallet se renderiza como grilla de 2 columnas
- **AND** en web `< md` el wallet se renderiza como carrusel horizontal con snap, una card por viewport, peek de la siguiente al borde derecho del área de contenido, contenido dentro del padding del route shell (sin offset negativo)
- **AND** en mobile el wallet se renderiza como carrusel horizontal con snap, una card por viewport, peek de la siguiente
- **AND** la grilla web SHALL aparecer SOLO en `md+`; debajo de `md` NO SHALL aparecer una lista vertical 1-col apilada (esa es la presentación que este requirement obsoletiza)
- **AND** el carrusel web SHALL implementarse con CSS (`scroll-snap`) sobre el mismo componente `Wallet`, no con `FlatList` ni con un componente JSX duplicado

#### Scenario: Resize de viewport cruzando `md` reordena entre carrusel y grilla en web

- **WHEN** el usuario está en `/cards` web y el viewport cruza el breakpoint `md` (resize de ventana, rotación de tablet, conexión/desconexión de monitor externo)
- **THEN** el wallet alterna entre carrusel (`< md`) y grilla (`md+`) reactivamente, sin re-fetch ni re-mount del `Wallet`
- **AND** la posición de scroll del carrusel NO necesita preservarse entre breakpoints (al volver a `< md` el carrusel reinicia en la primera card)
- **AND** el conjunto de cards visibles y su orden NO cambia, solo cambia el modo de presentación

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

#### Scenario: Web y mobile se implementan en paralelo

- **WHEN** se implementa el rediseño bajo el requirement de visual handoff
- **THEN** los componentes web en `apps/web/app/(app)/cards/_components/` y los componentes mobile en `apps/mobile/components/cards/` viven en árboles paralelos
- **AND** la paridad se mantiene en estructura (header → hero → sección "Mis tarjetas" → wallet → archivadas) y jerarquía visual (ARS primario, USD subordinado, pill de estado, franja de acento, footer de cuotas)
- **AND** NO se introduce un módulo compartido de JSX entre `apps/web` y `apps/mobile`
- **AND** el carrusel web (`< md`) y el carrusel mobile comparten **intención** (snap + peek) pero implementan tecnologías nativas distintas (CSS scroll-snap en web; FlatList/ScrollView con snapToInterval en mobile)
