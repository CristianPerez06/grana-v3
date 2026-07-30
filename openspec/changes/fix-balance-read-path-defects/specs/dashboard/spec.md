## MODIFIED Requirements

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

La sección "Balance del mes" SHALL mostrar, para el mes seleccionado en el navegador compartido: un eyebrow "BALANCE" y debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense); debajo, las filas de flujo, cada una con dot de color + label + monto y una barra horizontal proporcional.

**Reconciliación con el Disponible (lente CAJA).** El neto del mes (`finalBalance`) SHALL reconciliar exactamente con el cambio del Disponible en ese mes: la sección SHALL contabilizar **todo** movimiento de caja del mes sobre cuentas propias aplicando los **mismos signos** que `calculateTransactionSums` (la fuente del Hero/Disponible), por moneda, sin combinar ARS con USD.

**"Cuenta propia" es un único criterio en toda la app: `type IN ('cash','bank') AND is_active = true`.** El universo de cuentas de esta sección SHALL ser idéntico al del Hero/Disponible, sin excepción. Una cuenta **archivada** (`is_active = false`) NO SHALL aportar sus movimientos al neto del mes, porque su saldo tampoco está en el Disponible: contarla de un lado y no del otro rompe la reconciliación. El criterio NO SHALL replicarse a mano en cada query — SHALL derivarse de una única definición normativa compartida (ver spec `web-data-access`), de modo que Hero, "Dónde está", listado/detalle de cuentas y "Balance del mes" no puedan divergir por olvido. En consecuencia `finalBalance = totalIncome − totalExpense − totalCardPayment + totalAdjustment + totalReimbursement + totalSettlement + totalExchange`. Ningún tipo de movimiento de caja SHALL descartarse: los reintegros recibidos a cuenta, las liquidaciones de deuda compartida y los cambios de moneda — hoy ignorados — SHALL contabilizarse. Solo cuentan transacciones confirmadas (los consumos `pending` de tarjeta no entran, igual que siempre).

**Transferencias: cada pata se evalúa por separado.** Una `transfer` SHALL restar cuando su cuenta origen es propia y sumar cuando su cuenta destino lo es, evaluando cada condición de forma independiente — exactamente como `calculateTransactionSums`. Cuando **ambas** patas son cuentas propias el resultado neto es cero y la transferencia no mueve el neto del mes (comportamiento visible sin cambios). Cuando **solo una** pata es propia (la otra es una cuenta archivada), la transferencia SHALL contabilizarse por esa pata. El sistema NO SHALL descartar las transferencias de plano asumiendo que ambas patas son propias: esa suposición es la que hace divergir la serie del mes del Disponible.

Cada tipo de movimiento de caja vive en su **balde propio**, con estas reglas de signo (idénticas a `calculateTransactionSums`):

- **Ingresos** (`income`): suma. Fila siempre visible.
- **Gastos** (`expense` que NO es pago de resumen): suma. Fila siempre visible.
- **Ajustes** (`adjustment`): signado (positivo sube el saldo, negativo lo baja). Corrección de stock, no flujo.
- **Pago de tarjeta** (`expense` vinculado a un `period_payments`): suma. Cancela deuda ya devengada, no es consumo nuevo.
- **Reintegros recibidos** (`reimbursement` con `reimbursement_target='account'`, `received_at` no nulo y `cancelled_at` nulo): es plata que vuelve a la cuenta, así que para la caja se cuenta como **ingreso** y se **pliega dentro de la fila "Ingresos"** (NO tiene barra propia). Suma al neto igual. Los reintegros pendientes, cancelados o "en resumen" NO entran (no tocan el Disponible).
- **Liquidaciones** (`settlement`): signado — `settlement_direction='in'` suma, `'out'` resta.
- **Cambio de moneda** (`exchange`): signado **por moneda** — en la serie ARS, la pata origen (la plata que sale de ARS) resta; en la serie USD, la pata destino (la que entra) suma. Reconcilia per-moneda porque es exactamente lo que hace `calculateTransactionSums`.

Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a "Ingresos" ni a "Gastos". El pago de resumen NO SHALL sumarse a "Gastos". La fila "Gastos" SHALL reflejar únicamente gasto **de caja** real (`type='expense'` sobre cuenta propia que NO es pago de resumen).

