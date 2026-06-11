# Design — reject-purchase-predating-card-history

## Context

`getOrCreatePeriodForDate(supabase, accountId, targetDate, today)` resuelve el período de un consumo: si algún período existente cubre `targetDate` lo devuelve; si no, hace rolling forward creando un período estimado con `start_date = último.end_date + 1`. Esa rama de creación no distingue entre "fecha futura más allá del último período" (legítima) y "fecha anterior al período más viejo" (anómala): ambas caen al mismo `else` y producen un período futuro.

Los períodos vienen ordenados por `start_date ASC` (ya lo hace `getCardPeriodsWithStatus`), así que `periods[0]` es el más viejo.

## Goals / Non-Goals

**Goals:**

- Cero asignaciones a un período que no contiene la fecha del consumo.
- Mensaje de usuario claro que nombre la fecha de inicio del historial (anclar la decisión).
- Un solo punto de control que cubra consumo simple y cuotas.

**Non-Goals:**

- No crear períodos hacia atrás (backfill de resúmenes viejos): un consumo previo al alta pertenece a un ciclo que Grana no trackea.
- No migrar datos existentes.
- No cambiar la generación lazy hacia adelante.

## Decisions

### D1 — Guard dentro de `getOrCreatePeriodForDate`, error tipado

Tras fallar `assignTransactionToPeriod`, si existe un período más viejo y `targetDate < periods[0].start_date`, lanzar `CardPurchasePredatesHistoryError` (clase exportada, con `oldestStartDate` para el mensaje) en vez de seguir a la rama de rolling forward. Alternativa considerada: devolver `null` y que cada orquestador decida. Se descarta porque la firma actual devuelve `string` (no nullable) y dos callers tendrían que duplicar la lógica de detección; un error tipado centraliza la causa y deja el mensaje en la capa de orquestación.

### D2 — Traducción del error en los orquestadores

`registerCardPurchase` y `registerInstallments` ya envuelven la llamada en `try/catch`. El catch pasa a discriminar: si es `CardPurchasePredatesHistoryError`, devolver `formError` claro que nombre la fecha; cualquier otro error mantiene el mensaje genérico actual. En cuotas el error solo puede originarse en la primera cuota (fecha de compra); las posteriores son `+N meses` (futuras).

## Risks / Trade-offs

- [Un usuario que legítimamente quiera registrar un consumo apenas anterior al inicio de P1 (ciclo actual > 30 días) sería rechazado] → Es el trade-off correcto: el `start_date` de P1 es `cierre − 30d` y cubre el ciclo típico; el caso límite es raro y la salida es ajustar la fecha o las fechas del período. Documentado como límite conocido, no se resuelve acá.
- [Cambio de comportamiento sobre inserciones que antes "funcionaban"] → Antes producían corrupción silenciosa; fallar con mensaje claro es estrictamente mejor.

## Open Questions

(ninguna)
