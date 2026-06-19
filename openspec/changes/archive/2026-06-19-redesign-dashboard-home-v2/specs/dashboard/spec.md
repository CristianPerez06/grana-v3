## MODIFIED Requirements

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En viewports `lg` (≥1024px) y mayores, la pantalla `/dashboard` web SHALL organizar sus secciones así: una **fila superior** de dos columnas (grid asimétrico ~`1.15fr 1fr`, alturas igualadas con `align-items: stretch`) con el Hero "Para gastar · hoy" a la izquierda y la card "Dónde está" a la derecha; debajo, una **segunda fila** de dos columnas (mismo patrón de grid) con "Balance del mes" a la izquierda y "Comprometido" a la derecha; debajo, en orden y a ancho completo: la tira "Compartido" (solo si hay actividad compartida), la sección "Gastaste este mes" (solo si hubo consumo de tarjeta en el mes), y "¿En qué gasté este mes?". El contenido SHALL estar centrado con un max-width acotado (~1080px efectivos).

Por debajo de `lg`, el dashboard SHALL apilar todas las cards en una sola columna en el mismo orden (Para gastar → Dónde está → Balance del mes → Comprometido → Compartido → Gastaste este mes → ¿En qué gasté?). En "¿En qué gasté?", la dona y la leyenda SHALL apilarse en una columna centrada en viewports angostos.

#### Scenario: Desktop ancho muestra las dos filas en dos columnas

- **WHEN** un usuario carga `/dashboard` en un viewport de 1440px
- **THEN** "Para gastar · hoy" y "Dónde está" se muestran lado a lado con la misma altura
- **AND** "Balance del mes" y "Comprometido" se muestran lado a lado debajo con la misma altura
- **AND** las secciones full-width ("Compartido" si aplica, "Gastaste este mes" si aplica, "¿En qué gasté?") ocupan el ancho completo debajo, en ese orden

#### Scenario: Bajo lg el dashboard apila en una columna

- **WHEN** un usuario carga `/dashboard` en un viewport de 820px o de 375px
- **THEN** las cards se apilan en una sola columna en el orden: Para gastar → Dónde está → Balance del mes → Comprometido → Compartido → Gastaste este mes → ¿En qué gasté?

#### Scenario: La dona se centra en mobile

- **WHEN** un usuario carga `/dashboard` en un viewport de 375px
- **THEN** "¿En qué gasté?" muestra la dona centrada con la leyenda ocupando el ancho debajo

---

### Requirement: La card "Dónde está" desglosa las cuentas del usuario

Junto al Hero "Para gastar · hoy", el dashboard SHALL renderizar una card "Dónde está" que desglosa dónde vive el disponible (a la derecha del Hero en desktop web; apilada debajo en mobile-web y en la app nativa). Los datos SHALL salir de la misma data de `getDashboardHero` que alimenta el Hero — en web vía un único container async para la fila superior; en nativo ambas cards consumen `useDashboardHero()` y TanStack dedupea por queryKey (un solo fetch). La card SHALL considerar las cuentas activas `type IN ('cash','bank')` ordenadas por saldo ARS descendente (el orden que ya devuelve `getDashboardHero`), truncadas a un máximo de 6; el resto se ve en el módulo Cuentas. El header de la card SHALL incluir un link "Ver todas" → módulo Cuentas (web: `/accounts`; nativo: `router.push('/accounts')`). Todos los importes de la card participan del eye-mask.

**Presentación (web):** la card SHALL comunicar la **concentración** del saldo de un vistazo, sin lista larga:

- Un **callout de concentración**: el porcentaje de la cuenta de mayor saldo ARS sobre el total ARS (`pct = cuenta_dominante.ars / Σ cuentas.ars`, redondeado a entero) en tipografía grande, junto al nombre y saldo de esa cuenta. El porcentaje SHALL derivarse de los datos, NO hardcodearse. Con `Σ = 0` (sin saldo ARS), el callout NO SHALL mostrarse.
- Una **barra de concentración** horizontal compuesta por un segmento por cuenta, cuyo ancho SHALL ser proporcional al saldo ARS de la cuenta sobre el total (`cuenta.ars / Σ`), nunca hardcodeado. Cada segmento usa el color de identidad de su cuenta (sin hex inline). Los segmentos sub-pixel PUEDEN recibir un ancho mínimo visible sin alterar el cálculo del dato.
- Una **grilla compacta** (2 columnas) con las cuentas restantes (cada celda: cuadradito de color + nombre + saldo ARS) y, como celda/fila final destacada en emerald, la tenencia "En dólares" con el total USD del usuario (el mismo `usd` del Hero), que representa el stock total en USD y NO un desglose por cuenta. Un saldo ARS de cero SHALL pintarse atenuado.

