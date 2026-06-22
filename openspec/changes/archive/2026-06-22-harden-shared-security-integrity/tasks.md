## 1. Migración SQL (0043_shared_security_hardening.sql)

- [x] 1.1 Crear `supabase/migrations/0043_shared_security_hardening.sql` con cabecera explicativa (referencia a B1/B2/B5/B6/B7 y al doc de decisiones).
- [x] 1.2 **B1 lectura** — `DROP POLICY "read household invites"` y recrearla solo con `is_household_member(household_id)` (sin la rama abierta `used_by IS NULL AND expires_at > now()`).
- [x] 1.3 **B1 self-insert** — `DROP POLICY "joining user claims invite"` (el reclamo pasa a la RPC) y `DROP POLICY "users add themselves to household"`; recrear el INSERT de `household_member` acotado al creador-primer-miembro (`user_id = auth.uid()` AND el hogar es `created_by = auth.uid()` AND el hogar no tiene miembros aún).
- [x] 1.4 **B1 RPC** — `create function join_household_by_code(p_code text) returns uuid` `SECURITY DEFINER` `set search_path = public`: validar `auth.uid()` sin hogar; código existe / no usado / no vencido / hogar activo con cupo (excepciones distinguibles); insertar membresía; marcar invitación usada; setear `default_split` 50·50; devolver `household_id`.
- [x] 1.5 **B5 settlement RLS** — `DROP` las policies `"payer inserts settlement"`, `"members update household settlements"`, `"payer deletes pending settlement"`; conservar solo `"members select household settlements"` (SELECT). Sin escritura directa del cliente.
- [x] 1.6 **B6 RPC alta** — `create function register_settlement(p_account_id uuid, p_amount numeric, p_currency text) returns uuid` `SECURITY DEFINER`: validar caller miembro de hogar de 2 y `p_amount > 0`; insertar pata `out` en `transactions` (`user_id = auth.uid()`, `type='settlement'`, `settlement_direction='out'`, `category_id=null`, `date` = hoy) y fila `settlement` (`payer_id = auth.uid()`, `receiver_id` = el otro miembro, `status='pending_receipt'`); devolver `settlement.id`. Atómico.
- [x] 1.7 **B6 RPC confirmación** — `create function confirm_settlement(p_settlement_id uuid, p_account_id uuid) returns void` `SECURITY DEFINER`: validar `auth.uid()` = `receiver_id` y `status='pending_receipt'`; insertar pata `in` (`user_id = auth.uid()`, `settlement_direction='in'`); `update settlement set receiver_movement_id, status='completed', resolved_at`. Atómico.
- [x] 1.8 **B2 guarda de borrado** — trigger `BEFORE DELETE` sobre `transactions` (`trg_fn_block_shared_delete_with_settlement`): si `OLD.is_shared` y existe alguna fila en `settlement` con `household_id = OLD.household_id`, `raise exception`. Las patas `settlement` (`is_shared=false`) quedan exentas.
- [x] 1.9 **B7 splits suman total** — `CONSTRAINT TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ON shared_expense_split DEFERRABLE INITIALLY DEFERRED`: para el `transaction_id` afectado (si aún existe), verificar `SUM(amount_assigned) = transactions.amount`, si no `raise exception`.
- [x] 1.10 **B7 dueño es miembro** — trigger `BEFORE INSERT OR UPDATE ON shared_expense_split`: abortar si `NEW.user_id` no es miembro de `NEW.household_id`.
- [x] 1.11 **B7 un hogar activo por usuario** — trigger `BEFORE INSERT ON household_member`: abortar si el usuario ya es miembro de algún `household` con `is_active = true` (complementa el trigger `max-2` existente).
- [x] 1.12 Agregar bloque `DO $$ ... $$` de **self-check** (policies recreadas, RPCs `prosecdef=true`, triggers presentes) + `select` de summary final, siguiendo el patrón de `0023_shared.sql`.

## 2. Tipos y server actions

- [x] 2.1 Aplicar la migración en el dashboard de Supabase (online-only) y verificar que el self-check no levante excepción; regenerar `packages/supabase/src/types.ts` con `supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa`.
- [x] 2.2 `apps/web/app/_actions/shared.ts` — `joinHousehold`: reemplazar la lectura de invitación + insert de membresía + reclamo best-effort por una sola llamada a `supabase.rpc('join_household_by_code', { p_code })`; mapear las excepciones a `fieldErrors.code` (inválido / usado / vencido / completo / ya tenés hogar).
- [x] 2.3 `apps/web/app/_actions/shared.ts` — `registerSettlement`: conservar la validación "monto ≤ deuda" (TS) y reemplazar el doble insert por `supabase.rpc('register_settlement', { p_account_id, p_amount, p_currency })`.
- [x] 2.4 `apps/web/app/_actions/shared.ts` — `assignSettlementAccount`: reemplazar el insert de pata + update por `supabase.rpc('confirm_settlement', { p_settlement_id, p_account_id })` (mantener la validación de receptor/estado como pre-chequeo amigable; la RPC es la guarda real).
- [x] 2.5 `apps/web/app/_actions/transactions.ts` — `deleteTransaction`: agregar guarda previa que, si la transacción es `is_shared` y su hogar tiene alguna `settlement`, devuelva un `formError` explicativo ("Revertí la liquidación antes de borrar este gasto compartido."). El trigger 1.8 es el invariante real; esto es el mensaje amigable.

## 3. Tests (aserciones estáticas sobre el SQL)

- [x] 3.1 Crear `apps/web/lib/shared/__tests__/security-migration.test.ts` (vitest, lee `0043_shared_security_hardening.sql`).
- [x] 3.2 Asserts B1: el SELECT de `household_invite` ya NO contiene la rama abierta `used_by IS NULL`; existe `join_household_by_code` como `SECURITY DEFINER`; el INSERT de `household_member` ya no es `with check (user_id = auth.uid())` solo.
- [x] 3.3 Asserts B5/B6: existen `register_settlement` y `confirm_settlement` `SECURITY DEFINER`; NO existe policy de UPDATE/INSERT directa sobre `settlement` (solo SELECT).
- [x] 3.4 Asserts B2: declara el trigger `BEFORE DELETE` sobre `transactions` que referencia `is_shared` y `settlement`.
- [x] 3.5 Asserts B7: declara el constraint trigger diferido de suma de splits; el trigger de dueño-es-miembro; el trigger de un-hogar-activo-por-usuario.
- [x] 3.6 Correr `pnpm --filter web test`, `pnpm typecheck`, `pnpm lint` y dejar todo en verde.

## 4. Cierre (en la branch, antes del merge)

- [x] 4.1 Verificación funcional con dos usuarios QA coordinada con el usuario (no enumerar invitaciones ajenas, no auto-sumarse sin código, alta/confirmación de liquidación, borrado bloqueado por liquidación viva). Reportes por ID; fixes en la branch.
- [x] 4.2 Archivar el change: mover a `openspec/changes/archive/AAAA-MM-DD-harden-shared-security-integrity/` y aplicar los deltas a `openspec/specs/shared/spec.md` (integrar MODIFIED/ADDED en la sección plana `## Requirements`).
- [x] 4.3 Correr `pnpm openspec:check` (debe pasar) y dejar la branch lista. El merge ff-only / squash lo hace el usuario.
