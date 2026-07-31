## MODIFIED Requirements

### Requirement: Cada sección del dashboard rotula la pregunta que ayuda a responder

Cada sección del dashboard SHALL rotular la pregunta financiera humana que ayuda a responder, y esa pregunta SHALL quedar clara **en el mismo nivel de lectura donde se lee el importe principal** (título, label del monto, chip o lectura inmediata del bloque). El dashboard NO SHALL depender de subtítulos atenuados para corregir títulos ambiguos: si el título nombra una cosa y el subtítulo aclara que en realidad es otra, el usuario ya se fue con la lectura equivocada.

En consecuencia, cuando un monto sea **stock** (cuánto hay), **flujo** (cuánto se movió), **compromiso** (cuánto falta pagar) o **consumo devengado** (en qué se gastó, sin importar si ya salió de la cuenta), esa naturaleza SHALL ser inequívoca desde el rótulo principal.

Las preguntas por sección son:

- **Hero** — *cuánto hay hoy en las cuentas propias activas*. Es un **stock** de caja/banco. NO SHALL prometer que todo eso está libre para gastar ni descontar compromisos que todavía no estén modelados con confianza suficiente.
- **Dónde está** — *en qué cuentas está esa plata*. Es el **desglose auditable** del importe del Hero: existe para que el usuario pueda verificar de dónde sale el número y detectar cuentas cuyo saldo no coincide con la realidad. Un stock que no se puede auditar no se puede creer, y un número que no se cree no sostiene ninguna decisión.
- **Neto del mes** — *cuánto entró y salió durante el mes seleccionado*. Es un **flujo** de caja. NO SHALL rotularse con vocabulario de saldo.
- **Comprometido** — *qué obligaciones ya existen y siguen pendientes*.
- **En qué gasté** — *en qué se gastó durante el mes seleccionado*, incluyendo consumo de tarjeta **devengado** aunque todavía no haya salido de caja.

Cuando dos secciones midan lo mismo desde lentes distintas y por lo tanto muestren montos distintos, la sección donde nace la duda SHALL explicar la diferencia; el sistema NO SHALL dejar que el usuario la descubra por su cuenta.

#### Scenario: Un flujo mensual negativo no se confunde con una cuenta en negativo

- **WHEN** el mes seleccionado tiene más salidas que entradas y ninguna cuenta del usuario está en negativo
- **THEN** la sección del neto del mes muestra una lectura que explica que la diferencia salió de plata que el usuario ya tenía
- **AND** NO comunica ese número como el saldo actual de ninguna cuenta

#### Scenario: El saldo de cuentas no promete plata libre

- **WHEN** el usuario abre el dashboard
- **THEN** el Hero comunica que el importe es la suma de sus cuentas propias activas
- **AND** aclara que no descuenta lo que ya está comprometido

#### Scenario: Dos montos rotulados "gasto" no quedan sin conciliar

- **WHEN** el gasto de caja del mes difiere del consumo devengado del mes porque hubo consumo de tarjeta
- **THEN** la sección que muestra el monto menor explica la diferencia y ofrece el paso a la otra lente
- **AND** el usuario no necesita comparar las dos cards para descubrir que miden universos distintos

---

### Requirement: El Hero muestra el disponible total bimoneda

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor). Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

**El rótulo NO SHALL prometer gastabilidad.** El eyebrow y la caption SHALL comunicar que el importe es el **saldo de las cuentas propias al día de hoy** — un stock — y NO SHALL sugerir que ese monto está disponible para gastar. El monto no descuenta obligaciones ya asumidas (resúmenes con vencimiento próximo, recurrencias, gastos fijos), de modo que un rótulo del tipo "para gastar" sobrestima sistemáticamente el margen real. La caption SHALL declarar explícitamente esa limitación, de modo que el usuario conozca el alcance del número en lugar de descubrirlo por su cuenta. Los strings viven en `dashboard.hero.*`; la spec fija qué debe comunicar el rótulo, no las palabras.

