## ADDED Requirements

### Requirement: El pago de un resumen se registra como patas, y cada pata declara qué deuda cancela

El sistema SHALL registrar cada pago de resumen como una o más **patas de pago**: filas de
`period_payments` que vinculan cada débito real con la deuda que cancela. `period_id` NO SHALL ser
único: un pago puede tener varias patas.

Cada pata SHALL persistir:

- `transaction_id` — el gasto real, **en la moneda de la que sale el dinero**;
- `payment_group_id` — qué patas nacieron de una misma operación del usuario;
- `settles_currency` — la moneda de la **deuda del resumen** que la pata cancela (`ARS` o `USD`);
- `settles_amount` — cuánto de esa deuda cancela, expresado en `settles_currency`, mayor a cero;
- `fx_rate_to_ars` — la cotización usada, en el único cruce de monedas permitido.

El sistema NO SHALL deducir qué deuda cancela una pata a partir del monto de su transacción: la
imputación SHALL ser un dato declarado, nunca inferido.

La cotización de una pata que pesifica SHALL coincidir con la que persiste su transacción, y todas
las patas pesificadas de una **misma** transacción SHALL compartir la misma cotización: un débito
ocurre un día y a un tipo de cambio.

**Los cruces de moneda SHALL ser una lista cerrada**, no una regla general: la transacción en ARS
cancelando deuda ARS (sin cotización), en USD cancelando deuda USD (sin cotización), y en ARS
cancelando deuda USD (**con** cotización obligatoria). El sistema NO SHALL aceptar una transacción
en USD que cancele deuda en ARS: eso es un canje de moneda, para lo que existe el movimiento
`exchange`.

Ninguna pata SHALL cancelar más que el saldo pendiente de su moneda. Ese piso SHALL sostenerse **en
la base de datos**, serializando los inserts concurrentes sobre un mismo resumen, y NO SHALL depender
de una validación previa en la aplicación.

Una transacción de pago SHALL poder tener **más de una pata**: un único débito bancario puede
cancelar deuda en pesos y deuda en dólares pesificada a la vez, y el sistema NO SHALL partirlo en
varios gastos para representarlo. Las patas que comparten una transacción SHALL pertenecer al mismo
resumen y al mismo grupo de pago.

El monto de la transacción SHALL ser igual a la suma de sus patas expresadas en su moneda,
computando una pata pesificada como `settles_amount × fx_rate_to_ars` **redondeado a dos decimales**
con la misma regla que usa el sistema para multiplicar dinero. Esa identidad SHALL verificarse
cuando la operación está completa, NO fila por fila: con dos patas sobre un mismo gasto, la primera
todavía no llega al total y rechazarla ahí bloquearía un pago legítimo.

La operación de pago SHALL recibir las patas **agrupadas por transacción** —cada pago con su cuenta,
su fecha y sus imputaciones—, y NO SHALL recibir una lista plana de patas.

Toda lectura de las patas de un resumen SHALL contemplar **varias filas**.

#### Scenario: Una pata en pesos que cancela deuda en pesos

- **WHEN** el usuario paga $265.805,42 de un resumen desde una cuenta en pesos
- **THEN** se registra una pata con `settles_currency='ARS'`, `settles_amount=265805.42` y `fx_rate_to_ars` nula

#### Scenario: Un pago en pesos que cancela pesos y dólares es un solo gasto

- **WHEN** el usuario paga en pesos, desde una sola cuenta, un resumen que debe $265.805,42 y US$ 1.932,40 con cotización `1230,50`
- **THEN** se registra **una** transacción en ARS con dos patas: una `ARS` por $265.805,42 y una `USD` por US$ 1.932,40
- **AND** el monto de esa transacción es la suma de las dos patas expresadas en pesos
- **AND** el listado de movimientos muestra una sola fila para ese pago

#### Scenario: Pagar deuda en pesos desde una cuenta en dólares se rechaza

- **WHEN** llega una pata con `settles_currency='ARS'` cuya transacción está en USD
- **THEN** el sistema la rechaza y el mensaje remite al movimiento de canje de moneda

#### Scenario: Dos cotizaciones distintas dentro del mismo gasto se rechazan

- **WHEN** se intenta registrar dos patas pesificadas sobre una misma transacción con cotizaciones distintas
- **THEN** el sistema rechaza la operación

#### Scenario: Un gasto imputado a dos resúmenes distintos se rechaza

- **WHEN** se intenta registrar una pata sobre una transacción que ya tiene otra pata en un resumen distinto
- **THEN** el sistema rechaza la operación

