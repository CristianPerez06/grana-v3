# Proposal: add-multicurrency-statement-payment

## Why

Un resumen con consumos en pesos y en dólares hoy **solo se puede pagar en pesos**. Salió a la luz
en producción, con un resumen vencido impago: el usuario quería pagar los dólares en dólares —como
se lo permite el banco— y no pudo.

No es una decisión de producto: es un atajo de implementación. `pay-card-period.ts` inserta la
expensa con `currency_code: 'ARS'` fijo y exige la cotización cuando el resumen tiene deuda USD, así
que la única forma de saldarlo es pesificar.

El costo real no es la molestia de convertir a mano: es que Grana obliga a mentir. Para registrar lo
que efectivamente pasó —salieron dólares de la caja de ahorro en dólares— el usuario tiene que
cargar un gasto en pesos que nunca existió, y su saldo en USD queda alto para siempre.

## What Changes

Un pago de resumen deja de ser *un gasto* y pasa a ser **una operación con varios débitos y sus
imputaciones**.

- **`period_payments` gana `settles_currency`, `settles_amount`, `fx_rate_to_ars` y
  `payment_group_id`**: qué deuda cancela cada pata, cuánto, con qué cotización cuando pesifica, y
  qué patas nacieron de la misma operación. `period_id` deja de ser único.
- **La porción USD se puede pagar en dólares**, desde una cuenta con USD activo. La cotización pasa
  a ser obligatoria **solo** cuando esa porción se pesifica.
- **Un mismo débito puede tener varias patas.** Pagar todo en pesos un resumen mixto sigue siendo un
  único débito bancario, ahora con dos imputaciones. De ahí sale una identidad que hoy no existe: el
  monto de la transacción es la suma de sus patas, así que el "monto a pagar" deja de ser un campo
  libre que puede no corresponder a ninguna deuda.
- **La escritura se muda a la base**: un RPC atómico reemplaza la cadena de rollbacks manuales,
  triggers sostienen los invariantes, y `period_payments` queda sin policies de escritura.
- **Deshacer opera por grupo de pago**, para que una operación de dos débitos se revierta entera.

## El alcance es pago TOTAL, y eso es lo que lo hace barato

Una operación puede tener varios débitos, pero **siempre tiene que dejar el resumen en cero en las
dos monedas**. No hay pago parcial, ni pago mínimo, ni estado `partial`.

No es una limitación cosmética: es la condición que permite no tocar medio sistema. Mientras un pago
no pueda existir sin cubrir el total, **`has_payment` sigue significando "saldado"**, que es como lo
leen `derivePeriodStatus`, `computePeriodAmounts`, `classifyPeriodsLifecycle`, el hero de `/cards`,
el resumen del mes y los compromisos del dashboard. Ninguno de ellos se toca.

La regla vive en la base (`GRN04`), no en la app: un pago que cancela solo los pesos de un resumen
mixto dejaría una fila en `period_payments` con deuda en dólares viva, y ese booleano pasaría a
mentir en todas esas pantallas a la vez.

## Lo que NO hace, y por qué el modelo igual lo contempla

- **Pago parcial y pago mínimo.** Van en una change aparte. El **modelo de patas ya los admite** —el
  trigger acepta una pata menor al pendiente—; lo que no los admite es el camino de escritura.
  Habilitarlos es relajar una condición del RPC e introducir el estado `partial` con los call sites
  que dependen de él, no rehacer nada de esto.
- **Intereses de financiación.** Llegan en el resumen siguiente y se cargan como consumos.
- **Convertir ARS y USD en un solo número.** Bimoneda no se relaja: el resumen muestra dos deudas y
  el pago, dos imputaciones.

## Un cambio de comportamiento visible

**El monto a pagar deja de ser editable libre.** Hoy es un campo suelto: se puede redondear y pagar
$265.805 en vez de $265.805,42, y el resumen queda marcado como saldado igual — que es falso. Con
imputaciones el monto queda derivado de lo que se declara cancelar, y pagar de menos **es** el pago
parcial que esta change difiere.

Es contablemente correcto y más honesto que hoy, pero hay que decirlo: quien redondeaba, deja de
poder. Si el redondeo resulta necesario por realidad bancaria, se define como regla explícita de
tolerancia o de ajuste — no volviendo al campo libre que marca `paid` con cualquier monto.

## Impact

- **Specs:** `cards` (requirements nuevos y modificados). `dashboard` NO se toca.
- **Migración:** `0061_card_payment_legs.sql` — patas, `card_period_pending`, los dos triggers,
  `pay_card_period_legs`, `confirm_running_cycle`, `revert_card_period_payment` por grupo y el
  cierre de RLS.
- **Código:** `packages/cards`, `packages/validation`, `packages/i18n-messages`, el formulario de
  pago de web y su espejo nativo.
- **Riesgo: medio.** El grueso de lo que era riesgoso —volver partial-aware a todo el módulo— queda
  fuera de alcance. Lo que queda es la escritura, cubierta por tests PGlite sobre el SQL real.
- **Datos existentes:** los pagos ya registrados se marcan `settlement_known = false` y se siguen
  leyendo como resúmenes saldados. Sin backfill de montos: reconstruir cuánto canceló cada moneda en
  un pago viejo es adivinar.
