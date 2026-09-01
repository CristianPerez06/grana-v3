# dashboard Specification

## Purpose

Define la pantalla `/dashboard` como landing universal post-login y post-onboarding, con la misma composición en web y en la app nativa (rediseño `redesign-dashboard-home-v2`). Cuatro bloques, cada uno respondiendo una pregunta del usuario en su propio lenguaje:

- **"Saldo disponible total"** — cuánto tengo y dónde. Una sola card con dos zonas: la oscura con el disponible bimoneda y el reparto por cuenta ("Dónde está"), y la clara con el "Resumen del mes" (Tenías · Entró · Se fué), cuyos tres montos cierran contra el saldo de arriba por construcción.
- **"Cuánto gastaste"** — en qué se me fue y cuánto debo todavía. Tres tiles con el gasto propio del mes partido por estado de pago (`Ya se pagó + Por pagar = Gastaste`), con desglose por miembro cuando hay actividad compartida, y una tira de ritmo contra los ingresos del mes.
- **"Compromisos del próximo mes"** — qué se viene. Resúmenes de tarjeta que vencen en el próximo mes calendario y gastos fijos que caen en él, con lo vencido marcado aparte.
- **"Compartido"** — cómo estoy con el hogar. Una tira con el neto, en una sola dirección.

El selector de mes del header gobierna las tres primeras (el saldo hace corte mensual); Compromisos no lo sigue, porque su ventana es el próximo mes respecto de hoy.

Es read-only: toda interacción navega al módulo correspondiente. El desglose de gastos **por categoría** ya no vive acá — es superficie única de Movimientos (`spending-by-category`)— aunque el dashboard sigue consumiendo su lectura del devengado. El eye toggle de privacidad enmascara los importes en ambas plataformas.

## Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

Ambas plataformas SHALL renderizar la misma composición en **cuatro bloques**, en orden fijo:

1. **"Saldo disponible total"** — una sola card de dos zonas: zona oscura con el saldo disponible, la fila USD y el bloque "Dónde está"; zona clara con "Resumen del mes".
2. **"Cuánto gastaste"** — los tres tiles (Gastaste / Pagaste / Te queda por pagar) y la tira de ritmo.
3. **"Compromisos del próximo mes"** — el total comprometido con su barra apilada y los dos grupos desplegables.
4. **"Compartido"** — la tira con el neto del Hogar, condicional a que haya actividad.

El dashboard NO SHALL renderizar la sección "En qué se fue" (dona por categoría, leyenda, créditos por categoría ni toggle ARS/USD) en ninguna plataforma: esa lectura vive en la portada del módulo Movimientos. Tampoco SHALL renderizar la sección "Lo que viene" ni la card de bienvenida `WelcomeFirstMoveCard`.

La sección Tarjetas NO forma parte del dashboard en ninguna plataforma; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza los cuatro bloques en orden fijo
- **AND** NO renderiza "En qué se fue", "Lo que viene" ni la card de bienvenida

#### Scenario: El desglose por categoría no se duplica en el dashboard

- **WHEN** el usuario quiere ver en qué categorías se fue el gasto del mes
- **THEN** el dashboard no ofrece esa lectura
- **AND** la encuentra en la portada del módulo Movimientos


---

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En desktop, el contenido del dashboard SHALL limitarse a un ancho máximo de 1080px centrado, junto a un sidebar de navegación de 248px, con una separación uniforme entre cards.

La grilla SHALL organizarse en tres franjas:

- **Fila 1**: la card "Saldo disponible total" a **ancho completo**.
- **Fila 2**: dos columnas —"Cuánto gastaste" y "Compromisos del próximo mes"— con la segunda algo más ancha que la primera. Las dos cards SHALL terminar **alineadas a la misma altura**, empujando la tira de ritmo al pie de su card cuando sobra espacio.
- **Pie**: la tira "Compartido" a ancho completo, cuando corresponde renderizarla.

Por debajo del ancho máximo de contenido, el layout SHALL colapsar a **una sola columna** y el sidebar SHALL ocultarse. El diseño mobile SHALL ser la referencia para los anchos chicos.

#### Scenario: Desktop ancho

- **WHEN** el usuario abre el dashboard en una ventana más ancha que el contenido máximo
- **THEN** la card de saldo ocupa el ancho completo y debajo quedan "Cuánto gastaste" y "Compromisos" en dos columnas
- **AND** las dos cards de la segunda fila terminan a la misma altura

#### Scenario: Ventana angosta

- **WHEN** el ancho de la ventana baja del ancho máximo de contenido
- **THEN** las cards se apilan en una sola columna
- **AND** el sidebar deja de renderizarse


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

Cambiar el mes seleccionado SHALL actualizar **en simultáneo la card de saldo completa** —el saldo, el desglose "Dónde está" y "Resumen del mes"—, la card **"Cuánto gastaste"** y la card **"Compromisos del próximo mes"**. El saldo deja de ser "de hoy": se corta al último día del mes seleccionado. Es lo que permite que los tres montos del resumen cierren contra él; dejar el saldo de hoy encima de los flujos de otro mes rompía la única verificación que la card ofrece al usuario.

La card de compromisos SHALL seguir al selector con un **desfasaje de un mes**: parado en el mes M, muestra los compromisos del mes **M+1** (ver el requirement de la card "Comprometido"). Ese desfasaje NO es una inconsistencia sino la condición para que los dos montos de la pantalla sean comparables: el saldo corta el último día de M y la ventana de compromisos abre el 1º de M+1, de modo que en **toda** posición del navegador las dos lecturas son **disjuntas y contiguas** —sin solape y sin hueco—. Una ventana que cubriera el mismo mes M contaría compromisos cuyo pago ya salió del saldo que la card de arriba muestra.

La tira "Compartido" NO SHALL seguir al selector: muestra el neto vigente del hogar.

La navegación de mes NO SHALL modificar la URL/ruta ni provocar una navegación; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual; en nativo, salir del tab y volver resetea al mes actual, mismo mecanismo de remount que el eye-mask). Las flechas SHALL permitir navegar hasta 12 meses hacia atrás; la flecha derecha SHALL deshabilitarse en el mes actual (no se navega al futuro) — en consecuencia la ventana de compromisos nunca se proyecta más allá de "mes actual + 1", que es el mismo horizonte que la card ya tenía. Cada sección mensual SHALL obtener los datos del mes no-actual client-side (web: TanStack sobre el cliente del browser; nativo: su hook TanStack existente) mostrando su propio estado de carga in-card; en web el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes mueve la card de saldo entera

- **WHEN** el usuario en agosto 2026 toca la flecha izquierda del navegador
- **THEN** el saldo, "Dónde está", "Resumen del mes" y "Cuánto gastaste" muestran julio 2026
- **AND** el saldo es el del cierre de julio, no el de hoy
- **AND** no hay navegación de ruta ni recarga de pantalla

#### Scenario: Compromisos sigue al selector con un mes de desfasaje

- **WHEN** el usuario navega a junio 2026
- **THEN** la card de compromisos muestra la ventana `2026-07-01..2026-07-31`
- **AND** su encabezado nombra julio, no el mes siguiente a hoy
- **AND** la tira "Compartido" no cambia

#### Scenario: El saldo y los compromisos nunca se solapan

- **WHEN** el usuario está parado en cualquier mes del navegador
- **THEN** el corte del saldo (último día del mes seleccionado, u hoy si es el mes en curso) es anterior al primer día de la ventana de compromisos
- **AND** ningún movimiento aporta a los dos montos a la vez

#### Scenario: Límites de navegación

- **WHEN** el usuario está en el mes actual
- **THEN** la flecha derecha está deshabilitada
- **AND** tras navegar 12 meses hacia atrás, la flecha izquierda se deshabilita

#### Scenario: Mes no-actual se fetchea client-side con loading in-card

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** cada sección mensual muestra su skeleton in-card (título y chrome visibles) mientras su fetch resuelve
- **AND** una falla en el fetch de una sección muestra error compacto en esa sección sin romper las otras

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

La zona oscura de la card de saldo SHALL mostrar, centrados: el rótulo, el **monto grande en ARS** —con el signo y los centavos tipográficamente subordinados—, y la **fila USD** con su chip y su monto real en dólares.

El monto SHALL seguir al selector de mes, cortado al **último día del mes seleccionado** (o a hoy cuando el mes seleccionado es el corriente). Toda la card se mueve junta: dejar el saldo de hoy encima de los flujos de otro mes hace que los montos de la zona clara no cierren contra él, que es justamente lo que la card tiene que dejar verificar.

**Cuando el mes seleccionado es el corriente, el monto SHALL ser el disponible real**: el saldo de las cuentas propias **menos lo guardado**, por moneda. Ese es el número que contesta la pregunta que el usuario trae a la pantalla —*¿cuánto puedo gastar sin meter la pata?*— y es el que el rótulo viene prometiendo desde siempre.

El rótulo NO SHALL cambiar: sigue diciendo **"Saldo disponible total"**. Al netear el guardado el rótulo pasa a ser literalmente cierto, así que renombrarlo sería alejarlo de lo que muestra.

**Cuando el mes seleccionado NO es el corriente, el guardado NO SHALL netearse** y el monto SHALL seguir siendo el saldo al cierre de ese mes, con el rótulo diciéndolo (por ejemplo "Saldo al cierre de mayo de 2026"). Un "disponible" al cierre de un mes pasado no significa nada: la plata ya se gastó o no se gastó, y la decisión de guardar es una postura sobre el futuro, no un hecho del pasado. La regla es una sola y se lee del propio rótulo: **el guardado se netea exactamente donde la card dice "disponible"**.

En un mes pasado la palabra **"disponible" NO SHALL aparecer** en la card, ni en el rótulo ni en la zona clara. No es solo que el número no se netee: la card no plantea esa pregunta. Decir "podías gastar X en mayo" sería reconstruir una decisión de hoy sobre un mes cerrado — y si el usuario guardó o liberó desde entonces, ese número cambiaría retroactivamente cada vez, sin que nada haya pasado en mayo.

El monto del mes corriente SHALL leerse de la función normativa `get_available_sums(p_today)` —que devuelve por moneda el neto de cuentas, lo reservado y el disponible ya calculado— y el dashboard NO SHALL recomponer esa resta por su cuenta. El criterio de "cuenta propia" y el corte temporal siguen siendo los de `get_owned_account_ids()` y `get_account_balance_sums`: la función compone sobre ellas, no las reemplaza.

