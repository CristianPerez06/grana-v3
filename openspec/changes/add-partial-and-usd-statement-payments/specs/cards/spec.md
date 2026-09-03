## ADDED Requirements

### Requirement: El pago de un resumen se registra como patas, y cada pata declara qué deuda cancela

El sistema SHALL registrar cada pago de resumen como una **pata de pago**: una fila de
`period_payments` que vincula la transacción real con la deuda que cancela. `period_id` NO SHALL ser
único: un resumen SHALL poder acumular varias patas.

Cada pata SHALL persistir:

- `transaction_id` — el gasto real, **en la moneda de la que sale el dinero**;
- `settles_currency` — la moneda de la **deuda del resumen** que la pata cancela (`ARS` o `USD`);
- `settles_amount` — cuánto de esa deuda cancela, expresado en `settles_currency`, mayor a cero;
- `fx_rate_to_ars` — la cotización usada, obligatoria **solo** cuando el dinero sale en una moneda
  distinta de la que cancela, y nula en caso contrario.

El sistema NO SHALL deducir qué deuda cancela una pata a partir del monto de su transacción: la
imputación SHALL ser un dato declarado, nunca inferido.

Ninguna pata SHALL cancelar más que el saldo pendiente de su moneda en ese resumen. El write path
SHALL rechazar el exceso con un mensaje que indique cuánto resta, y las lecturas NO SHALL recortar
(`clamp`) ningún saldo para compensarlo.

#### Scenario: Una pata en pesos que cancela deuda en pesos

- **WHEN** el usuario paga $265.805,42 de un resumen desde una cuenta en pesos
- **THEN** se registra una pata con `settles_currency='ARS'`, `settles_amount=265805.42` y `fx_rate_to_ars` nula
- **AND** la transacción vinculada es un gasto en ARS por $265.805,42

#### Scenario: Una pata en pesos que cancela deuda en dólares

- **WHEN** el usuario paga los US$ 1.932,40 del resumen desde una cuenta en pesos, con cotización `1230,50`
- **THEN** se registra una pata con `settles_currency='USD'`, `settles_amount=1932.40` y `fx_rate_to_ars=1230.50`
- **AND** la transacción vinculada es un gasto en ARS por el producto de ambos

#### Scenario: Una pata que excede el saldo pendiente se rechaza

- **WHEN** al resumen le restan $40.000 en pesos y el usuario intenta registrar una pata de $60.000 en pesos
- **THEN** la acción retorna un error localizado que nombra los $40.000 que restan
- **AND** no se registra ninguna pata ni ninguna transacción

---

### Requirement: La porción en dólares de un resumen se puede pagar en dólares

El sistema SHALL permitir cancelar la deuda en dólares de un resumen **con dólares**, desde una
cuenta de efectivo o bancaria con la moneda `USD` activa, además de la opción existente de pesificarla.

Cuando la porción USD se paga en dólares, la pata SHALL registrar una transacción de tipo gasto con
`currency_code='USD'` en la cuenta elegida, sin `fx_rate_to_ars`, y el saldo en dólares de esa cuenta
SHALL disminuir en ese monto. El sistema NO SHALL exigir cotización en ese caso.

El formulario de pago SHALL ofrecer un selector de cuenta en dólares independiente del de pesos,
mostrando el saldo disponible en USD, y SHALL advertir de forma no bloqueante cuando la operación
dejaría ese saldo en negativo, con la misma semántica que ya aplica a la cuenta en pesos.

El impuesto de sellos SHALL registrarse siempre en ARS y SHALL salir de la pata en pesos: es un
impuesto local y no se paga en dólares.

#### Scenario: Resumen mixto pagado con dos patas

- **WHEN** un resumen debe $265.805,42 y US$ 1.932,40, y el usuario paga los pesos desde su cuenta en pesos y los dólares desde su caja de ahorro en dólares
- **THEN** se registran dos patas: una `ARS` por $265.805,42 y otra `USD` por US$ 1.932,40
- **AND** el saldo en pesos de la primera cuenta baja $265.805,42 y el saldo en dólares de la segunda baja US$ 1.932,40
- **AND** en ningún momento se muestra un total que sume o convierta las dos monedas

