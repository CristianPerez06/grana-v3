# Design: fix-card-consumo-period-assignment

## Context

`getOrCreatePeriodForDate(supabase, accountId, targetDate, today)` es el punto único que resuelve a qué `card_periods` se imputa una transacción de tarjeta. Lo comparten el consumo simple (`registerCardPurchase`), las cuotas (`registerInstallments`), la edición con cambio de fecha (`updateTransaction`) y la confirmación de instancias recurrentes (`confirmRecurrenceInstance → registerCardPurchase`).

Su lógica actual:

```
existing = assignTransactionToPeriod(periods, targetDate)   // filtra !has_payment
if (existing) return existing.id
if (targetDate < oldest.start_date) throw PredatesHistory
// si no: crear período nuevo en la frontera y devolverlo
newStart = lastPeriod.end_date + 1
newEnd   = suggestNextPeriodDates(periods, today)           // ignora targetDate
insert({ start: newStart, end: newEnd, is_estimated: true })
return newPeriod.id
```

`assignTransactionToPeriod` devuelve `null` en dos situaciones que la rama de rolling trata idénticamente: (a) la fecha es realmente futura (más allá de la frontera) — legítimo; (b) la fecha cae en un período **pagado** o en un hueco — acá el rolling fabrica un resumen que no contiene la fecha y le imputa el consumo. `suggestNextPeriodDates` ni mira `targetDate`, así que el período nuevo puede quedar a meses de la fecha del consumo.

El requirement "El sistema rechaza registrar un consumo con fecha dentro de un período pagado" (`period_already_paid`) ya manda rechazar (b). El guard existe en `register-card-purchase.ts` (`if (targetPeriod.has_payment) return formError`), pero es inalcanzable: cuando la fecha cae en un pagado, `getOrCreatePeriodForDate` ya devolvió un período **recién creado sin pagar** antes de ese chequeo.

## Goals / Non-Goals

**Goals**

- Que un consumo con fecha en un resumen pagado se **rechace** (honrar `period_already_paid`), en los tres entry points.
- Que el roll-forward ocurra **solo** cuando la fecha es estrictamente posterior al último resumen conocido.
- Preservar exactamente el comportamiento correcto: fecha en resumen abierto (día de cierre incluido) → entra; fecha realmente futura → roll-forward; fecha anterior al primer resumen → `predates history`.

**Non-Goals**

- **No** auto-mover el consumo al próximo resumen abierto (como hace el banco). Es una decisión de producto que choca con la filosofía actual ("registrá un ajuste"); se descarta por ahora.
- **No** rediscutir el modelo inclusive/exclusive del día de cierre. Grana cuenta el cierre como parte del resumen que cierra; se mantiene. La divergencia con el banco (que empuja el consumo del día de cierre al siguiente) queda documentada como tema aparte.
- **No** migración de esquema ni reasignación automática de la data ya corrompida.

## Decisions

### 1. La corrección vive en `getOrCreatePeriodForDate`, no en cada caller

Es el punto único de asignación. Arreglar ahí cubre consumo simple, cuotas y confirmación de recurrencia de una sola vez, y evita que cada caller reimplemente el chequeo. El guard muerto de `register-card-purchase` se elimina (su intención queda absorbida por el error tipado).

### 2. Ramificación explícita: pagado / frontera / hueco

Tras `assignTransactionToPeriod(...) === null`, en vez de asumir "futuro", se clasifica:

```
paidCover = periods.find(p => p.has_payment && p.start_date <= targetDate && targetDate <= p.end_date)
if (paidCover) throw CardConsumoInPaidPeriodError(paidCover)          // (b) → period_already_paid
if (targetDate < oldest.start_date) throw PredatesHistory            // sin cambios
if (targetDate > last.end_date) { ...roll forward... }               // (a) legítimo
throw CardConsumoInPaidPeriodError | AssignmentGap                    // hueco: no fabricar frontera
```

El invariante nuevo: **solo se crea un período cuando `targetDate > last.end_date`.** Cualquier otra fecha no cubierta se rechaza, nunca se le fabrica un resumen.

### 3. Error tipado nuevo, paralelo a `CardPurchasePredatesHistoryError`

