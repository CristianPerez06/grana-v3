## RENAMED Requirements

- FROM: `### Requirement: El listado de tarjetas se muestra como carrusel horizontal con resumen actual`
- TO: `### Requirement: El listado de tarjetas se muestra como wallet en grilla con hero de pago mensual`

## MODIFIED Requirements

### Requirement: El listado de tarjetas se muestra como wallet en grilla con hero de pago mensual

El sistema SHALL renderizar el listado de tarjetas de crédito (`/cards`) con esta estructura, de arriba hacia abajo:

1. **Header**: título "Tarjetas" + subtítulo ("N tarjetas de crédito · resúmenes de <mes>"). Acciones a la derecha: "Resúmenes anteriores" (ghost) y "Agregar tarjeta" (primario, → `/cards/new`).
2. **Hero "A pagar este mes"**: agrega el total a pagar de **todas** las tarjetas activas (períodos sin pago `closed`/`overdue`). El monto ARS se muestra como primario en tipografía grande; el total USD se muestra **subordinado y por separado**, NUNCA sumado ni convertido (principio Bimoneda). El hero destaca el próximo vencimiento más cercano. A la derecha, una lista "Próximos vencimientos" con filas (día/mes + tarjeta + "cierra/vence" + monto).
3. **Sección "Mis tarjetas"** + hint "Tocá una para ver el resumen".
4. **Wallet en grilla** (2 columnas en desktop, 1 columna bajo `md`): una card por tarjeta activa.

Cada **card del wallet** SHALL mostrar: una franja lateral con el acento de la tarjeta (`--cc-accent` derivado de `resolveAccountAvatar`, no hardcodeado por marca), avatar con la inicial del banco, nombre, meta "Crédito · <red>" (**sin número de tarjeta** — la app no lo almacena), un pill de estado (a pagar / cierra pronto / al día), stats (resumen del mes · cierra · vence), barra de límite teñida con el acento **solo si `credit_limit` está cargado**, y un footer con la cantidad de compras en cuotas activas ("N compras en cuotas" o "Sin cuotas activas") + link "Ver resumen". El click en una card SHALL navegar a `/cards/[id]`.

El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado van al final, alfabéticas.

El wallet SHALL incluir únicamente tarjetas activas (`is_active=true`). Las archivadas (`is_active=false`) NO aparecen en el wallet, pero el sistema SHALL exponerlas en una sección secundaria **"Archivadas"** debajo, colapsable (cerrada por defecto), con encabezado `Archivadas (N)`, solo cuando existe al menos una, listando cada una con enlace a su detalle (`/cards/[id]`) para que `[Reactivar]` sea alcanzable.

#### Scenario: Hero agrega el total a pagar con ARS y USD separados

- **WHEN** el usuario tiene dos tarjetas con resúmenes a pagar: una con `$120.000` ARS y otra con `$80.000` ARS + `US$ 200`
- **THEN** el hero "A pagar este mes" muestra `$200.000` como monto ARS primario
- **AND** muestra `US$ 200` como total USD subordinado y por separado
- **AND** en ningún caso suma ni convierte ARS y USD en un solo número

#### Scenario: Hero destaca el próximo vencimiento y lista los siguientes

- **WHEN** el usuario tiene tarjetas con vencimientos `10/06`, `18/06` y `25/06`
- **THEN** el hero destaca el vencimiento del `10/06`
- **AND** la lista "Próximos vencimientos" muestra las tres filas con día/mes, tarjeta y monto

#### Scenario: Wallet en grilla con dos tarjetas activas

- **WHEN** el usuario abre `/cards` con dos tarjetas activas
- **THEN** se renderiza una grilla de cards (no un carrusel horizontal), ordenadas por fecha de cierre ascendente
- **AND** cada card muestra franja de acento, avatar, nombre, meta sin número de tarjeta, pill de estado, stats, y footer de cuotas

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

## ADDED Requirements

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