#### Scenario: Pagar dólares con dólares no pide cotización

- **WHEN** el usuario elige pagar en dólares la porción USD del resumen
- **THEN** el formulario oculta el campo de cotización y no lo exige para confirmar
- **AND** la transacción en USD se registra sin `fx_rate_to_ars`

#### Scenario: Resumen íntegramente en dólares pagado en dólares

- **WHEN** un resumen no tiene deuda en pesos, debe US$ 300 y no se cargó impuesto de sellos, y el usuario lo paga desde su cuenta en dólares
- **THEN** se registra una única pata `USD` y ninguna transacción en pesos
- **AND** el resumen queda saldado

---

### Requirement: Un resumen se puede pagar parcialmente y el remanente queda en el propio resumen

El sistema SHALL permitir registrar un pago por menos que el total del resumen —el pago mínimo, o
cualquier monto— y SHALL dejar el resumen en estado **parcial** hasta que las patas lo cubran.

El saldo pendiente SHALL derivarse por moneda como
`Σ consumos − Σ reintegros recibidos − Σ patas que cancelan esa moneda`. El remanente impago SHALL
permanecer en el resumen que lo generó: el sistema NO SHALL crear ninguna transacción de
"saldo anterior" ni trasladar deuda al resumen siguiente.

Un resumen parcial SHALL seguir figurando entre lo que hay que pagar, por su remanente, y SHALL
poder recibir patas adicionales hasta saldarse. Un resumen parcial NO SHALL aceptar consumos nuevos:
igual que un resumen saldado, ya cerró, y un consumo con fecha de ese rango pertenece al período en
curso.

El sistema NO SHALL calcular, sugerir ni registrar automáticamente intereses de financiación, IVA
sobre intereses ni punitorios. Esos cargos llegan en el resumen siguiente y se registran como
consumos.

#### Scenario: Pago del mínimo deja el resumen parcial

- **WHEN** un resumen debe $265.805,42 y el usuario registra un pago de $40.000
- **THEN** el resumen queda parcial, con $225.805,42 pendientes
- **AND** el saldo de la cuenta de pago baja $40.000
- **AND** no se crea ninguna transacción de saldo anterior en ningún otro resumen

#### Scenario: El resumen parcial se termina de pagar

- **WHEN** el usuario registra una segunda pata por los $225.805,42 restantes
- **THEN** el resumen queda saldado y sus consumos pasan a `paid`
- **AND** el resumen conserva sus dos patas de pago

#### Scenario: Un parcial vencido sigue vencido por el resto

- **WHEN** un resumen con $225.805,42 pendientes pasa su fecha de vencimiento
- **THEN** el resumen se muestra vencido, con la mora que corresponde
- **AND** el monto en mora es el remanente, no el total original del resumen

#### Scenario: Un resumen parcial no recibe consumos nuevos

- **WHEN** se registra un consumo con fecha dentro del rango de un resumen parcial
- **THEN** el consumo se imputa al período en curso, no al resumen parcial

---

### Requirement: Los consumos de un resumen pasan a pagados recién cuando las patas lo cubren

El sistema SHALL barrer los consumos del resumen de `pending` a `paid` únicamente cuando una pata
deja el saldo pendiente en cero en **ambas** monedas. Mientras el resumen esté parcial, todos sus
consumos SHALL permanecer en `pending`.

El sistema NO SHALL marcar consumos individuales como pagados en función de un pago parcial: el pago
se imputa contra el total del resumen, no contra líneas, y no existe información que permita decir
cuáles se pagaron.

Que los consumos sigan en `pending` NO SHALL inflar la deuda mostrada: el pendiente ya descuenta las
patas registradas.

#### Scenario: Un pago parcial no cambia el estado de ningún consumo

- **WHEN** el usuario paga $40.000 de un resumen de $265.805,42 con cuatro consumos
- **THEN** los cuatro consumos siguen en `pending`
- **AND** la deuda mostrada del resumen es $225.805,42, no $265.805,42

#### Scenario: La pata que salda el resumen barre todos los consumos

