-- ═══════════════════════════════════════════════════════════════════════════
-- 0077 · La lista para vincular ordena por nombre, y deja afuera los sellos
--        de pagos viejos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Correr DESPUÉS de 0076_link_eligibility.sql.
--
-- Dos cosas que salieron del QA de #190:
--
--   · EL ORDEN. `recurrence_link_candidates` ponía primero la misma cuenta que
--     la regla. Lo que el usuario reconoce de su gasto es QUÉ fue, no desde
--     dónde lo pagó, y una misma obligación se paga a veces con una tarjeta y a
--     veces con otra. Ahora: coincidencia por nombre con la regla, importe,
--     fecha. Ninguno de los tres excluye: sólo ordenan.
--
--   · LOS SELLOS DE PAGOS ANTERIORES A 0050. 0076 reconoce el impuesto de
--     sellos de un pago por `period_payments.stamp_tax_transaction_id`. Los
--     pagos registrados antes de 0050 no tienen ese vínculo
--     (`stamp_tax_link_known = false`): se sabe que el pago existió, no cuál fue
--     su sello. Ese sello se reconoce acá por tres condiciones juntas: está en un
--     resumen, tiene la subcategoría del sistema `impuesto-de-sellos`, y ese
--     resumen tiene un pago anterior al vínculo. 0050 evitó esta heurística para
--     BORRAR; acá alcanza, porque sólo esconde un candidato. Un sello cargado a
--     mano en una cuenta bancaria no está en un resumen y sigue entrando: puede
--     ser justo un gasto que se repite.
--
-- `recurrence_link_movement` no se redefine: ya llama a
-- `recurrence_movement_linkable`, así que rechaza el sello viejo sin cambios.
-- Las firmas son las de 0076.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · recurrence_movement_linkable — suma los sellos de pagos viejos
-- ═══════════════════════════════════════════════════════════════════════════

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
    )
    -- El sello de un pago anterior al vínculo (0050): en el resumen, con la
    -- subcategoría del sistema, en un resumen cuyo pago no registró su sello.
    and not (
      t.card_period_id is not null
      and exists (
        select 1 from public.subcategories s
         where s.id = t.subcategory_id
           and s.user_id is null
           and s.canonical_name = 'impuesto-de-sellos'
      )
      and exists (
        select 1 from public.period_payments pp
         where pp.period_id = t.card_period_id
           and not pp.stamp_tax_link_known
      )
    );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · recurrence_link_candidates — ordena por nombre, importe y fecha
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
     -- Primero lo que coincide por NOMBRE con la regla, después el importe más
     -- parecido, después la fecha más cercana al vencimiento (0077). La cuenta
     -- no ordena: lo que el usuario reconoce es qué fue, no desde dónde lo pagó.
     --
     -- Coincidir por nombre sigue la misma cadena con que la app nombra la
     -- regla: su descripción si la tiene, y si no, su subcategoría, y si no, su
     -- categoría.
     case
       when nullif(btrim(w.description), '') is not null then
         translate(lower(btrim(coalesce(t.description, ''))), 'áéíóúüñ', 'aeiouun')
           is distinct from translate(lower(btrim(w.description)), 'áéíóúüñ', 'aeiouun')
       when w.subcategory_id is not null then
         t.subcategory_id is distinct from w.subcategory_id
       when w.category_id is not null then
         t.category_id is distinct from w.category_id
       else true
     end,
     abs(t.amount - w.amount),
     abs(t.date - p_due_date),
     t.id;
$$;

revoke all on function public.recurrence_movement_linkable(public.transactions) from public, anon;
revoke all on function public.recurrence_link_candidates(uuid, date, boolean) from public, anon;
grant execute on function public.recurrence_movement_linkable(public.transactions) to authenticated;
grant execute on function public.recurrence_link_candidates(uuid, date, boolean) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Autochequeo — antes del COMMIT
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_movement_linkable(public.transactions)'::regprocedure)
     not like '%stamp_tax_link_known%'
  then
    raise exception '0077: recurrence_movement_linkable no excluye los sellos de pagos viejos';
  end if;

  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_candidates(uuid, date, boolean)'::regprocedure)
     like '%t.account_id is distinct from w.account_id%'
  then
    raise exception '0077: recurrence_link_candidates sigue ordenando por cuenta';
  end if;

  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_candidates(uuid, date, boolean)'::regprocedure)
     not like '%recurrence_movement_linkable(t)%'
  then
    raise exception '0077: recurrence_link_candidates no usa la definicion compartida';
  end if;

  raise notice '0077 OK';
end $$;

commit;