**"Gastos" (CAJA) NO coincide con "En qué se fue" (CONSUMO).** Son lentes distintas a propósito: "En qué se fue" es **devengado** e incluye el consumo de tarjeta (consumos + cuotas, por fecha de compra), mientras "Gastos" de Balance del mes es **caja** y solo cuenta lo que salió de una cuenta propia (efectivo/débito). La diferencia entre ambos es, justamente, el consumo de tarjeta del mes que aún no se pagó. La reconciliación que SHALL cumplirse es otra: `finalBalance` ↔ el cambio del **Disponible** (ver más arriba). El rótulo de la pregunta de cada card comunica que miran cosas distintas.

**Filas condicionales.** Las filas "Ingresos" y "Gastos" SHALL mostrarse siempre. Los reintegros recibidos se pliegan dentro de "Ingresos" (sin barra propia). Las filas "Ajustes", "Pago de tarjeta", "Liquidaciones" y "Cambio de moneda" SHALL mostrarse **solo cuando el mes tiene ese movimiento** (balde con monto ≠ 0), para no ensuciar la card de quien no los usa. Cada una con el mismo tratamiento visual (dot + label + monto + barra proporcional) y un tono propio que la distinga; los montos signados (Ajustes, Liquidaciones, Cambio de moneda) SHALL mostrarse con su signo.

Debajo de la fila "Ajustes", y solo cuando esa fila se muestra, la sección SHALL renderizar un **aviso educativo** (voz Grana, texto atenuado) que comunique que los ajustes son grana que se movió sin registrar y que la meta es hacerlos desaparecer registrando esos movimientos. El texto SHALL salir del catálogo i18n (`dashboard.month.adjustment_note`), sin string hardcodeado.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya disponible (web: server-rendered; nativo: el cache de TanStack del primer load) sin fetch adicional.

Los anchos de las barras SHALL calcularse de los datos: la magnitud mayor entre todas las filas presentes ocupa el 100% del track y las otras escalan proporcionalmente (`magnitud / maxFlow`), usando el valor absoluto de los baldes signados; con todas en cero, las barras quedan vacías. Los anchos NO SHALL hardcodearse. Ingresos usa el color emerald; Gastos el terracota; Ajustes el `warning`/ámbar; las demás filas un tono propio que las distinga.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda, incluyendo `totalAdjustment`, `totalCardPayment`, `totalReimbursement`, `totalSettlement` y `totalExchange`). La sección NO SHALL renderizar el gráfico de línea acumulada en ninguna plataforma: `MonthBalanceChart` no existe ni en `apps/web` ni en `apps/mobile` (la serie diaria sigue disponible en el package para vistas futuras). Todos los importes participan del eye-mask.

#### Scenario: El neto del mes reconcilia con el cambio del Disponible

- **WHEN** el mes (ARS) tiene ingresos $500.000, gastos reales $300.000 y un reintegro recibido a cuenta de $50.000
- **THEN** el neto del mes es `+$250.000` (= 500.000 − 300.000 + 50.000)
- **AND** ese neto es idéntico al cambio del Disponible del mes (que también cuenta el reintegro)
- **AND** el reintegro se cuenta dentro de la fila "Ingresos" (que muestra `$550.000`), sin barra propia

#### Scenario: Una cuenta archivada no aporta al neto del mes

- **WHEN** el usuario tiene una cuenta `type='bank'` con `is_active = false` que registró gastos en el mes seleccionado
- **THEN** esos gastos NO se cuentan en ninguna fila de "Balance del mes" ni en `finalBalance`
- **AND** el neto del mes sigue siendo idéntico al cambio del Disponible (que tampoco incluye esa cuenta)

#### Scenario: Una transferencia hacia una cuenta archivada se trata igual en las dos lentes

- **WHEN** el usuario transfiere ARS $100.000 desde una cuenta activa hacia una cuenta archivada
- **THEN** el Disponible baja $100.000 (la plata salió del universo de cuentas propias)
- **AND** "Balance del mes" refleja esa misma bajada de $100.000
- **AND** NO ocurre que la serie del mes netee la transferencia a cero mientras el Disponible sí se mueve

#### Scenario: El Disponible cuenta los reintegros recibidos y las liquidaciones

- **WHEN** el usuario tiene un reintegro recibido a cuenta y una liquidación de deuda que acreditan cuentas propias
- **THEN** el cálculo del Disponible (Hero) los incluye (de lo contrario `finalBalance` del mes no reconciliaría con el cambio del Disponible)
- **AND** la query del Disponible SHALL traer los campos que gobiernan esos tipos (`reimbursement_target`, `received_at`, `cancelled_at`, `settlement_direction`); omitir cualquiera los descarta silenciosamente

#### Scenario: Liquidaciones y cambios de moneda se contabilizan