El saldo inicial de una cuenta SHALL contar únicamente cuando su fecha de declaración (`account_currencies.initial_balance_date`) es anterior o igual a la fecha de corte. Una cuenta creada en julio NO SHALL aportar su saldo inicial al saldo del 31 de mayo: no era plata que el usuario tuviera en mayo.

El disponible SHALL mostrarse **tal cual aunque quede negativo**. Si el usuario gastó por encima de lo que había apartado, el número queda en negativo y la card lo muestra: reducir el guardado para que el número cierre sería revocarle en silencio una decisión que no revocó.

La fila USD SHALL regirse por la regla bimoneda: se renderiza solo si el monto en dólares es distinto de cero. El guardado SHALL netearse **dentro de cada moneda**: lo guardado en pesos NO SHALL restar del monto en dólares ni al revés.

#### Scenario: El Hero descuenta lo guardado

- **WHEN** el usuario tiene $1.800.000 en sus cuentas en pesos y $200.000 guardados, y mira el mes corriente
- **THEN** el Hero muestra $1.600.000
- **AND** el rótulo sigue diciendo "Saldo disponible total"

#### Scenario: Un mes pasado muestra el saldo, no el disponible

- **WHEN** el usuario navega a un mes anterior
- **THEN** el monto es el saldo al cierre de ese mes, sin descontar lo guardado
- **AND** el rótulo indica que es el saldo al cierre de ese mes, no el disponible de hoy

#### Scenario: El guardado no cruza monedas

- **WHEN** el usuario tiene $200.000 guardados en pesos y saldo en dólares
- **THEN** el monto en USD no descuenta nada
- **AND** solo el monto en ARS queda neteado

#### Scenario: El disponible negativo se muestra tal cual

- **WHEN** el usuario tiene $150.000 en cuentas y $200.000 guardados
- **THEN** el Hero muestra `-$50.000`
- **AND** el total guardado sigue siendo $200.000

#### Scenario: Una cuenta creada después no infla los meses anteriores

- **WHEN** el usuario mira un mes anterior a la creación de una de sus cuentas
- **THEN** el saldo inicial de esa cuenta no participa del saldo de ese mes

#### Scenario: Usuario sin saldo en dólares

- **WHEN** el usuario no tiene saldo en USD
- **THEN** la fila USD no se renderiza
- **AND** el monto en ARS queda como única lectura del saldo

---
### Requirement: La card "Dónde está" desglosa las cuentas del usuario

El desglose "Dónde está" SHALL vivir **dentro de la zona oscura** de la card de saldo, no como card separada, en dos columnas separadas por un divisor: **ARS a la izquierda y USD a la derecha**, con su encabezado propio y un link a Cuentas.

Cada columna SHALL listar las **dos cuentas con más saldo** de esa moneda, cada fila con un cuadradito del color de la cuenta, el nombre y su **porcentaje sobre el total de esa moneda**. El desglose NO SHALL renderizar barras de proporción: el porcentaje es la única expresión de la magnitud.

En pantallas angostas las dos monedas SHALL apilarse y cada cuenta SHALL ocupar su propia fila, con **el rótulo de moneda como columna izquierda** —no como fila propia: una línea entera para la palabra "ARS" es una línea no gastada en datos— y el porcentaje empujado al borde derecho, de modo que los porcentajes queden alineados en columna, que es lo que se compara. Dos columnas de moneda en el ancho de un teléfono dejan ~145px cada una y dos cuentas adentro de eso truncaban los nombres a una letra ("M", "L…"), que no identifican nada. Apilado, cada cuenta tiene el ancho de la card. El separador SHALL girar con la composición: vertical entre columnas, horizontal entre bloques apilados. Cada bloque apilado SHALL llevar su propio rótulo de moneda, porque el encabezado de dos columnas solo se alinea con ellas cuando están lado a lado.

Una columna cuya moneda no tiene saldo NO SHALL renderizar filas vacías. Un usuario con una sola cuenta en una moneda SHALL ver una sola fila en esa columna.

#### Scenario: Usuario con varias cuentas en ambas monedas

- **WHEN** el usuario tiene tres cuentas con saldo en ARS y dos en USD
- **THEN** la columna ARS lista las dos de mayor saldo y la columna USD lista sus dos cuentas
- **AND** cada porcentaje está calculado sobre el total de su propia moneda

#### Scenario: Usuario sin saldo en dólares

- **WHEN** el usuario no tiene saldo en USD
- **THEN** la columna USD no lista cuentas
- **AND** la columna ARS conserva su lectura completa


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


---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar sin errores frente a cualquier combinación de datos faltantes: usuario sin cuentas, sin movimientos en el mes, sin ingresos acreditados, sin tarjetas, sin gastos fijos y sin actividad compartida. Cada bloque SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada bloque SHALL distinguir entre **cero** y **ausencia de dato**: un monto en cero se muestra como cero, mientras que una métrica que no se puede calcular —señaladamente el ritmo cuando no hubo ingresos en el mes— SHALL mostrar un mensaje explicativo y NO SHALL mostrarse como 0%. La misma distinción rige el estado de carga: una lectura pendiente es ausencia de dato, no cero (ver el requirement de skeletons).

Ninguna derivación SHALL dividir por cero ni producir `NaN`, `Infinity` o un porcentaje fuera de rango cuando su denominador es cero.

Cada bloque SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en un bloque NO SHALL bloquear ni romper el renderizado de los demás. En web, esta independencia SHALL implementarse envolviendo cada bloque en su propio `<Suspense>` con su skeleton shape-matched como `fallback`, y haciendo que cada uno fetchee su data en un container dedicado que degrade a un estado de error compacto si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varios bloques bloqueando el streaming entre ellos. En nativo, cada bloque posee su query TanStack y su swap region de alto estable (ver requirement del shell mobile).

Cada bloque SHALL declarar un `min-height` sobre el root del componente real y sobre su **skeleton** correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando un bloque pasa de su skeleton al contenido real. La tira Compartido queda exceptuada: no tiene skeleton (es condicional) y por lo tanto no reserva alto.

#### Scenario: Usuario recién onboardeado

- **WHEN** un usuario sin ningún movimiento abre el dashboard
- **THEN** cada bloque muestra su estado vacío correspondiente
- **AND** ninguna sección rompe ni muestra `NaN`

#### Scenario: Cero y ausencia de dato no se confunden

- **WHEN** el usuario gastó en el mes pero no acreditó ningún ingreso
- **THEN** "Cuánto gastaste" muestra sus montos reales
- **AND** el ritmo muestra su mensaje de indeterminado en lugar de 0%

#### Scenario: Un bloque lento no bloquea a los demás

- **WHEN** la lectura del saldo resuelve antes que la de "Cuánto gastaste"
- **THEN** la card de saldo muestra sus datos
- **AND** "Cuánto gastaste" sigue mostrando su skeleton hasta que su propia lectura resuelva

#### Scenario: El skeleton ocupa el mismo alto que el contenido

- **WHEN** un bloque del dashboard está mostrando su skeleton y luego su query resuelve
- **THEN** el hueco que ocupaba el skeleton es el mismo que ocupa el contenido real (min-height matcheado)

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

