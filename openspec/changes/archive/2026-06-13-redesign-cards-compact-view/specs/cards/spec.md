## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) como una **vista compacta agrupada por banco** (NO como wallet de cards grandes), conservando el hero unificado, con esta estructura de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resumen de <mes>"). Acción primaria "Agregar tarjeta" (primitivo `Button`). En web el CTA navega a `/cards/new`; en mobile el CTA SHALL renderizarse en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista.
2. **Hero "A pagar este mes" (card navy, dos columnas)**: el hero SHALL renderizarse como una card oscura navy (mismo patrón de superficie que el hero del dashboard). A la izquierda, el total a pagar de **todas** las tarjetas activas con **ARS primario y USD subordinado y por separado, NUNCA sumados ni convertidos** (Bimoneda). A la derecha, **"Próximos cierres"**: una lista de **una tarjeta por fila** (`fecha de cierre · nombre`), ordenada por **fecha de cierre** (NO de vencimiento) ascendente y **capada en 3** (`summary.nextCloses`). En viewports angostos las dos zonas se apilan.
3. **Controles de vista**: una fila de filtros/orden con `Por banco` (default) y `Todas` (plano), más filtros opcionales `En uso`, `Vencen pronto`, `Con saldo`. Los controles NO SHALL alterar la semántica contable, solo el agrupado, el orden y el subconjunto visible.
4. **Vista compacta de tarjetas activas**. El componente público SHALL llamarse `Wallet` en ambas plataformas (mismo nombre que el actual), con presentación compacta agrupada por banco:
   - **Grupos por banco desplegables (collapsible).** Cada grupo tiene un encabezado con: chevron de colapso, dot del color del banco, nombre del banco, "N tarjetas · M en uso", total a pagar del banco (si > 0) y un **badge de urgencia** con el próximo vencimiento del grupo (color heredado del peor estado del grupo: rojo > ámbar > neutro). Tap/click en el encabezado expande/colapsa el cuerpo.
   - **Auto-colapso inicial.** Un grupo SHALL arrancar **colapsado solo si todas sus tarjetas están al día y en $0** (sin deuda, sin saldo en ninguna moneda, sin alert de vencimiento). Cualquier grupo con al menos una tarjeta vencida, por vencer, o con saldo > 0 SHALL arrancar **expandido**.
   - **2 filas por tarjeta.** Cada tarjeta se renderiza en dos filas: **fila 1** = monograma de red + nombre | monto del resumen vigente | indicador de estado; **fila 2** = tres etiquetas micro apiladas **Cierre**, **Vence** y **Uso** (label en mayúscula + valor debajo). El valor de Uso es el **porcentaje del resumen vigente** sobre el límite (o el texto **"Sin límite"** cuando no hay límite).
   - **Web**: filas dentro de los grupos desplegables (no una tabla rígida de una sola fila por tarjeta).
   - **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco, sin tabla horizontal.
5. **Sección "Archivadas"** colapsable debajo, cerrada por defecto, solo cuando existe ≥1 tarjeta archivada, con encabezado "Archivadas (N)" y enlace al detalle de cada una. Web usa `<details>` nativo; mobile usa `Pressable` + `useState`.

**Estado por fila (vinculante).** Cada fila SHALL exponer SIEMPRE un indicador de estado derivado de `pillTone(activePeriod.alert, activePeriod.variant)` (vencido / por vencer / al día). El indicador SHALL permanecer visible en cualquier orden o agrupado, de modo que una deuda no quede escondida; combinado con el badge de urgencia del encabezado y la regla de auto-colapso, un grupo con deuda nunca queda oculto sin señal.

