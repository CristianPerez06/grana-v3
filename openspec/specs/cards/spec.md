# cards Specification

## Purpose

Cubre las tarjetas de crédito como módulo de primera clase del producto. Modela cada resumen como un período con cuatro fechas (apertura, cierre, vencimiento, próximo cierre) cuyo estado se deriva sin persistir, soporta el alta de tarjeta cargando solo el cierre y vencimiento del resumen actual (el ciclo siguiente nace estimado y se confirma al pagar — cada fecha se pide en el único momento en que el banco ya la anunció), el registro de consumos en una o varias cuotas (ARS only por invariante `I-CRED-9`), el pago del resumen como `expense` en una cuenta cash o bank (única transacción que reduce `disponible` por la regla off-ledger), y las vistas de listado (wallet en grilla con hero de pago mensual) y de detalle (organizado por el ciclo de vida del resumen: a pagar / en curso / próximo, con movimientos y cuotas en curso).
## Requirements
### Requirement: El sistema modela cada resumen de tarjeta como un período con cuatro fechas

El sistema SHALL representar cada resumen de tarjeta de crédito como una fila en `card_periods` con los campos `start_date`, `end_date`, `due_date` y `is_estimated`. El constraint `chk_period_dates` SHALL exigir `start_date < end_date < due_date`. El par `(account_id, start_date)` SHALL ser único. No existe columna `status` — el estado del período se deriva en cada lectura a partir de `(end_date, due_date, today, exists period_payment)`.

#### Scenario: Período creado con fechas cronológicas válidas

- **WHEN** se inserta un `card_periods` con `start_date='2026-05-01'`, `end_date='2026-05-31'`, `due_date='2026-06-15'`
- **THEN** el INSERT es aceptado

#### Scenario: Período con fechas no cronológicas es rechazado

- **WHEN** se intenta insertar un `card_periods` con `end_date='2026-05-01'`, `due_date='2026-04-30'` (vencimiento antes del cierre)
- **THEN** la DB rechaza por `chk_period_dates`

#### Scenario: Dos períodos con el mismo `start_date` para la misma cuenta es rechazado

- **WHEN** existe un `card_periods` para la cuenta `X` con `start_date='2026-05-01'` y se intenta insertar otro con el mismo `start_date` para la misma cuenta
- **THEN** la DB rechaza por la constraint UNIQUE `(account_id, start_date)`

---

### Requirement: El estado del período se deriva sin persistir

El sistema SHALL derivar el estado de cada `card_periods` siguiendo este árbol en orden de prioridad:

1. Si existe una fila en `period_payments` con `period_id = id` → `paid`.
2. Si `today ≤ end_date` → `open`.
3. Si `end_date < today ≤ due_date` → `closed`.
4. Si `due_date < today` → `overdue`.

El sistema SHALL NOT mantener una columna `status` ni un trigger que la actualice. Toda lectura del estado SHALL llamar al helper centralizado `derivePeriodStatus(period, today, hasPayment)`.

#### Scenario: Período con `today` dentro del rango open

- **WHEN** un `card_periods` tiene `end_date='2026-06-15'` y `today='2026-06-10'`, sin `period_payment`
- **THEN** el estado derivado es `open`

#### Scenario: Período cerrado esperando pago

- **WHEN** un `card_periods` tiene `end_date='2026-06-15'`, `due_date='2026-06-30'`, `today='2026-06-20'`, sin `period_payment`
- **THEN** el estado derivado es `closed`

#### Scenario: Período vencido sin pago

- **WHEN** un `card_periods` tiene `due_date='2026-06-30'`, `today='2026-07-05'`, sin `period_payment`
- **THEN** el estado derivado es `overdue`

#### Scenario: Período con pago registrado

- **WHEN** existe `period_payment` con `period_id = X`, sin importar las fechas
- **THEN** el estado derivado del período `X` es `paid`

---

### Requirement: El sistema mantiene siempre al menos un período abierto por delante de hoy

El sistema SHALL garantizar que para toda cuenta `credit` activa exista al menos un `card_periods` con estado derivado `open` (`today ≤ end_date`). El mantenimiento es **lazy**: cuando una operación necesita un período cubriendo una fecha futura y no existe ningún período cuyo rango lo cubra, el sistema SHALL generar uno nuevo al vuelo siguiendo el algoritmo de sugerencia (ver requirement de algoritmo). El período auto-generado SHALL marcarse con `is_estimated=true`.

#### Scenario: Inserción de consumo con fecha fuera de período existente genera el siguiente

- **WHEN** existen sólo períodos hasta `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-20'`
- **THEN** el sistema crea un nuevo `card_periods` con fechas estimadas que cubren `2026-06-20`, marcado `is_estimated=true`
- **AND** la transacción se inserta con `card_period_id` apuntando a ese período nuevo

#### Scenario: La operación dispara generación sólo cuando hace falta

- **WHEN** existe un período con `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-10'`
- **THEN** el sistema NO crea períodos nuevos
- **AND** la transacción se asigna al período existente

#### Scenario: Race condition al generar período concurrentemente

- **WHEN** dos requests intentan generar el mismo período "siguiente" en paralelo y uno gana la UNIQUE `(account_id, start_date)`
- **THEN** el segundo request lee el período recién creado por el primero y continúa la operación sin error visible al usuario

---

### Requirement: El algoritmo de sugerencia de fechas usa el promedio de períodos previos

El sistema SHALL exponer una función pura `suggestNextPeriodDates(accountId)` que devuelve `{ suggestedEndDate, suggestedDueDate }`. La lógica SHALL ser:

1. Tomar los últimos 3 períodos de la cuenta ordenados por `end_date DESC` (o 2 si solo hay 2, o 1 si solo hay 1).
2. Promediar la duración del ciclo: para cada par consecutivo, calcular `end_date(i) − end_date(i-1)`, y promediar.
3. Promediar la separación: para cada período, calcular `due_date − end_date`, y promediar.
4. Aplicar duración promedio al `end_date` del último período conocido → `suggestedEndDate`.
5. Aplicar separación promedio → `suggestedDueDate = suggestedEndDate + separación promedio`.
6. Si no hay períodos previos (caso del primer pago), usar fallback: `hoy + 30 días` y `hoy + 45 días`.

#### Scenario: Sugerencia con dos períodos previos

- **WHEN** existen períodos previos con `end_date` `2026-04-15` (`due_date='2026-04-30'`) y `2026-05-15` (`due_date='2026-05-30'`)
- **THEN** `suggestNextPeriodDates` devuelve `suggestedEndDate='2026-06-14'` y `suggestedDueDate='2026-06-29'` (duración 30 días, separación 15 días)

#### Scenario: Sugerencia sin historial usa fallback

- **WHEN** la cuenta no tiene ningún `card_periods` previo y `today='2026-05-01'`
- **THEN** la función devuelve `suggestedEndDate='2026-05-31'` y `suggestedDueDate='2026-06-15'` (hoy+30 / hoy+45)

---

### Requirement: La asignación de una transacción a un período se persiste como FK

El sistema SHALL persistir la asignación de cada transacción de tarjeta a su período como `transactions.card_period_id` (UUID, FK a `card_periods`). El sistema SHALL calcular la asignación al insertar la transacción y elegir el único período cuyo rango (`start_date ≤ date ≤ end_date`) contenga `transactions.date`. Si más de un período candidato existiera (caso anómalo por solapamiento), el sistema SHALL rechazar la operación.

Cuando ningún período existente cubre la fecha, el sistema SHALL distinguir dos casos:

- **Fecha posterior al período más nuevo**: el sistema genera el siguiente período hacia adelante (rolling forward, `is_estimated=true`, `start_date = último.end_date + 1`) y asigna la transacción ahí.
- **Fecha anterior al `start_date` del período más viejo**: el sistema SHALL rechazar la operación con un error claro que nombre la fecha de inicio del historial de la tarjeta. El sistema NO SHALL crear períodos hacia atrás ni asignar la transacción a un período que no contenga su fecha. Un consumo previo al historial pertenece a un ciclo que Grana no trackea (el registro empieza en el alta).

#### Scenario: Consumo cae en período actual

- **WHEN** existe un período con `start_date='2026-05-16'` y `end_date='2026-06-15'` y se inserta una transacción con `date='2026-05-30'` en esa tarjeta
- **THEN** la transacción se inserta con `card_period_id` apuntando a ese período

#### Scenario: Edición de fechas reubica transacción a otro período

- **WHEN** un usuario edita `end_date` de un período `open` y al recalcular, una transacción cuyo `date` antes caía dentro ahora cae en el período siguiente (existente)
- **THEN** la transacción se reubica: `card_period_id` se actualiza al nuevo período
- **AND** el sistema muestra al usuario un preview de impacto antes de confirmar

#### Scenario: Consumo con fecha anterior al historial de la tarjeta es rechazado

- **WHEN** la tarjeta tiene como período más viejo uno con `start_date='2026-05-17'` y se intenta registrar un consumo con `date='2026-04-10'`
- **THEN** la operación se rechaza con un error que nombra la fecha de inicio del historial (`17/05/2026`)
- **AND** no se crea ningún período nuevo
- **AND** no se inserta la transacción

#### Scenario: Cuota inicial anterior al historial es rechazada sin insertar el plan

- **WHEN** se intenta registrar una compra en cuotas cuya primera cuota (fecha de compra) es anterior al `start_date` del período más viejo
- **THEN** la operación se rechaza con el mismo error de fecha anterior al historial
- **AND** no se inserta el parent ni ninguna cuota

