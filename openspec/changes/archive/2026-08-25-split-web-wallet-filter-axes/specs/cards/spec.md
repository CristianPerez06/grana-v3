## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) como una **vista compacta agrupada por banco** (NO como wallet de cards grandes), conservando el hero unificado, con esta estructura de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resumen de <mes>"). Acción primaria "Agregar tarjeta" (primitivo `Button`). En ambas plataformas el CTA SHALL abrir el flujo de alta de tarjeta: en web navega a `/cards/new` (o abre el drawer de alta); en mobile navega a la ruta `/cards/new` nativa. El CTA NO SHALL renderizarse como placeholder permanentemente disabled. La carga de catálogos (instituciones / redes) puede gatear el submit/CTA mientras resuelve (web deshabilita el CTA; mobile defiere la carga a la ruta `/cards/new`, que muestra un loading state propio).
2. **Hero del mes (card navy, dos columnas)**: el hero SHALL renderizarse como una card oscura navy (mismo patrón de superficie que el hero del dashboard). A la **izquierda**, **dos cifras** mostradas juntas, cada una en **Bimoneda** (ARS primario y USD subordinado, **NUNCA sumados ni convertidos**):
   - **A pagar (ahora)** (`summary.toPayARS` / `toPayUSD`): la suma del total a pagar de **todas** las tarjetas activas que ya tienen un resumen **cerrado e impago** (deuda firme, vence ~este mes). Cuando la cifra es cero, el hero SHALL mostrar **`$ 0`** — NO un texto de empty-state.
   - **En curso** (`summary.inProgressARS` / `inProgressUSD`): la suma de los resúmenes **abiertos (aún no cerraron) con saldo > 0** de **todas** las tarjetas activas. Es el **acumulado real** de los consumos del ciclo abierto (no una proyección): un piso que sigue creciendo hasta el cierre. SHALL llevar el caption **"se sigue sumando hasta el cierre"**. Cuando es cero, SHALL mostrar `$ 0`.
   A la **derecha**, **"Próximos cierres"**: una lista de **una tarjeta por fila** (`fecha de cierre · nombre`, **sin monto** — el monto por tarjeta vive en el detalle de cada tarjeta del listado), ordenada por **fecha de cierre** (NO de vencimiento) ascendente y **capada en `NEXT_CLOSES_CAP` (6)** (`summary.nextCloses`). En viewports angostos las dos zonas se apilan.
3. **Controles de vista**: exponen el modo de vista (`Por banco` agrupado, default; o plano) y los predicados `Todas`, `En uso`, `Vencen pronto`, `Con saldo`. Los controles NO SHALL alterar la semántica contable, solo el agrupado, el orden y el subconjunto visible.

   **Dos ejes, un estado (vinculante, ambas plataformas).** El modo de vista y el predicado son ejes **independientes** y SHALL modelarse como dos piezas de estado separadas, no como opciones excluyentes de un mismo valor. `Por banco` decide cómo se muestra la lista; los cuatro predicados deciden qué tarjetas entran. En consecuencia: elegir un predicado NO SHALL sacar al usuario del modo agrupado como efecto colateral, y pasar por `Por banco` NO SHALL borrar el predicado elegido — la selección SHALL sobrevivir al ida y vuelta. Cuando el modo es `Por banco`, la vista agrupada muestra **todas** las tarjetas: el predicado queda vivo en el estado pero sin aplicar.

   **Fallback por conteo vacío (vinculante, ambas plataformas).** Cuando un refetch deja el predicado activo en 0 resultados, la vista SHALL caer a `Todas` en lugar de dejar al usuario en una lista vacía.

   **Conteos.** Los conteos por predicado SHALL derivarse de `countByFilter` de `@grana/cards`, construido sobre la misma `applyFilter` que arma la lista, de modo que un conteo no pueda divergir de lo que seleccionar ese filtro muestra. Ninguna superficie SHALL recontar por su cuenta.

   La **composición** de los controles se resuelve por **ancho disponible**, no por plataforma:
   - **Mobile nativo, y web bajo el breakpoint `md`**: **dos** controles separados, porque cinco opciones no entran legibles en el ancho de un teléfono. (a) un control segmentado de **dos** opciones — `Por banco` (default) y `Lista` (plano); (b) una fila de **chips de filtro** que SHALL renderizarse **solo en modo `Lista`**, con los cuatro predicados (`Todas` default, `En uso`, `Vencen pronto`, `Con saldo`), cada chip acompañado de **su conteo de resultados**. Un chip cuyo conteo es 0 SHALL renderizarse deshabilitado (no seleccionable). Los chips SHALL dimensionarse por contenido y desplazarse horizontalmente si no entran, NUNCA repartirse el ancho a la fuerza.
   - **Web en `md` y hacia arriba**: un único control segmentado de cinco opciones (`Por banco` / `Todas` / `En uso` / `Vencen pronto` / `Con saldo`) en una sola fila, donde el ancho alcanza para las cinco etiquetas. Ese control SHALL ser una **proyección del mismo estado**, no un estado propio: la opción activa es `Por banco` cuando el modo es agrupado, y el predicado vigente cuando es plano; seleccionar un predicado implica el modo plano. Una opción de predicado cuyo conteo es 0 SHALL renderizarse deshabilitada, igual que su chip equivalente.

   Como las dos composiciones proyectan el mismo estado, cruzar el breakpoint (rotar el dispositivo, redimensionar la ventana) SHALL conservar el modo y el predicado vigentes.