- **WHEN** una pata deja el pendiente en cero en pesos y en dólares
- **THEN** todos los consumos del resumen en `pending` pasan a `paid` en la misma operación

---

### Requirement: El resumen recuerda su pago mínimo y el formulario lo ofrece como atajo

El sistema SHALL permitir registrar el **pago mínimo** que informa el resumen, por moneda
(`card_periods.minimum_payment_ars` y `minimum_payment_usd`), como dato opcional del período. Un
valor nulo SHALL significar "no se cargó", que NO SHALL confundirse con cero.

El formulario de pago SHALL ofrecer el pago mínimo como atajo junto al total, precargando los montos
de las patas, y SHALL permitir editarlos. Cuando el monto a pagar quede por debajo del mínimo
informado, el sistema SHALL advertirlo de forma **no bloqueante**: informa, no impide.

#### Scenario: El mínimo cargado aparece como atajo

- **WHEN** el resumen tiene `minimum_payment_ars = 40000` y el usuario abre el formulario de pago
- **THEN** el formulario ofrece un atajo "Pago mínimo" junto al de "Total"
- **AND** elegirlo precarga $40.000 como monto de la pata en pesos, editable

#### Scenario: Pagar menos que el mínimo advierte sin bloquear

- **WHEN** el resumen informa un mínimo de $40.000 y el usuario carga $30.000
- **THEN** el sistema muestra una advertencia que nombra el mínimo informado
- **AND** el usuario puede confirmar el pago igualmente

#### Scenario: Sin mínimo cargado no se muestra el atajo

- **WHEN** el resumen no tiene pago mínimo cargado
- **THEN** el formulario ofrece solo el atajo "Total" y no menciona ningún mínimo

---

### Requirement: La app nativa permite pagar en dólares y parcialmente, con paridad de reglas

La app nativa SHALL exponer las mismas capacidades de pago que la web: elegir en qué moneda se
cancela la porción en dólares del resumen, registrar pagos parciales, y usar el atajo de pago
mínimo. Ambas SHALL delegar en las mismas mutaciones de `@grana/cards` y en los mismos schemas de
`@grana/validation`: las shells NO SHALL reimplementar ninguna regla de imputación, de cobertura ni
de cotización.

La paridad SHALL mantenerse en estructura y jerarquía —bloque de pesos, bloque de dólares, sello y
fechas del ciclo solo en el primer pago— aunque los componentes visuales sean nativos.

#### Scenario: Pago mixto desde la app nativa

- **WHEN** el usuario paga desde la app nativa un resumen con deuda en pesos y en dólares, eligiendo dólares para la porción USD
- **THEN** se registran las dos patas con la misma semántica que en web
- **AND** ninguna validación de cobertura ni de cotización se resuelve en la shell nativa

---

## MODIFIED Requirements

### Requirement: El estado del período se deriva sin persistir

El sistema SHALL derivar el estado de cada `card_periods` siguiendo este árbol en orden de prioridad:

1. Si las patas de pago del período **saldan** su deuda en ambas monedas → `paid`.
2. Si `today ≤ end_date` → `open`.
3. Si `end_date < today ≤ due_date` → `closed`.
4. Si `due_date < today` → `overdue`.

Un período con patas de pago que **no** saldan su deuda es **parcial**: su estado de calendario SHALL
derivarse por fecha como cualquier impago (`open`, `closed` u `overdue`), y el sistema SHALL
señalizar por separado que tiene pagos registrados y cuánto resta. La sola existencia de una fila en
`period_payments` NO SHALL bastar para derivar `paid`.

El sistema SHALL NOT mantener una columna `status` ni un trigger que la actualice. Toda lectura del
estado SHALL llamar al helper centralizado `derivePeriodStatus(period, today, settlement)`, donde
`settlement` es `unpaid`, `partial` o `settled`, derivado desde una única definición compartida.

#### Scenario: Período con `today` dentro del rango open

- **WHEN** un `card_periods` tiene `end_date='2026-06-15'` y `today='2026-06-10'`, sin patas de pago
- **THEN** el estado derivado es `open`

#### Scenario: Período cerrado esperando pago

