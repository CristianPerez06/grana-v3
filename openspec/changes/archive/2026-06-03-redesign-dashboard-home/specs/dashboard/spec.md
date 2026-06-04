# dashboard — Delta (redesign-dashboard-home)

## ADDED Requirements

### Requirement: La card "Dónde está" desglosa las cuentas del usuario (web)

Junto al Hero "Para gastar · hoy", el dashboard web SHALL renderizar una card "Dónde está" que desglosa dónde vive el disponible. La card SHALL listar las cuentas activas `type IN ('cash','bank')` ordenadas por saldo ARS descendente (el orden que ya devuelve `getDashboardHero`), cada fila con el `AccountAvatar` chico de la cuenta + nombre + saldo ARS alineado a la derecha. Un saldo ARS de cero SHALL pintarse atenuado (`text-faint` o equivalente). La card SHALL truncar el listado a un máximo de 6 cuentas; el resto se ve en `/accounts`.

Como fila final, separada del resto, la card SHALL mostrar la tenencia "En dólares": el total USD del usuario (el mismo `usd` del Hero) destacado en emerald. Esta fila representa el stock total en USD, NO un desglose por cuenta.

El header de la card SHALL incluir un link "Ver todas" → `/accounts`. Los datos SHALL salir de la misma llamada a `getDashboardHero` que alimenta el Hero (un único container para la fila superior; sin doble fetch). Todos los importes de la card participan del eye-mask.

#### Scenario: Cuentas ordenadas con la tenencia USD al final

- **WHEN** el usuario tiene Billetera $1.254.499, Galicia $1.200.000, Cooperativa $0 y un total USD de u$s 1.240
- **THEN** la card lista Billetera, Galicia y Cooperativa en ese orden con sus saldos ARS
- **AND** el saldo $0 de Cooperativa se pinta atenuado
- **AND** la fila final "En dólares" muestra u$s 1.240 en emerald

#### Scenario: Más de 6 cuentas se truncan

- **WHEN** el usuario tiene 9 cuentas cash/bank activas
- **THEN** la card muestra las 6 de mayor saldo ARS + la fila "En dólares"
- **AND** el link "Ver todas" navega a `/accounts` donde está el listado completo

#### Scenario: Una sola llamada alimenta la fila superior

- **WHEN** se inspecciona el container de la fila superior del dashboard web
- **THEN** un único container async llama a `getDashboardHero` y renderiza ambas cards (Hero + "Dónde está") con esa data
- **AND** NO hay una segunda llamada a `getDashboardHero` para la card de cuentas

---

### Requirement: El selector de mes del header gobierna las secciones mensuales (web)

El header del dashboard web SHALL incluir un navegador mensual `‹ Mes Año ›` (el componente `MonthNavigator` existente) cuyo estado vive en un context client-side compartido (`DashboardMonthProvider`), inicializado en el mes actual derivado de `getTodayAR()`.

Cambiar el mes seleccionado SHALL actualizar **en simultáneo** las secciones "Balance del mes" y "En qué se fue". El selector NO SHALL afectar al Hero "Para gastar · hoy" ni a la card "Dónde está" (son saldo de hoy) ni a la línea "vas {neto} este mes" del header de la card "Balance del mes" (que es siempre del mes en curso).

La navegación de mes NO SHALL modificar la URL ni provocar una navegación de ruta; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual). Las flechas SHALL permitir navegar hasta 12 meses hacia atrás; la flecha derecha SHALL deshabilitarse en el mes actual (no se navega al futuro). Cada sección mensual SHALL obtener los datos del mes no-actual client-side (vía server action) mostrando su propio estado de carga in-card; el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes actualiza las dos secciones mensuales

- **WHEN** el usuario en junio 2026 toca la flecha izquierda del navegador del header
- **THEN** "Balance del mes" y "En qué se fue" muestran los datos de mayo 2026
- **AND** "Para gastar · hoy" y "Dónde está" no cambian
- **AND** la URL no cambia y la página no se recarga

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

---

### Requirement: La sección "Balance del mes" web muestra el neto del mes con barras de ingresos y gastos (web)

En el dashboard web, la sección "Balance del mes" SHALL mostrar, para el mes seleccionado en el header: un eyebrow "BALANCE" y debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense); debajo, dos filas Ingresos y Gastos, cada una con dot de color + label + monto y una barra horizontal proporcional.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya server-rendered (sin fetch adicional).

Los anchos de las barras SHALL calcularse de los datos: la serie de mayor valor absoluto entre ingresos y gastos ocupa el 100% del track y la otra escala proporcionalmente (`menor / mayor`); con ambos en cero, ambas barras quedan vacías. Los anchos NO SHALL hardcodearse. Ingresos usa el color emerald; Gastos el terracota.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda); la sección NO SHALL renderizar el gráfico de línea acumulada en web (ese requirement queda mobile-only). El gráfico de línea (`MonthBalanceChart`) y su story SHALL eliminarse de `apps/web`. Todos los importes participan del eye-mask.

#### Scenario: Neto positivo con barras proporcionales

- **WHEN** el mes seleccionado tiene ingresos ARS $800.000 y gastos ARS $295.500,25
- **THEN** el neto muestra `+$504.499,75` en emerald
- **AND** la barra de Ingresos ocupa el 100% del track y la de Gastos ~36,9%
- **AND** el strip USD muestra el neto USD del mes con su detalle de ingresos y gastos

#### Scenario: Gastos mayores que ingresos invierten la proporción

- **WHEN** el mes tiene ingresos ARS $100.000 y gastos ARS $250.000
- **THEN** el neto muestra `−$150.000` en tono expense
- **AND** la barra de Gastos ocupa el 100% y la de Ingresos el 40%

#### Scenario: Mes sin movimientos muestra ceros

- **WHEN** el mes seleccionado no tiene movimientos confirmados
- **THEN** el neto muestra `$0` y ambas barras quedan vacías
- **AND** el strip USD muestra `US$0` con ingresos y gastos en cero

#### Scenario: El header de la card ancla el neto del mes en curso