#### Scenario: Dos pagos concurrentes no pueden sobrepasar el pendiente

- **WHEN** dos pedidos simultáneos intentan cancelar la misma deuda
- **THEN** exactamente uno se registra y el otro es rechazado por la base
- **AND** el saldo pendiente del resumen nunca queda negativo

---

### Requirement: Una operación de pago salda el resumen entero, o no ocurre

El sistema SHALL rechazar toda operación de pago que no deje el saldo pendiente del resumen en
**cero en ambas monedas**. Una operación PUEDE tener varios débitos reales —uno por cuenta y
moneda—, pero entre todos SHALL cubrir la deuda completa.

Esa regla SHALL vivir en la base de datos, no en la aplicación: es lo que sostiene que **la
existencia de un pago siga siendo equivalente a que el resumen esté saldado**, que es como lo leen
el estado del período, los totales, la clasificación del ciclo de vida, el hero de tarjetas, el
resumen del mes y los compromisos del dashboard. Un pago que cancelara solo una de las dos monedas
dejaría ese equivalente convertido en una afirmación falsa en todas esas superficies a la vez.

El sistema NO SHALL ofrecer pago parcial ni pago mínimo, y NO SHALL exponer un estado "parcial".
El **modelo** de patas admite una pata menor al pendiente; lo que no lo admite es el camino de
escritura.

El monto que sale de cada cuenta SHALL derivarse de las imputaciones declaradas, y NO SHALL ser un
importe libre que pueda no corresponder a ninguna deuda.

#### Scenario: Pagar solo los pesos de un resumen mixto se rechaza

- **WHEN** un resumen debe $265.805,42 y US$ 1.932,40 y la operación solo cancela los pesos
- **THEN** el sistema rechaza la operación entera
- **AND** no se registra ninguna pata ni ningún débito, y el resumen sigue impago por sus dos monedas

#### Scenario: Pagar de menos se rechaza

- **WHEN** la operación cancela $40.000 de un resumen que debe $265.805,42
- **THEN** el sistema la rechaza indicando lo que quedaría pendiente
- **AND** los consumos del resumen conservan su estado

#### Scenario: El impuesto de sellos entra en el total que hay que cubrir

- **WHEN** el usuario registra un sello de $1.200 sobre un resumen de $100.000 y la operación cancela solo $100.000
- **THEN** el sistema la rechaza: el sello es un cargo del resumen y sube la deuda

---

### Requirement: La porción en dólares de un resumen se puede pagar en dólares

El sistema SHALL permitir cancelar la deuda en dólares de un resumen **con dólares**, desde una
cuenta de efectivo o bancaria con la moneda `USD` activa, además de la opción existente de
pesificarla.

Cuando la porción USD se paga en dólares, la pata SHALL registrar una transacción de tipo gasto con
`currency_code='USD'` en la cuenta elegida, sin `fx_rate_to_ars`, y el saldo en dólares de esa cuenta
SHALL disminuir en ese monto. El sistema NO SHALL exigir cotización en ese caso.

El formulario de pago SHALL ofrecer un selector de cuenta en dólares independiente del de pesos,
mostrando el saldo disponible en USD, y SHALL advertir de forma no bloqueante cuando la operación
dejaría ese saldo en negativo, con la misma semántica que ya aplica a la cuenta en pesos.

El impuesto de sellos SHALL registrarse siempre en ARS y SHALL salir de un débito en pesos.

#### Scenario: Resumen mixto pagado con dos débitos

- **WHEN** un resumen debe $265.805,42 y US$ 1.932,40, y el usuario paga los pesos desde su cuenta en pesos y los dólares desde su caja de ahorro en dólares
- **THEN** se registran dos patas: una `ARS` y una `USD`, en la misma operación
- **AND** el saldo en pesos de la primera cuenta baja $265.805,42 y el saldo en dólares de la segunda baja US$ 1.932,40
- **AND** en ningún momento se muestra un total que sume o convierta las dos monedas

#### Scenario: Pagar dólares con dólares no pide cotización

- **WHEN** el usuario elige pagar en dólares la porción USD del resumen
- **THEN** el formulario oculta el campo de cotización y no lo exige para confirmar

#### Scenario: Resumen íntegramente en dólares pagado en dólares

- **WHEN** un resumen no tiene deuda en pesos, debe US$ 300 y no se cargó impuesto de sellos, y el usuario lo paga desde su cuenta en dólares
- **THEN** se registra una única pata `USD` y ninguna transacción en pesos
- **AND** el resumen queda saldado

---

