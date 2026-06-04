## MODIFIED Requirements

### Requirement: El header de `/cards` se renderiza desde el primer paint y sus secciones cargan independientemente

El header de `/cards` SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del módulo. El cuerpo de la ruta — hero del mes, wallet de tarjetas activas, sección de archivadas — SHALL renderizarse como secciones aisladas, cada una con su propio fallback de carga y de error, de modo que un fallo en una sección no tire la ruta ni esconda el header. El mecanismo cambia según la plataforma:

**Web — estructura de archivos:**

- `apps/web/app/(app)/cards/layout.tsx` (server component, sync) SHALL montar `<CardsHeader />` y renderizar `{children}` debajo. El header persiste como chrome del segmento entre transiciones de `{children}` (loading, error, navegación a hijos como `/cards/[id]`).
- `apps/web/app/(app)/cards/loading.tsx` SHALL renderizar los skeletons shape-matched de las tres secciones (month hero skeleton + wallet skeleton + archived cards skeleton) en la misma disposición que el cuerpo de la ruta. Actúa como fallback del `{children}` del layout durante la transición de segmento.
- `apps/web/app/(app)/cards/page.tsx` SHALL renderizar el scaffold de `<Suspense>` envuelto por el Client Component error boundary (`CardsErrorBoundary`), SIN remontar el header. El page MAY seguir siendo async para `await getTranslations()` si las strings de los `<SectionFallback>` se resuelven server-side ahí, o MAY migrarlas a containers async dedicados para volverse sync; ambas opciones son válidas siempre que el header no se duplique.
- El page NO SHALL hacer `await supabase.auth.getUser()` ni `redirect('/login')`: el auth check ya lo cubre `(app)/layout.tsx`.

**Web — header (`<CardsHeader />`), comportamiento sin cambios:**