**Bimoneda en el monto (vinculante).** La zona de monto del resumen SHALL respetar Bimoneda: si solo una moneda tiene saldo, ese monto; si ambas tienen saldo, ARS primario arriba y USD subordinado debajo, **nunca sumados ni convertidos**. Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`), no tokens crudos.

**Uso del resumen (vinculante).** El stat **Uso** de la fila 2 SHALL mostrar el porcentaje de uso del **resumen vigente**, calculado `min(100, round(pendingARS_del_resumen_vigente / credit_limit * 100))`, del resumen vigente, NO el cupo disponible. Cuando `credit_limit` es null, el stat Uso SHALL mostrar el texto **"Sin límite"**. Se renderiza como un stat apilado compacto junto a Cierre/Vence (no una barra ni pegado al monto de la derecha). Mismo tratamiento en web y mobile (paridad).

**Agrupación por banco (vinculante).** El agrupado usa el nombre de la institución (`institution.name`). Las tarjetas con `institution_id` null SHALL agruparse en un grupo fallback **"Sin banco"**, siempre último, nunca mezclado con otro banco.

**Conteo "en uso" (vinculante).** El contador "M en uso" del encabezado de grupo y el filtro `En uso` SHALL derivar del flag `inUse` por tarjeta (`activePeriod.tx_count > 0 || activeInstallmentsCount > 0`).

**Orden.** Los grupos se ordenan por su próximo vencimiento más urgente; dentro de cada grupo, las filas se ordenan por vencimiento ascendente. En modo "Todas" (plano), el orden SHALL ser por próximo vencimiento ascendente, con las tarjetas sin ciclo configurado al final.

La navegación de una fila (click web / tap mobile) SHALL ir a `/cards/[id]`. La vista incluye únicamente tarjetas activas (`is_active=true`).

#### Scenario: Hero navy agrega ARS y USD por separado con la lista de próximos cierres

- **WHEN** el usuario tiene dos tarjetas con resúmenes a pagar (una con `$120.000` ARS y otra con `$80.000` ARS + `US$ 200`) y dos tarjetas que cierran el mismo día `18/06`
- **THEN** el hero, en una card navy, muestra `$200.000` como ARS primario y `US$ 200` como USD subordinado y separado, sin sumarlos ni convertirlos
- **AND** muestra "Próximos cierres" como una fila por tarjeta (`18/06 · Mastercard ICBC`, `18/06 · Visa ICBC`, …), ordenada por fecha de cierre y capada en 3
- **AND** las fechas mostradas son de cierre (no de vencimiento) y el hero NO se renderiza como chips/KPIs separados

#### Scenario: Vista agrupada por banco con encabezado y total del grupo

- **WHEN** el usuario abre `/cards` con el default "Por banco" y tiene 2 tarjetas Santander (1 en uso, una vencida con `$92.150` a pagar)
- **THEN** se renderiza un grupo "Santander" con encabezado que muestra el nombre, "2 tarjetas · 1 en uso", el total a pagar `$92.150` y un badge de urgencia rojo "Vencido · 09/06"
- **AND** el cuerpo del grupo lista cada tarjeta en dos filas

#### Scenario: Grupo desplegable expande y colapsa

- **WHEN** el usuario toca el encabezado de un grupo de banco expandido
- **THEN** el cuerpo del grupo se colapsa y el chevron rota
- **AND** un segundo tap lo vuelve a expandir

#### Scenario: Auto-colapso solo de bancos al día y en $0

- **WHEN** el usuario abre `/cards` y tiene un banco con todas sus tarjetas al día y en $0, y otro banco con una tarjeta vencida
- **THEN** el banco 100% al día y en $0 arranca colapsado
- **AND** el banco con la tarjeta vencida arranca expandido

#### Scenario: Dos filas por tarjeta con stats Cierre/Vence/Uso

- **WHEN** una tarjeta con límite cargado tiene un resumen vigente que usa el 34% del límite
- **THEN** su fila 1 muestra monograma de red + nombre, el monto del resumen y el indicador de estado
- **AND** su fila 2 muestra las etiquetas apiladas Cierre (DD/MM), Vence (DD/MM) y Uso (34%)

#### Scenario: Estado por fila siempre visible

- **WHEN** una tarjeta tiene un resumen cerrado y vencido sin pagar
- **THEN** su fila muestra el indicador de estado "Vencido"
- **AND** una tarjeta con resumen abierto sin deuda muestra "Al día"

#### Scenario: Bimoneda apilada en el monto del resumen

- **WHEN** una tarjeta tiene `$128.400` ARS y `US$ 340` pendientes en el resumen vigente
- **THEN** la zona de monto muestra `$128.400` arriba y `US$ 340` debajo, subordinado
- **AND** los dos montos NO se suman ni se convierten en un único número

#### Scenario: Sin límite muestra el texto en el stat Uso

- **WHEN** una tarjeta tiene `credit_limit=null`
- **THEN** el stat Uso de su fila 2 muestra el texto "Sin límite"
- **AND** una tarjeta con `credit_limit` cargado muestra el porcentaje de uso del resumen vigente sobre el límite

#### Scenario: Grupo "Sin banco" para tarjetas sin institución

- **WHEN** el usuario tiene una tarjeta con `institution_id=null` y otras con banco asignado, en modo "Por banco"
- **THEN** la tarjeta sin institución aparece bajo un grupo "Sin banco"
- **AND** ese grupo se renderiza último, después de todos los bancos con nombre

#### Scenario: Fila mobile de dos líneas

- **WHEN** el usuario abre `/cards` en mobile con tarjetas agrupadas por banco
- **THEN** cada tarjeta se renderiza en dos líneas: identidad + monto + dot de estado arriba, y etiquetas apiladas Cierre/Vence/Uso abajo
- **AND** la lista no usa tabla horizontal

#### Scenario: Tarjeta archivada aparece en la sección "Archivadas" y no en la vista activa

- **WHEN** el usuario tiene una tarjeta activa y una archivada
- **THEN** la vista compacta muestra solo la activa
- **AND** debajo se renderiza la sección colapsable "Archivadas (1)" con enlace al detalle de la archivada

#### Scenario: Navegación de fila al detalle

- **WHEN** el usuario hace click (web) o tap (mobile) sobre la fila de una tarjeta con `id='abc-123'`
- **THEN** el router navega a `/cards/abc-123`

---

### Requirement: El estilo visual de `/cards` (raíz) sigue el handoff `docs/design/cards/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/cards` (raíz, sin segmentos hijos) como la **vista compacta agrupada por banco** descripta en el requirement del listado, siguiendo el mockup de referencia `docs/mockups/cards-compact-final.png` como referencia **normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock.

**Hero navy.** El hero "A pagar este mes" se renderiza como una **card oscura navy** (mismo patrón de superficie que el hero del dashboard: `bg-surface-dark`/`bg-navy`, texto blanco): a la izquierda ARS primario + USD subordinado por separado (si la deuda USD es 0, la línea USD MAY omitirse; si la ARS es 0, sigue mostrando `$ 0`); a la derecha **"Próximos cierres"** — una tarjeta por fila (`fecha de cierre · nombre`), ordenada por fecha de cierre y capada en 3. NO muestra KPIs separados.

**Reglas de presentación de la vista compacta.**

- **Web**: grupos por banco **desplegables** con encabezado (chevron, dot del banco, nombre, "N tarjetas · M en uso", total a pagar del banco, badge de urgencia). Default "Por banco"; toggle "Todas" (plano). Auto-colapso de bancos 100% al día y en $0. Cada tarjeta en **2 filas** (identidad + resumen + estado; etiquetas apiladas Cierre/Vence/Uso, con Uso = % del resumen o "Sin límite"). NO SHALL renderizarse como wallet de cards grandes ni como carrusel.
- **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco y desplegable, sin tabla horizontal, con dot de estado por fila. NO SHALL renderizarse como carrusel de cards grandes.

**Datos habilitados (actualizado).** Además de los datos que ya devolvían `getCreditCards()` y `getCardsMonthSummary()`, este requirement HABILITA y REQUIERE:
- `institution.name` en el embed de `getCreditCards()`, expuesto en `CreditCardSummary`, para agrupar y labelar por banco.
- `inUse: boolean` en `CreditCardSummary`, derivado como `activePeriod.tx_count > 0 || activeInstallmentsCount > 0`, para el contador "M en uso" y el filtro `En uso`.
- Resolución de `networkNames` en mobile, para el monograma/red de cada fila.
No SHALL agregarse migraciones de base de datos (`institutions.name` ya existe); todo lo anterior es read-path y presentación. La lógica de agrupar/ordenar/auto-colapsar MAY vivir como helpers puros en `lib/cards/`.

**Bimoneda y montos.** Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`); ARS y USD nunca se suman ni convierten; no se ocultan negativos ni valores clamped.

