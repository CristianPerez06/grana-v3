## ADDED Requirements

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

El dashboard (web) SHALL renderizar una card **"Comprometido"** (lente COMPROMISO) que responde "¿qué debo / qué se viene?", con el subtítulo "Lo que ya sabemos del próximo mes". Se ubica **a la derecha de "Balance del mes"** en una fila de dos columnas (mismo patrón de grid que la fila del Hero "Para gastar · hoy" + "Dónde está"); en mobile las dos cards se apilan. A diferencia de "Balance del mes" y "En qué gasté este mes", esta card SHALL ser **estática "desde hoy"**: NO SHALL responder al navegador de mes (la deuda es un stock del presente y las recurrencias se proyectan al mes próximo). Aplica por ahora solo en web (mobile diferido).

La card SHALL presentar, **por moneda y sin combinar ARS con USD** (bimoneda por defecto):

- Un **total comprometido** como titular = lo que SALE = `resúmenesTarjeta + gastosRecurrentes`. El total NO SHALL incluir los ingresos recurrentes (un ingreso no es un compromiso).
- Una fila **"Resúmenes tarjeta"** = la suma de los cargos pendientes de TODOS los resúmenes impagos de las tarjetas del usuario: consumos `pending` menos los reintegros recibidos imputados a esos resúmenes, abarcando el resumen **en curso** (open) y los **cerrados/vencidos** sin pagar. NO SHALL proyectarse una línea aparte de "cuotas futuras": una compra en cuotas materializa sus N cuotas de entrada (cada una en el resumen de su mes), y las cuotas de meses futuros entran a "Resúmenes tarjeta" cuando su resumen madura.
- Una fila **"Gastos recurrentes"** (rotulada como del mes próximo) = la proyección de las reglas de recurrencia activas tipo `expense` cuyas ocurrencias caen en el **mes calendario siguiente** a hoy, sumando el monto de cada ocurrencia por moneda.
- Una fila **"Ingresos recurrentes"** (mes próximo) = la proyección análoga de las reglas tipo `income`, mostrada como **contexto** ("lo que entra"), claramente separada y NO sumada al total comprometido. Las recurrencias tipo `transfer` NO SHALL contabilizarse.

Las filas SHALL reusar el patrón visual del dashboard (Card + fila con dot + label + monto, estilo `FlowRow`), sin rediseño. Todos los importes SHALL participar del eye-mask. La proyección de recurrencias SHALL reusar `projectUpcomingOccurrences` de `@grana/money-logic`; la deuda de tarjeta SHALL reusar la lógica de pendientes por resumen ya existente, sin duplicar la matemática del neto.

La card SHALL tolerar datos parciales: si la query falla, SHALL mostrar un error compacto sin romper el resto del dashboard. Su estado de carga SHALL renderizarse como skeleton shape-matched (chrome/título visibles).

#### Scenario: La card muestra resúmenes, recurrentes y el total, con el ingreso como contexto

- **WHEN** el usuario tiene resúmenes de tarjeta impagos por ARS $245.000, gastos recurrentes proyectados al mes próximo por ARS $132.000 e ingresos recurrentes por ARS $480.000
- **THEN** la card muestra el total comprometido `$377.000` (= resúmenes + gastos recurrentes)
- **AND** muestra la fila "Resúmenes tarjeta" en `$245.000` y "Gastos recurrentes" en `$132.000`
- **AND** muestra "Ingresos recurrentes" en `$480.000` como contexto, separado y NO sumado al total

#### Scenario: La card es estática y no responde al navegador de mes

- **WHEN** el usuario navega el selector de mes a un mes anterior
- **THEN** "Balance del mes" y "En qué gasté este mes" cambian al mes navegado
- **AND** la card "Comprometido" NO cambia: sigue mostrando los resúmenes de hoy y los recurrentes del mes próximo

#### Scenario: Los resúmenes de tarjeta suman todos los impagos

- **WHEN** el usuario tiene un resumen cerrado impago con $120.000 pendientes y el resumen en curso con $90.000 consumidos y un reintegro recibido de $15.000 imputado al resumen
- **THEN** la fila "Resúmenes tarjeta" muestra `$195.000` (120.000 + 90.000 − 15.000)
- **AND** las cuotas de meses futuros (en resúmenes que aún no maduraron) NO se cuentan acá