4. **Vista compacta de tarjetas activas**. El componente público SHALL llamarse `Wallet` en ambas plataformas (mismo nombre que el actual), con presentación compacta agrupada por banco:
   - **Grupos por banco desplegables (collapsible).** Cada grupo tiene un encabezado con: chevron de colapso, dot del color del banco, nombre del banco, "N tarjetas · M en uso", total a pagar del banco (si > 0) y un **badge de urgencia** con el próximo vencimiento del grupo (color heredado del peor estado del grupo: rojo > ámbar > neutro). Tap/click en el encabezado expande/colapsa el cuerpo. La **disposición** de ese contenido se resuelve por plataforma:
     - **Web**: una sola línea, con el nombre truncado y el resto de los elementos sin encogerse.
     - **Mobile**: **dos líneas** — línea 1 = dot + nombre del banco (una sola línea, truncado) + total a pagar alineado a la derecha; línea 2 = "N tarjetas · M en uso" + badge de urgencia alineado a la derecha. El chevron queda alineado al centro vertical de las dos líneas. El nombre del banco SHALL truncar antes que empujar el monto fuera del ancho visible.
     - **Badge en estado neutro**: en web el badge se renderiza siempre (mostrando "Al día" cuando el grupo no tiene urgencia); en **mobile** el badge SHALL renderizarse **solo cuando el grupo tiene urgencia** (peor tono ≠ neutro), porque el ancho es escaso y el estado "al día" ya se lee de la ausencia de deuda y del indicador por fila.
   - **Auto-colapso inicial.** Un grupo SHALL arrancar **colapsado solo si todas sus tarjetas están al día y en $0** (sin deuda, sin saldo en ninguna moneda, sin alert de vencimiento). Cualquier grupo con al menos una tarjeta vencida, por vencer, o con saldo > 0 SHALL arrancar **expandido**.
   - **2 filas por tarjeta.** Cada tarjeta se renderiza en dos filas: **fila 1** = monograma de red + nombre | monto del resumen vigente | indicador de estado; **fila 2** = tres etiquetas micro apiladas **Cierre**, **Vence** y **Uso** (label en mayúscula + valor debajo). El valor de Uso es el **porcentaje del resumen vigente** sobre el límite (o el texto **"Sin límite"** cuando no hay límite).
   - **Web**: filas dentro de los grupos desplegables (no una tabla rígida de una sola fila por tarjeta).
   - **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco, sin tabla horizontal.
5. **Sección "Archivadas"** colapsable debajo, cerrada por defecto, solo cuando existe ≥1 tarjeta archivada, con encabezado "Archivadas (N)" y enlace al detalle de cada una. Web usa `<details>` nativo; mobile usa `Pressable` + `useState`.