---

### Requirement: Las fechas de un período `open` se pueden editar; las de un período `paid` no

El sistema SHALL permitir editar `end_date` y `due_date` de un `card_periods` cuyo estado derivado sea `open`, `closed` u `overdue` (es decir, sin `period_payment`). El sistema SHALL rechazar cualquier intento de editar las fechas de un período `paid`.

**Cascada del borde con el período siguiente.** Si la cuenta tiene un período inmediatamente posterior al editado (i.e., un `card_periods` con `start_date > período.start_date` y mínimo según ese orden), el sistema SHALL mantener el borde contiguo cascadeando `next.start_date = new_end_date + 1` cuando el `end_date` se modifica en cualquier dirección:

- **Extender** (`new_end_date > old_end_date`): se actualiza `next.start_date` hacia adelante y SHALL reasignar al período editado todas las transacciones del próximo cuyo `date ≤ new_end_date`.
- **Achicar** (`new_end_date < old_end_date`): se actualiza `next.start_date` hacia atrás y SHALL reasignar al próximo período todas las transacciones del editado cuyo `date > new_end_date`.

**Bloqueos.** La cascada SHALL rechazarse en estos casos, sin modificar ninguna fila:

- Si el próximo período tiene `period_payment` (estado `paid`), el sistema rechaza con mensaje "El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes."
- Si `new_end_date >= next.end_date` (el período editado tragaría todo el próximo), el sistema rechaza con mensaje "La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen."

**UI del sheet de edición.** La pantalla de edición de fechas SHALL mostrar, antes de guardar, un preview ámbar de la cascada cuando `new_end_date + 1 ≠ next.start_date` y la cascada es válida; y un cartel rojo bloqueante con el botón "Guardar" deshabilitado cuando el próximo período está pagado.

#### Scenario: Edición de fechas en período sin transacciones

- **WHEN** un usuario edita las fechas de un período `open` con cero transacciones imputadas
- **THEN** el sistema actualiza las fechas sin preview ni confirmación adicional

#### Scenario: Extender end_date cascadea el inicio del próximo período hacia adelante

- **WHEN** existe P1 con `end_date='2026-05-20'` y P2 con `start_date='2026-05-21'`, `end_date='2026-06-20'`, sin pago, y el usuario edita `P1.end_date='2026-05-25'`
- **THEN** el sistema actualiza `P2.start_date='2026-05-26'`
- **AND** las transacciones de P2 con `date <= '2026-05-25'` se reasignan a P1 (`card_period_id` apunta a P1)
- **AND** P1 queda con `end_date='2026-05-25'`

#### Scenario: Achicar end_date cascadea el inicio del próximo período hacia atrás

- **WHEN** existe P1 con `end_date='2026-05-20'` y P2 con `start_date='2026-05-21'`, sin pago, y el usuario edita `P1.end_date='2026-05-18'`
- **THEN** el sistema actualiza `P2.start_date='2026-05-19'`
- **AND** las transacciones de P1 con `date > '2026-05-18'` se reasignan a P2

#### Scenario: Edición rechazada si el próximo período está pagado

- **WHEN** P2 tiene `period_payment` (estado `paid`) y el usuario intenta editar `P1.end_date` a un valor que mueve el borde (extiende o achica)
- **THEN** la action retorna error "El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes."
- **AND** ninguna fila se modifica

#### Scenario: Edición rechazada si new_end_date colapsaría todo el próximo período

- **WHEN** existe P2 con `start_date='2026-05-21'` y `end_date='2026-06-20'`, sin pago, y el usuario intenta editar `P1.end_date='2026-06-25'` (cubriría a P2 entera)
- **THEN** la action retorna error "La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen."
- **AND** ninguna fila se modifica

#### Scenario: Sheet de edición muestra preview ámbar de la cascada

- **WHEN** el usuario tipea en el input `end_date` un valor tal que `new_end_date + 1 ≠ next.start_date` y la cascada es válida (próximo no pagado, no colapsa)
- **THEN** debajo del input aparece un cartel ámbar describiendo qué `start_date` va a tener el próximo resumen y qué consumos se van a mover y hacia dónde

#### Scenario: Sheet de edición bloquea Guardar cuando el próximo está pagado

- **WHEN** el usuario tipea un `end_date` que movería el borde y el próximo período está pagado
- **THEN** debajo del input aparece un cartel rojo "No podés mover esta fecha: el próximo resumen ya está pagado"
- **AND** el botón "Guardar" queda deshabilitado

#### Scenario: Edición de fechas en período pagado es rechazada

- **WHEN** un usuario o llamada API intenta editar las fechas de un período cuyo estado derivado es `paid`
- **THEN** la action retorna error explícito y no modifica nada

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) como una **vista compacta agrupada por banco** (NO como wallet de cards grandes), conservando el hero unificado, con esta estructura de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resumen de <mes>"). Acción primaria "Agregar tarjeta" (primitivo `Button`). En ambas plataformas el CTA SHALL abrir el flujo de alta de tarjeta: en web navega a `/cards/new` (o abre el drawer de alta); en mobile navega a la ruta `/cards/new` nativa. El CTA NO SHALL renderizarse como placeholder permanentemente disabled. La carga de catálogos (instituciones / redes) puede gatear el submit/CTA mientras resuelve (web deshabilita el CTA; mobile defiere la carga a la ruta `/cards/new`, que muestra un loading state propio).
2. **Hero del mes (card navy, dos columnas)**: el hero SHALL renderizarse como una card oscura navy (mismo patrón de superficie que el hero del dashboard). A la **izquierda**, **dos cifras** mostradas juntas, cada una en **Bimoneda** (ARS primario y USD subordinado, **NUNCA sumados ni convertidos**):
   - **A pagar (ahora)** (`summary.toPayARS` / `toPayUSD`): la suma del total a pagar de **todas** las tarjetas activas que ya tienen un resumen **cerrado e impago** (deuda firme, vence ~este mes). Cuando la cifra es cero, el hero SHALL mostrar **`$ 0`** — NO un texto de empty-state.
   - **En curso** (`summary.inProgressARS` / `inProgressUSD`): la suma de los resúmenes **abiertos (aún no cerraron) con saldo > 0** de **todas** las tarjetas activas. Es el **acumulado real** de los consumos del ciclo abierto (no una proyección): un piso que sigue creciendo hasta el cierre. SHALL llevar el caption **"se sigue sumando hasta el cierre"**. Cuando es cero, SHALL mostrar `$ 0`.
   A la **derecha**, **"Próximos cierres"**: una lista de **una tarjeta por fila** (`fecha de cierre · nombre`, **sin monto** — el monto por tarjeta vive en el detalle de cada tarjeta del listado), ordenada por **fecha de cierre** (NO de vencimiento) ascendente y **capada en `NEXT_CLOSES_CAP` (6)** (`summary.nextCloses`). En viewports angostos las dos zonas se apilan.
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

### Requirement: El detalle de tarjeta muestra el resumen actual, próximo, y acciones primarias

El sistema SHALL renderizar el detalle de una tarjeta (`/cards/[id]`) organizado alrededor del **ciclo de vida del resumen**, derivado con `classifyPeriodsLifecycle(periods, today)` en `{ apagar?, curso, prox }`. NO mezcla los resúmenes: el "a pagar" (cerró y no venció), el "en curso" (abierto) y el "próximo" se muestran como entidades distintas. La estructura, de arriba hacia abajo:

1. **Back link** "‹ Tarjetas".
2. **Header de identidad**: avatar de marca (acento de la tarjeta), nombre, pill de estado, y subtítulo banco/emisor.
3. **Timeline de ciclo de vida** horizontal: pasos `Pagado → [A pagar] → En curso → Próximo`, cada uno con dot de color (verde=pagado, terracota=a pagar, acento=en curso, gris=próximo), label y fecha ("vence DD/MM" / "cierra DD/MM"). El paso "A pagar" SHALL aparecer solo si existe ese resumen. Los pasos (excepto "Pagado") SHALL ser clickeables y seleccionar el período que se muestra abajo.
4. **Zona de resúmenes**, con la jerarquía puesta en lo que hay que pagar:
   - **Si hay "a pagar"**: una card hero terracota con eyebrow "RESUMEN A PAGAR", monto grande (ARS + USD aparte, nunca sumados), "Cerró el X · vence el Y", una cuenta regresiva ("N días para el vencimiento") y un CTA "Registrar pago" que navega a `/cards/[id]/periods/[periodId]/pay`. Debajo, la card "En curso" subordinada.
   - **Si NO hay "a pagar"**: la card "En curso" pasa a ser el hero (con ring de acento).
   - **Card "En curso"**: eyebrow "RESUMEN EN CURSO" + badge "Sumando consumos" (dot verde con pulso), monto acumulado hasta hoy (incluye las cuotas que caen en ese ciclo), stats (N movimientos · $ en cuotas del ciclo), y un panel de ciclo ("CIERRA", fecha, "en N días", barra de progreso del ciclo, "Día X de N").
   - **Mini "Próximo"**: fila con borde punteado "PRÓXIMO · cierra X · ya comprometido en cuotas" + monto + chevron, clickeable.
