# Design: add-partial-and-usd-statement-payments

Decisiones cerradas, con su porqué. Lo que ya está decidido sobre el ciclo de vida del resumen
(cuatro fechas, período estimado eager, confirmación al pagar) no se revisa acá: vive en
`openspec/specs/cards/spec.md` y esta change lo respeta.

> **Alcance recortado a pago TOTAL multimoneda.** La versión original de este documento cubría
> también pagos parciales y pago mínimo. Se separaron: primero se arregla el bug de producción
> —pagar un resumen mixto en las dos monedas— y los parciales van en una change aparte.
>
> El **modelo no cambió**: patas, grupo de pago, identidad de monto y triggers son los mismos, y son
> los que hacen falta igual para pagar en dos monedas. Lo que cambia es una condición del camino de
> escritura (D11): la operación tiene que saldar el resumen. Las decisiones que quedaron fuera de
> alcance siguen acá marcadas como **DIFERIDA**, porque explican por qué el modelo tiene la forma
> que tiene y son la base de la change que sigue — borrarlas obligaría a redescubrirlas.
>
> **Revisión externa aplicada.** D1, D2, D6, D8 y D11 fueron ajustados, y D12–D15 agregados, después
> de una revisión que encontró tres defectos verificados contra el código: `.maybeSingle()` sobre
> `period_payments` (rompe con dos patas), el as-of del dashboard (un parcial borraría el remanente)
> y un escenario de spec que reasignaba consumos backdated en lugar de rechazarlos. El detalle está
> en cada decisión.

## D0 — El pago de un resumen es una serie de patas, no un evento

Una **pata de pago** es una fila de `period_payments` que dice: *esta transacción cancela `X` de la
deuda en `<moneda>` de este resumen*. Un resumen puede tener una pata (el caso de hoy), dos (pesos
por un lado, dólares por el otro) o muchas (mínimo hoy, resto en tres semanas).

Es el cambio de forma que habilita las dos funcionalidades con un solo modelo, y no es una
generalización especulativa: las dos ya fueron pedidas, y ninguna se puede expresar sin esto.

## D1 — Cada pata declara qué cancela; no hay regla de imputación implícita

Cinco columnas nuevas en `period_payments`:

| Columna | Qué dice |
|---|---|
| `payment_group_id` | Qué patas se crearon en una misma operación del usuario (D8) |
| `settles_currency` | La moneda de la **deuda del resumen** que esta pata cancela (`ARS` \| `USD`) |
| `settles_amount` | Cuánto de esa deuda cancela, en esa moneda |
| `fx_rate_to_ars` | La cotización usada, en el único cruce de monedas permitido |
| `settlement_known` | `false` en los pagos anteriores a esta change (ver D9) |

`transaction_id` sigue apuntando al gasto real, **en la moneda de la que sale el dinero**. Los dos
datos son distintos y ninguno se deriva del otro: pagar US$ 500 del resumen desde una cuenta en
pesos a 1.230,50 es una transacción de $615.250 en ARS y una pata de `USD 500`.

**Los cruces de moneda son una whitelist, no un principio general** (ajuste de la revisión: la
formulación anterior —"cuando el dinero sale en una moneda distinta de la que cancela"— admitía
cruces que no queremos):

| Moneda de la transacción | `settles_currency` | v1 | `fx_rate_to_ars` |
|---|---|---|---|
| ARS | ARS | ✓ | nula |
| USD | USD | ✓ | nula |
| ARS | USD | ✓ | **requerida** |
| USD | ARS | ✗ rechazado | — |

Pagar deuda en pesos con dólares no es un pago: es un canje, y Grana ya tiene el movimiento
`exchange` para eso. Habilitarlo acá sería esconder una conversión dentro de un pago de tarjeta.

**La cotización tiene que ser coherente en los dos lados.** Cuando una pata pesifica, su
`fx_rate_to_ars` debe coincidir con el `fx_rate_to_ars` que persiste su transacción — que ya se
guarda hoy para trazabilidad—, y si una misma transacción tiene **varias** allocations pesificadas,
todas deben compartir la misma cotización: es un solo débito, hecho un solo día, a un solo tipo de
cambio. Dos cotizaciones distintas dentro del mismo gasto no describen nada real, y dejan un detalle
que se puede auditar solo a medias.