**El Hero SHALL distinguir visualmente un disponible negativo.** Cuando el importe ARS es menor a cero, SHALL renderizarlo con un tratamiento distinto del positivo (tono propio, legible sobre el fondo navy) y SHALL acompañarlo de una línea que nombre el estado e **invite a corregir el registro**, no que acuse al usuario: un disponible negativo sostenido casi siempre significa que falta registrar un ingreso, no que la persona esté en descubierto. El texto SHALL salir del catálogo i18n. El importe positivo conserva el tratamiento actual. Es puramente presentacional: NO SHALL alterar el cálculo.

En **ambas plataformas**, el Hero SHALL renderizarse como una card oscura (navy de marca vía token — web: `surface-dark`; nativo: clase NativeWind del mirror — sin hex inline) con: eyebrow en uppercase, el importe ARS como titular grande con los decimales en tipografía reducida (`MaskedAmountDisplay`), la línea USD como chip "USD" + importe, y una caption al pie (vía i18n). El bloque eyebrow+importes SHALL centrarse verticalmente en el espacio sobre la caption cuando la card estira su altura. El Hero NO SHALL contener el desglose de cuentas: ese desglose vive en la card "Dónde está". Tocar el Hero navega al módulo Cuentas. Se respeta bimoneda (ARS primario, USD subordinado, sin merge entre monedas).

#### Scenario: Usuario con saldos en ambas monedas

- **WHEN** el usuario tiene una cuenta cash con $ 150.000 ARS + u$s 500 USD y una cuenta bank con $ 137.450 ARS + u$s 740,50 USD, sin pagos de resúmenes pendientes ya descontados
- **THEN** el Hero muestra `$ 287.450,00` en línea primaria y `u$s 1.240,50` en línea secundaria

#### Scenario: Consumo en tarjeta no reduce el disponible del Hero

- **WHEN** el usuario tiene $ 100.000 ARS disponibles y registra un consumo de $ 30.000 en su tarjeta Visa
- **THEN** el Hero sigue mostrando `$ 100.000,00`
- **AND** el consumo aparece en `/cards`

#### Scenario: Pago de resumen reduce el disponible

- **WHEN** el usuario paga el resumen de Visa por $ 145.200 desde una cuenta cash que tenía $ 287.450
- **THEN** el Hero pasa a mostrar `$ 142.250,00`

#### Scenario: El Hero es la card oscura sin desglose de cuentas

- **WHEN** el usuario carga el dashboard (web o nativo)
- **THEN** el Hero se pinta como card navy con su eyebrow en uppercase, el importe ARS grande y el chip USD
- **AND** el desglose por cuenta NO está dentro del Hero (vive en la card "Dónde está")
- **AND** el color navy proviene del token de tema, no de un hex inline

#### Scenario: El rótulo del Hero no promete gastabilidad

- **WHEN** el usuario tiene $3.109.291 en sus cuentas y, en los próximos 13 días, vencen un alquiler de $1.505.723, expensas por $678.506 y resúmenes de tarjeta por $985.201
- **THEN** el Hero muestra `$3.109.291` rotulado como el saldo de sus cuentas, NO como plata disponible para gastar
- **AND** la caption comunica que el monto no descuenta lo que ya está comprometido

#### Scenario: Disponible negativo se distingue del positivo

- **WHEN** el disponible ARS del usuario es `−$2.424.848,60`
- **THEN** el importe NO se renderiza con el mismo tratamiento visual que un disponible positivo
- **AND** el Hero muestra una línea que nombra el estado e invita a revisar si falta registrar un ingreso
- **AND** el cálculo del disponible no se altera (el tratamiento es presentacional)

---

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

La sección SHALL mostrar, para el mes seleccionado en el navegador compartido: un eyebrow, debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense), y debajo las filas de flujo, cada una con dot de color + label + monto y una barra horizontal proporcional.

**El rótulo SHALL nombrar un flujo, no un stock.** Ni el título de la card ni el label del importe grande SHALL usar vocabulario de saldo ("balance", "disponible", "total"): el número mide la **variación** de la plata del usuario durante el mes, no cuánta tiene. Un rótulo de stock sobre un número de flujo produce la lectura errónea de que un neto negativo implica cuentas en negativo, cuando lo normal es que se haya gastado más de lo que entró y la diferencia haya salido de lo que ya se tenía. La distinción NO SHALL delegarse a la línea de pregunta secundaria: el título tiene que sostenerla solo. Los strings viven en `dashboard.month.*`.

