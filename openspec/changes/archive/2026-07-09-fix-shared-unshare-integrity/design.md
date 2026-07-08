# Design — fix-shared-unshare-integrity

## El bug, en una imagen

```
updateTransaction, rama unshare (spec === null)  ── transactions.ts:313-325
─────────────────────────────────────────────────────────────────────────────
  Call 1:  DELETE shared_expense_split WHERE transaction_id IN (ids)
              │  transacción PostgREST propia
              │  al COMMIT: sum(amount_assigned)=0  ≠  transactions.amount
              │  trg_splits_sum_total (DEFERRED) ── raise ──▶ ROLLBACK
              │  ↑ el error NO se captura
              └─ los splits SOBREVIVEN
  Call 2:  UPDATE transactions SET is_shared=false, household_id=null   ✓ commitea
─────────────────────────────────────────────────────────────────────────────
  Final:  tx.is_shared=false, tx.household_id=null,  split.household_id=X  (huérfano)
```

`collectDebtInputs` (`apps/web/lib/shared/queries.ts:106`) lee splits por `.eq('household_id', …)` **sin** filtrar `is_shared`, y acepta la transacción aunque tenga `is_shared=false`. El huérfano conserva su `household_id` ⇒ **el gasto descompartido sigue sumando a la deuda**. El mismo patrón vive en `updateInstallmentParent` (`packages/cards/src/mutations.ts:466`).

## Decisión 1 — Invariante simétrica (no basta con "ignorar is_shared=false")

Relajar el trigger de suma con un `if not is_shared then return null` **es demasiado permisivo**: permitiría insertar splits sobre una transacción `is_shared=false` (el INSERT dispara el trigger, ve `false`, retorna null → pasa; y como no hay UPDATE de `transactions`, el segundo trigger tampoco corre). El trigger de splits debe validar el **estado final**, no hacer early-return:

```sql
-- trg_fn_splits_sum_total (MODIFICAR) — fires AFTER I/U/D on shared_expense_split, DEFERRED
select amount, is_shared into v_amount, v_is_shared from transactions where id = v_tx_id;
if not found then return null; end if;                       -- cascade delete: nada que chequear
select coalesce(sum(amount_assigned),0), count(*) into v_sum, v_count
  from shared_expense_split where transaction_id = v_tx_id;
if v_is_shared then
  if v_sum <> v_amount then raise exception 'shared tx % ⇒ splits suman % pero amount es %', ...; end if;
else
  if v_count > 0     then raise exception 'unshared tx % conserva % splits', v_tx_id, v_count; end if;
end if;
return null;
```

**Por qué la dirección TRUE no puede vivir en la transición de `transactions`.** El alta compartida (`applySharedSplits`) hace dos calls PostgREST separadas:

```
Call 1:  UPDATE tx SET is_shared=true      ← commitea SIN splits todavía
Call 2:  upsert splits                     ← recién acá existen y suman
```

Un trigger "`is_shared=true` ⇒ splits suman" sobre la transición fallaría en Call 1. Por eso la invariante se **reparte**: la dirección TRUE la cuida el trigger de splits (fires cuando los splits existen); la transición de `transactions` solo cuida la dirección **FALSE**:

```sql
-- trg AFTER UPDATE on transactions, DEFERRABLE INITIALLY DEFERRED (NUEVO)
-- Captura "flag a false pero splits sin borrar": ninguna fila de split cambió,
-- así que el trigger de splits no se entera; este sí.
if not NEW.is_shared and exists (select 1 from shared_expense_split where transaction_id = NEW.id) then
  raise exception 'tx % quedó is_shared=false con splits sin borrar', NEW.id;
end if;
```

Ambos triggers son necesarios: el de splits captura INSERT/DELETE ilegales de splits; el de `transactions` captura el cambio de flag sin tocar splits. Juntos: la RPC (una transacción: `is_shared=false` + delete splits) pasa al commit; cualquier variante **incompleta** falla.

**La madre de cuotas queda naturalmente exenta.** Ninguna fila de split referencia a la madre (los splits viven en las hijas), así que el trigger de splits nunca la evalúa por suma. Y como su `is_shared` es `true`, el trigger de `transactions` (que solo mira el caso `false`) tampoco la toca. Se prueba explícitamente (ver tasks).

## Decisión 2 — `unshare_movement` RPC: `SECURITY INVOKER`, no DEFINER

Las RPCs de settlement (register/confirm/reverse, join) son `SECURITY DEFINER` porque 0043 le quitó al cliente **toda** policy de escritura sobre `settlement` — no hay privilegio que heredar. Acá **sí** lo hay: la RLS de `shared_expense_split` (0023:253-282) permite al dueño de la transacción borrar/actualizar/insertar sus propios splits, y el dueño puede actualizar su propia transacción. Entonces `SECURITY INVOKER` (mínimo privilegio) alcanza.

Pero como las transacciones compartidas tienen **lectura cross-user** (RLS SELECT del hogar), un intento ajeno no daría error sino un UPDATE de **cero filas** — un "éxito" silencioso. Por eso la RPC valida **explícitamente**:

```sql
create or replace function public.unshare_movement(p_root_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_ids uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Ownership explícito de la raíz (no confiar en RLS → 0 filas).
  select user_id into v_owner from public.transactions where id = p_root_id;
  if not found          then raise exception 'movement_not_found'; end if;
  if v_owner <> v_uid   then raise exception 'not_owner'; end if;

  -- Derivación SERVER-SIDE de todas las transacciones afectadas desde la raíz:
  --   raíz  ∪  cuotas hijas (parent_id = raíz)  ∪  reintegros vinculados a cualquiera de ellas
  with roots as (
    select p_root_id as id
    union select id from public.transactions where parent_id = p_root_id and user_id = v_uid
  )
  select array_agg(id) into v_ids from (
    select id from roots
    union
    select r.id from public.transactions r
      join roots on r.linked_transaction_id = roots.id
     where r.type = 'reimbursement' and r.user_id = v_uid
  ) s;

  -- Bloqueo determinista para evitar deadlocks entre calls concurrentes.
  perform 1 from public.transactions where id = any(v_ids) order by id for update;

  -- Guarda de liquidaciones: la maneja el trigger BEFORE UPDATE, pero un chequeo
  -- explícito acá da un error de dominio claro antes de tocar nada. (Opcional; el
  -- trigger es la garantía dura.)

  update public.transactions
     set is_shared = false, household_id = null
   where id = any(v_ids);
  -- (opcional) GET DIAGNOSTICS / comprobar row_count esperado

  delete from public.shared_expense_split where transaction_id = any(v_ids);
end $$;

revoke execute on function public.unshare_movement(uuid) from public;
grant  execute on function public.unshare_movement(uuid) to authenticated;
```

Al commit de la RPC: el trigger de splits (por cada delete) ve `is_shared=false` → rama `count=0` satisfecha; el trigger de `transactions` ve `is_shared=false` sin splits → satisfecho. Atómico, sin huérfanos posibles, sin ventana no-atómica.

## Decisión 3 — Protección por liquidaciones extendida a descompartir

La guarda de 0043 (`trg_fn_block_shared_delete_with_settlement`) corre solo en `BEFORE DELETE`. Descompartir produce el **mismo** cambio contable retroactivo sobre una deuda ya saldada, pero esquiva ese trigger. Se agrega el gemelo en `BEFORE UPDATE`:

```sql
-- trg BEFORE UPDATE on transactions (NUEVO)
if OLD.is_shared and not NEW.is_shared and OLD.household_id is not null
   and exists (select 1 from public.settlement where household_id = OLD.household_id) then
  raise exception 'no se puede descompartir con una liquidación viva en el hogar %', OLD.household_id;
end if;
```

Solo se dispara en la transición `true → false`; los edits normales (flag sin cambiar) pasan de largo.

## Decisión 4 — Cleanup consciente de liquidaciones, en `BEGIN/COMMIT`

Toda la 0048 va dentro de una transacción explícita (`BEGIN … COMMIT`) para evitar una aplicación parcial desde el SQL Editor. El cleanup **no** puede ser un `DELETE` a ciegas: borrar un huérfano cuyo `household_id` pertenece a un hogar **con** liquidaciones alteraría retroactivamente la deuda que la guarda nueva protege. Clasificación:

```
DETECCIÓN REMOTA (manual, ANTES del deploy — el filtro is_shared de collectDebtInputs
también mueve la deuda al desplegar, así que hay que medir primero):

  select s.household_id, s.transaction_id, count(*)
    from shared_expense_split s join transactions t on t.id = s.transaction_id
   where t.is_shared = false
   group by s.household_id, s.transaction_id;   -- household_id se lee del SPLIT (t.household_id ya es null)

  huérfano en hogar SIN liquidaciones  →  cleanup automático en 0048
  huérfano en hogar CON liquidaciones  →  0048 hace RAISE EXCEPTION → reconciliar a mano
```

Si el resultado es cero (lo esperado, porque el toggle casi no se alcanza), el cleanup queda preventivo. En la migración, **después** de redefinir los triggers:

```sql
-- Aborta si hay huérfanos en hogares con liquidaciones (no borrar en silencio)
if exists (
  select 1 from shared_expense_split s
   join transactions t on t.id = s.transaction_id
  where t.is_shared = false
    and exists (select 1 from settlement se where se.household_id = s.household_id)
) then
  raise exception 'huérfanos en hogares con liquidaciones: reconciliar manualmente antes de migrar';
end if;

-- Cleanup solo de hogares sin liquidaciones (el trigger v2 ya permite el delete)
delete from shared_expense_split s
 using transactions t
 where s.transaction_id = t.id and t.is_shared = false;
```

## Interacciones verificadas (no rompen)

- **Alta compartida** (`applySharedSplits`, dos calls): Call 1 `is_shared=true` sin splits → trigger de `transactions` mira solo el caso `false` → pasa. Call 2 upsert → trigger de splits ve `is_shared=true`, suma OK. ✓
- **Re-share en edición** (upsert, ya en main): sum se mantiene exacto; trigger de splits OK. ✓
- **Cuotas re-share** (`cards/mutations.ts`): se elimina el pre-`DELETE` de la línea 466 (redundante desde que `applySharedSplits` hace upsert); queda solo el upsert. ✓
- **Borrado de una tx** (cascade): el trigger de splits hace `if not found then return null`. ✓
- **`is_shared=true` con cero splits** (ej. Call 2 del alta falla): estado tolerado y pre-existente (contribuye 0 a la deuda); la acción ya surface el error. No lo introduce ni empeora este change. ✓

## Alternativas descartadas

- **Tolerar `sum=0` en el trigger** (`if v_sum <> v_amount and v_sum <> 0`): debilita la seguridad — un compartido que pierde todos sus splits pasaría inadvertido. La invariante simétrica por `is_shared` es más precisa.
- **Reorder en TS (is_shared=false primero, luego delete) sin RPC**: funciona con el trigger v2, pero deja una ventana no-atómica entre dos calls PostgREST; ante fallo de red re-crea huérfanos. La RPC atómica lo cierra y es idiomática al módulo.
- **`SECURITY DEFINER`**: innecesario (el dueño ya tiene privilegios por RLS) y más superficie de escalada. INVOKER + checks explícitos es mínimo privilegio.
