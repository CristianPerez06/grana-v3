# Capture Card Dates at Statement

## Why

El alta de tarjeta en producción exige las fechas del "Próximo resumen" (4 fechas en total), un dato que el usuario **no tiene**: el banco anuncia las fechas del ciclo siguiente recién cuando cierra el ciclo actual y emite el extracto. El problema es sistémico, no solo del alta: el invariante actual del spec de cards ("al pagar P(n) el formulario DEBE pedir las fechas de P(n+2)") contradice su propio "Contexto del banco" — toda la cadena de captura está corrida un período y cada fecha se carga adivinada un resumen antes de ser anunciada, persistida además con `is_estimated=false` como si fuera real.

## What Changes

- **Alta de tarjeta pide solo 2 fechas** (cierre y vencimiento del resumen actual, P1). Los campos "Próximo resumen" se eliminan del formulario y del schema de validación. **BREAKING** (contrato de `createCreditCard` / `createCreditCardSchema`).
- **El período siguiente (P2) nace estimado en el alta**: se crea eager con `is_estimated=true`, proyectando con el algoritmo de sugerencia existente (promedio de ciclos previos; fallback +30/+45 días cuando no hay historial).
- **El formulario de pago deja de pedir P(n+2) y pasa a confirmar P(n+1)** — el ciclo en curso, cuyas fechas reales el resumen recién emitido anuncia. Las fechas confirmadas "pisan" el período estimado vía el upsert existente sobre `(account_id, start_date)` y lo marcan `is_estimated=false`. **BREAKING** (semántica de `next_end_date`/`next_due_date` en `payCardPeriod`).
- **El pisado reusa la cascada de reasignación**: si el cierre real difiere del estimado, las transacciones que quedan fuera del rango nuevo se reubican con la lógica de edición de fechas de período ya especificada.
- **`start_date` nunca se estima ni se pide**: sigue siendo siempre `end_date` del período anterior + 1 día, conocido con certeza.
- **Señalización discreta de "fechas estimadas"** en el timeline del detalle de tarjeta y en el drawer de edición. No se señaliza en el hero de cards ni en el dashboard (superficies de lectura).
- **Sin migración de datos**: los períodos ya creados en producción con fechas adivinadas y `is_estimated=false` quedan como están; son corregibles vía drawer de edición y vía el nuevo flujo de pago.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`: cambia el invariante central de captura de fechas — el alta crea P1 real + P2 estimado (antes: P1 y P2 reales ingresados por el usuario); el pago de P(n) confirma las fechas de P(n+1) pisando el período estimado (antes: creaba P(n+2) con fechas ingresadas); se agrega la señalización de período estimado en detalle y edición; el pre-llenado del form de pago pasa a mostrar las fechas estimadas del ciclo en curso en lugar de la proyección de P(n+2).

## Impact

- **Validación**: `packages/validation/src/credit-cards.ts` — `createCreditCardSchema` pierde `next_end_date`/`next_due_date`; `payCardPeriodSchema` mantiene los campos pero cambia su semántica (fechas de P(n+1), validadas contra el período que se paga, no contra `max(end_date)`).
- **Actions**: `apps/web/app/_actions/credit-cards.ts` — `createCreditCard` (inserta P2 estimado con proyección), `payCardPeriod` (upsert pasa a apuntar al período en curso + cascada de reasignación).
- **Lógica compartida**: `packages/money-logic/src/cards.ts` — `suggestNextPeriodDates` se reusa; puede requerir un helper para proyectar P2 en el alta con un solo período de historial.
- **UI web**: `apps/web/app/(app)/cards/_components/create-card-form.tsx` (quita sección Próximo resumen), `apps/web/app/(app)/cards/[id]/periods/[periodId]/pay/_components/pay-card-period-form.tsx` (copy y pre-llenado de confirmación), `lifecycle-timeline.tsx` y `edit-card-form.tsx` (badge "estimado").
- **i18n**: `packages/i18n-messages/src/{es,en}.json` — labels y copys nuevos/eliminados.
- **Specs**: `openspec/specs/cards/spec.md` — requirements del alta, del pago y de la tabla de flujo de períodos.
- **Mobile**: sin impacto (cards es web-only; paridad mobile es trabajo de módulo aparte).
- **Datos en producción**: sin migración; comportamiento nuevo aplica solo a operaciones futuras.