**Esa tabla NO se puede validar con un `CHECK`.** Decidir el cruce exige leer
`transactions.currency_code`, que vive en otra tabla, y un `CHECK` no cruza tablas. El `CHECK` local
cubre lo que se ve desde la fila —nullability, `settlement_known`, montos positivos—; el cruce lo
valida el trigger de D11.

**Una transacción PUEDE tener más de una pata, y `transaction_id` NO es único.** Es deliberado y
resuelve el caso que ya existe hoy: pagar todo en pesos un resumen mixto es **un solo débito
bancario**, que cancela deuda en pesos y deuda en dólares pesificada. Con `UNIQUE(transaction_id)`
ese pago tendría que partirse en dos gastos en ARS y el usuario vería dos filas donde el banco le
muestra una. Al revés funciona: un gasto, dos patas, y el detalle del movimiento muestra la
imputación por moneda.

De ahí sale una identidad que hoy no existe: **el monto de la transacción es igual a la suma de sus
patas, expresadas en su moneda**. Una pata que pesifica aporta exactamente
`round(settles_amount × fx_rate_to_ars, 2)`, y el redondeo NO es un detalle: `fx_rate_to_ars` es
`numeric(18,6)` y el producto tiene que aterrizar en los `numeric(18,2)` del monto, o la igualdad es
inalcanzable por centavos fantasma. La regla se fija a la del sistema: `Money.multiply` es
`toDecimalPlaces(2)` sobre decimal.js sin configuración global, o sea `ROUND_HALF_UP`, y el
`round(numeric, 2)` de Postgres redondea medio hacia afuera del cero — para montos positivos, que es
todo lo que hay acá, son la misma función. TS y SQL dan el mismo centavo.
Hoy el "monto a pagar" es un campo libre que puede no coincidir con nada: se sugiere el total y el
usuario puede editarlo a un número que no corresponde a ninguna deuda. Con patas, el monto pasa a
estar **derivado** de lo que se declara cancelar, que es lo que lo vuelve auditable. Pagar de menos
sigue siendo posible —es una pata más chica—; pagar de más no, porque el piso de D11 rechaza una
pata mayor que el pendiente.

La alternativa a declarar la imputación era guardar solo el gasto y deducir qué canceló. No se puede
sin inventar una regla: con un resumen que debe $100.000 y US$ 200, un pago de $150.000 podría estar
cancelando todos los pesos y parte de los dólares, o pesos de más contra un saldo a favor. Cualquier
regla que elijamos va a estar mal para alguien, y el usuario **ya sabe** la respuesta cuando paga.
Se la preguntamos.

Ese mismo dato es lo que hace que el pago mixto (parte de los dólares en dólares, el resto en pesos)
no necesite modelo nuevo: son dos patas con `settles_currency='USD'`, una desde cada cuenta.

## D2 — `has_payment` sigue significando "saldado", y eso es lo que abarata la change

`period_id` deja de ser UNIQUE para que un resumen pueda tener varias patas — los pesos y los
dólares del mismo pago. Pero como **toda operación tiene que dejar el resumen en cero** (D11), no
puede existir una fila de pago sin cobertura total. Entonces:

```
pendiente(moneda) = Σ consumos − Σ reintegros recibidos − Σ patas que cancelan esa moneda

has_payment  ⟺  el resumen está saldado        ← sigue siendo cierto
```

Ese booleano lo leen `derivePeriodStatus`, `computePeriodAmounts`, `classifyPeriodsLifecycle`, el
hero de `/cards`, `getCardsMonthSummary` y los compromisos del dashboard. Mientras siga siendo
verdadero, **ninguno de esos call sites se toca** — y ahí está el grueso del riesgo que esta change
evita.

Lo que lo protege no es una convención: es el rechazo `GRN04` del RPC. Un pago que cancela solo los
pesos de un resumen mixto dejaría deuda en dólares viva con `has_payment` en true, y el booleano
mentiría en todas esas pantallas a la vez. Esa es exactamente la trampa de "permitamos dos pagos
sueltos y después vemos".

