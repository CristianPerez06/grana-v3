# dashboard — delta

## MODIFIED Requirements

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

La sección "Balance del mes" SHALL mostrar, para el mes seleccionado en el navegador compartido: un eyebrow "BALANCE" y debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense); debajo, las filas de flujo, cada una con dot de color + label + monto y una barra horizontal proporcional.

**Corte temporal (la sección cuenta lo que YA pasó).** La ventana de lectura de la sección SHALL ser `[primer día del mes, min(último día del mes, hoy_AR)]`, donde `hoy_AR` es la fecha calendario en `America/Argentina/Buenos_Aires` — el mismo "hoy" que corta el saldo (spec `accounts`, migración 0052), nunca el reloj del browser ni el timezone del servidor de base de datos. Una transacción de caja con `date > hoy_AR` existe y es visible en listados, pero NO SHALL aportar a ningún balde ni al neto del mes hasta que su fecha llegue. En consecuencia:

- un **mes pasado** se lee entero (todo en él ya ocurrió);
- el **mes en curso** se lee hasta hoy inclusive, de modo que sus totales crecen a medida que las fechas llegan;
- un **mes que todavía no empezó** SHALL dar una serie vacía (todos los baldes en cero), no un adelanto de lo cargado.

Esta sección es **CAJA pura** (lee solo filas on-ledger, `status IS NULL`), así que el corte SHALL aplicarse a todas sus filas sin excepción por tipo.

**Reconciliación con el Disponible (lente CAJA).** El neto del mes (`finalBalance`) SHALL reconciliar exactamente con el cambio del Disponible en ese mes: la sección SHALL contabilizar **todo** movimiento de caja del mes sobre cuentas propias aplicando los **mismos signos** que `calculateTransactionSums` (la fuente del Hero/Disponible), por moneda, sin combinar ARS con USD. El corte temporal SHALL ser el **mismo día** en ambos lados: el Disponible ya excluye las filas futuras, así que contarlas acá rompería la reconciliación en cualquier mes con movimientos fechados adelante.

**"Cuenta propia" es un único criterio en toda la app: `type IN ('cash','bank') AND is_active = true`.** El universo de cuentas de esta sección SHALL ser idéntico al del Hero/Disponible, sin excepción. Una cuenta **archivada** (`is_active = false`) NO SHALL aportar sus movimientos al neto del mes, porque su saldo tampoco está en el Disponible: contarla de un lado y no del otro rompe la reconciliación. El criterio NO SHALL replicarse a mano en cada query — SHALL derivarse de una única definición normativa compartida (ver spec `web-data-access`), de modo que Hero, "Dónde está", listado/detalle de cuentas y "Balance del mes" no puedan divergir por olvido. En consecuencia `finalBalance = totalIncome − totalExpense − totalCardPayment + totalAdjustment + totalReimbursement + totalSettlement + totalExchange + totalTransfer`, donde `totalTransfer` es el residuo de las transferencias con una sola pata propia (cero en el caso normal, ver más abajo). Ningún tipo de movimiento de caja SHALL descartarse: los reintegros recibidos a cuenta, las liquidaciones de deuda compartida y los cambios de moneda SHALL contabilizarse. Solo cuentan transacciones confirmadas (los consumos `pending` de tarjeta no entran, igual que siempre).

**Transferencias: cada pata se evalúa por separado.** Una `transfer` SHALL restar cuando su cuenta origen es propia y sumar cuando su cuenta destino lo es, evaluando cada condición de forma independiente — exactamente como `calculateTransactionSums`. Cuando **ambas** patas son cuentas propias el resultado neto es cero y la transferencia no mueve el neto del mes (comportamiento visible sin cambios). Cuando **solo una** pata es propia (la otra es una cuenta archivada), la transferencia SHALL contabilizarse por esa pata. El sistema NO SHALL descartar las transferencias de plano asumiendo que ambas patas son propias: esa suposición es la que hace divergir la serie del mes del Disponible.

Ese efecto vive en su propio balde `totalTransfer` (signado: la plata que sale del universo propio resta, la que entra suma). El balde NO SHALL renderizar una fila propia en la card: vale exactamente cero cuando las dos patas son propias — el caso normal —, así que una fila "Transferencias" mostraría siempre `$0` y ensuciaría la lectura. Existe para que la identidad de baldes siga cerrando contra `finalBalance` en vez de que el residuo aparezca como una diferencia sin explicación.

Cada tipo de movimiento de caja vive en su **balde propio**, con estas reglas de signo (idénticas a `calculateTransactionSums`):

- **Ingresos** (`income`): suma. Fila siempre visible.
- **Gastos** (`expense` que NO es pago de resumen): suma. Fila siempre visible.
- **Ajustes** (`adjustment`): signado (positivo sube el saldo, negativo lo baja). Corrección de stock, no flujo.
- **Pago de tarjeta** (`expense` vinculado a un `period_payments`): suma. Cancela deuda ya devengada, no es consumo nuevo.
- **Reintegros recibidos** (`reimbursement` con `reimbursement_target='account'`, `received_at` no nulo y `cancelled_at` nulo): es plata que vuelve a la cuenta, así que para la caja se cuenta como **ingreso** y se **pliega dentro de la fila "Ingresos"** (NO tiene barra propia). Suma al neto igual. Los reintegros pendientes, cancelados o "en resumen" NO entran (no tocan el Disponible).
- **Liquidaciones** (`settlement`): signado — `settlement_direction='in'` suma, `'out'` resta.
- **Cambio de moneda** (`exchange`): signado **por moneda** — en la serie ARS, la pata origen (la plata que sale de ARS) resta; en la serie USD, la pata destino (la que entra) suma. Reconcilia per-moneda porque es exactamente lo que hace `calculateTransactionSums`.

Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a "Ingresos" ni a "Gastos". El pago de resumen NO SHALL sumarse a "Gastos". La fila "Gastos" SHALL reflejar únicamente gasto **de caja** real (`type='expense'` sobre cuenta propia que NO es pago de resumen).

