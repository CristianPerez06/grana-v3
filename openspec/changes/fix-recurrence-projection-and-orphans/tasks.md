## 1. Caminante único de calendario (`@grana/money-logic`)

- [x] 1.1 Extraer `walkOccurrences(rule, { from, to, cursor })` en `packages/money-logic/src/recurrences.ts`, aplicando en un solo lugar `max_occurrences`, `end_date`, el clamping de fin de mes anclado a `start_date` y el cursor (`> cursor`), con el mismo cap de seguridad de ~750 pasos.
- [x] 1.2 Reescribir `getNextExpectedOccurrence` como "el primero que devuelve el caminante", verificando que su comportamiento actual no cambia (los tests existentes deben pasar sin editarlos).
- [x] 1.3 Agregar `last_generated_date: string | null` a `RuleForProjection` y reescribir `projectRuleOccurrences` / `projectUpcomingOccurrences` sobre el caminante, pasando el cursor.
- [x] 1.4 Tests: una regla con `lgd = start_date` no proyecta esa fecha; una regla directa (`lgd = NULL`) sí proyecta `start_date`; una regla con `lgd` futuro no proyecta esa ocurrencia y sí la siguiente; ventanas disjuntas; una instancia pendiente NO avanza el cursor y su fecha se sigue proyectando.
- [x] 1.5 Test de coherencia: para un set de reglas, la primera ocurrencia de `projectRuleOccurrences` coincide siempre con `getNextExpectedOccurrence` — la garantía que impide que vuelvan a divergir.

## 2. Consumers de la proyección

- [x] 2.1 `packages/recurrences/src/queries.ts`: exponer `last_generated_date` en el summary del hub (verificar que `RECURRENCE_SELECT` ya lo trae y no hace falta query nueva).
- [x] 2.2 `apps/web/app/(app)/transactions/recurring/_components/upcoming-recurrences.tsx`: pasar `last_generated_date` al construir `RuleForProjection`.
- [x] 2.3 Verificar que la "próxima fecha" del hub (web y mobile) sale del mismo caminante y no de un cálculo propio.

## 3. Migración

- [x] 3.1 Crear `supabase/migrations/00XX_recurrence_integrity.sql` con los cuatro pasos **en orden**: (1) `UPDATE` normalizando `frequency` desde `interval_count`/`interval_unit`; (2) `ADD CONSTRAINT` del `CHECK` preset↔intervalo (`custom` libre); (3) `UPDATE` de `last_generated_date = NULL` donde `created_from_transaction_id IS NULL AND last_generated_date = start_date AND last_generated_date > hoy_AR`; (4) `DROP`/`ADD` del FK `created_from_transaction_id` con `ON DELETE RESTRICT`.
- [x] 3.2 Computar el "hoy" del paso 3 con `(now() at time zone 'America/Argentina/Buenos_Aires')::date` — `current_date` a secas está prohibido (Supabase corre en UTC).
- [x] 3.3 Verificar que el paso 2 no falla contra los datos actuales (la fila `frequency='weekly'` / `interval_unit='month'` debe quedar normalizada por el paso 1 antes del `CHECK`).
- [x] 3.4 **Verificación explícita del riesgo de cascada**: confirmar contra el esquema que ningún DELETE en cascada legítimo choca con el nuevo `RESTRICT` — `accounts → transactions` solo se dispara al eliminar una cuenta y eso ya está prohibido con transacciones (`accounts/spec.md:239`); `parent_id` de cuotas nunca apunta a una semilla porque las recurrencias excluyen compras en cuotas.
- [x] 3.5 Actualizar `supabase/validate_schema.sql` si corresponde (constraint nuevo + FK cambiada).

## 4. Guard de borrado de movimiento semilla

- [x] 4.1 `packages/transactions-mutations/src/thin-mutations.ts` (`deleteTransaction`): antes de borrar, consultar si existe una regla no eliminada con `created_from_transaction_id = <tx>`; si existe, devolver un resultado accionable (`errorCode: 'seeded_recurrence'` + id, título y próxima fecha de la regla) sin borrar nada.
- [x] 4.2 Implementar la salida **"eliminar también la regla"**: `deleteRecurrence` (que ya limpia instancias pendientes) y luego el borrado del movimiento, en ese orden.
- [x] 4.3 Implementar la salida **"conservar la regla, desvincular"**: `UPDATE created_from_transaction_id = NULL` y, si `last_generated_date = start_date` y esa fecha es futura, también `last_generated_date = NULL`; después borrar el movimiento.
- [x] 4.4 Mapear el `23503` de la FK en el traductor de errores como red de seguridad para callers que no pasen por la mutación compartida.
- [x] 4.5 Tests de las tres ramas (bloqueo sin elección, eliminar regla, desvincular con y sin reparación de cursor).

## 5. UI del guard (web + mobile)

- [x] 5.1 Web: diálogo de eliminación del detalle de movimiento — cuando la mutación devuelve `seeded_recurrence`, mostrar el nombre de la regla y las dos salidas.
- [x] 5.2 Web: mismo camino desde el detalle global `/transactions/<id>`.
- [x] 5.3 Mobile: misma UX sobre la mutación compartida, idiomática por plataforma.
- [x] 5.4 Copy nuevo en `packages/i18n-messages` (es), sin exponer detalles técnicos ni nombres de columnas.

## 6. Aviso de regla duplicada

- [x] 6.1 Helper puro de detección en `@grana/recurrences`: dada la regla candidata y las activas del usuario, devolver las que colisionan por `(account_id, currency_code, movement_type, amount)`.
- [x] 6.2 Cablearlo en `createRecurrence` y en `createRecurrenceFromMovement` como aviso **no bloqueante** previo a confirmar (nunca como rechazo).
- [x] 6.3 Señalizar en el hub las reglas activas que colisionan entre sí, sin acciones automáticas.
- [x] 6.4 Tests: colisión detectada; duplicado legítimo (dos suscripciones USD 20 en la misma tarjeta) avisa pero permite confirmar; distinto monto o cuenta no avisa.

## 7. Cierre

- [x] 7.1 `pnpm lint` y `pnpm typecheck` en verde.
- [x] 7.2 Suite de tests en verde, con los nuevos casos de 1.4, 1.5, 4.5 y 6.4.
- [x] 7.3 Verificar contra datos reales que las reglas sanas de los tres usuarios conservan sus fechas proyectadas y que solo desaparecen las ocurrencias ya cubiertas.
- [x] 7.4 `openspec validate --changes fix-recurrence-projection-and-orphans --strict` en verde.