#### Scenario: Bimoneda separada

- **WHEN** el usuario tiene resúmenes y recurrencias en ARS y también consumos pendientes en USD
- **THEN** la card muestra los totales y filas de ARS y USD por separado, sin convertir ni sumar entre monedas

#### Scenario: Sin resúmenes ni recurrencias muestra un estado vacío neutral

- **WHEN** el usuario no tiene deuda de tarjeta ni reglas de recurrencia activas
- **THEN** la card muestra un estado vacío neutral y NO desaparece del layout

#### Scenario: Los importes participan del eye-mask

- **WHEN** el usuario activa el eye toggle
- **THEN** el total comprometido y los montos de todas las filas quedan enmascarados

### Requirement: El dashboard muestra cuánto del gasto del mes se financió en tarjeta

Para explicar por qué "Gastos" (caja) es menor que el total gastado, el dashboard SHALL mostrar una **tira full-width** (voz Grana, con 💳) **debajo de la fila "Balance del mes" + "Comprometido"** (no dentro de ninguna card), **solo cuando el mes tuvo consumo de tarjeta** (financiado > 0). La tira SHALL conectar los tres números: el **total gastado** del mes (devengado, el mismo total de "¿En qué gasté este mes?"), lo que **salió de caja** (la fila "Gastos" de "Balance del mes"), y lo **financiado en tarjeta**, donde `financiado = total_devengado − gasto_de_caja` (de modo que `total = caja + financiado` cierra por construcción). SHALL aclarar que lo financiado **"se paga en los próximos resúmenes"** (no que ya se pagó). La tira SHALL seguir el navegador de mes (refiere al mes seleccionado). El texto SHALL salir del catálogo i18n (`dashboard.month.financed_on_card`) con interpolación de los montos; los importes participan del eye-mask. Cuando el mes NO tuvo consumo de tarjeta, la tira NO SHALL renderizarse.

#### Scenario: La tira conecta el gasto de caja con lo financiado en tarjeta

- **WHEN** el mes tiene gasto de caja $409.079,65 y el total devengado ("¿En qué gasté este mes?") es $829.284,24
- **THEN** debajo de la fila de las dos cards aparece la tira 💳 indicando que de los `$829.284,24` gastados, `$409.079,65` salieron de la caja y `$420.204,59` se financiaron en tarjeta
- **AND** la tira aclara que lo financiado se paga en los próximos resúmenes
- **AND** los tres montos cierran: `829.284,24 = 409.079,65 + 420.204,59`

#### Scenario: Sin consumo de tarjeta la tira no aparece

- **WHEN** el total devengado del mes es igual al gasto de caja (no hubo consumo de tarjeta)
- **THEN** la tira 💳 NO se renderiza

## MODIFIED Requirements

### Requirement: El selector de mes del dashboard gobierna las secciones mensuales

El dashboard SHALL exponer un navegador mensual `‹ Mes Año ›` (`MonthNavigator`) cuyo estado vive en un context client-side compartido (`DashboardMonthProvider` en web; su espejo nativo en mobile), inicializado en el mes actual derivado de `getTodayAR()`. Su ubicación es específica de cada plataforma: en **web** vive en el header de la página (junto al eye toggle y "Nuevo movimiento"); en **nativo** vive dentro del header navy de la pantalla, debajo del saludo, ocupando el ancho (pill blanca sobre navy).

Cambiar el mes seleccionado SHALL actualizar **en simultáneo** las secciones "Balance del mes" y "En qué gasté este mes" (y la tira "financiado en tarjeta", que refiere al mes seleccionado). El selector NO SHALL afectar al Hero "Para gastar · hoy" ni a la card "Dónde está" (son saldo de hoy) ni a la línea "vas {neto} este mes" del header de la card "Balance del mes" (que es siempre del mes en curso) ni a la card "Comprometido" (que es estática "desde hoy": resúmenes del presente + recurrentes del mes próximo).

