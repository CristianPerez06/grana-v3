-- ═══════════════════════════════════════════════════════════════════════════
-- 0074 · Vincular deja la foto del MOVIMIENTO, también cuando la ocurrencia
--        ya existía
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `recurrence_link_movement` (0072) resuelve un vencimiento por dos caminos que
-- tienen que dejar la misma fila:
--
--   · la ocurrencia TODAVÍA NO EXISTE (resolver por anticipado) → la crea, y
--     copia del movimiento el importe, la cuenta, la clasificación y la
--     descripción;
--   · la ocurrencia YA EXISTE como `pending` (el generador la materializó) →
--     la actualiza… y sólo marcaba el vínculo.
--
-- Por el segundo camino la fila conservaba la foto SEMBRADA POR LA REGLA. El
-- historial mostraba «$600» sobre un vencimiento resuelto con un movimiento de
-- $2.500, y nada lo delataba: el número es plausible, es el de la regla, y
-- coincide con el resto de la lista.
--
-- Esta migración reemplaza la función entera —en PL/pgSQL no hay forma de
-- parchear una sentencia sin reescribir el cuerpo— cambiando SÓLO ese `update`.
-- El resto es idéntico a 0072. `0072` ya está aplicada en la base online, así
-- que el arreglo no puede editarse allá: va acá.
--
-- Lo que NO se copia del movimiento, a propósito: el destino de una
-- transferencia, el hogar y el reparto son de la REGLA. La rama que crea la
-- ocurrencia también los toma de ahí, y copiarlos del movimiento haría que las
-- dos ramas volvieran a divergir, en la otra dirección.

