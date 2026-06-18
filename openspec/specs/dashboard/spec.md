# dashboard Specification

## Purpose

Define la pantalla `/dashboard` como landing universal post-login y post-onboarding, con la misma composición en web y en la app nativa (rediseño `redesign-dashboard-home` + paridad `dashboard-mobile-parity`): Hero "Para gastar · hoy" (card navy bimoneda) + "Dónde está" (cuentas), "Balance del mes" (neto + barras + strip USD) y "En qué se fue" (dona por categoría con toggle ARS/USD), con las dos secciones mensuales gobernadas por un selector de mes compartido en el header. Es read-only: toda interacción navega al módulo correspondiente; el resumen de tarjetas NO vive en el dashboard sino en `/cards`. El eye toggle de privacidad enmascara los importes en ambas plataformas.
## Requirements
### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

Ambas plataformas SHALL renderizar la misma composición de secciones en orden fijo: (1) Hero "Para gastar · hoy" y card "Dónde está" (fila superior en desktop web; apiladas en mobile-web y nativo), (2) "Balance del mes", (3) "En qué se fue". El dashboard NO SHALL renderizar la sección "Lo que viene" ni la card de bienvenida `WelcomeFirstMoveCard` en ninguna plataforma (eliminadas por el rediseño `redesign-dashboard-home` + `dashboard-mobile-parity`).

La sección Tarjetas NO forma parte del dashboard en ninguna plataforma; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza las tres secciones (fila superior "Para gastar"+"Dónde está", "Balance del mes", "En qué se fue") en orden fijo
- **AND** NO renderiza "Lo que viene" ni la card de bienvenida

#### Scenario: Login exitoso aterriza en dashboard

- **WHEN** un usuario con onboarding completado hace login
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Arranque con sesión activa aterriza en /dashboard renderizado (mobile)

- **WHEN** un usuario mobile con sesión válida persistida abre la app
- **THEN** la app aterriza en `(app)/dashboard` con las tres secciones del rediseño renderizadas
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

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Para lograrlo, el header y sus providers de estado (`EyeMaskProvider`, `DashboardMonthProvider`) SHALL montarse desde `apps/web/app/(app)/dashboard/layout.tsx` (Variant C del spec `route-loading-and-errors`), no desde `page.tsx`. El layout SHALL ser un Server Component async que lee las preferencias server-side necesarias para inicializar los providers (ej. `getEyeMasked()`, el mes actual vía `getTodayAR()`); el `page.tsx` SHALL ser sync para no suspender el segmento. Como el chrome vive en el layout, queda persistente entre cualquier transición de `{children}` (loading, error, navegación a hijos), garantizando el primer paint inmediato del header.

Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") aunque exista un perfil con nombre, y los controles que sí vivan en el header en el viewport activo SHALL renderizarse en estado disabled (ver sus respectivos requirements). En desktop-web esto cubre el `eye toggle`, el navegador mensual y el botón "Nuevo movimiento"; en mobile-web cubre el `eye toggle` y el navegador mensual. Cuando la query del perfil resuelve, el header SHALL actualizarse al saludo personalizado y habilitar los controles del header. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero los controles SHALL pasar a estado habilitado para no bloquear al usuario.

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

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/transactions` y navega a `/dashboard`
- **THEN** durante la transición del segmento, el header del dashboard aparece desde el primer paint del nuevo segmento (proviene de `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched (de `dashboard/loading.tsx`) mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: El header persiste durante el loading del contenido tras un redirect desde login (web)

