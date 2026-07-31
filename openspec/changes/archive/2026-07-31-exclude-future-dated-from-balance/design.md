# Design: exclude-future-dated-from-balance

## Context

Ningún read de saldo recorta por fecha: `get_account_balance_sums` (0051) suma toda fila on-ledger (`status IS NULL`) y sus espejos TS hacen lo mismo. El defecto existe desde el origen del módulo de cuentas, pero quedó visible recién con el fix de agregación en Postgres (antes el truncado de PostgREST escondía filas recientes). Además, el form de movimientos con toggle "Recurrente" crea el movimiento semilla como transacción real con la fecha elegida — si esa fecha es futura, el "gasto recurrente sin aprobar" ya movió el saldo, contradiciendo el modelo de instancias pendientes (que sí está bien implementado: viven en `recurrence_instances` y nunca tocan saldo).

Estado actual relevante:

- Producción lee saldos solo vía RPC (`@grana/accounts` y `@grana/dashboard`); `calculateTransactionSums` sobrevive como fuente de verdad de reglas de signo anclada por el test de paridad SQL↔TS.
- `computeRunningBalances` alimenta el saldo corriente por fila del detalle de cuenta (proyección cronológica).
- La creación directa de reglas (`/transactions/recurring`) ya tiene la semántica deseada: regla sin transacción, primera instancia en `start_date`.

## Goals / Non-Goals

**Goals:**

- Saldo actual (Hero/Disponible, "Dónde está", listado y detalle de cuentas) = solo transacciones con `date <= hoy_AR`.
- Paridad SQL↔TS extendida al corte temporal, con `hoy` inyectable (tests determinísticos).
- Form: "Recurrente" + fecha futura ⇒ regla directa sin semilla; primera instancia pendiente cae en esa fecha.

**Non-Goals:**

- No se tocan las lentes de período (`summarizePeriod`, `buildMonthBalanceSeries`, breakdown por categoría): siguen operando sobre la ventana del mes completa.
- No cambia `computeRunningBalances`: el saldo corriente por fila sigue siendo proyección (una fila futura muestra su saldo proyectado).
- No se agrega validación que bloquee fechas futuras en el form (siguen permitidas; solo dejan de contar hasta su fecha).
- No se migra ni borra data existente: transacciones futuras ya creadas quedan como están y se auto-corrigen al aplicar el corte.

## Decisions

1. **El corte vive en el RPC, no en los callers.** Una sola cláusula `and t.date <= v_today` en el CTE `tx` de `get_account_balance_sums` cubre Hero, "Dónde está", listado y detalle a la vez (todos consumen esta función). Alternativa descartada: filtrar en cada caller TS — reintroduce la divergencia por olvido que 0051 vino a eliminar.

2. **`hoy` es un parámetro opcional del RPC con default en timezone AR.** Firma nueva: `get_account_balance_sums(p_account_ids uuid[] default null, p_today date default null)`, con `v_today = coalesce(p_today, (now() at time zone 'America/Argentina/Buenos_Aires')::date)`. Los callers TS pasan `formatDateISO(getTodayAR())` para que el "hoy" del saldo sea idéntico al "hoy" del resto de la UI; el default en SQL protege a cualquier caller que no lo pase y hace el corte correcto sin depender del reloj del cliente. `current_date` a secas queda prohibido (Supabase corre en UTC: adelantaría el día hasta 3 horas). El parámetro además da determinismo al test de paridad/migración (puede fijar `p_today`).

3. **`calculateTransactionSums` gana `date` en el row type y `todayISO` como parámetro requerido.** `BalanceTransactionRow` suma `date: string`; la función filtra `row.date <= todayISO` antes de aplicar signos. Parámetro requerido (no opcional): el único caller productivo es el test de paridad y un default silencioso ("sin corte") es exactamente el bug que estamos arreglando. `computeRunningBalances` no recibe el parámetro — su contrato es la proyección.

4. **Migración `0052_balance_temporal_cut.sql`**: `create or replace` de la función con la nueva firma + self-check (`pg_get_functiondef` contiene `America/Argentina/Buenos_Aires` y `p_today`; sigue `SECURITY INVOKER`; sigue derivando de `get_owned_account_ids`; sigue excluyendo `status is not null`). Nota PostgREST: cambiar la firma agregando un parámetro con default no rompe los callers existentes que solo pasan `p_account_ids`.

5. **Form tweak en la capa compartida.** `use-movement-form.ts` (submitCreate): si `isRecurrent && date > todayStr()` (y el tab admite recurrencia — mismo guard actual), se saltea la creación del movimiento y se invoca un nuevo mutator `createRecurrenceDirect` del contrato `MovementFormMutators`, que web wirea a la mutation de creación directa existente en `@grana/recurrences` (`created_from_transaction_id = NULL`, `last_generated_date = NULL`, `start_date = date`, mismos campos que hoy snapshotea `createRecurrenceFromMovement`). Con `date <= hoy` el flujo actual no cambia. Mobile hereda el contrato cuando consuma el form (backlog existente).
   - Alternativa descartada: crear la semilla con un flag "programada" en `transactions` — violaría el requirement "las instancias pendientes no son transacciones reales" y reintroduciría estados en `transactions.status`.

6. **Sin cambios de UX copy más allá del mínimo.** El drawer cierra igual; no aparece un movimiento nuevo en el feed (correcto: no existe). Si el usuario navega a `/transactions/recurring` ve la regla con su próxima ocurrencia. Un toast diferenciado ("Regla creada; la primera instancia cae el X") es mejora opcional de i18n dentro del change.

## Risks / Trade-offs

- **[Salto de saldo al llegar la fecha]** El día que una transacción futura entra en vigencia, el Disponible cambia sin acción del usuario → es la semántica elegida (opción 1) y queda especificada con scenario propio; el eyebrow del Hero ("PARA GASTAR · HOY") ya comunica el corte.
- **[Header ≠ saldo corriente de la fila superior]** Con movimientos futuros, el header de la cuenta (corte a hoy) difiere del running balance de la última fila (proyección) → decisión consciente, documentada en el delta de `transactions`; revisar copy solo si genera confusión real.
- **[Firma nueva del RPC]** Tipos generados de `packages/supabase` deben regenerarse/curarse a mano para reflejar `p_today` → tarea explícita; el default null mantiene compatibilidad de llamada.
- **[Drift de "hoy" cliente↔servidor]** Cliente con reloj corrido pasaría un `p_today` desviado → mismo riesgo que ya acepta todo el resto de la app al usar `getTodayAR()` del cliente; el default AR en SQL acota el daño para callers que no pasan el parámetro.
- **[Semillas futuras pre-existentes]** Transacciones futuras creadas antes del change siguen existiendo como movimientos reales (sin regla de instancia) → dejan de contar hasta su fecha por el corte; no se migran. Si el usuario quiere el gate de aprobación para ellas, las borra y recrea con el flujo nuevo.

## Migration Plan

1. Aplicar `0052` (create or replace, aditiva sobre la firma). Rollback: re-aplicar la definición de 0051.
2. Deploy de app con callers pasando `p_today` + espejos TS actualizados. Orden seguro: migración primero (el default AR ya corta bien aunque la app vieja no pase el parámetro).

## Open Questions

- Ninguna bloqueante. (Toast diferenciado del caso "regla sin semilla": decidir copy al implementar; default = éxito genérico actual.)
