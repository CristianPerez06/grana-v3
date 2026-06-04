## Why

Hoy la cotización ARS↔USD se pide en el momento **equivocado** del ciclo de la tarjeta:

- **Al registrar un consumo USD en tarjeta** la cotización es obligatoria (`packages/validation/src/credit-cards.ts`, test `fx-rate-required-for-usd`), y lo mismo al confirmar una recurrencia USD en tarjeta. Pero ese valor es solo **estimativo**: la deuda del período se computa por moneda (`pendingAmountARS` / `pendingAmountUSD` en `lib/cards/queries.ts`) y el `fx_rate_to_ars` del consumo no participa de ninguna matemática contable.
- **Al pagar el resumen** — el único momento donde la conversión es real, porque la cotización es la del día de pago — el form **no pide cotización**: crea un único gasto ARS por el monto que el usuario tipea, obligándolo a convertir la porción USD de cabeza.

Consecuencias: fricción innecesaria al cargar consumos USD (un dato que el usuario no conoce con certeza y la app no usa), un flag de revisión (`missing_fx_rate`) que castiga la ausencia de un dato estimativo, y un pago de resumen que no asiste la conversión justo donde sí importa.

El spec `cards` no exige la cotización al registrar el consumo — es decisión de implementación, no contrato. Detectado en QA (caso CARD-N2-02).

## What Changes

- **Registrar consumo USD en tarjeta** (form de movimiento): deja de pedir cotización. Se elimina el campo fx del form para este caso y la regla `fx-rate-required-for-usd` de la validación. `fx_rate_to_ars` queda en el schema de datos (nullable, sin uso en alta).
- **Confirmar recurrencia USD en tarjeta**: ídem — el confirm deja de pedir cotización (afecta el bloque de pendientes y su validación en `packages/validation/src/recurrences.ts`).
- **Flag de revisión `missing_fx_rate`**: se elimina (`lib/transactions/movements.ts` + i18n + chip "revisar" en la lista). Un consumo USD sin cotización ya no es un estado a corregir.
- **Pago de resumen** (`pay-card-period-form` + `payCardPeriod`): cuando el período tiene deuda USD pendiente, el form pide la **cotización del día de pago** (campo sin agrupado de miles, hasta 6 decimales — mismas reglas que el campo fx actual) y calcula el total: `total ARS = pendiente ARS + pendiente USD × cotización`, mostrando el desglose. El gasto ARS resultante persiste la cotización usada (`fx_rate_to_ars` en la transacción de pago) para trazabilidad. Sin deuda USD, el flujo no cambia.
- **Plan de QA**: CARD-N2-02 y REC-N2-02 se reescriben para el flujo nuevo (la cotización se verifica en el pago, no en el alta).

## Capabilities

### Modified Capabilities

- `cards`: se agrega el requirement de que el pago de resumen con deuda USD captura la cotización del día y computa el total por desglose (ARS + USD×fx), persistiendo la cotización en la transacción de pago; y se hace explícito que el alta de consumo USD **no** exige cotización.
- `transactions`: se elimina el estado de revisión "falta cotización" de los consumos USD en tarjeta (el requirement de "destacar movimientos que requieren revisión" deja de incluir ese motivo).

## Impact

**Código afectado:**

- `packages/validation/src/credit-cards.ts` — quitar `fx-rate-required-for-usd`; `payCardPeriodSchema` agrega `fx_rate_to_ars` opcional (requerido si el período tiene deuda USD — validación en la action).
- `packages/validation/src/recurrences.ts` — quitar la exigencia de fx en el confirm.
- `apps/web/app/(app)/transactions/new/_components/movement-form.tsx` — quitar el campo fx para consumo USD en tarjeta.
- `apps/web/lib/recurrences/components/pending-recurrences-block.tsx` — quitar el campo fx del confirm.
- `apps/web/lib/transactions/movements.ts` — quitar `missing_fx_rate` de `getReviewFlags` (+ tipo `MovementReviewFlag`); limpiar i18n/uso del chip.
- `apps/web/app/(app)/cards/[id]/periods/[periodId]/pay/_components/pay-card-period-form.tsx` — campo cotización condicional + desglose + total computado.
- `apps/web/app/_actions/credit-cards.ts` (`payCardPeriod`) — validar cotización cuando hay deuda USD; persistir `fx_rate_to_ars` en el gasto de pago.
- Tests de validación y de `getReviewFlags`; `docs/qa/plan-de-pruebas.md` (CARD-N2-02, REC-N2-02).
- **Migración `0027_card_fx_at_statement_payment.sql`** (detectada en QA — el análisis original
  decía "migraciones no afectadas", incorrecto): el trigger `trg_fn_credit_transaction_invariants`
  imponía el modelo viejo a nivel DB. Cambian dos reglas: (1) **I-CRED-11 se relaja** — el consumo
  USD en tarjeta ya no exige `fx_rate_to_ars` (cuando está presente debe ser > 0); (2) los
  **gastos no-credit** ahora pueden llevar `fx_rate_to_ars > 0` (el gasto de pago del resumen
  persiste la cotización del día). La regla NULL estricta se mantiene para todo tipo no-expense;
  I-CRED-6 sin cambios. Aplicada al proyecto remoto vía `supabase db push` (historial reparado
  0001–0026, que estaba vacío).

**No afectado (intencional):**

- El cómputo de deuda por moneda (`pendingAmountARS`/`pendingAmountUSD`) ya es correcto y no cambia.
- Consumos USD históricos con `fx_rate_to_ars` cargado: el dato queda como registro; no se migra ni borra.
- El exchange ARS↔USD entre cuentas (otro flujo, no tarjeta).
