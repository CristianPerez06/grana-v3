## Context

El módulo `shared` (Compartido) está implementado y archivado (web). Es el **primer caso de lectura cruzada entre usuarios** de v3: la migración `0023_shared.sql` ensanchó el SELECT de `transactions` para que un miembro lea las filas compartidas de su hogar, y la escritura quedó owner-only. La frontera de seguridad real, sin embargo, terminó viviendo en las server actions (`apps/web/app/_actions/shared.ts`): la action lee/valida y recién después escribe. La auditoría de `docs/design/shared/decisiones-rediseno.md` (Parte B) detectó que varias de esas validaciones **no tienen respaldo en la base**, y que dos policies son explotables por uso normal.

Restricciones duras del repo (AGENTS.md):

- **Supabase es online-only.** No hay DB local ni `config.toml`; las migraciones se aplican pegando SQL en el dashboard y los tipos se regeneran con `supabase gen types`. **No existe** un harness de integración multi-usuario para probar RLS en runtime.
- **Las migraciones son la verdad del schema.** Toda regla contable que importa debe quedar en migración + tipos + tests donde aplique.
- **`Money` + `NUMERIC(18,2)`**; deuda **derivada por moneda, nunca persistida** (vive en `packages/money-logic/src/shared.ts`).
- Helper `is_household_member(uuid)` y `reverse_settlement(uuid)` ya existen como `SECURITY DEFINER` (patrón a imitar).

Estado puntual de lo explotable hoy (`0023_shared.sql`):

```sql
-- household_invite SELECT — rama abierta: cualquier logueado lista TODA invitación viva
using ( is_household_member(household_id) OR (used_by IS NULL AND expires_at > now()) )
-- household_member INSERT — solo chequea identidad: self-insert a CUALQUIER hogar
with check ( user_id = auth.uid() )
-- settlement UPDATE — cualquier miembro edita CUALQUIER campo de CUALQUIER settlement
using (is_household_member(household_id)) with check (is_household_member(household_id))
```

## Goals / Non-Goals

**Goals:**

- Cerrar B1: invitaciones legibles solo por miembros; sumarse a un hogar **solo** con una invitación válida, vía operación privilegiada atómica.
- Cerrar B2: impedir en la base el borrado de un gasto compartido que cambiaría una deuda ya liquidada.
- Cerrar B5: que ningún miembro pueda mutar campos arbitrarios de un `settlement`; las transiciones pasan por operaciones privilegiadas acotadas al rol.
- Cerrar B6: alta y confirmación de liquidación **atómicas** (sin pata huérfana), simétricas a `reverse_settlement`.
- Cerrar B7: bajar tres invariantes a la base (splits suman el total · dueño de split es miembro · un hogar activo por usuario).
- Dejar tests que fallen si la migración pierde cualquiera de estas garantías.

**Non-Goals:**

- **Cero UI.** No se rediseña ninguna pantalla (eso es Paso 3). Solo cambian server actions y SQL.
- **No** se introduce el modelo de cuenta corriente / contraasiento (Paso 3). B2 acá es un **bloqueo**, no una reversión por contraasiento.
- **No** se re-deriva la deuda en SQL: el ceiling "monto ≤ deuda" sigue calculándose en TS (`householdDebtAt`) antes de invocar la RPC. La RPC garantiza atomicidad y autoría, no recalcula la deuda.
- **No** se toca la lógica de bimoneda ni el reloj devengado (eso es Paso 2).
- **No** se cambian contratos que mobile consume.

## Decisions

### D1 · Unirse por código pasa a una RPC `SECURITY DEFINER`, no a RLS pura

**Decisión:** crear `join_household_by_code(p_code text) returns uuid` (`SECURITY DEFINER`), que valida y crea la membresía + reclama la invitación + setea el split 50·50, todo en una transacción. La action `joinHousehold` deja de leer la invitación y de insertar la membresía.

**Por qué no RLS pura:** con las invitaciones ya **no legibles por no-miembros** (cierre del leak de lectura), el cliente no puede resolver `código → household_id` por su cuenta; necesita una operación privilegiada que lo haga. Esa misma operación es el lugar natural para validar cupo/vencimiento/uso y reclamar el código **atómicamente** (hoy el reclamo es best-effort y puede dejar la invitación sin marcar). La RPC lanza excepciones con mensajes distinguibles que la action mapea a `fieldErrors.code` (inválido / usado / vencido / hogar completo / ya tenés hogar).

**Alternativa descartada:** dejar el INSERT en el cliente con un `WITH CHECK` que exija "existe una invitación viva para este hogar". No sirve: el cliente igual no puede descubrir el `household_id` sin leer la invitación, y abriría de nuevo la lectura.

### D2 · `household_member` INSERT directo se acota al creador-primer-miembro

**Decisión:** la policy de INSERT pasa de `user_id = auth.uid()` a permitir el self-insert **solo** cuando el usuario es el `created_by` del hogar y el hogar **no tiene miembros aún**. Es exactamente el flujo `createHousehold` (crear hogar → insertarse como primer miembro). El segundo miembro entra únicamente por la RPC `join_household_by_code` (definer, bypassa RLS).

**Por qué:** elimina el self-insert a hogares ajenos sin colapsar el flujo de creación, que es el único alta de membresía legítima desde el cliente.

### D3 · `settlement` queda RPC-only para escritura; SELECT para miembros

**Decisión:** se eliminan las policies de INSERT/UPDATE/DELETE directas sobre `settlement`. Quedan: SELECT para miembros (lectura del hogar) y nada de escritura directa. Las tres mutaciones pasan por RPCs `SECURITY DEFINER`: `register_settlement` (alta), `confirm_settlement` (confirmación del receptor), `reverse_settlement` (ya existe). El borrado de una liquidación **pendiente** sigue ocurriendo por el borrado de la **pata del pagador** (su propia `transaction`, gobernada por la RLS owner-only de `transactions`), que cascadea la fila `settlement` vía FK — no necesita policy de DELETE sobre `settlement`.

**Por qué (B5+B6 convergen):** una vez que toda transición es una RPC definer, la tabla no necesita ninguna escritura directa, y "qué campos puede tocar quién" deja de ser un problema de RLS por-columna (que Postgres no expresa) y pasa a ser lógica explícita dentro de cada RPC, que fija `payer_id`/`receiver_id` desde `auth.uid()` y valida el estado.

### D4 · `register_settlement` y `confirm_settlement`: atómicas, autoría server-side, sin recálculo de deuda

**Decisión:**

- `register_settlement(p_account_id uuid, p_amount numeric, p_currency text) returns uuid`: valida que el caller sea miembro de un hogar de 2; inserta la pata `out` en `transactions` (con `user_id = auth.uid()`) **y** la fila `settlement` (`payer_id = auth.uid()`, `status = 'pending_receipt'`) en la misma función; devuelve el id de la settlement.
- `confirm_settlement(p_settlement_id uuid, p_account_id uuid) returns void`: valida que el caller sea el `receiver_id` y que el estado sea `pending_receipt`; inserta la pata `in` y marca `completed` + `resolved_at`, atómico.

**Por qué no recalcular la deuda en la RPC:** la derivación (gating de cuotas, reintegros recibidos, por moneda) vive en `money-logic` (TS) y replicarla en PL/pgSQL duplicaría una regla contable delicada con alto riesgo de divergencia. El ceiling "monto ≤ deuda en esa moneda" es una guarda de UX/validación que se mantiene en la action; el invariante que **sí** importa para integridad —no dejar una pata de movimiento huérfana ni una settlement con autor falsificado— lo da la atomicidad + `auth.uid()` de la RPC.

### D5 · B2 como guarda de borrado en la base + mensaje en la action

**Decisión:** trigger `BEFORE DELETE` sobre `transactions`: si `OLD.is_shared` y existe **alguna** fila `settlement` en `OLD.household_id`, abortar. `deleteTransaction` agrega la misma guarda con copy explicativo ("revertí la liquidación antes de borrar este gasto compartido").

**Por qué "alguna" settlement y no solo las relevantes:** el modelo **no imputa pagos a gastos puntuales** (descarte B17); una liquidación salda el **neto**. No hay forma coherente de decidir qué gasto "cubrió" una liquidación, así que la única regla sólida es: con una liquidación viva en el hogar, los gastos compartidos no se borran (se contraasientan, en el Paso 3). Las patas de `settlement` quedan exentas porque tienen `is_shared=false`, así que `reverse_settlement` y el borrado de liquidación pendiente siguen funcionando.

### D6 · B7 — tres invariantes como triggers

