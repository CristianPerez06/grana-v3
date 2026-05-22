# dashboard Specification

## Purpose

Define la pantalla `/dashboard` como landing universal post-login y post-onboarding (idéntica para modo novato y experto, en web y mobile). Es read-only y se compone de cuatro secciones en orden fijo: Hero "Para gastar" con disponible bimoneda y eye toggle de privacidad, "Lo que viene" con compromisos firmes y recurrencias de los próximos 14 días, Balance del mes con gráfico de línea y navegador mensual, y carrusel de Tarjetas. Toda interacción navega al módulo correspondiente; el dashboard no muta datos.

## Requirements
### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding (en ambos modos, novato y experto).

El dashboard SHALL ser idéntico para los dos modos (`users.mode='novato'` y `users.mode='experto'`). El modo NO modifica ninguna sección, dato, layout ni componente del dashboard. El detalle adicional del modo experto vive en el módulo Cuentas, no en el dashboard.

#### Scenario: Usuario novato aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding novato
- **THEN** el sistema redirige a `/dashboard`
- **AND** NO redirige a `/cards`

#### Scenario: Usuario experto aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding experto
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Login exitoso aterriza en dashboard

- **WHEN** un usuario con onboarding completado hace login
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Dashboard se ve igual en novato y experto

- **WHEN** dos usuarios con datos idénticos pero `users.mode` distinto cargan `/dashboard`
- **THEN** la pantalla renderiza las mismas cuatro secciones, en el mismo orden, con los mismos componentes y los mismos importes

#### Scenario: Arranque con sesión activa aterriza en /dashboard renderizado (mobile)

- **WHEN** un usuario mobile con sesión válida persistida abre la app
- **THEN** la app aterriza en `(app)/dashboard` con las cuatro secciones renderizadas (Hero, Lo que viene, Balance del mes, Tarjetas)
- **AND** NO renderiza el placeholder "Dashboard" de texto plano

---

### Requirement: La pantalla dashboard es read-only

El dashboard SHALL NOT exponer formularios, botones de creación, edición, eliminación, archivado ni confirmación de movimientos pendientes. Toda interacción que requiera modificar datos SHALL ocurrir en el módulo correspondiente (Cuentas, Tarjetas, Movimientos). Los elementos visibles en el dashboard PUEDEN ser clickeables como atajos de navegación a esos módulos, pero NO ejecutan mutaciones en sí mismos.

#### Scenario: Click en un ítem de "Lo que viene" navega al módulo correspondiente (web)

- **WHEN** el usuario hace click en un ítem de la sección "Lo que viene" que corresponde a un resumen de tarjeta cerrado
- **THEN** el sistema navega al detalle de ese período en `/cards/[accountId]/periods/[periodId]`
- **AND** NO abre un modal de pago de resumen ni dispara ninguna mutación

#### Scenario: Click en una tarjeta del carrusel navega al detalle (web)

- **WHEN** el usuario hace click en una tarjeta dentro del carrusel "Tarjetas"
- **THEN** el sistema navega a `/cards/[accountId]`

#### Scenario: Click en el Hero navega a Cuentas (web)

- **WHEN** el usuario hace click en el importe del Hero "Para gastar"
- **THEN** el sistema navega a `/accounts`

#### Scenario: Toque en un ítem de "Lo que viene" navega al módulo correspondiente (mobile)

- **WHEN** el usuario toca un ítem de la sección "Lo que viene" que corresponde a un resumen de tarjeta cerrado
- **THEN** la app navega con `useRouter().push(...)` al detalle de ese período dentro del módulo cards mobile
- **AND** NO abre un modal de pago de resumen ni dispara ninguna mutación
- **AND** mientras la ruta de detalle de período no exista en cards mobile, la navegación apunta a `/tarjetas` (decisión transitoria)

#### Scenario: Toque en una tarjeta del carrusel navega al detalle (mobile)

- **WHEN** el usuario toca una tarjeta dentro del carrusel "Tarjetas"
- **THEN** la app navega con `useRouter().push(...)` a la pantalla de detalle de la tarjeta dentro del módulo cards mobile
- **AND** mientras la ruta de detalle por tarjeta no exista en cards mobile, la navegación apunta a `/tarjetas` (decisión transitoria)

#### Scenario: Toque en el Hero navega a Cuentas (mobile)

- **WHEN** el usuario toca el importe del Hero "Para gastar"
- **THEN** la app navega con `useRouter().push(...)` a la pantalla de cuentas mobile cuando exista
- **AND** mientras la pantalla de cuentas mobile no exista, el Hero permanece visualmente "tappable" pero la navegación apunta al menú (decisión transitoria documentada en código)

---