El header (título "Tarjetas", subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`, botón "Agregar tarjeta") SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- El **count** del subtítulo SHALL renderizarse como `"-"` (guion) mientras la query no resuelve. Cuando resuelve, SHALL pasar al número real de tarjetas activas. Si la query falla, SHALL permanecer en `"-"` indefinidamente para no bloquear la lectura del resto del header.
- El **mes** del subtítulo SHALL derivarse de `getTodayAR()` (idéntico criterio que el header del dashboard) y NO SHALL depender de ninguna query — está disponible desde el primer render.
- El botón "Agregar tarjeta" SHALL renderizarse en estado **disabled** mientras las queries de catálogos necesarias para abrir el drawer (`institutions`, `card_networks`) no resuelvan. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esas queries resuelven, SHALL pasar a habilitado. Si esas queries fallan, el botón SHALL permanecer disabled para no abrir un drawer sin data.

**Web — cuerpo (scaffold de Suspense):**

El cuerpo de la ruta web SHALL renderizarse como un scaffold de `<Suspense>` boundaries, cada uno con un fallback visualmente coherente (estilo `SectionFallback` ya usado en dashboard: borde dashed, mensaje de carga, min-height que aproxima el tamaño del contenido final). Cada sección SHALL fetchar su propia data en un container server async aislado:

- `CardsMonthHeroContainer` SHALL llamar `getCardsMonthSummary()`.
- `WalletContainer` SHALL llamar `getCreditCards` filtrando tarjetas activas únicamente.
- `ArchivedCardsContainer` SHALL llamar `getCreditCards` filtrando tarjetas archivadas únicamente.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`CardsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al try/catch de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header** (que vive en el layout y queda fuera del boundary), con un `onRetry` que resetea el state del boundary.

**Mobile (`apps/mobile/app/(app)/cards.tsx`).** Sin cambios respecto a la versión previa. El header SHALL ser un componente que envuelve el `PageHeader` custom del app mobile (nunca el header nativo del stack), con:

- Título "Tarjetas".
- Subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`. Mientras la query del count no resuelve (o si falla), el subtítulo SHALL mostrar `-` en el slot del número. El mes se deriva de `getTodayAR()` y NO depende de ninguna query.
- Acción derecha: CTA "Agregar tarjeta" en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista. SHALL renderizarse con su ícono y label, sin onPress activo. Cuando aterrice `/cards/new` mobile, pasará a habilitado vía actualización del propio componente.

El cuerpo mobile SHALL componerse de tres secciones independientes, cada una con su propia query react-query y su propio fallback de carga/error:

- `CardsMonthHero`: react-query con key `['cards', 'month-summary']` llamando `getCardsMonthSummary()`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando resumen del mes…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar el resumen del mes" />`.
- `Wallet`: react-query con key `['cards']` llamando `getCreditCards({ includeArchived: false })`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando tarjetas…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar las tarjetas" />`. Si la query resuelve con cero tarjetas activas, SHALL renderizar el estado vacío del wallet (mismo copy que web).
- `ArchivedCardsSection`: react-query con key `['cards', 'archived']` llamando `getCreditCards({ archivedOnly: true })`. Mientras `isPending`, NO SHALL ocupar espacio visible (la sección entera es opcional). Si `isError`, SHALL renderizar un `<SectionFallback>` discreto al final del scroll. Si resuelve con cero, NO SHALL renderizar nada.

Un error en una sección NO SHALL afectar el render de las otras ni del header. Mobile NO usa un error boundary global para esta ruta; el aislamiento se logra porque cada query react-query maneja su propio error sin throw al render parent.

Esta receta SHALL seguir el patrón "in-page loading y error para mantener el chrome visible" descripto en el spec `route-loading-and-errors`. La versión web es consumidor de **Variant C** (junto con `/dashboard`, `/transactions` y `/accounts`); la versión mobile lo implementa con el toolkit del app mobile.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/cards` y las queries del header (count, institutions, card_networks) todavía no resolvieron
- **THEN** el header ya está montado con el título "Tarjetas" y el subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` (durante el render del page) o los skeletons shape-matched (durante la transición de segmento, cuando `cards/loading.tsx` cubre el área del contenido)

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/dashboard` y navega a `/cards`
- **THEN** durante la transición del segmento, el `<CardsHeader />` aparece desde el primer paint del nuevo segmento (proviene de `cards/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `cards/loading.tsx` mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: Resolver las queries del header actualiza el count y habilita el botón (web)

- **WHEN** las queries del header resuelven con 3 tarjetas activas
- **THEN** el subtítulo del header pasa a `"3 tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" pasa a habilitado y abre el drawer al click

#### Scenario: Fallo de la query de catálogos deja el botón disabled (web)

- **WHEN** la query de `institutions` o `card_networks` falla
- **THEN** el botón "Agregar tarjeta" permanece disabled
- **AND** el resto del header (título, mes, count cuando resuelva) sigue visible y funcional

#### Scenario: Fallo del count deja el subtítulo en guion sin afectar el resto (web)

- **WHEN** la query del count de tarjetas activas falla
- **THEN** el subtítulo del header sigue mostrando `"- tarjetas de crédito · resúmenes de {mes}"` indefinidamente
- **AND** el botón "Agregar tarjeta" puede igual estar habilitado si las queries de catálogos resolvieron

#### Scenario: Cada sección muestra su propio fallback de carga mientras la otra ya cargó (web)

- **WHEN** el hero del mes ya resolvió pero la query del wallet aún no
- **THEN** el hero se muestra con su data
- **AND** el wallet sigue mostrando su `<SectionFallback>` con mensaje de carga
- **AND** la sección de archivadas muestra independientemente su propio estado (loading o ya resuelto)

#### Scenario: Un error en una sección no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCardsMonthSummary()` falla en web
- **THEN** el área del hero muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible y completamente funcional
- **AND** el wallet y las archivadas siguen renderizándose normalmente con su propia data
- **AND** el `error.tsx` del layout group `(app)` NO se monta

#### Scenario: Un throw fuera de los containers es capturado por el error boundary in-page (web)

- **WHEN** un throw ocurre durante el render del page (no del layout) fuera de los `try/catch` de los containers
- **THEN** el `CardsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta (que vive en el layout) sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render del page

#### Scenario: La sección de archivadas no se renderiza cuando el usuario no tiene archivadas (web)

- **WHEN** la query de tarjetas archivadas resuelve con cero filas
- **THEN** el `ArchivedCardsContainer` no renderiza ni el header ni el contenedor de la sección
- **AND** el `<SectionFallback>` de archivadas deja de mostrarse al resolver la query (no queda un slot vacío visible)

#### Scenario: El PageHeader mobile se ve antes de que resuelvan las queries del módulo

- **WHEN** un usuario mobile abre `/cards` y las queries de count, month-summary y cards todavía no resolvieron
- **THEN** el `PageHeader` ya está montado con título "Tarjetas" y subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el CTA "Agregar tarjeta" está visible en estado disabled
- **AND** cada una de las secciones del cuerpo muestra su propio `<SectionFallback>` de carga

#### Scenario: Resolver la query del count en mobile actualiza el subtítulo

- **WHEN** la query del count mobile resuelve con 3 tarjetas activas
- **THEN** el subtítulo del header pasa a `"3 tarjetas de crédito · resúmenes de {mes}"`
- **AND** el CTA "Agregar tarjeta" permanece en estado disabled (la ruta `/cards/new` mobile aún no existe en este change)

#### Scenario: Fallo del count en mobile deja el subtítulo en guion sin afectar el resto

- **WHEN** la query del count mobile falla
- **THEN** el subtítulo del header sigue mostrando `"- tarjetas de crédito · resúmenes de {mes}"` indefinidamente
- **AND** las otras secciones siguen renderizándose normalmente con su propia data

#### Scenario: Falla la query del hero del mes en mobile sin tirar la ruta

- **WHEN** la query `getCardsMonthSummary()` mobile falla
- **THEN** la sección del hero muestra `<SectionFallback>` con su mensaje de error
- **AND** el header permanece visible y completamente funcional
- **AND** el wallet y las archivadas siguen renderizándose normalmente con su propia data
- **AND** la pantalla `/cards` mobile no muestra una pantalla de error global

#### Scenario: Falla la query del wallet en mobile sin tirar la ruta

- **WHEN** la query `getCreditCards({ includeArchived: false })` mobile falla
- **THEN** la sección del wallet muestra `<SectionFallback>` con su mensaje de error
- **AND** el header, el hero del mes y la sección de archivadas siguen renderizándose normalmente

#### Scenario: La sección de archivadas mobile no se renderiza cuando el usuario no tiene archivadas

- **WHEN** la query mobile de tarjetas archivadas resuelve con cero filas
- **THEN** la sección "Archivadas" mobile no renderiza ni el encabezado ni el contenedor
- **AND** no queda un slot vacío ni un `<SectionFallback>` visible al final del scroll

#### Scenario: Cargando archivadas en mobile no ocupa espacio visible

- **WHEN** la query mobile de tarjetas archivadas todavía está `isPending`
- **THEN** la sección "Archivadas" mobile no renderiza un fallback ni ocupa espacio en el scroll
- **AND** el resto de las secciones se ven sin gap reservado