5. **Panel de límite (opcional)**:
   - Si `credit_limit` está cargado: "Límite usado $X de $Y" + "%" + barra (teñida con acento) + "Disponible $Z". El cálculo es ARS-only (Bimoneda + `I-CRED-9`).
   - Si `credit_limit` es `null`: un CTA "Cargá el límite para ver cuánto te queda disponible." + botón "Cargar límite" → `/cards/[id]/edit`.

El **período por defecto** al entrar SHALL ser "A pagar" si existe; si no, "En curso" (consistente con el requirement de priorización de deuda). El termómetro de tres columnas de la versión anterior se reemplaza por esta organización por ciclo de vida.

El caso `tarjeta_nueva` (sin movimientos ni pagos en ningún período) NO renderiza timeline ni zona de resúmenes: muestra un estado vacío con CTA "Registrar primer consumo".

El sistema SHALL mantener un único link "Ver todos los resúmenes →" hacia `/cards/[id]/periods` (sin links duplicados). El footer admin (Detalles, Editar, Archivar/Eliminar/Reactivar) se mantiene al pie.

#### Scenario: Detalle con resumen "a pagar" muestra hero terracota y countdown

- **WHEN** la tarjeta tiene un período `closed` sin pago con `$340.000` ARS, que cerró el `28/05` y vence el `10/06`, y `today='2026-06-01'`
- **THEN** se renderiza una card hero terracota "RESUMEN A PAGAR" con `$340.000`
- **AND** muestra "Cerró el 28/05 · vence el 10/06" y una cuenta regresiva "9 días para el vencimiento"
- **AND** el CTA "Registrar pago" navega a `/cards/[id]/periods/[periodId]/pay`
- **AND** debajo aparece la card "En curso" subordinada

#### Scenario: Detalle sin resumen "a pagar" usa "En curso" como hero

- **WHEN** la tarjeta no tiene ningún período `closed`/`overdue` sin pago (todo al día), con un período `open` en curso
- **THEN** la card "En curso" se renderiza como hero (ring de acento), sin card de pago terracota
- **AND** el timeline no muestra el paso "A pagar"

#### Scenario: La card "En curso" muestra el panel de ciclo

- **WHEN** el período en curso cierra el `28/06`, faltan 12 días, y va por el día 18 de un ciclo de 30
- **THEN** la card "En curso" muestra "CIERRA 28/06", "en 12 días", una barra de progreso del ciclo, y "Día 18 de 30"
- **AND** el badge "Sumando consumos" tiene un dot verde con pulso

#### Scenario: ARS y USD se muestran separados en el detalle

- **WHEN** el resumen a pagar tiene `$340.000` ARS y `US$ 150`
- **THEN** el monto ARS se muestra como primario grande y `US$ 150` subordinado y por separado
- **AND** no se muestra ningún total que sume o convierta ARS y USD

#### Scenario: Panel de límite sin límite cargado muestra CTA "Cargar límite"

- **WHEN** la tarjeta tiene `credit_limit=null`
- **THEN** el panel de límite muestra "Cargá el límite para ver cuánto te queda disponible." con un botón "Cargar límite" hacia `/cards/[id]/edit`
- **AND** no se renderiza barra de uso ni "Disponible $Z"

#### Scenario: Panel de límite cargado muestra usado, % y disponible

- **WHEN** la tarjeta tiene `credit_limit=$1.000.000` y `$650.000` comprometidos en ARS
- **THEN** el panel muestra "Límite usado $650.000 de $1.000.000", "65%", barra teñida con el acento, y "Disponible $350.000"

#### Scenario: Período por defecto al entrar es "A pagar" si existe

- **WHEN** el usuario abre el detalle de una tarjeta que tiene resumen "a pagar"
- **THEN** el período seleccionado por defecto es "A pagar" y la pestaña activa es "Movimientos del período"

#### Scenario: Tarjeta nueva muestra estado vacío sin timeline

- **WHEN** el usuario abre el detalle de una tarjeta sin movimientos ni pagos en ningún período
- **THEN** la pantalla NO renderiza timeline ni zona de resúmenes
- **AND** muestra un estado vacío con CTA "Registrar primer consumo"

---

### Requirement: El detalle de tarjeta muestra movimientos del período y cuotas en curso en pestañas

El sistema SHALL ofrecer en el detalle de tarjeta (`/cards/[id]`) dos pestañas: **"Movimientos del período"** y **"Cuotas en curso · N"** (donde N es la cantidad de compras en cuotas activas de la tarjeta).

**Selección de período.** El click en un paso del timeline, en la card "a pagar", en la card "en curso" o en la mini fila "próximo" SHALL cambiar el período mostrado en "Movimientos del período" y volver a esa pestaña. El elemento activo recibe un ring con el acento de la tarjeta. La transición NO usa `scrollIntoView` ni animación de entrada del pane.

**Pane "Movimientos del período".** SHALL listar los movimientos imputados al período seleccionado, agrupados por fecha, reutilizando el componente de fila de movimiento del módulo de transacciones. Cada fila muestra ícono de categoría con tint, comercio/descripción, caption "Categoría › Subcategoría", chips ("Cuota X de Y" y/o "Recurrente"), y el monto (ARS gasto en terracota; USD con etiqueta "USD" subordinada, nunca convertido). Cuando el período no tiene consumos, SHALL mostrar el estado vacío "Sin movimientos".

**Pane "Cuotas en curso".** SHALL mostrar una card intro con la cantidad de compras en cuotas y el total restante, y luego una card por compra con: ícono, nombre, sub ("Comprado el X · Categoría"), "cuota actual / total", una fila de dots de progreso (pagadas en acento, próxima en acento atenuado, futuras en gris), y un footer (Por cuota / Restante / Próxima cae). Cuando no hay compras en cuotas activas, SHALL mostrar el estado vacío "Sin compras en cuotas". Las cuotas son ARS-only (`I-CRED-9`).

#### Scenario: Cambiar de período actualiza los movimientos mostrados

- **WHEN** el usuario está viendo los movimientos del resumen "a pagar" y hace click en el paso "En curso" del timeline
- **THEN** el pane "Movimientos del período" pasa a mostrar los movimientos del período en curso
- **AND** la pestaña activa vuelve a ser "Movimientos del período"
- **AND** el paso "En curso" recibe el ring de acento

#### Scenario: Movimiento en cuotas muestra el chip "Cuota X de Y"

- **WHEN** el período seleccionado contiene la cuota 2 de 6 de una compra
- **THEN** la fila del movimiento muestra el chip "Cuota 2 de 6"

#### Scenario: Período sin movimientos muestra el estado vacío

- **WHEN** el período seleccionado no tiene consumos imputados
- **THEN** el pane muestra "Sin movimientos"

#### Scenario: La pestaña de cuotas muestra el contador y el total restante

- **WHEN** la tarjeta tiene 2 compras en cuotas activas con un total restante de `$1.160.000`
- **THEN** la pestaña se titula "Cuotas en curso · 2"
- **AND** el pane muestra una card intro con el total restante `$1.160.000`

#### Scenario: Card de cuota muestra los dots de progreso

- **WHEN** una compra va por la cuota 1 de 3
- **THEN** su card muestra 3 dots: el primero en acento (pagada/actual), el segundo en acento atenuado (próxima), el tercero en gris (futura)
- **AND** el footer muestra "Por cuota", "Restante" y "Próxima cae"

#### Scenario: Tarjeta sin cuotas muestra el estado vacío

- **WHEN** la tarjeta no tiene compras en cuotas activas
- **THEN** la pestaña se titula "Cuotas en curso · 0" y el pane muestra "Sin compras en cuotas"

---

### Requirement: El sistema muestra una pantalla con todos los resúmenes de una tarjeta

El sistema SHALL renderizar una pantalla `/cards/[id]/periods` que liste todos los `card_periods` de una tarjeta ordenados por `start_date` descendente. El `<h1>` de la pantalla SHALL ser **"Resúmenes"** (a secas), NO "Historial de resúmenes" — la lista incluye períodos pasados, presente y futuros, no solo historial.

Cada item SHALL mostrar el rango de fechas, el monto total de transacciones imputadas, la cantidad de movimientos, y un badge con la variante derivada (futuro / actual / cerrado-esperando-pago / vencido / pagado). El tap en un item SHALL navegar al detalle del período.

#### Scenario: La pantalla se titula "Resúmenes" sin la palabra "historial"

- **WHEN** el usuario navega a `/cards/[id]/periods`
- **THEN** el `<h1>` de la pantalla muestra exactamente "Resúmenes"

#### Scenario: Pantalla de resúmenes muestra cinco períodos en distintos estados

- **WHEN** el usuario abre la pantalla de resúmenes de una tarjeta con un período `paid`, dos `closed`, uno `open` y uno `futuro`
- **THEN** la lista los muestra todos con su badge correspondiente, ordenados por `start_date` desc

#### Scenario: Item de resumen muestra info contextual del pago cuando está pagado

- **WHEN** un item es de estado `paid`
- **THEN** la metadata muestra "Pagado DD-mm · N movimientos"

#### Scenario: El monto total del período usa aritmética decimal

- **WHEN** un período contiene consumos por `$0.10`, `$0.20` y un ajuste visual/total equivalente a `-$0.30`
- **THEN** el total monetario del período se calcula como `0`
- **AND** no quedan residuos binarios visibles ni comparables en la UI

---

### Requirement: El detalle de período muestra movimientos del período e info del pago

El sistema SHALL renderizar una pantalla `/cards/[id]/periods/[periodId]` con: rango de fechas del período, monto total, lista de movimientos imputados ordenados por `date ASC, created_at ASC, id ASC`, información del pago si el período es `paid` (monto, fecha, cuenta de pago), y link "Editar fechas" si las fechas son editables según las reglas del requirement de edición.