Los componentes del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase, sobre la composición de cuatro bloques vigente: `BalanceCard` + `BalanceCardSkeleton`, `SpentCard` + `SpentCardSkeleton` + `SpentTile`, `CommittedSection` + `CommittedSkeleton` + `CommittedBody` + `CommittedRow`, `SharedStrip`, más el chrome compartido `DashboardHeader`, `MonthNavigator`, `MaskedAmount`, `MaskedAmountDisplay`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardMonthProvider`, `useDashboardMonth`. Las props públicas SHALL coincidir cuando es técnicamente posible.

Los componentes de composiciones anteriores NO existen en ninguna plataforma: `UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser`, `MonthBalanceChart`, y —dados de baja por `redesign-dashboard-home-v2`— `HeroSection`, `AccountsCard`, `MonthBalanceSection`, `SpentThisMonthSection`, `SpendingSection`, `SpendingDonut` con sus skeletons `HeroSkeleton`, `AccountsCardSkeleton`, `MonthBalanceSkeleton` y `SpendingSkeleton`. La tira "Compartido" SÍ tiene par mobile (`SharedStrip`): el módulo `shared` nativo ya existe y el rediseño la llevó a las dos plataformas.

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `react-native-svg`, `lucide-react-native`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. Los skeletons mobile SHALL componer el primitivo `SkeletonBlock` (de `apps/mobile/components/ui/`) en vez de re-implementar la animación pulse en cada caso. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

`SectionFallback` ya NO forma parte del set de componentes espejados del **dashboard** — los containers del dashboard (web y mobile) no lo importan, ni para loading ni para error states. El archivo en sí permanece en ambas plataformas (`apps/web/components/ui/section-fallback.tsx`, `apps/mobile/components/dashboard/SectionFallback.tsx`) porque sigue siendo utility compartida por otras rutas (`accounts`, `cards`); su migración eventual a skeletons queda fuera del scope de este change.

#### Scenario: Mismo nombre de componente entre web y mobile

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los componentes exportan el mismo nombre PascalCase en ambas plataformas
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Los componentes nuevos del rediseño existen en mobile

- **WHEN** se inspecciona `apps/mobile/components/dashboard/`
- **THEN** existen `CommittedSection`, `CommittedSkeleton` y `SpentThisMonthSection`
- **AND** exportan el mismo nombre PascalCase que sus pares web (donde el par existe)

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

La pantalla nativa SHALL renderizar los **mismos cuatro bloques** que la web, en el mismo orden, en una sola columna, tomando el diseño mobile del handoff como referencia. Cada bloque SHALL tolerar la falla de su propia lectura sin tumbar la pantalla.

Los componentes nativos SHALL mantener la convención de naming espejo respecto de los de web. Los controles interactivos —las cabeceras de los grupos desplegables y la tira Compartido— SHALL tener un área táctil de al menos 44px.

#### Scenario: La app nativa muestra la misma composición

- **WHEN** el usuario abre el dashboard en la app nativa
- **THEN** ve los cuatro bloques en el mismo orden que en web, apilados
- **AND** incluye la tira Compartido cuando hay actividad

#### Scenario: Área táctil de los desplegables en mobile

- **WHEN** el usuario toca la cabecera de un grupo de compromisos en la app nativa
- **THEN** el área activa es de al menos 44px
- **AND** el grupo alterna su estado sin afectar al otro


---

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada bloque del dashboard que tiene estado de carga propio SHALL renderizar durante ese estado un **skeleton shell shape-matched**: una composición de bloques rectangulares con animación pulse que respeta la forma final del contenido —mismos radios, misma altura aproximada, misma cantidad de bloques— para que la pantalla no salte al resolverse.

Un bloque que falla SHALL degradar sin arrastrar al resto de la pantalla: el error queda contenido en su bloque.

NO SHALL usarse como visual de carga: un spinner centrado, un mensaje textual ("Cargando…"), el **estado vacío** de la sección, ni sus **montos en cero**. Los dos últimos son la falla más grave de las cuatro, porque no son placeholders neutros sino afirmaciones: mientras la lectura no resolvió, "Sin gastos este mes" y "$ 0" le dicen al usuario algo que la app todavía no sabe, y que muchas veces es falso.

**Composición.** Los cuatro bloques resuelven su carga de tres maneras distintas, y la diferencia no es estilística:

1. **"Saldo disponible total"** SHALL cargar con **un solo skeleton para la card completa** —zona oscura, "Dónde está" y "Resumen del mes"—, aun cuando sus zonas se alimentan de dos lecturas distintas (el saldo y el resumen mensual). Al compartir card, un skeleton por zona la haría armarse a saltos delante del usuario. Es también la excepción a la regla de encabezado del punto 2: en esta card el rótulo y el importe SON el contenido, no chrome alrededor de él.
2. **"Cuánto gastaste"** y **"Compromisos del próximo mes"** SHALL conservar su **encabezado real desde el primer paint** —título, subtítulo de mes donde exista, y el link de la card— y skeletonear únicamente el cuerpo. El encabezado no depende de la lectura: es texto estático más un link de navegación, y esconderlo hace que la card aparezca de la nada en vez de llenarse. Es la misma regla que el spec `route-loading-and-errors` fija para el chrome de ruta, un nivel más abajo.
3. **"Compartido"** NO SHALL renderizar skeleton. Es un bloque condicional: existe solo si el usuario está en un Hogar de dos miembros con neto sin saldar, que es la minoría de los casos. Su estado de carga SHALL ser no ocupar espacio (`fallback={null}` en web, retorno `null` en nativo). Un skeleton ahí prometería un bloque que en general nunca aparece, y al resolverse en "no hay nada que mostrar" haría saltar el layout hacia arriba.

**Naming y archivos.** Cada bloque con loading state SHALL tener un componente con el sufijo `Skeleton`:

- web: `BalanceCardSkeleton`, `SpentCardSkeleton`, `CommittedSkeleton` en `apps/web/app/(app)/dashboard/_components/`
- mobile: `BalanceCardSkeleton`, `SpentCardSkeleton`, `CommittedSkeleton` en `apps/mobile/components/dashboard/`

Los skeletons de la composición anterior (`MonthBalanceSkeleton`, `SpendingSkeleton`, `AccountsCardSkeleton`, y el `HeroSkeleton` nativo que cubría solo el importe del hero) SHALL darse de baja junto con las secciones que anticipaban. NO SHALL reusarse el skeleton de un bloque como stand-in de otro: una forma equivocada es peor que ninguna, porque compromete un layout que después no se cumple.

**Tecnología por plataforma.**

- **Web** SHALL implementar los bloques con `<div className="bg-muted animate-pulse rounded-…">` inline, siguiendo el patrón ya establecido. NO SHALL introducirse un componente `<Skeleton/>` wrapper.
- **Mobile** SHALL componer el primitivo `SkeletonBlock` de `apps/mobile/components/ui/` (encapsula la animación pulse sobre `react-native-reanimated` y respeta `useReducedMotion()`: con `prefers-reduced-motion` el bloque mantiene una opacidad estática ~0.7 sin animación).

**Shape source.** Los tamaños y disposición de los bloques SHALL derivarse del render real de cada bloque en su estado con datos (no de design refs externos). Cada elemento visible del contenido real SHALL tener un bloque skeleton correspondiente.

**Navegación de mes.** Cuando el selector cambia de mes, los bloques mensuales SHALL volver a su skeleton de cuerpo manteniendo el encabezado (ver el requirement del selector de mes) y NO SHALL renderizar ceros ni el estado vacío mientras el nuevo fetch resuelve. Aplica también a la card de saldo, cuyas dos zonas siguen al mes seleccionado.

**Accesibilidad.** El nodo raíz de cada skeleton SHALL declarar:

- web: `aria-busy="true"` y `aria-label` derivado de la key de la sección.
- mobile: `accessibilityState={{ busy: true }}` y `accessibilityLabel` derivado de la misma key.

Los bloques internos NO SHALL declarar atributos de accesibilidad (heredan al wrapper, son decorativos).

**Reuso de i18n.** Las keys SHALL ser `dashboard.hero_loading` (saldo), `dashboard.spent.loading` ("Cuánto gastaste") y `dashboard.committed.loading` (Compromisos), reusadas en ambas plataformas. NO SHALL introducirse keys nuevas para esto ni reusarse un mensaje genérico para todos los bloques. `dashboard.spending.loading` SHALL darse de baja junto con el skeleton de la dona si ningún otro módulo la consume.

**Color del bloque.** Web SHALL usar el token `bg-muted`; sobre la zona navy, bloques blancos translúcidos. Mobile SHALL usar el token semánticamente equivalente del theme mobile. NO SHALL introducirse un token de skeleton nuevo.

#### Scenario: Carga inicial del dashboard

- **WHEN** el usuario abre el dashboard y los datos todavía no resolvieron
- **THEN** cada bloque muestra un skeleton con la forma de su contenido final
- **AND** la card de saldo muestra un único skeleton para toda la card, no uno por zona
- **AND** la tira Compartido no ocupa espacio ni dibuja skeleton

#### Scenario: El encabezado de la card permanece visible mientras carga

- **WHEN** "Cuánto gastaste" o "Compromisos del próximo mes" están cargando, en web o en nativo
- **THEN** el título de la card, su subtítulo de mes cuando lo tiene y su link ("Ver detalle" / "Ver todos") se ven desde el primer paint
- **AND** el skeleton ocupa únicamente el cuerpo de la card, dentro del borde y el padding definitivos

#### Scenario: Ningún bloque usa su estado vacío como placeholder de carga

- **WHEN** la lectura que alimenta un bloque todavía no resolvió
- **THEN** el bloque muestra su skeleton
- **AND** NO muestra su copy de vacío ("Sin gastos este mes.", "No tenés nada por pagar por ahora.") ni importes en cero
- **AND** el estado vacío aparece únicamente cuando la lectura resolvió y devolvió efectivamente cero

#### Scenario: Cambiar de mes no muestra ceros

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** los bloques mensuales vuelven a su skeleton de cuerpo con el encabezado visible
- **AND** ningún importe se muestra en cero mientras el fetch resuelve

#### Scenario: Falla la lectura de compromisos

- **WHEN** la lectura que alimenta "Compromisos del próximo mes" falla
- **THEN** esa card muestra su estado de error
- **AND** el saldo, "Cuánto gastaste" y la tira Compartido siguen renderizando sus datos

#### Scenario: Web usa el skeleton como Suspense fallback

- **WHEN** se inspecciona `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`
- **THEN** cada bloque con loading state está envuelto en su propio `<Suspense>` con su skeleton respectivo como `fallback`
- **AND** `dashboard/loading.tsx` usa esos mismos skeletons, uno por bloque, sin reusar el de un bloque para otro
- **AND** NO se usa `<SectionFallback message=…/>` como fallback de esos `<Suspense>`

#### Scenario: El skeleton respeta `prefers-reduced-motion` (mobile)

- **WHEN** un usuario tiene activado "Reduce Motion" en el SO y carga el dashboard mobile
- **THEN** los bloques `SkeletonBlock` se renderizan con una opacidad estática (~0.7) sin animación de pulse
- **AND** el `accessibilityState.busy` sigue declarado

#### Scenario: Cada skeleton es accesible para lectores de pantalla

- **WHEN** un usuario con lector de pantalla aterriza en el dashboard mientras un bloque está en loading
- **THEN** el lector anuncia el label localizado de ese bloque
- **AND** los bloques individuales del skeleton no son leídos uno por uno

---

### Requirement: Cada sección del dashboard rotula la pregunta que ayuda a responder

Cada bloque del dashboard SHALL llevar un título que nombre la pregunta que responde, en el lenguaje del usuario y no en el del dominio: "Saldo disponible total" y "Dónde está" para cuánto tengo y dónde, "Resumen del mes" para qué pasó este mes, "Cuánto gastaste" para en qué se me fue y cuánto debo todavía, "Compromisos del próximo mes" para qué se viene, y "Compartido" para cómo estoy con el hogar.

El título de la card de compromisos SHALL depender de la posición del navegador, en tres estados y no dos. Con `lens: 'live'` SHALL seguir siendo "Compromisos del próximo mes": es un pronóstico. Con `lens: 'snapshot'` y `windowElapsed: false` SHALL **nombrar la ventana** ("Compromisos de septiembre") y NO SHALL afirmar qué sabía el usuario al corte; la bajada SHALL declarar el punto de observación ("Al cierre de agosto"), que es lo que distingue esa posición. Con `windowElapsed: true` SHALL rotular lo que hubo que pagar en esa ventana, porque ya no anticipa nada y ahí la afirmación de registro sí es la correcta.

**El título de la posición intermedia NO SHALL prometer previsión**, y la razón es estructural, no estética: una ventana bajo lente `snapshot` es un registro reconstruido, así que una regla creada DESPUÉS del corte alimenta esa lectura. Medido sobre datos reales durante la verificación de este change: en una cuenta, **el 77% del monto de gastos fijos de esa posición provenía de dos reglas nacidas el día siguiente al corte** — la card habría afirmado que el usuario tenía $2,18M por delante cuando a esa fecha conocía $9.311. El número es correcto como registro; la afirmación de conocimiento no lo es. Los títulos SHALL salir del catálogo i18n, sin string hardcodeado, y ninguna plataforma SHALL derivar el mes del rótulo de su propio reloj.

Los rótulos de los tres tiles de "Cuánto gastaste" SHALL ser verbos en pasado dirigidos al usuario (Gastaste / Pagaste / Te queda por pagar), y cada uno SHALL ir acompañado de un sub-bloque que desambigüe qué mide, porque los tres son montos de gasto y sin esa aclaración se confunden entre sí.

#### Scenario: Los tres tiles se distinguen entre sí

- **WHEN** el usuario lee la card "Cuánto gastaste"
- **THEN** cada tile aclara en su sub-bloque qué mide su monto
- **AND** queda explícito que "Te queda por pagar" es lo financiado con tarjeta

#### Scenario: El título de compromisos cambia con la posición del navegador

- **WHEN** el usuario está en el mes actual
- **THEN** la card se titula "Compromisos del próximo mes" y la bajada nombra el mes de la ventana
- **WHEN** el usuario navega al mes anterior, cuya ventana todavía transcurre
- **THEN** el título nombra la ventana ("Compromisos de septiembre")
- **AND** la bajada declara el corte ("Al cierre de agosto"), sin afirmar qué sabía el usuario ese día
- **WHEN** el usuario navega a un mes cuya ventana ya terminó
- **THEN** el título nombra lo que hubo que pagar en esa ventana


---

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

La card SHALL responder una sola pregunta: **cuánta plata ya se sabe que hay que pagar el mes siguiente al que se está mirando.** La ventana SHALL ser el **mes calendario siguiente al mes seleccionado** en el navegador —del día 1 al último día—, no "desde hoy" ni "los próximos 30 días", y el encabezado SHALL nombrar ese mes.

**Dos fechas, dos roles.** La lectura SHALL parametrizar por separado:

- `window`: el mes calendario siguiente al mes seleccionado. Define **qué** se cuenta.
- `snapshotDate`: el último día del mes seleccionado, o `hoy_AR` cuando el mes seleccionado es el mes en curso. Define **desde cuándo** se evalúa el estado de cada compromiso.
- `lens`: `'live'` cuando el mes seleccionado **es** el mes en curso, `'snapshot'` en cualquier otro caso. Gobierna cómo se evalúa el estado de pago de los resúmenes.
- `windowElapsed`: verdadero cuando la ventana ya terminó antes de `hoy_AR`. Gobierna si la proyección de reglas de recurrencia sigue aportando.

`lens` y `windowElapsed` SHALL ser campos **separados**: son hechos ortogonales y las dos mitades de la card parten las posiciones del navegador por lugares distintos. Un único campo derivado de "¿la ventana ya terminó?" NO alcanza — el 1º de septiembre, mirando agosto, la ventana es septiembre y todavía no terminó, pero el estado de pago SHALL evaluarse al 31/8 igual.

Las dos NO SHALL colapsarse en un único parámetro: una ventana pasada evaluada con el estado de hoy no es ninguna de las dos lecturas. Parado en junio 2026 la card lee `snapshotDate = 2026-06-30` y `window = 2026-07-01..2026-07-31`.

**El estado de pago es un atributo, no un filtro, bajo la lente `snapshot`.** En `lens: 'live'` la pregunta es "cuánto me va a salir" y lo ya pagado SHALL excluirse. En `lens: 'snapshot'` la pregunta es "qué había que pagar ese mes": que se haya pagado después del corte es el desenlace y NO SHALL sacar el compromiso de la ventana. En consecuencia el monto de un mes pasado SHALL ser **estable**: no SHALL cambiar porque el usuario pague algo hoy.

**Tarjetas** SHALL contar los resúmenes cuyo **vencimiento** cae dentro de la ventana. El universo de tarjetas depende de la lente: con `lens: 'live'` son las **activas**; con `lens: 'snapshot'` SHALL incluirse también las **archivadas**, porque archivar no es retroactivo — una tarjeta archivada el mes pasado estaba vigente durante la ventana que se está leyendo y su resumen fue un compromiso real entonces. Excluirla haría que el total de una ventana pasada cambiara un día en que no se pagó nada. El criterio es la fecha de vencimiento, no la de cierre: un resumen que cierra el 28/09 pero vence el 10/10 se paga en octubre y NO es un compromiso de septiembre.

Su estado de pago SHALL evaluarse a la **fecha financiera del pago** —`period_payments.transaction_id → transactions.date`—, nunca al estado actual del resumen ni a `period_payments.created_at` (que es cuándo se registró en la app, no cuándo salió la plata). Un resumen pagado **después** del `snapshotDate` SHALL contar en esa foto; uno pagado **en o antes** NO SHALL contar, porque a esa fecha ya no era un compromiso pendiente. Pagar un resumen ya cerrado antes de su vencimiento es un flujo soportado por el sistema, así que este caso NO es hipotético.

**Los consumos de un resumen NO SHALL cortarse por fecha.** El resumen aporta su contenido completo; el `snapshotDate` decide únicamente si a esa fecha seguía siendo un compromiso pendiente.

El motivo es que un corte por `transactions.date` rompe las compras en cuotas, que son el contenido dominante de un resumen en este mercado: las N cuotas se insertan **en el momento de la compra**, fechadas `fechaCompra + i meses`, así que una compra de mayo en 12 cuotas ya tiene desde mayo un hijo fechado en julio. Al cierre de junio ese consumo existía y el usuario lo conocía — es exactamente el compromiso que la card está para anticipar — y un corte por fecha lo dejaba afuera. Tampoco SHALL usarse `created_at` en su lugar: ataría un monto de plata al momento de carga en la app, el mismo acoplamiento que esta card rechaza al fechar un pago por `transactions.date` y no por `period_payments.created_at`.

En consecuencia, para un resumen que al corte todavía no había cerrado la card muestra **más** de lo que la pantalla mostraba ese día. Es deliberado: la card responde qué hubo que pagar en la ventana, no qué decía la pantalla el día del corte. A cambio, el monto de una ventana pasada SHALL quedar **estable** una vez cerrados sus resúmenes.

**Gastos fijos** SHALL contar las recurrencias que caen dentro de la ventana y que **NO se pagan con tarjeta de crédito**. Una recurrencia debitada de una tarjeta no saca plata de la cuenta ese mes: entra al resumen de esa tarjeta y se paga cuando ese resumen vence, que es otra ventana. Contarla acá y otra vez dentro de su resumen sería contarla dos veces.

La fuente SHALL componerse de dos partes gobernadas por campos distintos:

- **Qué instancias materializadas cuentan** lo decide `lens`. En `lens: 'live'`, sólo las que siguen `pending`. En `lens: 'snapshot'`, las `confirmed` **y** las `pending`: al corte todas seguían sin resolver, y filtrar por `pending` haría que el monto de esa ventana **encogiera** a medida que el usuario confirma, rompiendo la estabilidad exigida más arriba. Las instancias `skipped` NO SHALL contarse en ningún caso: saltear es el usuario declarando que ese gasto no ocurrió, y esa plata nunca tuvo que salir.
- **Si la proyección aporta** lo decide `windowElapsed`. Mientras la ventana no haya terminado, las ocurrencias **proyectadas** de las reglas activas SHALL sumarse a las instancias; una vez terminada, NO SHALL proyectarse: la proyección usaría los montos actuales de las reglas, perdería las dadas de baja e inventaría las creadas después.

  La bajada del grupo NO SHALL llamar "pendientes" a sus filas bajo `lens: 'snapshot'`: ahí el conjunto incluye instancias `confirmed`, que es justamente lo que impide que una ventana pasada encoja, y llamarlas pendientes describe mal un gasto ya pagado. SHALL usar un rótulo neutro ("N gastos fijos"). Bajo `live` el conjunto sí es sólo `pending` y el rótulo original SHALL conservarse.

  Cuando `lens: 'snapshot'` y `windowElapsed: false` conviven —el mes anterior, cuya ventana es el mes en curso— la proyección se hace sobre las reglas **vigentes hoy**, de modo que una regla creada o editada después del corte aporta a esa lectura con sus valores actuales. Se acepta explícitamente: no proyectar ahí dejaría la ventana en casi cero, porque el generador todavía no materializó sus instancias, y un monto levemente desactualizado informa más que uno ausente.

Las dos fuentes NO SHALL superponerse: la proyección avanza desde `last_generated_date`, de modo que nunca devuelve una ocurrencia ya generada.

**La ventana bajo lente `snapshot` es un registro reconstruido, no un replay de la pantalla.** El generador materializa una sola instancia pendiente por regla y sólo cuando la fecha ya llegó, de modo que al cierre del mes seleccionado los gastos fijos de la ventana eran **proyección no persistida**. Esa proyección no se puede reconstruir: las reglas no tienen versionado histórico. La card SHALL presentar la ventana pasada como lo que efectivamente hubo que pagar, y el sistema NO SHALL prometer fidelidad a lo que la pantalla mostraba ese día.

**Lo ya vencido SHALL mostrarse, marcado aparte, con UNA sola regla en las tres posiciones.** Un resumen cuyo vencimiento ya había pasado **al `snapshotDate`** y que a esa fecha seguía impago es plata que se debía y desaparecería de la pantalla si la card se limitara a su ventana: SHALL sumarse con su **propia etiqueta explícita** —nombrando que está vencido— y NO SHALL confundirse dentro del monto de la ventana.

El arrastre NO SHALL evaluarse contra `hoy_AR` cuando la lente es `snapshot`: mezclaría dos horizontes dentro de una misma lectura. Con `lens: 'live'` el `snapshotDate` **es** hoy, así que la regla se reduce al comportamiento actual sin caso especial.

El arrastre se refiere a resúmenes vencidos **antes** de que la ventana abra, no a los de la ventana: los de la ventana vencen todos después del corte, y por eso los dos conjuntos son disjuntos por construcción. Disjuntos pero NO exhaustivos: un resumen que vence exactamente el `snapshotDate` no cae en ninguno de los dos. Es el mismo KNOWN GAP que la card ya tiene —un resumen que vence antes de que la ventana abra no está en ningún conjunto—, angostado de "lo que resta del mes" a un solo día. El umbral SHALL seguir siendo estrictamente `<`, que es la definición de vencido de `derivePeriodStatus`: un resumen que vence el día del corte está **cerrado esperando pago**, no vencido, y la card NO SHALL contradecir al módulo de tarjetas sobre esa palabra. Que un resumen anterior a la ventana estuviera vencido al corte es un hecho perfectamente reconstruible y NO SHALL descartarse por estar mirando un mes pasado — al cierre de agosto, un resumen que venció el 28/07 y seguía impago estaba vencido, y la card de ese día lo decía.

El aviso SHALL ocupar **una sola línea**: la card comparte fila con "Cuánto gastaste" y todo lo que crece acá aparece como hueco en la card vecina.

Lo que **NO** entra: los consumos de tarjeta cuyo resumen vence fuera de la ventana, las recurrencias fuera de la ventana, y cualquier gasto que todavía no exista como compromiso.

La card SHALL encabezar con el mes al que refiere y un link al listado completo, y SHALL mostrar un bloque de total con: el rótulo "Ya comprometido", el monto total en ARS, su línea USD según la regla bimoneda, una **barra apilada** de dos segmentos (Tarjetas y Gastos fijos) y una leyenda con el cuadradito y el porcentaje de cada uno.

El total SHALL ser `Tarjetas + Gastos fijos` dentro de cada moneda, y los porcentajes de la barra SHALL derivarse de ese total — NO SHALL hardcodearse. Cuando el total es cero, la barra NO SHALL renderizarse con proporciones arbitrarias.

El detalle de Tarjetas SHALL agregarse **por tarjeta** —una fila por tarjeta con su total comprometido y su próximo cierre en la bajada del grupo—, no por consumo individual: la pregunta del usuario es cuánto le viene de cada tarjeta.

Los estados vacíos SHALL cubrirse por separado: sin tarjetas con compromiso, el grupo Tarjetas muestra su vacío; sin gastos fijos, el grupo Gastos fijos muestra el suyo; sin ninguno de los dos, la card muestra un vacío único en lugar de dos vacíos apilados.

**El mes rotulado SHALL derivarse del resultado de la lectura**, que SHALL exponer su `window`, su `snapshotDate`, su `lens` y su `windowElapsed`. Ninguna plataforma SHALL recalcular el mes por su cuenta a partir del reloj: dos relojes independientes es exactamente lo que hacía que la card ignorara el navegador.

#### Scenario: La card sigue al mes seleccionado

- **WHEN** el usuario está en septiembre 2026 y navega a junio 2026
- **THEN** la card lee la ventana `2026-07-01..2026-07-31` con `snapshotDate = 2026-06-30`
- **AND** su encabezado nombra julio 2026

#### Scenario: Un resumen que cierra dentro de la ventana pero vence después

- **WHEN** una tarjeta cierra el 28 de septiembre y vence el 10 de octubre
- **THEN** ese resumen NO suma en los compromisos de septiembre
- **AND** sí suma cuando la ventana es octubre

#### Scenario: Un resumen de la ventana que ya fue pagado

- **WHEN** el usuario mira junio 2026 y un resumen que vencía el 10/07 fue pagado el 12/07
- **THEN** ese resumen suma en la foto de junio, porque al 30/06 seguía por pagar
- **AND** el monto de esa foto no cambia si el usuario paga otro resumen hoy

#### Scenario: Un resumen pagado antes del corte

- **WHEN** un resumen que cerró el 20/06 y vencía el 05/07 fue pagado el 25/06
- **THEN** NO suma en la foto de junio: a esa fecha ya no era un compromiso pendiente

#### Scenario: Un resumen que al corte todavía no había cerrado

- **WHEN** el usuario mira junio 2026 y un resumen de la ventana cerraba el 15/07
- **THEN** ese resumen aporta su contenido completo, no sólo lo acumulado al 30/06
- **AND** el monto de esa foto no cambia una vez cerrado el resumen

#### Scenario: Cuotas futuras ya conocidas al corte

- **WHEN** el usuario compró en mayo 2026 en 12 cuotas y mira junio 2026
- **THEN** la cuota fechada en julio suma en la foto de junio, porque al 30/06 ya existía y era un compromiso conocido
- **AND** el sistema NO filtra los consumos por `transactions.date` ni por `created_at`

#### Scenario: El mes anterior usa el corte de su cierre aunque su ventana no haya terminado

- **WHEN** hoy es el 01/09/2026 y el usuario mira agosto 2026
- **THEN** la ventana es septiembre 2026 y el estado de pago se evalúa al 31/08
- **AND** la proyección de reglas activas sigue aportando, porque septiembre todavía no terminó

#### Scenario: El monto de una ventana no encoge mientras se confirman recurrencias

- **WHEN** el usuario mira agosto 2026 el 01/09 y vuelve a mirarlo el 20/09, habiendo confirmado entretanto varias recurrencias de septiembre
- **THEN** el total de gastos fijos de esa ventana es el mismo en las dos visitas

#### Scenario: Una recurrencia que se paga con tarjeta

- **WHEN** una recurrencia de la ventana se debita de una tarjeta de crédito
- **THEN** NO suma en "Gastos fijos"
- **AND** llegará como parte del resumen de esa tarjeta, en la ventana en que ese resumen venza

#### Scenario: Una recurrencia ya generada y una todavía proyectada

- **WHEN** el mes seleccionado es el actual, el generador ya creó la instancia de la ventana de una regla mensual y la de la siguiente todavía no
- **THEN** la ventana cuenta esa instancia una sola vez
- **AND** la proyección no la vuelve a agregar

#### Scenario: Gastos fijos de una ventana ya terminada

- **WHEN** el usuario mira junio 2026 y en julio hubo tres instancias: una confirmada, una salteada y una que quedó pendiente
- **THEN** la card cuenta la confirmada y la pendiente
- **AND** NO cuenta la salteada
- **AND** no reproyecta las reglas activas sobre julio

#### Scenario: Un resumen vencido e impago, mirando el mes actual

- **WHEN** un resumen venció el mes pasado y sigue sin pagarse
- **THEN** la card lo muestra con su etiqueta de vencido, en una sola línea
- **AND** ese monto no se confunde con el de la ventana

#### Scenario: El arrastre de vencidos también existe bajo la lente snapshot

- **WHEN** un resumen venció el 28/07, siguió impago, y el usuario mira agosto 2026
- **THEN** la card lo muestra como vencido, porque al 31/08 ya lo estaba
- **AND** no se confunde con el monto de la ventana de septiembre

#### Scenario: El arrastre se evalúa al corte, no a hoy

- **WHEN** un resumen venció el 28/07, se pagó el 15/08, y el usuario mira julio 2026
- **THEN** figura como vencido, porque al 31/07 estaba vencido e impago
- **WHEN** el mismo usuario mira agosto 2026
- **THEN** NO figura, porque al 31/08 ya estaba pago

#### Scenario: Usuario sin compromisos de ningún tipo

- **WHEN** no hay ni tarjetas ni gastos fijos comprometidos
- **THEN** la card muestra un único estado vacío
- **AND** no renderiza la barra apilada con proporciones inventadas


---

### Requirement: Los montos del dashboard se muestran por moneda y la línea USD aparece solo si el valor es distinto de cero

Toda métrica monetaria del dashboard SHALL exponer su valor en ARS y su valor en USD como **cantidades independientes**, cada una derivada de los movimientos de su propia moneda. El dashboard SHALL NOT sumar ARS con USD ni convertir entre monedas, y NO SHALL depender de ningún tipo de cambio global: el FX del sistema vive por transacción (`transactions.fx_rate_to_ars`) y no existe una cotización de cuenta.

El valor ARS SHALL renderizarse siempre como titular de la métrica. El valor USD SHALL renderizarse como línea subordinada **únicamente cuando hay actividad en dólares**; si no la hay, la línea USD NO SHALL ocupar espacio. Un usuario sin actividad en dólares SHALL ver la pantalla como monomoneda, sin líneas vacías ni ceros decorativos.

Esa decisión SHALL tomarse **por bloque de montos pares**, no monto por monto. En un bloque de montos que el usuario compara entre sí —los tres del "Resumen del mes", los tres tiles de "Cuánto gastaste"— basta con que **uno** tenga valor en dólares para que **todos** rendericen su línea USD, aunque a alguno le toque cero. Ocultarla solo donde el valor es cero deja una columna más alta que sus vecinas y rompe la comparación, que es justamente para lo que están puestas una al lado de la otra.

Los porcentajes derivados —el reparto de cuentas de "Dónde está", la barra apilada de Compromisos y el ritmo— SHALL calcularse **dentro de una misma moneda**, nunca sobre un total mezclado.

#### Scenario: Usuario sin movimientos en dólares

- **WHEN** un usuario cuyo saldo y movimientos del mes son íntegramente en ARS abre el dashboard
- **THEN** cada métrica muestra únicamente su monto en ARS
- **AND** ninguna sección renderiza una línea USD en cero

#### Scenario: Usuario con actividad en ambas monedas

- **WHEN** un usuario tiene saldo en ARS y saldo en USD
- **THEN** el saldo disponible muestra el total ARS como titular y el total USD como línea subordinada
- **AND** los dos montos son saldos reales de su moneda, no uno la conversión del otro

#### Scenario: Un bloque con dólares en un solo monto

- **WHEN** en el "Resumen del mes" solo "Tenías" tiene valor en dólares y los dos flujos están en cero
- **THEN** las tres columnas renderizan su línea USD, las dos en cero incluidas
- **AND** las tres quedan a la misma altura y se pueden comparar de un vistazo

#### Scenario: Los porcentajes no cruzan monedas

- **WHEN** el bloque "Dónde está" calcula el porcentaje de una cuenta en USD
- **THEN** el denominador es el total en USD del usuario
- **AND** el total en ARS no participa del cálculo


---

### Requirement: La zona clara de la card de saldo muestra el "Resumen del mes" con Tenías, Entró y Se fué

La card de saldo SHALL cerrar con una zona clara titulada "Resumen del mes", separada de la zona oscura por un borde superior, con **tres bloques en tres columnas iguales**: "Tenías", "Entró" y "Se fué". Cada bloque SHALL mostrar un punto de color, su monto ARS y —según la regla bimoneda— su monto USD debajo.

La grilla SHALL ocupar el ancho de la card en **tres columnas iguales**, y cada bloque SHALL alinearse dentro de la suya de modo que los tres **lleguen a los dos bordes**: el primero pegado a la izquierda —en el mismo eje que el título—, el último pegado a la derecha, el del medio centrado.

Los tres estuvieron alineados a la izquierda, con el argumento de que una sola regla de alineación se lee como una pieza. Con datos reales no se lee así: el contenido es más angosto que su tercio, así que los tres quedaban amontonados a la izquierda y sobraba una franja muerta contra el borde derecho de la card, con el bloque visiblemente descentrado.

Las columnas SHALL seguir siendo **tercios iguales**: la posición de cada monto NO SHALL depender de su contenido, o los tres saltarían de lugar al navegar de un mes a otro, que es justo lo que hay que poder comparar. Es la alineación de cada columna la que empuja el contenido hacia los bordes, no el ancho de la columna.

**En pantallas angostas los tres SHALL apilarse**, una fila cada uno con el rótulo a la izquierda y el monto a la derecha. Tres tercios de una card de ancho de teléfono son ~105px, y un monto de ocho cifras necesita más del doble: en tres columnas los montos se imprimían **encima** unos de otros. Achicar la tipografía hasta que entren tampoco sirve —deja de leerse—, así que cada monto se lleva una fila entera. Es la misma composición en las dos plataformas: nativo apila siempre.

**El paso tipográfico SHALL decidirse una sola vez para los tres**, igual que en los tiles y por la misma razón: tres montos que achican en puntos distintos dejan de compararse, y el arrastrado puede terminar más chico que los flujos.

Un monto muy largo SHALL seguir quedando adentro de su tercio: la regla de densidad achica la tipografía antes de que llegue a su vecino.

Los montos SHALL achicarse por pasos con la misma regla compartida que los tiles de "Cuánto gastaste", sobre la escala propia de esta zona.

"Tenías" es aquello con lo que el usuario **entró al mes**, y SHALL derivarse —no leerse— de los otros montos de la card, de modo que los tres cierren contra el monto de la zona oscura **por construcción** y no por que dos lecturas coincidan.

En un **mes pasado** la zona SHALL seguir cerrando exactamente como hasta ahora, contra el saldo al cierre:

```
Tenías + Entró − Se fué  ===  el saldo que muestra la card arriba
```

Ese es el punto de los tres montos juntos: la card queda auditable en pantalla, sin salir a buscar nada.

**En el mes corriente**, donde la zona oscura muestra el disponible real, la zona clara SHALL agregar **una fila propia bajo una regla** y la identidad SHALL extenderse:

```
Tenías + Entró − Se fué − Guardado  ===  el disponible que muestra la card arriba
```

donde **`Guardado` es el total apartado**, meses anteriores incluidos, y **`Tenías` sigue siendo el saldo de cuentas** con el que se abrió el mes — el mismo significado que en un mes pasado, y el mismo número que tendría sin nada guardado.

Esa combinación es deliberada y es lo que hace la card verificable. La alternativa —restar solo el **flujo del mes** y que `Tenías` pase a ser "el disponible con el que entraste"— también cierra, pero **netea las reservas de meses anteriores adentro de un número que no lo dice**: alguien que suma los tres montos no puede reconstruir dónde fueron a parar esos pesos, y `Tenías` deja de ser algo que el usuario pueda verificar contra sus propias cuentas. Restar el stock los pone **en pantalla, una vez, con nombre**.

El flujo del mes no se pierde: vive en la **vista de detalle**, que es donde corresponde la pregunta *"¿qué hice este mes?"*.

Esa fila NO SHALL sumarse como cuarta columna de la tira: SHALL renderizarse **debajo de una regla**, a lo ancho, con el rótulo a la izquierda y el monto a la derecha. La tira de tres es **liquidez** —plata entrando y saliendo de las cuentas— y guardar no es ninguna de las dos cosas: es una decisión sobre plata que se quedó donde estaba. Meterla como cuarto hermano diría que es lo mismo que un ingreso o un gasto.

**En el mes corriente la fila SHALL renderizarse siempre**, en uno de dos estados, y SHALL ser tocable en los dos:

| Estado | Rótulo | Monto | Adónde lleva |
|---|---|---|---|
| Hay algo guardado | *Guardado* | el **total**, con signo menos | detalle del guardado |
| No hay nada guardado | *Guardar algo* | ninguno | drawer de Guardar |

Renderizarla solo cuando hay actividad dejaría dos agujeros, y los dos son de uso normal: quien guardó en agosto y en septiembre no tocó nada **vería el Hero restando una plata que la pantalla no nombra en ningún lado**, sin forma de llegar al detalle; y quien descartó la sugerencia y se arrepiente tres días después no tendría por dónde volver. El acto tiene que tener una puerta que no dependa de haberlo hecho antes.

El estado sin stock SHALL abrir **directamente el drawer de Guardar**, no un detalle vacío: no hay nada que mirar todavía. SHALL renderizarse como una sola fila en gris, sin monto, sin ícono y sin color — es el precio de la puerta permanente para quien nunca va a guardar, y hay que mantenerlo en una línea.

El monto SHALL llevar **signo menos** —salió de lo que el usuario puede gastar— y renderizarse en **emerald**, no en terracota: el terracota está reservado en Grana para lo que está por pagar o vencido, y esto es progreso.

El stock SHALL leerse de la función normativa `get_available_sums(p_today)`, por moneda, y el dashboard NO SHALL calcularlo por su cuenta.

En un mes que **no** es el corriente la fila NO SHALL renderizarse, ni la regla: la zona SHALL verse exactamente como antes de existir el guardado.

La zona clara SHALL seguir siendo read-only en todo lo demás: la fila navega o abre un overlay, no edita.

La zona SHALL leerse como **liquidez**: cómo se movió el dinero dentro y fuera de las cuentas en el mes. Por lo tanto, **todo movimiento que haya tocado el saldo de una cuenta SHALL caer de exactamente uno de los dos lados**, según su signo: "Entró" suma los ingresos, los reintegros recibidos y el lado positivo de los buckets con signo (liquidaciones a favor, la pata de destino de un cambio de moneda, un ajuste positivo); "Se fué" suma los gastos pagados desde una cuenta, los pagos de resumen de tarjeta y el lado negativo de esos mismos buckets.

Guardar y liberar NO SHALL participar de "Entró" ni de "Se fué": no son movimientos, no tocan el saldo de ninguna cuenta y no crean filas en `transactions`. El invariante de liquidez que gobierna la tira queda **intacto**: dentro de cada moneda, `Entró − Se fué` SHALL seguir siendo igual al cambio del **saldo de las cuentas** en el mes, al centavo, sin importar cuánto haya guardado el usuario. La derivación SHALL usar aritmética de dinero exacta —no punto flotante crudo— para que la igualdad se sostenga y pueda testearse sin tolerancia.

Los **consumos con tarjeta de crédito** NO SHALL restar de "Se fué". No es una exclusión que haya que aplicar: son filas off-ledger que nunca tocan el saldo de una cuenta. Lo que sí SHALL restar es el **pago del resumen**, que es plata saliendo de la cuenta.

Los montos SHALL responder al selector de mes. La zona NO SHALL renderizar la barra apilada de ingresos/gastos, la fila "Ajustes" ni el link "Ver detalle" de la sección que reemplaza: el resumen se agota en los tres montos y, cuando corresponde, la línea del guardado.

#### Scenario: Mes con ingresos y egresos

- **WHEN** el usuario mira un mes con movimientos
- **THEN** "Entró" muestra todo lo que aumentó el saldo de sus cuentas ese mes y "Se fué" todo lo que lo bajó
- **AND** los dos bloques quedan centrados en columnas de igual ancho

#### Scenario: Los tres montos cierran contra el saldo

- **WHEN** el usuario mira un mes pasado con ajustes, liquidaciones o cambios de moneda además de ingresos y gastos
- **THEN** cada uno de esos movimientos aparece sumado en "Entró" o en "Se fué" según su signo
- **AND** `Tenías + Entró − Se fué` es igual al saldo que muestra la zona oscura de la card

#### Scenario: El mes corriente cierra con el guardado

- **WHEN** el usuario abrió el mes con $1.000.000 en sus cuentas, le entraron $2.000.000, se le fueron $1.200.000 y tiene $490.000 guardados
- **THEN** la fila muestra `−$490.000` en emerald, debajo de una regla
- **AND** la zona oscura muestra $1.310.000
- **AND** `1.000.000 + 2.000.000 − 1.200.000 − 490.000` es igual a ese $1.310.000

#### Scenario: Guardar no altera la tira de liquidez

- **WHEN** el usuario guarda $200.000
- **THEN** "Entró" y "Se fué" quedan exactamente iguales que antes de guardar
- **AND** `Entró − Se fué` sigue siendo igual al cambio del saldo de sus cuentas en el mes

#### Scenario: El total incluye lo guardado en meses anteriores

- **WHEN** el usuario guardó $300.000 en julio y este mes guardó $190.000 netos
- **THEN** la fila muestra $490.000
- **AND** "Tenías" es el saldo de cuentas con el que abrió el mes, sin descontar nada
- **AND** `Tenías + Entró − Se fué − 490.000` es igual al disponible

#### Scenario: "Tenías" no cambia con lo guardado

- **WHEN** se compara la card de un usuario con $490.000 guardados contra la del mismo mes sin nada guardado
- **THEN** "Tenías" es el mismo número en las dos
- **AND** lo único que cambia es la fila del guardado y el disponible

#### Scenario: El usuario que nunca guardó tiene puerta al acto

- **WHEN** el usuario no tiene nada guardado
- **THEN** la fila muestra "Guardar algo", sin monto
- **AND** tocarla abre el drawer de Guardar, no un detalle vacío

#### Scenario: La fila no aparece en meses pasados

- **WHEN** el usuario navega a un mes anterior en el que sí había guardado
- **THEN** ni la fila ni la regla se renderizan, en ninguno de sus estados
- **AND** los tres montos cierran contra el saldo al cierre de ese mes

#### Scenario: Un mes arrastrado de meses anteriores

- **WHEN** el usuario venía de meses con más egresos que ingresos
- **THEN** "Tenías" muestra ese arrastrado, en negativo si corresponde
- **AND** el usuario puede leer en la misma card de dónde sale el número del mes

#### Scenario: Una compra con tarjeta de crédito no baja el mes

- **WHEN** el usuario paga una compra con tarjeta de crédito
- **THEN** ese consumo NO aparece en "Se fué"
- **AND** cuando pague el resumen de esa tarjeta, ese pago sí aparece en "Se fué" del mes en que lo pague

#### Scenario: Mes sin movimientos

- **WHEN** el usuario navega a un mes sin ningún movimiento
- **THEN** ambos bloques muestran cero en ARS
- **AND** la zona sigue renderizando, sin desmontarse
### Requirement: La card "Cuánto gastaste" descompone el gasto propio del mes en Gastaste, Ya se pagó y Por pagar

El dashboard SHALL renderizar una card "Cuánto gastaste" con **tres tiles** de igual ancho, cada uno con ícono tintado, rótulo, monto en el color del bloque, línea USD según la regla bimoneda y un filete de color al pie:

- **Gastaste** = total de gastos devengados del mes.
- **Ya se pagó** = los que ya están saldados: la plata salió de alguna cuenta.
- **Por pagar** = los que siguen montados en una tarjeta de crédito.

`Ya se pagó + Por pagar` SHALL ser igual a `Gastaste` dentro de cada moneda.

**Cómo se clasifica cada movimiento.** Los tres montos NO SHALL derivarse restando agregados entre sí, sino ubicando **cada movimiento del mes en exactamente uno de cuatro cajones**, según dos preguntas: si está montado en una tarjeta de crédito, y de quién es la cuenta o la tarjeta.

| | Cuenta/tarjeta del usuario | Cuenta/tarjeta del otro miembro |
|---|---|---|
| **No es tarjeta** | Ya se pagó · lo pusiste vos | Ya se pagó · lo puso el otro |
| **Es tarjeta** | Por pagar · en tus tarjetas | Por pagar · se lo debés al otro |

De ahí salen los tres montos y las dos aperturas a la vez, y la identidad se sostiene por construcción en vez de por que dos lecturas coincidan.

El conjunto de movimientos que entra SHALL ser el mismo que el del desglose por categoría de Movimientos —mismo corte temporal, mismas exclusiones (la fila madre de una compra en cuotas y el pago de resumen, que cancela deuda y no es gasto nuevo), misma resolución de la parte propia—, de modo que las dos superficies nunca discrepen sobre **qué** cuenta como gasto del usuario aunque lo agrupen distinto.

**Reintegros recibidos.** Un reintegro SHALL restar del cajón donde efectivamente cayó: acreditado a una cuenta baja "Ya se pagó", acreditado a un resumen baja "Por pagar". Restarlo en otro lado rompería la identidad. Cada cajón SHALL tener **piso en cero**: un reintegro mayor que el gasto de su cajón es un crédito, no un gasto negativo, y un monto negativo bajo el rótulo "ya se pagó" no significa nada.

**Movimiento sin cuenta identificable.** Un movimiento cuya cuenta no se puede resolver SHALL omitirse en lugar de asignarse a un cajón por defecto. Adivinar movería plata entre "ya está saldado" y "todavía lo debés", que es precisamente la distinción que esta card existe para sostener.

**La card entera SHALL leerse en una sola unidad: los gastos PROPIOS del usuario.** De un movimiento compartido SHALL tomar únicamente la parte asignada al usuario, en los tres montos por igual. La lente de caja —pesos moviéndose por las cuentas, montos completos— es la de la card de saldo ("Se fué"); mezclarlas es lo que producía el defecto que este requirement reemplaza: `Te queda por pagar` restaba un monto completo (`totalExpense`) de un monto "tu parte" (el devengado), subestimando la deuda de tarjeta en la parte del otro miembro de cada gasto compartido que el usuario había adelantado.

El rótulo "Ya se pagó" SHALL ser **impersonal**. Un gasto compartido que pagó el otro miembro está saldado con el comercio pero no con el usuario: decir "Pagaste" sería falso. Los otros dos rótulos hablan del estado de esa plata; solo "Gastaste" habla del usuario, y esa asimetría gramatical es deliberada.

La card SHALL renderizarse siempre que haya gasto en el mes, **incluso cuando "Por pagar" es cero**: un cero es información. La card NO SHALL desmontarse por ausencia de consumo de tarjeta.

**Los montos NO SHALL recortarse nunca.** Los tiles SHALL sostener montos de hasta diez dígitos con centavos (`$ 1.234.567.890,00`) dentro de un tercio del ancho de la card, achicando el cuerpo del monto por pasos a medida que crece. Un monto de dinero cortado no se lee como incompleto: se lee como **otro número**, y es la peor falla que esta card puede tener. Los pasos SHALL derivarse de una regla compartida entre plataformas —del largo del texto formateado, que es lo que consume ancho— para que las dos achiquen en el mismo punto aunque sus tamaños difieran.

En desktop, de las dos cards de la fila 2 la de "Cuánto gastaste" SHALL ser la más ancha: sus tres tiles se reparten el ancho en tercios, mientras que "Compromisos" apila filas de ancho completo y tolera mejor un ancho menor.

Los tres tiles SHALL **absorber el alto sobrante de la card**: crecen para llenarlo, con un alto mínimo propio y el contenido centrado. La card comparte fila con "Compromisos" y esa fila mide lo que mide la card más alta, así que esta card recibe alto que su contenido no pide. Con los tiles rígidos y la tira de ritmo clavada al pie, ese sobrante se acumulaba **entre los tiles y la tira**, que es el peor lugar posible: un agujero en el medio de la card. Elásticos, el sobrante se convierte en aire adentro del tile. La tira de ritmo NO SHALL anclarse al pie: con los tiles absorbiendo, anclarla vuelve a abrir el hueco que se acaba de cerrar.

Los tres SHALL crecer **por igual** —son una comparación de tres montos y un tile más alto que sus vecinos la rompe— y las dos caras de un tile SHALL crecer igual entre sí.

Como el contenido va **centrado en vertical**, cualquier diferencia de alto entre los tres los desalinea. De ahí dos reglas que valen para todo el bloque, no tile por tile:

- **El paso tipográfico del monto SHALL decidirse una sola vez para los tres**, tomando el más ajustado que necesite cualquiera de ellos. Calculado por tile, el tipo saltaba de un tile a otro y —peor— invertía la jerarquía: "Gastaste $ 1.020.283,17" se renderizaba **más chico** que "Por pagar $ 79.894,67", con el titular quedando subordinado al monto que se deriva de él. Es la misma regla que ya sigue la línea USD.
- **La franja inferior SHALL tener un alto único**, sea cual sea su variante. La leyenda ocupa dos líneas y la invitación a abrir una sola; dejar que la franja se dimensione sola bajaba los tiles que se abren respecto de su vecino y la fila dejaba de leerse como fila.

**Los tiles tienen dos variantes**, con la misma caja y el mismo alto **entre sí** —dar vuelta un tile nunca lo cambia de tamaño—, y solo cambia su franja inferior:

- **Sin actividad compartida** — el tile NO se abre y muestra una **leyenda de contexto** de dos líneas.
- **Con actividad compartida** — "Ya se pagó" y "Por pagar" pasan a **abrirse**, y la apertura reemplaza a la leyenda en esa misma franja.

Esa división NO es decorativa. Las leyendas "Ya salió de tus cuentas" y "Se paga en los próximos resúmenes" son **verdaderas exactamente cuando no hay actividad compartida**, que es la variante que las muestra; con otro miembro involucrado la plata pudo salir de la cuenta de él, o la deuda ser con él, y esa es justamente la variante que se abre. Cada variante lleva el copy que es cierto en ella.

"Gastaste" NO SHALL abrirse en ninguna variante y SHALL conservar su leyenda en las dos: su copy es verdadero siempre.

Cada apertura SHALL responder la pregunta que le corresponde, que no es la misma para los dos:

- "Ya se pagó" se abre por **quién puso la plata**: lo pusiste vos / lo puso el otro miembro (saldado con el comercio, pendiente con él).
- "Por pagar" se abre por **a quién le debés**: en tus tarjetas (viene en tu resumen) / se lo debés al otro miembro (está en la tarjeta de él, no viene en ningún resumen tuyo).

SHALL haber **un solo tile abierto a la vez**: dos aperturas simultáneas compiten por la misma lectura.

**Accesibilidad de la apertura.** El control SHALL exponer su estado (`aria-expanded` en web, `accessibilityState.expanded` en nativo) y la cara oculta NO SHALL quedar en el árbol de accesibilidad. Ocultarla solo visualmente —por ejemplo con `backface-visibility`— deja que un lector de pantalla lea las dos caras a la vez; hace falta `aria-hidden` o no montarla. En mobile el área táctil SHALL ser de al menos 44px.

El texto que invita a abrir NO SHALL repetir el del link del header de la card: son dos acciones distintas y el mismo rótulo para ambas hace que una de las dos mienta.

Lo que el usuario **adelantó por el otro miembro** NO SHALL aparecer en esta card. No es un gasto propio —es un préstamo—, su unidad es la de caja y no la de esta card, ya está reflejado en "Se fué" de la card de saldo, y el neto del hogar vive en la tira "Compartido". Mostrarlo acá agregaría un monto bruto del mes que competiría con el neto histórico de esa tira sin nada que explique la diferencia.

#### Scenario: Mes con gasto de caja y de tarjeta

- **WHEN** el usuario gastó en el mes tanto desde sus cuentas como con tarjeta de crédito
- **THEN** los tres tiles muestran sus montos y `Ya se pagó + Por pagar` es igual a `Gastaste`

#### Scenario: Mes sin consumo de tarjeta

- **WHEN** todo el gasto del mes salió de las cuentas
- **THEN** la card se renderiza igual, con "Por pagar" en cero
- **AND** "Ya se pagó" coincide con "Gastaste"

#### Scenario: Un gasto compartido que pagó el otro miembro

- **WHEN** el otro miembro paga desde su cuenta un gasto compartido
- **THEN** la parte del usuario suma en "Gastaste" y en "Ya se pagó"
- **AND** el desglose la ubica en "lo puso" el otro miembro, no en "lo pusiste vos"

#### Scenario: Un consumo en la tarjeta del otro miembro

- **WHEN** el otro miembro carga en SU tarjeta un consumo compartido
- **THEN** la parte del usuario suma en "Por pagar"
- **AND** el desglose la ubica como deuda con el otro miembro y NO como algo que venga en el resumen del usuario

#### Scenario: Usuario sin gastos compartidos en el mes

- **WHEN** el mes no tiene ningún movimiento compartido
- **THEN** la card no ofrece desglose
- **AND** los tres montos se leen sin controles adicionales

#### Scenario: Mes sin ningún gasto

- **WHEN** el usuario navega a un mes sin gastos
- **THEN** la card muestra su estado vacío
- **AND** no se desmonta ni deja un hueco en la grilla


---

### Requirement: La tira de ritmo compara el gasto del mes contra los ingresos del mes

La card "Cuánto gastaste" SHALL cerrar con una tira de ritmo que muestre un anillo con el porcentaje, el copy con el porcentaje destacado, una barra de progreso y el pie con los dos montos que forman el cociente.

El ritmo SHALL calcularse como `Gastaste / ingresos acreditados` **dentro de la misma moneda y el mismo mes**. El ritmo evalúa **el mes**: el saldo arrastrado de meses anteriores ("Tenías") NO SHALL participar de ninguno de los dos términos. La pregunta es cómo fue este mes, no cómo viene el usuario en general. El denominador SHALL ser el ingreso del mes (`totalIncome`), NO el "Entró" de "Resumen del mes": ese último es una lectura de liquidez que incluye reintegros, liquidaciones y patas de cambio de moneda, y meterlas en el denominador infla el ritmo con plata que no es ingreso. El sistema NO SHALL requerir un ingreso mensual esperado configurado por el usuario.

Se SHALL renderizar **un solo anillo, el de ARS**. El ritmo en USD NO SHALL renderizarse como segundo anillo.

Dos estados SHALL tratarse como estados de primera clase, no como bordes excepcionales, porque con este denominador son habituales:

- **Ritmo indeterminado** (ingresos del mes en cero, típico a comienzo de mes): el sistema SHALL mostrar un mensaje explicativo **en lugar del anillo**, y NO SHALL mostrar 0% ni dividir por cero.
- **Ritmo mayor a 100%**: el anillo y la barra SHALL pasar al color de alerta (terracota), y tanto el anillo como el copy SHALL expresar la relación como **múltiplo**, no como porcentaje. Pasado el 100% el porcentaje deja de ser la unidad adecuada: "el 1020%" hay que decodificarlo, "10 veces" no. Además un porcentaje de cuatro cifras no entra en el agujero del anillo y se recorta, que en un número de dinero es la peor falla posible.
- **Ritmo desbordado**: cuando el cociente supera un umbral de escala, el sistema NO SHALL mostrar el anillo ni el porcentaje, y SHALL mostrar en su lugar un mensaje con un ícono, en el tono de la app, acompañado de **los dos montos que lo produjeron**. Con un denominador cercano a cero —un mes cuyo único ingreso fueron centavos— el cociente se va a los millones: es aritméticamente correcto y no es una lectura, y un número capeado tampoco lo sería. Este estado NO SHALL confundirse con el indeterminado: acá **sí entró plata**, solo que poca, y decir "todavía no entró plata este mes" sería falso. El umbral SHALL ubicarse donde el número deja de informar, no donde se pone grande: un mes en que se gastó diez veces el ingreso es extraordinario pero perfectamente legible y SHALL conservar su porcentaje.

#### Scenario: Mes con ingresos y gasto por debajo

- **WHEN** en el mes entraron ingresos y el gasto es menor
- **THEN** el anillo muestra el porcentaje `Gastaste / ingresos del mes` y la barra se llena en esa proporción
- **AND** el pie muestra los dos montos ARS que forman el cociente

#### Scenario: Comienzo de mes sin ingresos acreditados

- **WHEN** el usuario abre el dashboard antes de que se acredite ningún ingreso del mes
- **THEN** la tira muestra un mensaje explicativo en lugar del anillo
- **AND** no se renderiza ningún porcentaje

#### Scenario: El gasto supera los ingresos del mes

- **WHEN** `Gastaste` es mayor que los ingresos acreditados del mes
- **THEN** el anillo y la barra se pintan en el color de alerta
- **AND** el anillo y el copy expresan la relación como múltiplo ("10 veces"), no como porcentaje

#### Scenario: Un monto largo no se recorta

- **WHEN** un tile tiene que mostrar un monto de diez dígitos con centavos
- **THEN** el monto se renderiza completo, con el cuerpo achicado
- **AND** las dos plataformas achican en el mismo punto

#### Scenario: Un mes con ingresos de centavos

- **WHEN** el usuario gastó cientos de miles en un mes cuyo único ingreso fueron unos centavos
- **THEN** la tira muestra un mensaje con ícono en lugar del anillo y del porcentaje
- **AND** acompaña los dos montos que lo produjeron
- **AND** NO dice que todavía no entró plata, porque sí entró


---

### Requirement: El detalle de "Compromisos del próximo mes" reemplaza en una zona de alto fijo

La card de compromisos NO SHALL cambiar de alto al mostrar un detalle. Las dos cards de la fila 2 comparten alto —la fila mide lo que mide la más alta— y "Cuánto gastaste" no tiene contenido con qué llenar el alto extra, así que **todo lo que crece en Compromisos aparece como un hueco blanco en la card de al lado**. Un desplegable hacia abajo sumaba ~280px de un golpe y el hueco quedaba en el medio de la card vecina, que es donde peor se lee.

El detalle SHALL vivir en una **zona de alto fijo** al pie de la card, que ocupa el alto sobrante y NO SHALL crecer con su contenido. La zona SHALL tener dos estados que ocupan exactamente el mismo espacio:

- **Resumen** — una fila por grupo (Tarjetas y Gastos fijos), cada una con su total comprometido y **cuántos ítems lo componen**, de modo que el estado por defecto responda la pregunta sin tocar nada. Las filas SHALL estirarse para llenar la zona.
- **Detalle** — la lista de UN grupo, con una cabecera que lo nombra, repite su total y ofrece **volver** al resumen. La lista SHALL scrollear dentro de la zona cuando no entre; la card completa NO SHALL scrollear.

El detalle **reemplaza** al resumen, no se agrega debajo: por eso hay uno solo a la vez y no hay estado en el que se vean los dos totales y una lista al mismo tiempo. Es el mismo gesto que ya usan los tiles de "Cuánto gastaste", que se dan vuelta sin cambiar de tamaño; las dos cards de la fila SHALL comportarse igual entre sí.

**Accesibilidad del reemplazo.** No es un desplegable, así que NO SHALL usar `aria-expanded`: el control no revela un panel adjunto, cambia el contenido de una región. La zona SHALL ser una región rotulada, y al abrir un detalle el foco SHALL moverse al control de volver; al volver, SHALL regresar al control del grupo que se había abierto. Sin ese movimiento, quien navega por teclado activa un botón que desaparece y pierde el foco al `<body>`. En mobile, el área táctil de cada control SHALL ser de al menos 44px.

El grupo **Tarjetas** SHALL listar una fila **por tarjeta** con su total comprometido —no consumos individuales—, ordenadas por monto descendente. El grupo **Gastos fijos** SHALL listar hasta 10 filas y un link al listado completo.

**El aviso de vencido SHALL ocupar una sola línea**, dentro del bloque del total y debajo de la barra apilada. Es una nota al pie de ese total —dice explícitamente que no forma parte de él—, no un bloque que compita con él, y tres renglones para un dato de una línea empujan el alto de toda la fila.

#### Scenario: Usuario abre el detalle de tarjetas

- **WHEN** el usuario activa la fila del grupo Tarjetas
- **THEN** la zona pasa a mostrar la lista de tarjetas con su control de volver
- **AND** la card mide exactamente lo mismo que antes de abrirla

#### Scenario: Usuario vuelve al resumen

- **WHEN** el usuario activa el control de volver
- **THEN** la zona muestra otra vez las dos filas con sus totales
- **AND** el foco vuelve a la fila del grupo que estaba abierto

#### Scenario: Usuario con varias tarjetas

- **WHEN** el usuario tiene cinco tarjetas con compromiso en el próximo mes
- **THEN** la fila del grupo informa el total y que son cinco tarjetas
- **AND** al abrir el detalle aparecen las cinco, ordenadas por monto descendente

#### Scenario: Lista más larga que la zona

- **WHEN** el usuario tiene más gastos fijos de los que entran en la zona
- **THEN** la lista scrollea dentro de la zona
- **AND** ni la card de compromisos ni la fila cambian de alto

#### Scenario: Mes con un resumen vencido

- **WHEN** hay un resumen vencido e impago
- **THEN** el aviso ocupa una sola línea debajo de la barra del total
- **AND** el alto de la card no se despega del de "Cuánto gastaste"


---

### Requirement: La tira "Compartido" muestra el neto del Hogar en web y en mobile cuando hay actividad

El dashboard SHALL renderizar al pie una tira "Compartido" —una sola línea clickeable que navega al módulo Compartido— **en ambas plataformas**. La tira SHALL mostrar el ícono, el nombre del Hogar y el saldo neto en una sola dirección: "Te deben" en verde cuando el saldo favorece al usuario, "Debés" en terracota cuando va en contra. Con lugar de sobra SHALL agregar los avatares apilados del grupo y nombrar al otro miembro en la bajada.

En pantallas angostas la tira SHALL mantenerse en **una sola fila**, y SHALL ganarse ese lugar soltando justamente esos dos agregados. El nombre del propio Hogar ya dice de quién es esa plata, y las iniciales lo dicen por tercera vez justo donde menos lugar hay para decirlo una. El bloque de identidad SHALL ser el que se achica; el monto NO SHALL ser nunca el que cede.

La tira SHALL renderizarse **únicamente cuando hay actividad compartida**. Sin actividad, NO SHALL renderizarse ni dejar espacio reservado.

#### Scenario: Hogar con saldo a favor del usuario

- **WHEN** el hogar tiene actividad y el neto favorece al usuario
- **THEN** la tira muestra "Te deben" con el monto en verde
- **AND** se renderiza tanto en web como en la app nativa

#### Scenario: Usuario sin actividad compartida

- **WHEN** el usuario no tiene ningún hogar con actividad
- **THEN** la tira no se renderiza en ninguna plataforma
- **AND** el dashboard no deja un hueco al pie
