## ADDED Requirements

### Requirement: Un resumen cerrado sin consumos no se paga ni vence

Un `card_periods` cuyo estado derivado es `closed` u `overdue` y que no tiene ninguna transacción imputada SHALL presentarse como **"Sin consumos"**: el resumen se cierra solo. En consecuencia:

- NO SHALL contar como "A pagar" en el hero, en el total del grupo ni en la fila, y NO SHALL presentarse como "Vencido" en ninguna superficie (listado, detalle de tarjeta, listado de resúmenes, detalle del resumen).
- El detalle del resumen NO SHALL ofrecer la acción "Pagar resumen", y la pantalla de pago de ese resumen NO SHALL permitir registrar un pago.
- El estado sigue siendo **derivado, nunca persistido**: si luego se registra una transacción con fecha dentro de ese resumen, el resumen SHALL volver a presentarse como a pagar o vencido según sus fechas, sin ningún paso adicional.

La misma regla aplica en web y en mobile.

#### Scenario: Un resumen vencido y vacío no figura a pagar

- **WHEN** una tarjeta tiene un período con `end_date='2026-06-25'`, `due_date='2026-07-08'`, sin transacciones ni pago, y `today='2026-10-06'`
- **THEN** ese período se muestra como "Sin consumos" en el listado de resúmenes de la tarjeta
- **AND** no aparece como "Vencido" ni suma en "A pagar"

#### Scenario: El detalle de un resumen vacío no ofrece pagar

- **WHEN** el usuario abre el detalle de un período `closed` sin transacciones
- **THEN** no se muestra la acción "Pagar resumen"
- **AND** entrar directamente a la pantalla de pago de ese período no permite registrar el pago

#### Scenario: Un consumo cargado después reactiva el resumen

- **WHEN** un período `overdue` estaba "Sin consumos" y el usuario registra un consumo con fecha dentro de su rango
- **THEN** el período pasa a mostrarse como vencido, con su monto, y vuelve a ofrecer "Pagar resumen"

## MODIFIED Requirements

### Requirement: El sistema mantiene siempre al menos un período abierto por delante de hoy

El sistema SHALL respetar el invariante `I-CRED-12`: para toda cuenta `accounts.type='credit'` con `is_active=true`, SHALL existir al menos un `card_periods` con estado derivado `open` (`today ≤ end_date`). El mantenimiento es **lazy**: cuando una operación necesita un período cubriendo una fecha posterior al último período conocido y no existe ningún período cuyo rango la cubra, el sistema SHALL generar al vuelo **todos los períodos que falten**, uno a continuación del otro y contiguos (`start_date = anterior.end_date + 1`), cada uno con fechas del algoritmo de sugerencia (ver requirement de algoritmo), hasta que el último generado cubra esa fecha. Generar un único período que no llega a cubrirla NO SHALL ocurrir. Todo período auto-generado SHALL marcarse con `is_estimated=true`.

**Lectura de la tarjeta.** Abrir el listado de tarjetas (`/cards`) o el detalle de una tarjeta (incluida su edición) es una operación que necesita el período que cubre **hoy**: antes de leer, el sistema SHALL completar el calendario de cada tarjeta activa hasta hoy con la misma regla. Así, una tarjeta que no se usó en meses muestra el ciclo en curso (estimado) y no el último ciclo que alguna vez se generó. Los períodos intermedios que se crean de este modo quedan vacíos y se muestran como "Sin consumos" (ver requirement de resumen sin consumos). La generación SHALL ser idempotente: repetir la lectura no crea períodos de más, y una lectura concurrente que pierde la UNIQUE `(account_id, start_date)` SHALL continuar sin error visible.

#### Scenario: Inserción de consumo con fecha fuera de período existente genera el siguiente

- **WHEN** existen sólo períodos hasta `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-20'`
- **THEN** el sistema crea un nuevo `card_periods` con fechas estimadas que cubren `2026-06-20`, marcado `is_estimated=true`
- **AND** la transacción se inserta con `card_period_id` apuntando a ese período nuevo