La navegación de mes NO SHALL modificar la URL/ruta ni provocar una navegación; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual; en nativo, salir del tab y volver resetea al mes actual, mismo mecanismo de remount que el eye-mask). Las flechas SHALL permitir navegar hasta 12 meses hacia atrás; la flecha derecha SHALL deshabilitarse en el mes actual (no se navega al futuro). Cada sección mensual SHALL obtener los datos del mes no-actual client-side (web: server action vía TanStack; nativo: su hook TanStack existente) mostrando su propio estado de carga in-card; en web el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes actualiza las secciones mensuales

- **WHEN** el usuario en junio 2026 toca la flecha izquierda del navegador
- **THEN** "Balance del mes" y "En qué gasté este mes" muestran los datos de mayo 2026
- **AND** "Para gastar · hoy", "Dónde está" y "Comprometido" no cambian
- **AND** no hay navegación de ruta ni recarga de pantalla

#### Scenario: El selector no afecta el ancla del mes en curso

- **WHEN** el usuario navega el selector a un mes anterior
- **THEN** la línea "vas {neto} este mes" de la card "Balance del mes" sigue mostrando el neto del mes en curso

#### Scenario: Límites de navegación

- **WHEN** el usuario está en el mes actual
- **THEN** la flecha derecha está deshabilitada
- **AND** tras navegar 12 meses hacia atrás, la flecha izquierda se deshabilita

#### Scenario: Mes no-actual se fetchea client-side con loading in-card

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** cada sección mensual muestra su skeleton in-card (título y chrome visibles) mientras su fetch resuelve
- **AND** una falla en el fetch de una sección muestra error compacto con reintento en esa sección sin romper la otra

#### Scenario: El navegador vive en el header navy (mobile)

- **WHEN** el usuario abre el dashboard en la app nativa
- **THEN** el `MonthNavigator` se renderiza dentro del header navy, debajo del saludo, ocupando el ancho
- **AND** salir del tab y volver resetea la selección al mes actual

### Requirement: Cada sección del dashboard rotula la pregunta que ayuda a responder

Para que quede claro que el dashboard mezcla **lentes distintas a propósito** (CAJA vs CONSUMO vs COMPROMISO) — y que dos números que miran cosas distintas no tienen por qué coincidir — cada sección del dashboard SHALL comunicar la pregunta que ayuda a responder, ya sea con un rótulo breve (voz Grana, atenuado, como subtítulo/caption) o usando la pregunta directamente como título de la card. Los textos SHALL salir del catálogo i18n (sin hardcodear) y participar del idioma activo. El rótulo NO SHALL alterar la jerarquía visual existente (no compite con el titular/importe principal).

Las preguntas por sección:

- **Disponible / "Para gastar · hoy"** → "¿Cuánto tengo?" (lente CAJA, stock de hoy), como caption.
- **Balance del mes** → "¿Cómo se movió mi plata este mes?" (lente CAJA, flujo del mes; reconcilia con el Disponible), como subtítulo.
- **"¿En qué gasté este mes?"** (lente CONSUMO, devengado) → la pregunta **es el título** de la card (antes "En qué se fue"); no lleva subtítulo aparte. El nombre evita el malentendido de "se fue": hay plata que se gastó (tarjeta) pero todavía no salió de la caja.
- **Comprometido** → subtítulo "Lo que ya sabemos del próximo mes" (lente COMPROMISO).

#### Scenario: Cada card comunica su pregunta

- **WHEN** el usuario abre el dashboard
- **THEN** el Hero rotula "¿Cuánto tengo?"
- **AND** "Balance del mes" rotula "¿Cómo se movió mi plata este mes?"
- **AND** la card de consumo se titula "¿En qué gasté este mes?" (sin subtítulo redundante)
- **AND** "Comprometido" lleva el subtítulo "Lo que ya sabemos del próximo mes"
- **AND** todos los textos salen del catálogo i18n en el idioma activo

#### Scenario: El rótulo no compite con el titular

- **WHEN** se renderiza el rótulo/subtítulo de una sección
- **THEN** se muestra atenuado, sin alterar la jerarquía del importe principal de la card
