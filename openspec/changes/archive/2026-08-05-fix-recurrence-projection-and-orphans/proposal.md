# Proposal: fix-recurrence-projection-and-orphans

## Why

El hub de recurrencias muestra ocurrencias que nunca van a ocurrir, y borrar un movimiento rompe en silencio la regla que lo creó.

Caso real (4-ago-2026): las cards "Próximos 7 días" y "Más adelante este mes" mostraban filas duplicadas de $1.500.000 y $270.000. La proyección (`projectUpcomingOccurrences`) camina el calendario desde `start_date` e **ignora `last_generated_date`**, así que dibuja ocurrencias ya cubiertas por un movimiento real. Su gemela `getNextExpectedOccurrence` sí lo honra y documenta por qué — dos funciones del mismo archivo responden distinto a la misma pregunta. La consecuencia no es cosmética: toda regla creada desde un movimiento dibuja su propia semilla como "próxima".

La otra mitad del defecto es de datos. `recurrences.created_from_transaction_id` es `ON DELETE SET NULL` y `deleteTransaction` no toca `recurrences`, así que borrar el movimiento semilla deja la regla viva, sin vínculo, indistinguible de una regla creada directamente. Hoy hay **10 reglas huérfanas repartidas entre los 3 usuarios**. La mayoría son benignas (su `last_generated_date` ya avanzó y siguen generando bien), pero cuando la semilla borrada era **futura** la regla queda inservible: afirma haber cubierto una ocurrencia cuyo movimiento ya no existe y no vuelve a generar hasta `last_generated_date + intervalo`, perdiendo ese período. Nada en la UI avisa de esto al borrar.

## What Changes

- **La proyección honra el cursor**: `projectRuleOccurrences` recibe `last_generated_date` y descarta las ocurrencias en o antes del cursor, igual que `getNextExpectedOccurrence`. Una ocurrencia ya materializada (semilla o instancia confirmada) deja de dibujarse como próxima. Las cards de "Próximos 7 días" / "Más adelante este mes" quedan **especificadas por primera vez** — hoy no hay ningún requirement que las cubra.
- **BREAKING (schema)**: `recurrences.created_from_transaction_id` pasa de `ON DELETE SET NULL` a `ON DELETE RESTRICT`. La base rechaza borrar un movimiento que sembró una regla viva, para todos los clientes (web, mobile, SQL manual), no solo para el frontend que se acuerde. Borrar un movimiento semilla pasa a ser una operación de dos pasos.
- **Flujo de borrado en dos pasos**: al intentar borrar un movimiento semilla, el sistema SHALL explicar que creó una recurrencia y ofrecer resolver la regla primero (eliminarla, o desvincularla conservándola). Sin confirmación no se borra nada. Web y mobile comparten la misma lógica desde `@grana/transactions-mutations`.
- **Reparación acotada de huérfanas**: migración que pone `last_generated_date = NULL` **solo** donde `created_from_transaction_id IS NULL AND last_generated_date = start_date AND last_generated_date > hoy_AR` — la clase inservible. Las huérfanas benignas y las de fecha pasada NO se tocan: ahí `NULL` propondría re-crear un movimiento que el usuario borró a propósito.
- **Coherencia preset↔intervalo enforced en la DB**: hoy existe una regla con `frequency='weekly'` e `interval_unit='month'` — el motor corre mensual y la UI dice "Semanal". La migración normaliza la **etiqueta** a partir del intervalo (preserva el comportamiento; solo deja de mentir) y agrega un `CHECK` que impide que un preset vuelva a desincronizarse.
- **Aviso de regla duplicada**: al crear una regla, si ya existe una activa con el mismo `(cuenta, moneda, tipo, monto)`, el sistema SHALL avisar antes de confirmar. El aviso NO SHALL bloquear: dos reglas iguales pueden ser legítimas. El hub SHALL además señalar las reglas activas casi idénticas ya existentes, para que cada usuario resuelva las suyas.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. **Nuevo requirement** "El hub de recurrencias proyecta las próximas ocurrencias sin repetir lo ya materializado" — la proyección informativa, sus dos ventanas y la regla del cursor. Superficie hoy no especificada.
  2. "El usuario puede eliminar una transacción" — suma el guard de movimiento semilla y el flujo de dos pasos.
  3. "El usuario puede editar y eliminar un movimiento desde el módulo global" — el mismo guard desde el listado global.
  4. "El usuario puede gestionar, pausar y eliminar reglas recurrentes" — la trazabilidad hacia la regla deja de ser condicional ("si la FK sigue disponible"): con `RESTRICT` el vínculo siempre sobrevive.
  5. "La generación de instancias recurrentes usa intervalo+unidad y corta por la primera condición de fin" — suma la invariante preset↔intervalo respaldada por `CHECK`.
  6. **Nuevo requirement** "El sistema avisa cuando una regla recurrente duplica una existente" — aviso no bloqueante al crear + señalización en el hub, con paridad web/mobile.

## Impact

- **Migración** (nueva): FK `created_from_transaction_id` → `ON DELETE RESTRICT`; normalización de `frequency` desincronizado + `CHECK` de coherencia preset↔intervalo; reparación acotada de `last_generated_date` en huérfanas futuras.
- `packages/money-logic/src/recurrences.ts`: `RuleForProjection` gana `last_generated_date`; `projectRuleOccurrences` / `projectUpcomingOccurrences` aplican el cursor.
- `packages/transactions-mutations/src/thin-mutations.ts` (`deleteTransaction`): detecta la regla sembrada y devuelve un resultado accionable en vez de dejar que la FK falle cruda.
- `packages/recurrences/src/mutations.ts` (`createRecurrence`) y `create-recurrence-from-movement.ts`: detección de duplicado previa a la inserción.
- `packages/recurrences/src/queries.ts`: el read del hub expone `last_generated_date` y marca reglas casi idénticas.
- `apps/web/app/(app)/transactions/recurring/_components/upcoming-recurrences.tsx`, el detalle de movimiento y el drawer de alta de recurrencia.
- `apps/mobile`: hub, detalle de regla y borrado de movimiento heredan el guard y el aviso desde la capa compartida.
- **Datos existentes**: 10 reglas huérfanas (2 inservibles, ambas de `cristian.ap84`), 1 `frequency` desincronizado (`julieta.malacalza`), y grupos de reglas duplicadas en 2 usuarios que quedan a criterio de cada dueño — el change las hace visibles, no las borra.
- **UX**: borrar un movimiento semilla deja de ser un click. Es el costo deliberado de que la garantía viva en la base y no en cada cliente.