- **WHEN** un usuario completa el login y el servidor redirige a `/dashboard`
- **AND** el `(app)/layout.tsx` resolvió su auth check (fuera del scope de este requirement)
- **THEN** el siguiente paint visible del usuario incluye el header del dashboard (desde `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched mientras las server queries del dashboard resuelven
- **AND** el usuario NO ve un spinner full-screen entre el login y el dashboard

---

### Requirement: El selector de mes del dashboard gobierna las secciones mensuales

El dashboard SHALL exponer un navegador mensual `‹ Mes Año ›` (`MonthNavigator`) cuyo estado vive en un context client-side compartido (`DashboardMonthProvider` en web; su espejo nativo en mobile), inicializado en el mes actual derivado de `getTodayAR()`. Su ubicación es específica de cada plataforma: en **web** vive en el header de la página (junto al eye toggle y "Nuevo movimiento"); en **nativo** vive dentro del header navy de la pantalla, debajo del saludo, ocupando el ancho (pill blanca sobre navy).

Cambiar el mes seleccionado SHALL actualizar **en simultáneo** las secciones "Balance del mes" y "En qué se fue". El selector NO SHALL afectar al Hero "Para gastar · hoy" ni a la card "Dónde está" (son saldo de hoy) ni a la línea "vas {neto} este mes" del header de la card "Balance del mes" (que es siempre del mes en curso).

La navegación de mes NO SHALL modificar la URL/ruta ni provocar una navegación; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual; en nativo, salir del tab y volver resetea al mes actual, mismo mecanismo de remount que el eye-mask). Las flechas SHALL permitir navegar hasta 12 meses hacia atrás; la flecha derecha SHALL deshabilitarse en el mes actual (no se navega al futuro). Cada sección mensual SHALL obtener los datos del mes no-actual client-side (web: server action vía TanStack; nativo: su hook TanStack existente) mostrando su propio estado de carga in-card; en web el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes actualiza las dos secciones mensuales

- **WHEN** el usuario en junio 2026 toca la flecha izquierda del navegador
- **THEN** "Balance del mes" y "En qué se fue" muestran los datos de mayo 2026
- **AND** "Para gastar · hoy" y "Dónde está" no cambian
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

---

### Requirement: El header del dashboard ofrece un acceso primario para registrar un movimiento (web)

En web **desktop** (viewport `≥sm`), el header del dashboard SHALL incluir un botón primario "Nuevo movimiento" (estilo `positive`/emerald) que, al activarse, **abre el drawer de creación de movimiento** sobre el dashboard (invoca `useMovementDrawer().openCreate()`), sin navegación a otra ruta. El label del botón SHALL leerse del catálogo i18n (no hardcodeado). En web **mobile** (viewport `<sm`), el botón NO SHALL renderizarse en el header: el acceso primario en ese viewport es el FAB definido en la spec de `transactions` (mobile-only en web). En la app nativa este acceso NO es parte del header del dashboard; en native el acceso primario es el FAB nativo definido en la spec de `transactions`.

Mientras el header esté en su estado de carga (ver requirement del saludo) **o el `MovementDrawerProvider` aún no esté disponible** (queries `accounts/categories/household` cargadas por `MovementDrawerLoader` aún pendientes), el botón "Nuevo movimiento" — cuando se renderice en el viewport activo — SHALL renderizarse en estado **disabled**: SHALL aparecer con su tipografía e ícono completos pero sin handler de click activo (sin envolver un `<Link>` ni equivalente navegable) y SHALL no responder a clicks. Cuando el header sale del estado de carga **y** el provider está listo, el botón SHALL pasar a su rendering normal: un `<Button>` que al click invoca `useMovementDrawer().openCreate()`.

#### Scenario: El botón abre el drawer de creación de movimiento (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` toca "Nuevo movimiento" en el header del dashboard una vez habilitado
- **THEN** se abre el drawer de creación de movimiento sobre el dashboard sin navegación
- **AND** el dashboard permanece visible detrás del scrim

#### Scenario: El label del botón es traducible

- **WHEN** un desarrollador inspecciona el botón "Nuevo movimiento"
- **THEN** su label se obtiene del catálogo i18n, sin string hardcodeado

#### Scenario: El botón se renderiza disabled mientras el header carga (desktop-web)

- **WHEN** el header del dashboard está en su estado de carga en viewport `≥sm` (query del nombre sin resolver)
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado
- **AND** no responde a clicks
- **AND** NO envuelve a un `<Link>` ni invoca el drawer (no es accionable mientras está disabled)

#### Scenario: El botón se renderiza disabled mientras el drawer no está listo (desktop-web)

- **WHEN** el header del dashboard ya cargó su saludo pero el `MovementDrawerProvider` aún no está disponible en viewport `≥sm`
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado (estado disabled estándar del componente `Button`)
- **AND** no responde a clicks (no abre el drawer ni navega a ninguna URL)
- **AND** cuando el provider resuelve, el botón pasa a habilitado

#### Scenario: El botón no se renderiza en mobile-web

- **WHEN** un usuario web en viewport `<sm` abre `/dashboard`
- **THEN** el header NO contiene el botón "Nuevo movimiento" en ningún estado (loading o habilitado)
- **AND** el acceso primario para registrar un movimiento en ese viewport es el FAB definido en la spec de `transactions`

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

#### Scenario: Toque en el Hero navega a Cuentas (mobile)

- **WHEN** el usuario toca el Hero "Para gastar · hoy" en la app nativa
- **THEN** la app navega con `useRouter().push('/accounts')` a la pantalla de cuentas
- **AND** NO dispara ninguna mutación

#### Scenario: Toque en una categoría de "En qué se fue" navega a Movimientos (mobile)

- **WHEN** el usuario toca una fila de la leyenda de "En qué se fue" en la app nativa
- **THEN** la app navega con `useRouter().push('/transactions')` a Movimientos
- **AND** NO dispara ninguna mutación

---

### Requirement: El Hero muestra el disponible total bimoneda

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor). Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

En **ambas plataformas**, el Hero SHALL renderizarse como una card oscura (navy de marca vía token — web: `surface-dark`; nativo: clase NativeWind del mirror — sin hex inline) con: eyebrow "PARA GASTAR · HOY" en uppercase, el importe ARS como titular grande con los decimales en tipografía reducida (`MaskedAmountDisplay`), la línea USD como chip "USD" + importe, y una caption al pie ("Lo que tenés disponible hoy, en pesos y dólares" vía i18n). El bloque eyebrow+importes SHALL centrarse verticalmente en el espacio sobre la caption cuando la card estira su altura. El Hero NO SHALL contener el desglose de cuentas: ese desglose vive en la card "Dónde está". Tocar el Hero navega al módulo Cuentas. Se respeta bimoneda (ARS primario, USD subordinado, sin merge entre monedas).

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

#### Scenario: El Hero es la card oscura sin desglose de cuentas

- **WHEN** el usuario carga el dashboard (web o nativo)
- **THEN** el Hero se pinta como card navy con eyebrow "PARA GASTAR · HOY", el importe ARS grande y el chip USD
- **AND** el desglose por cuenta NO está dentro del Hero (vive en la card "Dónde está")
- **AND** el color navy proviene del token de tema, no de un hex inline

---

### Requirement: La card "Dónde está" desglosa las cuentas del usuario