- **WHEN** el usuario va `+$504.499,75` en el mes en curso y navega el selector a un mes anterior
- **THEN** el header de la card sigue mostrando "vas +$504.499,75 este mes" (mes en curso) mientras el cuerpo muestra el mes navegado
- **AND** activar el eye-mask enmascara ese monto

#### Scenario: El chart de línea ya no existe en web

- **WHEN** se busca `MonthBalanceChart` en `apps/web`
- **THEN** no existe el componente ni su story (el gráfico de línea vive solo en mobile)

---

### Requirement: La sección "En qué se fue" muestra el desglose de gastos por categoría con dona y toggle de moneda (web)

El dashboard web SHALL renderizar como tercera sección "En qué se fue": una dona SVG con los gastos del mes seleccionado por categoría + una leyenda, con un control `Segmented` ARS/USD (default ARS) en el header de la card.

- Los datos SHALL salir de `getMonthCategoryBreakdown` procesados con `buildCategorySlices` de `@grana/money-logic` con `topN: 5` y bucket "Otros" — la matemática del neto por categoría no se duplica.
- Los tramos de la dona SHALL derivarse de los porcentajes calculados; NO SHALL hardcodearse. La dona SHALL implementarse como SVG (técnica de strokes circulares, mismo idioma que el desglose de Movimientos), con el centro mostrando el label "GASTOS" y el total del mes en la moneda activa.
- Cada tramo/fila SHALL usar el color de la categoría en DB (`slice.color`), con fallback posicional a la paleta `--cat-*` — la misma categoría se ve del mismo color que en el desglose de Movimientos. Los colores del handoff son ilustrativos.
- La leyenda SHALL mostrar por categoría: dot de color + nombre traducido (`translateCategoryLabel`; el sentinel uncategorized usa su label i18n) + monto + porcentaje. Cada fila SHALL linkear al desglose completo en Movimientos (`/transactions`, que abre con el desglose del mes). La preselección de categoría/mes/moneda vía URL NO existe: los filtros de `/transactions` viven en estado React por diseño y no se hidratan de la URL.
- El toggle ARS/USD SHALL alternar el desglose entre monedas sin refetch (el breakdown ya trae ambas) y sin tocar las otras secciones.
- El header de la card SHALL incluir un link "Ver desglose" al desglose completo en Movimientos (`/transactions`).
- Si el mes no tiene gastos en la moneda activa, la card SHALL mostrar un estado vacío neutral; la card NO SHALL desaparecer del layout.
- Los montos (leyenda y centro de la dona) participan del eye-mask; los porcentajes no se enmascaran.

Esta sección reemplaza en web al teaser de 3 categorías (ver delta de `spending-by-category`); los componentes web del teaser SHALL eliminarse.

#### Scenario: Dona calculada de los datos con colores de DB

- **WHEN** el mes tiene gastos ARS en Comida 38%, Servicios 23%, Transporte 15%, Súper 14% y Salud 10%
- **THEN** la dona renderiza 5 tramos cuyos ángulos corresponden a esos porcentajes
- **AND** cada tramo usa el color de su categoría en DB
- **AND** el centro muestra "GASTOS" + el total ARS del mes

#### Scenario: Toggle a USD alterna el desglose

- **WHEN** el usuario activa "USD" en el segmented y el mes tiene un único gasto USD en Entretenimiento de US$10
- **THEN** la dona muestra un tramo único (100%) y la leyenda "Entretenimiento — US$10 — 100%"
- **AND** no se dispara un nuevo fetch ni cambian las otras secciones

#### Scenario: Más de 5 categorías se agrupan en Otros

- **WHEN** el mes tiene gastos ARS en 8 categorías
- **THEN** la dona y la leyenda muestran las 5 de mayor peso + un tramo "Otros" con el resto agregado

#### Scenario: Sin gastos en la moneda activa

- **WHEN** el mes seleccionado no tiene gastos en la moneda activa
- **THEN** la card muestra un estado vacío neutral y permanece en el layout

#### Scenario: Una fila navega al desglose de Movimientos

- **WHEN** el usuario hace click en la fila "Comida" de la leyenda
- **THEN** navega a `/transactions`, que abre con el desglose completo del mes
- **AND** NO se ejecuta ninguna mutación

#### Scenario: "Ver desglose" navega al desglose completo

- **WHEN** el usuario hace click en "Ver desglose" en el header de la card
- **THEN** navega a `/transactions`, que abre con el desglose completo del mes
- **AND** NO se ejecuta ninguna mutación

## MODIFIED Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

La composición de secciones difiere por plataforma:

- **Web** SHALL renderizar tres secciones en orden fijo: (1) fila superior con el Hero "Para gastar · hoy" y la card "Dónde está", (2) "Balance del mes", (3) "En qué se fue". El dashboard web NO SHALL renderizar la sección "Lo que viene" ni la card de bienvenida `WelcomeFirstMoveCard`.
- **Mobile** SHALL renderizar sus secciones en orden vertical: Hero → Lo que viene → Balance del mes (+ teaser de categorías según la spec de `spending-by-category`), sin cambios respecto del diseño anterior.

La sección Tarjetas NO forma parte del dashboard en ninguna plataforma; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding (web)

- **WHEN** un usuario completa el flujo de onboarding en web
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza las tres secciones (fila superior "Para gastar"+"Dónde está", "Balance del mes", "En qué se fue") en orden fijo
- **AND** NO renderiza "Lo que viene" ni la card de bienvenida

#### Scenario: Login exitoso aterriza en dashboard

- **WHEN** un usuario con onboarding completado hace login
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Arranque con sesión activa aterriza en /dashboard renderizado (mobile)

- **WHEN** un usuario mobile con sesión válida persistida abre la app
- **THEN** la app aterriza en `(app)/dashboard` con las tres secciones renderizadas (Hero, Lo que viene, Balance del mes)
- **AND** NO renderiza el placeholder "Dashboard" de texto plano

---

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En viewports `lg` (≥1024px) y mayores, la pantalla `/dashboard` web SHALL organizar sus secciones así: una **fila superior** de dos columnas (grid asimétrico ~`1.15fr 1fr`, alturas igualadas con `align-items: stretch`) con el Hero "Para gastar · hoy" a la izquierda y la card "Dónde está" a la derecha; debajo, "Balance del mes" como card full-width; debajo, "En qué se fue" como card full-width. El contenido SHALL estar centrado con un max-width acotado (~1080px efectivos).