**Uso del resumen honesto.** El stat Uso SHALL representar el uso del resumen vigente (no cupo disponible) y mostrar "Sin límite" cuando `credit_limit` es null.

**Acciones del header.** El botón "+ Agregar tarjeta" SHALL seguir usando el primitivo `Button`. El CTA mobile permanece disabled placeholder mientras `/cards/new` mobile no exista.

**Web y mobile son implementaciones nativas en paralelo.** La paridad se mantiene en estructura y jerarquía visual (hero unificado, grupos desplegables, 2 filas por tarjeta, estado por fila, bimoneda), NO en JSX compartido. JSX SHALL NO compartirse entre `apps/web` y `apps/mobile`; la lógica pura de agrupar/ordenar/derivar/auto-colapsar MAY compartirse a nivel de helpers en `lib/cards/`.

**No-goals (actualizado, vinculantes).** El rediseño SHALL:
- Permitir filtros/orden, agrupación por banco y colapso de grupos como controles de vista (esto **deroga** el no-goal previo "NO agrega búsqueda, filtros ni ordenamiento" en lo que respecta a filtros/orden/agrupado/colapso; un input de búsqueda de texto libre SIGUE fuera de alcance).
- Permitir los campos y queries nuevos enumerados arriba (esto **deroga** el no-goal previo "NO introduce datos ni queries nuevas").