**Debajo del importe, la sección SHALL renderizar una línea de lectura** que interprete el signo en palabras y NO repita el monto: con neto positivo, que entró más de lo que se gastó y la diferencia quedó en las cuentas; con neto negativo, que se gastó más de lo que entró y la diferencia salió de lo que ya se tenía; en cero, una lectura neutral equivalente. El texto SHALL salir del catálogo i18n.

**Reconciliación con el Disponible (lente CAJA).** El neto del mes (`finalBalance`) SHALL reconciliar exactamente con el cambio del Disponible en ese mes: la sección SHALL contabilizar **todo** movimiento de caja del mes sobre cuentas propias aplicando los **mismos signos** que `calculateTransactionSums` (la fuente del Hero/Disponible), por moneda, sin combinar ARS con USD.

**"Cuenta propia" es un único criterio en toda la app: `type IN ('cash','bank') AND is_active = true`.** El universo de cuentas de esta sección SHALL ser idéntico al del Hero/Disponible, sin excepción. Una cuenta **archivada** (`is_active = false`) NO SHALL aportar sus movimientos al neto del mes, porque su saldo tampoco está en el Disponible: contarla de un lado y no del otro rompe la reconciliación. El criterio NO SHALL replicarse a mano en cada query — SHALL derivarse de una única definición normativa compartida (ver spec `web-data-access`), de modo que Hero, "Dónde está", listado/detalle de cuentas y esta sección no puedan divergir por olvido. En consecuencia `finalBalance = totalIncome − totalExpense − totalCardPayment + totalAdjustment + totalReimbursement + totalSettlement + totalExchange + totalTransfer`, donde `totalTransfer` es el residuo de las transferencias con una sola pata propia. Ningún tipo de movimiento de caja SHALL descartarse: los reintegros recibidos a cuenta, las liquidaciones de deuda compartida y los cambios de moneda SHALL contabilizarse. Solo cuentan transacciones confirmadas (los consumos `pending` de tarjeta no entran, igual que siempre).

**Transferencias: cada pata se evalúa por separado.** Una `transfer` SHALL restar cuando su cuenta origen es propia y sumar cuando su cuenta destino lo es, evaluando cada condición de forma independiente — exactamente como `calculateTransactionSums`. Cuando **ambas** patas son cuentas propias el resultado neto es cero y la transferencia no mueve el neto del mes. Cuando **solo una** pata es propia (la otra es una cuenta archivada), la transferencia SHALL contabilizarse por esa pata. El sistema NO SHALL descartar las transferencias de plano asumiendo que ambas patas son propias: esa suposición es la que hace divergir la serie del mes del Disponible.

Ese efecto vive en su propio balde `totalTransfer` (signado: la plata que sale del universo propio resta, la que entra suma). **El balde SHALL renderizar fila propia cuando su monto es distinto de cero**, con el mismo tratamiento condicional que el resto de las filas no permanentes. La regla anterior —que nunca renderizara fila, por valer cero en el caso normal— dejaba al usuario frente al único caso en el que el neto no se explica con lo visible: el residuo sin explicación no desaparecía, se mudaba del modelo de datos a la pantalla. Cuando vale cero (el caso normal), la fila no se renderiza y la lectura queda igual que antes.

Cada tipo de movimiento de caja vive en su **balde propio**, con estas reglas de signo (idénticas a `calculateTransactionSums`):

- **Ingresos** (`income`): suma. Fila siempre visible.
- **Gastos** (`expense` que NO es pago de resumen): suma. Fila siempre visible.
- **Ajustes** (`adjustment`): signado (positivo sube el saldo, negativo lo baja). Corrección de stock, no flujo.
- **Pago de resumen** (`expense` vinculado a un `period_payments`): suma. Cancela deuda ya devengada, no es consumo nuevo.
- **Reintegros recibidos** (`reimbursement` con `reimbursement_target='account'`, `received_at` no nulo y `cancelled_at` nulo): es plata que vuelve a la cuenta, así que para la caja se cuenta como **ingreso** y se **pliega dentro de la fila "Ingresos"** (NO tiene barra propia). Suma al neto igual. Los reintegros pendientes, cancelados o "en resumen" NO entran (no tocan el Disponible).
- **Liquidaciones** (`settlement`): signado — `settlement_direction='in'` suma, `'out'` resta.
- **Cambio de moneda** (`exchange`): signado **por moneda** — en la serie ARS, la pata origen (la plata que sale de ARS) resta; en la serie USD, la pata destino (la que entra) suma. Reconcilia per-moneda.
- **Transferencias** (`transfer` con una sola pata propia): signado.

Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a "Ingresos" ni a "Gastos". El pago de resumen NO SHALL sumarse a "Gastos". La fila "Gastos" SHALL reflejar únicamente gasto **de caja** real (`type='expense'` sobre cuenta propia que NO es pago de resumen).