Por debajo de `lg`, el dashboard SHALL apilar todas las cards en una sola columna en el mismo orden (Para gastar → Dónde está → Balance del mes → En qué se fue). En "En qué se fue", la dona y la leyenda SHALL apilarse en una columna centrada en viewports angostos.

#### Scenario: Desktop ancho muestra la fila superior en dos columnas

- **WHEN** un usuario carga `/dashboard` en un viewport de 1440px
- **THEN** "Para gastar · hoy" y "Dónde está" se muestran lado a lado con la misma altura
- **AND** "Balance del mes" y "En qué se fue" ocupan el ancho completo debajo, en ese orden

#### Scenario: Bajo lg el dashboard apila en una columna

- **WHEN** un usuario carga `/dashboard` en un viewport de 820px o de 375px
- **THEN** las cards se apilan en una sola columna: Para gastar → Dónde está → Balance del mes → En qué se fue

#### Scenario: La dona se centra en mobile

- **WHEN** un usuario carga `/dashboard` en un viewport de 375px
- **THEN** "En qué se fue" muestra la dona centrada con la leyenda ocupando el ancho debajo

---

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}.` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola.") cuando el perfil no tiene nombre. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El `eye toggle` siempre vive en este header; el botón "Nuevo movimiento" vive en este header **solo en desktop-web** (viewport `≥sm`) — en mobile-web el acceso primario para registrar es el FAB definido en la spec de `transactions` y NO se renderiza en el header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

En **web**, el header SHALL incluir además el navegador mensual compartido (ver requirement "El selector de mes del header gobierna las secciones mensuales (web)"). El subtítulo del header SHALL mostrar únicamente la fecha; el neto del mes en curso ("vas {neto} este mes") NO vive en el header sino en el header de la card "Balance del mes" (decisión de QA del rediseño: junto a la fecha competía con el saludo).

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") aunque exista un perfil con nombre, y los controles que sí vivan en el header en el viewport activo SHALL renderizarse en estado disabled (ver sus respectivos requirements). En desktop-web esto cubre el `eye toggle`, el navegador mensual y el botón "Nuevo movimiento"; en mobile-web cubre el `eye toggle` y el navegador mensual. Cuando la query del perfil resuelve, el header SHALL actualizarse al saludo personalizado y habilitar los controles del header. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero los controles SHALL pasar a estado habilitado para no bloquear al usuario.

La fecha del header NO SHALL depender de esa query: SHALL calcularse en el server o en el primer render con `getTodayAR()` y mantenerse estable entre el estado disabled y el habilitado.

#### Scenario: Saludo con nombre del perfil

- **WHEN** el usuario con nombre "Cristian" carga `/dashboard`
- **THEN** el header termina mostrando "Hola, Cristian."
- **AND** muestra la fecha de hoy en la zona horaria financiera (AR)

#### Scenario: Saludo sin nombre usa fallback

- **WHEN** el usuario no tiene nombre cargado en el perfil
- **THEN** el header muestra "Hola."

#### Scenario: La fecha de hoy se calcula desde la zona financiera

- **WHEN** se renderiza la fecha del header del dashboard
- **THEN** el valor se deriva de `getTodayAR()` y NO de `new Date()` directo

#### Scenario: El subtítulo del header muestra solo la fecha (web)

- **WHEN** el usuario carga `/dashboard` en web
- **THEN** el subtítulo del header muestra la fecha de hoy sin el neto del mes
- **AND** el neto del mes en curso aparece en el header de la card "Balance del mes"

#### Scenario: El header se ve antes de que resuelva la query del perfil (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** sus controles (`eye toggle`, navegador mensual, "Nuevo movimiento") están visibles pero disabled

#### Scenario: El header se ve antes de que resuelva la query del perfil (mobile-web)

- **WHEN** un usuario web en viewport `<sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** el `eye toggle` y el navegador mensual están visibles pero disabled
- **AND** el botón "Nuevo movimiento" NO se renderiza en el header (su lugar lo ocupa el FAB)

#### Scenario: Resolver la query actualiza el saludo y habilita los controles (web)

- **WHEN** la query del perfil resuelve con `full_name = "Cristian Perez"` después de mostrar el estado disabled inicial
- **THEN** el saludo del header pasa a "Hola, Cristian."
- **AND** los controles que vivan en el header en el viewport activo se habilitan

#### Scenario: Fallo de la query no deja el header bloqueado (web)

- **WHEN** la query del perfil falla
- **THEN** el saludo se mantiene en "Hola." (fallback anon)
- **AND** los controles del header se habilitan igual para no bloquear al usuario

---

### Requirement: La pantalla dashboard es read-only

El dashboard SHALL NOT exponer formularios, botones de creación, edición, eliminación, archivado ni confirmación de movimientos pendientes. Toda interacción que requiera modificar datos SHALL ocurrir en el módulo correspondiente (Cuentas, Tarjetas, Movimientos). Los elementos visibles en el dashboard PUEDEN ser clickeables como atajos de navegación a esos módulos, pero NO ejecutan mutaciones en sí mismos.

#### Scenario: Click en el Hero navega a Cuentas (web)

- **WHEN** el usuario hace click en el importe del Hero "Para gastar"
- **THEN** el sistema navega a `/accounts`

#### Scenario: Click en "Ver todas" de "Dónde está" navega a Cuentas (web)

- **WHEN** el usuario hace click en el link "Ver todas" de la card "Dónde está"
- **THEN** el sistema navega a `/accounts`
- **AND** NO dispara ninguna mutación

#### Scenario: Click en una categoría de "En qué se fue" navega a Movimientos (web)

- **WHEN** el usuario hace click en una fila de la leyenda de "En qué se fue"
- **THEN** el sistema navega a `/transactions`, que abre con el desglose completo del mes
- **AND** NO dispara ninguna mutación