**Presentación (mobile):** la card SHALL listar las cuentas (cada fila con `AccountAvatar` chico + nombre + saldo ARS alineado a la derecha; saldo cero atenuado) con la fila final "En dólares" en emerald. La barra de concentración y el callout son web-only por ahora (paridad nativa diferida).

#### Scenario: Concentración calculada de los datos (web)

- **WHEN** el usuario tiene Cta remunerada $9.575.790,25, CA $146.939,17, Billetera $108.200, Personal Pay $53.082,99 y un total USD de u$s 600 (web)
- **THEN** el callout muestra `97%` con "Cta remunerada · $9.575.790,25"
- **AND** la barra de concentración muestra un segmento por cuenta con ancho proporcional a su saldo ARS sobre el total
- **AND** la grilla compacta lista las cuentas restantes y la fila "En dólares" muestra u$s 600 en emerald

#### Scenario: Una sola cuenta concentra el 100% (web)

- **WHEN** el usuario tiene una única cuenta con saldo ARS y total USD cero (web)
- **THEN** el callout muestra `100%` con esa cuenta
- **AND** la barra de concentración muestra un único segmento a ancho completo

#### Scenario: Sin saldo ARS no se muestra el callout (web)

- **WHEN** todas las cuentas del usuario tienen saldo ARS cero (web)
- **THEN** el callout de concentración NO se renderiza
- **AND** la card sigue mostrando las cuentas (atenuadas) y la fila "En dólares"

#### Scenario: Cuentas ordenadas con la tenencia USD al final (mobile)

- **WHEN** el usuario tiene Billetera $1.254.499, Galicia $1.200.000, Cooperativa $0 y un total USD de u$s 1.240 (mobile)
- **THEN** la card lista Billetera, Galicia y Cooperativa en ese orden con sus saldos ARS
- **AND** el saldo $0 de Cooperativa se pinta atenuado
- **AND** la fila final "En dólares" muestra u$s 1.240 en emerald

#### Scenario: Más de 6 cuentas se truncan

- **WHEN** el usuario tiene 9 cuentas cash/bank activas
- **THEN** la card considera las 6 de mayor saldo ARS + la fila "En dólares"
- **AND** el link "Ver todas" navega al módulo Cuentas donde está el listado completo

#### Scenario: Una sola llamada alimenta la fila superior (web)

- **WHEN** se inspecciona el container de la fila superior del dashboard web
- **THEN** un único container async llama a `getDashboardHero` y renderiza ambas cards (Hero + "Dónde está") con esa data
- **AND** NO hay una segunda llamada a `getDashboardHero` para la card de cuentas

---

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

El dashboard (web) SHALL renderizar una card **"Comprometido"** (lente COMPROMISO) que responde "¿qué debo / qué se viene?", con el subtítulo "Lo que ya sabemos del próximo mes". Se ubica **a la derecha de "Balance del mes"** en una fila de dos columnas (mismo patrón de grid que la fila del Hero "Para gastar · hoy" + "Dónde está"); en mobile las dos cards se apilan. A diferencia de "Balance del mes" y "¿En qué gasté este mes?", esta card SHALL ser **estática "desde hoy"**: NO SHALL responder al navegador de mes (la deuda es un stock del presente y las recurrencias se proyectan al mes próximo). Aplica por ahora solo en web (mobile diferido).

La card SHALL presentar, **por moneda y sin combinar ARS con USD** (bimoneda por defecto):

- Un **total comprometido** como titular = lo que SALE = `resúmenesTarjeta + gastosRecurrentes`. El total NO SHALL incluir los ingresos recurrentes (un ingreso no es un compromiso).
- **Dos mini-tiles de egreso** (sin gráfico): una "Resúmenes tarjeta" y otra "Gastos recurrentes" (rotulada como del mes próximo), cada una con ícono + label + monto. NO SHALL usar el patrón `FlowRow` de barras para estos egresos.
  - **"Resúmenes tarjeta"** = la suma de los cargos pendientes de TODOS los resúmenes impagos de las tarjetas del usuario: consumos `pending` menos los reintegros recibidos imputados a esos resúmenes, abarcando el resumen **en curso** (open) y los **cerrados/vencidos** sin pagar. NO SHALL proyectarse una línea aparte de "cuotas futuras".
  - **"Gastos recurrentes"** = la proyección de las reglas de recurrencia activas tipo `expense` cuyas ocurrencias caen en el **mes calendario siguiente** a hoy, sumando el monto de cada ocurrencia por moneda.