**"Gastos" (CAJA) NO coincide con "En qué se fue" (CONSUMO).** Son lentes distintas a propósito: "En qué se fue" es **devengado** e incluye el consumo de tarjeta (consumos + cuotas, por fecha de compra), mientras "Gastos" es **caja** y solo cuenta lo que salió de una cuenta propia. La diferencia entre ambos es el consumo de tarjeta del mes que aún no se pagó, y SHALL quedar explicada dentro de esta misma sección (ver el requirement del puente caja → consumo). La reconciliación que SHALL cumplirse es otra: `finalBalance` ↔ el cambio del **Disponible**.

**Las filas SHALL agruparse por naturaleza, no listarse como iguales.** Renderizar los baldes con tratamiento visual idéntico (mismo dot, misma barra, mismo peso) afirma que son la misma clase de cosa, y no lo son. La sección SHALL distinguir tres naturalezas:

1. **Flujo real** — Ingresos y Gastos: plata que entró o salió del patrimonio del usuario. Es el grupo por defecto y NO requiere encabezado.
2. **Movimiento interno** — Pago de resumen, Cambio de moneda, Liquidaciones y Transferencias: plata que cambió de lugar o canceló deuda ya devengada, **sin que el usuario perdiera nada**. Este grupo SHALL llevar un encabezado que comunique justamente eso. Sin él, comprar dólares hunde el neto ARS y se pinta con el mismo tono que un gasto, comunicando una pérdida donde hubo un cambio de bolsillo.
3. **Corrección de stock** — Ajustes: no es flujo; es la app admitiendo una diferencia contra la realidad.

Los grupos 2 y 3 conservan el patrón de **fila condicional** (solo se renderizan con monto distinto de cero), para no ensuciar la card de quien no los usa. Los anchos de las barras SHALL derivarse de los datos (la magnitud mayor entre las filas presentes ocupa el 100% del track y las demás escalan por `magnitud / maxFlow`, usando el valor absoluto de los baldes signados) y NO SHALL hardcodearse; con todas en cero, las barras quedan vacías. Los montos signados SHALL mostrarse con su signo. Ingresos usa emerald; Gastos terracota; Ajustes `warning`/ámbar; las demás filas un tono propio que las distinga.

**Cada fila SHALL declarar su asterisco junto al label, no en un pie de card.** La sección SHALL usar el patrón de chip ya existente para comunicar, en el mismo nivel de lectura que el label: que "Gastos" no incluye el consumo con tarjeta, que el pago de resumen corresponde a consumos de meses anteriores, y que la fila de transferencias refleja movimientos fuera de las cuentas propias activas. Los textos SHALL salir del catálogo i18n.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda, incluyendo `totalAdjustment`, `totalCardPayment`, `totalReimbursement`, `totalSettlement`, `totalExchange` y `totalTransfer`). La sección NO SHALL renderizar el gráfico de línea acumulada en ninguna plataforma: `MonthBalanceChart` no existe ni en `apps/web` ni en `apps/mobile` (la serie diaria sigue disponible en el package para vistas futuras). Todos los importes participan del eye-mask.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya disponible (web: server-rendered; nativo: el cache de TanStack del primer load) sin fetch adicional.

#### Scenario: El rótulo nombra un flujo y la lectura interpreta el signo

- **WHEN** el mes seleccionado cierra con un neto de `−$2.684.140,02`
- **THEN** ni el título de la card ni el label del importe usan vocabulario de saldo ("balance", "disponible", "total")
- **AND** debajo del importe aparece una línea que explica que se gastó más de lo que entró y que la diferencia salió de lo que el usuario ya tenía
- **AND** esa línea NO repite el monto: lo interpreta