**Estado por fila (vinculante).** Cada fila SHALL exponer SIEMPRE un indicador de estado derivado de `pillTone(activePeriod.alert, activePeriod.variant)` (vencido / por vencer / al día). El indicador SHALL permanecer visible en cualquier orden o agrupado, de modo que una deuda no quede escondida; combinado con el badge de urgencia del encabezado y la regla de auto-colapso, un grupo con deuda nunca queda oculto sin señal. "Visible" es literal: los tres tonos SHALL pintarse con **tokens existentes del design system de la plataforma**. Una clase de color que el sistema de estilos no resuelve (p. ej. un color inexistente en `@grana/ui-tokens`) deja el indicador transparente y viola este requirement, aunque el elemento esté en el árbol.

**Bimoneda en el monto (vinculante).** La zona de monto del resumen SHALL respetar Bimoneda: si solo una moneda tiene saldo, ese monto; si ambas tienen saldo, ARS primario arriba y USD subordinado debajo, **nunca sumados ni convertidos**. Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`), no tokens crudos.

**"A pagar" vs "En curso" (vinculante).** Las dos cifras del hero son conceptos distintos y NO SHALL solaparse ni sumarse entre sí:
- **A pagar (ahora)** = resúmenes ya **cerrados e impagos** (`(end_date < hoy || due_date < hoy) && tx_count > 0 && !has_payment`). Es la deuda firme.
- **En curso** = el resumen **abierto** (no cerrado, sin pago) **con saldo > 0** de cada tarjeta activa. La cifra SHALL considerar el resumen abierto de **cada** tarjeta — incluidas las tarjetas que **además** tienen un resumen "a pagar", que tienen **dos resúmenes vivos** a la vez (el cerrado a pagar y el siguiente devengándose). Por lo tanto NO se deriva únicamente del `activePeriod` por tarjeta.

**Uso del resumen (vinculante).** El stat **Uso** de la fila 2 SHALL mostrar el porcentaje de uso del **resumen vigente**, calculado `min(100, round(pendingARS_del_resumen_vigente / credit_limit * 100))`, del resumen vigente, NO el cupo disponible. Cuando `credit_limit` es null, el stat Uso SHALL mostrar el texto **"Sin límite"**. Se renderiza como un stat apilado compacto junto a Cierre/Vence (no una barra ni pegado al monto de la derecha). Mismo tratamiento en web y mobile (paridad).

**Agrupación por banco (vinculante).** El agrupado usa el nombre de la institución (`institution.name`). Las tarjetas con `institution_id` null SHALL agruparse en un grupo fallback **"Sin banco"**, siempre último, nunca mezclado con otro banco.

**Conteo "en uso" (vinculante).** El contador "M en uso" del encabezado de grupo y el filtro `En uso` SHALL derivar del flag `inUse` por tarjeta (`activePeriod.tx_count > 0 || activeInstallmentsCount > 0`).

**Orden.** Los grupos se ordenan por su próximo vencimiento más urgente; dentro de cada grupo, las filas se ordenan por vencimiento ascendente. En modo "Todas" (plano), el orden SHALL ser por próximo vencimiento ascendente, con las tarjetas sin ciclo configurado al final.

La navegación de una fila (click web / tap mobile) SHALL ir a `/cards/[id]`. La vista incluye únicamente tarjetas activas (`is_active=true`).

#### Scenario: El hero muestra "A pagar ahora" y "En curso" en Bimoneda

- **WHEN** el usuario tiene una tarjeta con un resumen cerrado e impago de `$120.000` ARS, y dos tarjetas con resúmenes abiertos con saldo (`$80.000` ARS + `US$ 200` una, `$50.000` ARS la otra)
- **THEN** el hero, en una card navy, muestra **"A pagar"** = `$120.000` ARS
- **AND** muestra **"En curso"** = `$130.000` ARS primario y `US$ 200` USD subordinado, con el caption "se sigue sumando hasta el cierre"
- **AND** ninguna de las dos cifras suma ni convierte ARS y USD entre sí, ni suma "A pagar" con "En curso"

#### Scenario: Sin resúmenes cerrados, "A pagar" muestra $0 y "En curso" el acumulado del ciclo

- **WHEN** el usuario no tiene ningún resumen cerrado e impago, pero tiene resúmenes en curso con saldo por `$90.000` ARS
- **THEN** "A pagar" muestra **`$ 0`** (no un texto de empty-state)
- **AND** "En curso" muestra `$90.000` ARS

#### Scenario: "En curso" incluye el resumen abierto de una tarjeta que también tiene un "a pagar"

- **WHEN** una tarjeta tiene un resumen **cerrado e impago** de `$100.000` (cuenta en "A pagar") y, a la vez, su resumen **siguiente abierto** ya devengó `$30.000`
- **THEN** "A pagar" incluye los `$100.000` de esa tarjeta
- **AND** "En curso" incluye los `$30.000` del resumen abierto de esa misma tarjeta

#### Scenario: Próximos cierres lista una fila por tarjeta con período en curso, sin monto

- **WHEN** hay cuatro tarjetas con resúmenes en curso que cierran en distintas fechas
- **THEN** "Próximos cierres" muestra una fila por tarjeta (`fecha de cierre · nombre`, sin monto), ordenadas por fecha de cierre ascendente
- **AND** la lista incluye la tarjeta cuyo resumen "a pagar" está cerrado pero cuyo resumen siguiente sigue abierto (no se pierde su próximo cierre)
- **AND** la lista se capa en `NEXT_CLOSES_CAP` (6)

#### Scenario: El CTA "Agregar tarjeta" abre el flujo de alta nativo en mobile

- **WHEN** el usuario está en `/cards` mobile con las queries de catálogo ya cargadas y toca "Agregar tarjeta"
- **THEN** la app navega a la ruta de alta de tarjeta nativa (`/cards/new`)
- **AND** el CTA NO se renderiza como placeholder permanentemente disabled

#### Scenario: El encabezado de grupo se muestra en dos líneas (mobile)

- **WHEN** el usuario abre `/cards` en la app nativa y un grupo de banco tiene nombre largo ("Banco Patagonia"), 3 tarjetas, 2 en uso, `$284.500` a pagar y vencimiento el 25/06
- **THEN** la línea 1 del encabezado muestra el dot del banco, el nombre en una sola línea y el total a pagar alineado a la derecha
- **AND** la línea 2 muestra "3 tarjetas · 2 en uso" y el badge "vence 25/06" alineado a la derecha
- **AND** el nombre del banco se trunca si no entra, sin desplazar el total a pagar fuera del ancho visible ni cortar el badge

#### Scenario: El badge de urgencia no se renderiza en un grupo al día (mobile)

- **WHEN** un grupo de banco tiene todas sus tarjetas al día (peor tono neutro)
- **THEN** el encabezado del grupo en la app nativa NO renderiza badge de urgencia
- **AND** el mismo grupo en web SÍ renderiza el badge con el texto "Al día"

#### Scenario: El modo de vista y el filtro son controles separados

- **WHEN** el usuario abre `/cards` en la app nativa, o en web en un viewport de 390px
- **THEN** ve un control segmentado de dos opciones, `Por banco` (seleccionada por default) y `Lista`
- **AND** los chips de filtro NO se muestran mientras el modo es `Por banco`
- **WHEN** el usuario selecciona `Lista`
- **THEN** aparece la fila de chips `Todas` (seleccionado), `En uso`, `Vencen pronto` y `Con saldo`, cada uno con su conteo de resultados
- **AND** la lista se muestra plana, ordenada por próximo vencimiento ascendente
- **AND** ninguna etiqueta de chip se corta ni se aplasta: los chips se dimensionan por su contenido y la fila desplaza horizontalmente si no entran

#### Scenario: Un filtro sin resultados no es seleccionable

- **WHEN** el usuario está en modo `Lista` y ninguna tarjeta cumple el predicado `Con saldo`
- **THEN** el chip `Con saldo` muestra conteo 0 y se renderiza deshabilitado
- **AND** tocarlo no cambia el filtro aplicado
- **AND** en web `md+`, donde el mismo predicado se ofrece como segmento del control de cinco opciones, ese segmento también se renderiza deshabilitado

#### Scenario: La elección de filtro sobrevive al ida y vuelta al agrupado

- **WHEN** el usuario selecciona el filtro `En uso`, vuelve a `Por banco` y luego vuelve a `Lista`
- **THEN** el filtro aplicado sigue siendo `En uso`
- **AND** mientras estuvo en `Por banco` la vista mostró todos los grupos con todas sus tarjetas

#### Scenario: Un refetch que vacía el filtro activo cae a `Todas`

- **WHEN** el usuario tiene el predicado `Con saldo` seleccionado y un refetch deja ese predicado en 0 resultados
- **THEN** la vista pasa a `Todas` y muestra la lista completa
- **AND** el usuario no queda en una lista vacía

#### Scenario: En `md` y hacia arriba web conserva el segmentado de cinco opciones (web)

- **WHEN** el usuario abre `/cards` en web en un viewport ≥ 768px
- **THEN** ve un único control segmentado con `Por banco` (seleccionada por default), `Todas`, `En uso`, `Vencen pronto` y `Con saldo` en una sola fila
- **AND** NO se renderiza una fila de chips separada
- **WHEN** el usuario selecciona `Vencen pronto` y luego achica la ventana por debajo de `md`
- **THEN** el control de dos opciones aparece con `Lista` seleccionada y el chip `Vencen pronto` activo
- **AND** el subconjunto de tarjetas mostrado no cambió al cruzar el breakpoint

#### Scenario: El indicador del tono "por vencer" se pinta con un token existente (mobile)

- **WHEN** una tarjeta tiene su resumen próximo a vencer (tono ámbar) en la app nativa
- **THEN** el dot de estado de su fila y el badge de urgencia de su grupo se pintan con el token `warning` del design system
- **AND** ninguna de las dos superficies usa una clase de color que `@grana/ui-tokens` no define

### Requirement: El estilo visual de `/cards` (raíz) sigue el handoff `docs/design/cards/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/cards` (raíz, sin segmentos hijos) como la **vista compacta agrupada por banco** descripta en el requirement del listado, siguiendo el mockup de referencia `docs/mockups/cards-compact-final.png` como referencia **normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock.

**Hero navy.** El hero del mes se renderiza como una **card oscura navy** (mismo patrón de superficie que el hero del dashboard: `bg-surface-dark`/`bg-navy`, texto blanco): a la izquierda **dos cifras** en Bimoneda (ARS primario + USD subordinado por separado; si una moneda es 0, su línea USD MAY omitirse, pero la cifra ARS sigue mostrando `$ 0`):
- **A pagar (ahora)** — resúmenes cerrados e impagos.
- **En curso** — resúmenes abiertos con saldo; acumulado del ciclo, con caption "se sigue sumando hasta el cierre".
A la derecha, **"Próximos cierres"** — una tarjeta por fila (`fecha de cierre · nombre`, sin monto), ordenada por fecha de cierre y capada en `NEXT_CLOSES_CAP` (6). NO muestra otros KPIs separados.

**Reglas de presentación de la vista compacta.**

- **Web**: grupos por banco **desplegables** con encabezado (chevron, dot del banco, nombre, "N tarjetas · M en uso", total a pagar del banco, badge de urgencia). Default "Por banco". Los controles de vista se componen según el ancho: en `md+` un segmentado único de cinco opciones; bajo `md`, el segmentado `Por banco` / `Lista` más los chips de filtro con conteo visibles solo en `Lista`, según fija el requirement del listado. Auto-colapso de bancos 100% al día y en $0. Cada tarjeta en **2 filas** (identidad + resumen + estado; etiquetas apiladas Cierre/Vence/Uso, con Uso = % del resumen o "Sin límite"). NO SHALL renderizarse como wallet de cards grandes ni como carrusel.
- **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco y desplegable, sin tabla horizontal, con dot de estado por fila. NO SHALL renderizarse como carrusel de cards grandes. Los controles de vista son **dos** (segmented `Por banco` / `Lista` + chips de filtro con conteo, visibles solo en `Lista`) —la misma composición que web adopta bajo `md`— y el encabezado de grupo ocupa **dos líneas**, según fija el requirement del listado; el dot de estado y el badge de urgencia usan tokens existentes de `@grana/ui-tokens`.

**Datos habilitados (actualizado).** Además de los datos que ya devolvían `getCreditCards()` y `getCardsMonthSummary()`, este requirement HABILITA y REQUIERE:
- `institution.name` en el embed de `getCreditCards()`, expuesto en `CreditCardSummary`, para agrupar y labelar por banco.
- `inUse: boolean` en `CreditCardSummary`, derivado como `activePeriod.tx_count > 0 || activeInstallmentsCount > 0`, para el contador "M en uso" y el filtro `En uso`.
- Resolución de `networkNames` en mobile, para el monograma/red de cada fila.
- En `getCardsMonthSummary()`: la cifra **"En curso"** por moneda (`inProgressARS` / `inProgressUSD`), agregando el resumen abierto con saldo de cada tarjeta activa (incluido el resumen siguiente de una tarjeta que también tiene un "a pagar"), y el **monto** por fila de `nextCloses`. Esto SHALL resolverse sin introducir N+1 (extendiendo la data por-tarjeta que ya alimenta `getCreditCards()`).
No SHALL agregarse migraciones de base de datos (`institutions.name` ya existe); todo lo anterior es read-path y presentación. La lógica de agrupar/ordenar/auto-colapsar/agregar MAY vivir como helpers puros en `lib/cards/`.

**Bimoneda y montos.** Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`); ARS y USD nunca se suman ni convierten; no se ocultan negativos ni valores clamped.