**Con parciales esto deja de valer**, y por eso son otra change: ahí `has_payment` se parte en
`settlement` (`unpaid | partial | settled`) para deuda y estado, y `hasAnyPayment` para lo que
depende de que ya haya habido un pago. Los ~9 call sites se migran entonces, no ahora.

**Un consumo backdated en un resumen pagado se RECHAZA**, como hoy. `getOrCreatePeriodForDate`
(`internal/card-periods.ts:123`) tira `CardConsumoInPaidPeriodError` y su comentario dice por qué:
fabricar un período frontera "was the bug that dumped past-dated consumos into far-future
statements". Esto no cambia.


## D3 — El remanente se queda en el resumen que lo generó  ·  **DIFERIDA**

> Fuera del alcance de esta change. Sin pagos parciales no hay remanente. La decisión queda registrada porque es la que descarta el cargo sintético de "saldo anterior", y vale igual cuando entren los parciales.

La opción descartada era generar un cargo "Saldo anterior impago" en el resumen siguiente, como lo
imprime el banco.

| | Calca el papel | Duplica deuda | Ensucia analíticas |
|---|---|---|---|
| Cargo en el resumen siguiente | Sí | Sí — las mismas compras contadas en dos resúmenes | Sí — una transacción que hay que excluir a mano de todo cálculo de gasto, para siempre |
| **Remanente en el resumen viejo** | No | No | No |

El desempate no es la fidelidad al papel: es que la regla *"la deuda de un resumen es la suma de sus
consumos impagos"* ya sostiene cada número del módulo. Meterle una excepción —una transacción que es
deuda pero no es consumo, y que no debe contar como gasto— es exactamente el tipo de regla implícita
que este rebuild existe para no volver a tener.

Lo que se pierde es que la pantalla no calca el resumen de papel del mes siguiente. Se compensa con
copy: el resumen parcial dice cuánto resta y avisa que el banco lo va a financiar.

## D4 — Los consumos pasan a `paid` recién cuando la última pata cubre el resumen  ·  **DIFERIDA**

> Fuera del alcance de esta change. Con pago total, la operación siempre salda, así que el barrido siempre ocurre. La regla —el barrido depende de la cobertura, no de que exista un pago— ya está implementada así en el RPC y es lo que hace que los parciales después no la toquen.

Con cobertura parcial no hay forma honesta de decir **cuáles** consumos se pagaron: el pago es
contra el total, no contra líneas. Así que el barrido no se parte: mientras el resumen esté
`partial`, todos sus consumos siguen en `pending`, y `status` se mantiene binario y verdadero a
nivel agregado.

Que sigan `pending` no infla ninguna deuda: `computePeriodAmounts` ya resta las patas.

## D5 — El sello y las fechas del ciclo se piden solo en la primera pata

Los dos son datos que se leen del **resumen de papel**, no del pago: la primera vez que el usuario
lo tiene en la mano es cuando registra el primer pago, y no cambian porque después pague el resto.
La condición es `hasAnyPayment`, no `settlement` (D2).

En consecuencia, `next_end_date` / `next_due_date` son requeridos solo en la primera pata, y el
sello se registra —y la alícuota se aprende— solo ahí.

El sello se inserta como consumo `pending` del resumen y, como cualquier consumo, **sube la deuda**.
Es correcto: es un cargo del resumen, no del pago. Quien paga el mínimo lo ve sumado a lo que resta.

## D6 — La cotización es obligatoria solo en el cruce ARS→deuda USD

Regla exacta, por pata: `fx_rate_to_ars` es requerida ⟺ `settles_currency = 'USD'` y la transacción
está en ARS. Es la única fila con cotización de la tabla de D1, y los demás cruces se rechazan.

Una pata que paga dólares con dólares no lleva cotización — **no hay conversión**, y pedirla sería
inventar un dato.

El invariante I-CRED-11 ya lo admite tal como está (migración `0027`): un gasto no-crédito acepta
`fx_rate_to_ars` nulo y exige `> 0` cuando está presente. No hace falta tocar el trigger.

## D7 — La tabla de patas resuelve sola el listado de movimientos

Vale registrarlo porque fue lo que descartó la alternativa "una columna `usd_transaction_id`".

