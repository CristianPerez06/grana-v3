# cards Specification

## Purpose

Cubre las tarjetas de crédito como módulo de primera clase del producto. Modela cada resumen como un período con cuatro fechas (apertura, cierre, vencimiento, próximo cierre) cuyo estado se deriva sin persistir, soporta el alta de tarjeta con su único flujo de cuatro fechas, el registro de consumos en una o varias cuotas (ARS only por invariante `I-CRED-9`), el pago del resumen como `expense` en una cuenta cash o bank (única transacción que reduce `disponible` por la regla off-ledger), la reversión del pago, y las vistas de listado (wallet en grilla con hero de pago mensual) y de detalle (organizado por el ciclo de vida del resumen: a pagar / en curso / próximo, con movimientos y cuotas en curso).

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

#### Scenario: Consumo cae en período actual

- **WHEN** existe un período con `start_date='2026-05-16'` y `end_date='2026-06-15'` y se inserta una transacción con `date='2026-05-30'` en esa tarjeta
- **THEN** la transacción se inserta con `card_period_id` apuntando a ese período

#### Scenario: Edición de fechas reubica transacción a otro período

- **WHEN** un usuario edita `end_date` de un período `open` y al recalcular, una transacción cuyo `date` antes caía dentro ahora cae en el período siguiente (existente)
- **THEN** la transacción se reubica: `card_period_id` se actualiza al nuevo período
- **AND** el sistema muestra al usuario un preview de impacto antes de confirmar

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

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) con esta estructura, de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resúmenes de <mes>"). Acciones a la derecha: "Resúmenes anteriores" (ghost, solo web — opcional en mobile) y "Agregar tarjeta" (primario). En web el CTA navega a `/cards/new`. En mobile el CTA SHALL renderizarse en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista (no abre nada al press); cuando esa ruta aterrice, pasa a habilitado.
2. **Hero "A pagar este mes"**: agrega el total a pagar de **todas** las tarjetas activas (períodos sin pago `closed`/`overdue`). El monto ARS se muestra como primario en tipografía grande; el total USD se muestra **subordinado y por separado**, NUNCA sumado ni convertido (principio Bimoneda). El hero destaca el próximo vencimiento más cercano y lista los siguientes vencimientos.
   - **Layout web**: dos columnas (monto agregado a la izquierda + lista de próximos vencimientos a la derecha) en `md+`, una columna debajo.
   - **Layout mobile**: una sola columna; primero el monto agregado con el destacado del próximo vencimiento, luego la lista de próximos vencimientos como filas en el mismo container.
3. **Sección "Mis tarjetas"** + hint "Tocá una para ver el resumen".
4. **Wallet** de tarjetas activas. El componente público SHALL llamarse `Wallet` en ambas plataformas; cada implementación elige internamente la presentación:
   - **Web**: grilla — 2 columnas en `md+`, 1 columna debajo de `md`.
   - **Mobile**: carrusel horizontal con snap, que muestra una card por viewport y deja peek de la siguiente.

Cada **card del wallet** SHALL mostrar: una franja lateral con el acento de la tarjeta (`--cc-accent` derivado de `resolveAccountAvatar`, no hardcodeado por marca), avatar con la inicial del banco, nombre, meta "Crédito · <red>" (**sin número de tarjeta** — la app no lo almacena), un pill de estado (a pagar / cierra pronto / al día), stats (resumen del mes · cierra · vence), barra de límite teñida con el acento **solo si `credit_limit` está cargado**, y un footer con la cantidad de compras en cuotas activas ("N compras en cuotas" o "Sin cuotas activas") + link "Ver resumen". El click/tap en una card SHALL navegar a `/cards/[id]`.

El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado van al final, alfabéticas.

El wallet SHALL incluir únicamente tarjetas activas (`is_active=true`). Las archivadas (`is_active=false`) NO aparecen en el wallet, pero el sistema SHALL exponerlas en una sección secundaria **"Archivadas"** debajo, colapsable (cerrada por defecto), con encabezado `Archivadas (N)`, solo cuando existe al menos una, listando cada una con enlace a su detalle (`/cards/[id]`) para que `[Reactivar]` sea alcanzable.
- **Web**: la sección colapsable usa `<details>` nativo (no requiere JS).
- **Mobile**: la sección colapsable usa un `Pressable` que togglea state local (`useState`); no hay `<details>` en React Native.