**Uso del resumen honesto.** El stat Uso SHALL representar el uso del resumen vigente (no cupo disponible) y mostrar "Sin límite" cuando `credit_limit` es null.

**Acciones del header.** El botón "+ Agregar tarjeta" SHALL seguir usando el primitivo `Button`. El CTA mobile permanece disabled placeholder mientras `/cards/new` mobile no exista.

**Web y mobile son implementaciones nativas en paralelo.** La paridad se mantiene en estructura y jerarquía visual (hero unificado con sus dos cifras, grupos desplegables, 2 filas por tarjeta, estado por fila, bimoneda), NO en JSX compartido. JSX SHALL NO compartirse entre `apps/web` y `apps/mobile`; la lógica pura de agrupar/ordenar/derivar/auto-colapsar/agregar MAY compartirse a nivel de helpers en `lib/cards/`. La implementación mobile del hero de dos cifras MAY quedar como follow-up, manteniendo la paridad estructural cuando se haga.

**No-goals (actualizado, vinculantes).** El rediseño SHALL:
- Permitir filtros/orden, agrupación por banco y colapso de grupos como controles de vista (esto **deroga** el no-goal previo "NO agrega búsqueda, filtros ni ordenamiento" en lo que respecta a filtros/orden/agrupado/colapso; un input de búsqueda de texto libre SIGUE fuera de alcance).
- Permitir los campos y queries nuevos enumerados arriba (esto **deroga** el no-goal previo "NO introduce datos ni queries nuevas").
- Extender el hero con la cifra **"En curso"** y ampliar la lista de "Próximos cierres" (esto **deroga**, acotado a eso, el no-goal previo "NO rediseñar el hero ni agregar KPIs nuevos").