El rediseño NO SHALL:
- Sumar o convertir ARS y USD en un único número.
- Rediseñar el hero ni agregar KPIs nuevos.
- Agregar acciones de tarjeta nuevas: el único gesto sobre la fila sigue siendo navegar a `/cards/[id]` (sin kebab, share, duplicar, exportar). El tap sobre el encabezado de grupo solo colapsa/expande.
- Introducir, en v1, persistencia del estado de colapso entre sesiones, "uso de límite real" con cuotas futuras de todos los períodos, ni un rail lateral de bancos.

Cualquier propuesta que viole un no-goal vigente SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse.

#### Scenario: La ruta sigue el mockup de la vista compacta

- **WHEN** un desarrollador implementa el rediseño visual de `/cards`
- **THEN** la composición sigue la estructura del mockup `docs/mockups/cards-compact-final.png`: header con título + acción primaria, hero unificado (A pagar ARS/USD + próximos vencimientos), controles de vista (Por banco / Todas), vista compacta de grupos desplegables con filas de 2 líneas, y sección archivadas opcional al final
- **AND** los valores visuales se derivan de tokens y primitivos existentes, no de hex literales copiados del mock

#### Scenario: El hero navy muestra ARS primaria, USD subordinada y próximos cierres por fecha

- **WHEN** el usuario tiene deuda agregada `$200.000` ARS y `US$ 200` a pagar este mes
- **THEN** el hero, en una card navy, muestra `$200.000` como ARS primario y `US$ 200` como USD subordinado y separado
- **AND** los valores NO se suman ni se convierten en un único número
- **AND** muestra "Próximos cierres" (una tarjeta por fila, `fecha · nombre`, capada en 3), sin chips/KPIs separados

#### Scenario: La vista compacta reemplaza el wallet de cards

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** en web `/cards` se renderiza como grupos por banco desplegables con filas de 2 líneas (no como grilla ni carrusel de cards grandes)
- **AND** en mobile se renderiza como lista densa agrupada por banco (no como carrusel de cards grandes)

#### Scenario: Filtros, agrupación y colapso están permitidos; la búsqueda de texto no

- **WHEN** se revisa la ruta implementada
- **THEN** existen controles de orden/filtro (al menos "Por banco" y "Todas") y los grupos de banco se pueden colapsar/expandir
- **AND** NO existe un input de búsqueda de texto libre en el header ni en las secciones

#### Scenario: Los campos y queries nuevos están habilitados

- **WHEN** se inspecciona la implementación tras este change
- **THEN** `getCreditCards()` embebe `institution.name` y `CreditCardSummary` expone el nombre del banco y `inUse`
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
