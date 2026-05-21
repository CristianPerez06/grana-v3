## 1. Server-side cascade (ya implementado)

- [x] 1.1 En `updatePeriodDates` (`apps/web/app/_actions/credit-cards.ts`), después de la validación cronológica, buscar el próximo período (`account_id, start_date > período.start_date`, asc, limit 1).
- [x] 1.2 Si el próximo existe y `addDaysToISO(data.end_date, 1) ≠ next.start_date`, ejecutar la cascada.
- [x] 1.3 Antes de cascadear, validar: próximo no pagado y `data.end_date < next.end_date`; sino devolver errores con los mensajes definidos en el spec.
- [x] 1.4 Si se extiende (`data.end_date > período.end_date`), `UPDATE transactions SET card_period_id = períodoEditado WHERE card_period_id = próximo AND date <= data.end_date`.
- [x] 1.5 Si se achica, `UPDATE transactions SET card_period_id = próximo WHERE card_period_id = períodoEditado AND date > data.end_date`.
- [x] 1.6 Actualizar `próximo.start_date = data.end_date + 1`.

## 2. Query: exponer info del próximo período al UI (ya implementado)

- [x] 2.1 Agregar `nextPeriodStart: string | null` y `nextPeriodIsPaid: boolean` al tipo `CardPeriodDetail` en `apps/web/lib/cards/queries.ts`.
- [x] 2.2 En `getCardPeriodDetail`, calcular `nextPeriod` filtrando de `periodsWithStatus` por `start_date > período.start_date` y tomando el mínimo.
- [x] 2.3 En `getCardPeriods`, indexar el próximo período por id antes de revertir para devolver el mismo shape.

## 3. UI: preview ámbar y bloqueo (ya implementado)

- [x] 3.1 `EditDatesSheet` recibe `nextPeriodStart` y `nextPeriodIsPaid` desde la page.
- [x] 3.2 Calcular `boundaryMoves = nextPeriodStart != null && addOneDay(endDate) ≠ nextPeriodStart`.
- [x] 3.3 Renderizar cartel ámbar cuando extiende (texto: "consumos del próximo con fecha hasta X se van a mover a este resumen").
- [x] 3.4 Renderizar cartel ámbar cuando achica (texto: "consumos de este resumen con fecha posterior a X se van a mover al próximo").
- [x] 3.5 Renderizar cartel rojo y deshabilitar botón Guardar cuando `boundaryMoves && nextPeriodIsPaid`.

## 4. Validación spec

- [ ] 4.1 Ejecutar `openspec validate clarify-card-period-date-edit-cascade --strict` y resolver issues si los hubiera.
- [ ] 4.2 Archivar el change con `openspec-archive-change` una vez aceptado.