Junto al Hero "Para gastar · hoy", el dashboard SHALL renderizar una card "Dónde está" que desglosa dónde vive el disponible (a la derecha del Hero en desktop web; apilada debajo en mobile-web y en la app nativa). La card SHALL listar las cuentas activas `type IN ('cash','bank')` ordenadas por saldo ARS descendente (el orden que ya devuelve `getDashboardHero`), cada fila con el `AccountAvatar` chico de la cuenta + nombre + saldo ARS alineado a la derecha. Un saldo ARS de cero SHALL pintarse atenuado. La card SHALL truncar el listado a un máximo de 6 cuentas; el resto se ve en el módulo Cuentas.

Como fila final, separada del resto, la card SHALL mostrar la tenencia "En dólares": el total USD del usuario (el mismo `usd` del Hero) destacado en emerald. Esta fila representa el stock total en USD, NO un desglose por cuenta.

El header de la card SHALL incluir un link "Ver todas" → módulo Cuentas (web: `/accounts`; nativo: `router.push('/accounts')`). Los datos SHALL salir de la misma data de `getDashboardHero` que alimenta el Hero — en web vía un único container async para la fila superior; en nativo ambas cards consumen `useDashboardHero()` y TanStack dedupea por queryKey (un solo fetch). Todos los importes de la card participan del eye-mask.

#### Scenario: Cuentas ordenadas con la tenencia USD al final

- **WHEN** el usuario tiene Billetera $1.254.499, Galicia $1.200.000, Cooperativa $0 y un total USD de u$s 1.240
- **THEN** la card lista Billetera, Galicia y Cooperativa en ese orden con sus saldos ARS
- **AND** el saldo $0 de Cooperativa se pinta atenuado
- **AND** la fila final "En dólares" muestra u$s 1.240 en emerald

#### Scenario: Más de 6 cuentas se truncan

- **WHEN** el usuario tiene 9 cuentas cash/bank activas
- **THEN** la card muestra las 6 de mayor saldo ARS + la fila "En dólares"
- **AND** el link "Ver todas" navega al módulo Cuentas donde está el listado completo

#### Scenario: Una sola llamada alimenta la fila superior (web)

- **WHEN** se inspecciona el container de la fila superior del dashboard web
- **THEN** un único container async llama a `getDashboardHero` y renderiza ambas cards (Hero + "Dónde está") con esa data
- **AND** NO hay una segunda llamada a `getDashboardHero` para la card de cuentas

#### Scenario: Un solo fetch alimenta ambas cards (mobile)

- **WHEN** la pantalla dashboard nativa monta Hero y "Dónde está"
- **THEN** ambos componentes consumen `useDashboardHero()` con la misma queryKey
- **AND** TanStack ejecuta un único fetch para los dos

---

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard (en nativo, salir del tab y volver lo resetea vía remount del provider).

En **ambas plataformas**, el toggle SHALL aplicar al menos a: Hero "Para gastar · hoy" (importes ARS y USD), card "Dónde está" (saldos por cuenta y fila "En dólares"), "Balance del mes" (neto, ingresos, gastos, la línea "Ajustes" cuando se muestre, strip USD y la línea "vas {neto} este mes" del header de la card) y "En qué se fue" (montos de la leyenda y total del centro de la dona — los porcentajes NO se enmascaran).

En **web**, el `eye toggle` SHALL permanecer montado y visible mientras el header esté en su estado de carga (query del nombre sin resolver), pero SHALL renderizarse **disabled** durante ese estado: no SHALL responder a clicks ni modificar el estado del `EyeMaskProvider`. Cuando el header sale del estado de carga, el toggle SHALL pasar a su comportamiento normal. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas, categorías y porcentajes permanecen visibles

#### Scenario: El eye-mask cubre la línea de Ajustes cuando se muestra

