## Why

Compartido es el **primer módulo con lectura cruzada entre usuarios** de v3 y su frontera de seguridad vive hoy en las server actions, no en la base. Una exploración integral (`docs/design/shared/decisiones-rediseno.md`) encontró agujeros reales de RLS y de integridad contable que cualquier uso normal puede disparar. Este es el **Paso 1** del rediseño: endurecer seguridad e integridad **sin tocar la UI**, antes de exponer más superficie en los pasos siguientes. La regla del módulo es no negociable —toca dinero entre dos personas— así que la frontera debe bajar a la base (RLS + RPCs + invariantes), no quedar solo en TypeScript.

## What Changes

- **B1 · Cadena invitación → self-insert (P0).** Hoy la RLS deja a cualquier usuario logueado **listar todas las invitaciones vigentes** del sistema (la policy de SELECT no exige el código exacto) y **sumarse solo** a un hogar ajeno (la policy de INSERT sobre `household_member` solo chequea `user_id = auth.uid()`). Se cierra: las invitaciones pasan a ser **legibles solo por miembros**; unirse por código se hace **exclusivamente** vía una RPC `SECURITY DEFINER` que resuelve el código, valida cupo/vencimiento/uso y crea la membresía de forma atómica. El self-insert directo queda acotado al **creador como primer miembro**.
- **B2 · Borrar gasto compartido con liquidación viva (P0).** Borrar un gasto compartido cascadea sus splits y **cambia la deuda derivada en silencio**, sin guarda si ya hay una liquidación que la contabilizó. Se agrega una **guarda en la base** (trigger `BEFORE DELETE`) que impide borrar un gasto compartido mientras exista una liquidación en el hogar, más un mensaje explicativo en la action. (La reversión por contraasiento es del Paso 3; este paso solo bloquea el borrado destructivo.)
- **B5 · RLS de settlement por rol (P1).** Hoy cualquier miembro puede `UPDATE` cualquier campo de cualquier `settlement`. Se elimina la policy permisiva; todas las transiciones de estado pasan por RPCs `SECURITY DEFINER`, y la tabla queda con SELECT para miembros y sin INSERT/UPDATE directos del cliente.
- **B6 · Crear/confirmar liquidación atómico (P1).** Hoy `registerSettlement` y `assignSettlementAccount` hacen multi-write con rollback manual (riesgo de pata huérfana). Se mueven a RPCs atómicas `register_settlement` y `confirm_settlement` (`SECURITY DEFINER`), simétricas a la ya existente `reverse_settlement`, que fijan `payer_id`/`receiver_id` server-side.
- **B7 · Invariantes en la base (P1).** Tres reglas que hoy viven solo en la app bajan a la base con triggers: (a) los `shared_expense_split` de una transacción **suman exactamente su monto**; (b) el **dueño de un split es miembro** del hogar; (c) **un usuario pertenece a lo sumo a un hogar activo**.
- **Tests.** Aserciones estáticas sobre el SQL de la migración (patrón establecido del repo, `recurrences/__tests__/migration.test.ts`), porque **Supabase es online-only** y no hay harness de RLS multi-usuario. Verifican que las policies endurecidas, las RPCs y los triggers de invariante estén declarados con la forma correcta.

## Capabilities

### New Capabilities
<!-- Ninguna: todo modifica la capability `shared` existente. -->

### Modified Capabilities
- `shared`: la RLS de invitaciones se acota a miembros y el alta por código pasa a una operación privilegiada; el alta y la confirmación de liquidación pasan a operaciones privilegiadas atómicas; la edición directa de `settlement` deja de estar permitida; se agregan invariantes de base (splits suman el total, dueño de split es miembro, un hogar activo por usuario) y la prohibición de borrar un gasto compartido con liquidación viva.

## Impact

- **Migración nueva `supabase/migrations/0043_shared_security_hardening.sql`** (online-only: se aplica a mano en el dashboard, luego `supabase gen types`): re-crea las policies de `household_invite` y `household_member`; endurece las de `settlement`; agrega RPCs `join_household_by_code`, `register_settlement`, `confirm_settlement`; agrega triggers de guarda de borrado e invariantes; self-check `DO $$` al final.
- **`apps/web/app/_actions/shared.ts`** — `joinHousehold` pasa a invocar `join_household_by_code` (deja de leer invitaciones / insertar membresía / reclamar en best-effort); `registerSettlement` → `register_settlement`; `assignSettlementAccount` → `confirm_settlement`. El ceiling "monto ≤ deuda" sigue en la action (la derivación de deuda vive en TS). `createHousehold` y `deleteSettlement` (rama pendiente) no cambian de contrato.
- **`apps/web/app/_actions/transactions.ts`** — `deleteTransaction` agrega la guarda de gasto compartido con liquidación viva (mensaje amigable; el trigger es el invariante real).
- **`packages/supabase/src/types.ts`** — regenerar para las nuevas RPCs.
- **Tests nuevos** en `apps/web/lib/shared/__tests__/` (aserciones estáticas sobre 0043).
- **Sin cambios de UI** y **sin cambios de contrato para mobile** (la capa compartida y los contratos quedan estables; web responsive no aplica acá porque no hay UI).