#### Scenario: Detalle de período pagado muestra info del pago

- **WHEN** el usuario abre un período `paid` que se pagó el `2026-05-15` desde la cuenta "Banco Galicia"
- **THEN** la pantalla muestra "Pagado el 15-may desde Banco Galicia"

#### Scenario: Detalle de período open muestra link "Editar fechas"

- **WHEN** el usuario abre un período `open` con cero transacciones imputadas
- **THEN** la pantalla muestra el link "Editar fechas" activo

#### Scenario: Detalle de período paid no muestra link "Editar fechas"

- **WHEN** el usuario abre un período `paid`
- **THEN** la pantalla NO muestra el link "Editar fechas"

---

### Requirement: El sistema muestra mora visible cuando un resumen vence sin pago

El sistema SHALL diferenciar visualmente los períodos `overdue` (vencidos sin pago) en todas las pantallas relevantes:

- **Listado de tarjetas** (`/cards`): la card del wallet muestra el pill de estado en tono "a pagar/urgente" (terracota) y el hero "A pagar este mes" incluye el monto vencido.
- **Detalle de tarjeta** (`/cards/[id]`): el paso "A pagar" del timeline aparece en color terracota y la card hero terracota "RESUMEN A PAGAR" comunica el vencimiento ("cerró el X · vence el Y" + cuenta regresiva, que pasa a negativo/"vencido hace N días" cuando `due_date < today`).
- **Pantalla de resúmenes** (`/cards/[id]/periods`): badge `Vencido` en color de error.

La cantidad de días vencido SHALL calcularse como `today − due_date`.

#### Scenario: Tarjeta vencida en el wallet muestra estado urgente

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-18'`, sin pago
- **THEN** su card del wallet muestra el pill de estado en tono terracota (a pagar/urgente)
- **AND** el hero "A pagar este mes" incluye el monto de esa tarjeta

#### Scenario: Detalle de tarjeta vencida muestra el hero terracota con vencimiento pasado

- **WHEN** el usuario abre el detalle de una tarjeta cuyo resumen a pagar venció hace 5 días
- **THEN** el paso "A pagar" del timeline está en terracota
- **AND** la card hero terracota indica el vencimiento pasado ("vencido hace 5 días") y mantiene el CTA "Registrar pago"

---

### Requirement: El usuario puede archivar una tarjeta sin deuda; con deuda es bloqueado

El sistema SHALL permitir archivar una tarjeta (set `accounts.is_active=false`) solo si se cumple **al menos una** de las siguientes condiciones:

- Todos los `card_periods` están en estado `paid`, o
- Todos los períodos no-paid no tienen transacciones imputadas (es decir, la tarjeta nunca tuvo consumos pendientes).

Si la tarjeta tiene algún período no-paid con al menos una transacción imputada, el sistema SHALL rechazar el archivado con un mensaje pedagógico. El check SHALL ejecutarse server-side.

#### Scenario: Archivar tarjeta sin movimientos

- **WHEN** el usuario archiva una tarjeta creada y nunca usada
- **THEN** la operación es aceptada y `is_active=false`

#### Scenario: Archivar tarjeta con todos los resúmenes pagados

- **WHEN** el usuario archiva una tarjeta cuyos períodos están todos en estado `paid`
- **THEN** la operación es aceptada

#### Scenario: Archivar tarjeta con resumen cerrado sin pagar es bloqueado

- **WHEN** el usuario intenta archivar una tarjeta con al menos un período `closed` o `overdue` con transacciones imputadas
- **THEN** la action retorna error tipado `pending_debt` y muestra el dialog "No se puede deshabilitar todavía"

#### Scenario: Archivar tarjeta con consumos en período `open` es bloqueado

- **WHEN** el usuario intenta archivar una tarjeta con un período `open` y consumos pendientes (status `pending`)
- **THEN** la action retorna error tipado `pending_debt`

---

### Requirement: El usuario puede reactivar una tarjeta archivada

El sistema SHALL permitir reactivar una tarjeta con `is_active=false` (set `is_active=true`). No hay validaciones adicionales: toda tarjeta archivada puede volver a activarse.

#### Scenario: Reactivar tarjeta archivada

- **WHEN** el usuario reactiva una tarjeta con `is_active=false`
- **THEN** la tarjeta queda con `is_active=true` y vuelve a aparecer en el listado activo

---

### Requirement: El usuario puede editar campos mutables de una tarjeta

El sistema SHALL presentar la edición de una tarjeta en un **drawer lateral derecho** que se desliza sobre el detalle de la tarjeta, con el mismo patrón de presentación que el drawer de movimientos (header fijo con eyebrow + nombre + cerrar, body scrolleable, footer fijo con Cancelar + Guardar cambios). El trigger "Editar" del detalle SHALL abrir el drawer en desktop. La ruta `/cards/[id]/edit` SHALL seguir resolviendo y renderizando el mismo formulario para deep-link y clientes sin JS.

Desde el drawer, el sistema SHALL permitir editar: **nombre**, **institución** (banco), **`credit_limit`**, y las **fechas del ciclo** (cierre/vencimiento del resumen actual y del próximo resumen). La edición de las fechas del ciclo SHALL delegar en la edición de fechas de período (cascada del borde y bloqueos de período pagado ya especificados), persistiendo **primero el período actual** y luego el próximo, y solo las fechas que cambiaron.

Los campos `type`, `network_id` y `other_network_name` SHALL ser inmutables post-creación: la red SHALL mostrarse como **chip read-only con candado** (no como un campo editable). Las monedas activas se rigen por bimoneda por defecto y NO se editan desde este formulario. Para cambiar la red, el usuario debe eliminar y recrear (solo posible si no tiene transacciones).

El drawer SHALL mostrar una **vista previa en vivo** que refleja nombre, inicial del avatar (derivada del nombre), red, banco, límite (con barra contra el monto comprometido) y un mini-diagrama de ciclo cierre→vence; el color de acento lo define el backend y no es un campo. El drawer SHALL ofrecer **archivar** (sujeto al check de deuda) y **eliminar** (habilitado solo si la tarjeta no tiene/tuvo movimientos; deshabilitado con copy explicativo en caso contrario). El botón Guardar SHALL estar deshabilitado mientras no haya cambios, y al cerrar con cambios sin guardar el sistema SHALL pedir confirmación de descarte.

#### Scenario: Editar abre el drawer sobre el detalle

- **WHEN** el usuario activa "Editar" en el detalle de una tarjeta activa
- **THEN** el drawer entra desde la derecha sobre el detalle
- **AND** el formulario aparece precargado con los datos reales de la tarjeta

#### Scenario: La ruta directa sigue funcionando como fallback

- **WHEN** el usuario navega directamente a `/cards/[id]/edit`
- **THEN** el formulario se renderiza en página con la misma lógica que el drawer

#### Scenario: Cambiar nombre de tarjeta

- **WHEN** el usuario cambia el nombre "Mi tarjeta" a "Visa Galicia"
- **THEN** `accounts.name` se actualiza y el resto de la tarjeta queda intacto

#### Scenario: Cambiar límite de crédito

- **WHEN** el usuario actualiza `credit_limit` de `$1.000.000` a `$1.500.000`
- **THEN** el campo se actualiza y los cálculos de "% disponible" se recalculan en la próxima lectura

#### Scenario: La red se muestra read-only y no se puede cambiar

- **WHEN** el usuario abre el drawer de edición
- **THEN** la red aparece como chip seleccionado read-only con candado
- **AND** un intento de cambiar `network_id` vía API es rechazado por el schema y la tarjeta queda intacta

#### Scenario: Editar las fechas del ciclo desde el drawer

- **WHEN** el usuario edita el cierre y/o vencimiento del resumen actual o del próximo y guarda
- **THEN** el sistema persiste primero las fechas del período actual (cascadeando el borde con el próximo si corresponde) y luego las del próximo
- **AND** se aplican las validaciones (vto > cierre, próximo cierre > cierre actual, próximo vto > próximo cierre) y los bloqueos de período pagado

#### Scenario: Eliminar deshabilitado con movimientos, archivar ofrecido

- **WHEN** la tarjeta tiene/tuvo movimientos
- **THEN** el botón Eliminar queda deshabilitado con copy explicativo
- **AND** Archivar queda disponible como acción recomendada

---

### Requirement: El sistema garantiza que el nombre de tarjeta autogenerado se compone de red y banco

Cuando el usuario crea una tarjeta sin especificar `name` (campo opcional), el sistema SHALL generar uno usando el formato `"<network.name> <institution.name>"` si ambos están definidos; si solo hay institución, usa `"Tarjeta <institution.name>"`; si solo hay red, usa `"<network.name>"`; si ninguno, usa `"Mi tarjeta"`.

#### Scenario: Alta sin nombre con red y banco completos

- **WHEN** un usuario crea una tarjeta sin completar el campo nombre, con red "Visa" y banco "Galicia"
- **THEN** `accounts.name` se popula con `"Visa Galicia"`

#### Scenario: Alta sin nombre y sin banco

- **WHEN** un usuario crea una tarjeta sin completar nombre, red ni banco
- **THEN** `accounts.name` se popula con `"Mi tarjeta"`

---

### Requirement: Solo el dueño puede leer y modificar sus card_periods y period_payments

