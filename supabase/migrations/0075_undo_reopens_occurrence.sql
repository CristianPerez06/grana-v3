-- Recurrencias — deshacer un pago registrado (#104) y volver a revisión con los
-- datos de la regla (#186).
--
-- Run AFTER 0074_link_snapshot_follows_the_movement.sql.
--
-- Change: openspec/changes/undo-registered-payment/
--
-- Supabase es online-only: se aplica pegando este archivo en el SQL Editor del
-- dashboard. Corre en una sola transacción. No cambia el contrato público —ni
-- columnas ni RPC nuevas—, así que `packages/supabase/src/types.ts` no cambia.
--
-- NO ES DESTRUCTIVA: agrega dos triggers. No borra filas existentes, no cambia
-- tipos, no elimina columnas.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- El defecto (#104)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ningún movimiento que resuelve una ocurrencia se podía borrar. 0011 declaró
--
--   confirmed_transaction_id … REFERENCES transactions(id) ON DELETE SET NULL
--
-- y en la misma tabla un CHECK que exige `confirmed_transaction_id IS NOT NULL`
-- en toda fila `confirmed`. El DELETE dispara el SET NULL, la fila queda
-- `confirmed` sin movimiento, el CHECK la rechaza (23514) y la app muestra «Algo
-- salió mal». Le pasa a lo registrado (`created`) y a lo vinculado (`linked`).
--
-- No era un bloqueo deliberado: en este repo un bloqueo se escribe RESTRICT y
-- lleva su mensaje. Y la decisión de producto es la contraria: borrar el
-- movimiento que resuelve un vencimiento DESHACE esa resolución.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Qué hace esta migración
-- ═══════════════════════════════════════════════════════════════════════════
--
--   1  trg_occurrence_back_to_review (recurrence_instances, BEFORE UPDATE)
--      Toda ocurrencia que pasa de `confirmed` a `pending` vuelve con los datos
--      de la REGLA: descripción, categoría, subcategoría, cuenta e importe.
--      Es la única definición de «volver a revisión» (#186), y vale para
--      cualquier camino: desvincular (`recurrence_unlink_movement`, 0072, que NO
--      se toca), el trigger de abajo, y un UPDATE directo de un cliente.
--
--   2  trg_reopen_occurrence_on_delete (transactions, BEFORE DELETE)
--      Antes de borrar un movimiento, la ocurrencia que resuelve vuelve a
--      revisión —y el trigger 1 le pone los datos de la regla—. Para cuando la
--      FK evalúa su SET NULL ya no queda nada que apunte al movimiento, así que
--      el CHECK nunca se viola. La FK y el CHECK quedan como están.
--
--      Dos excepciones, en las que la ocurrencia se BORRA en vez de reabrirse:
--        · vencimiento desconocido (confirmada antes de 0064): el CHECK de 0064
--          no deja una pendiente sin `due_date`, e inventarle una fecha pondría
--          en «por revisar» un vencimiento que tal vez no existe.
--        · regla eliminada (`status = 'deleted'`): no hay «por revisar» al que
--          volver; la fila sólo era el rastro de un movimiento que ya no existe.
--
-- POR QUÉ TRIGGERS Y NO UNA RPC. La regla tiene que valer para TODO borrado —el
-- detalle web, el nativo, la puerta «Deshacer» de la ficha, SQL manual—. Con una
-- RPC, un DELETE directo seguiría fallando. Es el argumento de 0053: la garantía
-- vive en la base, no en que cada frontend se acuerde.
--
-- POR QUÉ SECURITY INVOKER. Los dos corren como quien escribe. El DELETE ya pasó
-- por RLS (sólo el dueño borra sus movimientos) y la ocurrencia es del mismo
-- usuario; RLS le deja leer su regla y escribir sus ocurrencias. Nada que elevar.
--
-- TODO O NADA. Ninguno atrapa errores. Si la guarda de liquidaciones (0049 →
-- 0073) rechaza el borrado con GRN01, se revierte la sentencia entera y la
-- ocurrencia queda como estaba. El orden entre los dos triggers BEFORE DELETE no
-- cambia el resultado por eso mismo.
--
-- EL LÍMITE NO SE TOCA. `recurrence_positions_spent` (0072) cuenta como gastadas
-- las resueltas con `due_date > hoy`, y el calendario las de fecha pasada: una
-- ocurrencia que vuelve a `pending` deja de sumar si era futura y sigue contando
-- si ya llegó. Es la regla que ya rige para desvincular.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Volver a revisión trae los datos de la regla
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Resolver SÍ copia los datos del movimiento (confirmar y vincular, 0074): el
-- historial muestra lo que pasó. Lo que esto fija es la VUELTA.
--
-- Lo que NO se toca: la fecha de vencimiento (es la identidad, y 0064 la vuelve
-- inmutable), la moneda, el destino de una transferencia, el hogar y el reparto.
-- Esos nunca dejaron de ser los de la regla.
--
-- Consecuencia aceptada: una corrección hecha a mano sólo sobre esa ocurrencia
-- se pierde. La ocurrencia no guarda los datos que tenía antes de resolverse.

create or replace function public.trg_fn_occurrence_back_to_review()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule public.recurrences;
begin
  select * into v_rule from public.recurrences where id = NEW.recurrence_id;
  if not found then
    return NEW;
  end if;

  NEW.description    := v_rule.description;
  NEW.category_id    := v_rule.category_id;
  NEW.subcategory_id := v_rule.subcategory_id;
  NEW.account_id     := v_rule.account_id;
  NEW.amount         := v_rule.amount;
  return NEW;
end $$;

drop trigger if exists trg_occurrence_back_to_review on public.recurrence_instances;
create trigger trg_occurrence_back_to_review
  before update of status on public.recurrence_instances
  for each row
  when (OLD.status = 'confirmed' and NEW.status = 'pending')
  execute function public.trg_fn_occurrence_back_to_review();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Borrar el movimiento deshace la resolución
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_reopen_occurrence_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_instance     public.recurrence_instances;
  v_rule_deleted boolean;
begin
  select * into v_instance
    from public.recurrence_instances
   where confirmed_transaction_id = OLD.id
   for update;
  if not found then
    return OLD;
  end if;

  select r.status = 'deleted' into v_rule_deleted
    from public.recurrences r
   where r.id = v_instance.recurrence_id;

  if v_instance.due_date is null or coalesce(v_rule_deleted, true) then
    delete from public.recurrence_instances where id = v_instance.id;
  else
    update public.recurrence_instances
       set status = 'pending',
           confirmed_transaction_id = null,
           resolution_kind = null,
           linked_conversion = false,
           resolved_at = null
     where id = v_instance.id;
  end if;

  return OLD;
end $$;

drop trigger if exists trg_reopen_occurrence_on_delete on public.transactions;
create trigger trg_reopen_occurrence_on_delete
  before delete on public.transactions
  for each row
  execute function public.trg_fn_reopen_occurrence_on_delete();

-- Funciones de trigger: Postgres no deja llamarlas fuera de un trigger, así que
-- no agregan superficie. Se revoca igual, por higiene.
revoke all on function public.trg_fn_occurrence_back_to_review() from public, anon;
revoke all on function public.trg_fn_reopen_occurrence_on_delete() from public, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check — antes del COMMIT
-- ═══════════════════════════════════════════════════════════════════════════

do $selfcheck$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_reopen_occurrence_on_delete'
       and tgrelid = 'public.transactions'::regclass
       and not tgisinternal
  ) then
    raise exception '0075: falta el trigger que reabre la ocurrencia al borrar el movimiento';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_occurrence_back_to_review'
       and tgrelid = 'public.recurrence_instances'::regclass
       and not tgisinternal
  ) then
    raise exception '0075: falta el trigger que devuelve los datos de la regla';
  end if;

  -- Ninguno de los dos puede atrapar errores: hacerlo convierte «todo o nada» en
  -- un deshacer parcial que conserva el movimiento o la deuda.
  if (select prosrc from pg_proc
       where oid = 'public.trg_fn_reopen_occurrence_on_delete()'::regprocedure)
       ilike '%exception%when%' then
    raise exception '0075: el trigger de borrado atrapa errores';
  end if;

  -- El conteo del límite sigue siendo el de 0072: esta migración no lo reescribe,
  -- y el comportamiento de «la posición vuelve si la fecha no llegó» depende de él.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_positions_spent(uuid, date)'::regprocedure)
       not like '%due_date > p_today%' then
    raise exception '0075: recurrence_positions_spent no es la de 0072';
  end if;
end $selfcheck$;

commit;
