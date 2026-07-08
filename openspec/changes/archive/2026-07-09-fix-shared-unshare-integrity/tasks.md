# Tasks — fix-shared-unshare-integrity

## 0. Pre-deploy: detección remota (ANTES de aplicar código) — **corre el usuario**

- [x] 0.1 Correr en el SQL Editor remoto la consulta de detección de huérfanos, leyendo `household_id` del **split** (`t.household_id` ya quedaría en null): → **0 filas**.
  ```sql
  select s.household_id, s.transaction_id, count(*) as splits
    from public.shared_expense_split s
    join public.transactions t on t.id = s.transaction_id
   where t.is_shared = false
   group by s.household_id, s.transaction_id;
  ```
- [x] 0.2 Clasificar los resultados: huérfanos en hogares **con** liquidaciones (`settlement`) vs **sin**. Si hay con liquidaciones, definir reconciliación manual antes de migrar. Si el resultado es **cero**, el cleanup queda preventivo. (Nota: el filtro `is_shared` que se agrega a `collectDebtInputs` también mueve la deuda al desplegar, por eso la medición va antes del deploy.)

## 1. Migración 0048 (toda en BEGIN/COMMIT)

- [x] 1.1 Crear `supabase/migrations/0048_shared_unshare_integrity.sql`, con todo el cuerpo envuelto en `BEGIN … COMMIT` (evitar aplicación parcial desde el SQL Editor).
- [x] 1.2 **Redefinir** `trg_fn_splits_sum_total` a la forma simétrica que valida el **estado final** por `transaction_id`: `is_shared=true` que porta splits ⇒ `sum(amount_assigned)=amount`; `is_shared=false` ⇒ `count(splits)=0`. Mantener el `if not found then return null` (cascade delete). Mantener el trigger como `constraint trigger ... deferrable initially deferred` sobre `shared_expense_split`.
- [x] 1.3 **Agregar** trigger `BEFORE UPDATE` sobre `transactions` que, en la transición `OLD.is_shared and not NEW.is_shared` con `household_id` no nulo y liquidaciones en el hogar, haga `RAISE EXCEPTION` (bloqueo de descompartir con liquidaciones vivas; gemelo del `BEFORE DELETE` de 0043). Implementado con `WHEN (OLD.is_shared is true and NEW.is_shared is false)` para no correr la función en cada update.
- [x] 1.4 **Agregar** trigger `AFTER UPDATE` sobre `transactions`, `deferrable initially deferred`, que si `not NEW.is_shared and exists(split where transaction_id = NEW.id)` haga `RAISE EXCEPTION` (captura "flag a false, splits sin borrar"). Scopeado a la transición con `WHEN`.
- [x] 1.5 **Crear** la RPC `unshare_movement(p_root_id uuid)` `SECURITY INVOKER`, `set search_path = public`:
  - validar `auth.uid()` y ownership de la raíz (error explícito, no cero filas);
  - derivar server-side: raíz ∪ hijas (`parent_id = raíz`) ∪ reintegros (`type='reimbursement'` con `linked_transaction_id` en {raíz, hijas});
  - `FOR UPDATE` en orden determinista (`order by id`);
  - `UPDATE ... set is_shared=false, household_id=null` + `DELETE` de splits, en la misma transacción;
  - `REVOKE EXECUTE FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated`.
- [x] 1.6 **Cleanup guardado**, después de redefinir los triggers: `RAISE EXCEPTION` si hay huérfanos en hogares con liquidaciones; si no, `DELETE` de huérfanos (transacciones `is_shared=false` con splits) — permitido por el trigger v2.
- [x] 1.7 **Bloque self-check** (patrón 0043): verificar existencia de los tres triggers y de la función `unshare_movement` (INVOKER), y que no queden huérfanos post-cleanup.
- [x] 1.8 **[corre el usuario — HECHO 0048]** Aplicar la migración en remoto (Supabase online-only). 0048 aplicada ("✓ ... applied"). El tipo `unshare_movement` se agregó a mano a `packages/supabase/src/types.ts` (no hace falta CLI `gen types`).

## 1B. Migración 0049 — guardas de liquidación temporales + por moneda

Surgió del QA: la guarda amplia bloqueaba descompartir un gasto **posterior** a la última liquidación (falso positivo). 0048 ya estaba aplicada, así que va en una migración nueva.

- [x] 1B.1 Crear `supabase/migrations/0049_shared_settlement_guard_temporal.sql` (en `BEGIN/COMMIT`).
- [x] 1B.2 Redefinir `trg_fn_block_shared_delete_with_settlement` (0043) y `trg_fn_block_unshare_with_settlement` (0048): bloquear solo si existe liquidación en el hogar **misma moneda** con `payer_movement.date >= coalesce(OLD.due_date, OLD.date)`; guardar solo filas que **portan splits** (exime madre de cuotas y patas settlement); lanzar `SQLSTATE GRN01`. + self-check.
- [x] 1B.3 **[corre el usuario — HECHO]** Aplicar 0049 en remoto → `✓ 0049 shared settlement guards temporal applied`.