El sistema SHALL aplicar Row Level Security sobre `card_periods` y `period_payments`. Para ambas tablas, la RLS SHALL exigir que `EXISTS (SELECT 1 FROM accounts WHERE id = card_periods.account_id AND user_id = auth.uid())`. La pertenencia se hereda vía join con la cuenta padre.

#### Scenario: RLS bloquea acceso a card_periods de otro usuario

- **WHEN** un usuario autenticado consulta `card_periods` sin filtro de `user_id`
- **THEN** Supabase retorna únicamente las filas cuya `account_id` matchea una cuenta propia

#### Scenario: RLS bloquea acceso a period_payments de otro usuario

- **WHEN** un usuario autenticado consulta `period_payments` sin filtro
- **THEN** Supabase retorna únicamente las filas cuya `period_id` matchea un período propio (a su vez vía cuenta propia)

---

### Requirement: El alta de tarjeta captura solo las fechas del resumen actual y crea el siguiente período estimado

El formulario de alta de tarjeta SHALL pedir únicamente el cierre y el vencimiento del resumen actual (`current_end_date`, `current_due_date`) — las dos fechas que el último extracto emitido anunció. El alta NO SHALL pedir fechas del próximo resumen.

El alta de tarjeta SHALL estar disponible en **web y mobile** (paridad). Ambas plataformas SHALL ejecutar la **misma** lógica de creación, expuesta como una única mutación compartida `createCreditCard` en `@grana/cards` que recibe `{ supabase, userId, input, today }`, valida con `createCreditCardSchema` y devuelve un resultado neutral (`CardMutationResult`: `{ ok: true, id }` o `{ ok: false, fieldErrors? | messageKey? | errorCode? }`). El paquete NO SHALL traducir texto: cada consumer resuelve el mensaje con su helper de i18n (`next-intl` en web, `useT` en mobile). El server action de web y el wrapper `lib/cards/mutations.ts` de mobile SHALL ser shells finos sobre esa mutación, divergiendo solo en resolución de `userId`, mapeo de error e invalidación/revalidación de caché. La presentación del formulario SHALL ser idiomática por plataforma (drawer/página en web; ruta nativa en mobile) conservando los mismos nombres y props públicas del componente (`CreateCardForm`).

Al crear la tarjeta, el sistema SHALL insertar dos períodos:

- **P1 (real)**: `start_date = current_end_date − 30 días`, `end_date = current_end_date`, `due_date = current_due_date`, `is_estimated = false`.
- **P2 (estimado)**: `start_date = current_end_date + 1 día`, con `end_date` y `due_date` proyectados mediante el algoritmo de sugerencia sobre los períodos existentes, `is_estimated = true`.

#### Scenario: Alta con dos fechas crea P1 real y P2 estimado

- **WHEN** un usuario da de alta una tarjeta con `current_end_date='2026-06-16'` y `current_due_date='2026-06-22'`
- **THEN** se crea P1 con `start_date='2026-05-17'`, `end_date='2026-06-16'`, `due_date='2026-06-22'`, `is_estimated=false`
- **AND** se crea P2 con `start_date='2026-06-17'`, `is_estimated=true`, y `end_date`/`due_date` proyectados desde P1

#### Scenario: El formulario no ofrece campos del próximo resumen

- **WHEN** el usuario abre el drawer de alta de tarjeta
- **THEN** la sección de ciclo muestra solo cierre y vencimiento del resumen actual
- **AND** el submit se habilita sin ningún dato del próximo resumen

#### Scenario: Consumo posterior al cierre cae en el período estimado

- **WHEN** la tarjeta tiene P1 (`end_date='2026-06-16'`) y P2 estimado, y el usuario registra un consumo con `date='2026-06-18'`
- **THEN** la transacción se inserta con `card_period_id` apuntando a P2
- **AND** no se pide ninguna fecha al usuario

#### Scenario: El alta nativa en mobile crea la tarjeta con la misma lógica que web

- **WHEN** el usuario completa el `CreateCardForm` nativo (institución, red o nombre custom, monedas con ARS, cierre y vencimiento del resumen actual) y confirma
- **THEN** mobile invoca la mutación compartida `createCreditCard` de `@grana/cards` con el `userId` autenticado y `today`
- **AND** se crean el account `type=credit`, sus `account_currencies` y los dos `card_periods` (P1 real + P2 estimado) idénticos a los que crearía web con el mismo input
- **AND** ante éxito se invalidan las query keys de cards y la app vuelve a `/cards`; ante error se muestra el mensaje resuelto desde `messageKey`/`fieldErrors` con `useT`, sin texto pre-traducido por el paquete

---

### Requirement: El pago de un resumen confirma las fechas del período en curso y crea el siguiente estimado

Cuando el resumen de un ciclo cierra, el banco emite el extracto e incluye en él las fechas del ciclo siguiente — el que está en curso al momento de pagar. El formulario de pago de P(n) SHALL pedir la **confirmación** de las fechas de P(n+1) (el período inmediatamente posterior al que se paga), pre-llenadas con las fechas persistidas de ese período. NO SHALL pedir fechas de períodos posteriores a P(n+1).

**Confirmación (pisado del estimado):** al registrar el pago, el sistema SHALL actualizar `end_date`/`due_date` de P(n+1) con las fechas ingresadas y marcar `is_estimated=false`. La actualización SHALL reusar la semántica de edición de fechas de período (cascada del borde y reasignación de transacciones):

- Si el cierre real es anterior al estimado, las transacciones de P(n+1) con `date` posterior al nuevo cierre SHALL reasignarse al período siguiente.
- Si P(n+2) existe con `is_estimated=true`, sin transacciones y sin pago, y el nuevo cierre de P(n+1) lo invadiera (`new_end_date >= P(n+2).end_date`), el sistema SHALL re-proyectarlo (`start_date = new_end_date + 1`, fechas re-estimadas) en lugar de rechazar. El rechazo existente de la edición de fechas aplica solo cuando el período siguiente tiene datos reales (transacciones, pago o fechas confirmadas).

**Período siguiente eager:** tras confirmar P(n+1), el sistema SHALL garantizar que exista P(n+2) con `is_estimated=true`, proyectado con el algoritmo de sugerencia desde los períodos confirmados. Si ya existía (generado lazy o re-proyectado), se conserva.

**Validación:** `next_end_date` SHALL ser posterior a `end_date` de P(n) (el `start_date` de P(n+1) es fijo: `P(n).end_date + 1`), y `next_due_date` posterior a `next_end_date`.

**Invariante resultante:** toda fecha de cierre/vencimiento confirmada (`is_estimated=false`) fue ingresada por el usuario en un momento en que el banco ya la había anunciado: P1 en el alta, P(n+1) al pagar P(n). `start_date` nunca se pide ni se estima.

#### Scenario: Pagar P1 confirma las fechas estimadas de P2 y crea P3 estimado

- **WHEN** una tarjeta tiene P1 (`end_date='2026-06-16'`, closed) y P2 estimado (`end_date='2026-07-14'` proyectado), y el usuario paga P1 ingresando `next_end_date='2026-07-16'`, `next_due_date='2026-07-22'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `due_date='2026-07-22'`, `is_estimated=false`
- **AND** se crea P3 con `start_date='2026-07-17'`, `is_estimated=true`, fechas proyectadas
- **AND** P1 queda en estado `paid`

#### Scenario: El formulario de pago se pre-llena con las fechas persistidas del período en curso

- **WHEN** el usuario abre el formulario para pagar P1 y P2 existe con `end_date='2026-07-14'`, `due_date='2026-07-20'`
- **THEN** el formulario muestra `2026-07-14` y `2026-07-20` como valores iniciales de cierre y vencimiento
- **AND** el copy indica que son las fechas del ciclo en curso a confirmar con el resumen recibido

#### Scenario: Cierre real anterior al estimado reubica consumos al período siguiente

- **WHEN** P2 estimado tiene `end_date='2026-07-20'` con un consumo del `2026-07-18`, y al pagar P1 el usuario confirma `next_end_date='2026-07-16'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `is_estimated=false`
- **AND** el consumo del `2026-07-18` queda asignado a P3 (estimado), creado o re-proyectado en la misma operación

#### Scenario: Validación rechaza un cierre que no es posterior al período pagado

- **WHEN** el usuario paga P1 (`end_date='2026-06-16'`) e ingresa `next_end_date='2026-06-10'`
- **THEN** la acción retorna un error localizado que nombra el cierre de P1 como ancla
- **AND** no se registra el pago ni se modifica ningún período

#### Scenario: P3 estimado vacío se re-proyecta en lugar de bloquear la confirmación

- **WHEN** existen P2 estimado (`end_date='2026-07-14'`) y P3 estimado sin transacciones ni pago (`end_date='2026-08-12'`), y al pagar P1 el usuario confirma `next_end_date='2026-08-15'` para P2
- **THEN** la confirmación procede: P2 queda con `end_date='2026-08-15'`, `is_estimated=false`
- **AND** P3 se re-proyecta con `start_date='2026-08-16'` y fechas re-estimadas

---

### Requirement: Los períodos estimados se señalizan en el detalle y la edición de la tarjeta

El sistema SHALL señalizar de forma discreta que las fechas de un período son estimadas (`is_estimated=true`) en el timeline de ciclo de vida del detalle de tarjeta y en el drawer de edición (sección fechas del ciclo). La señalización NO SHALL aparecer en el hero de `/cards`, en las cards del wallet ni en el dashboard.