#### Scenario: Hero agrega el total a pagar con ARS y USD separados

- **WHEN** el usuario tiene dos tarjetas con resúmenes a pagar: una con `$120.000` ARS y otra con `$80.000` ARS + `US$ 200`
- **THEN** el hero "A pagar este mes" muestra `$200.000` como monto ARS primario
- **AND** muestra `US$ 200` como total USD subordinado y por separado
- **AND** en ningún caso suma ni convierte ARS y USD en un solo número

#### Scenario: Hero destaca el próximo vencimiento y lista los siguientes

- **WHEN** el usuario tiene tarjetas con vencimientos `10/06`, `18/06` y `25/06`
- **THEN** el hero destaca el vencimiento del `10/06`
- **AND** la lista "Próximos vencimientos" muestra las tres filas con día/mes, tarjeta y monto

#### Scenario: Wallet en grilla con dos tarjetas activas (web)

- **WHEN** el usuario abre `/cards` en web con dos tarjetas activas
- **THEN** se renderiza una grilla de cards (no un carrusel horizontal), ordenadas por fecha de cierre ascendente
- **AND** cada card muestra franja de acento, avatar, nombre, meta sin número de tarjeta, pill de estado, stats, y footer de cuotas

#### Scenario: Wallet en carrusel con tres tarjetas activas (mobile)

- **WHEN** el usuario abre `/cards` en mobile con tres tarjetas activas
- **THEN** se renderiza un carrusel horizontal con snap, ordenado por fecha de cierre ascendente
- **AND** se ve una card por viewport y se asoma una porción ("peek") de la siguiente
- **AND** cada card muestra los mismos elementos visuales que en web (franja, avatar, nombre, pill, stats, barra de límite, footer)

#### Scenario: Card sin límite cargado omite la barra de límite

- **WHEN** una tarjeta tiene `credit_limit=null`
- **THEN** su card del wallet no renderiza la barra de límite

#### Scenario: Card muestra la cantidad de compras en cuotas activas

- **WHEN** una tarjeta tiene 2 compras en cuotas con cuotas pendientes y otra tarjeta no tiene ninguna
- **THEN** la primera card muestra "2 compras en cuotas" en el footer
- **AND** la segunda muestra "Sin cuotas activas"

#### Scenario: Tarjeta archivada aparece en la sección "Archivadas" y no en el wallet

- **WHEN** el usuario tiene una tarjeta activa y una archivada
- **THEN** el wallet muestra solo la activa
- **AND** debajo se renderiza la sección colapsable "Archivadas (1)" con enlace al detalle de la archivada

#### Scenario: Usuario sin tarjetas archivadas no ve la sección

- **WHEN** el usuario tiene solo tarjetas activas (o ninguna)
- **THEN** la sección "Archivadas" NO se renderiza

#### Scenario: Sección "Archivadas" colapsada por defecto en mobile

- **WHEN** el usuario abre `/cards` en mobile y tiene al menos una tarjeta archivada
- **THEN** la sección "Archivadas (N)" se renderiza con la lista contraída
- **AND** un tap en el encabezado expande la lista
- **AND** otro tap la vuelve a contraer

#### Scenario: CTA "Agregar tarjeta" disabled placeholder en mobile

- **WHEN** el usuario abre `/cards` en mobile y la ruta `/cards/new` mobile aún no existe
- **THEN** el header muestra el botón "Agregar tarjeta" visible pero en estado disabled
- **AND** un tap sobre el botón no abre ningún drawer, ruta ni hoja de creación

---

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

### Requirement: El pago de un resumen crea el período que le sigue al último período conocido

Cuando el usuario paga el resumen de un período, el banco le entrega en ese mismo extracto las fechas del siguiente ciclo que aún no existe en el sistema. El sistema SHALL aprovechar ese momento para registrar ese período nuevo.

**Invariante central:** al pagar el período P(n), el sistema ya tiene P(n+1) (creado al dar de alta la tarjeta o al pagar P(n-1)). El formulario de pago DEBE pedir las fechas de P(n+2) — el inmediatamente siguiente al último período conocido. El período nuevo se inserta con `start_date = lastKnownPeriod.end_date + 1 día`.