`get_movements_page` resuelve el tipo `card_payment` y la protección de borrado con
`period_payments.transaction_id = t.id`. Con una tabla de patas, **todo gasto de pago tiene al menos
una fila que lo señala** —el de pesos y el de dólares por igual—: los dos se muestran como "Pago de
resumen" y los dos quedan protegidos por el FK `RESTRICT`, sin tocar el RPC. Con una segunda columna, en cambio, había que agregar
`or xp.usd_transaction_id = t.id` en tres lugares, y olvidarse de uno dejaba la pata en dólares como
un gasto suelto sin categoría **y borrable**.

**En el listado, una fila es una transacción, no una pata.** Los dos casos se leen distinto y está
bien que así sea: pagar los pesos desde la cuenta en pesos y los dólares desde la cuenta en dólares
son **dos débitos reales** y salen como dos filas, una por moneda; pagar todo en pesos un resumen
mixto es **un débito** y sale como una fila, con sus dos imputaciones en el detalle. La lista refleja
lo que pasó en las cuentas; el detalle, cómo se imputó. En ninguno de los dos casos hay un número
que mezcle monedas.

## D8 — Deshacer opera por grupo de pago, en orden determinístico

Una operación del usuario puede crear **dos** patas (los pesos y los dólares del mismo resumen). Por
eso "deshacer el último pago" no puede significar "deshacer la última pata": desharía media
operación y dejaría al usuario con un pago a medias que él nunca hizo así (ajuste de la revisión).

`payment_group_id` marca las patas nacidas de una misma operación. `revert_card_period_payment(p_period_id, p_group_id default null)`:

- **sin `p_group_id`** → revierte todas las patas del resumen. Es "Deshacer pago", lo que la UI
  ofrece hoy.
- **con `p_group_id`** → revierte ese grupo completo, y solo si es el más reciente del resumen.
  Sirve para corregir el pago de hoy sin desarmar el mínimo que pagaste hace tres semanas.

El orden es `(created_at, id)`, nunca `created_at` solo: dos patas del mismo grupo comparten el
timestamp, y sin el desempate por `id` el "más reciente" no está definido.

El barrido `paid → pending` corre solo si el resumen estaba `settled`. El sello se borra solo cuando
se revierte el grupo que lo trajo (el primero) o todo. Las fechas confirmadas y la alícuota aprendida
siguen sin revertirse, por el motivo de siempre: son hechos del resumen, no del pago.

La guarda cronológica se relaja del booleano a `hasAnyPayment`: **no se puede deshacer un pago si un
resumen posterior de la misma tarjeta tiene patas** (antes: "está pagado"). Un parcial posterior
bloquea igual que uno saldado.

## D9 — Los pagos viejos se marcan, no se adivinan

`settlement_known boolean not null default true`, con un backfill que pone `false` en todas las filas
existentes. Una pata con `settlement_known=false` **satura el resumen**: se lee como pago del saldo
total, que es exactamente lo que era.

Un CHECK exige que `settles_currency` y `settles_amount` estén presentes ⟺ `settlement_known=true`.

`payment_group_id` nace `NOT NULL`, así que las filas viejas necesitan uno: se backfillea
determinísticamente con `payment_group_id = id`. Cada pago legacy es su propio grupo de una sola
pata, que es exactamente lo que era.

Backfillear los montos sería adivinar: en un pago viejo de un resumen mixto, cuánto de esa expensa en
pesos canceló dólares depende de una cotización que se guardó en la transacción solo a veces. El
precedente es `stamp_tax_link_known` (migración `0050`), por la misma razón y con el mismo resultado:
marcar lo que no se sabe es barato, adivinarlo es una corrupción silenciosa.

## D10 — El pago mínimo se persiste en el período, no en el pago  ·  **DIFERIDA**

> Fuera del alcance de esta change. El pago mínimo es la feature diferida. Las columnas NO se crean en esta migración.

`card_periods.minimum_payment_ars` / `minimum_payment_usd`, nullables. Es un dato **del resumen**
—el banco lo imprime en el extracto— y sobrevive al pago: sirve para el chip del formulario, para
mostrarlo en el detalle del resumen a pagar, y para avisar cuando lo que se está por pagar queda por
debajo.