- **Estado con ingreso recurrente** (cuando la proyección de reglas tipo `income` del mes próximo es > 0 en la moneda): la card SHALL agregar un sub-label "YA SALE" sobre las tiles de egreso, una **tile "Ya entra"** a ancho completo, destacada en emerald, con el label del ingreso recurrente y su monto en positivo; y una **banda de cierre neto** con `neto = ingresosRecurrentes − totalComprometido`. Si `neto ≥ 0`, la banda comunica en tono positivo que el próximo mes "arrancás con **+neto** a favor"; si `neto < 0`, la banda comunica el déficit en tono expense sin ocultarlo. El ingreso recurrente SHALL seguir mostrándose como contexto y NO SHALL sumarse al total comprometido; el cierre neto es un cálculo presentacional aparte. Las recurrencias tipo `transfer` NO SHALL contabilizarse.
- Si NO hay ingreso recurrente en la moneda (proyección `income` = 0), la card NO SHALL mostrar el sub-label "YA SALE", ni la tile "Ya entra", ni la banda de cierre neto.

Todos los importes SHALL participar del eye-mask. La proyección de recurrencias SHALL reusar `projectUpcomingOccurrences` de `@grana/money-logic`; la deuda de tarjeta SHALL reusar la lógica de pendientes por resumen ya existente, sin duplicar la matemática del neto. El cierre neto SHALL derivarse de los datos, sin hardcodear.

La card SHALL tolerar datos parciales: si la query falla, SHALL mostrar un error compacto sin romper el resto del dashboard. Su estado de carga SHALL renderizarse como skeleton shape-matched (chrome/título visibles).

#### Scenario: La card muestra el total y los egresos como dos tiles, sin ingreso recurrente

- **WHEN** el usuario tiene resúmenes de tarjeta impagos por ARS $712.182 y gastos recurrentes proyectados al mes próximo por ARS $106.966, sin ingresos recurrentes
- **THEN** la card muestra el total comprometido `$819.148` (= resúmenes + gastos recurrentes)
- **AND** muestra dos mini-tiles: "Resúmenes tarjeta" en `$712.182` y "Gastos recurrentes" en `$106.966`
- **AND** NO muestra el sub-label "YA SALE", ni la tile "Ya entra", ni la banda de cierre neto

#### Scenario: Con ingreso recurrente aparece la tile "Ya entra" y el cierre neto

- **WHEN** además de un total comprometido de ARS $819.149, el usuario tiene un ingreso recurrente (sueldo) proyectado al mes próximo por ARS $1.450.000
- **THEN** la card muestra el sub-label "YA SALE" sobre las dos tiles de egreso
- **AND** muestra una tile "Ya entra" a ancho completo en emerald con `+$1.450.000`
- **AND** muestra la banda de cierre neto en tono positivo indicando que el próximo mes arranca con `+$630.851` a favor (= 1.450.000 − 819.149)
- **AND** el total comprometido sigue siendo `$819.149` (el ingreso NO se sumó al total)

#### Scenario: Ingreso recurrente menor al compromiso muestra déficit

- **WHEN** el total comprometido es ARS $819.149 y el ingreso recurrente proyectado es ARS $500.000
- **THEN** la banda de cierre neto comunica el déficit (`neto = −$319.149`) en tono expense, sin ocultarlo
- **AND** el total comprometido sigue siendo `$819.149`

#### Scenario: La card es estática y no responde al navegador de mes

- **WHEN** el usuario navega el selector de mes a un mes anterior
- **THEN** "Balance del mes" y "¿En qué gasté este mes?" cambian al mes navegado
- **AND** la card "Comprometido" NO cambia: sigue mostrando los resúmenes de hoy, los recurrentes del mes próximo y el cierre neto si aplica

#### Scenario: Bimoneda separada

- **WHEN** el usuario tiene resúmenes y recurrencias en ARS y también consumos pendientes en USD
- **THEN** la card muestra los totales y tiles de ARS y USD por separado, sin convertir ni sumar entre monedas

#### Scenario: Sin resúmenes ni recurrencias muestra un estado vacío neutral

