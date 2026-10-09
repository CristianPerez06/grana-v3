-- ═══════════════════════════════════════════════════════════════════════════
-- 0076 · Qué movimiento puede resolver un vencimiento — una sola definición
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Correr DESPUÉS de 0075_undo_reopens_occurrence.sql.
--
-- «Ya lo tengo cargado» (#190) ofrecía movimientos que no son el pago de una
-- obligación recurrente, aunque coincidan en tipo, moneda y fecha:
--
--   · las CUOTAS de una compra en cuotas. `recurrence_link_candidates` (0072)
--     excluía la madre (`is_parent`) pero no las hijas (`parent_id`). Una cuota
--     no se borra ni se edita sola, y las reglas ya excluyen las compras en
--     cuotas como origen;
--   · el DÉBITO con que se pagó un resumen de tarjeta, y su IMPUESTO DE SELLOS
--     (`period_payments`). Los crea y los borra Tarjetas: si uno resolviera un
--     vencimiento, revertir el pago borraría el débito y el trigger de 0075
--     reabriría ese vencimiento en silencio, dentro de una operación que no
--     refresca «por revisar».
--
-- Y la regla vivía sólo en la lista: `recurrence_link_movement` validaba tipo y
-- moneda, nada más, así que cualquier otro camino podía vincular lo que la lista
-- escondía —incluida la madre de cuotas, un reintegro o una liquidación—.
--
-- Esta migración pone la regla en UNA función, `recurrence_movement_linkable`,
-- y la usan los dos: la lista para filtrar y vincular para rechazar, con un
-- código propio (GRN19 → `movement_not_linkable`). El patrón es el de
-- `recurrence_admits_occurrence` (0072): una respuesta que comparten dos
-- caminos para que no contesten distinto.
--
-- Recibe la FILA y no un id: la lista la evalúa por cada candidato y así no hace
-- un segundo acceso a `transactions`.
--
-- Lo que NO hace: tocar ocurrencias que ya quedaron vinculadas a uno de esos
-- movimientos. Siguen resueltas y se desvinculan como cualquier otra.
--
-- Los cuerpos de las dos funciones redefinidas son los vigentes —candidatos de
-- 0072, vincular de 0074— con SÓLO el cambio de arriba. Partir de 0072 para
-- vincular borraría la foto del movimiento que 0074 arregló.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · recurrence_movement_linkable — la definición
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `security invoker`: lee `period_payments` con el RLS de quien vincula, que es
-- el dueño del movimiento — el único que puede vincularlo.

create or replace function public.recurrence_movement_linkable(t public.transactions)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    -- La madre de cuotas no es un movimiento que alguien haya pagado, y una
    -- cuota cuelga de su compra: no se borra ni se edita sola.
    coalesce(t.is_parent, false) = false
    and t.parent_id is null
    -- Los tipos que no son movimientos del usuario en este sentido.
    and t.type not in ('settlement', 'reimbursement')
    -- El débito de un pago de resumen y su impuesto de sellos: los escribe y los
    -- borra Tarjetas, no el usuario.
    and not exists (
      select 1 from public.period_payments pp
       where pp.transaction_id = t.id
          or pp.stamp_tax_transaction_id = t.id
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · recurrence_link_candidates — filtra con la definición
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.recurrence_link_candidates(
  p_recurrence_id uuid,
  p_due_date      date,
  p_widen         boolean default false
)
returns table (
  id            uuid,
  date          date,
  amount        numeric,
  currency_code text,
  account_id    uuid,
  description   text,
  category_id   uuid,
  is_shared     boolean,
  needs_conversion boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with rule as (
    select * from public.recurrences
     where id = p_recurrence_id and user_id = auth.uid()
  ), win as (
    -- Del vencimiento ANTERIOR al SIGUIENTE, tomados del calendario real.
    -- Ampliar lleva tres vecinos para cada lado.
    select a.lo, a.hi, r.*
      from rule r
      cross join lateral public.recurrence_calendar_around(
        r.id, p_due_date,
        case when p_widen then 3 else 1 end,
        case when p_widen then 3 else 1 end
      ) a
  )
  select t.id, t.date, t.amount, t.currency_code, t.account_id, t.description,
         t.category_id, t.is_shared,
         (w.household_id is not null and not t.is_shared) as needs_conversion
    from public.transactions t
   cross join win w
   where t.user_id = auth.uid()
     -- Mismo tipo funcional y misma moneda: vincular un ingreso a una regla de
     -- gasto haría que el historial afirme algo falso.
     --
     -- El cast NO es cosmético: `transactions.type` es el enum `transaction_type`
     -- y `recurrences.movement_type` es TEXT con un CHECK, y Postgres no tiene un
     -- operador entre los dos. Se lleva el enum a texto y no al revés porque
     -- `text::transaction_type` revienta con cualquier valor que no sea una
     -- etiqueta, mientras que el enum siempre tiene representación textual.
     and t.type::text = w.movement_type
     and t.currency_code = w.currency_code
     -- Lo que NUNCA resuelve un vencimiento: una sola definición, la misma que
     -- valida vincular (0076).
     and public.recurrence_movement_linkable(t)
     and t.date >= w.lo::date
     and t.date <= w.hi::date
     -- NO VINCULADO A NINGUNA OCURRENCIA, de ninguna regla.
     and not exists (
       select 1 from public.recurrence_instances i
        where i.confirmed_transaction_id = t.id
     )
     -- Un movimiento ya compartido con otro hogar u otro reparto NO se ofrece
     -- (decisión 13 de fix-recurrence-backlog): pisarlo destruiría una deuda que
     -- el otro miembro ya ve, y deshacerlo exigiría restaurar un estado
     -- compartido arbitrario. Excluirlo cuesta un candidato menos en una lista.
     and (
       w.household_id is null
       or not t.is_shared
       or (
         t.household_id = w.household_id
         and public.recurrence_split_matches(t.id, w.default_split)
       )
     )
   order by
     -- Misma cuenta primero, después importe más parecido, después fecha más
     -- cercana al vencimiento.
     (t.account_id is distinct from w.account_id),
     abs(t.amount - w.amount),
     abs(t.date - p_due_date),
     t.id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · recurrence_link_movement — rechaza con la definición
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- Lo que la lista no ofrece, vincular tampoco lo acepta (0076). Sin esto la
  -- lista sería la única defensa, y cualquier otro camino podría vincular una
  -- cuota o el débito de un pago de resumen.
  if not public.recurrence_movement_linkable(v_tx) then
    raise exception 'movement_not_linkable' using errcode = 'GRN19';
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

revoke all on function public.recurrence_movement_linkable(public.transactions) from public, anon;
revoke all on function public.recurrence_link_candidates(uuid, date, boolean) from public, anon;
revoke all on function public.recurrence_link_movement(uuid, date, uuid, boolean) from public, anon;
grant execute on function public.recurrence_movement_linkable(public.transactions) to authenticated;
grant execute on function public.recurrence_link_candidates(uuid, date, boolean) to authenticated;
grant execute on function public.recurrence_link_movement(uuid, date, uuid, boolean) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Autochequeo — antes del COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.recurrence_movement_linkable(public.transactions)') is null then
    raise exception '0076: recurrence_movement_linkable falta';
  end if;

  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_candidates(uuid, date, boolean)'::regprocedure)
     not like '%recurrence_movement_linkable(t)%'
  then
    raise exception '0076: recurrence_link_candidates no usa la definicion compartida';
  end if;

  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_movement(uuid, date, uuid, boolean)'::regprocedure)
     not like '%recurrence_movement_linkable(v_tx)%'
  then
    raise exception '0076: recurrence_link_movement no usa la definicion compartida';
  end if;

  -- Que vincular siga dejando la foto del movimiento (0074): esta migración
  -- reescribe la función entera, y partir de 0072 la perdería.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_movement(uuid, date, uuid, boolean)'::regprocedure)
     not like '%amount = v_tx.amount%'
  then
    raise exception '0076: recurrence_link_movement perdio la foto del movimiento de 0074';
  end if;

  raise notice '0076 OK';
end $$;

commit;
