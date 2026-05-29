# dashboard Specification

## Purpose

Define la pantalla `/dashboard` como landing universal post-login y post-onboarding (idéntica en web y mobile). Es read-only y se compone de tres secciones en orden fijo: Hero "Para gastar" con disponible bimoneda y eye toggle de privacidad, "Lo que viene" con compromisos firmes y recurrencias de los próximos 14 días, y Balance del mes con gráfico de línea y navegador mensual. En desktop (web) el dashboard reorganiza esas secciones en un layout multi-columna; el resumen de tarjetas NO vive en el dashboard sino en `/cards`. Toda interacción navega al módulo correspondiente; el dashboard no muta datos.
## Requirements
### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

El dashboard SHALL renderizar **tres** secciones en orden vertical (mobile) o reorganizadas en desktop: Hero → Lo que viene → Balance del mes. La sección Tarjetas NO forma parte del dashboard; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza las tres secciones (Hero, Lo que viene, Balance del mes) en orden fijo
- **AND** NO redirige a `/cards`

#### Scenario: Login exitoso aterriza en dashboard

- **WHEN** un usuario con onboarding completado hace login
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Arranque con sesión activa aterriza en /dashboard renderizado (mobile)

- **WHEN** un usuario mobile con sesión válida persistida abre la app
- **THEN** la app aterriza en `(app)/dashboard` con las tres secciones renderizadas (Hero, Lo que viene, Balance del mes)
- **AND** NO renderiza el placeholder "Dashboard" de texto plano

---

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En viewports `lg` (≥1024px) y mayores, la pantalla `/dashboard` web SHALL reorganizar sus secciones en un layout multi-columna en lugar de la columna única mobile-first: el Hero ocupa el ancho completo arriba; debajo, "Balance del mes" y "Lo que viene" se muestran lado a lado, con "Balance del mes" creciendo para ocupar el ancho disponible y "Lo que viene" como rail de ancho acotado a la derecha. Ambas columnas SHALL igualar su altura. Por debajo de `lg`, el dashboard SHALL mantener la columna única mobile-first actual.

#### Scenario: Desktop ancho muestra dos columnas con alturas igualadas

- **WHEN** un usuario carga `/dashboard` en un viewport de 1440px
- **THEN** el Hero ocupa el ancho completo arriba
- **AND** "Balance del mes" y "Lo que viene" se muestran lado a lado debajo del Hero
- **AND** ambas columnas terminan a la misma altura

#### Scenario: Entre md y lg el dashboard sigue en columna única

- **WHEN** un usuario carga `/dashboard` en un viewport de 820px (sidebar visible)
- **THEN** las secciones se apilan en una sola columna (Hero → Lo que viene → Balance del mes)

#### Scenario: Bajo md el dashboard es mobile-first

- **WHEN** un usuario carga `/dashboard` en un viewport de 375px
- **THEN** las secciones se apilan en una sola columna

---

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}.` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola.") cuando el perfil no tiene nombre. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El `eye toggle` siempre vive en este header; el botón "Nuevo movimiento" vive en este header **solo en desktop-web** (viewport `≥sm`) — en mobile-web el acceso primario para registrar es el FAB definido en la spec de `transactions` y NO se renderiza en el header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") aunque exista un perfil con nombre, y los controles que sí vivan en el header en el viewport activo SHALL renderizarse en estado disabled (ver sus respectivos requirements). En desktop-web esto cubre el `eye toggle` y el botón "Nuevo movimiento"; en mobile-web cubre únicamente el `eye toggle`. Cuando la query del perfil resuelve, el header SHALL actualizarse al saludo personalizado y habilitar los controles del header. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero los controles SHALL pasar a estado habilitado para no bloquear al usuario.

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

#### Scenario: El header se ve antes de que resuelva la query del perfil (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** sus controles (`eye toggle`, "Nuevo movimiento") están visibles pero disabled

#### Scenario: El header se ve antes de que resuelva la query del perfil (mobile-web)

- **WHEN** un usuario web en viewport `<sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola." (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** el `eye toggle` está visible pero disabled
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

### Requirement: El header del dashboard ofrece un acceso primario para registrar un movimiento (web)