El rediseño NO SHALL:
- Sumar o convertir ARS y USD en un único número.
- Agregar al hero cifras/KPIs más allá de "A pagar (ahora)" y "En curso", ni rediseñar el resto del listado (wallet, grupos, filas).
- Agregar acciones de tarjeta nuevas: el único gesto sobre la fila sigue siendo navegar a `/cards/[id]` (sin kebab, share, duplicar, exportar). El tap sobre el encabezado de grupo solo colapsa/expande.
- Introducir, en v1, persistencia del estado de colapso entre sesiones, "uso de límite real" con cuotas futuras de todos los períodos, ni un rail lateral de bancos.

Cualquier propuesta que viole un no-goal vigente SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse.

#### Scenario: La ruta sigue el mockup de la vista compacta

- **WHEN** un desarrollador implementa el rediseño visual de `/cards`
- **THEN** la composición sigue la estructura del mockup `docs/mockups/cards-compact-final.png`: header con título + acción primaria, hero unificado (A pagar + En curso, ARS/USD; próximos cierres), controles de vista (en web `md+` el segmented único de cinco opciones; en mobile nativo y en web bajo `md` el segmented `Por banco` / `Lista` más los chips de filtro), vista compacta de grupos desplegables con filas de 2 líneas, y sección archivadas opcional al final
- **AND** los valores visuales se derivan de tokens y primitivos existentes, no de hex literales copiados del mock