- **WHEN** un `card_periods` tiene `end_date='2026-06-15'`, `due_date='2026-06-30'`, `today='2026-06-20'`, sin patas de pago
- **THEN** el estado derivado es `closed`

#### Scenario: Período vencido sin pago

- **WHEN** un `card_periods` tiene `due_date='2026-06-30'`, `today='2026-07-05'`, sin patas de pago
- **THEN** el estado derivado es `overdue`

#### Scenario: Período con la deuda saldada por sus patas

- **WHEN** las patas de pago de un período cubren su deuda en pesos y en dólares, sin importar las fechas
- **THEN** el estado derivado del período es `paid`

#### Scenario: Período con pago parcial y vencimiento pasado

- **WHEN** un período tiene una pata que cubre parte de su deuda y `due_date < today`
- **THEN** el estado derivado es `overdue`, no `paid`
- **AND** el sistema señaliza que tiene pagos registrados y cuánto resta

---

### Requirement: El detalle de período muestra movimientos del período e info del pago

El sistema SHALL renderizar una pantalla `/cards/[id]/periods/[periodId]` con: rango de fechas del período, monto total, lista de movimientos imputados ordenados por `date ASC, created_at ASC, id ASC`, información de los pagos registrados, y link "Editar fechas" si las fechas son editables según las reglas del requirement de edición.

El **monto total** del resumen SHALL netear los reintegros "en resumen" recibidos (`reimbursement_target='statement'`, `received_at` seteado, `cancelled_at` nulo): `total = Σ consumos − Σ reintegros recibidos`, por moneda. Como los consumos de un período son homogéneos en estado (`pending` mientras el resumen no está saldado, `paid` una vez saldado), el reintegro descuenta el total que efectivamente se muestra: el **pagado** cuando el período está saldado, el **pendiente** en caso contrario.  Un reintegro pendiente o cancelado NO descuenta el total (vive en el bloque "Reintegros a confirmar", no en el resumen).

La información de pago SHALL listar **todas** las patas del período (fecha, cuenta, monto en la moneda de la que salió el dinero y, cuando hubo conversión, la cotización usada), no solo la primera. Cuando el resumen está parcial, la pantalla SHALL mostrar además **cuánto resta por moneda** y SHALL ofrecer registrar otro pago.

#### Scenario: Detalle de período saldado muestra info del pago

- **WHEN** el usuario abre un período saldado que se pagó el `2026-05-15` desde la cuenta "Banco Galicia"
- **THEN** la pantalla muestra "Pagado el 15-may desde Banco Galicia"

#### Scenario: El total de un resumen saldado descuenta el reintegro recibido

- **WHEN** el usuario abre un período saldado cuyos consumos suman `$128.841,06` y tiene un reintegro "en resumen" recibido de `$3.155,55`
- **THEN** el monto total del resumen muestra `$125.685,51` (consumos menos reintegro), no `$128.841,06`

#### Scenario: Detalle de período parcial muestra las patas y el remanente

- **WHEN** el usuario abre un período con un pago de $40.000 sobre una deuda de $265.805,42
- **THEN** la pantalla lista ese pago con su fecha y su cuenta
- **AND** muestra que restan $225.805,42 y ofrece registrar otro pago

#### Scenario: Detalle de período open muestra link "Editar fechas"

- **WHEN** el usuario abre un período `open` con cero transacciones imputadas
- **THEN** la pantalla muestra el link "Editar fechas" activo

#### Scenario: Detalle de período saldado no muestra link "Editar fechas"

- **WHEN** el usuario abre un período saldado
- **THEN** la pantalla NO muestra el link "Editar fechas"

---

### Requirement: La cotización de la deuda USD se captura al pagar el resumen, no al registrar el consumo

El registro de un consumo en USD en una tarjeta NO SHALL exigir cotización: la deuda del período se computa por moneda (`pendingAmountARS` / `pendingAmountUSD`) y la conversión real ocurre recién al pagar el resumen, con la cotización del día de pago. El campo `fx_rate_to_ars` del consumo queda como dato opcional/histórico, sin uso contable en el alta.