En web **desktop** (viewport `≥sm`), el header del dashboard SHALL incluir un botón primario "Nuevo movimiento" (estilo `positive`/emerald) que navega a la creación de movimiento (`/transactions/new`). El label del botón SHALL leerse del catálogo i18n (no hardcodeado). En web **mobile** (viewport `<sm`), el botón NO SHALL renderizarse en el header: el acceso primario en ese viewport es el FAB definido en la spec de `transactions` (mobile-only en web). En la app nativa este acceso NO es parte del header del dashboard; en native el acceso primario es el FAB nativo definido en la spec de `transactions`.

Mientras el header esté en su estado de carga (ver requirement del saludo), el botón "Nuevo movimiento" — cuando se renderice en el viewport activo — SHALL renderizarse en estado **disabled**: SHALL aparecer con su tipografía e ícono completos pero sin envolver un `<Link>` (ni equivalente navegable), y SHALL no responder a clicks. Cuando el header sale del estado de carga, el botón SHALL pasar a su rendering normal (`<Button asChild><Link href="/transactions/new">…</Link></Button>` o equivalente).

#### Scenario: El botón navega a la creación de movimiento (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` toca "Nuevo movimiento" en el header del dashboard una vez habilitado
- **THEN** navega a `/transactions/new`

#### Scenario: El label del botón es traducible

- **WHEN** un desarrollador inspecciona el botón "Nuevo movimiento"
- **THEN** su label se obtiene del catálogo i18n, sin string hardcodeado

#### Scenario: El botón se renderiza disabled mientras el header carga (desktop-web)

- **WHEN** el header del dashboard está en su estado de carga en viewport `≥sm` (query del nombre sin resolver)
- **THEN** "Nuevo movimiento" se muestra con su label e ícono pero deshabilitado
- **AND** no responde a clicks
- **AND** NO envuelve a un `<Link>` (no es navegable mientras está disabled)

#### Scenario: El botón no se renderiza en mobile-web

- **WHEN** un usuario web en viewport `<sm` abre `/dashboard`
- **THEN** el header NO contiene el botón "Nuevo movimiento" en ningún estado (loading o habilitado)
- **AND** el acceso primario para registrar un movimiento en ese viewport es el FAB definido en la spec de `transactions`

### Requirement: La pantalla dashboard es read-only

El dashboard SHALL NOT exponer formularios, botones de creación, edición, eliminación, archivado ni confirmación de movimientos pendientes. Toda interacción que requiera modificar datos SHALL ocurrir en el módulo correspondiente (Cuentas, Tarjetas, Movimientos). Los elementos visibles en el dashboard PUEDEN ser clickeables como atajos de navegación a esos módulos, pero NO ejecutan mutaciones en sí mismos.

#### Scenario: Click en un ítem de "Lo que viene" navega al módulo correspondiente (web)

- **WHEN** el usuario hace click en un ítem de la sección "Lo que viene" que corresponde a un resumen de tarjeta cerrado
- **THEN** el sistema navega al detalle de ese período en `/cards/[accountId]/periods/[periodId]`
- **AND** NO abre un modal de pago de resumen ni dispara ninguna mutación

#### Scenario: Click en el Hero navega a Cuentas (web)

- **WHEN** el usuario hace click en el importe del Hero "Para gastar"
- **THEN** el sistema navega a `/accounts`

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

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor) lado a lado o stackeado. Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

En **desktop** (≥`lg`), además del disponible total, el Hero SHALL mostrar un desglose de hasta 2–3 cuentas `type IN ('cash','bank')` con su saldo y un enlace "Ver todas las cuentas" → `/accounts`. En **mobile** el Hero SHALL mantenerse minimal: solo el disponible total (ARS primario + USD subordinado), sin desglose. En ambos casos se respeta bimoneda (ARS primario, USD subordinado, sin merge entre monedas).

#### Scenario: Usuario con saldos en ambas monedas

- **WHEN** el usuario tiene una cuenta cash con $ 150.000 ARS + u$s 500 USD y una cuenta bank con $ 137.450 ARS + u$s 740,50 USD, sin pagos de resúmenes pendientes ya descontados
- **THEN** el Hero muestra `$ 287.450,00` en línea primaria y `u$s 1.240,50` en línea secundaria

#### Scenario: Consumo en tarjeta no reduce el disponible del Hero

- **WHEN** el usuario tiene $ 100.000 ARS disponibles y registra un consumo de $ 30.000 en su tarjeta Visa
- **THEN** el Hero sigue mostrando `$ 100.000,00`
- **AND** el consumo aparece en `/cards` y eventualmente en la sección "Lo que viene" cuando el resumen cierre