Nullable sin default: la enorme mayoría de los resúmenes se paga entero y nunca se carga. Un cero no
es lo mismo que "no lo cargué".

## D11 — El piso de cobertura vive en la base, no en la action

Ninguna pata puede exceder el saldo pendiente de su moneda. **Ese control no puede vivir solo en la
action** (ajuste de la revisión, y es el hallazgo más importante de las dos rondas de diseño).

Hoy `UNIQUE(period_id)` hace de red anti-doble-pago: la action chequea que no exista pago y, si dos
pedidos concurrentes pasan ese chequeo, el índice mata al segundo en el INSERT. Al sacar el UNIQUE
(D2) esa red desaparece, y `sum(patas) <= pendiente` validado en TS es un TOCTOU clásico: web y
mobile leen el mismo pendiente, los dos validan, los dos insertan, y el resumen queda pagado de más
sin que nada lo note.

Y hay una segunda mitad, que es la que sostiene D2: **ninguna operación puede dejar el resumen sin
saldar**. El trigger garantiza que ninguna pata se pase; el RPC garantiza que entre todas lleguen.
Sin eso, un pago de media moneda dejaría `has_payment` en true con deuda viva.

Las dos reglas son distintas a propósito: `pata ≤ pendiente` es del **modelo** y vive en el trigger;
`Σ operación = pendiente` es del **camino de escritura** y vive en el RPC (`GRN04`). Por eso el
modelo ya admite parciales aunque la app todavía no los ofrezca: habilitarlos es relajar la segunda,
no tocar la primera.

Dos capas, con propósitos distintos:

1. **Dos triggers sobre `period_payments`, con tiempos distintos**, porque no todos los invariantes
   se pueden verificar en el mismo momento:

   - **`BEFORE INSERT`, por fila** — toma `FOR UPDATE` sobre su `card_periods`, recalcula la
     cobertura y rechaza el exceso; valida el cruce de monedas contra `transactions.currency_code`
     (que un CHECK no puede ver, D1); y exige que las patas que **comparten una transacción**
     compartan también `period_id` y `payment_group_id` — sin eso, un mismo gasto podría quedar
     imputado a dos resúmenes distintos, que es la contracara fea de haber soltado
     `UNIQUE(transaction_id)`. Serializa los inserts concurrentes.
   - **`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`** — la identidad
     `monto = Σ patas` de D1. **No puede vivir en el `BEFORE INSERT`**: cuando se inserta la primera
     de dos patas de un mismo gasto, la suma todavía no llega al total y el pago legítimo sería
     rechazado. Diferido al COMMIT, la ve completa.

   Es el idioma del repo: `trg_fn_credit_transaction_invariants`,
   `trg_fn_reimbursement_invariants`.
2. **El RPC de D12**, que da atomicidad a la operación completa.

La validación en la action **se conserva**, pero cambia de rol: pasa a ser pre-validación de UX —un
mensaje que dice cuánto resta antes de intentar— y deja de ser la garantía contable.

Nada de esto es clamping en lectura, que está prohibido y sigue prohibido: es rechazo en el write
path. La lectura sigue mostrando lo que hay.

## D12 — El dinero se escribe en un RPC atómico; el calendario queda afuera

`pay_card_period_legs(...)`, `SECURITY DEFINER` con verificación de propiedad adentro (D13), hace en una sola
transacción: bloquea el `card_periods`, calcula la deuda por moneda, resta las patas existentes,
inserta las transacciones y sus patas, inserta el sello si corresponde, y barre `pending → paid`
**solo** si queda `settled`.

Reemplaza el rollback manual encadenado de `payCardPeriod`, que ya era frágil con una pata y con dos
sería peor: cada `return` de error tiene que acordarse de borrar todo lo insertado antes, a mano.

**El calendario NO entra en el RPC**, y esto es deliberado. Hoy la confirmación de fechas de P(n+1),
la re-proyección de P(n+2) y la reasignación de consumos corren **antes** del dinero, porque son
hechos leídos del resumen de papel: valen aunque el pago falle o se haya cargado mal. Está
documentado en el código y en el encabezado de la `0050`, y la reversión respeta la misma
asimetría. Meterlos en la transacción del dinero haría que un error de monto revierta fechas
confirmadas — perderíamos una decisión ya tomada. El calendario sigue en TS, antes del RPC.