#### Scenario: Timeline marca el período estimado

- **WHEN** el detalle de una tarjeta renderiza el timeline y el período "En curso" o "Próximo" tiene `is_estimated=true`
- **THEN** ese paso muestra una marca discreta de fechas estimadas (p. ej. "cierra ~DD/MM" o un sufijo "estimado")

#### Scenario: El drawer de edición distingue fechas estimadas

- **WHEN** el usuario abre el drawer de edición de una tarjeta cuyo próximo período es estimado
- **THEN** los campos de fechas de ese período indican que son estimadas y que se confirman al pagar el resumen

#### Scenario: Las superficies de lectura no señalizan

- **WHEN** el hero de `/cards` o el dashboard muestran vencimientos provenientes de períodos estimados
- **THEN** los montos y fechas se muestran sin badge ni marca adicional

---

### Requirement: La cotización de la deuda USD se captura al pagar el resumen, no al registrar el consumo

El registro de un consumo en USD en una tarjeta NO SHALL exigir cotización: la deuda del período se computa por moneda (`pendingAmountARS` / `pendingAmountUSD`) y la conversión real ocurre recién al pagar el resumen, con la cotización del día de pago. El campo `fx_rate_to_ars` del consumo queda como dato opcional/histórico, sin uso contable en el alta.

Al pagar un resumen cuyo período tiene deuda USD pendiente (`pendingAmountUSD > 0`), el sistema SHALL exigir la **cotización del día de pago** (decimal de hasta 6 posiciones, sin agrupado de miles) y SHALL computar el total sugerido como `pendiente ARS + pendiente USD × cotización`, mostrando el desglose (pendiente ARS, pendiente USD convertido, total). El gasto ARS resultante del pago SHALL persistir la cotización usada (`fx_rate_to_ars` en la transacción de pago) para trazabilidad. El monto final sigue siendo editable por el usuario (puede redondear o pagar parcial); la cotización es obligatoria, el monto no se fuerza.

Sin deuda USD pendiente, el flujo de pago no pide cotización y no cambia.

A nivel base de datos, el invariante I-CRED-11 SHALL reflejar este modelo: el consumo USD en tarjeta acepta `fx_rate_to_ars` nulo (cuando está presente debe ser > 0), el consumo ARS lo rechaza, los gastos no-credit lo aceptan cuando es > 0 (pago de resumen), y todo tipo no-expense lo rechaza.

Los períodos pagados SHALL exponer lo pagado **por moneda** (`paidAmountARS` / `paidAmountUSD`) y el detalle del movimiento de pago SHALL mostrar la composición del resumen (porción ARS y porción USD) junto con la cotización usada, en lugar de repetir el período que la nota de contexto ya nombra.

#### Scenario: Alta de consumo USD sin cotización

- **WHEN** el usuario registra un gasto en USD con una tarjeta de crédito
- **THEN** el formulario no pide cotización y el consumo se guarda con `fx_rate_to_ars` nulo
- **AND** el consumo suma a la deuda USD del período, separada de la ARS

#### Scenario: Pago de resumen con deuda USD pide la cotización del día

- **WHEN** el usuario abre el pago de un período con `pendingAmountUSD > 0`
- **THEN** el formulario muestra un campo de cotización (ARS por 1 USD) obligatorio
- **AND** al cargarla muestra el desglose: pendiente ARS + (USD × cotización) = total sugerido
- **AND** el monto a pagar se autocompleta con ese total y sigue siendo editable

#### Scenario: El backend rechaza pagar deuda USD sin cotización

- **WHEN** llega un pago para un período con deuda USD pendiente y sin cotización (> 0)
- **THEN** la acción es rechazada con un error localizado
- **AND** no se crea el gasto de pago ni se marca el período como pagado

#### Scenario: La cotización queda registrada en el pago

- **WHEN** se confirma el pago de un período con deuda USD y cotización `1.230,50`
- **THEN** la transacción de pago (gasto ARS) persiste `fx_rate_to_ars = 1230.50`

#### Scenario: Confirmar recurrencia USD en tarjeta no pide cotización

- **WHEN** el usuario confirma una instancia recurrente de gasto USD sobre una tarjeta
- **THEN** el confirm no pide cotización y genera el consumo USD sin `fx_rate_to_ars`

#### Scenario: Resumen pagado muestra lo pagado por moneda

- **WHEN** el usuario pagó un período que tenía `$10.000,50` ARS y `u$s 50` de deuda
- **THEN** la lista de resúmenes y el detalle del período muestran `$10.000,50` y `u$s 50` pagados (no `u$s 0`)
- **AND** el detalle del movimiento de pago muestra la composición (pesos y dólares del resumen) y la cotización usada

#### Scenario: Editar la fecha de un consumo lo mueve al resumen correspondiente

- **WHEN** el usuario edita un consumo pendiente y la nueva fecha cae dentro de otro período sin pagar
- **THEN** el consumo se reasigna a ese período (`card_period_id` y `due_date` actualizados)
- **AND** si la nueva fecha cae en un resumen ya pagado, la edición se rechaza con un error localizado

---

### Requirement: El período activo mostrado en el detalle de tarjeta MUST priorizar la deuda sobre la apertura

Cuando el usuario abre el detalle de una tarjeta, el sistema MUST mostrar el período más urgente como "período activo", siguiendo este orden de prioridad:

1. **Vencido con deuda** (`overdue`, `tx_count > 0`): el período con `due_date < today`, sin pago, con transacciones.
2. **Cerrado esperando pago** (`closed`, `tx_count > 0`): el período con `end_date < today ≤ due_date`, sin pago, con transacciones.
3. **Período abierto actual** (`open`): el período cuyo rango contiene `today`.
4. **Fallback**: el último período no pagado (por `end_date` descendente).

Esta priorización garantiza que, incluso cuando existe un período nuevo y vacío (creado al pagar el anterior), el sistema muestre el período cerrado con deuda pendiente si lo hubiera, y no el período futuro vacío.

#### Scenario: Tarjeta con período closed y período open posterior muestra el closed

- **WHEN** una tarjeta tiene P1 en estado `closed` con 3 transacciones pendientes y P2 en estado `open` con 0 transacciones, y `today` cae dentro del rango de P2
- **THEN** el detalle de la tarjeta muestra P1 como período activo (con CTA "Pagar resumen")
- **AND** P2 aparece en la sección "Próximos resúmenes"

### Requirement: El header de `/cards` se renderiza desde el primer paint y sus secciones cargan independientemente

El header de `/cards` SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del módulo. El cuerpo de la ruta — hero del mes, wallet de tarjetas activas, sección de archivadas — SHALL renderizarse como secciones aisladas, cada una con su propio fallback de carga y de error, de modo que un fallo en una sección no tire la ruta ni esconda el header. El mecanismo cambia según la plataforma:

**Web — estructura de archivos:**

- `apps/web/app/(app)/cards/layout.tsx` (server component, sync) SHALL montar `<CardsHeader />` y renderizar `{children}` debajo. El header persiste como chrome del segmento entre transiciones de `{children}` (loading, error, navegación a hijos como `/cards/[id]`).
- `apps/web/app/(app)/cards/loading.tsx` SHALL renderizar los skeletons shape-matched de las tres secciones (month hero skeleton + wallet skeleton + archived cards skeleton) en la misma disposición que el cuerpo de la ruta. Actúa como fallback del `{children}` del layout durante la transición de segmento.
- `apps/web/app/(app)/cards/page.tsx` SHALL renderizar el scaffold de `<Suspense>` envuelto por el Client Component error boundary (`CardsErrorBoundary`), SIN remontar el header. El page MAY seguir siendo async para `await getTranslations()` si las strings de los `<SectionFallback>` se resuelven server-side ahí, o MAY migrarlas a containers async dedicados para volverse sync; ambas opciones son válidas siempre que el header no se duplique.
- El page NO SHALL hacer `await supabase.auth.getUser()` ni `redirect('/login')`: el auth check ya lo cubre `(app)/layout.tsx`.

**Web — header (`<CardsHeader />`), comportamiento sin cambios:**

