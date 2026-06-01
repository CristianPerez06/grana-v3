## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) con esta estructura, de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resúmenes de <mes>"). Acciones a la derecha: "Resúmenes anteriores" (ghost, solo web — opcional en mobile) y "Agregar tarjeta" (primario). En web el CTA navega a `/cards/new`. En mobile el CTA SHALL renderizarse en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista (no abre nada al press); cuando esa ruta aterrice, pasa a habilitado.
2. **Hero "A pagar este mes"**: agrega el total a pagar de **todas** las tarjetas activas (períodos sin pago `closed`/`overdue`). El monto ARS se muestra como primario en tipografía grande; el total USD se muestra **subordinado y por separado**, NUNCA sumado ni convertido (principio Bimoneda). El hero destaca el próximo vencimiento más cercano y lista los siguientes vencimientos.
   - **Layout web**: dos columnas (monto agregado a la izquierda + lista de próximos vencimientos a la derecha) en `md+`, una columna debajo.
   - **Layout mobile**: una sola columna; primero el monto agregado con el destacado del próximo vencimiento, luego la lista de próximos vencimientos como filas en el mismo container.
3. **Sección "Mis tarjetas"** + hint "Tocá una para ver el resumen".
4. **Wallet** de tarjetas activas. El componente público SHALL llamarse `Wallet` en ambas plataformas; cada implementación elige internamente la presentación:
   - **Web**: grilla — 2 columnas en `md+`, 1 columna debajo de `md`.
   - **Mobile**: carrusel horizontal con snap, que muestra una card por viewport y deja peek de la siguiente.

Cada **card del wallet** SHALL mostrar: una franja lateral con el acento de la tarjeta (`--cc-accent` derivado de `resolveAccountAvatar`, no hardcodeado por marca), avatar con la inicial del banco, nombre, meta "Crédito · <red>" (**sin número de tarjeta** — la app no lo almacena), un pill de estado (a pagar / cierra pronto / al día), stats (resumen del mes · cierra · vence), barra de límite teñida con el acento **solo si `credit_limit` está cargado**, y un footer con la cantidad de compras en cuotas activas ("N compras en cuotas" o "Sin cuotas activas") + link "Ver resumen". El click/tap en una card SHALL navegar a `/cards/[id]`.

El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado van al final, alfabéticas.

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

#### Scenario: Wallet en grilla con dos tarjetas activas (web)

- **WHEN** el usuario abre `/cards` en web con dos tarjetas activas
- **THEN** se renderiza una grilla de cards (no un carrusel horizontal), ordenadas por fecha de cierre ascendente
- **AND** cada card muestra franja de acento, avatar, nombre, meta sin número de tarjeta, pill de estado, stats, y footer de cuotas

#### Scenario: Wallet en carrusel con tres tarjetas activas (mobile)

- **WHEN** el usuario abre `/cards` en mobile con tres tarjetas activas
- **THEN** se renderiza un carrusel horizontal con snap, ordenado por fecha de cierre ascendente
- **AND** se ve una card por viewport y se asoma una porción ("peek") de la siguiente
- **AND** cada card muestra los mismos elementos visuales que en web (franja, avatar, nombre, pill, stats, barra de límite, footer)

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

### Requirement: El header de `/cards` se renderiza desde el primer paint y sus secciones cargan independientemente

El header de `/cards` SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del módulo. El cuerpo de la ruta — hero del mes, wallet de tarjetas activas, sección de archivadas — SHALL renderizarse como secciones aisladas, cada una con su propio fallback de carga y de error, de modo que un fallo en una sección no tire la ruta ni esconda el header. El mecanismo cambia según la plataforma:

**Web (`apps/web/app/(app)/cards/page.tsx`).** El header (título "Tarjetas", subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`, botón "Agregar tarjeta") SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- El **count** del subtítulo SHALL renderizarse como `"-"` (guion) mientras la query no resuelve. Cuando resuelve, SHALL pasar al número real de tarjetas activas. Si la query falla, SHALL permanecer en `"-"` indefinidamente para no bloquear la lectura del resto del header.
- El **mes** del subtítulo SHALL derivarse de `getTodayAR()` (idéntico criterio que el header del dashboard) y NO SHALL depender de ninguna query — está disponible desde el primer render.
- El botón "Agregar tarjeta" SHALL renderizarse en estado **disabled** mientras las queries de catálogos necesarias para abrir el drawer (`institutions`, `card_networks`) no resuelvan. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esas queries resuelven, SHALL pasar a habilitado. Si esas queries fallan, el botón SHALL permanecer disabled para no abrir un drawer sin data.

El cuerpo de la ruta web SHALL renderizarse como un scaffold de `<Suspense>` boundaries, cada uno con un fallback visualmente coherente (estilo `SectionFallback` ya usado en dashboard: borde dashed, mensaje de carga, min-height que aproxima el tamaño del contenido final). Cada sección SHALL fetchar su propia data en un container server async aislado:

- `CardsMonthHeroContainer` SHALL llamar `getCardsMonthSummary()`.
- `WalletContainer` SHALL llamar `getCreditCards` filtrando tarjetas activas únicamente.
- `ArchivedCardsContainer` SHALL llamar `getCreditCards` filtrando tarjetas archivadas únicamente.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`CardsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al try/catch de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header**, con un `onRetry` que resetea el state del boundary.

**Mobile (`apps/mobile/app/(app)/cards.tsx`).** El header SHALL ser un componente que envuelve el `PageHeader` custom del app mobile (nunca el header nativo del stack), con:

- Título "Tarjetas".
- Subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`. Mientras la query del count no resuelve (o si falla), el subtítulo SHALL mostrar `-` en el slot del número. El mes se deriva de `getTodayAR()` y NO depende de ninguna query.
- Acción derecha: CTA "Agregar tarjeta" en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista. SHALL renderizarse con su ícono y label, sin onPress activo. Cuando aterrice `/cards/new` mobile, pasará a habilitado vía actualización del propio componente.

El cuerpo mobile SHALL componerse de tres secciones independientes, cada una con su propia query react-query y su propio fallback de carga/error:

- `CardsMonthHero`: react-query con key `['cards', 'month-summary']` llamando `getCardsMonthSummary()`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando resumen del mes…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar el resumen del mes" />`.
- `Wallet`: react-query con key `['cards']` llamando `getCreditCards({ includeArchived: false })`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando tarjetas…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar las tarjetas" />`. Si la query resuelve con cero tarjetas activas, SHALL renderizar el estado vacío del wallet (mismo copy que web).
- `ArchivedCardsSection`: react-query con key `['cards', 'archived']` llamando `getCreditCards({ archivedOnly: true })`. Mientras `isPending`, NO SHALL ocupar espacio visible (la sección entera es opcional). Si `isError`, SHALL renderizar un `<SectionFallback>` discreto al final del scroll. Si resuelve con cero, NO SHALL renderizar nada.

Un error en una sección NO SHALL afectar el render de las otras ni del header. Mobile NO usa un error boundary global para esta ruta; el aislamiento se logra porque cada query react-query maneja su propio error sin throw al render parent.

Esta receta SHALL seguir el mismo patrón "in-page loading y error para mantener el chrome visible" descripto en el spec `route-loading-and-errors`; `/cards` es un consumidor de esa variante en web (junto con `/dashboard`) y la versión mobile lo implementa con el toolkit del app mobile.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/cards` y las queries del header (count, institutions, card_networks) todavía no resolvieron
- **THEN** el header ya está montado con el título "Tarjetas" y el subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` correspondientes a hero, wallet y archivadas

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

- **WHEN** un throw ocurre durante el render de la ruta fuera de los `try/catch` de los containers (por ejemplo, durante el render de un componente presentacional)
- **THEN** el `CardsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render

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
- **THEN** la sección "Archivadas" no renderiza un fallback ni ocupa espacio en el scroll
- **AND** el resto de las secciones se ven sin gap reservado
