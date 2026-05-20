## ADDED Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding (en ambos modos, novato y experto).

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

---

### Requirement: La pantalla dashboard es read-only

El dashboard SHALL NOT exponer formularios, botones de creación, edición, eliminación, archivado ni confirmación de movimientos pendientes. Toda interacción que requiera modificar datos SHALL ocurrir en el módulo correspondiente (Cuentas, Tarjetas, Movimientos). Los elementos visibles en el dashboard PUEDEN ser clickeables como atajos de navegación a esos módulos, pero NO ejecutan mutaciones en sí mismos.

#### Scenario: Click en un ítem de "Lo que viene" navega al módulo correspondiente

- **WHEN** el usuario hace click en un ítem de la sección "Lo que viene" que corresponde a un resumen de tarjeta cerrado
- **THEN** el sistema navega al detalle de ese período en `/cards/[accountId]/periods/[periodId]`
- **AND** NO abre un modal de pago de resumen ni dispara ninguna mutación

#### Scenario: Click en una tarjeta del carrusel navega al detalle

- **WHEN** el usuario hace click en una tarjeta dentro del carrusel "Tarjetas"
- **THEN** el sistema navega a `/cards/[accountId]`

#### Scenario: Click en el Hero navega a Cuentas

- **WHEN** el usuario hace click en el importe del Hero "Para gastar"
- **THEN** el sistema navega a `/accounts`

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

La sección "Lo que viene" SHALL mostrar dos columnas verticales — "A pagar" (izquierda) y "A cobrar" (derecha) — con eventos financieros previstos para los próximos 14 días contados desde `getTodayAR()` inclusive.

La columna "A pagar" SHALL incluir:

1. **Resúmenes de tarjeta cerrados pendientes de pago**: filas de `card_periods` con estado derivado `closed` o `overdue` (sin `period_payment`) cuyo `due_date` cae dentro del rango `[today, today+14d]`. Cada ítem SHALL mostrar la fecha de vencimiento, el nombre de la tarjeta, y el monto total del resumen.
2. **Instancias recurrentes salientes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `expense` o `transfer` (saliente).

La columna "A cobrar" SHALL incluir:

1. **Instancias recurrentes entrantes**: filas de `recurrence_instances` no confirmadas y no omitidas con `expected_date` dentro del rango y cuya regla `recurrences` define un movimiento de tipo `income`.

La sección SHALL NOT incluir cuotas individuales (`transactions` con `parent_id NOT NULL`) como ítems propios. Las cuotas forman parte del monto de un resumen y se ven al abrir el detalle del período en `/cards`.

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

---

### Requirement: "Lo que viene" muestra totales por columna y balance del período

Debajo de cada columna ("A pagar" y "A cobrar"), la sección SHALL mostrar el total agregado por moneda. Si los ítems tienen monedas mixtas, el total se desglosa por moneda en líneas separadas. Debajo de los totales, la sección SHALL mostrar un "Balance del período" calculado como `total a cobrar (ARS) − total a pagar (ARS)`, con su signo y color (verde si positivo, neutral si cero, coral si negativo). Si los importes de a pagar y a cobrar incluyen monedas distintas a ARS, el balance del período SHALL desglosarse por moneda; nunca SHALL convertir entre monedas (principio bimoneda).

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

La sección "Tarjetas" SHALL renderizar el componente `CreditCardCarousel` ya existente del módulo `cards` con scroll horizontal y snap a card. La sección SHALL consumir la misma query `getCreditCards(userId)` que alimenta el listado de tarjetas en `/cards`. La sección SHALL mostrar las mismas alertas visuales (resumen próximo a vencer en ámbar, vencido en rojo) que el listado completo.

Si el usuario no tiene ninguna tarjeta activa, la sección SHALL renderizar un estado vacío con CTA "Agregar tarjeta" que navega a `/cards/new` (o equivalente del módulo cards).

#### Scenario: Usuario con dos tarjetas activas ve ambas en el carrusel

- **WHEN** el usuario tiene dos cuentas `type='credit'` activas
- **THEN** el carrusel del dashboard muestra ambas tarjetas con scroll horizontal y snap a card

#### Scenario: Tarjeta con resumen vencido aparece en rojo en el carrusel del dashboard

- **WHEN** una tarjeta del usuario tiene un período con estado derivado `overdue`
- **THEN** la card en el carrusel del dashboard muestra el badge visual de vencido (idéntico al de `/cards`)

#### Scenario: Sin tarjetas activas muestra estado vacío con CTA

- **WHEN** el usuario no tiene ninguna cuenta `type='credit'` activa
- **THEN** la sección renderiza "Todavía no agregaste ninguna tarjeta" con un botón "Agregar tarjeta" que navega a la pantalla de alta de tarjeta del módulo cards

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