#### Scenario: La operación dispara generación sólo cuando hace falta

- **WHEN** existe un período con `end_date='2026-06-15'` y se intenta insertar una transacción con `date='2026-06-10'`
- **THEN** el sistema NO crea períodos nuevos
- **AND** la transacción se asigna al período existente

#### Scenario: Consumo muy posterior al último período genera todos los intermedios

- **WHEN** el último período de la tarjeta termina `2026-07-25` (ciclos de 30 días) y se registra un consumo con `date='2026-10-06'`
- **THEN** el sistema crea los períodos estimados contiguos que faltan (`2026-07-26 → 2026-08-24`, `2026-08-25 → 2026-09-23`, `2026-09-24 → 2026-10-23`)
- **AND** el consumo queda imputado al período `2026-09-24 → 2026-10-23`, que contiene su fecha

#### Scenario: Abrir una tarjeta sin uso completa el calendario hasta hoy

- **WHEN** una tarjeta activa tiene como último período uno con `end_date='2026-07-25'`, sin consumos, y el usuario abre `/cards` con `today='2026-10-06'`
- **THEN** antes de mostrar la tarjeta el sistema crea los períodos estimados contiguos hasta el que cubre `2026-10-06`
- **AND** la fila de la tarjeta muestra el cierre y el vencimiento de ese período en curso
- **AND** volver a abrir `/cards` no crea ningún período adicional

#### Scenario: Race condition al generar período concurrentemente

- **WHEN** dos requests intentan generar el mismo período "siguiente" en paralelo y uno gana la UNIQUE `(account_id, start_date)`
- **THEN** el segundo request lee el período recién creado por el primero y continúa la operación sin error visible al usuario

#### Scenario: Tarjeta archivada (inactiva) no requiere períodos open

- **WHEN** una tarjeta tiene `is_active=false`
- **THEN** el invariante no exige períodos open (la tarjeta no acepta consumos nuevos)
- **AND** abrir su detalle no genera períodos

### Requirement: La asignación de una transacción a un período se persiste como FK

El sistema SHALL persistir la asignación de cada transacción de tarjeta a su período como `transactions.card_period_id` (UUID, FK a `card_periods`). El sistema SHALL calcular la asignación al insertar la transacción y elegir el único período cuyo rango (`start_date ≤ date ≤ end_date`) contenga `transactions.date`. Si más de un período candidato existiera (caso anómalo por solapamiento), el sistema SHALL rechazar la operación.

Cuando ningún período existente cubre la fecha, el sistema SHALL distinguir dos casos:

- **Fecha posterior al período más nuevo**: el sistema genera hacia adelante los períodos que falten (rolling forward, `is_estimated=true`, contiguos desde `último.end_date + 1`) hasta que uno cubra la fecha, y asigna la transacción a ese. La transacción NUNCA SHALL quedar imputada a un período cuyo rango no contiene su `date`.
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

#### Scenario: Consumo de hoy en una tarjeta parada cae en el ciclo de hoy

- **WHEN** el último período de la tarjeta termina `2026-07-25` y el usuario registra un consumo con `date='2026-10-06'`
- **THEN** la transacción queda imputada a un período cuyo `start_date ≤ 2026-10-06 ≤ end_date`
- **AND** no queda imputada al período `2026-07-26 → 2026-08-24`

### Requirement: Las fechas de un período `open` se pueden editar; las de un período `paid` no

El sistema SHALL permitir editar `end_date` y `due_date` de un `card_periods` cuyo estado derivado sea `open`, `closed` u `overdue` (es decir, sin `period_payment`). El sistema SHALL rechazar cualquier intento de editar las fechas de un período `paid`.

**Cascada del borde con el período siguiente.** Si la cuenta tiene un período inmediatamente posterior al editado (i.e., un `card_periods` con `start_date > período.start_date` y mínimo según ese orden), el sistema SHALL mantener el borde contiguo cascadeando `next.start_date = new_end_date + 1` cuando el `end_date` se modifica en cualquier dirección:

- **Extender** (`new_end_date > old_end_date`): se actualiza `next.start_date` hacia adelante y SHALL reasignar al período editado todas las transacciones del próximo cuyo `date ≤ new_end_date`.
- **Achicar** (`new_end_date < old_end_date`): se actualiza `next.start_date` hacia atrás y SHALL reasignar al próximo período todas las transacciones del editado cuyo `date > new_end_date`.

**Bloqueos.** La cascada SHALL rechazarse en estos casos, sin modificar ninguna fila:

- Si el próximo período tiene `period_payment` (estado `paid`), el sistema rechaza con mensaje "El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes."
- Si `new_end_date >= next.end_date` (el período editado tragaría todo el próximo) y alguno de los períodos que quedarían enteramente cubiertos (`end_date ≤ new_end_date`) tiene transacciones, pago o fechas confirmadas (`is_estimated=false`), el sistema rechaza con mensaje "La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen."

**Absorción de estimados vacíos.** Si todos los períodos que el nuevo cierre cubriría enteramente son estimados (`is_estimated=true`), sin transacciones y sin pago, el sistema NO SHALL rechazar: esos períodos son solo una proyección y SHALL eliminarse. Luego la cascada del borde se aplica sobre el primer período que siga después (`start_date = new_end_date + 1`). Si no queda ninguno, el sistema SHALL crear un período estimado a continuación, para conservar siempre un próximo resumen.

**Orden de guardado en el formulario de edición de tarjeta.** Cuando el usuario cambia en el mismo guardado las fechas del resumen actual y las del próximo, y el nuevo cierre actual alcanza o supera el cierre **vigente** del próximo, el sistema SHALL guardar primero las fechas del próximo y después las del actual. En cualquier otro caso guarda primero el actual (orden existente). La regla es la misma en web y en mobile.

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

#### Scenario: Correr el cierre por encima de un próximo estimado vacío lo absorbe

- **WHEN** existe P1 con `end_date='2026-10-23'` y P2 estimado, sin transacciones ni pago, con `start_date='2026-10-24'` y `end_date='2026-11-22'`, y el usuario edita `P1.end_date='2026-11-25'`
- **THEN** la edición procede sin error
- **AND** P2 se elimina y existe un período estimado con `start_date='2026-11-26'`
- **AND** P1 queda con `end_date='2026-11-25'`

#### Scenario: El próximo con consumos sigue bloqueando

- **WHEN** P2 tiene una transacción imputada y el usuario edita `P1.end_date` a una fecha `>= P2.end_date`
- **THEN** la action retorna error "La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen."
- **AND** ninguna fila se modifica

#### Scenario: Editar actual y próximo a la vez guarda primero el próximo cuando hace falta

- **WHEN** el formulario de edición de tarjeta muestra el resumen actual con cierre `2026-06-25` y el próximo con `start_date='2026-06-26'` y cierre `2026-07-25`, y el usuario cambia el actual a cierre `2026-10-22` / vencimiento `2026-11-01` y el próximo a cierre `2026-11-30` / vencimiento `2026-12-06`
- **THEN** el guardado termina sin error
- **AND** el próximo queda con `start_date='2026-10-23'`, `end_date='2026-11-30'`, `due_date='2026-12-06'`
- **AND** el actual queda con `end_date='2026-10-22'`, `due_date='2026-11-01'`

