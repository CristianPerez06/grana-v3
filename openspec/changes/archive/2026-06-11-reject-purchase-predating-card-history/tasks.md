# Tasks â€” reject-purchase-predating-card-history

## 1. Guard en la lÃ³gica compartida

- [x] 1.1 `card-periods.ts`: exportar `CardPurchasePredatesHistoryError` (Error con `oldestStartDate`)
- [x] 1.2 `getOrCreatePeriodForDate`: tras fallar `assignTransactionToPeriod`, lanzar el error cuando `targetDate < periods[0].start_date` (antes de la rama de rolling forward)
- [x] 1.3 Exportar la clase de error desde el index del paquete

## 2. Mensaje claro en los orquestadores

- [x] 2.1 `registerCardPurchase`: catch discrimina el error tipado â†’ `formError` que nombra la fecha de inicio del historial
- [x] 2.2 `registerInstallments`: mismo catch tipado (origen: primera cuota) â†’ mensaje claro, sin insertar parent ni cuotas

## 3. Tests

- [x] 3.1 `getOrCreatePeriodForDate`: fecha anterior al perÃ­odo mÃ¡s viejo lanza `CardPurchasePredatesHistoryError`; fecha futura sigue haciendo rolling forward; fecha cubierta devuelve el perÃ­odo existente
- [x] 3.2 `registerCardPurchase`: smoke del path de rechazo con mensaje claro

## 4. Cierre

- [x] 4.1 typecheck + lint + tests (web y transactions-mutations)