#### Scenario: Toque en un ítem de "Lo que viene" navega al módulo correspondiente (mobile)

- **WHEN** el usuario toca un ítem de la sección "Lo que viene" que corresponde a un resumen de tarjeta cerrado
- **THEN** la app navega con `useRouter().push(...)` al detalle de ese período dentro del módulo cards mobile
- **AND** NO abre un modal de pago de resumen ni dispara ninguna mutación
- **AND** mientras la ruta de detalle de período no exista en cards mobile, la navegación apunta a `/tarjetas` (decisión transitoria)

#### Scenario: Toque en el Hero navega a Cuentas (mobile)

- **WHEN** el usuario toca el importe del Hero "Para gastar"
- **THEN** la app navega con `useRouter().push(...)` a la pantalla de cuentas mobile cuando exista
- **AND** mientras la pantalla de cuentas mobile no exista, el Hero permanece visualmente "tappable" pero la navegación apunta al menú (decisión transitoria documentada en código)

---

### Requirement: El Hero muestra el disponible total bimoneda

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor). Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

En **web**, el Hero SHALL renderizarse como una card oscura (navy de marca vía token `surface-dark`, sin hex inline) con: eyebrow "PARA GASTAR · HOY" en uppercase, el importe ARS como titular grande con los decimales en tipografía reducida, la línea USD como chip "USD" + importe, y una caption al pie ("Lo que tenés disponible hoy, en pesos y dólares" vía i18n). El bloque eyebrow+importes SHALL centrarse verticalmente en el espacio sobre la caption (la card estira su altura para igualar a "Dónde está"). El Hero web NO SHALL contener el desglose de cuentas: ese desglose vive en la card "Dónde está" (ver su requirement). En **mobile** el Hero SHALL mantenerse minimal: solo el disponible total (ARS primario + USD subordinado), sin desglose. En ambos casos se respeta bimoneda (ARS primario, USD subordinado, sin merge entre monedas).

#### Scenario: Usuario con saldos en ambas monedas

- **WHEN** el usuario tiene una cuenta cash con $ 150.000 ARS + u$s 500 USD y una cuenta bank con $ 137.450 ARS + u$s 740,50 USD, sin pagos de resúmenes pendientes ya descontados
- **THEN** el Hero muestra `$ 287.450,00` en línea primaria y `u$s 1.240,50` en línea secundaria

#### Scenario: Consumo en tarjeta no reduce el disponible del Hero

- **WHEN** el usuario tiene $ 100.000 ARS disponibles y registra un consumo de $ 30.000 en su tarjeta Visa
- **THEN** el Hero sigue mostrando `$ 100.000,00`
- **AND** el consumo aparece en `/cards`

#### Scenario: Pago de resumen reduce el disponible

- **WHEN** el usuario paga el resumen de Visa por $ 145.200 desde una cuenta cash que tenía $ 287.450
- **THEN** el Hero pasa a mostrar `$ 142.250,00`

#### Scenario: El Hero web es la card oscura sin desglose de cuentas (web)

- **WHEN** el usuario carga `/dashboard` en web
- **THEN** el Hero se pinta como card navy con eyebrow "PARA GASTAR · HOY", el importe ARS grande y el chip USD
- **AND** el desglose por cuenta NO está dentro del Hero (vive en la card "Dónde está" contigua)
- **AND** el color navy proviene del token de tema, no de un hex inline

---

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard.

En **web**, el toggle SHALL aplicar al menos a: Hero "Para gastar · hoy" (importes ARS y USD), card "Dónde está" (saldos por cuenta y fila "En dólares"), "Balance del mes" (neto, ingresos, gastos, strip USD y la línea "vas {neto} este mes" del header de la card) y "En qué se fue" (montos de la leyenda y total del centro de la dona — los porcentajes NO se enmascaran). En **mobile**, el toggle SHALL aplicar a: Hero (importes ARS y USD), Lo que viene (importes individuales y totales) y Balance del mes (importes de ingresos, gastos y balance).