**Contexto del banco:** cuando el resumen de un ciclo cierra, el banco emite ese extracto e incluye en él las fechas del ciclo siguiente (nuevo "próximo"). En ese momento el usuario ya tiene en mano las fechas exactas del ciclo que aún no estaba en el sistema, y es el momento natural de cargarlas.

**Flujo completo de períodos:**

| Evento | Períodos existentes antes | Acción | Períodos existentes después |
|---|---|---|---|
| Alta de tarjeta | — | Usuario ingresa fechas de P1 y P2 | P1, P2 |
| Pagar P1 | P1 (closed/overdue), P2 | Usuario ingresa fechas de P3 | P1 (paid), P2, P3 |
| Pagar P2 | P1 (paid), P2 (closed/overdue), P3 | Usuario ingresa fechas de P4 | P1 (paid), P2 (paid), P3, P4 |

**Implementación:**
- La acción `payCardPeriod` SHALL consultar el `end_date` máximo de todos los `card_periods` de la cuenta antes de crear el nuevo período.
- El nuevo período SHALL insertarse con `start_date = max(end_date) + 1 día` y las fechas ingresadas por el usuario como `end_date` y `due_date`.
- Si ese `start_date` ya existe (colisión con rolling automático), el sistema SHALL hacer UPSERT actualizando las fechas con `is_estimated=false`.
- La validación SHALL exigir que `next_end_date > max(end_date)` de todos los períodos conocidos, no solo del período que se está pagando.

**Pre-llenado del formulario:**
- El formulario de pago SHALL pre-llenar las fechas del próximo período usando `suggestNextPeriodDates` aplicado sobre todos los períodos existentes. Esta función proyecta el ciclo siguiente al último período conocido, lo que da la estimación correcta de P(n+2).

#### Scenario: Pagar P1 cuando P2 ya existe crea P3

- **WHEN** una tarjeta tiene P1 (`end_date='2026-05-16'`) y P2 (`end_date='2026-06-16'`) y el usuario paga P1 ingresando `next_end_date='2026-07-16'`, `next_due_date='2026-07-22'`
- **THEN** el sistema crea P3 con `start_date='2026-06-17'`, `end_date='2026-07-16'`, `due_date='2026-07-22'`
- **AND** P2 queda intacto (`end_date='2026-06-16'`, `due_date='2026-06-22'`)
- **AND** P1 queda en estado `paid`

#### Scenario: El formulario de pago se pre-llena con la proyección sobre el último período conocido

- **WHEN** el usuario abre el formulario para pagar P1 y en la tarjeta existen P1 (`end_date='2026-05-16'`) y P2 (`end_date='2026-06-16'`, `due_date='2026-06-22'`)
- **THEN** el formulario muestra como sugerencia un `next_end_date` calculado a partir de `end_date` de P2 (≈ `2026-07-17` proyectando el ciclo de 31 días)
- **AND** NO pre-llena con las fechas de P2

#### Scenario: Validación rechaza next_end_date anterior al último período existente

- **WHEN** el usuario intenta pagar P1 e ingresa `next_end_date='2026-06-10'` siendo que P2 ya tiene `end_date='2026-06-16'`
- **THEN** la acción retorna un error localizado que nombra la fecha del último cierre conocido
- **AND** no se crea ningún período nuevo ni se registra el pago
- **AND** el formulario muestra como contexto la fecha del último cierre conocido para anclar al usuario

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