Al pagar la deuda en dólares de un resumen, la cotización SHALL exigirse **solo cuando esa deuda se
pesifica**, es decir cuando la pata cancela deuda en USD con una transacción en ARS. En ese caso el
sistema SHALL pedir la cotización del día de pago (decimal de hasta 6 posiciones, sin agrupado de
miles), SHALL computar el monto sugerido de la transacción como `USD a cancelar × cotización`,
mostrando el desglose, y SHALL persistirla en la pata y en la transacción para trazabilidad. Cuando
la deuda en dólares se paga **con dólares**, el sistema NO SHALL pedir ni registrar cotización.

Sin deuda USD pendiente, el flujo de pago no pide cotización y no cambia.

A nivel base de datos, el invariante I-CRED-11 SHALL reflejar este modelo: el consumo USD en tarjeta acepta `fx_rate_to_ars` nulo (cuando está presente debe ser > 0), el consumo ARS lo rechaza, los gastos no-credit lo aceptan cuando es > 0 (pago de resumen pesificado), y todo tipo no-expense lo rechaza.

Los períodos SHALL exponer lo pagado y lo pendiente **por moneda**, y el detalle de una transacción de pago SHALL mostrar qué deuda del resumen canceló esa pata y con qué cotización, cuando hubo.

#### Scenario: Alta de consumo USD sin cotización

- **WHEN** el usuario registra un gasto en USD con una tarjeta de crédito
- **THEN** el formulario no pide cotización y el consumo se guarda con `fx_rate_to_ars` nulo
- **AND** el consumo suma a la deuda USD del período, separada de la ARS

#### Scenario: Pesificar la deuda USD pide la cotización del día

- **WHEN** el usuario elige pagar en pesos la porción USD de un resumen con `pendingAmountUSD > 0`
- **THEN** el formulario muestra un campo de cotización (ARS por 1 USD) obligatorio
- **AND** al cargarla muestra el desglose: USD a cancelar × cotización = monto de la transacción

#### Scenario: El backend rechaza pesificar deuda USD sin cotización

- **WHEN** llega una pata con `settles_currency='USD'` y transacción en ARS, sin cotización (> 0)
- **THEN** la acción retorna un error localizado y no registra nada

#### Scenario: Pagar la deuda USD con dólares no registra cotización

- **WHEN** el usuario cancela US$ 1.932,40 del resumen desde una cuenta en dólares
- **THEN** ni la pata ni la transacción persisten `fx_rate_to_ars`
- **AND** el sistema no pide la cotización en ningún momento del flujo

#### Scenario: La cotización queda registrada en la pata pesificada

- **WHEN** se confirma una pata que pesifica US$ 1.932,40 con cotización `1.230,50`
- **THEN** la pata persiste `fx_rate_to_ars = 1230.50` y la transacción de pago (gasto ARS) también

#### Scenario: Confirmar recurrencia USD en tarjeta no pide cotización

- **WHEN** el usuario confirma una instancia recurrente de gasto USD sobre una tarjeta
- **THEN** el confirm no pide cotización y genera el consumo USD sin `fx_rate_to_ars`

---

### Requirement: El pago de un resumen confirma las fechas del período en curso y crea el siguiente estimado

Cuando el resumen de un ciclo cierra, el banco emite el extracto e incluye en él las fechas del ciclo siguiente — el que está en curso al momento de pagar. El formulario de **la primera pata** de pago de P(n) SHALL pedir la **confirmación** de las fechas de P(n+1) (el período inmediatamente posterior al que se paga), pre-llenadas con las fechas persistidas de ese período. NO SHALL pedir fechas de períodos posteriores a P(n+1).

Las patas siguientes del mismo resumen NO SHALL pedir ni modificar esas fechas: son datos del resumen de papel, ya confirmados en el primer pago. `next_end_date` y `next_due_date` SHALL ser requeridos únicamente cuando el período todavía no tiene patas registradas.

**Confirmación (pisado del estimado):** al registrar la primera pata, el sistema SHALL actualizar `end_date`/`due_date` de P(n+1) con las fechas ingresadas y marcar `is_estimated=false`. La actualización SHALL reusar la semántica de edición de fechas de período (cascada del borde y reasignación de transacciones):

