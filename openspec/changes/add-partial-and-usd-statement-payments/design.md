# Design: add-partial-and-usd-statement-payments

Decisiones cerradas, con su porqué. Lo que ya está decidido sobre el ciclo de vida del resumen
(cuatro fechas, período estimado eager, confirmación al pagar) no se revisa acá: vive en
`openspec/specs/cards/spec.md` y esta change lo respeta.

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

La alternativa a declarar la imputación era guardar solo el gasto y deducir qué canceló. No se puede
sin inventar una regla: con un resumen que debe $100.000 y US$ 200, un pago de $150.000 podría estar
cancelando todos los pesos y parte de los dólares, o pesos de más contra un saldo a favor. Cualquier
regla que elijamos va a estar mal para alguien, y el usuario **ya sabe** la respuesta cuando paga.
Se la preguntamos.

Ese mismo dato es lo que hace que el pago mixto (parte de los dólares en dólares, el resto en pesos)
no necesite modelo nuevo: son dos patas con `settles_currency='USD'`, una desde cada cuenta.

## D2 — Tres conceptos distintos, no un booleano nuevo

`period_id` deja de ser UNIQUE, y el booleano `has_payment` **no se reemplaza por otro booleano**.
Se parte en tres cosas que hoy están fusionadas y que gobiernan decisiones diferentes (ajuste de la
revisión: la versión anterior las metía todas dentro de `settlement`, que es justo cómo se vuelven a
mezclar las semánticas):

```
pendiente(moneda) = Σ consumos − Σ reintegros recibidos − Σ patas que cancelan esa moneda

settlement    = 'unpaid' | 'partial' | 'settled'     ← deuda, montos y estado
hasAnyPayment = existe al menos una pata             ← "ya hubo primera pata"
status        = 'open' | 'closed' | 'overdue' | 'paid'
```

- **`settlement`** decide los montos y el estado. `settled` ⟺ pendiente ARS = 0 ∧ pendiente USD = 0,
  con al menos una pata.
- **`status`** deriva `paid` **solo** con `settlement === 'settled'`. Un resumen parcial deriva por
  fecha como cualquier impago: si venció está `overdue`, porque efectivamente debés plata y estás en
  mora por el resto. Lo que cambia es el monto, no el estado.
- **`hasAnyPayment`** gobierna lo que depende de *que ya haya habido un pago*, no de cuánto se
  cubrió: no volver a pedir sello ni fechas del ciclo (D5), bloquear consumos nuevos en ese rango
  (abajo), y la guarda cronológica de la reversión (D8).

Confundir los dos últimos es el error fácil: un resumen parcial **no** es `paid`, pero **sí** tiene
que bloquear consumos y **sí** bloquea la reversión de un resumen anterior.

Esta es la parte cara de la change y hay que decirlo: `has_payment` lo leen `derivePeriodVariant`,
`classifyPeriodsLifecycle`, `computePeriodAmounts`, el hero de `/cards`, el mes de
`getCardsMonthSummary`, los compromisos del dashboard y la guarda de alta de consumo. Cada call site
pasa a leer el concepto que le corresponde de los tres. Ninguno recalcula la regla: sigue viviendo
donde ya vivía, en `computePeriodAmounts`.

**Un consumo backdated en un resumen con patas se RECHAZA.** No se reasigna. `getOrCreatePeriodForDate`
(`internal/card-periods.ts:123`) hoy tira `CardConsumoInPaidPeriodError` cuando la fecha cae en un
resumen pagado, y su comentario dice por qué: fabricar un período frontera "was the bug that dumped
past-dated consumos into far-future statements". Un resumen `partial` se trata igual que uno
`settled` para esta guarda — el rechazo se extiende, no se reemplaza por una reasignación silenciosa
a un período cuyo rango no contiene esa fecha.

## D3 — El remanente se queda en el resumen que lo generó

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

## D4 — Los consumos pasan a `paid` recién cuando la última pata cubre el resumen

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
`period_payments.transaction_id = t.id`. Con **una fila por pata**, cada gasto —el de pesos y el de
dólares— tiene la suya: los dos se muestran como "Pago de resumen" y los dos quedan protegidos por
el FK `RESTRICT`, sin tocar el RPC. Con una segunda columna, en cambio, había que agregar
`or xp.usd_transaction_id = t.id` en tres lugares, y olvidarse de uno dejaba la pata en dólares como
un gasto suelto sin categoría **y borrable**.

En el listado, un pago con dos patas aparece como dos filas el mismo día, una por moneda. Es lo que
Bimoneda pide: nunca un número que mezcle las dos.

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

Backfillear los montos sería adivinar: en un pago viejo de un resumen mixto, cuánto de esa expensa en
pesos canceló dólares depende de una cotización que se guardó en la transacción solo a veces. El
precedente es `stamp_tax_link_known` (migración `0050`), por la misma razón y con el mismo resultado:
marcar lo que no se sabe es barato, adivinarlo es una corrupción silenciosa.

## D10 — El pago mínimo se persiste en el período, no en el pago

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

Dos capas, con propósitos distintos:

1. **Un trigger sobre `period_payments`** que toma `FOR UPDATE` sobre su `card_periods`, recalcula la
   cobertura y rechaza el exceso. Serializa los inserts concurrentes y sostiene el invariante en
   **todo** camino de escritura, incluido un REST directo que no pase por el RPC. Es el idioma del
   repo: `trg_fn_credit_transaction_invariants`, `trg_fn_reimbursement_invariants`.
2. **El RPC de D12**, que da atomicidad a la operación completa.

La validación en la action **se conserva**, pero cambia de rol: pasa a ser pre-validación de UX —un
mensaje que dice cuánto resta antes de intentar— y deja de ser la garantía contable.

Nada de esto es clamping en lectura, que está prohibido y sigue prohibido: es rechazo en el write
path. La lectura sigue mostrando lo que hay.

## D12 — El dinero se escribe en un RPC atómico; el calendario queda afuera

`pay_card_period_legs(...)`, `SECURITY INVOKER` como la reversión de la `0050`, hace en una sola
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

## D13 — Una pata es inmutable

Sin policy de `UPDATE` sobre `period_payments`: una pata se revierte y se vuelve a crear, no se
edita.

Es gratis y elimina una clase entera de bypass. Un `UPDATE` directo sobre `settles_amount` esquiva
el trigger de D11 tan fácil como un INSERT, y no existe ningún caso de uso: corregir un pago es
deshacerlo y volver a cargarlo, que es lo que la UI ya ofrece.

Las policies de `INSERT` y `DELETE` se conservan (la reversión es INVOKER y necesita borrar), con el
trigger de D11 sosteniendo el invariante en las dos.

## D14 — El as-of del dashboard se computa por cobertura, no por existencia

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