### Requirement: El registro de un pago de resumen es atómico en la base, y el calendario queda afuera

El sistema SHALL escribir el lado del **dinero** de un pago de resumen en una única operación atómica
en la base de datos: el cálculo de la deuda por moneda, la inserción de las transacciones y sus
patas, la inserción del impuesto de sellos cuando corresponde, la verificación de que la operación
salda el resumen, y el barrido `pending → paid` de los consumos. La operación SHALL serializar los
pagos concurrentes sobre un mismo resumen desde su inicio, antes de cualquier efecto que dependa de
que el resumen todavía no tenga pagos.

El sistema NO SHALL sostener esa atomicidad con una cadena de rollbacks manuales desde la aplicación.

El lado del **calendario** —la confirmación de las fechas del ciclo en curso, la creación o
re-proyección del período estimado siguiente y la reasignación de consumos entre períodos— NO SHALL
formar parte de esa transacción, y SHALL ejecutarse antes, en su propia operación atómica.

Esa operación SHALL revalidar, antes de escribir, los anclajes que la decisión da por ciertos: la
propiedad de la tarjeta, la identidad y las fechas del período siguiente, el estado del período que
le sigue —fechas, si es estimado, si tiene pagos y si tiene consumos— y que el período pagado siga
sin pagos. Si el estado cambió desde que la decisión se calculó, el sistema NO SHALL aplicarla.

#### Scenario: Un fallo en el registro del dinero no deja nada a medias

- **WHEN** la inserción de la segunda pata de un pago falla
- **THEN** ninguna de las transacciones ni de las patas de esa operación queda registrada
- **AND** los consumos del resumen conservan el estado que tenían

#### Scenario: Un fallo en el dinero no revierte las fechas confirmadas

- **WHEN** el usuario confirma las fechas del ciclo en curso y el registro del dinero falla después
- **THEN** las fechas confirmadas del ciclo en curso se mantienen, con `is_estimated=false`

#### Scenario: Un plan de fechas calculado sobre un estado que ya cambió no se aplica

- **WHEN** el período siguiente al que se va a confirmar dejó de ser estimado, o recibió consumos, entre el cálculo y la escritura
- **THEN** el sistema no aplica el plan y lo informa, sin dejar el calendario a medias

---

### Requirement: Las patas de pago no se escriben directamente

El sistema NO SHALL permitir crear, modificar ni borrar una pata de pago por fuera de las
operaciones de registrar un pago y deshacerlo. Corregir un pago SHALL hacerse deshaciéndolo y
volviéndolo a registrar.

La restricción SHALL sostenerse a nivel de base de datos. Las tres escrituras rompen el modelo de
maneras distintas y ninguna tiene caso de uso: un alta directa saltea la atomicidad y la regla de
saldado, una modificación del monto imputado esquiva el piso de cobertura, y un borrado directo deja
la transacción de pago **huérfana** —un gasto que ya no figura como pago de tarjeta, que libera la
protección contra su propio borrado, y que reabre la deuda del resumen aunque la plata ya haya
salido.

#### Scenario: Modificar el monto imputado de una pata se rechaza

- **WHEN** se intenta modificar el `settles_amount` de una pata ya registrada
- **THEN** la base rechaza la operación

#### Scenario: Borrar una pata sin deshacer el pago se rechaza

- **WHEN** se intenta borrar directamente la fila de una pata de pago
- **THEN** la base rechaza la operación
- **AND** la transacción de pago sigue figurando como pago de resumen, protegida contra su borrado

---

### Requirement: La app nativa permite pagar en dólares, con paridad de reglas

La app nativa SHALL exponer las mismas capacidades de pago que la web: elegir en qué moneda se
cancela la porción en dólares del resumen, con los mismos selectores de cuenta por moneda y los
mismos avisos. Ambas SHALL delegar en las mismas mutaciones de `@grana/cards` y en los mismos
schemas de `@grana/validation`: las shells NO SHALL reimplementar ninguna regla de imputación, de
cobertura ni de cotización.

#### Scenario: Pago multimoneda desde la app nativa

- **WHEN** el usuario paga desde la app nativa un resumen con deuda en pesos y en dólares, eligiendo dólares para la porción USD
- **THEN** se registran las dos patas con la misma semántica que en web
- **AND** ninguna validación de cobertura ni de cotización se resuelve en la shell nativa

---

## MODIFIED Requirements

### Requirement: La cotización de la deuda USD se captura al pagar el resumen, no al registrar el consumo