- Si el cierre real es anterior al estimado, las transacciones de P(n+1) con `date` posterior al nuevo cierre SHALL reasignarse al período siguiente.
- Si P(n+2) existe con `is_estimated=true`, sin transacciones y sin pagos, y el nuevo cierre de P(n+1) lo invadiera (`new_end_date >= P(n+2).end_date`), el sistema SHALL re-proyectarlo (`start_date = new_end_date + 1`, fechas re-estimadas) en lugar de rechazar. El rechazo existente de la edición de fechas aplica solo cuando el período siguiente tiene datos reales (transacciones, pagos o fechas confirmadas).

**Período siguiente eager:** tras confirmar P(n+1), el sistema SHALL garantizar que exista P(n+2) con `is_estimated=true`, proyectado con el algoritmo de sugerencia desde los períodos confirmados. Si ya existía (generado lazy o re-proyectado), se conserva.

**Validación:** `next_end_date` SHALL ser posterior a `end_date` de P(n) (el `start_date` de P(n+1) es fijo: `P(n).end_date + 1`), y `next_due_date` posterior a `next_end_date`.

**Invariante resultante:** toda fecha de cierre/vencimiento confirmada (`is_estimated=false`) fue ingresada por el usuario en un momento en que el banco ya la había anunciado: P1 en el alta, P(n+1) al registrar el primer pago de P(n). `start_date` nunca se pide ni se estima.

#### Scenario: Pagar P1 confirma las fechas estimadas de P2 y crea P3 estimado