#### Scenario: Las filas se agrupan por naturaleza

- **WHEN** el mes tiene ingresos, gastos, un pago de resumen y un cambio de moneda
- **THEN** Ingresos y Gastos se renderizan como grupo por defecto, sin encabezado
- **AND** Pago de resumen y Cambio de moneda se renderizan bajo un encabezado que comunica que esa plata cambió de lugar y no se perdió
- **AND** Ajustes, si el mes tiene, se renderiza separado de los dos grupos anteriores

#### Scenario: Comprar dólares no se lee como una pérdida

- **WHEN** el usuario compra dólares por ARS $120.000 y el mes no tiene otros movimientos internos
- **THEN** la fila "Cambio de moneda" muestra `−$120.000` dentro del grupo de movimiento interno
- **AND** el encabezado de ese grupo comunica que la plata cambió de lugar sin perderse
- **AND** el neto del mes sigue incluyendo ese efecto y reconciliando con el Disponible ARS
- **AND** en la serie USD, la pata destino aparece como "Cambio de moneda" en positivo

#### Scenario: La fila de transferencias aparece cuando el balde no es cero

- **WHEN** el usuario transfiere ARS $100.000 desde una cuenta activa hacia una cuenta archivada
- **THEN** la sección renderiza una fila "Transferencias" por `−$100.000` dentro del grupo de movimiento interno
- **AND** el neto del mes refleja esa bajada y sigue reconciliando con el cambio del Disponible
- **AND** la suma de las filas visibles explica el neto, sin residuos sin rotular

#### Scenario: Con las dos patas propias la fila de transferencias no aparece

- **WHEN** todas las transferencias del mes ocurren entre cuentas propias activas
- **THEN** `totalTransfer` vale cero y la fila "Transferencias" NO se renderiza
- **AND** la lectura de la card es idéntica a la que tenía antes de existir el balde

#### Scenario: Las filas declaran su asterisco junto al label

- **WHEN** el mes tiene gasto de caja y un pago de resumen de tarjeta
- **THEN** la fila "Gastos" lleva un chip que comunica que no incluye el consumo con tarjeta
- **AND** la fila de pago de resumen lleva un chip que comunica que corresponde a consumos de meses anteriores
- **AND** ambos textos provienen del catálogo i18n

#### Scenario: El neto del mes reconcilia con el cambio del Disponible

- **WHEN** el mes (ARS) tiene ingresos $500.000, gastos reales $300.000 y un reintegro recibido a cuenta de $50.000
- **THEN** el neto del mes es `+$250.000` (= 500.000 − 300.000 + 50.000)
- **AND** ese neto es idéntico al cambio del Disponible del mes (que también cuenta el reintegro)
- **AND** el reintegro se cuenta dentro de la fila "Ingresos" (que muestra `$550.000`), sin barra propia

#### Scenario: Una cuenta archivada no aporta al neto del mes

- **WHEN** el usuario tiene una cuenta `type='bank'` con `is_active = false` que registró gastos en el mes seleccionado
- **THEN** esos gastos NO se cuentan en ninguna fila ni en `finalBalance`
- **AND** el neto del mes sigue siendo idéntico al cambio del Disponible

#### Scenario: Una transferencia hacia una cuenta archivada se trata igual en las dos lentes

- **WHEN** el usuario transfiere ARS $100.000 desde una cuenta activa hacia una cuenta archivada
- **THEN** el Disponible baja $100.000
- **AND** la sección refleja esa misma bajada
- **AND** NO ocurre que la serie del mes netee la transferencia a cero mientras el Disponible sí se mueve

#### Scenario: El Disponible cuenta los reintegros recibidos y las liquidaciones

- **WHEN** el usuario tiene un reintegro recibido a cuenta y una liquidación de deuda que acreditan cuentas propias
- **THEN** el cálculo del Disponible (Hero) los incluye
- **AND** la query del Disponible SHALL traer los campos que gobiernan esos tipos (`reimbursement_target`, `received_at`, `cancelled_at`, `settlement_direction`)

#### Scenario: Liquidaciones y cambios de moneda se contabilizan