- **WHEN** el mes seleccionado tiene ajustes (la fila "Ajustes" está visible) y el usuario activa el eye toggle
- **THEN** el monto neto de "Ajustes" también se enmascara junto al resto de los importes

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` (web) o cambia de tab y vuelve (nativo)
- **THEN** los importes están visibles nuevamente (estado no persistido)

#### Scenario: El toggle está montado pero disabled mientras el header carga (web)

- **WHEN** el header del dashboard está en su estado de carga
- **THEN** el `eye toggle` aparece en su posición habitual con el ícono visible
- **AND** está deshabilitado: clickearlo NO cambia el estado del `EyeMaskProvider`

#### Scenario: El eye toggle web está implementado sobre el UI Button

- **WHEN** un desarrollador inspecciona el componente `EyeMaskToggle` en `apps/web`
- **THEN** delega el render en el UI `Button` con `variant="ghost"` y `size="icon"`
- **AND** NO es un `<button>` artesanal con clases tailwind ad-hoc

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

La sección "Balance del mes" SHALL mostrar, para el mes seleccionado en el navegador compartido: un eyebrow "BALANCE" y debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense); debajo, dos filas Ingresos y Gastos, cada una con dot de color + label + monto y una barra horizontal proporcional.

Los movimientos `type='adjustment'` (ajustes de saldo) SHALL contabilizarse en un **balde propio** separado de Ingresos y Gastos. Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a "Ingresos" (cuando es positivo) ni a "Gastos" (cuando es negativo). En consecuencia, la fila "Gastos" SHALL reflejar únicamente gasto real (`type='expense'`) y SHALL coincidir con el total de "En qué se fue" para el mismo mes y moneda (salvo el neteo de reintegros propio de esa card). El neto del mes (`finalBalance`) y el saldo acumulado SHALL seguir incluyendo el efecto de los ajustes, de modo que el neto reconcilie con el cambio del Disponible: `finalBalance = totalIncome − totalExpense + totalAdjustment`.

Cuando el mes seleccionado tenga al menos un ajuste de saldo (neto distinto de cero), la sección SHALL mostrar una fila adicional "Ajustes" con el mismo tratamiento visual que Ingresos/Gastos (dot + label + monto + barra horizontal proporcional), en un color propio (`warning`/ámbar) para distinguirla. El monto SHALL mostrarse con su signo (el neto puede ser negativo). Cuando el mes NO tenga ajustes (neto cero), la fila "Ajustes" NO SHALL renderizarse, para no ensuciar la card del usuario que nunca ajusta.

La barra de "Ajustes" SHALL compartir la escala con las barras de Ingresos/Gastos: el ancho de las tres se calcula contra el mismo `maxFlow = max(totalIncome, totalExpense, |totalAdjustment|)`, usando el valor absoluto del neto de ajustes para el ancho. Los anchos NO SHALL hardcodearse.

Debajo de la fila "Ajustes", y solo cuando esa fila se muestra, la sección SHALL renderizar un **aviso educativo** (voz Grana, texto atenuado) que comunique que los ajustes son grana que se movió sin registrar y que la meta es hacerlos desaparecer registrando esos movimientos. El texto SHALL salir del catálogo i18n (`dashboard.month.adjustment_note`), sin string hardcodeado.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya disponible (web: server-rendered; nativo: el cache de TanStack del primer load) sin fetch adicional.

Los anchos de las barras SHALL calcularse de los datos: la magnitud mayor entre Ingresos, Gastos y `|Ajustes|` ocupa el 100% del track y las otras escalan proporcionalmente (`magnitud / maxFlow`); con todas en cero, las barras quedan vacías. Los anchos NO SHALL hardcodearse. Ingresos usa el color emerald; Gastos el terracota; Ajustes el `warning`/ámbar.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda, incluyendo `totalAdjustment`). La sección NO SHALL renderizar el gráfico de línea acumulada en ninguna plataforma: `MonthBalanceChart` no existe ni en `apps/web` ni en `apps/mobile` (la serie diaria sigue disponible en el package para vistas futuras). Todos los importes participan del eye-mask. El cálculo considera solo transacciones confirmadas (los consumos `pending` de tarjeta no entran), igual que siempre.

#### Scenario: Neto positivo con barras proporcionales

- **WHEN** el mes seleccionado tiene ingresos ARS $800.000 y gastos ARS $295.500,25 y sin ajustes de saldo
- **THEN** el neto muestra `+$504.499,75` en emerald
- **AND** la barra de Ingresos ocupa el 100% del track y la de Gastos ~36,9%
- **AND** la fila "Ajustes" NO se renderiza
- **AND** el strip USD muestra el neto USD del mes con su detalle de ingresos y gastos

#### Scenario: Gastos mayores que ingresos invierten la proporción

- **WHEN** el mes tiene ingresos ARS $100.000 y gastos ARS $250.000
- **THEN** el neto muestra `−$150.000` en tono expense
- **AND** la barra de Gastos ocupa el 100% y la de Ingresos el 40%

#### Scenario: Los ajustes no inflan Ingresos ni Gastos y se muestran en su balde

- **WHEN** el mes seleccionado tiene gasto real ARS $254.461,25, ingreso real ARS $7.349.361,79, ajustes que restan saldo por ARS $3.152.222,01 y ajustes que suman saldo por ARS $615.610,22
- **THEN** la fila "Gastos" muestra `$254.461,25` (solo gasto real, sin los ajustes)
- **AND** la fila "Ingresos" muestra `$7.349.361,79` (solo ingreso real)
- **AND** la fila "Ajustes" se muestra con el neto `−$2.536.611,79` y una barra ámbar proporcional (su ancho contra `maxFlow = $7.349.361,79`)
- **AND** debajo de las barras aparece el aviso educativo (voz Grana) desde `dashboard.month.adjustment_note`
- **AND** el neto del mes es `$4.558.288,75` (= ingresos − gastos + ajustes), idéntico al cambio del Disponible

#### Scenario: El total de Gastos coincide con "En qué se fue"

- **WHEN** el mes tiene gasto real categorizado y además ajustes de saldo
- **THEN** el "Gastos" de "Balance del mes" refleja solo el gasto real
- **AND** coincide con el total de "En qué se fue" del mismo mes y moneda (modulo el neteo de reintegros de esa card)

#### Scenario: Mes sin movimientos muestra ceros

- **WHEN** el mes seleccionado no tiene movimientos confirmados
- **THEN** el neto muestra `$0` y ambas barras quedan vacías
- **AND** la fila "Ajustes" NO se renderiza
- **AND** el strip USD muestra `US$0` con ingresos y gastos en cero

#### Scenario: El header de la card ancla el neto del mes en curso

- **WHEN** el usuario va `+$504.499,75` en el mes en curso y navega el selector a un mes anterior
- **THEN** el header de la card sigue mostrando "vas +$504.499,75 este mes" (mes en curso) mientras el cuerpo muestra el mes navegado
- **AND** activar el eye-mask enmascara ese monto

#### Scenario: Consumo en tarjeta no impacta el balance

- **WHEN** el usuario registra un consumo de $30.000 en su tarjeta en el mes
- **THEN** los totales del mes NO reflejan ese consumo
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí entra como gasto en la fecha del pago

#### Scenario: El chart de línea no existe en ninguna app

- **WHEN** se busca `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps

### Requirement: La sección "En qué se fue" muestra el desglose de gastos por categoría con dona y toggle de moneda

El dashboard SHALL renderizar como tercera sección "En qué se fue": una dona SVG con los gastos del mes seleccionado por categoría + una leyenda, con un control `Segmented` ARS/USD (default ARS) en el header de la card. Aplica idéntico en web y en la app nativa.

- Los datos SHALL salir de `getMonthCategoryBreakdown` procesados con `buildCategorySlices` de `@grana/money-logic` con `topN: 5` y bucket "Otros" — la matemática del neto por categoría no se duplica.
- Los tramos de la dona SHALL derivarse de los porcentajes calculados; NO SHALL hardcodearse. La dona SHALL implementarse como SVG de strokes circulares (web: SVG del DOM; nativo: `react-native-svg`), con el centro mostrando el label "GASTOS" y el total del mes en la moneda activa.
- Cada tramo/fila SHALL usar el color de la categoría en DB (`slice.color`), con fallback posicional a la paleta `cat-*` de `@grana/ui-tokens` (web: `var(--cat-*)`; nativo: valores del mirror `tokens.cjs`) — la misma categoría se ve del mismo color que en el desglose de Movimientos. Sin hex inline en componentes.
- La leyenda SHALL mostrar por categoría: dot de color + nombre traducido (el sentinel uncategorized usa su label i18n) + monto + porcentaje. Cada fila SHALL linkear al desglose completo en Movimientos (web: `/transactions`; nativo: `router.push('/transactions')`). La preselección de categoría/mes/moneda vía URL NO existe: los filtros de Movimientos viven en estado React por diseño.
- El toggle ARS/USD SHALL alternar el desglose entre monedas sin refetch (el breakdown ya trae ambas) y sin tocar las otras secciones.
- El header de la card SHALL incluir un link "Ver desglose" al desglose completo en Movimientos.
- Si el mes no tiene gastos en la moneda activa, la card SHALL mostrar un estado vacío neutral; la card NO SHALL desaparecer del layout.
- Los montos (leyenda y centro de la dona) participan del eye-mask; los porcentajes no se enmascaran.

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

- **WHEN** el usuario toca la fila "Comida" de la leyenda
- **THEN** navega a Movimientos, que abre con el desglose completo del mes
- **AND** NO se ejecuta ninguna mutación

#### Scenario: "Ver desglose" navega al desglose completo

- **WHEN** el usuario toca "Ver desglose" en el header de la card
- **THEN** navega a Movimientos, que abre con el desglose completo del mes
- **AND** NO se ejecuta ninguna mutación

#### Scenario: La dona nativa usa react-native-svg sin hex inline (mobile)

- **WHEN** se inspecciona el componente `SpendingDonut` nativo
- **THEN** dibuja los tramos con `<Circle strokeDasharray strokeDashoffset>` de `react-native-svg`
- **AND** los colores de fallback provienen del mirror de tokens (`@grana/ui-tokens/tokens`), sin literales hex en el componente

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar todas sus secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada sección SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en una sección NO SHALL bloquear ni romper el renderizado de las demás. En web, esta independencia SHALL implementarse envolviendo cada sección en su propio `<Suspense>` con su **skeleton shape-matched** correspondiente como `fallback` (`HeroSkeleton` para la fila superior completa, `MonthBalanceSkeleton`, `SpendingSkeleton`), y haciendo que cada sección fetchee su data en un container async dedicado que degrade a un estado de error compacto si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varias secciones bloqueando el streaming entre ellas. En nativo, cada sección posee su query TanStack y su swap region de alto estable (ver requirement del shell mobile).

Cada sección SHALL declarar un `min-height` sobre el root del componente real y sobre su **skeleton** correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando una sección pasa de su skeleton al contenido real.

Los skeletons SHALL anticipar visualmente la anatomía de la sección (ver requirement "Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched") y SHALL declarar un label de accesibilidad localizado específico de la sección reusando las keys `dashboard.hero_loading`, `dashboard.month.loading`, `dashboard.spending.loading`. NO SHALL reusarse un mensaje genérico para todas las secciones.

#### Scenario: Usuario nuevo sin transacciones ve dashboard funcional

- **WHEN** un usuario recién creado por el onboarding carga el dashboard sin haber registrado ningún movimiento ni consumo
- **THEN** el Hero muestra `$ 0,00` y `u$s 0,00`
- **AND** "Dónde está" lista sus cuentas default con saldo cero atenuado
- **AND** "Balance del mes" muestra ceros con barras vacías
- **AND** "En qué se fue" muestra su estado vacío neutral

#### Scenario: Falla parcial en una query no rompe la pantalla

- **WHEN** la query `getMonthCategoryBreakdown` falla (timeout, error de DB)
- **THEN** la sección "En qué se fue" renderiza un estado de error compacto con reintento
- **AND** las otras secciones renderizan normalmente

#### Scenario: Cada sección stream-ea apenas resuelve su query (web)

- **WHEN** un usuario carga `/dashboard` y la query de `getDashboardHero` resuelve antes que la de `getMonthBalanceSeries`
- **THEN** la fila superior pinta sus cards en cuanto su query resuelve, sin esperar a "Balance del mes"
- **AND** "Balance del mes" sigue mostrando su `MonthBalanceSkeleton` hasta que su propia query resuelva
- **AND** ambas secciones están envueltas en `<Suspense>` independientes

#### Scenario: El skeleton ocupa el mismo alto que el contenido

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

### Requirement: Las queries y agregaciones del dashboard viven en un package compartido