#### Scenario: El hero navy muestra "A pagar" y "En curso", y próximos cierres con monto

- **WHEN** el usuario tiene `$200.000` ARS a pagar (cerrados-impagos), `US$ 200` en curso, y dos tarjetas que cierran `18/06`
- **THEN** el hero, en una card navy, muestra "A pagar" y "En curso" como dos cifras separadas, cada una con ARS primario y USD subordinado
- **AND** los valores NO se suman ni se convierten en un único número
- **AND** muestra "Próximos cierres" (una tarjeta por fila, `fecha · nombre`, sin monto, capada en 6), sin otros chips/KPIs separados

#### Scenario: La vista compacta reemplaza el wallet de cards

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** en web `/cards` se renderiza como grupos por banco desplegables con filas de 2 líneas (no como grilla ni carrusel de cards grandes)
- **AND** en mobile se renderiza como lista densa agrupada por banco (no como carrusel de cards grandes)

#### Scenario: Filtros, agrupación y colapso están permitidos; la búsqueda de texto no

- **WHEN** se revisa la ruta implementada
- **THEN** existen controles de orden/filtro (al menos el modo agrupado "Por banco" y el modo plano sin predicado) y los grupos de banco se pueden colapsar/expandir
- **AND** NO existe un input de búsqueda de texto libre en el header ni en las secciones