El registro de un consumo en USD en una tarjeta NO SHALL exigir cotización: la deuda del período se computa por moneda (`pendingAmountARS` / `pendingAmountUSD`) y la conversión real ocurre recién al pagar el resumen, con la cotización del día de pago. El campo `fx_rate_to_ars` del consumo queda como dato opcional/histórico, sin uso contable en el alta.

Al pagar la deuda en dólares de un resumen, la cotización SHALL exigirse **solo cuando esa deuda se
pesifica**, es decir cuando la pata cancela deuda en USD con una transacción en ARS. En ese caso el
sistema SHALL pedir la cotización del día de pago (decimal de hasta 6 posiciones, sin agrupado de
miles), SHALL computar el monto de la transacción como `USD a cancelar × cotización`, mostrando el
desglose, y SHALL persistirla en la pata y en la transacción para trazabilidad. Cuando la deuda en
dólares se paga **con dólares**, el sistema NO SHALL pedir ni registrar cotización.

Sin deuda USD pendiente, el flujo de pago no pide cotización y no cambia.

A nivel base de datos, el invariante I-CRED-11 SHALL reflejar este modelo: el consumo USD en tarjeta acepta `fx_rate_to_ars` nulo (cuando está presente debe ser > 0), el consumo ARS lo rechaza, los gastos no-credit lo aceptan cuando es > 0 (pago de resumen pesificado), y todo tipo no-expense lo rechaza.

Los períodos SHALL exponer lo pagado y lo pendiente **por moneda**, y el detalle de una transacción de pago SHALL mostrar qué deuda del resumen canceló y con qué cotización, cuando hubo.

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

#### Scenario: La cotización queda registrada en la pata pesificada

- **WHEN** se confirma una pata que pesifica US$ 1.932,40 con cotización `1.230,50`
- **THEN** la pata persiste `fx_rate_to_ars = 1230.50` y la transacción de pago también

#### Scenario: Confirmar recurrencia USD en tarjeta no pide cotización

- **WHEN** el usuario confirma una instancia recurrente de gasto USD sobre una tarjeta
- **THEN** el confirm no pide cotización y genera el consumo USD sin `fx_rate_to_ars`

---

### Requirement: El detalle de período muestra movimientos del período e info del pago

El sistema SHALL renderizar una pantalla `/cards/[id]/periods/[periodId]` con: rango de fechas del período, monto total, lista de movimientos imputados ordenados por `date ASC, created_at ASC, id ASC`, información del pago si el período está pagado, y link "Editar fechas" si las fechas son editables según las reglas del requirement de edición.

El **monto total** del resumen SHALL netear los reintegros "en resumen" recibidos (`reimbursement_target='statement'`, `received_at` seteado, `cancelled_at` nulo): `total = Σ consumos − Σ reintegros recibidos`, por moneda. Como los consumos de un período son homogéneos en estado (`pending` mientras el resumen está impago, `paid` una vez pagado), el reintegro descuenta el total que efectivamente se muestra: el **pagado** cuando el período está pagado, el **pendiente** en caso contrario. Un reintegro pendiente o cancelado NO descuenta el total.

La información de pago SHALL listar **todos los débitos** del pago —fecha, cuenta, monto en la moneda de la que salió el dinero y, cuando hubo conversión, la cotización usada—, no solo el primero: un resumen mixto pagado en dos monedas tiene dos.

#### Scenario: Detalle de período pagado muestra info del pago

- **WHEN** el usuario abre un período pagado el `2026-05-15` desde la cuenta "Banco Galicia"
- **THEN** la pantalla muestra "Pagado el 15-may desde Banco Galicia"

#### Scenario: El total de un resumen pagado descuenta el reintegro recibido

- **WHEN** el usuario abre un período pagado cuyos consumos suman `$128.841,06` y tiene un reintegro "en resumen" recibido de `$3.155,55`
- **THEN** el monto total del resumen muestra `$125.685,51`, no `$128.841,06`

#### Scenario: Un resumen pagado en dos monedas muestra sus dos débitos

- **WHEN** el usuario abre un período que se pagó con un débito en pesos y otro en dólares
- **THEN** la pantalla lista los dos, cada uno con su cuenta y su monto en su moneda
- **AND** no muestra un total que sume o convierta las dos

#### Scenario: Detalle de período open muestra link "Editar fechas"

- **WHEN** el usuario abre un período `open` con cero transacciones imputadas
- **THEN** la pantalla muestra el link "Editar fechas" activo

---

### Requirement: El usuario puede deshacer el pago de un resumen

El sistema SHALL permitir deshacer el pago de un resumen, revirtiendo de forma **atómica** todo lo que el pago escribió del lado del dinero:

- SHALL borrar las patas de pago del resumen;
- SHALL devolver a `pending` los movimientos del período que el pago barrió a `paid`;
- SHALL borrar el movimiento de impuesto de sellos registrado por ese pago, si existe;
- SHALL borrar **todos** los gastos registrados en las cuentas de pago, en la moneda en que se registraron.

La reversión SHALL alcanzar el **grupo de pago** completo —todas las patas nacidas de una misma operación—, y NO SHALL revertir una pata sola cuando su operación creó varias: deshacer media operación deja un pago que el usuario nunca hizo así. El orden de las patas SHALL ser determinístico por `(created_at, id)`.

La operación SHALL serializar contra pagos y reversiones concurrentes sobre el mismo resumen.

Tras la reversión, el resumen SHALL volver a derivar su estado como impago, su deuda SHALL reaparecer en los cálculos de pendiente, y el saldo de cada cuenta de pago SHALL recuperar el monto de su gasto, **en su moneda**.

La operación SHALL ser todo-o-nada: si cualquier paso falla, el sistema SHALL dejar el período exactamente como estaba y comunicar el error, sin estados intermedios observables.

La reversión NO SHALL deshacer los efectos del pago sobre el **calendario** de la tarjeta: las fechas confirmadas del ciclo en curso, el período estimado creado y las reasignaciones de consumos entre períodos SHALL permanecer. Tampoco SHALL modificar la alícuota de impuesto de sellos aprendida por la tarjeta.

Solo el dueño de la tarjeta SHALL poder deshacer el pago.

#### Scenario: Deshacer un pago devuelve el resumen a impago

- **WHEN** el usuario deshace el pago de un resumen que tenía tres consumos y una cuota, pagado con un gasto-débito de $120.000 desde "Banco Galicia"
- **THEN** los cuatro movimientos del período vuelven a `pending`
- **AND** el gasto-débito de $120.000 desaparece y el saldo de "Banco Galicia" aumenta $120.000
- **AND** el resumen vuelve a figurar como impago, con su deuda incluida en el pendiente de la tarjeta

#### Scenario: Deshacer un pago de dos monedas revierte los dos débitos

- **WHEN** el usuario deshace un pago que canceló $265.805,42 en pesos y US$ 1.932,40 en dólares
- **THEN** las dos patas y sus dos gastos se revierten juntos
- **AND** el saldo en dólares de esa cuenta aumenta US$ 1.932,40 y ningún otro saldo en dólares cambia

#### Scenario: Deshacer un pago con impuesto de sellos borra el sello

- **WHEN** el usuario deshace un pago que había registrado un impuesto de sellos de $1.800 dentro del período
- **THEN** el movimiento de impuesto de sellos se elimina

#### Scenario: La alícuota aprendida sobrevive a la reversión

- **WHEN** el usuario deshace el pago que le hizo aprender a la tarjeta su alícuota de sellos
- **THEN** la `stamp_tax_rate` de la tarjeta se mantiene

#### Scenario: Las fechas confirmadas del ciclo en curso se mantienen

- **WHEN** el usuario deshace un pago que había confirmado las fechas del ciclo en curso y creado el período estimado siguiente
- **THEN** el ciclo en curso conserva sus fechas confirmadas y sigue sin ser estimado

#### Scenario: La reversión es atómica

- **WHEN** la reversión falla al borrar uno de los gastos
- **THEN** los movimientos del período siguen como estaban y el resumen sigue figurando pagado
- **AND** el sistema informa el error

---

### Requirement: Deshacer un pago exige orden cronológico inverso

El sistema NO SHALL permitir deshacer el pago de un resumen si existe un resumen **posterior** de la misma tarjeta que ya tenga patas de pago. El usuario SHALL deshacer los pagos del más nuevo al más viejo.

Cuando la operación se bloquea por esta regla, el sistema SHALL comunicarlo con un mensaje que identifique cuál es el resumen que hay que deshacer primero, sin exponer detalles técnicos.

#### Scenario: Bloqueo por resumen posterior pagado

- **WHEN** el usuario intenta deshacer el pago del resumen de marzo, y el de abril de la misma tarjeta ya está pagado
- **THEN** el sistema rechaza la operación
- **AND** informa que primero debe deshacerse el pago del resumen de abril

#### Scenario: El resumen más reciente pagado se puede deshacer

- **WHEN** el usuario deshace el pago del resumen de abril, siendo el más reciente con pagos de esa tarjeta
- **THEN** la operación se ejecuta normalmente
- **AND** a continuación el pago de marzo también puede deshacerse