En **web**, el `eye toggle` SHALL permanecer montado y visible mientras el header esté en su estado de carga (query del nombre sin resolver), pero SHALL renderizarse **disabled** durante ese estado: no SHALL responder a clicks ni modificar el estado del `EyeMaskProvider`. Cuando el header sale del estado de carga, el toggle SHALL pasar a su comportamiento normal. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas, categorías y porcentajes permanecen visibles

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` y luego vuelve a `/dashboard`
- **THEN** los importes están visibles nuevamente (estado no persistido)

#### Scenario: El toggle está montado pero disabled mientras el header carga (web)

- **WHEN** el header del dashboard está en su estado de carga
- **THEN** el `eye toggle` aparece en su posición habitual con el ícono visible
- **AND** está deshabilitado: clickearlo NO cambia el estado del `EyeMaskProvider`

#### Scenario: El eye toggle web está implementado sobre el UI Button

- **WHEN** un desarrollador inspecciona el componente `EyeMaskToggle` en `apps/web`
- **THEN** delega el render en el UI `Button` con `variant="ghost"` y `size="icon"`
- **AND** NO es un `<button>` artesanal con clases tailwind ad-hoc

---

### Requirement: La sección "Lo que viene" lista compromisos firmes y recurrencias de los próximos 14 días

La sección "Lo que viene" existe únicamente en el dashboard **mobile** (el dashboard web ya no la renderiza). En mobile, la sección SHALL agrupar los eventos previstos en dos grupos — "A pagar" y "A cobrar" — para los próximos 14 días contados desde `getTodayAR()` inclusive, stackeados verticalmente.

La sección "A pagar" SHALL incluir:

1. **Resúmenes de tarjeta cerrados pendientes de pago**: filas de `card_periods` con estado derivado `closed` o `overdue` (sin `period_payment`) cuyo `due_date` cae dentro del rango `[today, today+14d]`. Cada ítem SHALL mostrar la fecha de vencimiento, el nombre de la tarjeta, y el monto total del resumen.
2. **Instancias recurrentes salientes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `expense` o `transfer` (saliente).

La sección "A cobrar" SHALL incluir:

1. **Instancias recurrentes entrantes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `income`.

La sección SHALL NOT incluir cuotas individuales (`transactions` con `parent_id NOT NULL`) como ítems propios. Las cuotas forman parte del monto de un resumen y se ven al abrir el detalle del período en el módulo cards.

La sección SHALL NOT incluir consumos del período abierto (estado derivado `open`), porque aún no son compromisos firmes (la fecha de cierre y el monto final pueden variar).

#### Scenario: Resumen cerrado próximo a vencer aparece en "A pagar" (mobile)

- **WHEN** el usuario tiene un `card_periods` con estado derivado `closed`, `due_date='2026-05-27'` y total $ 145.200, y `today='2026-05-20'`
- **THEN** "A pagar" lista un ítem "27/05 — Visa Galicia — $ 145.200"

#### Scenario: Cuota individual no aparece como ítem propio (mobile)

- **WHEN** el usuario tiene una compra en 6 cuotas asignada a un resumen que aparece en "A pagar"
- **THEN** la cuota individual NO aparece como ítem separado en "A pagar"
- **AND** el monto de la cuota está incluido en el total del resumen del ítem ya listado

#### Scenario: Recurrencia entrante aparece en "A cobrar" (mobile)

- **WHEN** el usuario tiene una `recurrences` de tipo `income` con `recurrence_instances` no confirmada/no omitida y `expected_date='2026-05-30'` por $ 850.000, y `today='2026-05-20'`
- **THEN** "A cobrar" lista un ítem "30/05 — Sueldo — $ 850.000"

#### Scenario: Recurrencia ya confirmada no aparece en "Lo que viene" (mobile)

- **WHEN** una `recurrence_instances` ya fue confirmada por el usuario (creó la transacción real)
- **THEN** NO aparece en "Lo que viene"
- **AND** sí aparece en el listado de Movimientos como cualquier otra transacción

#### Scenario: Resumen ya pagado no aparece en "A pagar" (mobile)

- **WHEN** existe `period_payments` con `period_id=X`
- **THEN** el `card_periods` `X` NO aparece en "A pagar" aunque su `due_date` esté dentro del rango

#### Scenario: Consumo del período abierto no aparece en "A pagar" (mobile)

- **WHEN** el usuario registra un consumo de $ 50.000 en una tarjeta cuyo período actual tiene estado derivado `open`
- **THEN** el consumo NO genera ítem propio en "A pagar"
- **AND** el período cuyo estado es `open` tampoco aparece en "A pagar" (aún no es compromiso firme)

#### Scenario: Sin eventos en el rango, la sección muestra estado vacío (mobile)

- **WHEN** no hay resúmenes cerrados pendientes ni recurrencias previstas en los próximos 14 días
- **THEN** la sección renderiza un estado vacío con un mensaje neutral ("No tenés movimientos previstos en los próximos 14 días")
- **AND** la sección NO desaparece del layout

#### Scenario: Layout de "Lo que viene" en mobile es stackeado verticalmente (mobile)

- **WHEN** el dashboard se renderiza en mobile
- **THEN** "A pagar" se renderiza primero con su lista y su total al pie
- **AND** debajo se renderiza "A cobrar" con su lista y su total al pie
- **AND** al final de las dos secciones se renderiza el "Balance del período" desglosado por moneda
- **AND** NO se usa scroll horizontal ni tabs para alternar entre los dos grupos

#### Scenario: El dashboard web no renderiza "Lo que viene" (web)

- **WHEN** un usuario carga `/dashboard` en web
- **THEN** la sección "Lo que viene" NO se renderiza
- **AND** los componentes web de la sección no existen en `apps/web` (las queries permanecen en `@grana/dashboard` para mobile)

---

### Requirement: "Lo que viene" muestra totales por agrupación y balance del período

Para cada agrupación de "Lo que viene" ("A pagar" y "A cobrar") en el dashboard **mobile**, la sección SHALL mostrar el total agregado por moneda. Si los ítems tienen monedas mixtas, el total se desglosa por moneda en líneas separadas. La sección SHALL mostrar un "Balance del período" calculado como `total a cobrar (ARS) − total a pagar (ARS)`, con su signo y color (verde si positivo, neutral si cero, coral si negativo). Si los importes de a pagar y a cobrar incluyen monedas distintas a ARS, el balance del período SHALL desglosarse por moneda; nunca SHALL convertir entre monedas (principio bimoneda).

El total de cada agrupación se renderiza al pie de su lista y el balance del período al final de toda la sección (layout mobile stackeado).

#### Scenario: Totales mixtos y balance positivo en ARS (mobile)

- **WHEN** "A pagar" suma $ 425.200 (ARS) + u$s 230 (USD) y "A cobrar" suma $ 850.000 (ARS)
- **THEN** "A pagar" muestra `Total $ 425.200 · u$s 230`
- **AND** "A cobrar" muestra `Total $ 850.000`
- **AND** "Balance del período" muestra `+ $ 424.800` (en ARS, positivo, verde) y `− u$s 230` (en USD, negativo, coral) en líneas separadas

---

### Requirement: La sección "Balance del mes" muestra un gráfico de línea acumulada con navegador mensual

Este requirement SHALL aplicar únicamente al dashboard **mobile** (en web, "Balance del mes" se rige por el requirement "La sección 'Balance del mes' web muestra el neto del mes con barras de ingresos y gastos (web)").

La sección SHALL renderizar un gráfico de línea cuyo eje X representa los días del mes seleccionado (1 a 28/29/30/31 según el mes), eje Y representa el balance acumulado en ARS desde el día 1 del mes hasta cada día inclusive (`balance acumulado = Σ ingresos − Σ gastos hasta el día i`), y cuyo trazo conecta esos puntos con interpolación lineal. La línea SHALL cruzar el eje X cuando el acumulado pase por cero (visualmente puede destacarse cuándo el usuario está "en verde" vs "en rojo" del mes).

Encima del gráfico, la sección SHALL mostrar un navegador mensual `◀ MES AÑO ▶` con el nombre del mes seleccionado. Las flechas SHALL permitir navegar hasta 12 meses hacia atrás desde el mes actual. La flecha derecha SHALL deshabilitarse cuando el mes seleccionado es el actual (no se navega hacia el futuro). El mes actual SHALL ser el seleccionado por default al montar la tarjeta.

La tarjeta SHALL ser un componente cliente que posee el mes seleccionado en **estado local**. La navegación entre meses NO SHALL provocar una navegación de ruta: cambiar de mes NO desmonta/remonta la tarjeta. El mes seleccionado NO se persiste; al volver a montar, la tarjeta SHALL abrir en el mes actual.

Al navegar a un mes, la tarjeta SHALL obtener los datos del lado del cliente (vía TanStack Query) y SHALL mostrar un **estado de carga propio**: un **skeleton shape-matched** (`MonthBalanceSkeleton`) que reemplaza únicamente el área del gráfico y del footer (balance, ingresos, gastos), manteniendo visibles e interactivos el título de la sección y el navegador mensual. El skeleton SHALL anticipar el bloque del gráfico (rectángulo con la altura del chart real) y el footer (mini-bloques para balance final + ingresos/gastos).

Si el fetch de un mes falla, la tarjeta SHALL mostrar un **estado de error compacto** en el área del gráfico + footer, con opción de reintentar, manteniendo visibles el título y el navegador mensual.

En los estados de carga y de error, el alto y el ancho de la tarjeta SHALL permanecer constantes respecto del estado con datos (sin layout shift).

Debajo del gráfico, la sección SHALL mostrar el balance final del mes seleccionado (positivo o negativo, con signo y color), y los totales de ingresos y gastos del mes en una línea pequeña.

El gráfico SHALL considerar solo transacciones con estado `confirmed` (es decir: no `pending` de tarjeta). En la práctica esto significa: ingresos en cash/bank, gastos en cash/bank, y pagos de resúmenes (que son gastos en cash/bank). Consumos en tarjeta `pending` y cuotas `pending` NO entran al gráfico.

El cálculo SHALL usar exclusivamente la moneda ARS. El gráfico NO renderiza datos en USD ni hace conversiones.

#### Scenario: Mes con sueldo a mitad de mes muestra subida brusca (mobile)

- **WHEN** el mes seleccionado es mayo 2026 y el usuario tuvo un ingreso de $ 850.000 el día 15 y gastos repartidos durante el mes
- **THEN** el gráfico muestra una pendiente decreciente desde el día 1 al 14 (gastos sin ingresos), un salto vertical hacia arriba el día 15 (sueldo), y una pendiente suavemente decreciente desde el 15 hasta fin de mes

#### Scenario: Navegar al mes anterior recarga los datos sin remontar la pantalla (mobile)

- **WHEN** el usuario en mayo 2026 toca la flecha izquierda
- **THEN** la tarjeta obtiene y muestra los datos de abril 2026
- **AND** la flecha derecha se habilita (ya no estamos en el mes actual)
- **AND** el resto de la pantalla (Hero, "Lo que viene") no se vuelve a renderizar

#### Scenario: El estado de carga reemplaza solo el gráfico y el footer (mobile)

- **WHEN** el usuario navega a un mes cuyos datos aún no están disponibles y el fetch está en curso
- **THEN** el área del gráfico y del footer muestra el `MonthBalanceSkeleton` (bloque grande del chart + mini-bloques del footer)
- **AND** el título de la sección y el navegador mensual siguen visibles e interactivos
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos
- **AND** NO se muestra un spinner centrado en esa área

#### Scenario: El estado de error permite reintentar sin perder el navegador (mobile)

- **WHEN** el fetch de los datos del mes seleccionado falla
- **THEN** el área del gráfico y del footer muestra un mensaje de error compacto con una acción de reintentar
- **AND** el título de la sección y el navegador mensual siguen visibles
- **AND** al reintentar, la tarjeta vuelve a obtener los datos del mismo mes seleccionado
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: La flecha derecha está deshabilitada en el mes actual (mobile)

- **WHEN** el usuario está viendo el mes actual
- **THEN** la flecha derecha del navegador está deshabilitada visual y funcionalmente

#### Scenario: Límite de 12 meses hacia atrás (mobile)

- **WHEN** el usuario navegó 12 meses hacia atrás y toca la flecha izquierda
- **THEN** la flecha izquierda está deshabilitada y la navegación no avanza

#### Scenario: Consumo en tarjeta no impacta el gráfico (mobile)

- **WHEN** el usuario registra un consumo de $ 30.000 en su tarjeta el día 10 del mes
- **THEN** el gráfico del mes actual NO refleja ese consumo como bajada
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí aparece como bajada en la fecha del pago

#### Scenario: Mes sin movimientos confirmados muestra línea plana (mobile)

- **WHEN** el mes seleccionado no tiene ningún ingreso ni gasto confirmado
- **THEN** el gráfico muestra una línea horizontal sobre el eje X (acumulado = 0)
- **AND** debajo muestra "Ingresos $ 0 · Gastos $ 0" y "Balance + $ 0"

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar todas sus secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada sección SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en una sección NO SHALL bloquear ni romper el renderizado de las demás. En web, esta independencia SHALL implementarse envolviendo cada sección en su propio `<Suspense>` con su **skeleton shape-matched** correspondiente como `fallback` (`HeroSkeleton` para la fila superior completa, `MonthBalanceSkeleton`, `SpendingSkeleton`), y haciendo que cada sección fetchee su data en un container async dedicado que degrade a un estado de error compacto si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varias secciones bloqueando el streaming entre ellas.

Cada sección SHALL declarar un `min-height` sobre el root del componente real y sobre su **skeleton** correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando una sección pasa de su skeleton al contenido real. (En mobile, la card de bienvenida conserva su excepción documentada en el requirement del shell mobile; en web ya no existe.)

Los skeletons SHALL anticipar visualmente la anatomía de la sección (ver requirement "Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched") y SHALL declarar un `aria-label` localizado específico de la sección reusando las keys `dashboard.hero_loading`, `dashboard.month.loading`, `dashboard.spending.loading` (web) y además `dashboard.upcoming.loading` (mobile). NO SHALL reusarse un mensaje genérico para todas las secciones.

#### Scenario: Usuario nuevo sin transacciones ve dashboard funcional (web)

- **WHEN** un usuario recién creado por el onboarding carga `/dashboard` web sin haber registrado ningún movimiento ni consumo
- **THEN** el Hero muestra `$ 0,00` y `u$s 0,00`
- **AND** "Dónde está" lista sus cuentas default con saldo cero atenuado
- **AND** "Balance del mes" muestra ceros con barras vacías
- **AND** "En qué se fue" muestra su estado vacío neutral

#### Scenario: Falla parcial en una query no rompe la pantalla (web)

- **WHEN** la query `getMonthCategoryBreakdown` falla (timeout, error de DB)
- **THEN** la sección "En qué se fue" renderiza un estado de error compacto
- **AND** las otras secciones renderizan normalmente

#### Scenario: Cada sección stream-ea apenas resuelve su query (web)

- **WHEN** un usuario carga `/dashboard` y la query de `getDashboardHero` resuelve antes que la de `getMonthBalanceSeries`
- **THEN** la fila superior pinta sus cards en cuanto su query resuelve, sin esperar a "Balance del mes"
- **AND** "Balance del mes" sigue mostrando su `MonthBalanceSkeleton` hasta que su propia query resuelva
- **AND** ambas secciones están envueltas en `<Suspense>` independientes

#### Scenario: El skeleton ocupa el mismo alto que el contenido (web)

- **WHEN** una sección del dashboard está mostrando su skeleton de loading y luego su query resuelve
- **THEN** el hueco que ocupaba el skeleton es el mismo que ocupa el contenido real (min-height matcheado)
- **AND** las secciones que ya estaban pintadas debajo no se desplazan verticalmente

#### Scenario: Cada skeleton declara un aria-label específico de la sección (web)

- **WHEN** un usuario con lector de pantalla carga `/dashboard` y todavía no resolvieron las queries
- **THEN** el `HeroSkeleton` declara `aria-busy="true"` y un `aria-label` derivado de `dashboard.hero_loading`
- **AND** el `MonthBalanceSkeleton` declara un `aria-label` derivado de `dashboard.month.loading`
- **AND** el `SpendingSkeleton` declara un `aria-label` derivado de `dashboard.spending.loading`
- **AND** NO se reusa un label genérico tipo "Cargando…" sin contexto

---

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada sección del dashboard que tiene estado de carga propio SHALL renderizar durante ese estado un **skeleton shell shape-matched**: una composición de bloques rectangulares con animación pulse cuyo tamaño y disposición anticipan la anatomía del contenido real que va a aterrizar. NO SHALL renderizar un mensaje textual genérico ("Cargando…") ni un spinner centrado como visual de loading.

**Naming y archivos.** Cada sección con loading state SHALL tener un componente skeleton con el sufijo `Skeleton`:

- web: `HeroSkeleton` (anticipa la fila superior completa: card oscura + card de cuentas), `MonthBalanceSkeleton` (anticipa neto + dos filas con barra + strip USD), `SpendingSkeleton` (anticipa dona + filas de leyenda) en `apps/web/app/(app)/dashboard/_components/`
- mobile: `HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton` (anticipa el chart + footer), `CategoryTeaserSkeleton` en `apps/mobile/components/dashboard/`

**Tecnología por plataforma.**

- **Web** SHALL implementar los bloques con `<div className="bg-muted animate-pulse rounded-…">` inline, siguiendo el patrón ya establecido por `apps/web/lib/transactions/components/movement-list-skeleton.tsx`. NO SHALL introducirse un componente `<Skeleton/>` wrapper.
- **Mobile** SHALL seguir componiendo el primitivo `SkeletonBlock` de `apps/mobile/components/ui/` (encapsula la animación pulse sobre `react-native-reanimated` y respeta `useReducedMotion()`: con `prefers-reduced-motion` el bloque mantiene una opacidad estática ~0.7 sin animación).

**Shape source.** Los tamaños y disposición de los bloques SHALL derivarse del DOM real de cada sección en su estado con datos (no de design refs externos). Cada elemento visible del contenido real SHALL tener un bloque skeleton correspondiente.

**Accesibilidad.** El nodo raíz de cada skeleton SHALL declarar:

- web: `aria-busy="true"` y `aria-label={t('dashboard.<sección>_loading')}` o equivalente.
- mobile: `accessibilityState={{ busy: true }}` y `accessibilityLabel={t('dashboard.<sección>_loading')}` o equivalente.

Los bloques internos NO SHALL declarar atributos de accesibilidad (heredan al wrapper, son decorativos).

**Reuso de i18n.** Las keys `dashboard.hero_loading`, `dashboard.month.loading`, `dashboard.spending.loading` (web y mobile) y `dashboard.upcoming.loading` (mobile) SHALL reusarse como `aria-label`/`accessibilityLabel` de los skeletons. Sus textos PUEDEN ajustarse para sonar correctos como label de accesibilidad sin renombrar la key.

**Color del bloque.** Web SHALL usar el token `bg-muted`. Mobile SHALL usar el token semánticamente equivalente del theme mobile. NO SHALL introducirse un token de skeleton nuevo en este change.

#### Scenario: El skeleton de la fila superior anticipa las dos cards (web)

- **WHEN** un usuario carga `/dashboard` web y la query del Hero aún no resuelve
- **THEN** la fila superior muestra dos cards skeleton lado a lado (≥`lg`): la izquierda con un bloque grande (importe ARS headline) + bloque chico (línea USD), la derecha con filas pulsantes (cuentas)
- **AND** los bloques tienen animación `animate-pulse`
- **AND** NO se muestra un mensaje "Cargando…" en texto, ni un spinner centrado

#### Scenario: El skeleton de "Balance del mes" web anticipa el neto y las barras (web)

- **WHEN** la data del mes seleccionado aún no resuelve (primer load o navegación de mes)
- **THEN** el cuerpo de la card muestra un bloque grande (neto) + dos filas con bloques de label/monto y un bloque tipo barra + un bloque para el strip USD
- **AND** el título de la sección permanece visible (y el navegador mensual del header sigue interactivo)

#### Scenario: El skeleton de "En qué se fue" anticipa la dona y la leyenda (web)

- **WHEN** la query `getMonthCategoryBreakdown` aún no resuelve
- **THEN** el cuerpo de la card muestra un bloque circular (dona) + ~5 filas pulsantes con dot, label, monto y porcentaje
- **AND** el título de la card permanece visible

#### Scenario: El skeleton del Hero mobile anticipa las dos líneas de moneda (mobile)

- **WHEN** un usuario carga el dashboard mobile y la query del Hero aún no resuelve
- **THEN** el área donde van los importes muestra dos bloques pulsantes verticales: uno grande (importe ARS) y otro más chico debajo (importe USD)
- **AND** los bloques usan `SkeletonBlock` con opacity loop

#### Scenario: El skeleton de "Lo que viene" anticipa filas de eventos (mobile)

- **WHEN** un usuario carga el dashboard mobile y la query de `getUpcomingFortnight` aún no resuelve
- **THEN** el área de eventos muestra varios bloques pulsantes en filas, cada una con un bloque chico a la izquierda (fecha) y dos bloques de texto (label + monto)
- **AND** la cantidad de filas-skeleton es estable (no depende de la data)

#### Scenario: Web usa el skeleton como Suspense fallback (web)

- **WHEN** se inspecciona `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`
- **THEN** cada `<Suspense>` de las secciones usa el skeleton respectivo como `fallback={...}`
- **AND** NO se usa `<SectionFallback message=…/>` como fallback de esos `<Suspense>`

#### Scenario: Mobile usa el skeleton dentro del swap region existente (mobile)

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx` (u otra sección con swap region)
- **THEN** el branch de loading renderiza el skeleton correspondiente dentro del swap region de alto mínimo estable
- **AND** el chrome de la card (border, padding, label/título) NO se mueve a un skeleton

