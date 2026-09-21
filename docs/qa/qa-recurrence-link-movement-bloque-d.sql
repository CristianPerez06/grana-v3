-- QA · bloque D — QUIÉN ES QUIÉN
--
-- SÓLO LECTURA. No inserta, no actualiza, no borra. Se pega entero en el SQL
-- Editor y devuelve cuatro tablas.
--
-- Contesta lo que la pantalla no dice y la memoria no conserva: de qué cuenta es
-- el gasto compartido, quién registró cada liquidación, y en qué estado está la
-- ocurrencia que se vinculó. Con eso se sabe desde qué cuenta hay que hacer cada
-- paso de D6–D9, y si el caso que se está probando es realmente el CRUZADO —el
-- que la guarda no veía antes de 0073— o el de una sola persona.
--
-- La ventana de fechas cubre fines de septiembre y todo octubre de 2026, que es
-- donde vive el caso del QA. Si hiciera falta mirar otro mes, se cambian las dos
-- fechas de la consulta 2.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · El hogar y sus miembros
-- ═══════════════════════════════════════════════════════════════════════════

select
  '1 · miembros'            as consulta,
  h.id                      as household_id,
  h.name                    as hogar,
  h.is_active               as activo,
  u.email                   as miembro,
  hm.user_id                as user_id
from public.household h
join public.household_member hm on hm.household_id = h.id
join auth.users u             on u.id = hm.user_id
order by h.id, u.email;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Los movimientos de la ventana, con su dueño
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Incluye los PERSONALES: un gasto que se desvinculó volvió a serlo, así que
-- filtrar por `is_shared` lo escondería justo cuando se lo busca.

select
  '2 · movimientos'         as consulta,
  t.date                    as fecha,
  u.email                   as dueño,
  t.type::text              as tipo,
  t.amount                  as importe,
  t.currency_code           as moneda,
  t.description             as descripcion,
  t.is_shared               as compartido,
  t.household_id            as household_id,
  (select count(*) from public.shared_expense_split s where s.transaction_id = t.id) as splits,
  t.id                      as transaction_id
from public.transactions t
join auth.users u on u.id = t.user_id
where t.user_id in (
        select hm.user_id from public.household_member hm
         where hm.household_id in (select household_id from public.household_member)
      )
  and t.date between date '2026-09-20' and date '2026-10-31'
order by t.date, u.email, t.created_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Las ocurrencias resueltas, y con qué movimiento
-- ═══════════════════════════════════════════════════════════════════════════

select
  '3 · ocurrencias'                     as consulta,
  coalesce(i.due_date, i.scheduled_date) as vencimiento,
  ur.email                              as dueño_de_la_regla,
  r.description                         as regla,
  (r.household_id is not null)          as regla_compartida,
  i.status                              as estado,
  i.resolution_kind                     as resuelta_como,
  i.linked_conversion                   as convirtio_a_compartido,
  t.date                                as fecha_del_movimiento,
  ut.email                              as dueño_del_movimiento,
  t.is_shared                           as movimiento_compartido,
  i.id                                  as instance_id,
  i.confirmed_transaction_id            as transaction_id
from public.recurrence_instances i
join public.recurrences r  on r.id = i.recurrence_id
join auth.users ur         on ur.id = i.user_id
left join public.transactions t on t.id = i.confirmed_transaction_id
left join auth.users ut         on ut.id = t.user_id
where i.resolution_kind is not null
   or coalesce(i.due_date, i.scheduled_date) between date '2026-09-20' and date '2026-10-31'
order by coalesce(i.due_date, i.scheduled_date), r.description;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Las liquidaciones del hogar, con su fecha real y quién las registró
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `fecha` NO es `created_at`: es la del movimiento del pagador, que es la que
-- miran las guardas. Y es la que no ve el otro miembro —el movimiento es
-- personal del pagador—, que es exactamente el agujero que repara 0073.
--
-- `vigente` es el criterio de `settlement_is_live` (0072): completada, pendiente
-- de asignación, o revertida a la que le falta su contraasiento.

select
  '4 · liquidaciones'       as consulta,
  pm.date                   as fecha,
  up.email                  as la_registro,
  ur.email                  as la_recibe,
  s.status                  as estado,
  s.amount                  as importe,
  s.currency_code           as moneda,
  s.status in ('completed', 'pending_receipt')
    or (s.status = 'reversed' and not exists (
      select 1 from public.settlement c
       where c.reverses_settlement_id = s.id and c.status = 'contra'))
                            as vigente,
  s.id                      as settlement_id
from public.settlement s
join auth.users up on up.id = s.payer_id
join auth.users ur on ur.id = s.receiver_id
left join public.transactions pm on pm.id = s.payer_movement_id
order by pm.date nulls last, s.created_at;