- **Splits suman el total:** `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` sobre `shared_expense_split` (INSERT/UPDATE/DELETE) que, al cierre de la transacción, verifica `SUM(amount_assigned) = transactions.amount` para cada `transaction_id` afectado (que aún exista). Diferido porque los splits se insertan fila por fila. Para cuotas el chequeo es por cuota hija (cada `transaction_id` es la hija), que es justo lo que se quiere.
- **Dueño de split es miembro:** trigger `BEFORE INSERT/UPDATE` que aborta si `NEW.user_id` no es miembro de `NEW.household_id`.
- **Un hogar activo por usuario:** trigger `BEFORE INSERT` sobre `household_member` que aborta si el usuario ya es miembro de algún hogar con `is_active = true` (complementa el trigger `max-2` existente y respalda la decisión A1). Aplica tanto al creador como al que se une por RPC.

### D7 · Tests = aserciones estáticas sobre el SQL

**Decisión:** un test nuevo en `apps/web/lib/shared/__tests__/` (vitest, node) que lee `0043_shared_security_hardening.sql` y asevera por regex que: la rama abierta del SELECT de `household_invite` ya no está; existen `join_household_by_code` / `register_settlement` / `confirm_settlement` como `SECURITY DEFINER`; no hay policy de UPDATE directa sobre `settlement`; está el trigger de guarda de borrado; están los tres triggers de invariante.

**Por qué:** es el patrón ya usado por el repo (`recurrences/__tests__/migration.test.ts`) y el **único** posible siendo online-only. No prueban comportamiento en runtime —eso requeriría un harness multi-usuario que el repo no tiene y que contradice el modelo online-only— pero blindan contra la regresión de "alguien edita la migración y borra una garantía". El self-check `DO $$` embebido en la propia migración cubre la validación estructural al aplicarla.

## Risks / Trade-offs

- **[Los tests no ejercen RLS en runtime]** → Mitigación: el self-check `DO $$` de la migración valida estructura al aplicarla en el dashboard; los tests estáticos blindan la forma; y la verificación de comportamiento se hace manualmente con dos usuarios QA al aplicar (flujo de reporte por ID del usuario). Es la mejor cobertura posible bajo online-only.
- **[El ceiling de deuda sigue en TS, no en la RPC]** → Mitigación: aceptado por D4; el invariante de integridad (atomicidad + autoría) sí baja a la base. Un monto que exceda la deuda es un error de validación, no un agujero de seguridad: a lo sumo crea una liquidación de más que queda reflejada y es reversible.
- **[Cambiar el flujo de `joinHousehold` a RPC puede romper los mensajes de error granulares]** → Mitigación: la RPC lanza excepciones con códigos/mensajes distinguibles que la action mapea a los mismos `fieldErrors.code` actuales (inválido / usado / vencido / completo / ya tenés hogar).
- **[El trigger diferido de "splits suman el total" podría chocar con flujos de edición que reescriben splits]** → Mitigación: al ser `INITIALLY DEFERRED`, la suma se evalúa al **commit**, no fila por fila, así que el "borrar todos + reinsertar" de la reconciliación del toggle compartido (`applySharedSplits`) queda consistente dentro de la transacción. Si un `transaction_id` fue borrado, no se chequea (no existe el target).
- **[Bloquear el borrado con cualquier settlement viva puede frustrar al usuario que quiere corregir un gasto viejo]** → Mitigación: es deliberado y temporal; el Paso 3 introduce el contraasiento que da la salida correcta. El copy explica por qué y qué hacer (revertir la liquidación primero).

## Migration Plan

1. Escribir `supabase/migrations/0043_shared_security_hardening.sql` con: drop+recreate de policies (`household_invite`, `household_member`, `settlement`), las tres RPCs nuevas, los cuatro triggers (guarda de borrado + tres invariantes), y un `DO $$` self-check + summary final (patrón de `0023`).
2. Aplicar el SQL en el dashboard de Supabase (online-only) y verificar que el self-check no levante excepción.
3. Regenerar tipos: `supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa` → `packages/supabase/src/types.ts` (para las nuevas RPCs).
4. Actualizar las server actions (`shared.ts`, `transactions.ts`) para usar las RPCs y la guarda.
5. Agregar los tests estáticos y correr `pnpm --filter web test`, `pnpm typecheck`, `pnpm lint`.
6. Archivar el change en la branch (sync de `openspec/specs/shared/spec.md`), `pnpm openspec:check`, y dejar la branch lista. El merge lo hace el usuario.

**Rollback:** las RPCs y triggers nuevos se pueden `DROP` y las policies revertir a su forma `0023` con una migración inversa; no hay cambios de datos destructivos (solo policies/functions/triggers).

## Open Questions

- Ninguna que bloquee la implementación. Las decisiones de presentación/UX quedan fuera de alcance (Paso 3). La verificación funcional con dos usuarios QA la coordina el usuario tras aplicar la migración.