Las queries de lectura del dashboard (`getDashboardHero`, `getMonthBalanceSeries`, `getMonthCategoryBreakdown`) y las funciones puras de agregación (`aggregateHero`, `buildMonthBalanceSeries`) SHALL vivir en `packages/dashboard/` bajo el nombre `@grana/dashboard`. El package SHALL exponer su `src/index.ts` sin paso de build, siguiendo la convención del monorepo. El package SHALL ser RN-compatible: NO depende de `react`, `next`, APIs del DOM, ni APIs de Node específicas.

`getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight` y los tipos `Upcoming*` fueron retirados del package por `dashboard-mobile-parity`: la sección "Lo que viene" y la welcome card no existen en ninguna plataforma y el package NO SHALL exportar código sin consumidores (recuperable de git si una vista futura los retoma).

Todas las queries SHALL recibir el cliente de Supabase por parámetro (client-injected), de modo que cada plataforma inyecte el suyo (server client en web, client mobile en mobile). En particular, `getMonthCategoryBreakdown(supabase, month)` SHALL netear los reintegros recibidos contra la categoría derivada de su gasto de origen y respetar el invariante "Off-ledger credit cards", reusando la matemática pura de `@grana/money-logic` (`computeCategoryNet`, `buildCategorySlices`); el package NO SHALL duplicar esa matemática.

Ambas apps (web y mobile) SHALL consumir esas queries y tipos desde `@grana/dashboard`. La app web NO SHALL retener copias locales de esos módulos. El `getMonthSubcategoryBreakdown` (drill de subcategorías), usado solo por el desglose completo, PUEDE permanecer fuera del package hasta que el desglose completo aterrice en mobile.

#### Scenario: Web importa queries desde el package

- **WHEN** un componente del dashboard web necesita los saldos del Hero
- **THEN** el componente importa `getDashboardHero` desde `@grana/dashboard`
- **AND** NO importa desde `@/lib/dashboard/queries`

#### Scenario: Mobile importa queries desde el mismo package

- **WHEN** la pantalla del dashboard mobile necesita los saldos del Hero
- **THEN** el componente importa `getDashboardHero` desde `@grana/dashboard`
- **AND** la build de Metro resuelve el módulo sin errores

#### Scenario: El package no rompe la build de mobile por dependencias DOM

- **WHEN** se ejecuta `pnpm --filter mobile typecheck` y un build de Metro tras agregar un import desde `@grana/dashboard`
- **THEN** ningún archivo del package referencia APIs del DOM ni de Node específicas
- **AND** la build no reporta `Unable to resolve module` ni errores de tipo

#### Scenario: El package no exporta las queries retiradas

- **WHEN** se inspecciona `packages/dashboard/src/index.ts`
- **THEN** NO exporta `getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight` ni tipos `Upcoming*`
- **AND** `pnpm --filter web typecheck` y `pnpm --filter mobile typecheck` pasan (ningún consumidor los importaba)

#### Scenario: El breakdown por categoría se consume compartido desde ambas plataformas

- **WHEN** "En qué se fue" necesita el breakdown del mes (web o mobile)
- **THEN** obtiene los datos vía `getMonthCategoryBreakdown(supabase, month)` desde `@grana/dashboard`
- **AND** ambas plataformas obtienen el mismo neto por categoría ante los mismos datos

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

Los componentes del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase: `HeroSection`, `HeroSkeleton`, `AccountsCard`, `AccountsCardSkeleton` (mobile; en web la fila superior comparte el `HeroSkeleton`), `MonthBalanceSection`, `MonthBalanceSkeleton`, `SpendingSection`, `SpendingDonut`, `SpendingSkeleton`, `MonthNavigator`, `MaskedAmount`, `MaskedAmountDisplay`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardMonthProvider`, `useDashboardMonth`, `DashboardHeader`. Las props públicas SHALL coincidir cuando es técnicamente posible. Tras `dashboard-mobile-parity` no quedan componentes del dashboard single-platform; los componentes del diseño viejo (`UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser`, `MonthBalanceChart` y sus skeletons) no existen en ninguna plataforma.

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `react-native-svg`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. Los skeletons mobile SHALL componer el primitivo `SkeletonBlock` (de `apps/mobile/components/ui/`) en vez de re-implementar la animación pulse en cada caso. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

`SectionFallback` ya NO forma parte del set de componentes espejados del **dashboard** — los containers del dashboard (web y mobile) no lo importan, ni para loading ni para error states. El archivo en sí permanece en ambas plataformas (`apps/web/components/ui/section-fallback.tsx`, `apps/mobile/components/dashboard/SectionFallback.tsx`) porque sigue siendo utility compartida por otras rutas (`accounts`, `cards`); su migración eventual a skeletons queda fuera del scope de este change.

#### Scenario: Mismo nombre de componente entre web y mobile

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los componentes exportan el mismo nombre PascalCase en ambas plataformas
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Componente mobile usa primitivas RN

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx`
- **THEN** el componente usa `View`/`Text`/`Pressable` y NO usa elementos del DOM como `div`, `span`, ni `<Link>` de Next
- **AND** la navegación usa `useRouter()` de `expo-router`

#### Scenario: Skeletons mobile componen el primitivo `SkeletonBlock`

- **WHEN** se inspecciona cualquiera de los skeletons mobile del dashboard
- **THEN** los bloques pulsantes se renderizan vía `<SkeletonBlock className="…"/>` importado de `apps/mobile/components/ui/SkeletonBlock`
- **AND** ningún skeleton mobile usa `Animated.View` ni `useSharedValue` directamente (la animación está encapsulada en el primitivo)

#### Scenario: Los componentes del diseño viejo no existen en ninguna plataforma