## 2. Capa de aplicación

- [x] 2.1 `apps/web/app/_actions/transactions.ts`: rama `else` (spec null) → `.rpc('unshare_movement', { p_root_id: id })`; el error `GRN01` (guarda temporal de liquidación) se mapea a mensaje amable, el resto se surfacea genérico. Se movió el fetch de `reimbs` adentro de la rama `spec` y se eliminó `allIds`.
- [x] 2.2 `packages/cards/src/mutations.ts` (`updateInstallmentParent`): rama de descompartir → misma RPC sobre la madre; `GRN01` → `cards.errors.shared_unshare_settlement`, resto → `shared_update_failed`. **Eliminado** el pre-`DELETE` incondicional de splits (redundante con el upsert).
- [x] 2.3 `apps/web/lib/shared/queries.ts` (`collectDebtInputs`): filtro defensivo `is_shared = true` (agregando `is_shared` a la 2ª query y filtrando en `projectable`).
- [x] 2.4 `deleteTransaction` (`transactions.ts`): reemplazado el pre-check amplio por mapeo de `GRN01` en el error del delete (consistente con la guarda temporal 0049). + clave i18n `cards.errors.shared_unshare_settlement` (ES/EN).

## 3. Tests

Nota: el repo es **online-only, sin Supabase local ni harness de RLS** (ver AGENTS.md y el test de la mig. 0043). Los invariantes de base y el comportamiento de la RPC (auth, atomicidad, cuotas, reintegros, bloqueo por liquidación, madre de cuotas exenta) se validan en runtime por el **bloque `DO $$` self-check** al aplicar la migración y por el **QA de dos usuarios**. En unit tests se cubren la **forma** de la migración (aserciones estáticas sobre el SQL) y el **wiring** de las mutaciones (supabase mockeado).

- [x] 3.1 Aserciones estáticas sobre `0048_...sql` (`apps/web/lib/shared/__tests__/unshare-integrity-migration.test.ts`): `BEGIN/COMMIT`; invariante simétrica (ambas ramas); guarda `BEFORE UPDATE` con `WHEN` de transición + chequeo de `settlement`; constraint trigger diferido `no_splits_when_unshared`; RPC INVOKER + ownership + derivación (`parent_id`/reimbursement) + `for update` + `revoke/grant`; cleanup que aborta ante liquidaciones + delete; self-check.
- [x] 3.2 Wiring de la mutación de cuotas (`packages/cards/src/__tests__/mutations.test.ts`): descompartir llama a `unshare_movement` con `p_root_id=parentId`, sin delete de splits ni flip directo; `GRN01` → `shared_unshare_settlement`, otro error → `shared_update_failed`.
- [x] 3.3 Aserciones estáticas sobre `0049` (`apps/web/lib/shared/__tests__/settlement-guard-temporal-migration.test.ts`): ambas guardas comparan `payer_movement.date >= coalesce(due_date, date)` por moneda, solo filas con splits, y lanzan `GRN01`.
- [x] 3.4 **[QA — HECHO]** Verificado en la app: descompartir un gasto **posterior** a la liquidación → permite (caso 1); gasto propio **anterior/igual** → bloquea con el mensaje amable (caso 2). Ownership gate confirmado (gasto ajeno → "no encontrada", pre-existente). Atomicidad/cuotas/reintegros/madre-exenta cubiertos por el `DO $$` self-check de las migraciones.

## 4. Cierre

- [x] 4.1 `pnpm typecheck` — verde.
- [x] 4.2 `pnpm lint` — verde.
- [x] 4.3 `pnpm test` — los tests nuevos (cards mutations + migración 0048) pasan. Queda **1 fallo pre-existente ajeno**: `lib/shared/__tests__/schemas.test.ts > rejects a percentage below 1` — el test afirma que `{0,100}` debe rechazarse, pero la feature 0/100 (mig 0047, `feat/allow-full-other-share`) lo hizo válido; el test quedó desactualizado en ese merge. No lo toco (fuera de scope); reportado para un fix aparte.
- [x] 4.4 `pnpm openspec:check` — OK vía Git Bash. El script `pnpm openspec:check` usa `grep -rE`, que no corre en el shell de Windows (falla con "No se esperaba -rE"); el contenido está OK (sin placeholders TBD).
- [ ] 4.5 **[corre el usuario]** Archivar el change EN la branch antes del merge (sync del master spec `shared`), y dejar el merge ff-only al usuario. Ojo: archivar antes requiere que el master spec no quede con `Purpose: TBD`.