create or replace function public.recurrence_link_movement(
  p_recurrence_id      uuid,
  p_due_date           date,
  p_transaction_id     uuid,
  p_confirm_conversion boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_rule       public.recurrences;
  v_tx         public.transactions;
  v_converted  boolean := false;
  v_instance   uuid;
  v_split      jsonb;
  v_reason     text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'GRN10';
  end if;

  select * into v_rule from public.recurrences
   where id = p_recurrence_id and user_id = v_uid for update;
  if not found then
    raise exception 'rule_not_found' using errcode = 'GRN10';
  end if;
  if v_rule.status = 'deleted' then
    raise exception 'rule_deleted' using errcode = 'GRN10';
  end if;

  select * into v_tx from public.transactions
   where id = p_transaction_id and user_id = v_uid for update;
  if not found then
    raise exception 'movement_not_found' using errcode = 'GRN10';
  end if;

  -- Mismo cast que en los candidatos, y por la misma razón: acá el cuerpo es
  -- PL/pgSQL, así que esta línea no se valida al crear la función — habría
  -- fallado recién al vincular, con el movimiento ya elegido por el usuario.
  if v_tx.type::text <> v_rule.movement_type or v_tx.currency_code <> v_rule.currency_code then
    raise exception 'movement_incompatible' using errcode = 'GRN11';
  end if;

  -- Un movimiento resuelve UN vencimiento. Sin esto, el mismo gasto podría saldar
  -- dos meses y la regla parecería al día con la mitad de los pagos.
  if exists (select 1 from public.recurrence_instances i
              where i.confirmed_transaction_id = p_transaction_id) then
    raise exception 'movement_already_linked' using errcode = 'GRN12';
  end if;

  -- ── Compartido: las tres ramas de la decisión 13 ─────────────────────────
  if v_rule.household_id is not null then
    if v_tx.is_shared then
      if v_tx.household_id is distinct from v_rule.household_id
         or not public.recurrence_split_matches(v_tx.id, v_rule.default_split) then
        raise exception 'movement_shared_elsewhere' using errcode = 'GRN13';
      end if;
      -- Reparto compatible: se vincula sin tocar nada.
    else
      -- Personal: se convierte, pero SÓLO con confirmación explícita. Esto mueve
      -- la deuda del hogar, y nadie puede descubrirlo después de que pasó.
      if not p_confirm_conversion then
        raise exception 'conversion_not_confirmed' using errcode = 'GRN14';
      end if;

      update public.transactions
         set is_shared = true, household_id = v_rule.household_id
       where id = v_tx.id;

      for v_split in
        select value from jsonb_array_elements(v_rule.default_split)
      loop
        insert into public.shared_expense_split
          (transaction_id, household_id, user_id, percentage, amount_assigned)
        values (
          v_tx.id, v_rule.household_id, (v_split ->> 'user_id')::uuid,
          (v_split ->> 'percentage')::numeric,
          round(v_tx.amount * (v_split ->> 'percentage')::numeric / 100, 2)
        )
        on conflict (transaction_id, user_id) do update
          set percentage = excluded.percentage,
              amount_assigned = excluded.amount_assigned;
      end loop;

      -- El resto por diferencia, a la primera parte: la suma de los splits tiene
      -- que dar el total exacto o el invariante diferido rechaza el commit.
      update public.shared_expense_split s
         set amount_assigned = s.amount_assigned + (
               v_tx.amount - (select sum(x.amount_assigned)
                                from public.shared_expense_split x
                               where x.transaction_id = v_tx.id)
             )
       where s.transaction_id = v_tx.id
         and s.user_id = (select (value ->> 'user_id')::uuid
                            from jsonb_array_elements(v_rule.default_split)
                           limit 1);

      v_converted := true;
    end if;
  end if;

  -- ── La ocurrencia ────────────────────────────────────────────────────────
  --
  -- `resolution_kind = 'linked'` se escribe EXPLÍCITAMENTE: el trigger de
  -- compatibilidad de 0064 pone 'created' a toda confirmación que no lo declare,
  -- y esa distinción es la que decide qué hace deshacer.
  -- LA FOTO ES DEL MOVIMIENTO, no de lo que la regla preveía. Los dos caminos
  -- terminan en la misma fila y tenían que dejarla igual: la rama de abajo, que
  -- crea la ocurrencia, ya copiaba importe, cuenta, clasificación y descripción
  -- del movimiento; ésta, que aprovecha una ocurrencia que el calendario ya
  -- había materializado, sólo marcaba el vínculo y dejaba la foto sembrada por
  -- el generador. El historial de la regla mostraba entonces el importe de la
  -- regla sobre un vencimiento resuelto con un movimiento de otro importe, y
  -- desvincular no lo revelaba: el número era plausible.
  --
  -- `transfer_destination_account_id`, `household_id` y `split` NO se tocan: son
  -- de la REGLA, no del movimiento, y la rama de abajo también los toma de ahí.
  update public.recurrence_instances
     set status = 'confirmed',
         confirmed_transaction_id = p_transaction_id,
         resolution_kind = 'linked',
         linked_conversion = v_converted,
         resolved_at = now(),
         amount = v_tx.amount,
         account_id = v_tx.account_id,
         currency_code = v_tx.currency_code,
         category_id = v_tx.category_id,
         subcategory_id = v_tx.subcategory_id,
         description = v_tx.description
   where recurrence_id = p_recurrence_id
     and due_date = p_due_date
     and user_id = v_uid
     and status = 'pending'
   returning id into v_instance;

  if v_instance is null then
    -- VALIDAR EL VENCIMIENTO ANTES DE CREARLE UNA IDENTIDAD. Un `p_due_date` que
    -- el calendario no produce dejaría una ocurrencia fantasma, y con el conteo
    -- nuevo esa ocurrencia resuelta gastaría una posición del límite.
    v_reason := public.recurrence_admits_occurrence(p_recurrence_id, p_due_date);
    if v_reason is not null then
      raise exception '%', v_reason
        using errcode = case v_reason
                          when 'beyond_limit'     then 'GRN17'
                          when 'already_resolved' then 'GRN18'
                          else                         'GRN16'
                        end;
    end if;

    insert into public.recurrence_instances
      (recurrence_id, user_id, due_date, scheduled_date, status,
       confirmed_transaction_id, resolution_kind, linked_conversion, resolved_at,
       amount, account_id, transfer_destination_account_id, currency_code,
       category_id, subcategory_id, description, household_id, split)
    values
      (p_recurrence_id, v_uid, p_due_date, p_due_date, 'confirmed',
       p_transaction_id, 'linked', v_converted, now(),
       v_tx.amount, v_tx.account_id, v_rule.transfer_destination_account_id,
       v_tx.currency_code, v_tx.category_id, v_tx.subcategory_id, v_tx.description,
       v_rule.household_id, v_rule.default_split)
    returning id into v_instance;
  end if;

  return v_instance;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Autochequeo
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.recurrence_link_movement(uuid, date, uuid, boolean)') is null then
    raise exception '0074: recurrence_link_movement falta';
  end if;

  -- Que la rama que ACTUALIZA copie la foto, no sólo el vínculo. Se mira el
  -- cuerpo porque es lo único que se puede afirmar sin ejecutar la función.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_movement(uuid, date, uuid, boolean)'::regprocedure)
     not like '%amount = v_tx.amount%'
  then
    raise exception '0074: vincular sobre una ocurrencia existente no copia el importe del movimiento';
  end if;

  raise notice '0074 OK';
end $$;