#### Scenario: El skeleton respeta `prefers-reduced-motion` (mobile)

- **WHEN** un usuario tiene activado "Reduce Motion" en el SO y carga el dashboard mobile
- **THEN** los bloques `SkeletonBlock` se renderizan con una opacidad estática (~0.7) sin animación de pulse
- **AND** el `accessibilityState.busy` sigue declarado

#### Scenario: Cada skeleton es accesible para lectores de pantalla (web + mobile)

- **WHEN** un usuario con lector de pantalla aterriza en el dashboard mientras una sección está en loading
- **THEN** el lector anuncia el label localizado de la sección ("Cargando tu disponible…" o equivalente como label de accesibilidad)
- **AND** los bloques individuales del skeleton no son leídos uno por uno

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

La convención de naming espejo (mismo export PascalCase en ambas plataformas, props públicas coincidentes cuando es técnicamente posible) SHALL aplicar a los componentes del dashboard que existen en **ambas** plataformas: `HeroSection`, `HeroSkeleton`, `MonthBalanceSection`, `MonthBalanceSkeleton`, `MonthNavigator`, `MaskedAmount`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardHeader`.

Tras el rediseño web (`redesign-dashboard-home`), un subconjunto de componentes existe en una sola plataforma hasta que la paridad mobile del rediseño se aborde como trabajo propio:

- **Solo web**: `AccountsCard` ("Dónde está"), `SpendingSection`/`SpendingDonut`/`SpendingSkeleton` ("En qué se fue"), `DashboardMonthProvider`.
- **Solo mobile**: `UpcomingFortnightSection`, `UpcomingFortnightSkeleton`, `MonthBalanceChart`, `CategoryTeaser`, `CategoryTeaserSkeleton`, `WelcomeFirstMoveCard`.

Estos componentes single-platform SHALL conservar el naming PascalCase de la convención para que la futura paridad los espeje sin renombres. El carrusel de tarjetas (`CreditCardCarousel`, `CreditCardItem`) ya no es parte del dashboard: vive en el módulo cards (`apps/mobile/components/cards/`) y lo consume la pantalla `/cards`.

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `FlatList`, `react-native-svg`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. Los skeletons mobile SHALL componer el primitivo `SkeletonBlock` (de `apps/mobile/components/ui/`) en vez de re-implementar la animación pulse en cada caso. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

`SectionFallback` ya NO forma parte del set de componentes espejados del **dashboard** — los containers del dashboard (web y mobile) ya no lo importan, ni para loading ni para error states. El archivo en sí permanece en ambas plataformas (`apps/web/components/ui/section-fallback.tsx`, `apps/mobile/components/dashboard/SectionFallback.tsx`) porque sigue siendo utility compartida por otras rutas (`accounts`, `cards`); su migración eventual a skeletons queda fuera del scope de este change.

#### Scenario: Mismo nombre de componente entre web y mobile para el set compartido

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los componentes presentes en ambas plataformas exportan el mismo nombre PascalCase
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Componente mobile usa primitivas RN

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx`
- **THEN** el componente usa `View`/`Text`/`Pressable` y NO usa elementos del DOM como `div`, `span`, ni `<Link>` de Next
- **AND** la navegación usa `useRouter()` de `expo-router`

#### Scenario: Skeletons mobile componen el primitivo `SkeletonBlock`

- **WHEN** se inspecciona cualquiera de los skeletons mobile (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`)
- **THEN** los bloques pulsantes se renderizan vía `<SkeletonBlock className="…"/>` importado de `apps/mobile/components/ui/SkeletonBlock`
- **AND** ningún skeleton mobile usa `Animated.View` ni `useSharedValue` directamente (la animación está encapsulada en el primitivo)

#### Scenario: Los componentes del dashboard no importan `SectionFallback`

- **WHEN** se busca `SectionFallback` con grep dentro de los directorios del dashboard (`apps/web/app/(app)/dashboard/` y `apps/mobile/components/dashboard/` + `apps/mobile/app/(app)/dashboard.tsx`)
- **THEN** ningún archivo del dashboard lo importa, ni como `<Suspense>` fallback ni como error state
- **AND** los archivos `apps/web/components/ui/section-fallback.tsx` y `apps/mobile/components/dashboard/SectionFallback.tsx` siguen existiendo porque otras rutas (`accounts`, `cards`) aún los consumen