## D13 — `period_payments` no se escribe directo: ni UPDATE, ni INSERT, ni DELETE

Una pata no se modifica: corregir un pago es deshacerlo y volver a registrarlo, que es lo que la UI
ya ofrece. Pero **quitar solo la policy de `UPDATE` deja la puerta de al lado abierta** (ajuste de
la revisión): con `DELETE` directo, un cliente REST borra la pata sin borrar su transacción, y queda
un gasto huérfano que deja de figurar como pago de tarjeta — encima liberando el FK `RESTRICT` que
es justamente lo que hoy impide borrar un pago desde el detalle del movimiento. La deuda del resumen
reaparece y la plata ya salió.

Así que `period_payments` queda **sin policies de escritura**: solo `SELECT`. Las dos operaciones
legítimas —registrar un pago y deshacerlo— pasan por sus RPC, que se vuelven `SECURITY DEFINER` con
verificación explícita de propiedad adentro.

Es un cambio respecto de la `0050`, que hizo la reversión `SECURITY INVOKER` a propósito y tiene un
self-check que falla si deja de serlo. El motivo de ese INVOKER era no darle a la función más
permisos que al usuario; acá el objetivo es el opuesto y deliberado: la función tiene que poder algo
que el usuario directo **no** debe poder. El precedente está en el repo: `reverse_settlement`
(`0023:329`) es `SECURITY DEFINER` por exactamente esta razón. El self-check de la `0050` se
actualiza en la misma migración, con el motivo escrito.

El trigger de cobertura de D11 **se conserva igual**, aunque ya no haya escritura directa: protege
contra un RPC con un bug, que es el escenario que queda. Defensa en profundidad, no redundancia.
## D14 — El as-of del dashboard se computa por cobertura, no por existencia  ·  **DIFERIDA**

> Fuera del alcance de esta change. Sin parciales, un pago anterior al corte sí significa saldado: la lectura actual del dashboard queda CORRECTA y no se toca. Vuelve a hacer falta cuando entren los parciales.

`getCommittedOutlook` (`dashboard/queries.ts:714`) arma hoy un `Set` de `period_id` "pagados al
corte" a partir de *cualquier* fila de pago con fecha ≤ snapshot, y saca esos períodos de los
compromisos.

Con patas eso miente en el caso exacto que esta change habilita: un pago mínimo anterior al corte
marcaría el resumen entero como pagado y le **borraría el remanente** de los compromisos (hallazgo
de la revisión, verificado). Pasa a computar la cobertura con las patas cuya
`transaction.date <= snapshotDate`, y el remanente sigue siendo compromiso.

## D15 — Toda lectura de patas es de a muchas filas

Hay seis `.maybeSingle()` sobre `period_payments` en el código actual (`pay-card-period.ts:72`,
`cards/mutations.ts:262` y `:292`, `detail-queries.ts:291`, `thin-mutations.ts:751` y `:903`).
`.maybeSingle()` no devuelve la primera fila cuando hay varias: **tira error** (PGRST116).

Con dos patas, la pantalla de detalle del resumen se rompe. No es un detalle de implementación que se
pueda dejar al que escriba el código: es un cambio de contrato de lectura que hay que barrer
completo, y por eso queda asentado acá.

## D16 — Dentro del RPC, el sello se inserta ANTES de las patas

El sello es un consumo del resumen y **sube la deuda en pesos** (D5). El trigger de cobertura de D11
valida cada pata contra el pendiente del momento. Si las patas se insertaran primero, una pata que
paga el total —sello incluido, que es lo que la UI sugiere— sería rechazada por exceder un pendiente
calculado sin el sello (ajuste de la revisión).

El orden dentro de `pay_card_period_legs` es, entonces: congelar la base del sello (que sigue siendo
el total ARS **previo** al sello, para que no se incluya en su propia base) → insertar el sello →
recalcular el pendiente **con** el sello → validar e insertar las patas → barrer si queda saldado.

