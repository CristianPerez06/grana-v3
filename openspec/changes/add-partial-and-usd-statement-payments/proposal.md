# Proposal: add-partial-and-usd-statement-payments

## Why

Un resumen con consumos en pesos y en dólares hoy **solo se puede pagar en pesos**, y **solo entero**.
Las dos limitaciones salieron a la luz juntas, en producción, con un resumen vencido impago: el
usuario quería pagar los dólares en dólares —como se lo permite el banco— y no pudo.

Ninguna de las dos es una decisión de producto: son dos consecuencias del mismo atajo de
implementación. El pago de resumen se modeló como **un gasto en ARS que salda todo**:

- `pay-card-period.ts` inserta la expensa con `currency_code: 'ARS'` fijo y exige la cotización
  cuando el resumen tiene deuda USD (`cards.errors.usd_fx_required`);
- `period_payments` tiene `period_id UNIQUE` y un solo `transaction_id`: no hay lugar para una
  segunda pata, ni para un segundo pago;
- todo el módulo lee "existe fila en `period_payments`" como **el resumen está saldado**
  (`derivePeriodStatus`, `computePeriodAmounts`, `classifyPeriodsLifecycle`, el hero de `/cards`, el
  dashboard y las guardas de alta de consumo).

El costo real no es la molestia de convertir a mano: es que Grana obliga a mentir. Para registrar lo
que efectivamente pasó —salieron dólares de la caja de ahorro en dólares— el usuario tiene que
cargar un gasto en pesos que nunca existió, y su saldo en USD queda alto para siempre. Y quien paga
el mínimo directamente **no tiene cómo registrarlo**: o marca el resumen como pagado entero (y
Grana le borra una deuda que sigue viva), o no lo marca (y Grana le miente sobre el disponible).

## What Changes

El pago de un resumen deja de ser un evento y pasa a ser **una serie de patas de pago**. Cada pata
declara qué deuda cancela.

- **`period_payments` pierde `period_id UNIQUE`** y gana `settles_currency`, `settles_amount` y
  `fx_rate_to_ars`: la moneda de la deuda que la pata cancela, cuánto de esa deuda, y la cotización
  cuando el dinero sale en una moneda distinta de la que cancela.
- **El saldo del resumen se deriva de las patas**, no de su existencia:
  `pendiente = consumos − reintegros − Σ patas`, por moneda. `paid` pasa a significar **saldado**;
  aparece un estado **parcial** que el calendario sigue tratando como impago (un parcial vencido
  sigue vencido, por el resto).
- **La porción USD se puede pagar en dólares**, desde una cuenta con USD activo. La cotización pasa
  a ser obligatoria **solo** cuando esa porción se pesifica.
- **El barrido `pending → paid`** de los consumos ocurre cuando la última pata cubre el resumen, no
  en el primer pago.
- **El sello y las fechas del ciclo en curso** se piden **solo en la primera pata**: son datos del
  resumen de papel, no de cada pago.
- **`card_periods` recuerda el pago mínimo** (`minimum_payment_ars` / `minimum_payment_usd`), que el
  formulario ofrece como chip junto al total.
- **Deshacer** pasa a operar por patas: la última, o todas.

## El remanente se queda en el resumen que lo generó

La alternativa era calcar el papel del banco: cerrar el resumen viejo y generar un cargo
"Saldo anterior impago" en el siguiente. Se descartó. Ese cargo es una **transacción sintética que
duplica deuda ya representada**: las mismas compras contadas dos veces, y una línea que hay que
acordarse de excluir a mano de cada analítica de gasto, para siempre. La regla que ya sostiene todo
el módulo —*la deuda de un resumen es la suma de sus consumos impagos*— sigue valiendo sin
excepciones, y el resumen viejo queda diciendo la verdad: *de $265.805 pagaste $40.000, restan
$225.805*.

## Lo que NO hace

- **No calcula ni sugiere intereses de financiación.** Los intereses, el IVA sobre intereses y los
  punitorios que el banco cobra por financiar llegan en el resumen siguiente y se cargan como
  consumos normales, igual que hoy. Automatizarlos es otra change: exige modelar tasas, y una tasa
  mal supuesta es peor que no tenerla.
- **No reparte una pata entre monedas.** Cada pata cancela deuda de **una** moneda. Pagar parte de
  los dólares en dólares y el resto en pesos ya es expresable en el modelo (son dos patas), pero la
  v1 no lo ofrece en la UI: el formulario propone un destino por moneda.
- **No toca el calendario.** La confirmación de fechas del ciclo en curso, el período estimado eager
  y la reasignación de consumos quedan exactamente como están.
- **No convierte nunca ARS y USD en un solo número.** Bimoneda no se relaja en ningún lado: el
  resumen sigue mostrando dos deudas, y el pago, dos patas.

## Impact

- **Specs:** `cards` (5 requirements nuevos, 7 modificados).
- **Migraciones:** `0061_card_payment_legs.sql` (patas + pago mínimo + `revert_card_period_payment`
  por pata).
- **Código:** `packages/cards`, `packages/money-logic` (`computePeriodAmounts`, `derivePeriodStatus`),
  `packages/validation`, `packages/dashboard` (call sites), `packages/i18n-messages`, el formulario
  de pago de web y su espejo nativo.
- **Riesgo: medio-alto.** No es aditivo: `has_payment` es booleano hoy y lo lee todo el módulo. El
  riesgo se concentra en las lecturas de deuda (hero de `/cards`, compromisos del dashboard) y se
  ataca con tests sobre las funciones puras, que ya son el único lugar donde vive la regla.
- **Datos existentes:** los pagos ya registrados se marcan como pagos de saldo total
  (`settlement_known=false`) y siguen leyéndose como resúmenes saldados. Sin backfill de montos:
  reconstruir cuánto canceló cada moneda en un pago viejo es adivinar.