- **WHEN** se busca `UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser` o `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** ningún archivo los define ni los importa

---

### Requirement: El dashboard nativo pinta el header y la status bar con el navy de marca (mobile)

En la app nativa, el header del dashboard (que contiene el saludo y el `eye toggle`) y la status bar SHALL pintarse con el navy de marca (`--navy` / `#0B1A2B`) leído desde el mirror de tokens, sin hex hardcodeado, y la status bar SHALL usar estilo `light`. El header navy SHALL respetar el safe-area top del dispositivo.

#### Scenario: Header navy con status bar light

- **WHEN** un usuario abre el dashboard en la app nativa
- **THEN** el header del dashboard se pinta con el navy de marca
- **AND** la status bar usa estilo light (íconos/hora en claro)
- **AND** el header respeta el safe-area top

#### Scenario: El color navy no está hardcodeado

- **WHEN** un desarrollador inspecciona el componente del header nativo
- **THEN** el color proviene del mirror de tokens, no de un literal hex

---

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las secciones del rediseño en orden vertical (Hero "Para gastar · hoy" → "Dónde está" → "Balance del mes" → "En qué se fue") envueltas en `EyeMaskProvider` y el provider de mes (`DashboardMonthProvider` nativo). La pantalla SHALL ser un **shell**: monta el header y coloca las secciones, pero NO SHALL orquestar las queries de las secciones ni decidir su render en función de `data`/`error` desde el padre. Cada sección SHALL poseer su propia query (vía TanStack Query) y manejar su propio loading/error in-card.

La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard. SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy", calculado una vez en el shell.

**Shell visible desde el primer paint.** La pantalla NO SHALL bloquear el render con un spinner a pantalla completa que espere a que resuelvan las queries. El header (saludo + fecha + navegador mensual + `eye toggle`) y el frame scrolleable SHALL renderizarse desde el primer paint, antes de que cualquier query resuelva. El saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") hasta que la query del nombre del perfil resuelva, momento en el que SHALL actualizarse al saludo personalizado; si esa query falla, el saludo SHALL permanecer en el fallback anon sin bloquear la pantalla. La fecha del header NO SHALL depender de ninguna query: SHALL derivarse de `getTodayAR()` y mantenerse estable.

**Carga independiente por sección, sin layout shift.** Cada sección SHALL renderizar su chrome (título/label de card) de forma persistente, y SHALL delegar únicamente su región de datos a un intercambio entre tres estados: carga (**skeleton shape-matched**), error (mensaje localizado + acción de reintentar) y datos. Esa región SHALL declarar un alto mínimo estable de modo que el alto de la sección NO cambie entre los estados (sin layout shift). Una query lenta o fallida en una sección NO SHALL bloquear ni desplazar a las demás. El skeleton SHALL vivir **dentro** de la swap region, NO SHALL reemplazar el chrome de la card.

**Pull-to-refresh.** El `RefreshControl` de la pantalla SHALL ligar su estado `refreshing` al **gesto de pull**, no a objetos de query retenidos en el shell ni al conteo de queries en vuelo del prefijo `['dashboard']`. En particular, los fetches internos de una sección que comparten ese prefijo (p. ej. la query `balance-series` al navegar de mes) NO SHALL encender el `RefreshControl`. El gesto de pull SHALL invalidar las queries bajo el prefijo `['dashboard']`, y el indicador SHALL permanecer encendido mientras esos refetches del pull no terminen.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan).

#### Scenario: El shell y el header se ven desde el primer paint (mobile)

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado, antes de que resuelva cualquier query
- **THEN** el header (saludo, fecha, navegador mensual y `eye toggle`) y el frame del dashboard ya están visibles
- **AND** NO se muestra un spinner a pantalla completa que oculte header y secciones
- **AND** el saludo muestra el fallback anon ("Hola.") y la fecha de hoy correcta

#### Scenario: El nombre del perfil llega async y actualiza el saludo (mobile)

- **WHEN** la query del nombre del perfil resuelve con `full_name = "Cristian Perez"` después del primer paint
- **THEN** el saludo pasa de "Hola." a "Hola, Cristian."
- **AND** la fecha del header no cambió

#### Scenario: Las secciones cargan independientemente sin layout shift (mobile)