El header (título "Tarjetas", subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`, botón "Agregar tarjeta") SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- El **count** del subtítulo SHALL renderizarse como `"-"` (guion) mientras la query no resuelve. Cuando resuelve, SHALL pasar al número real de tarjetas activas. Si la query falla, SHALL permanecer en `"-"` indefinidamente para no bloquear la lectura del resto del header.
- El **mes** del subtítulo SHALL derivarse de `getTodayAR()` (idéntico criterio que el header del dashboard) y NO SHALL depender de ninguna query — está disponible desde el primer render.
- El botón "Agregar tarjeta" SHALL renderizarse en estado **disabled** mientras las queries de catálogos necesarias para abrir el drawer (`institutions`, `card_networks`) no resuelvan. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esas queries resuelven, SHALL pasar a habilitado. Si esas queries fallan, el botón SHALL permanecer disabled para no abrir un drawer sin data.

**Web — cuerpo (scaffold de Suspense):**

El cuerpo de la ruta web SHALL renderizarse como un scaffold de `<Suspense>` boundaries, cada uno con un fallback visualmente coherente (estilo `SectionFallback` ya usado en dashboard: borde dashed, mensaje de carga, min-height que aproxima el tamaño del contenido final). Cada sección SHALL fetchar su propia data en un container server async aislado:

- `CardsMonthHeroContainer` SHALL llamar `getCardsMonthSummary()`.
- `WalletContainer` SHALL llamar `getCreditCards` filtrando tarjetas activas únicamente.
- `ArchivedCardsContainer` SHALL llamar `getCreditCards` filtrando tarjetas archivadas únicamente.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`CardsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al try/catch de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header** (que vive en el layout y queda fuera del boundary), con un `onRetry` que resetea el state del boundary.

**Mobile (`apps/mobile/app/(app)/cards.tsx`).** Sin cambios respecto a la versión previa. El header SHALL ser un componente que envuelve el `PageHeader` custom del app mobile (nunca el header nativo del stack), con:

- Título "Tarjetas".
- Subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`. Mientras la query del count no resuelve (o si falla), el subtítulo SHALL mostrar `-` en el slot del número. El mes se deriva de `getTodayAR()` y NO depende de ninguna query.
- Acción derecha: CTA "Agregar tarjeta" en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista. SHALL renderizarse con su ícono y label, sin onPress activo. Cuando aterrice `/cards/new` mobile, pasará a habilitado vía actualización del propio componente.

El cuerpo mobile SHALL componerse de tres secciones independientes, cada una con su propia query react-query y su propio fallback de carga/error:

- `CardsMonthHero`: react-query con key `['cards', 'month-summary']` llamando `getCardsMonthSummary()`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando resumen del mes…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar el resumen del mes" />`.
- `Wallet`: react-query con key `['cards']` llamando `getCreditCards({ includeArchived: false })`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando tarjetas…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar las tarjetas" />`. Si la query resuelve con cero tarjetas activas, SHALL renderizar el estado vacío del wallet (mismo copy que web).
- `ArchivedCardsSection`: react-query con key `['cards', 'archived']` llamando `getCreditCards({ archivedOnly: true })`. Mientras `isPending`, NO SHALL ocupar espacio visible (la sección entera es opcional). Si `isError`, SHALL renderizar un `<SectionFallback>` discreto al final del scroll. Si resuelve con cero, NO SHALL renderizar nada.

Un error en una sección NO SHALL afectar el render de las otras ni del header. Mobile NO usa un error boundary global para esta ruta; el aislamiento se logra porque cada query react-query maneja su propio error sin throw al render parent.

Esta receta SHALL seguir el patrón "in-page loading y error para mantener el chrome visible" descripto en el spec `route-loading-and-errors`. La versión web es consumidor de **Variant C** (junto con `/dashboard`, `/transactions` y `/accounts`); la versión mobile lo implementa con el toolkit del app mobile.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/cards` y las queries del header (count, institutions, card_networks) todavía no resolvieron
- **THEN** el header ya está montado con el título "Tarjetas" y el subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` (durante el render del page) o los skeletons shape-matched (durante la transición de segmento, cuando `cards/loading.tsx` cubre el área del contenido)

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/dashboard` y navega a `/cards`
- **THEN** durante la transición del segmento, el `<CardsHeader />` aparece desde el primer paint del nuevo segmento (proviene de `cards/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `cards/loading.tsx` mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: Resolver las queries del header actualiza el count y habilita el botón (web)

- **WHEN** las queries del header resuelven con 3 tarjetas activas
- **THEN** el subtítulo del header pasa a `"3 tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" pasa a habilitado y abre el drawer al click

#### Scenario: Fallo de la query de catálogos deja el botón disabled (web)

- **WHEN** la query de `institutions` o `card_networks` falla
- **THEN** el botón "Agregar tarjeta" permanece disabled
- **AND** el resto del header (título, mes, count cuando resuelva) sigue visible y funcional

#### Scenario: Fallo del count deja el subtítulo en guion sin afectar el resto (web)

- **WHEN** la query del count de tarjetas activas falla
- **THEN** el subtítulo del header sigue mostrando `"- tarjetas de crédito · resúmenes de {mes}"` indefinidamente
- **AND** el botón "Agregar tarjeta" puede igual estar habilitado si las queries de catálogos resolvieron

#### Scenario: Cada sección muestra su propio fallback de carga mientras la otra ya cargó (web)

- **WHEN** el hero del mes ya resolvió pero la query del wallet aún no
- **THEN** el hero se muestra con su data
- **AND** el wallet sigue mostrando su `<SectionFallback>` con mensaje de carga
- **AND** la sección de archivadas muestra independientemente su propio estado (loading o ya resuelto)

#### Scenario: Un error en una sección no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCardsMonthSummary()` falla en web
- **THEN** el área del hero muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible y completamente funcional
- **AND** el wallet y las archivadas siguen renderizándose normalmente con su propia data
- **AND** el `error.tsx` del layout group `(app)` NO se monta

#### Scenario: Un throw fuera de los containers es capturado por el error boundary in-page (web)

- **WHEN** un throw ocurre durante el render del page (no del layout) fuera de los `try/catch` de los containers
- **THEN** el `CardsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta (que vive en el layout) sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render del page

#### Scenario: La sección de archivadas no se renderiza cuando el usuario no tiene archivadas (web)

- **WHEN** la query de tarjetas archivadas resuelve con cero filas
- **THEN** el `ArchivedCardsContainer` no renderiza ni el header ni el contenedor de la sección
- **AND** el `<SectionFallback>` de archivadas deja de mostrarse al resolver la query (no queda un slot vacío visible)

#### Scenario: El PageHeader mobile se ve antes de que resuelvan las queries del módulo

- **WHEN** un usuario mobile abre `/cards` y las queries de count, month-summary y cards todavía no resolvieron
- **THEN** el `PageHeader` ya está montado con título "Tarjetas" y subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el CTA "Agregar tarjeta" está visible en estado disabled
- **AND** cada una de las secciones del cuerpo muestra su propio `<SectionFallback>` de carga

#### Scenario: Resolver la query del count en mobile actualiza el subtítulo

- **WHEN** la query del count mobile resuelve con 3 tarjetas activas
- **THEN** el subtítulo del header pasa a `"3 tarjetas de crédito · resúmenes de {mes}"`
- **AND** el CTA "Agregar tarjeta" permanece en estado disabled (la ruta `/cards/new` mobile aún no existe en este change)

#### Scenario: Fallo del count en mobile deja el subtítulo en guion sin afectar el resto

- **WHEN** la query del count mobile falla
- **THEN** el subtítulo del header sigue mostrando `"- tarjetas de crédito · resúmenes de {mes}"` indefinidamente
- **AND** las otras secciones siguen renderizándose normalmente con su propia data

#### Scenario: Falla la query del hero del mes en mobile sin tirar la ruta

- **WHEN** la query `getCardsMonthSummary()` mobile falla
- **THEN** la sección del hero muestra `<SectionFallback>` con su mensaje de error
- **AND** el header permanece visible y completamente funcional
- **AND** el wallet y las archivadas siguen renderizándose normalmente con su propia data
- **AND** la pantalla `/cards` mobile no muestra una pantalla de error global

#### Scenario: Falla la query del wallet en mobile sin tirar la ruta

- **WHEN** la query `getCreditCards({ includeArchived: false })` mobile falla
- **THEN** la sección del wallet muestra `<SectionFallback>` con su mensaje de error
- **AND** el header, el hero del mes y la sección de archivadas siguen renderizándose normalmente

#### Scenario: La sección de archivadas mobile no se renderiza cuando el usuario no tiene archivadas

- **WHEN** la query mobile de tarjetas archivadas resuelve con cero filas
- **THEN** la sección "Archivadas" mobile no renderiza ni el encabezado ni el contenedor
- **AND** no queda un slot vacío ni un `<SectionFallback>` visible al final del scroll

#### Scenario: Cargando archivadas en mobile no ocupa espacio visible

- **WHEN** la query mobile de tarjetas archivadas todavía está `isPending`
- **THEN** la sección "Archivadas" mobile no renderiza un fallback ni ocupa espacio en el scroll
- **AND** el resto de las secciones se ven sin gap reservado

### Requirement: El estilo visual de `/cards` (raíz) sigue el handoff `docs/design/cards/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/cards` (raíz, sin segmentos hijos) como la **vista compacta agrupada por banco** descripta en el requirement del listado, siguiendo el mockup de referencia `docs/mockups/cards-compact-final.png` como referencia **normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock.

**Hero navy.** El hero del mes se renderiza como una **card oscura navy** (mismo patrón de superficie que el hero del dashboard: `bg-surface-dark`/`bg-navy`, texto blanco): a la izquierda **dos cifras** en Bimoneda (ARS primario + USD subordinado por separado; si una moneda es 0, su línea USD MAY omitirse, pero la cifra ARS sigue mostrando `$ 0`):
- **A pagar (ahora)** — resúmenes cerrados e impagos.
- **En curso** — resúmenes abiertos con saldo; acumulado del ciclo, con caption "se sigue sumando hasta el cierre".
A la derecha, **"Próximos cierres"** — una tarjeta por fila (`fecha de cierre · nombre`, sin monto), ordenada por fecha de cierre y capada en `NEXT_CLOSES_CAP` (6). NO muestra otros KPIs separados.

**Reglas de presentación de la vista compacta.**

- **Web**: grupos por banco **desplegables** con encabezado (chevron, dot del banco, nombre, "N tarjetas · M en uso", total a pagar del banco, badge de urgencia). Default "Por banco"; toggle "Todas" (plano). Auto-colapso de bancos 100% al día y en $0. Cada tarjeta en **2 filas** (identidad + resumen + estado; etiquetas apiladas Cierre/Vence/Uso, con Uso = % del resumen o "Sin límite"). NO SHALL renderizarse como wallet de cards grandes ni como carrusel.
- **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco y desplegable, sin tabla horizontal, con dot de estado por fila. NO SHALL renderizarse como carrusel de cards grandes.

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
- **THEN** la composición sigue la estructura del mockup `docs/mockups/cards-compact-final.png`: header con título + acción primaria, hero unificado (A pagar + En curso, ARS/USD; próximos cierres), controles de vista (Por banco / Todas), vista compacta de grupos desplegables con filas de 2 líneas, y sección archivadas opcional al final
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
- **THEN** existen controles de orden/filtro (al menos "Por banco" y "Todas") y los grupos de banco se pueden colapsar/expandir
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

### Requirement: Cada tarjeta recuerda su alícuota de impuesto de sellos

El sistema SHALL almacenar por tarjeta una alícuota de impuesto de sellos (`stamp_tax_rate`), oculta para el usuario. El valor `NULL` significa que la tarjeta todavía no tiene alícuota conocida. La alícuota solo puede tener valor en cuentas de tipo crédito.

#### Scenario: Tarjeta sin alícuota conocida

- **WHEN** se crea una tarjeta de crédito
- **THEN** su `stamp_tax_rate` es `NULL` (todavía no conocida)

#### Scenario: La alícuota se persiste al confirmarse el primer sello

- **WHEN** el usuario confirma un monto de impuesto de sellos mayor a cero al pagar un resumen de una tarjeta cuya `stamp_tax_rate` es `NULL`
- **THEN** el sistema deriva la alícuota como `monto ÷ base` (base = total ARS del resumen) y la persiste en la tarjeta

#### Scenario: Una cuenta que no es de crédito no puede tener alícuota

- **WHEN** se intenta asignar una `stamp_tax_rate` a una cuenta cuyo `type` no es `credit`
- **THEN** la operación es rechazada por la restricción de integridad

### Requirement: El pago de un resumen incorpora el impuesto de sellos

Al pagar un resumen, el sistema SHALL ofrecer registrar el impuesto de sellos y, si el usuario confirma un monto mayor a cero, incluirlo en el monto total pagado. El monto del sello SHALL ser siempre editable antes de confirmar el pago.

La base de cálculo SHALL ser el total ARS del resumen (consumos `pending` en ARS menos reintegros), determinada **antes** de registrar el movimiento de sello.

#### Scenario: Primera vez — selector de monto sin mencionar el porcentaje

- **WHEN** el usuario va a pagar un resumen de una tarjeta cuya `stamp_tax_rate` es `NULL`
- **THEN** el sistema muestra un selector de montos en pesos (sugerencias calculadas a partir de las alícuotas más comunes, una opción de monto libre y una opción "No me cobraron sellos")
- **AND** muestra un aviso de que el dato se pide solo esta vez y que en los próximos resúmenes se sugerirá solo
- **AND** no se menciona ningún porcentaje al usuario

#### Scenario: Próximas veces — monto pre-cargado y editable

- **WHEN** el usuario va a pagar un resumen de una tarjeta con `stamp_tax_rate` conocida
- **THEN** el campo de impuesto de sellos viene pre-cargado con `round(base × stamp_tax_rate)`
- **AND** el usuario puede editar ese monto antes de confirmar

#### Scenario: El monto del sello se suma al total pagado

- **WHEN** el usuario confirma el pago con un monto de sello mayor a cero
- **THEN** el monto total pagado (la expensa en la cuenta de pago) es `consumos + sello`

### Requirement: El impuesto de sellos se registra como movimiento dentro del resumen pagado

Cuando el usuario confirma un monto de impuesto de sellos mayor a cero al pagar, el sistema SHALL registrar una transacción de la tarjeta asignada a ese período, con fecha igual al último día del resumen (`end_date` del período), categoría sistema `impuestos` y subcategoría `impuesto-de-sellos`, en ARS, y SHALL dejarla dentro del resumen pagado.

#### Scenario: El sello queda como movimiento pagado del período

- **WHEN** el usuario confirma el pago con un monto de sello mayor a cero
- **THEN** se inserta una transacción de tipo gasto en la tarjeta, asignada a ese período (`card_period_id`), con fecha igual al `end_date` del período, categoría `impuestos` / subcategoría `impuesto-de-sellos`, en ARS
- **AND** esa transacción queda en estado `paid` junto con el resto del resumen

#### Scenario: Monto cero no registra movimiento ni cambia la alícuota

- **WHEN** el usuario indica "No me cobraron sellos" o deja el monto en cero
- **THEN** no se inserta ningún movimiento de sello
- **AND** la `stamp_tax_rate` de la tarjeta no se modifica

#### Scenario: La base excluye el propio sello

- **WHEN** se calcula el monto del sello a partir de la alícuota
- **THEN** la base usada es el total del resumen previo a la inserción del sello, de modo que el sello no se incluye en su propia base

### Requirement: Las mutaciones de tarjeta viven en `@grana/cards` con contrato neutral; web y mobile son shells

Toda mutación de tarjeta —no sólo el alta— SHALL ejecutar una **única lógica compartida** expuesta en `@grana/cards`, recibiendo `{ supabase, userId, input, today }`, validando con su schema de `@grana/validation` cuando aplique, y devolviendo un resultado neutral `CardMutationResult` (`{ ok: true, id? }` o `{ ok: false, fieldErrors? | messageKey? | errorCode? }`). Esto cubre al menos: pago de resumen (`payCardPeriod`, con su rollback interno de fallo parcial), edición de fechas de ciclo (`updatePeriodDates`), edición de la tarjeta (`updateCreditCard`), y edición/borrado de la madre de cuotas (`updateInstallmentParent`, `deleteInstallmentParent`).

El paquete NO SHALL traducir texto ni devolver mensajes pre-traducidos: cada consumer resuelve el mensaje con su helper de i18n (`next-intl`/`translatePostgresError` en web, `useT` en mobile) a partir de `messageKey`/`errorCode`/`fieldErrors`. Los `formError` literales en castellano de las server actions previas SHALL migrarse a `messageKey` (`cards.errors.*`), agregando la entrada de catálogo con el MISMO texto en ambas plataformas.

El server action de web y el wrapper `lib/cards/mutations.ts` de mobile SHALL ser shells finos sobre esas mutaciones, divergiendo sólo en: resolución de `userId`, mapeo del resultado neutral a su `ActionResult`, e invalidación/revalidación de caché (web `revalidatePath`, mobile invalidación de query keys). Las mutaciones SHALL componer los internals compartidos que ya existan (p. ej. el patrón madre/hija de cuotas en `@grana/transactions-mutations`) en vez de duplicarlos. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`.

#### Scenario: Una mutación de tarjeta corre la misma lógica en web y mobile

- **WHEN** un consumer (web o mobile) paga un resumen, edita las fechas del ciclo, edita la tarjeta o edita/borra la madre de cuotas
- **THEN** invoca la mutación compartida de `@grana/cards` con su propio client, el `userId` autenticado y `today`
- **AND** recibe un `CardMutationResult` neutral, sin texto pre-traducido por el paquete

#### Scenario: El error neutral se resuelve en cada plataforma

- **WHEN** una mutación de tarjeta falla con `messageKey` (p. ej. `cards.errors.pending_debt`) o `errorCode`
- **THEN** web resuelve el texto con `next-intl`/`translatePostgresError` desde el shell del server action
- **AND** mobile resuelve el texto con `useT` desde `lib/cards/mutations.ts`
- **AND** ninguna plataforma lee un string en castellano devuelto por `@grana/cards`

#### Scenario: El shell web conserva la revalidación

- **WHEN** una mutación de tarjeta tiene éxito desde un server action de web
- **THEN** el shell invoca los `revalidatePath` que esa action invocaba antes (`/cards`, `/transactions`, `/shared` según corresponda)
- **AND** el comportamiento observable de las vistas de `/cards` no cambia

### Requirement: El archive y la reactivación de una tarjeta se realizan vía las mutaciones de cuentas

Como una tarjeta de crédito ES una cuenta (`accounts.type = 'credit'`), su archive y reactivación SHALL realizarse mediante las mutaciones compartidas de `@grana/accounts` (`archiveAccount` / `reactivateAccount`), que ya aplican el guard R-tarjeta (bloqueo si hay deuda pendiente) cuando `type === 'credit'`. NO SHALL existir una mutación de archive de tarjeta paralela que duplique ese guard. El server action de web que hoy desactiva la tarjeta SHALL delegar en `archiveAccount` (o la UI de cards SHALL invocar directamente la action de archive de cuentas), conservando su revalidación.

#### Scenario: Archivar una tarjeta con deuda pendiente se bloquea

- **WHEN** un consumer intenta archivar una tarjeta que tiene deuda pendiente
- **THEN** la operación pasa por `@grana/accounts.archiveAccount`, que detecta la deuda vía `getCreditCardDebtCheck`
- **AND** devuelve un resultado neutral con `messageKey`/`reason` de deuda pendiente, sin desactivar la tarjeta

#### Scenario: No existe una mutación de archive de tarjeta duplicada

- **WHEN** se revisa el write path de tarjetas tras este change
- **THEN** no hay una mutación de archive específica de tarjeta que reimplemente el guard de deuda
- **AND** el archive/reactivate de tarjeta resuelve en `@grana/accounts`