`CardConsumoInPaidPeriodError` lleva el rango del resumen pagado que colisiona. Los orquestadores lo capturan igual que capturan `PredatesHistory` y devuelven un `formError` explicativo ("La fecha cae en un resumen ya pagado. Elegí otra fecha."). El código `period_already_paid` del spec se mantiene como la etiqueta normativa del rechazo.

### 4. El día de cierre es inclusive y no cambia

`assignTransactionToPeriod` usa `start_date <= date <= end_date`. Un consumo con `date = end_date` de un resumen **abierto** entra ahí — este es el comportamiento que el usuario pidió preservar ("si el resumen cierra el 26 y cargo con fecha 26, entra, siempre que no esté pagado"). Se agrega un escenario explícito para blindarlo contra regresiones.

### 5. Sin migración; data pre-existente por query de detección

No hay cambio de esquema. Los consumos ya mal asignados se detectan (transacción de tarjeta cuya `date` no cae en el rango de su `card_period_id` y hay un resumen pagado que sí la cubre) y se revisan a mano. No se auto-reasignan: adónde va un consumo huérfano en un resumen cerrado es una decisión del dueño (mismo criterio que la limpieza de duplicados de `fix-recurrence-projection-and-orphans`). Los resúmenes estimados vacíos que el bug creó son inofensivos y se dejan; se reconcilian con el pago normal del resumen.

## Risks / Trade-offs

- **Rechazar en vez de auto-mover.** El usuario debe corregir la fecha a mano cuando el consumo cae en un resumen pagado (p. ej. día de cierre ya pagado → correr un día). Aceptable: las fechas de cierre varían mes a mes, así que el caso es ocasional, y el rechazo es visible en vez de una imputación silenciosa incorrecta.
- **Confirmación de recurrencia backdated ahora falla.** Antes "funcionaba mal" (imputaba a un resumen futuro); ahora falla con mensaje claro y el usuario edita la fecha de la instancia antes de confirmar. Es el trade-off correcto: visible > silenciosamente incorrecto.
- **El caso de hueco es defensivo.** Con períodos contiguos no debería ocurrir; rechazarlo (en vez de fabricar una frontera) expone la anomalía en lugar de corromper datos.

## Migration Plan

Ninguna migración de esquema. Despliegue de código estándar. Post-deploy, opcional: correr la query de detección de consumos mal asignados y revisarlos con el dueño de cada cuenta.

### Query de detección (sin auto-reparación)

Detecta consumos de tarjeta cuya `date` no cae en el rango de su `card_period_id` **y** existe un `card_periods` pagado que sí la cubre — la firma exacta del bug:

```sql
select
  t.id            as tx_id,
  p_email.email   as usuario,
  a.name          as tarjeta,
  t.date          as fecha_consumo,
  t.amount,
  asignado.start_date as periodo_asignado_start,
  asignado.end_date   as periodo_asignado_end,
  correcto.start_date as periodo_correcto_start,
  correcto.end_date   as periodo_correcto_end
from public.transactions t
join public.accounts a        on a.id = t.account_id and a.type = 'credit'
join public.profiles p_email  on p_email.id = t.user_id
join public.card_periods asignado on asignado.id = t.card_period_id
join public.card_periods correcto
  on correcto.account_id = t.account_id
 and t.date between correcto.start_date and correcto.end_date
join public.period_payments pp on pp.period_id = correcto.id      -- el correcto está pagado
where t.is_parent = false
  and not (t.date between asignado.start_date and asignado.end_date)  -- mal asignado
order by usuario, fecha_consumo;
```

Los resultados se revisan a mano: adónde va un consumo cuyo resumen natural está cerrado y pagado es una decisión del dueño (correr la fecha, registrar un ajuste, etc.), no del código. El consumo "Finquality" (`2026-06-25`, tx `5d2d26cb-02dc-4d58-8e72-ba769bfe0a01`) ya fue corregido manualmente por el usuario y no debería aparecer.

## Open Questions

- ¿Se repara la data pre-existente mal asignada, o solo se detecta? Propuesta: solo detección + revisión manual. El consumo "Finquality" del caso ya fue corregido por el usuario; queda confirmar si hay otros y cómo tratarlos.