#### Scenario: Los campos y queries nuevos están habilitados

- **WHEN** se inspecciona la implementación tras este change
- **THEN** `getCreditCards()` embebe `institution.name` y `CreditCardSummary` expone el nombre del banco y `inUse`
- **AND** `getCardsMonthSummary()` expone la cifra "En curso" por moneda y el monto por fila de próximos cierres, sin N+1
- **AND** en mobile las filas resuelven `networkNames`
- **AND** NO se agregan migraciones de base de datos

#### Scenario: El rediseño NO agrega acciones de tarjeta nuevas

- **WHEN** se revisa una fila de la vista compacta
- **THEN** el único gesto que dispara acción sobre la fila es el click/tap, que navega a `/cards/[id]`
- **AND** el tap sobre el encabezado de grupo solo colapsa/expande, sin navegar
- **AND** NO aparece un kebab por fila, ni botones de share / duplicar / exportar

#### Scenario: Las acciones tipo CTA usan el primitivo Button

- **WHEN** se renderiza la acción "+ Agregar tarjeta" del header
- **THEN** composa el primitivo `Button`, sin clases `bg-primary` / `bg-emerald` ni paddings ad-hoc inline
- **AND** el CTA "Agregar tarjeta" mobile permanece disabled placeholder mientras `/cards/new` mobile no exista

#### Scenario: Web y mobile se implementan en paralelo

- **WHEN** se implementa el rediseño
- **THEN** los componentes web y mobile viven en árboles paralelos sin compartir JSX
- **AND** la paridad se mantiene en estructura (header → hero unificado → controles → grupos desplegables → archivadas) y jerarquía visual (estado por fila, agrupación por banco, ARS primario / USD subordinado)
- **AND** la lógica pura de agrupar/ordenar/derivar/auto-colapsar MAY compartirse a nivel de helpers en `lib/cards/`