- **WHEN** la query de `getDashboardHero` resuelve antes que la de `getMonthBalanceSeries`
- **THEN** el Hero y "Dónde está" pintan sus importes en cuanto su query resuelve, sin esperar a "Balance del mes"
- **AND** "Balance del mes" sigue mostrando su `MonthBalanceSkeleton` in-card sobre su alto mínimo estable
- **AND** cuando resuelve, su contenido aparece dentro del alto que ya ocupaba, sin empujar a las demás secciones

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getMonthCategoryBreakdown` falla (timeout, error de DB) en mobile
- **THEN** `SpendingSection` muestra in-card un mensaje de error localizado con acción de reintentar, dentro de su alto estable
- **AND** el resto de las secciones renderiza normalmente
- **AND** NO se dispara `getCreditCards` para el dashboard

#### Scenario: Pull-to-refresh muestra el indicador solo durante el gesto (mobile)

- **WHEN** el usuario hace pull-to-refresh en el dashboard
- **THEN** se invalidan las queries bajo `['dashboard']` y vuelven a fetchearse
- **AND** el `RefreshControl` muestra el indicador hasta que esos refetches terminan (ligado al gesto, no a objetos de query del shell)

#### Scenario: Navegar de mes no enciende el refresh superior (mobile)

- **WHEN** el usuario toca una flecha del navegador mensual del header y se disparan las queries del nuevo mes
- **THEN** solo los skeletons in-card de "Balance del mes" y "En qué se fue" se muestran mientras cargan
- **AND** el `RefreshControl` superior NO se enciende
- **AND** la posición de scroll no se desplaza

#### Scenario: Salir del tab dashboard y volver resetea eye toggle y mes (mobile)

- **WHEN** el usuario mobile activa el eye toggle, navega a un mes anterior, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente y el mes seleccionado es el actual (los providers se remontan)

---

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada sección del dashboard que tiene estado de carga propio SHALL renderizar durante ese estado un **skeleton shell shape-matched**: una composición de bloques rectangulares con animación pulse cuyo tamaño y disposición anticipan la anatomía del contenido real que va a aterrizar. NO SHALL renderizar un mensaje textual genérico ("Cargando…") ni un spinner centrado como visual de loading.

**Naming y archivos.** Cada sección con loading state SHALL tener un componente skeleton con el sufijo `Skeleton`:

- web: `HeroSkeleton` (anticipa la fila superior completa: card oscura + card de cuentas), `MonthBalanceSkeleton` (neto + dos filas con barra + strip USD), `SpendingSkeleton` (dona + filas de leyenda) en `apps/web/app/(app)/dashboard/_components/`
- mobile: `HeroSkeleton` (card oscura), `AccountsCardSkeleton` (filas de cuentas), `MonthBalanceSkeleton`, `SpendingSkeleton` en `apps/mobile/components/dashboard/`

**Tecnología por plataforma.**

- **Web** SHALL implementar los bloques con `<div className="bg-muted animate-pulse rounded-…">` inline, siguiendo el patrón ya establecido. NO SHALL introducirse un componente `<Skeleton/>` wrapper.
- **Mobile** SHALL componer el primitivo `SkeletonBlock` de `apps/mobile/components/ui/` (encapsula la animación pulse sobre `react-native-reanimated` y respeta `useReducedMotion()`: con `prefers-reduced-motion` el bloque mantiene una opacidad estática ~0.7 sin animación).

**Shape source.** Los tamaños y disposición de los bloques SHALL derivarse del render real de cada sección en su estado con datos (no de design refs externos). Cada elemento visible del contenido real SHALL tener un bloque skeleton correspondiente.

**Accesibilidad.** El nodo raíz de cada skeleton SHALL declarar:

- web: `aria-busy="true"` y `aria-label={t('dashboard.<sección>_loading')}` o equivalente.
- mobile: `accessibilityState={{ busy: true }}` y `accessibilityLabel={t('dashboard.<sección>_loading')}` o equivalente.

Los bloques internos NO SHALL declarar atributos de accesibilidad (heredan al wrapper, son decorativos).

**Reuso de i18n.** Las keys `dashboard.hero_loading`, `dashboard.month.loading`, `dashboard.spending.loading` SHALL reusarse como `aria-label`/`accessibilityLabel` de los skeletons en ambas plataformas.

**Color del bloque.** Web SHALL usar el token `bg-muted`; sobre la card navy, bloques blancos translúcidos. Mobile SHALL usar el token semánticamente equivalente del theme mobile. NO SHALL introducirse un token de skeleton nuevo.

#### Scenario: El skeleton de la fila superior anticipa las dos cards (web)

- **WHEN** un usuario carga `/dashboard` web y la query del Hero aún no resuelve
- **THEN** la fila superior muestra dos cards skeleton lado a lado (≥`lg`): la izquierda navy con bloques translúcidos (importe ARS headline + línea USD), la derecha con filas pulsantes (cuentas)
- **AND** NO se muestra un mensaje "Cargando…" en texto, ni un spinner centrado

#### Scenario: Los skeletons nativos anticipan la anatomía nueva (mobile)

- **WHEN** un usuario abre el dashboard nativo y las queries aún no resuelven
- **THEN** el Hero navy muestra bloques translúcidos (eyebrow + importe + chip USD), "Dónde está" filas avatar+nombre+monto, "Balance del mes" neto + 2 filas con barra + strip, y "En qué se fue" un anillo + ~5 filas de leyenda
- **AND** todos componen `SkeletonBlock` dentro de su swap region de alto estable

#### Scenario: El skeleton de "Balance del mes" anticipa el neto y las barras

- **WHEN** la data del mes seleccionado aún no resuelve (primer load o navegación de mes)
- **THEN** el cuerpo de la card muestra un bloque grande (neto) + dos filas con bloques de label/monto y un bloque tipo barra + un bloque para el strip USD
- **AND** el título de la sección permanece visible (y el navegador mensual del header sigue interactivo)

#### Scenario: Web usa el skeleton como Suspense fallback (web)

- **WHEN** se inspecciona `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`
- **THEN** cada `<Suspense>` de las secciones usa el skeleton respectivo como `fallback={...}`
- **AND** NO se usa `<SectionFallback message=…/>` como fallback de esos `<Suspense>`

#### Scenario: El skeleton respeta `prefers-reduced-motion` (mobile)

- **WHEN** un usuario tiene activado "Reduce Motion" en el SO y carga el dashboard mobile
- **THEN** los bloques `SkeletonBlock` se renderizan con una opacidad estática (~0.7) sin animación de pulse
- **AND** el `accessibilityState.busy` sigue declarado

#### Scenario: Cada skeleton es accesible para lectores de pantalla

- **WHEN** un usuario con lector de pantalla aterriza en el dashboard mientras una sección está en loading
- **THEN** el lector anuncia el label localizado de la sección
- **AND** los bloques individuales del skeleton no son leídos uno por uno

