## 1. Sacar la cotización del alta

- [x] 1.1 `packages/validation/src/credit-cards.ts`: eliminar el test `fx-rate-required-for-usd` (mantener `fx-rate-must-be-null-for-ars` o eliminar el campo del alta por completo — decidir en diseño).
- [x] 1.2 `apps/web/app/(app)/transactions/new/_components/movement-form.tsx`: quitar el campo de cotización para consumo USD en tarjeta (y el estado `fxRate` asociado a ese caso).
- [x] 1.3 `packages/validation/src/recurrences.ts` + `apps/web/lib/recurrences/components/pending-recurrences-block.tsx`: el confirm de recurrencia USD en tarjeta deja de pedir cotización.
- [x] 1.4 Actualizar tests de validación afectados.

## 2. Eliminar el flag de revisión

- [x] 2.1 `apps/web/lib/transactions/movements.ts`: quitar `missing_fx_rate` de `getReviewFlags` y del tipo `MovementReviewFlag`.
- [x] 2.2 Limpiar i18n y cualquier render condicionado a ese flag (chip "revisar" en la lista, detalle).
- [x] 2.3 Actualizar tests de `getReviewFlags` / movements.

## 3. Cotización en el pago de resumen

- [x] 3.1 `payCardPeriodSchema`: agregar `fx_rate_to_ars` opcional (decimal hasta 6, sin agrupado de miles — mismas reglas que el campo fx existente).
- [x] 3.2 `payCardPeriod` (action): si el período tiene `pendingAmountUSD > 0`, exigir cotización > 0; computar/validar el total `pendiente ARS + pendiente USD × cotización`; persistir `fx_rate_to_ars` en la transacción de pago.
- [x] 3.3 `pay-card-period-form.tsx`: campo cotización visible solo con deuda USD; mostrar desglose (ARS, USD, USD convertido) y el total computado; mantener el input como text/decimal (CARD-N2-03: el centavo no se pierde).
- [x] 3.4 Tests del cálculo del total y de la validación condicional.

## 4. Specs y QA

- [x] 4.1 Spec delta `cards`: requirement de cotización en el pago (captura + desglose + persistencia) y alta de consumo USD sin cotización.
- [x] 4.2 Spec delta `transactions`: quitar "falta cotización" de los motivos de revisión.
- [x] 4.3 `docs/qa/plan-de-pruebas.md`: reescribir CARD-N2-02 (consumo USD sin cotización) y REC-N2-02 (confirm sin fx); agregar caso de pago con deuda USD + cotización.
- [x] 4.4 `pnpm typecheck`, `pnpm lint`, `pnpm --filter web test`, tests de packages afectados.

## 6. Hallazgo de QA: invariante a nivel DB

- [x] 6.1 Migración `0027_card_fx_at_statement_payment.sql`: relajar I-CRED-11 (fx opcional en consumo USD; > 0 cuando está) y permitir `fx_rate_to_ars > 0` en gastos no-credit (pago de resumen). NULL estricto se mantiene para tipos no-expense.
- [x] 6.2 Aplicar al remoto (`supabase db push`; historial 0001–0026 reparado, estaba vacío).

## 7. Hallazgos adicionales de la corrida de QA (mismo change)

- [x] 7.1 Editar la fecha de un consumo reasigna el resumen (`card_period_id` + `due_date`); mover a un resumen pagado se bloquea.
- [x] 7.2 Form de pago: contexto del último cierre conocido + validación de fechas; error crudo `chk_period_dates` reemplazado por copy localizada.
- [x] 7.3 `paidAmountUSD`: resúmenes pagados muestran el USD pagado; el detalle del pago muestra la composición pesos/dólares (en vez de repetir período/vencimiento).
- [x] 7.4 Hero de tarjetas: USD de "A pagar este mes" con presencia real (24px); filas de vencimientos muestran su USD.
- [x] 7.5 "Guardar cambios" del edit de movimiento usa el `Button` de la librería.