- **WHEN** en ARS el usuario recibe una liquidación (`settlement in`) de $40.000 y hace un cambio de moneda comprando dólares por $120.000 (pata origen ARS)
- **THEN** la sección muestra una fila "Liquidaciones" en `+$40.000` y una fila "Cambio de moneda" en `−$120.000`
- **AND** el neto del mes incluye ambos efectos y reconcilia con el Disponible ARS
- **AND** en la serie USD, la pata destino del cambio aparece como "Cambio de moneda" en positivo

#### Scenario: El pago de resumen se rotula aparte y no infla Gastos

- **WHEN** el mes seleccionado tiene gasto real ARS $200.000 y un pago de resumen de tarjeta de ARS $150.000 (un `expense` sobre cash/bank vinculado a un `period_payments`)
- **THEN** la fila "Gastos" muestra `$200.000` (sin el pago de resumen)
- **AND** la sección muestra una fila aparte "Pago de tarjeta" en `$150.000`
- **AND** el neto del mes sigue restando los $150.000 (la plata salió de caja): `finalBalance` es idéntico al que daba contando el pago dentro de Gastos

#### Scenario: "Gastos" (CAJA) difiere de "En qué se fue" (CONSUMO) cuando hay tarjeta

- **WHEN** el mes tiene gasto de caja (efectivo/débito) por $254.461,25 y además consumos de tarjeta del mes por $460.892,38 (devengados)
- **THEN** "Gastos" de "Balance del mes" muestra `$254.461,25` (solo caja)
- **AND** "En qué se fue" muestra `$715.353,63` (devengado: incluye la tarjeta)
- **AND** los dos números difieren a propósito (lentes distintas) — NO es un error; la reconciliación que cuenta es `finalBalance` ↔ Disponible

#### Scenario: Neto positivo con barras proporcionales

- **WHEN** el mes seleccionado tiene ingresos ARS $800.000 y gastos ARS $295.500,25 y ningún otro movimiento de caja
- **THEN** el neto muestra `+$504.499,75` en emerald
- **AND** la barra de Ingresos ocupa el 100% del track y la de Gastos ~36,9%
- **AND** solo se renderizan las filas "Ingresos" y "Gastos"
- **AND** el strip USD muestra el neto USD del mes con su detalle de ingresos y gastos

#### Scenario: Gastos mayores que ingresos invierten la proporción

- **WHEN** el mes tiene ingresos ARS $100.000 y gastos ARS $250.000
- **THEN** el neto muestra `−$150.000` en tono expense
- **AND** la barra de Gastos ocupa el 100% y la de Ingresos el 40%

#### Scenario: Los ajustes no inflan Ingresos ni Gastos y se muestran en su balde

- **WHEN** el mes seleccionado tiene gasto real ARS $254.461,25, ingreso real ARS $7.349.361,79, ajustes que restan saldo por ARS $3.152.222,01 y ajustes que suman saldo por ARS $615.610,22
- **THEN** la fila "Gastos" muestra `$254.461,25` (solo gasto real, sin los ajustes)
- **AND** la fila "Ingresos" muestra `$7.349.361,79` (solo ingreso real)
- **AND** la fila "Ajustes" se muestra con el neto `−$2.536.611,79` y una barra ámbar proporcional (su ancho contra `maxFlow`)
- **AND** debajo de las barras aparece el aviso educativo (voz Grana) desde `dashboard.month.adjustment_note`
- **AND** el neto del mes es `$4.558.288,75` (= ingresos − gastos + ajustes), idéntico al cambio del Disponible

#### Scenario: Mes sin movimientos muestra ceros

- **WHEN** el mes seleccionado no tiene movimientos confirmados
- **THEN** el neto muestra `$0` y las barras quedan vacías
- **AND** solo se renderizan las filas "Ingresos" y "Gastos" (en cero); ninguna fila condicional aparece
- **AND** el strip USD muestra `US$0` con ingresos y gastos en cero

#### Scenario: El header de la card ancla el neto del mes en curso

- **WHEN** el usuario va `+$504.499,75` en el mes en curso y navega el selector a un mes anterior
- **THEN** el header de la card sigue mostrando "vas +$504.499,75 este mes" (mes en curso) mientras el cuerpo muestra el mes navegado
- **AND** activar el eye-mask enmascara ese monto

#### Scenario: Consumo en tarjeta no impacta el balance

- **WHEN** el usuario registra un consumo de $30.000 en su tarjeta en el mes
- **THEN** los totales del mes NO reflejan ese consumo
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) entra en la fila "Pago de tarjeta" en la fecha del pago, no en "Gastos"

#### Scenario: El chart de línea no existe en ninguna app

- **WHEN** se busca `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps
