# cards Specification

## Purpose

Cubre las tarjetas de crédito como módulo de primera clase del producto. Modela cada resumen como un período con cuatro fechas (apertura, cierre, vencimiento, próximo cierre) cuyo estado se deriva sin persistir, soporta el alta de tarjeta en modos novato y experto, el registro de consumos en una o varias cuotas (ARS only por invariante `I-CRED-9`), el pago del resumen como `expense` en una cuenta cash o bank (única transacción que reduce `disponible` por la regla off-ledger), la reversión del pago, y las vistas de carrusel y detalle.

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

### Requirement: El listado de tarjetas se muestra como carrusel horizontal con resumen actual

El sistema SHALL renderizar el listado de tarjetas de crédito del usuario como un carrusel horizontal. Cada card SHALL mostrar: nombre, banco, red, monto del resumen del período actual, porcentaje de límite disponible (si hay `credit_limit`), fecha de cierre y de vencimiento, y alertas visuales según los días al vencimiento (rojo ≤3, ámbar ≤7, normal >7). El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado SHALL ir al final ordenadas alfabéticamente.

#### Scenario: Listado con tres tarjetas

- **WHEN** el usuario abre el listado y tiene tres tarjetas con cierres `2026-05-20`, `2026-05-25`, `2026-06-05`
- **THEN** el carrusel muestra las tres en orden ascendente por fecha de cierre

#### Scenario: Tarjeta con vencimiento en 2 días muestra alerta roja

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-13'`, sin `period_payment`
- **THEN** la card del carrusel se renderiza con footer rojo y "Vence DD-mm" en peso bold

#### Scenario: Tarjeta sin ciclo configurado va al final

- **WHEN** el usuario tiene tres tarjetas, una de ellas sin períodos creados
- **THEN** el carrusel muestra primero las dos con ciclo (ordenadas por cierre) y al final la sin ciclo

---

### Requirement: El detalle de tarjeta muestra el resumen actual, próximo, y acciones primarias

El sistema SHALL renderizar la pantalla de detalle de una tarjeta con: hero del período activo (monto, fechas, eyebrow contextual), CTA "Pagar resumen" (activo si el período activo es `closed` u `overdue`), fila de acciones (Registrar consumo + Cuotas), sección "Períodos" con el período actual y el próximo, link a "Ver historial completo", bloque de detalles (límite con barra de % disponible, fecha de alta, fecha de archivado si aplica), y lista de movimientos recientes.

#### Scenario: Detalle con período `closed` muestra CTA "Pagar resumen" activo

- **WHEN** el usuario abre el detalle de una tarjeta cuyo período activo está en estado `closed` (sin pago) y dentro del plazo de `due_date`
- **THEN** el CTA "Pagar resumen" aparece habilitado en color emerald

#### Scenario: Detalle con período `overdue` muestra CTA rojo y banner ámbar

- **WHEN** el período activo está `overdue` (today > due_date sin pago)
- **THEN** el hero muestra un banner ámbar "Pago vencido hace N días"
- **AND** el CTA cambia a "Pagar ahora" en color error

#### Scenario: Tarjeta nueva sin consumos jamás muestra CTA pedagógico

- **WHEN** el período activo está `open`, con cero transacciones imputadas (tarjeta recién creada)
- **THEN** en lugar del CTA "Pagar resumen" se muestra una card blanca con texto "Tarjeta lista para usar..."

---

### Requirement: El sistema muestra una pantalla con el historial completo de resúmenes

El sistema SHALL renderizar una pantalla `/cards/[id]/periods` que liste todos los `card_periods` de una tarjeta ordenados por `start_date` descendente. Cada item SHALL mostrar el rango de fechas, el monto total de transacciones imputadas, la cantidad de movimientos, y un badge con la variante derivada (futuro / actual / cerrado-esperando-pago / vencido / pagado). El tap en un item SHALL navegar al detalle del período.

#### Scenario: Historial muestra cinco períodos en distintos estados

- **WHEN** el usuario abre el historial de una tarjeta con un período `paid`, dos `closed`, uno `open` y uno `futuro`
- **THEN** la lista los muestra todos con su badge correspondiente, ordenados por `start_date` desc

#### Scenario: Item del historial muestra info contextual del pago

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

- **Listado de tarjetas**: card con footer rojo y texto "Vencido hace N días" en peso bold.
- **Detalle de tarjeta**: banner ámbar "Pago vencido hace N días" dentro del hero, CTA cambia a "Pagar ahora" en color error.
- **Historial de resúmenes**: badge "Vencido" en color error.

La cantidad de días vencido SHALL calcularse como `today − due_date`.

#### Scenario: Tarjeta vencida hace 3 días en el listado

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-18'`, sin pago
- **THEN** la card del listado muestra footer rojo con "Vencido hace 3 días"

#### Scenario: Detalle de tarjeta vencida muestra banner ámbar

- **WHEN** el usuario abre el detalle de una tarjeta cuyo período activo está `overdue` hace 5 días
- **THEN** el hero muestra un banner ámbar "Pago vencido hace 5 días"
- **AND** el CTA es "Pagar ahora" rojo

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

El sistema SHALL permitir editar los siguientes campos de una tarjeta: nombre, institución, monedas activas (agregar/desactivar según reglas de `accounts`), y `credit_limit`. Los campos `type`, `network_id` y `other_network_name` SHALL ser inmutables post-creación. Para cambiar la red, el usuario debe eliminar y recrear (solo posible si no tiene transacciones).

#### Scenario: Cambiar nombre de tarjeta

- **WHEN** el usuario cambia el nombre "Mi tarjeta" a "Visa Galicia"
- **THEN** `accounts.name` se actualiza y el resto de la tarjeta queda intacto

#### Scenario: Cambiar límite de crédito

- **WHEN** el usuario actualiza `credit_limit` de `$1.000.000` a `$1.500.000`
- **THEN** el campo se actualiza y los cálculos de "% disponible" se recalculan en la próxima lectura

#### Scenario: Intento de cambiar red post-creación es rechazado

- **WHEN** un usuario intenta cambiar `network_id` de una tarjeta vía form de edición o API
- **THEN** el schema rechaza el input (campo no editable) y la tarjeta queda intacta

---

### Requirement: El sistema garantiza que el nombre de tarjeta autogenerado se compone de red y banco

Cuando el usuario crea una tarjeta sin especificar `name` (campo opcional), el sistema SHALL generar uno usando el formato `"<network.name> <institution.name>"` si ambos están definidos; si solo hay institución, usa `"Tarjeta <institution.name>"`; si solo hay red, usa `"<network.name>"`; si ninguno, usa `"Mi tarjeta"`.

#### Scenario: Alta sin nombre con red y banco completos

- **WHEN** un usuario crea una tarjeta sin completar el campo nombre, con red "Visa" y banco "Galicia"
- **THEN** `accounts.name` se popula con `"Visa Galicia"`

#### Scenario: Alta sin nombre y sin banco (tarjeta default novato)

- **WHEN** un usuario novato completa el onboarding y se crea su tarjeta default sin nombre ni banco
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
| Alta de tarjeta (experto) | — | Usuario ingresa fechas de P1 y P2 | P1, P2 |
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
- **THEN** la acción retorna error "La fecha de cierre debe ser posterior al último resumen conocido"
- **AND** no se crea ningún período nuevo ni se registra el pago

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