**Web (`apps/web/app/(app)/cards/page.tsx`).** El header (título "Tarjetas", subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`, botón "Agregar tarjeta") SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- El **count** del subtítulo SHALL renderizarse como `"-"` (guion) mientras la query no resuelve. Cuando resuelve, SHALL pasar al número real de tarjetas activas. Si la query falla, SHALL permanecer en `"-"` indefinidamente para no bloquear la lectura del resto del header.
- El **mes** del subtítulo SHALL derivarse de `getTodayAR()` (idéntico criterio que el header del dashboard) y NO SHALL depender de ninguna query — está disponible desde el primer render.
- El botón "Agregar tarjeta" SHALL renderizarse en estado **disabled** mientras las queries de catálogos necesarias para abrir el drawer (`institutions`, `card_networks`) no resuelvan. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esas queries resuelven, SHALL pasar a habilitado. Si esas queries fallan, el botón SHALL permanecer disabled para no abrir un drawer sin data.

El cuerpo de la ruta web SHALL renderizarse como un scaffold de `<Suspense>` boundaries, cada uno con un fallback visualmente coherente (estilo `SectionFallback` ya usado en dashboard: borde dashed, mensaje de carga, min-height que aproxima el tamaño del contenido final). Cada sección SHALL fetchar su propia data en un container server async aislado:

- `CardsMonthHeroContainer` SHALL llamar `getCardsMonthSummary()`.
- `WalletContainer` SHALL llamar `getCreditCards` filtrando tarjetas activas únicamente.
- `ArchivedCardsContainer` SHALL llamar `getCreditCards` filtrando tarjetas archivadas únicamente.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`CardsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al try/catch de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header**, con un `onRetry` que resetea el state del boundary.

**Mobile (`apps/mobile/app/(app)/cards.tsx`).** El header SHALL ser un componente que envuelve el `PageHeader` custom del app mobile (nunca el header nativo del stack), con:

- Título "Tarjetas".
- Subtítulo `"{count} tarjetas de crédito · resúmenes de {mes}"`. Mientras la query del count no resuelve (o si falla), el subtítulo SHALL mostrar `-` en el slot del número. El mes se deriva de `getTodayAR()` y NO depende de ninguna query.
- Acción derecha: CTA "Agregar tarjeta" en estado **disabled placeholder** mientras la ruta `/cards/new` mobile no exista. SHALL renderizarse con su ícono y label, sin onPress activo. Cuando aterrice `/cards/new` mobile, pasará a habilitado vía actualización del propio componente.

El cuerpo mobile SHALL componerse de tres secciones independientes, cada una con su propia query react-query y su propio fallback de carga/error:

- `CardsMonthHero`: react-query con key `['cards', 'month-summary']` llamando `getCardsMonthSummary()`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando resumen del mes…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar el resumen del mes" />`.
- `Wallet`: react-query con key `['cards']` llamando `getCreditCards({ includeArchived: false })`. Mientras `isPending`, SHALL renderizar `<SectionFallback message="Cargando tarjetas…" />`. Si `isError`, SHALL renderizar `<SectionFallback message="No pudimos cargar las tarjetas" />`. Si la query resuelve con cero tarjetas activas, SHALL renderizar el estado vacío del wallet (mismo copy que web).
- `ArchivedCardsSection`: react-query con key `['cards', 'archived']` llamando `getCreditCards({ archivedOnly: true })`. Mientras `isPending`, NO SHALL ocupar espacio visible (la sección entera es opcional). Si `isError`, SHALL renderizar un `<SectionFallback>` discreto al final del scroll. Si resuelve con cero, NO SHALL renderizar nada.

Un error en una sección NO SHALL afectar el render de las otras ni del header. Mobile NO usa un error boundary global para esta ruta; el aislamiento se logra porque cada query react-query maneja su propio error sin throw al render parent.

Esta receta SHALL seguir el mismo patrón "in-page loading y error para mantener el chrome visible" descripto en el spec `route-loading-and-errors`; `/cards` es un consumidor de esa variante en web (junto con `/dashboard`) y la versión mobile lo implementa con el toolkit del app mobile.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/cards` y las queries del header (count, institutions, card_networks) todavía no resolvieron
- **THEN** el header ya está montado con el título "Tarjetas" y el subtítulo `"- tarjetas de crédito · resúmenes de {mes}"`
- **AND** el botón "Agregar tarjeta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` correspondientes a hero, wallet y archivadas

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

- **WHEN** un throw ocurre durante el render de la ruta fuera de los `try/catch` de los containers (por ejemplo, durante el render de un componente presentacional)
- **THEN** el `CardsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render

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
- **THEN** la sección "Archivadas" no renderiza un fallback ni ocupa espacio en el scroll
- **AND** el resto de las secciones se ven sin gap reservado

