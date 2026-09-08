## Why

La auditoría del 5/9 encontró en el hub de Julieta dos reglas activas del mismo préstamo: "Prestamo Anses" de 48.733,92 y otra sin título de 48.723,04, en la misma cuenta. Compromisos las suma dos veces (97.456,96 de gastos fijos). La detección de duplicados existente exige monto exacto, así que no las señaló ni avisó al crear la segunda; el detector del script, con ±1 %, sí las atrapa. Además, la app nativa no tiene ni el aviso al crear ni la marca "Duplicada" del hub: una capacidad presente en web y ausente en nativo.

## What Changes

- La clave de duplicado pasa a `(cuenta, moneda, tipo)` más monto **igual o casi igual**: diferencia relativa de hasta el 1 % del mayor, inclusive. Sigue ignorando categoría y descripción, y sigue sin bloquear.
- El hub agrupa las reglas que colisionan bajo esa misma tolerancia (encadenando vecinos por monto dentro de cada cuenta, moneda y tipo).
- Paridad nativa: el form de crear regla avisa antes de crear (mismo mecanismo de "avisar y dejar pasar el siguiente submit" que web) y el hub muestra la marca "Duplicada".
- Textos del aviso y de la marca actualizados en `es` y `en` para decir "monto igual o casi igual".

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `transactions`: el requirement "El sistema avisa cuando una regla recurrente duplica una existente" incorpora la tolerancia del 1 %, un escenario de monto casi igual y la paridad nativa.

## Impact

- `@grana/recurrences`: `duplicates.ts` (`closeAmounts`, `DUPLICATE_AMOUNT_TOLERANCE`, `findDuplicateRules`, `groupDuplicateRules`) y sus tests en `apps/web/lib/recurrences/__tests__/duplicates.test.ts`.
- `@grana/i18n-messages`: `recurrences.duplicate_hint`, `duplicate_warning_body`, `duplicate_warning_body_untitled`.
- Nativo: `apps/mobile/lib/recurrences/queries.ts` (`getDuplicateRules`), `components/recurrences/RecurrenceForm.tsx` (aviso), `RecurrenceRuleCard.tsx` y `app/(app)/transactions/recurring/index.tsx` (marca).
- Web: sin cambios de código; el modal de crear y el hub consumen el paquete y heredan la tolerancia.
- Dato: la regla sobrante de Julieta se pausa a mano desde el hub, que ahora la marca.
