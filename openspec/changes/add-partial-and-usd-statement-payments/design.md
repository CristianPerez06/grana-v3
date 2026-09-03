# Design: add-partial-and-usd-statement-payments

Decisiones cerradas, con su porqué. Lo que ya está decidido sobre el ciclo de vida del resumen
(cuatro fechas, período estimado eager, confirmación al pagar) no se revisa acá: vive en
`openspec/specs/cards/spec.md` y esta change lo respeta.

## D0 — El pago de un resumen es una serie de patas, no un evento

Una **pata de pago** es una fila de `period_payments` que dice: *esta transacción cancela `X` de la
deuda en `<moneda>` de este resumen*. Un resumen puede tener una pata (el caso de hoy), dos (pesos
por un lado, dólares por el otro) o muchas (mínimo hoy, resto en tres semanas).

Es el cambio de forma que habilita las dos funcionalidades con un solo modelo, y no es una
generalización especulativa: las dos ya fueron pedidas, y ninguna se puede expresar sin esto.

## D1 — Cada pata declara qué cancela; no hay regla de imputación implícita

Cuatro columnas nuevas en `period_payments`:

| Columna | Qué dice |
|---|---|
| `settles_currency` | La moneda de la **deuda del resumen** que esta pata cancela (`ARS` \| `USD`) |
| `settles_amount` | Cuánto de esa deuda cancela, en esa moneda |
| `fx_rate_to_ars` | La cotización usada, solo cuando el dinero sale en una moneda distinta de la que cancela |
| `settlement_known` | `false` en los pagos anteriores a esta change (ver D9) |

`transaction_id` sigue apuntando al gasto real, **en la moneda de la que sale la plata**. Los dos
datos son distintos y ninguno se deriva del otro: pagar US$ 500 del resumen desde una cuenta en
pesos a 1.230,50 es una transacción de $615.250 en ARS y una pata de `USD 500`.

La alternativa era guardar solo el gasto y deducir qué canceló. No se puede sin inventar una regla:
con un resumen que debe $100.000 y US$ 200, un pago de $150.000 podría estar cancelando todos los
pesos y parte de los dólares, o pesos de más contra un saldo a favor. Cualquier regla que elijamos
va a estar mal para alguien, y el usuario **ya sabe** la respuesta cuando paga. Se la preguntamos.

Ese mismo dato es lo que hace que el pago mixto (parte de los dólares en dólares, el resto en pesos)
no necesite modelo nuevo: son dos patas con `settles_currency='USD'`, una desde cada cuenta.

## D2 — `period_id` deja de ser UNIQUE, y `paid` pasa a significar *saldado*

Hoy el estado sale de una pregunta binaria: *¿existe fila en `period_payments`?* Con patas, la
pregunta pasa a ser cuantitativa:

```
pendiente(moneda) = Σ consumos − Σ reintegros recibidos − Σ patas que cancelan esa moneda

settled  ⟺ pendiente ARS = 0  ∧  pendiente USD = 0   (y hay al menos una pata)
partial  ⟺ hay patas y algo queda pendiente
unpaid   ⟺ no hay patas
```

`derivePeriodStatus` devuelve `paid` **solo** con `settled`. Un resumen parcial se comporta, a nivel
calendario, como impago: si venció, está `overdue` — porque efectivamente debés plata y estás en
mora por el resto. Lo que cambia es el monto, no el estado.

Esta es la parte cara de la change y hay que decirlo: `has_payment` es booleano y lo leen
`derivePeriodVariant`, `classifyPeriodsLifecycle`, `computePeriodAmounts`, el hero de `/cards`, el
mes de `getCardsMonthSummary`, los compromisos del dashboard y la guarda que impide imputar un
consumo a un resumen ya pagado. Todos pasan a leer el `settlement` de tres estados. Ninguno de esos
call sites recalcula la regla: la regla vive donde ya vivía, en `computePeriodAmounts`.

**Un parcial no acepta consumos nuevos.** La guarda de alta de consumo trata `partial` igual que
`settled`: el resumen ya cerró, un consumo con fecha de ese rango va al período en curso. Que le
falte plata por pagar no lo vuelve a abrir.

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

En consecuencia, `next_end_date` / `next_due_date` son requeridos solo en la primera pata, y el
sello se registra —y la alícuota se aprende— solo ahí.

El sello se inserta como consumo `pending` del resumen y, como cualquier consumo, **sube la deuda**.
Es correcto: es un cargo del resumen, no del pago. Quien paga el mínimo lo ve sumado a lo que resta.

## D6 — La cotización es obligatoria solo cuando la deuda en dólares se pesifica

Regla exacta, por pata: `fx_rate_to_ars` es requerida ⟺ `settles_currency = 'USD'` y la transacción
está en ARS. Una pata que paga dólares con dólares no lleva cotización — **no hay conversión**, y
pedirla sería inventar un dato.

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

## D8 — Deshacer opera por patas, en orden inverso

`revert_card_period_payment(p_period_id, p_payment_id default null)`:

- **sin `p_payment_id`** → revierte todas las patas del resumen. Es "Deshacer pago", lo que la UI
  ofrece hoy.
- **con `p_payment_id`** → revierte solo esa pata, y solo si es la más reciente del resumen. Sirve
  para corregir el pago de hoy sin desarmar el mínimo que pagaste hace tres semanas.

El barrido `paid → pending` corre solo si el resumen estaba `settled`. El sello se borra solo cuando
se revierte la pata que lo trajo (la primera) o todas. Las fechas confirmadas y la alícuota aprendida
siguen sin revertirse, por el motivo de siempre: son hechos del resumen, no del pago.

La guarda cronológica se relaja del booleano al mismo criterio que todo lo demás: **no se puede
deshacer un pago si un resumen posterior de la misma tarjeta tiene pagos** (antes: "está pagado").

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

## D11 — Ninguna pata puede exceder el saldo pendiente de su moneda

Validado en la action, contra la base. Sin este piso, `pendiente` se va a negativo y el módulo
empieza a mostrar saldos a favor que el banco no reconoce.

No es clamping en lectura —eso está prohibido y sigue prohibido—: es un rechazo en el write path,
con un mensaje que dice cuánto resta. La lectura sigue mostrando lo que hay.