### Requirement: El Hero muestra el disponible total bimoneda

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor) lado a lado o stackeado. Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

#### Scenario: Usuario con saldos en ambas monedas

- **WHEN** el usuario tiene una cuenta cash con $ 150.000 ARS + u$s 500 USD y una cuenta bank con $ 137.450 ARS + u$s 740,50 USD, sin pagos de resúmenes pendientes ya descontados
- **THEN** el Hero muestra `$ 287.450,00` en línea primaria y `u$s 1.240,50` en línea secundaria

#### Scenario: Consumo en tarjeta no reduce el disponible del Hero

- **WHEN** el usuario tiene $ 100.000 ARS disponibles y registra un consumo de $ 30.000 en su tarjeta Visa
- **THEN** el Hero sigue mostrando `$ 100.000,00`
- **AND** el consumo aparece en el carrusel de Tarjetas y eventualmente en la sección "Lo que viene" cuando el resumen cierre

#### Scenario: Pago de resumen reduce el disponible

- **WHEN** el usuario paga el resumen de Visa por $ 145.200 desde una cuenta cash que tenía $ 287.450
- **THEN** el Hero pasa a mostrar `$ 142.250,00`

---

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard.

El toggle SHALL aplicar al menos a: Hero (importes ARS y USD), Lo que viene (importes individuales y totales), Balance del mes (importes de ingresos, gastos y balance), y Tarjetas (importes de cada card).

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas, nombres de tarjetas y categorías permanecen visibles

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` y luego vuelve a `/dashboard`
- **THEN** los importes están visibles nuevamente (estado no persistido)

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

Encima del gráfico, la sección SHALL mostrar un navegador mensual `◀ MES AÑO ▶` con el nombre del mes seleccionado. Las flechas SHALL permitir navegar hasta 12 meses hacia atrás desde el mes actual. La flecha derecha SHALL deshabilitarse cuando el mes seleccionado es el actual (no se navega hacia el futuro). El mes actual SHALL ser el seleccionado por default al abrir el dashboard.

Debajo del gráfico, la sección SHALL mostrar el balance final del mes seleccionado (positivo o negativo, con signo y color), y los totales de ingresos y gastos del mes en una línea pequeña.

El gráfico SHALL considerar solo transacciones con estado `confirmed` (es decir: no `pending` de tarjeta). En la práctica esto significa: ingresos en cash/bank, gastos en cash/bank, y pagos de resúmenes (que son gastos en cash/bank). Consumos en tarjeta `pending` y cuotas `pending` NO entran al gráfico.

El cálculo SHALL usar exclusivamente la moneda ARS. El gráfico NO renderiza datos en USD ni hace conversiones.

#### Scenario: Mes con sueldo a mitad de mes muestra subida brusca

- **WHEN** el mes seleccionado es mayo 2026 y el usuario tuvo un ingreso de $ 850.000 el día 15 y gastos repartidos durante el mes
- **THEN** el gráfico muestra una pendiente decreciente desde el día 1 al 14 (gastos sin ingresos), un salto vertical hacia arriba el día 15 (sueldo), y una pendiente suavemente decreciente desde el 15 hasta fin de mes

#### Scenario: Navegar al mes anterior

- **WHEN** el usuario en mayo 2026 toca la flecha izquierda
- **THEN** el gráfico recarga con los datos de abril 2026
- **AND** la flecha derecha se habilita (ya no estamos en el mes actual)

#### Scenario: La flecha derecha está deshabilitada en el mes actual

- **WHEN** el usuario está viendo el mes actual
- **THEN** la flecha derecha del navegador está deshabilitada visual y funcionalmente

#### Scenario: Límite de 12 meses hacia atrás

- **WHEN** el usuario navegó 12 meses hacia atrás y toca la flecha izquierda
- **THEN** la flecha izquierda está deshabilitada y la navegación no avanza

#### Scenario: Consumo en tarjeta no impacta el gráfico

- **WHEN** el usuario registra un consumo de $ 30.000 en su tarjeta el día 10 del mes
- **THEN** el gráfico del mes actual NO refleja ese consumo como bajada
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí aparece como bajada en la fecha del pago

#### Scenario: Mes sin movimientos confirmados muestra línea plana

- **WHEN** el mes seleccionado no tiene ningún ingreso ni gasto confirmado
- **THEN** el gráfico muestra una línea horizontal sobre el eje X (acumulado = 0)
- **AND** debajo muestra "Ingresos $ 0 · Gastos $ 0" y "Balance + $ 0"

---

### Requirement: La sección Tarjetas reutiliza el carrusel del módulo cards

El sistema SHALL renderizar un componente llamado `CreditCardCarousel` con scroll/swipe horizontal y snap a card. La implementación interna es específica de cada plataforma (CSS scroll-snap en web; `FlatList` horizontal con `snapToInterval` en mobile). La sección SHALL consumir la misma información que alimenta el listado completo de tarjetas (`getCreditCards(userId)` o equivalente cuando se promueva a `@grana/cards`). La sección SHALL mostrar las mismas alertas visuales (resumen próximo a vencer en ámbar, vencido en rojo) que el listado completo, semánticamente.

Si el usuario no tiene ninguna tarjeta activa, la sección SHALL renderizar un estado vacío con CTA "Agregar tarjeta" cuyo destino es específico de la plataforma:

- En web, navega a `/cards/new` (o equivalente del módulo cards web).
- En mobile, navega a `/tarjetas` (el módulo cards mobile aún no tiene una ruta de alta dedicada; cuando exista, se redirigirá a esa ruta).

#### Scenario: Usuario con dos tarjetas activas ve ambas en el carrusel

- **WHEN** el usuario tiene dos cuentas `type='credit'` activas
- **THEN** el carrusel del dashboard muestra ambas tarjetas con scroll/swipe horizontal y snap a card

#### Scenario: Tarjeta con resumen vencido aparece en rojo en el carrusel del dashboard

- **WHEN** una tarjeta del usuario tiene un período con estado derivado `overdue`
- **THEN** la card en el carrusel del dashboard muestra el badge visual de vencido (idéntico al del listado completo del módulo cards)

#### Scenario: Sin tarjetas activas muestra estado vacío con CTA (web)

- **WHEN** el usuario web no tiene ninguna cuenta `type='credit'` activa
- **THEN** la sección renderiza "Todavía no agregaste ninguna tarjeta" con un botón "Agregar tarjeta" que navega a la pantalla de alta de tarjeta del módulo cards web

#### Scenario: Sin tarjetas activas muestra estado vacío con CTA (mobile)

- **WHEN** el usuario mobile no tiene ninguna cuenta `type='credit'` activa
- **THEN** la sección renderiza "Todavía no agregaste ninguna tarjeta" con un botón "Agregar tarjeta" que navega con `useRouter().push('/tarjetas')` (decisión transitoria hasta que cards mobile tenga ruta de alta dedicada)

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar las cuatro secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco. Cada sección SHALL renderizarse de forma independiente: una falla en la query de "Lo que viene" NO SHALL impedir que se rendericen Hero, Balance del mes o Tarjetas.

#### Scenario: Usuario nuevo sin transacciones ve dashboard funcional

- **WHEN** un usuario recién creado por el onboarding novato carga `/dashboard` sin haber registrado ningún movimiento ni consumo
- **THEN** el Hero muestra `$ 0,00` y `u$s 0,00`
- **AND** "Lo que viene" muestra el estado vacío
- **AND** "Balance del mes" muestra la línea plana en 0
- **AND** Tarjetas muestra la tarjeta default creada por el onboarding novato con su período actual sin consumos

#### Scenario: Falla parcial en una query no rompe la pantalla

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB)
- **THEN** la sección "Lo que viene" renderiza un estado de error compacto ("No pudimos cargar los próximos eventos")
- **AND** las otras tres secciones renderizan normalmente

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

Los componentes mobile del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase: `HeroSection`, `UpcomingFortnightSection`, `MonthBalanceSection`, `MonthBalanceChart`, `MonthNavigator`, `CardsSection`, `CreditCardCarousel`, `MaskedAmount`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `SectionFallback`, `DashboardHeader`, `WelcomeFirstMoveCard`. Las props públicas SHALL coincidir cuando es técnicamente posible.

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

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las cuatro secciones con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las cuatro secciones del dashboard en orden vertical (Hero → Lo que viene → Balance del mes → Tarjetas) envueltas en `EyeMaskProvider`. La pantalla SHALL cargar las cuatro queries en paralelo y SHALL tolerar fallas parciales: si una query falla, la sección correspondiente renderiza `SectionFallback` mientras las demás siguen funcionando.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan) y SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy".

#### Scenario: Las cuatro secciones cargan en paralelo

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado
- **THEN** las cuatro queries (`getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `getCreditCards`) se disparan en paralelo
- **AND** las cuatro secciones renderizan independientemente a medida que sus queries resuelven

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB) en mobile
- **THEN** `UpcomingFortnightSection` renderiza `SectionFallback` con mensaje i18n
- **AND** Hero, Balance del mes y Tarjetas renderizan normalmente

#### Scenario: Salir del tab dashboard y volver resetea el eye toggle (mobile)

- **WHEN** el usuario mobile activa el eye toggle, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente (el provider se desmonta y se vuelve a montar)