#### Scenario: Pago de resumen reduce el disponible

- **WHEN** el usuario paga el resumen de Visa por $ 145.200 desde una cuenta cash que tenía $ 287.450
- **THEN** el Hero pasa a mostrar `$ 142.250,00`

#### Scenario: Desktop muestra el desglose de cuentas; mobile no

- **WHEN** el usuario con dos cuentas cash/bank carga `/dashboard` en un viewport ≥1024px
- **THEN** el Hero muestra el disponible total y un desglose de esas cuentas con su saldo y un enlace "Ver todas las cuentas"
- **AND** en un viewport mobile el Hero muestra solo el disponible total (ARS + USD), sin desglose

---

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard.

El toggle SHALL aplicar al menos a: Hero (importes ARS y USD, y los saldos del desglose de cuentas en desktop), Lo que viene (importes individuales y totales) y Balance del mes (importes de ingresos, gastos y balance).

En **web**, el `eye toggle` SHALL permanecer montado y visible mientras el header esté en su estado de carga (query del nombre sin resolver), pero SHALL renderizarse **disabled** durante ese estado: no SHALL responder a clicks ni modificar el estado del `EyeMaskProvider`. Cuando el header sale del estado de carga, el toggle SHALL pasar a su comportamiento normal. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas y categorías permanecen visibles

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

La sección "Lo que viene" SHALL agrupar los eventos previstos en dos grupos — "A pagar" y "A cobrar" — para los próximos 14 días contados desde `getTodayAR()` inclusive. El **layout visual** de esos dos grupos es específico de cada plataforma (ver scenarios `(web)` y `(mobile)` más abajo).

La columna/sección "A pagar" SHALL incluir:

1. **Resúmenes de tarjeta cerrados pendientes de pago**: filas de `card_periods` con estado derivado `closed` o `overdue` (sin `period_payment`) cuyo `due_date` cae dentro del rango `[today, today+14d]`. Cada ítem SHALL mostrar la fecha de vencimiento, el nombre de la tarjeta, y el monto total del resumen.
2. **Instancias recurrentes salientes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `expense` o `transfer` (saliente).

La columna/sección "A cobrar" SHALL incluir:

1. **Instancias recurrentes entrantes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `income`.

La sección SHALL NOT incluir cuotas individuales (`transactions` con `parent_id NOT NULL`) como ítems propios. Las cuotas forman parte del monto de un resumen y se ven al abrir el detalle del período en el módulo cards.

La sección SHALL NOT incluir consumos del período abierto (estado derivado `open`), porque aún no son compromisos firmes (la fecha de cierre y el monto final pueden variar).

#### Scenario: Resumen cerrado próximo a vencer aparece en "A pagar"

- **WHEN** el usuario tiene un `card_periods` con estado derivado `closed`, `due_date='2026-05-27'` y total $ 145.200, y `today='2026-05-20'`
- **THEN** "A pagar" lista un ítem "27/05 — Visa Galicia — $ 145.200"

#### Scenario: Cuota individual no aparece como ítem propio

- **WHEN** el usuario tiene una compra en 6 cuotas asignada a un resumen que aparece en "A pagar"
- **THEN** la cuota individual NO aparece como ítem separado en "A pagar"
- **AND** el monto de la cuota está incluido en el total del resumen del ítem ya listado

#### Scenario: Recurrencia entrante aparece en "A cobrar"

- **WHEN** el usuario tiene una `recurrences` de tipo `income` con `recurrence_instances` no confirmada/no omitida y `expected_date='2026-05-30'` por $ 850.000, y `today='2026-05-20'`
- **THEN** "A cobrar" lista un ítem "30/05 — Sueldo — $ 850.000"

#### Scenario: Recurrencia ya confirmada no aparece en "Lo que viene"

- **WHEN** una `recurrence_instances` ya fue confirmada por el usuario (creó la transacción real)
- **THEN** NO aparece en "Lo que viene"
- **AND** sí aparece en el listado de Movimientos como cualquier otra transacción

#### Scenario: Resumen ya pagado no aparece en "A pagar"

- **WHEN** existe `period_payments` con `period_id=X`
- **THEN** el `card_periods` `X` NO aparece en "A pagar" aunque su `due_date` esté dentro del rango

#### Scenario: Consumo del período abierto no aparece en "A pagar"

- **WHEN** el usuario registra un consumo de $ 50.000 en una tarjeta cuyo período actual tiene estado derivado `open`
- **THEN** el consumo NO genera ítem propio en "A pagar"
- **AND** el período cuyo estado es `open` tampoco aparece en "A pagar" (aún no es compromiso firme)

#### Scenario: Sin eventos en el rango, la sección muestra estado vacío

- **WHEN** no hay resúmenes cerrados pendientes ni recurrencias previstas en los próximos 14 días
- **THEN** la sección renderiza un estado vacío con un mensaje neutral ("No tenés movimientos previstos en los próximos 14 días")
- **AND** la sección NO desaparece del layout

#### Scenario: Layout de "Lo que viene" en pantallas amplias usa dos columnas (web)

- **WHEN** el dashboard se renderiza en web
- **THEN** "A pagar" se ubica a la izquierda y "A cobrar" a la derecha, lado a lado
- **AND** los totales y el balance del período viven debajo de las dos columnas

#### Scenario: Layout de "Lo que viene" en mobile es stackeado verticalmente (mobile)

- **WHEN** el dashboard se renderiza en mobile
- **THEN** "A pagar" se renderiza primero con su lista y su total al pie
- **AND** debajo se renderiza "A cobrar" con su lista y su total al pie
- **AND** al final de las dos secciones se renderiza el "Balance del período" desglosado por moneda
- **AND** NO se usa scroll horizontal ni tabs para alternar entre los dos grupos

---

### Requirement: "Lo que viene" muestra totales por agrupación y balance del período

Para cada agrupación de "Lo que viene" ("A pagar" y "A cobrar"), la sección SHALL mostrar el total agregado por moneda. Si los ítems tienen monedas mixtas, el total se desglosa por moneda en líneas separadas. La sección SHALL mostrar un "Balance del período" calculado como `total a cobrar (ARS) − total a pagar (ARS)`, con su signo y color (verde si positivo, neutral si cero, coral si negativo). Si los importes de a pagar y a cobrar incluyen monedas distintas a ARS, el balance del período SHALL desglosarse por moneda; nunca SHALL convertir entre monedas (principio bimoneda).

La ubicación visual de los totales y del balance es específica de cada plataforma:

- En web (dos columnas), los totales viven debajo de cada columna y el balance debajo de las dos columnas.
- En mobile (stackeado vertical), el total de cada agrupación se renderiza al pie de su lista y el balance del período al final de toda la sección.

#### Scenario: Totales mixtos y balance positivo en ARS

- **WHEN** "A pagar" suma $ 425.200 (ARS) + u$s 230 (USD) y "A cobrar" suma $ 850.000 (ARS)
- **THEN** "A pagar" muestra `Total $ 425.200 · u$s 230`
- **AND** "A cobrar" muestra `Total $ 850.000`
- **AND** "Balance del período" muestra `+ $ 424.800` (en ARS, positivo, verde) y `− u$s 230` (en USD, negativo, coral) en líneas separadas

---

### Requirement: La sección "Balance del mes" muestra un gráfico de línea acumulada con navegador mensual

La sección SHALL renderizar un gráfico de línea cuyo eje X representa los días del mes seleccionado (1 a 28/29/30/31 según el mes), eje Y representa el balance acumulado en ARS desde el día 1 del mes hasta cada día inclusive (`balance acumulado = Σ ingresos − Σ gastos hasta el día i`), y cuyo trazo conecta esos puntos con interpolación lineal. La línea SHALL cruzar el eje X cuando el acumulado pase por cero (visualmente puede destacarse cuándo el usuario está "en verde" vs "en rojo" del mes).

Encima del gráfico, la sección SHALL mostrar un navegador mensual `◀ MES AÑO ▶` con el nombre del mes seleccionado. Las flechas SHALL permitir navegar hasta 12 meses hacia atrás desde el mes actual. La flecha derecha SHALL deshabilitarse cuando el mes seleccionado es el actual (no se navega hacia el futuro). El mes actual SHALL ser el seleccionado por default al montar la tarjeta.

La tarjeta SHALL ser un componente cliente que posee el mes seleccionado en **estado local**. La navegación entre meses NO SHALL modificar la URL ni provocar una navegación de ruta: cambiar de mes NO recarga la página (web) ni desmonta/remonta la tarjeta (mobile). El mes seleccionado NO se persiste en la URL ni se conserva tras un refresh; al volver a montar, la tarjeta SHALL abrir en el mes actual.

Al navegar a un mes, la tarjeta SHALL obtener los datos del lado del cliente (web: vía server action; mobile: vía TanStack Query) y SHALL mostrar un **estado de carga propio**: un spinner que reemplaza únicamente el área del gráfico y del footer (balance, ingresos, gastos), manteniendo visibles e interactivos el título de la sección y el navegador mensual.

Si el fetch de un mes falla, la tarjeta SHALL mostrar un **estado de error compacto** en el área del gráfico + footer, con opción de reintentar, manteniendo visibles el título y el navegador mensual.

En los estados de carga y de error, el alto y el ancho de la tarjeta SHALL permanecer constantes respecto del estado con datos (sin layout shift).

El navegador mensual NUNCA SHALL desbordar los límites de la tarjeta. En web, incluso cuando la columna del grid es angosta (viewport entre ~1024px y ~1088px), el navegador SHALL mantenerse íntegro dentro de la tarjeta y el título de la sección SHALL ceder espacio (truncarse) antes que permitir que la flecha derecha se salga del contenedor.

Debajo del gráfico, la sección SHALL mostrar el balance final del mes seleccionado (positivo o negativo, con signo y color), y los totales de ingresos y gastos del mes en una línea pequeña.

El gráfico SHALL considerar solo transacciones con estado `confirmed` (es decir: no `pending` de tarjeta). En la práctica esto significa: ingresos en cash/bank, gastos en cash/bank, y pagos de resúmenes (que son gastos en cash/bank). Consumos en tarjeta `pending` y cuotas `pending` NO entran al gráfico.

El cálculo SHALL usar exclusivamente la moneda ARS. El gráfico NO renderiza datos en USD ni hace conversiones.

#### Scenario: Mes con sueldo a mitad de mes muestra subida brusca

- **WHEN** el mes seleccionado es mayo 2026 y el usuario tuvo un ingreso de $ 850.000 el día 15 y gastos repartidos durante el mes
- **THEN** el gráfico muestra una pendiente decreciente desde el día 1 al 14 (gastos sin ingresos), un salto vertical hacia arriba el día 15 (sueldo), y una pendiente suavemente decreciente desde el 15 hasta fin de mes

#### Scenario: Navegar al mes anterior recarga los datos sin recargar la página

- **WHEN** el usuario en mayo 2026 toca la flecha izquierda
- **THEN** la tarjeta obtiene y muestra los datos de abril 2026
- **AND** la flecha derecha se habilita (ya no estamos en el mes actual)
- **AND** la URL no cambia y el resto de la página (Hero, "Lo que viene") no se vuelve a renderizar

#### Scenario: El estado de carga reemplaza solo el gráfico y el footer

- **WHEN** el usuario navega a un mes cuyos datos aún no están disponibles y el fetch está en curso
- **THEN** el área del gráfico y del footer muestra un spinner
- **AND** el título de la sección y el navegador mensual siguen visibles e interactivos
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: El estado de error permite reintentar sin perder el navegador

- **WHEN** el fetch de los datos del mes seleccionado falla
- **THEN** el área del gráfico y del footer muestra un mensaje de error compacto con una acción de reintentar
- **AND** el título de la sección y el navegador mensual siguen visibles
- **AND** al reintentar, la tarjeta vuelve a obtener los datos del mismo mes seleccionado
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: La flecha derecha está deshabilitada en el mes actual

- **WHEN** el usuario está viendo el mes actual
- **THEN** la flecha derecha del navegador está deshabilitada visual y funcionalmente

#### Scenario: Límite de 12 meses hacia atrás

- **WHEN** el usuario navegó 12 meses hacia atrás y toca la flecha izquierda
- **THEN** la flecha izquierda está deshabilitada y la navegación no avanza

#### Scenario: El navegador no desborda la tarjeta en viewports angostos (web)

- **WHEN** el viewport tiene un ancho entre ~1024px y ~1088px (la columna izquierda del grid del dashboard queda angosta)
- **THEN** el navegador mensual, incluida la flecha derecha, queda contenido dentro de los límites de la tarjeta
- **AND** el título de la sección se trunca si hace falta para dejar espacio, en lugar de empujar el navegador fuera del contenedor

#### Scenario: Consumo en tarjeta no impacta el gráfico

- **WHEN** el usuario registra un consumo de $ 30.000 en su tarjeta el día 10 del mes
- **THEN** el gráfico del mes actual NO refleja ese consumo como bajada
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí aparece como bajada en la fecha del pago

#### Scenario: Mes sin movimientos confirmados muestra línea plana

- **WHEN** el mes seleccionado no tiene ningún ingreso ni gasto confirmado
- **THEN** el gráfico muestra una línea horizontal sobre el eje X (acumulado = 0)
- **AND** debajo muestra "Ingresos $ 0 · Gastos $ 0" y "Balance + $ 0"

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar las tres secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada sección SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en una sección NO SHALL bloquear ni romper el renderizado de las demás. En web, esta independencia SHALL implementarse envolviendo cada sección en su propio `<Suspense>` con un `SectionFallback` como `fallback`, y haciendo que cada sección fetchee su data en un container async dedicado que degrade a `SectionFallback` si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varias secciones bloqueando el streaming entre ellas.

Cada sección SHALL declarar un `min-height` sobre el root del componente real y sobre su `SectionFallback` correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando una sección pasa de su fallback al contenido real. La card de bienvenida ("Cargá tu primer movimiento") es la única excepción: por ser condicional y rara vez visible, su `<Suspense>` puede usar `fallback={null}` y aceptar un shift breve cuando se materializa.

Cada `SectionFallback` SHALL mostrar un mensaje localizado específico de la sección: durante loading usa una key `*.loading` ("Cargando…"), durante error usa una key `*.error` ("No pudimos cargar…"). NO SHALL reusarse un mensaje genérico para todas las secciones.

#### Scenario: Usuario nuevo sin transacciones ve dashboard funcional

- **WHEN** un usuario recién creado por el onboarding carga `/dashboard` sin haber registrado ningún movimiento ni consumo
- **THEN** el Hero muestra `$ 0,00` y `u$s 0,00`
- **AND** "Lo que viene" muestra el estado vacío
- **AND** "Balance del mes" muestra la línea plana en 0

#### Scenario: Falla parcial en una query no rompe la pantalla

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB)
- **THEN** la sección "Lo que viene" renderiza un estado de error compacto ("No pudimos cargar los próximos eventos")
- **AND** las otras dos secciones renderizan normalmente

#### Scenario: Cada sección stream-ea apenas resuelve su query (web)

- **WHEN** un usuario carga `/dashboard` y la query de `getDashboardHero` resuelve antes que la de `getUpcomingFortnight`
- **THEN** el Hero pinta sus importes en cuanto su query resuelve, sin esperar a "Lo que viene"
- **AND** "Lo que viene" sigue mostrando su `SectionFallback` de loading hasta que su propia query resuelva
- **AND** ambas secciones están envueltas en `<Suspense>` independientes

#### Scenario: El fallback ocupa el mismo alto que el contenido (web)

- **WHEN** una sección del dashboard está mostrando su `SectionFallback` de loading y luego su query resuelve
- **THEN** el hueco que ocupaba el fallback es el mismo que ocupa el contenido real (min-height matcheado)
- **AND** las secciones que ya estaban pintadas debajo no se desplazan verticalmente

#### Scenario: Cada `SectionFallback` muestra un mensaje específico de la sección (web)

- **WHEN** un usuario carga `/dashboard` y todavía no resolvieron las queries
- **THEN** el fallback del Hero muestra "Cargando tu disponible…" (key `dashboard.hero_loading`)
- **AND** el fallback de "Lo que viene" muestra "Cargando los próximos eventos…" (key `dashboard.upcoming.loading`)
- **AND** el fallback de "Balance del mes" muestra "Cargando el balance del mes…" (key `dashboard.month.loading`)
- **AND** NO se ven mensajes genéricos tipo "Cargando…" sin contexto

#### Scenario: La card de bienvenida puede generar layout shift cuando aparece (web)

- **WHEN** un usuario nuevo (sin movimientos) carga `/dashboard` y la query `hasUserMovements` resuelve después del Hero
- **THEN** la card de bienvenida aparece arriba del Hero y empuja el contenido hacia abajo
- **AND** esta es la única excepción aceptable al principio de "sin layout shift", documentada porque reservar espacio fijo perjudicaría al resto de usuarios que nunca la ven

---

### Requirement: Las queries y agregaciones del dashboard viven en un package compartido