- **WHEN** el usuario no tiene deuda de tarjeta ni reglas de recurrencia activas
- **THEN** la card muestra un estado vacío neutral y NO desaparece del layout

#### Scenario: Los importes participan del eye-mask

- **WHEN** el usuario activa el eye toggle
- **THEN** el total comprometido, los montos de las tiles, el ingreso "Ya entra" y el neto del cierre quedan enmascarados

---

### Requirement: El dashboard muestra cuánto del gasto del mes se financió en tarjeta

Para explicar por qué "Gastos" (caja) es menor que el total gastado, el dashboard SHALL mostrar una sección **"Gastaste este mes"** full-width **debajo de la tira "Compartido"** (no dentro de ninguna card), **solo cuando el mes tuvo consumo de tarjeta** (financiado > 0). La sección SHALL conectar los tres números: el **total gastado** del mes (devengado, el mismo total de "¿En qué gasté este mes?"), lo que **salió de caja** (la fila "Gastos" de "Balance del mes"), y lo **financiado en tarjeta**, donde `financiado = total_devengado − gasto_de_caja` (de modo que `total = caja + financiado` cierra por construcción).

La sección SHALL presentar el **total del mes** como titular y una **barra horizontal de dos segmentos** cuyo ancho SHALL ser proporcional (`caja / total` y `financiado / total`), nunca hardcodeado: un segmento "De tu caja" (tono slate) y otro "Financiado en tarjeta" (tono terracota), cada uno con su label y su monto. En viewports angostos la barra SHALL colapsar a una columna (cada segmento como fila completa). La sección SHALL aclarar que lo financiado **"se paga en los próximos resúmenes"** (no que ya se pagó), con texto del catálogo i18n. La sección SHALL seguir el navegador de mes (refiere al mes seleccionado); reusa las mismas query keys que "Balance del mes" y "¿En qué gasté?" (TanStack dedupea, sin fetch nuevo). Los importes participan del eye-mask. Cuando el mes NO tuvo consumo de tarjeta, la sección NO SHALL renderizarse.

#### Scenario: La barra reparte el gasto entre caja y tarjeta

- **WHEN** el mes tiene gasto de caja $498.379,65 y el total devengado ("¿En qué gasté este mes?") es $879.684,24
- **THEN** la sección "Gastaste este mes" muestra el total `$879.684,24`
- **AND** muestra una barra de dos segmentos: "De tu caja" con `$498.379,65` (~56,65% del ancho) y "Financiado en tarjeta" con `$381.304,59` (~43,35% del ancho)
- **AND** aclara que lo financiado se paga en los próximos resúmenes
- **AND** los tres montos cierran: `879.684,24 = 498.379,65 + 381.304,59`

#### Scenario: Sin consumo de tarjeta la sección no aparece

- **WHEN** el total devengado del mes es igual al gasto de caja (no hubo consumo de tarjeta)
- **THEN** la sección "Gastaste este mes" NO se renderiza

#### Scenario: La barra colapsa a columna en mobile

- **WHEN** el usuario carga `/dashboard` en un viewport de 375px con consumo de tarjeta en el mes
- **THEN** la barra "Gastaste este mes" muestra cada segmento (caja y tarjeta) como una fila completa apilada

## ADDED Requirements

### Requirement: El dashboard muestra el neto del Hogar cuando hay actividad compartida (web)

El dashboard web SHALL renderizar una **tira "Compartido"** full-width que surfacea el neto del grupo Hogar del usuario, ubicada debajo de la fila "Balance del mes" + "Comprometido" y encima de "Gastaste este mes". La tira SHALL renderizarse **solo cuando hay actividad compartida**: el usuario pertenece a un Hogar de dos miembros y existe un neto/movimientos no vacíos. Sin Hogar o sin actividad, la tira NO SHALL montarse (no ensucia el dashboard de quien no usa Compartido).

El neto SHALL derivarse reutilizando la lógica de deuda derivada por moneda ya existente en `apps/web/lib/shared/queries.ts`; la tira NO SHALL duplicar esa matemática. Como hoy existe **un solo Hogar**, el neto es **una sola dirección**: o "te deben" (tono emerald) o "debés" (tono expense/terracota), por moneda y sin combinar ARS con USD. La tira SHALL mostrar el ícono del Hogar, los avatares/iniciales de los dos miembros, el nombre del Hogar y los miembros, y el monto neto con su rótulo de dirección. La tira es **read-only** y navegacional: al activarse navega a `/shared`. Todos los importes participan del eye-mask.

La tira SHALL montarse con su propia tolerancia a fallas (container/boundary propio): una query lenta o fallida de Compartido NO SHALL bloquear ni romper el resto del dashboard.

#### Scenario: Con actividad, la tira muestra el neto en una dirección

- **WHEN** el usuario pertenece al Hogar "Hogar" (vos y Martín) y el neto derivado es que le deben $34.500
- **THEN** el dashboard muestra la tira "Compartido" con los dos avatares, "Hogar · vos y Martín" y el neto `Te deben $34.500` en emerald
- **AND** activar la tira navega a `/shared`

#### Scenario: Deuda en contra muestra la dirección opuesta

- **WHEN** el neto derivado del Hogar es que el usuario debe $12.000
- **THEN** la tira muestra el neto `Debés $12.000` en tono expense

#### Scenario: Sin Hogar o sin actividad la tira no se renderiza

- **WHEN** el usuario no pertenece a ningún Hogar, o pertenece pero no hay movimientos/neto compartido
- **THEN** la tira "Compartido" NO se monta en el dashboard

#### Scenario: El neto del Hogar reutiliza la derivación existente

- **WHEN** se inspecciona el origen de datos de la tira "Compartido"
- **THEN** el neto proviene de la lógica de deuda derivada de `apps/web/lib/shared/queries.ts`
- **AND** la tira NO recalcula ni duplica la matemática del neto

#### Scenario: El monto de la tira participa del eye-mask

- **WHEN** el usuario activa el eye toggle con la tira "Compartido" visible
- **THEN** el monto neto del Hogar queda enmascarado junto al resto de los importes

---

### Requirement: La fila "Ajustes" de "Balance del mes" marca el monto como sin registrar (web)

Cuando la fila "Ajustes" de "Balance del mes" se muestra (el mes tiene ajustes), la sección web SHALL acompañar el monto con un **chip "SIN REGISTRAR"** (tono ámbar/warning, uppercase) que refuerza que esa plata se movió sin registrar, además del aviso educativo (voz Grana) ya presente debajo de las barras. El texto del chip SHALL salir del catálogo i18n, sin string hardcodeado. El chip NO SHALL alterar el cálculo del monto ni del neto del mes; es puramente presentacional. El monto de Ajustes sigue participando del eye-mask.

#### Scenario: La fila Ajustes muestra el chip "SIN REGISTRAR"

- **WHEN** el mes seleccionado tiene ajustes y la fila "Ajustes" está visible (web)
- **THEN** junto al monto neto de Ajustes aparece un chip "SIN REGISTRAR" en tono ámbar
- **AND** debajo de las barras sigue apareciendo el aviso educativo desde `dashboard.month.adjustment_note`
- **AND** el texto del chip proviene del catálogo i18n

#### Scenario: Sin ajustes no hay chip

- **WHEN** el mes seleccionado no tiene ajustes (la fila "Ajustes" no se muestra)
- **THEN** el chip "SIN REGISTRAR" no se renderiza

---

### Requirement: La leyenda de "¿En qué gasté?" muestra una barra proporcional por categoría (web)

En la sección "¿En qué gasté este mes?", cada fila de la leyenda web SHALL mostrar, debajo del row (dot + nombre + monto + porcentaje), una **barra proporcional** cuyo ancho SHALL ser `monto_categoría / monto_máximo` entre las categorías mostradas, con el color de la categoría (el mismo `sliceColor` de la dona). El ancho SHALL derivarse de los datos, NO hardcodearse. La barra NO SHALL aplicarse a las filas de crédito ("te devolvieron"), que viven fuera de la dona. La dona y su total central no cambian.

#### Scenario: Cada fila de la leyenda lleva su barra proporcional

- **WHEN** el mes tiene Comida $206.625 (máximo), Transporte $165.000, Entretenimiento $114.940 y Otros $188.662 en la moneda activa
- **THEN** la leyenda muestra cada categoría con su barra: Comida al 100% del track, Transporte ~79,9%, Entretenimiento ~55,6% y Otros ~91,3%
- **AND** cada barra usa el color de su categoría
- **AND** los anchos se derivan de los montos, no están hardcodeados

#### Scenario: Las filas de crédito no llevan barra

- **WHEN** una categoría queda en crédito ("te devolvieron") y se muestra fuera de la dona
- **THEN** esa fila NO renderiza barra proporcional