- **WHEN** en ARS el usuario recibe una liquidación (`settlement in`) de $40.000 y compra dólares por $120.000 (pata origen ARS)
- **THEN** la sección muestra una fila "Liquidaciones" en `+$40.000` y una fila "Cambio de moneda" en `−$120.000`, ambas en el grupo de movimiento interno
- **AND** el neto del mes incluye ambos efectos y reconcilia con el Disponible ARS

#### Scenario: El pago de resumen se rotula aparte y no infla Gastos

- **WHEN** el mes seleccionado tiene gasto real ARS $200.000 y un pago de resumen de tarjeta de ARS $150.000
- **THEN** la fila "Gastos" muestra `$200.000` (sin el pago de resumen)
- **AND** la sección muestra una fila aparte de pago de resumen en `$150.000`, dentro del grupo de movimiento interno
- **AND** el neto del mes sigue restando los $150.000

#### Scenario: "Gastos" (CAJA) difiere de "En qué se fue" (CONSUMO) cuando hay tarjeta

- **WHEN** el mes tiene gasto de caja por $2.726.350,40 y además consumos de tarjeta del mes por $574.580,63 (devengados)
- **THEN** la fila "Gastos" muestra `$2.726.350,40` (solo caja)
- **AND** "En qué se fue" muestra `$3.300.931,03` (devengado: incluye la tarjeta)
- **AND** los dos números difieren a propósito (lentes distintas) — NO es un error
- **AND** la diferencia queda explicada dentro de esta misma sección

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

- **WHEN** el mes tiene gasto real ARS $254.461,25, ingreso real ARS $7.349.361,79, ajustes que restan saldo por ARS $3.152.222,01 y ajustes que suman saldo por ARS $615.610,22
- **THEN** la fila "Gastos" muestra `$254.461,25` y la fila "Ingresos" `$7.349.361,79`
- **AND** la fila "Ajustes" se muestra con el neto `−$2.536.611,79` y una barra ámbar proporcional, separada de los otros dos grupos
- **AND** debajo aparece el aviso desde `dashboard.month.adjustment_note`
- **AND** el neto del mes es `$4.558.288,75`, idéntico al cambio del Disponible

#### Scenario: Mes sin movimientos muestra ceros

- **WHEN** el mes seleccionado no tiene movimientos confirmados
- **THEN** el neto muestra `$0` y las barras quedan vacías
- **AND** solo se renderizan las filas "Ingresos" y "Gastos" (en cero); ninguna fila condicional aparece
- **AND** el strip USD muestra `US$0` con ingresos y gastos en cero

#### Scenario: El header de la card ancla el neto del mes en curso

- **WHEN** el usuario va `+$504.499,75` en el mes en curso y navega el selector a un mes anterior
- **THEN** el header sigue mostrando "vas +$504.499,75 este mes" mientras el cuerpo muestra el mes navegado
- **AND** activar el eye-mask enmascara ese monto

#### Scenario: Consumo en tarjeta no impacta el balance

- **WHEN** el usuario registra un consumo de $30.000 en su tarjeta en el mes
- **THEN** los totales del mes NO reflejan ese consumo
- **AND** cuando pague el resumen correspondiente, ese pago entra en la fila de pago de resumen en la fecha del pago, no en "Gastos"

#### Scenario: El chart de línea no existe en ninguna app