**"Gastos" (CAJA) NO coincide con "En qué se fue" (CONSUMO).** Son lentes distintas a propósito: "En qué se fue" es **devengado** e incluye el consumo de tarjeta (consumos + cuotas, por fecha de compra), mientras "Gastos" de Balance del mes es **caja** y solo cuenta lo que salió de una cuenta propia (efectivo/débito). La diferencia entre ambos es, justamente, el consumo de tarjeta del mes que aún no se pagó. Las dos lentes comparten el corte a hoy para su parte de caja, pero difieren en tarjeta: la cuota del mes ya devenga aunque su fecha no haya llegado (ver spec `spending-by-category`). La reconciliación que SHALL cumplirse es otra: `finalBalance` ↔ el cambio del **Disponible** (ver más arriba). El rótulo de la pregunta de cada card comunica que miran cosas distintas.

**Filas condicionales.** Las filas "Ingresos" y "Gastos" SHALL mostrarse siempre. Los reintegros recibidos se pliegan dentro de "Ingresos" (sin barra propia). Las filas "Ajustes", "Pago de tarjeta", "Liquidaciones" y "Cambio de moneda" SHALL mostrarse **solo cuando el mes tiene ese movimiento** (balde con monto ≠ 0), para no ensuciar la card de quien no los usa. Cada una con el mismo tratamiento visual (dot + label + monto + barra proporcional) y un tono propio que la distinga; los montos signados (Ajustes, Liquidaciones, Cambio de moneda) SHALL mostrarse con su signo.

Debajo de la fila "Ajustes", y solo cuando esa fila se muestra, la sección SHALL renderizar un **aviso educativo** (voz Grana, texto atenuado) que comunique que los ajustes son grana que se movió sin registrar y que la meta es hacerlos desaparecer registrando esos movimientos. El texto SHALL salir del catálogo i18n (`dashboard.month.adjustment_note`), sin string hardcodeado.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya disponible (web: server-rendered; nativo: el cache de TanStack del primer load) sin fetch adicional.

Los anchos de las barras SHALL calcularse de los datos: la magnitud mayor entre todas las filas presentes ocupa el 100% del track y las otras escalan proporcionalmente (`magnitud / maxFlow`), usando el valor absoluto de los baldes signados; con todas en cero, las barras quedan vacías. Los anchos NO SHALL hardcodearse. Ingresos usa el color emerald; Gastos el terracota; Ajustes el `warning`/ámbar; las demás filas un tono propio que las distinga.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda, incluyendo `totalAdjustment`, `totalCardPayment`, `totalReimbursement`, `totalSettlement`, `totalExchange` y `totalTransfer`). La serie diaria que ese read devuelve SHALL cubrir únicamente los días ya transcurridos del mes: un día que todavía no llegó NO SHALL emitirse como día de la serie, porque una línea plana en un día futuro se lee como "no gasté" en vez de "todavía no pasó". La sección NO SHALL renderizar el gráfico de línea acumulada en ninguna plataforma: `MonthBalanceChart` no existe ni en `apps/web` ni en `apps/mobile` (la serie diaria sigue disponible en el package para vistas futuras). Todos los importes participan del eye-mask.

#### Scenario: El neto del mes reconcilia con el cambio del Disponible

- **WHEN** el mes (ARS) tiene ingresos $500.000, gastos reales $300.000 y un reintegro recibido a cuenta de $50.000
- **THEN** el neto del mes es `+$250.000` (= 500.000 − 300.000 + 50.000)
- **AND** ese neto es idéntico al cambio del Disponible del mes (que también cuenta el reintegro)
- **AND** el reintegro se cuenta dentro de la fila "Ingresos" (que muestra `$550.000`), sin barra propia

#### Scenario: Un gasto fechado adelante no mueve el mes hasta que llega su fecha

- **WHEN** hoy es el 1 de agosto y el mes tiene únicamente gastos fechados del 8 al 31 (recurrencias sin confirmar, semillas futuras) por $1.992.743,78
- **THEN** "Balance del mes" muestra neto $0, con Ingresos $0 y Gastos $0
- **AND** esas transacciones siguen siendo visibles en el listado de movimientos
- **AND** el 8 de agosto el gasto de ese día entra al mes automáticamente, sin acción del usuario

#### Scenario: Un mes que todavía no empezó se muestra vacío

- **WHEN** hoy es el 1 de agosto y el usuario navega a septiembre, que ya tiene $115.542,97 de gastos cargados con fecha futura
- **THEN** todos los baldes muestran $0 y el neto es $0

#### Scenario: Un mes pasado se sigue leyendo entero

- **WHEN** hoy es el 1 de agosto y el usuario navega a julio
- **THEN** el neto de julio contabiliza sus movimientos hasta el 31 de julio inclusive, sin recorte