### Requirement: El listado de tarjetas se muestra como wallet con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) como una **vista compacta agrupada por banco** (NO como wallet de cards grandes), conservando el hero unificado, con esta estructura de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resumen de <mes>"). Acción primaria "Agregar tarjeta" (primitivo `Button`). En ambas plataformas el CTA SHALL abrir el flujo de alta de tarjeta: en web navega a `/cards/new` (o abre el drawer de alta); en mobile navega a la ruta `/cards/new` nativa. El CTA NO SHALL renderizarse como placeholder permanentemente disabled. La carga de catálogos (instituciones / redes) puede gatear el submit/CTA mientras resuelve (web deshabilita el CTA; mobile defiere la carga a la ruta `/cards/new`, que muestra un loading state propio).
2. **Hero del mes (card navy, dos columnas)**: el hero SHALL renderizarse como una card oscura navy (mismo patrón de superficie que el hero del dashboard). A la **izquierda**, **dos cifras** mostradas juntas, cada una en **Bimoneda** (ARS primario y USD subordinado, **NUNCA sumados ni convertidos**):
   - **A pagar (ahora)** (`summary.toPayARS` / `toPayUSD`): la suma del total a pagar de **todas** las tarjetas activas que ya tienen un resumen **cerrado e impago** (deuda firme, vence ~este mes). Cuando la cifra es cero, el hero SHALL mostrar **`$ 0`** — NO un texto de empty-state.
   - **En curso** (`summary.inProgressARS` / `inProgressUSD`): la suma de los resúmenes **abiertos (aún no cerraron) con saldo > 0** de **todas** las tarjetas activas. Es el **acumulado real** de los consumos del ciclo abierto (no una proyección): un piso que sigue creciendo hasta el cierre. SHALL llevar el caption **"se sigue sumando hasta el cierre"**. Cuando es cero, SHALL mostrar `$ 0`.
   A la **derecha**, **"Próximos cierres"**: una lista de **una tarjeta por fila** (`fecha de cierre · nombre`, **sin monto** — el monto por tarjeta vive en el detalle de cada tarjeta del listado), ordenada por **fecha de cierre** (NO de vencimiento) ascendente y **capada en `NEXT_CLOSES_CAP` (6)** (`summary.nextCloses`). En viewports angostos las dos zonas se apilan.
3. **Controles de vista**: exponen el modo de vista (`Por banco` agrupado, default; o plano) y los predicados `Todas`, `En uso`, `Vencen pronto`, `Con saldo`. Los controles NO SHALL alterar la semántica contable, solo el agrupado, el orden y el subconjunto visible.

   **Dos ejes, un estado (vinculante, ambas plataformas).** El modo de vista y el predicado son ejes **independientes** y SHALL modelarse como dos piezas de estado separadas, no como opciones excluyentes de un mismo valor. `Por banco` decide cómo se muestra la lista; los cuatro predicados deciden qué tarjetas entran. En consecuencia: elegir un predicado NO SHALL sacar al usuario del modo agrupado como efecto colateral, y pasar por `Por banco` NO SHALL borrar el predicado elegido — la selección SHALL sobrevivir al ida y vuelta. Cuando el modo es `Por banco`, la vista agrupada muestra **todas** las tarjetas: el predicado queda vivo en el estado pero sin aplicar.

   **Fallback por conteo vacío (vinculante, ambas plataformas).** Cuando un refetch deja el predicado activo en 0 resultados, la vista SHALL caer a `Todas` en lugar de dejar al usuario en una lista vacía.

   **Conteos.** Los conteos por predicado SHALL derivarse de `countByFilter` de `@grana/cards`, construido sobre la misma `applyFilter` que arma la lista, de modo que un conteo no pueda divergir de lo que seleccionar ese filtro muestra. Ninguna superficie SHALL recontar por su cuenta.

   La **composición** de los controles se resuelve por **ancho disponible**, no por plataforma:
   - **Mobile nativo, y web bajo el breakpoint `md`**: **dos** controles separados, porque cinco opciones no entran legibles en el ancho de un teléfono. (a) un control segmentado de **dos** opciones — `Por banco` (default) y `Lista` (plano); (b) una fila de **chips de filtro** que SHALL renderizarse **solo en modo `Lista`**, con los cuatro predicados (`Todas` default, `En uso`, `Vencen pronto`, `Con saldo`), cada chip acompañado de **su conteo de resultados**. Un chip cuyo conteo es 0 SHALL renderizarse deshabilitado (no seleccionable). Los chips SHALL dimensionarse por contenido y desplazarse horizontalmente si no entran, NUNCA repartirse el ancho a la fuerza.
   - **Web en `md` y hacia arriba**: un único control segmentado de cinco opciones (`Por banco` / `Todas` / `En uso` / `Vencen pronto` / `Con saldo`) en una sola fila, donde el ancho alcanza para las cinco etiquetas. Ese control SHALL ser una **proyección del mismo estado**, no un estado propio: la opción activa es `Por banco` cuando el modo es agrupado, y el predicado vigente cuando es plano; seleccionar un predicado implica el modo plano. Una opción de predicado cuyo conteo es 0 SHALL renderizarse deshabilitada, igual que su chip equivalente.

   Como las dos composiciones proyectan el mismo estado, cruzar el breakpoint (rotar el dispositivo, redimensionar la ventana) SHALL conservar el modo y el predicado vigentes.
4. **Vista compacta de tarjetas activas**. El componente público SHALL llamarse `Wallet` en ambas plataformas (mismo nombre que el actual), con presentación compacta agrupada por banco:
   - **Grupos por banco desplegables (collapsible).** Cada grupo tiene un encabezado con: chevron de colapso, dot del color del banco, nombre del banco, "N tarjetas · M en uso", total a pagar del banco (si > 0) y un **badge de urgencia** con el próximo vencimiento del grupo (color heredado del peor estado del grupo: rojo > ámbar > neutro). Tap/click en el encabezado expande/colapsa el cuerpo. La **disposición** de ese contenido se resuelve por plataforma:
     - **Web**: una sola línea, con el nombre truncado y el resto de los elementos sin encogerse.
     - **Mobile**: **dos líneas** — línea 1 = dot + nombre del banco (una sola línea, truncado) + total a pagar alineado a la derecha; línea 2 = "N tarjetas · M en uso" + badge de urgencia alineado a la derecha. El chevron queda alineado al centro vertical de las dos líneas. El nombre del banco SHALL truncar antes que empujar el monto fuera del ancho visible.
     - **Badge en estado neutro**: en web el badge se renderiza siempre (mostrando "Al día" cuando el grupo no tiene urgencia); en **mobile** el badge SHALL renderizarse **solo cuando el grupo tiene urgencia** (peor tono ≠ neutro), porque el ancho es escaso y el estado "al día" ya se lee de la ausencia de deuda y del indicador por fila.
   - **Auto-colapso inicial.** Un grupo SHALL arrancar **colapsado solo si todas sus tarjetas están al día y en $0** (sin deuda, sin saldo en ninguna moneda, sin alert de vencimiento). Cualquier grupo con al menos una tarjeta vencida, por vencer, o con saldo > 0 SHALL arrancar **expandido**.
   - **2 filas por tarjeta.** Cada tarjeta se renderiza en dos filas: **fila 1** = monograma de red + nombre | monto del resumen vigente | indicador de estado; **fila 2** = tres etiquetas micro apiladas **Cierre**, **Vence** y **Uso** (label en mayúscula + valor debajo). El valor de Uso es el **porcentaje del resumen vigente** sobre el límite (o el texto **"Sin límite"** cuando no hay límite).
   - **Web**: filas dentro de los grupos desplegables (no una tabla rígida de una sola fila por tarjeta).
   - **Mobile**: lista densa equivalente (filas de ~2 líneas) agrupada por banco, sin tabla horizontal.
5. **Sección "Archivadas"** colapsable debajo, cerrada por defecto, solo cuando existe ≥1 tarjeta archivada, con encabezado "Archivadas (N)" y enlace al detalle de cada una. Web usa `<details>` nativo; mobile usa `Pressable` + `useState`.

**Estado por fila (vinculante).** Cada fila SHALL exponer SIEMPRE un indicador de estado derivado de `pillTone(activePeriod.alert, activePeriod.variant)` (a pagar / por vencer / al día / sin consumos). El indicador SHALL permanecer visible en cualquier orden o agrupado, de modo que una deuda no quede escondida; combinado con el badge de urgencia del encabezado y la regla de auto-colapso, un grupo con deuda nunca queda oculto sin señal. "Visible" es literal: los cuatro tonos SHALL pintarse con **tokens existentes del design system de la plataforma**. Una clase de color que el sistema de estilos no resuelve (p. ej. un color inexistente en `@grana/ui-tokens`) deja el indicador transparente y viola este requirement, aunque el elemento esté en el árbol.

**Bimoneda en el monto (vinculante).** La zona de monto del resumen SHALL respetar Bimoneda: si solo una moneda tiene saldo, ese monto; si ambas tienen saldo, ARS primario arriba y USD subordinado debajo, **nunca sumados ni convertidos**. Los montos de dinero usan los tonos editoriales (`text-income`/`text-expense`), no tokens crudos.

**"A pagar" vs "En curso" (vinculante).** Las dos cifras del hero son conceptos distintos y NO SHALL solaparse ni sumarse entre sí:
- **A pagar (ahora)** = resúmenes ya **cerrados e impagos** (`(end_date < hoy || due_date < hoy) && tx_count > 0 && !has_payment`). Es la deuda firme.
- **En curso** = el resumen **abierto** (no cerrado, sin pago) **con saldo > 0** de cada tarjeta activa. La cifra SHALL considerar el resumen abierto de **cada** tarjeta — incluidas las tarjetas que **además** tienen un resumen "a pagar", que tienen **dos resúmenes vivos** a la vez (el cerrado a pagar y el siguiente devengándose). Por lo tanto NO se deriva únicamente del `activePeriod` por tarjeta.

**Uso del resumen (vinculante).** El stat **Uso** de la fila 2 SHALL mostrar el porcentaje de uso del **resumen vigente**, calculado `min(100, round(pendingARS_del_resumen_vigente / credit_limit * 100))`, del resumen vigente, NO el cupo disponible. Cuando `credit_limit` es null, el stat Uso SHALL mostrar el texto **"Sin límite"**. Se renderiza como un stat apilado compacto junto a Cierre/Vence (no una barra ni pegado al monto de la derecha). Mismo tratamiento en web y mobile (paridad).

**Agrupación por banco (vinculante).** El agrupado usa el nombre de la institución (`institution.name`). Las tarjetas con `institution_id` null SHALL agruparse en un grupo fallback **"Sin banco"**, siempre último, nunca mezclado con otro banco.

**Tono "Sin consumos" (vinculante).** Cuando la tarjeta no tiene un resumen a pagar y su resumen vigente no tiene ninguna transacción imputada (`tx_count = 0`), el indicador SHALL mostrar **"Sin consumos"** en tono neutro (gris), con prioridad sobre "por vencer" y "al día": un resumen vacío no tiene nada que vencer. El tono "Sin consumos" NO SHALL contar para el predicado `Vencen pronto` ni para el badge de urgencia del grupo. El badge del encabezado de un grupo cuyas tarjetas están todas "Sin consumos" SHALL decir "Sin consumos" en web (y, como cualquier estado sin urgencia, no se renderiza en mobile).

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

#### Scenario: El encabezado de grupo se muestra en dos líneas (mobile)

- **WHEN** el usuario abre `/cards` en la app nativa y un grupo de banco tiene nombre largo ("Banco Patagonia"), 3 tarjetas, 2 en uso, `$284.500` a pagar y vencimiento el 25/06
- **THEN** la línea 1 del encabezado muestra el dot del banco, el nombre en una sola línea y el total a pagar alineado a la derecha
- **AND** la línea 2 muestra "3 tarjetas · 2 en uso" y el badge "vence 25/06" alineado a la derecha
- **AND** el nombre del banco se trunca si no entra, sin desplazar el total a pagar fuera del ancho visible ni cortar el badge

#### Scenario: El badge de urgencia no se renderiza en un grupo al día (mobile)

- **WHEN** un grupo de banco tiene todas sus tarjetas al día (peor tono neutro)
- **THEN** el encabezado del grupo en la app nativa NO renderiza badge de urgencia
- **AND** el mismo grupo en web SÍ renderiza el badge con el texto "Al día"

#### Scenario: El modo de vista y el filtro son controles separados

- **WHEN** el usuario abre `/cards` en la app nativa, o en web en un viewport de 390px
- **THEN** ve un control segmentado de dos opciones, `Por banco` (seleccionada por default) y `Lista`
- **AND** los chips de filtro NO se muestran mientras el modo es `Por banco`
- **WHEN** el usuario selecciona `Lista`
- **THEN** aparece la fila de chips `Todas` (seleccionado), `En uso`, `Vencen pronto` y `Con saldo`, cada uno con su conteo de resultados
- **AND** la lista se muestra plana, ordenada por próximo vencimiento ascendente
- **AND** ninguna etiqueta de chip se corta ni se aplasta: los chips se dimensionan por su contenido y la fila desplaza horizontalmente si no entran

#### Scenario: Un filtro sin resultados no es seleccionable

- **WHEN** el usuario está en modo `Lista` y ninguna tarjeta cumple el predicado `Con saldo`
- **THEN** el chip `Con saldo` muestra conteo 0 y se renderiza deshabilitado
- **AND** tocarlo no cambia el filtro aplicado
- **AND** en web `md+`, donde el mismo predicado se ofrece como segmento del control de cinco opciones, ese segmento también se renderiza deshabilitado

#### Scenario: La elección de filtro sobrevive al ida y vuelta al agrupado

- **WHEN** el usuario selecciona el filtro `En uso`, vuelve a `Por banco` y luego vuelve a `Lista`
- **THEN** el filtro aplicado sigue siendo `En uso`
- **AND** mientras estuvo en `Por banco` la vista mostró todos los grupos con todas sus tarjetas

#### Scenario: Un refetch que vacía el filtro activo cae a `Todas`

- **WHEN** el usuario tiene el predicado `Con saldo` seleccionado y un refetch deja ese predicado en 0 resultados
- **THEN** la vista pasa a `Todas` y muestra la lista completa
- **AND** el usuario no queda en una lista vacía

#### Scenario: En `md` y hacia arriba web conserva el segmentado de cinco opciones (web)

- **WHEN** el usuario abre `/cards` en web en un viewport ≥ 768px
- **THEN** ve un único control segmentado con `Por banco` (seleccionada por default), `Todas`, `En uso`, `Vencen pronto` y `Con saldo` en una sola fila
- **AND** NO se renderiza una fila de chips separada
- **WHEN** el usuario selecciona `Vencen pronto` y luego achica la ventana por debajo de `md`
- **THEN** el control de dos opciones aparece con `Lista` seleccionada y el chip `Vencen pronto` activo
- **AND** el subconjunto de tarjetas mostrado no cambió al cruzar el breakpoint

#### Scenario: El indicador del tono "por vencer" se pinta con un token existente (mobile)

- **WHEN** una tarjeta tiene su resumen próximo a vencer (tono ámbar) en la app nativa
- **THEN** el dot de estado de su fila y el badge de urgencia de su grupo se pintan con el token `warning` del design system
- **AND** ninguna de las dos superficies usa una clase de color que `@grana/ui-tokens` no define

#### Scenario: Una tarjeta sin uso muestra "Sin consumos" y el ciclo en curso

- **WHEN** una tarjeta activa no tiene consumos desde su alta (último cierre cargado `2026-06-25`) y el usuario abre `/cards` con `today='2026-10-06'`
- **THEN** la fila muestra `$ 0` y el indicador "Sin consumos" en tono neutro
- **AND** las etiquetas Cierre y Vence muestran las fechas estimadas del ciclo que contiene `2026-10-06`
- **AND** la tarjeta no suma en "A pagar" ni aparece en el predicado `Vencen pronto`
- **AND** el badge de su grupo no muestra un vencimiento pasado en rojo