Los dos "antes" son distintos y no se contradicen: la **base de la alícuota** se congela antes del
sello, la **cobertura** se calcula después. Confundirlos da un sello que se cobra a sí mismo, o una
pata que no puede pagar el resumen completo.

## D17 — El calendario también es SQL, porque un lock no sobrevive a un round-trip

Con el calendario fuera del RPC de dinero (D12), dos "primeros pagos" simultáneos podrían confirmar
fechas distintas para el ciclo en curso, y uno podría fallar en el dinero dejando igual sus fechas
aplicadas.

La mitigación que se había escrito —"el paso de calendario toma `FOR UPDATE`"— **es imposible tal
como estaba** (hallazgo de la revisión, y es un error de bulto): hoy ese paso es una cadena de
llamadas Supabase desde TS, y cada llamada de PostgREST es su propia transacción. Un `SELECT ... FOR
UPDATE` en una de ellas suelta el lock apenas responde. No hay forma de sostener un lock de fila
entre requests.

Así que el calendario pasa a ser **su propia función SQL corta** —`confirm_running_cycle(...)`—, que
en una transacción toma el lock del período que se está pagando, y **no hace nada si ese período ya
tiene patas**. Sigue siendo un paso separado y previo al RPC de dinero (la asimetría de D12 no
cambia: las fechas valen aunque el pago falle), pero ahora es atómico e idempotente en vez de una
secuencia de updates sueltos.

La lógica pura de decisión —`planRunningCycleConfirmation`, que decide confirmar, re-proyectar o
rechazar— **se queda en TS**, testeada como está hoy. La función SQL ejecuta un plan ya resuelto; no
lo vuelve a calcular.

**Pero no lo aplica a ciegas.** El plan se calculó a partir de una lectura previa, y entre esa
lectura y la llamada puede haber cambiado cualquier cosa. Antes de escribir, `confirm_running_cycle`
revalida los **anclajes** que el plan da por ciertos: que el período pagado sea del usuario, que el
período siguiente siga siendo el que el plan nombra, que sus fechas actuales sean las que el plan
esperaba encontrar, y que el período pagado siga sin patas. Si algo no coincide, no pisa: no-op
controlado o error explícito, nunca un plan stale aplicado sobre un estado que ya no es el que lo
generó.

La división queda entonces: TS **decide** (con toda la lógica de bordes y cascadas, testeada como
función pura), SQL **verifica que la decisión sigue siendo aplicable** y escribe.

**KNOWN GAP declarado:** entre el commit de `confirm_running_cycle` y el arranque del RPC de dinero
queda una ventana en la que un segundo pedido todavía ve el período sin patas. No se cierra en esta
change. El motivo es de proporción: exige que la misma persona confirme dos primeros pagos del mismo
resumen desde dos dispositivos dentro de esa ventana; el daño es que quedan aplicadas las fechas de
la confirmación perdedora, que son datos que el usuario mismo tipeó y que la pantalla de editar
fechas corrige. El dinero, que es lo que no se puede corregir a mano, queda protegido por los
triggers de D11 en todos los casos.

## D18 — El input es "pagos con imputaciones", no una lista plana de patas

Si una transacción puede tener varias patas (D1), una lista plana no dice **cuándo dos patas son un
mismo débito bancario y cuándo son dos** (hallazgo de la revisión). El input se anida:

```
payments: [
  { payment_account_id, payment_date, allocations: [ { settles_currency, settles_amount, fx_rate_to_ars? } ] }
]
```

Un pago = una transacción = un débito de una cuenta. Sus `allocations` son sus patas. Con eso:

- *Todo en pesos, resumen mixto* → **un** pago con dos allocations (ARS y USD pesificada).
- *Pesos con pesos, dólares con dólares* → **dos** pagos, una allocation cada uno.
- *Pago mínimo* → un pago con una allocation más chica.

La forma del input deja de admitir estados ambiguos: el agrupamiento es un dato que el usuario
declara al elegir de qué cuenta sale cada cosa, no algo que el backend deduzca comparando montos.
`payment_group_id` (D8) se asigna a todas las patas de una misma llamada, abarcando los dos pagos
cuando son dos.