Las queries de lectura del dashboard (`getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `hasUserMovements`) y las funciones puras de agregación (`aggregateHero`, `buildUpcomingFortnight`, `buildMonthBalanceSeries`) SHALL vivir en `packages/dashboard/` bajo el nombre `@grana/dashboard`. El package SHALL exponer su `src/index.ts` sin paso de build, siguiendo la convención del monorepo. El package SHALL ser RN-compatible: NO depende de `react`, `next`, APIs del DOM, ni APIs de Node específicas.

Ambas apps (web y mobile) SHALL consumir esas queries y tipos desde `@grana/dashboard`. La app web NO SHALL retener copias locales de esos módulos en `apps/web/lib/dashboard/` una vez completada la migración.

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

---

### Requirement: `UpcomingItem` expone destino de navegación de forma neutral a la plataforma

El tipo `UpcomingItem` que devuelve `getUpcomingFortnight` SHALL exponer información semántica suficiente para que cada plataforma construya su propia URL. El tipo SHALL NOT incluir un campo `href: string` con una URL hardcodeada de una plataforma específica.

Cada plataforma (web, mobile) SHALL implementar localmente un helper `routeForUpcomingItem(target)` que mapea el destino semántico a la URL/ruta concreta.

#### Scenario: El tipo expone identificadores, no URLs

- **WHEN** una query devuelve un `UpcomingItem` para un `card_period`
- **THEN** el ítem incluye campos como `kind='card_period'`, `accountId`, `periodId`
- **AND** NO incluye una propiedad `href` con un path tipo `/cards/...` ni `/tarjetas/...`

#### Scenario: Web construye la URL a partir del destino semántico

- **WHEN** el componente `UpcomingFortnightSection` web recibe un ítem con `target.kind='card_period'`
- **THEN** el componente construye el `href` del `<Link>` como `/cards/${target.accountId}/periods/${target.periodId}`

#### Scenario: Mobile construye la ruta a partir del mismo destino semántico

- **WHEN** el componente `UpcomingFortnightSection` mobile recibe un ítem con `target.kind='card_period'`
- **THEN** el componente llama a `router.push(...)` con la ruta mobile equivalente al detalle de período (o, mientras esa ruta no exista, `/tarjetas` como ruta transitoria)

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

Los componentes mobile del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase: `HeroSection`, `UpcomingFortnightSection`, `MonthBalanceSection`, `MonthBalanceChart`, `MonthNavigator`, `MaskedAmount`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `SectionFallback`, `DashboardHeader`, `WelcomeFirstMoveCard`. Las props públicas SHALL coincidir cuando es técnicamente posible. El carrusel de tarjetas (`CreditCardCarousel`, `CreditCardItem`) ya no es parte del dashboard: vive en el módulo cards (`apps/mobile/components/cards/`) y lo consume la pantalla `/cards`.

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `FlatList`, `react-native-svg`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

#### Scenario: Mismo nombre de componente entre web y mobile

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los nombres PascalCase exportados coinciden uno a uno
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Componente mobile usa primitivas RN

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx`
- **THEN** el componente usa `View`/`Text`/`Pressable` y NO usa elementos del DOM como `div`, `span`, ni `<Link>` de Next
- **AND** la navegación usa `useRouter()` de `expo-router`

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

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las **tres** secciones del dashboard en orden vertical (Hero → Lo que viene → Balance del mes) envueltas en `EyeMaskProvider`. La pantalla SHALL cargar las queries correspondientes en paralelo y SHALL tolerar fallas parciales: si una query falla, la sección correspondiente renderiza `SectionFallback` mientras las demás siguen funcionando. La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan) y SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy".

#### Scenario: Las tres secciones cargan en paralelo

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado
- **THEN** las queries `getDashboardHero`, `getUpcomingFortnight` y `getMonthBalanceSeries` se disparan en paralelo
- **AND** las tres secciones renderizan independientemente a medida que sus queries resuelven
- **AND** NO se dispara `getCreditCards` para el dashboard

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB) en mobile
- **THEN** `UpcomingFortnightSection` renderiza `SectionFallback` con mensaje i18n
- **AND** Hero y Balance del mes renderizan normalmente

#### Scenario: Salir del tab dashboard y volver resetea el eye toggle (mobile)

- **WHEN** el usuario mobile activa el eye toggle, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente (el provider se desmonta y se vuelve a montar)