- **WHEN** una tarjeta tiene P1 (`end_date='2026-06-16'`, closed) y P2 estimado (`end_date='2026-07-14'` proyectado), y el usuario registra el primer pago de P1 ingresando `next_end_date='2026-07-16'`, `next_due_date='2026-07-22'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `due_date='2026-07-22'`, `is_estimated=false`
- **AND** se crea P3 con `start_date='2026-07-17'`, `is_estimated=true`, fechas proyectadas

#### Scenario: La segunda pata no vuelve a pedir las fechas del ciclo

- **WHEN** el usuario registra un segundo pago sobre un resumen que ya tiene una pata
- **THEN** el formulario no muestra la sección de fechas del ciclo en curso
- **AND** las fechas confirmadas de P(n+1) quedan intactas

#### Scenario: El formulario del primer pago se pre-llena con las fechas persistidas del período en curso

- **WHEN** el usuario abre el formulario para pagar P1 —sin patas registradas— y P2 existe con `end_date='2026-07-14'`, `due_date='2026-07-20'`
- **THEN** el formulario muestra `2026-07-14` y `2026-07-20` como valores iniciales de cierre y vencimiento
- **AND** el copy indica que son las fechas del ciclo en curso a confirmar con el resumen recibido

#### Scenario: Cierre real anterior al estimado reubica consumos al período siguiente

- **WHEN** P2 estimado tiene `end_date='2026-07-20'` con un consumo del `2026-07-18`, y al pagar P1 el usuario confirma `next_end_date='2026-07-16'`
- **THEN** P2 queda con `end_date='2026-07-16'`, `is_estimated=false`
- **AND** el consumo del `2026-07-18` queda asignado a P3 (estimado), creado o re-proyectado en la misma operación

#### Scenario: Validación rechaza un cierre que no es posterior al período pagado

- **WHEN** el usuario registra el primer pago de P1 (`end_date='2026-06-16'`) e ingresa `next_end_date='2026-06-10'`
- **THEN** la acción retorna un error localizado que nombra el cierre de P1 como ancla
- **AND** no se registra el pago ni se modifica ningún período

#### Scenario: P3 estimado vacío se re-proyecta en lugar de bloquear la confirmación

- **WHEN** existen P2 estimado (`end_date='2026-07-14'`) y P3 estimado sin transacciones ni pagos (`end_date='2026-08-12'`), y al pagar P1 el usuario confirma `next_end_date='2026-08-15'` para P2
- **THEN** la confirmación procede: P2 queda con `end_date='2026-08-15'`, `is_estimated=false`
- **AND** P3 se re-proyecta con `start_date='2026-08-16'` y fechas re-estimadas

---

### Requirement: El pago de un resumen incorpora el impuesto de sellos

Al registrar **la primera pata** de pago de un resumen, el sistema SHALL ofrecer registrar el impuesto de sellos y, si el usuario confirma un monto mayor a cero, SHALL registrarlo como movimiento del resumen. El monto del sello SHALL ser siempre editable antes de confirmar el pago.

La base de cálculo SHALL ser el total ARS del resumen (consumos `pending` en ARS menos reintegros), determinada **antes** de registrar el movimiento de sello.

El sello SHALL sumar a la deuda en pesos del resumen, como cualquier otro cargo: cuando el pago es total, queda incluido en lo que se paga; cuando es parcial, queda incluido en lo que resta. Las patas siguientes del mismo resumen NO SHALL volver a ofrecer el sello ni modificar la alícuota aprendida.

#### Scenario: Primera vez — selector de monto sin mencionar el porcentaje

- **WHEN** el usuario va a registrar el primer pago de un resumen de una tarjeta cuya `stamp_tax_rate` es `NULL`
- **THEN** el sistema muestra un selector de montos en pesos (sugerencias calculadas a partir de las alícuotas más comunes, una opción de monto libre y una opción "No me cobraron sellos")
- **AND** muestra un aviso de que el dato se pide solo esta vez y que en los próximos resúmenes se sugerirá solo
- **AND** no se menciona ningún porcentaje al usuario

#### Scenario: Próximas veces — monto pre-cargado y editable

- **WHEN** el usuario va a registrar el primer pago de un resumen de una tarjeta con `stamp_tax_rate` conocida
- **THEN** el campo de impuesto de sellos viene pre-cargado con `round(base × stamp_tax_rate)`
- **AND** el usuario puede editar ese monto antes de confirmar

#### Scenario: El monto del sello se suma a la deuda del resumen

- **WHEN** el usuario confirma el primer pago con un monto de sello mayor a cero
- **THEN** la deuda en pesos del resumen pasa a ser `consumos + sello`
- **AND** el monto sugerido para una pata que salda el resumen incluye el sello

#### Scenario: La segunda pata no vuelve a preguntar por el sello

- **WHEN** el usuario registra un segundo pago sobre un resumen que ya tiene una pata
- **THEN** el formulario no muestra la sección de impuesto de sellos
- **AND** no se inserta ningún movimiento de sello adicional

---

### Requirement: El usuario puede deshacer el pago de un resumen

El sistema SHALL permitir deshacer los pagos de un resumen, revirtiendo de forma **atómica** todo lo que el pago escribió del lado del dinero. La reversión SHALL poder alcanzar **todas** las patas del resumen o **solo la más reciente**, y en ambos casos SHALL:

- borrar las filas de `period_payments` alcanzadas;
- devolver a `pending` los movimientos del período que el barrido hubiera pasado a `paid`, cuando el resumen estaba saldado;
- borrar el movimiento de impuesto de sellos, únicamente cuando se revierte la pata que lo registró;
- borrar los gastos registrados en las cuentas de pago de las patas alcanzadas, en la moneda en que se registraron.

El sistema NO SHALL permitir revertir una pata que no sea la más reciente del resumen sin revertir también las posteriores.

Tras la reversión, el saldo pendiente del resumen SHALL recomponerse desde las patas que queden, su estado SHALL derivarse de nuevo (impago, parcial o saldado), y el saldo de cada cuenta de pago SHALL recuperar el monto de su gasto, **en su moneda**.

La operación SHALL ser todo-o-nada: si cualquier paso falla, el sistema SHALL dejar el período exactamente como estaba y comunicar el error, sin estados intermedios observables.

La reversión NO SHALL deshacer los efectos del pago sobre el **calendario** de la tarjeta: las fechas confirmadas del ciclo en curso, el período estimado creado y las reasignaciones de consumos entre períodos SHALL permanecer. Esas fechas son hechos del resumen real y no dependen de que el pago se haya cargado correctamente.

La reversión tampoco SHALL modificar la alícuota de impuesto de sellos aprendida por la tarjeta (`accounts.stamp_tax_rate`).

Solo el dueño de la tarjeta SHALL poder deshacer un pago.

#### Scenario: Deshacer el pago devuelve el resumen a impago

- **WHEN** el usuario deshace el pago de un resumen que tenía tres consumos y una cuota, saldado con un gasto-débito de $120.000 desde "Banco Galicia"
- **THEN** los cuatro movimientos del período vuelven a `pending`
- **AND** el gasto-débito de $120.000 desaparece y el saldo de "Banco Galicia" aumenta $120.000
- **AND** el resumen vuelve a figurar como impago, con su deuda incluida en el pendiente de la tarjeta

#### Scenario: Deshacer solo la última pata deja el resumen parcial

- **WHEN** un resumen tiene una pata de $40.000 y otra posterior de $225.805,42 que lo saldó, y el usuario deshace la segunda
- **THEN** los consumos del período vuelven a `pending` y el resumen queda parcial, con $225.805,42 pendientes
- **AND** la pata de $40.000 y su gasto siguen existiendo

#### Scenario: Deshacer la pata en dólares devuelve dólares

- **WHEN** el usuario deshace una pata que había cancelado US$ 1.932,40 desde su caja de ahorro en dólares
- **THEN** el gasto en USD desaparece y el saldo en dólares de esa cuenta aumenta US$ 1.932,40
- **AND** ningún saldo en pesos cambia por esa reversión

#### Scenario: Deshacer un pago con impuesto de sellos borra el sello

- **WHEN** el usuario deshace la pata que había registrado un impuesto de sellos de $1.800 dentro del período
- **THEN** el movimiento de impuesto de sellos se elimina
- **AND** no queda ningún movimiento de sello dentro del resumen

#### Scenario: La alícuota aprendida sobrevive a la reversión

- **WHEN** el usuario deshace el pago que le hizo aprender a la tarjeta su alícuota de sellos
- **THEN** la `stamp_tax_rate` de la tarjeta se mantiene
- **AND** al volver a pagar el resumen el monto de sello viene pre-cargado, sin volver a preguntar como si fuera la primera vez

#### Scenario: Las fechas confirmadas del ciclo en curso se mantienen

- **WHEN** el usuario deshace un pago que había confirmado las fechas del ciclo en curso y creado el período estimado siguiente
- **THEN** el ciclo en curso conserva sus fechas confirmadas y sigue sin ser estimado
- **AND** el período estimado siguiente sigue existiendo con los consumos que tuviera imputados

#### Scenario: La reversión es atómica

- **WHEN** la reversión falla al borrar uno de los gastos
- **THEN** los movimientos del período siguen como estaban, las filas de `period_payments` siguen existiendo y el resumen sigue figurando igual
- **AND** el sistema informa el error

---

### Requirement: Deshacer un pago exige orden cronológico inverso

El sistema NO SHALL permitir deshacer un pago de un resumen si existe un resumen **posterior** de la misma tarjeta que ya tenga pagos registrados —saldado o parcial—. El usuario SHALL deshacer los pagos del más nuevo al más viejo.

Cuando la operación se bloquea por esta regla, el sistema SHALL comunicarlo con un mensaje que identifique cuál es el resumen que hay que deshacer primero, sin exponer detalles técnicos.

#### Scenario: Bloqueo por resumen posterior con pagos

- **WHEN** el usuario intenta deshacer el pago del resumen de marzo, y el resumen de abril de la misma tarjeta ya tiene un pago registrado
- **THEN** el sistema rechaza la operación
- **AND** informa que primero debe deshacerse el pago del resumen de abril

#### Scenario: Un pago parcial posterior también bloquea

- **WHEN** el resumen de abril tiene un pago parcial y el usuario intenta deshacer el pago de marzo
- **THEN** el sistema rechaza la operación con el mismo mensaje

#### Scenario: El resumen más reciente con pagos se puede deshacer

- **WHEN** el usuario deshace el pago del resumen de abril, siendo el más reciente con pagos de esa tarjeta
- **THEN** la operación se ejecuta normalmente
- **AND** a continuación el pago de marzo también puede deshacerse