- **WHEN** se busca `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps

---

### Requirement: El dashboard muestra cuánto del gasto del mes se financió en tarjeta

Para explicar por qué "Gastos" (caja) es menor que el total gastado, el dashboard SHALL mostrar el puente **caja → consumo** **al pie de la sección del neto del mes** (la misma card que muestra la fila "Gastos"), **solo cuando el mes tuvo consumo de tarjeta** (financiado > 0). El puente NO SHALL renderizarse como card independiente del stack: la confusión nace en la card de caja —viendo un número más chico del que se gastó— y ahí es donde tiene que resolverse. Renderizarlo como bloque hermano obliga al usuario a descubrir por su cuenta que dos montos rotulados "gasto" se refieren a lo mismo desde lentes distintas.

El puente SHALL conectar los tres números: el **total gastado** del mes (devengado, el mismo total de "¿En qué gasté este mes?"), lo que **salió de caja** (la fila "Gastos" de la misma card), y lo **financiado en tarjeta**, donde `financiado = total_devengado − gasto_de_caja` (de modo que `total = caja + financiado` cierra por construcción). SHALL aclarar que lo financiado **"se paga en los próximos resúmenes"** (no que ya se pagó), con texto del catálogo i18n, y SHALL ofrecer el paso a "¿En qué gasté este mes?" para ver el desglose de la lente devengada.

El puente SHALL seguir el navegador de mes (refiere al mes seleccionado) y SHALL reusar las **mismas query keys** que el neto del mes y "¿En qué gasté?" (TanStack dedupea, sin fetch nuevo). Los importes participan del eye-mask. En viewports angostos (y en mobile) el puente SHALL apilar sus elementos en una columna. Cuando el mes NO tuvo consumo de tarjeta, el puente NO SHALL renderizarse.

#### Scenario: El puente cierra la brecha dentro de la card de caja

- **WHEN** el mes tiene gasto de caja $2.726.350,40 y el total devengado es $3.300.931,03
- **THEN** al pie de la card del neto del mes aparece el puente indicando `$574.580,63` financiados en tarjeta
- **AND** aclara que eso se paga en los próximos resúmenes
- **AND** ofrece el paso a "¿En qué gasté este mes?"
- **AND** los tres montos cierran: `3.300.931,03 = 2.726.350,40 + 574.580,63`

#### Scenario: El puente no es una card suelta del stack

- **WHEN** el usuario recorre el Inicio con consumo de tarjeta en el mes
- **THEN** NO existe una card independiente entre el neto del mes y "¿En qué gasté?" dedicada al reparto caja/tarjeta
- **AND** esa información vive al pie de la card del neto del mes

#### Scenario: Sin consumo de tarjeta el puente no aparece

- **WHEN** el total devengado del mes es igual al gasto de caja (no hubo consumo de tarjeta)
- **THEN** el puente NO se renderiza

#### Scenario: El puente apila en mobile

- **WHEN** el usuario abre un viewport web de 375px con consumo de tarjeta en el mes
- **THEN** el puente apila sus elementos en una columna, sin desbordar

---

### Requirement: La fila "Ajustes" de "Balance del mes" marca el monto como sin registrar

Cuando la fila "Ajustes" se muestra (el mes tiene ajustes), la sección SHALL acompañar el monto con un **chip** (tono ámbar/warning, uppercase) y un aviso debajo de las barras. Ambos textos SHALL salir del catálogo i18n (`dashboard.month.adjustment_unregistered` y `dashboard.month.adjustment_note`), sin string hardcodeado.

**El encuadre SHALL ser de reconciliación, no de reproche.** El ajuste es el mecanismo con el que la app se sincroniza con la realidad: el copy SHALL explicar que un ajuste es la diferencia entre lo que Grana calculó y lo que el usuario tiene de verdad, y SHALL presentar el ajustar periódicamente como la conducta sana que mantiene los números honestos. El copy NO SHALL presentar los ajustes como una falta a eliminar ni pedir que el usuario los "haga desaparecer": desincentivar el ajuste desincentiva la única conducta que impide que el ledger se desincronice en silencio.

El chip NO SHALL alterar el cálculo del monto ni del neto del mes; es puramente presentacional. El monto de Ajustes sigue participando del eye-mask.

#### Scenario: La fila Ajustes muestra el chip y el aviso

- **WHEN** el mes seleccionado tiene ajustes y la fila "Ajustes" está visible
- **THEN** junto al monto neto de Ajustes aparece un chip en tono ámbar
- **AND** debajo de las barras aparece el aviso desde `dashboard.month.adjustment_note`
- **AND** ambos textos provienen del catálogo i18n

#### Scenario: El copy encuadra el ajuste como reconciliación

- **WHEN** el usuario lee el aviso de la fila "Ajustes"
- **THEN** el texto explica que un ajuste es la diferencia entre lo calculado y lo real
- **AND** presenta el ajustar periódicamente como algo sano
- **AND** NO pide que el usuario haga desaparecer los ajustes ni los presenta como una falta

#### Scenario: Sin ajustes no hay chip

- **WHEN** el mes seleccionado no tiene ajustes (la fila "Ajustes" no se muestra)
- **THEN** el chip no se renderiza
