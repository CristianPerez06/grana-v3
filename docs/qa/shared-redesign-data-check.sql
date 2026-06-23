-- =============================================================================
-- Verificación de datos · rediseño Compartido (Pasos 2-3)
-- Pegá cada bloque en el SQL Editor de Supabase y compará con lo que muestra la app.
-- El "mes" se calcula solo con la zona horaria AR (igual que la app: getTodayAR()).
--
-- IMPORTANTE: hay VARIOS hogares activos. Los §1-§9 están scopeados a "Nosotros V"
-- (id 8b24fc6d-56e9-4fdb-9163-48275076bd64). Para otro hogar, reemplazá ese id por
-- el que devuelve §0. Perspectiva: el "miembro A" de §5-§9 es el CREADOR (primer
-- joined_at); la MAGNITUD del saldo coincide con la app, el SIGNO/dirección es
-- desde la perspectiva del usuario logueado.
-- =============================================================================

-- ── §0 · Hogar activo + miembros ─────────────────────────────────────────────
select h.id as household_id, h.name, h.is_active,
       array_agg(p.full_name order by hm.joined_at) as miembros
from public.household h
join public.household_member hm on hm.household_id = h.id
join public.profiles p on p.id = hm.user_id
where h.is_active
group by h.id, h.name, h.is_active;

-- ── §1 · GASTARON (bruto) del mes · DEVENGADO · por moneda ───────────────────
-- App: hero "Gastaron {amount}". Suma `amount` (total del hogar) de gastos
-- compartidos, por FECHA DE COMPRA (date), excluyendo el padre de cuotas
-- (is_parent=false ⇒ cada cuota cuenta por su propia fecha).
with m as (
  select date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date as s,
         (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date) + interval '1 month')::date as e
)
select t.currency_code, sum(t.amount) as gastaron_bruto
from public.transactions t, m
where t.is_shared and t.type = 'expense' and t.is_parent = false
  and t.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
  and t.date >= m.s and t.date < m.e
group by t.currency_code;

-- ── §2 · REINTEGROS recibidos del mes · por moneda ───────────────────────────
-- App: hero "Reintegros −{amount}". Solo recibidos (received_at not null) y no
-- cancelados, por su `date`.
with m as (
  select date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date as s,
         (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date) + interval '1 month')::date as e
)
select t.currency_code, sum(t.amount) as reintegros_recibidos
from public.transactions t, m
where t.is_shared and t.type = 'reimbursement'
  and t.received_at is not null and t.cancelled_at is null
  and t.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
  and t.date >= m.s and t.date < m.e
group by t.currency_code;

-- NETO del hero = (§1 gastaron_bruto) − (§2 reintegros_recibidos), por moneda.

-- ── §3 · "En qué gastaron" · desglose por categoría (bruto) · por moneda ─────
with m as (
  select date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date as s,
         (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date) + interval '1 month')::date as e
)
select coalesce(c.name, '(sin categoría)') as categoria, t.currency_code,
       sum(t.amount) as total
from public.transactions t
left join public.categories c on c.id = t.category_id, m
where t.is_shared and t.type = 'expense' and t.is_parent = false
  and t.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
  and t.date >= m.s and t.date < m.e
group by c.name, t.currency_code
order by t.currency_code, total desc;

-- ── §4 · "Te toca" (tu parte del NETO) · por miembro y moneda ─────────────────
-- App: hero "Te toca {amount}". Por cada miembro: sus partes de gasto − sus
-- partes de reintegro recibido, devengado (date del mes).
with m as (
  select date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date as s,
         (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date) + interval '1 month')::date as e
)
select p.full_name as miembro, t.currency_code,
       sum(case when t.type = 'expense' then s.amount_assigned else -s.amount_assigned end) as tu_parte_neto
from public.shared_expense_split s
join public.transactions t on t.id = s.transaction_id
join public.profiles p on p.id = s.user_id, m
where s.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
  and t.date >= m.s and t.date < m.e
  and ( (t.type = 'expense' and t.is_parent = false)
     or (t.type = 'reimbursement' and t.received_at is not null and t.cancelled_at is null) )
group by p.full_name, t.currency_code
order by t.currency_code, miembro;

-- ── §5 · COMPONENTES DE LA DEUDA / CUENTA CORRIENTE (asientos crudos) ─────────
-- App: tile "Qué se deben hoy" + cuenta corriente. La deuda es DERIVADA con
-- reloj de IMPACTO. Esta lista te da cada componente para reconstruirla a mano.
-- Regla del saldo (para el miembro A): por cada gasto, la parte del que NO pagó
-- suma a favor del que pagó; por cada reintegro recibido, resta; por cada
-- liquidación, el pagador reduce lo que debía. GATING: una cuota de tarjeta
-- (due_date en mes futuro) todavía NO cuenta hoy.
select t.date, t.due_date, t.type, t.currency_code, t.amount as total,
       payer.full_name as pago, owner_split.full_name as parte_de,
       s.amount_assigned as parte,
       case
         when t.due_date is not null
              and to_char(t.due_date,'YYYY-MM') >
                  to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM')
         then 'FUTURO (no cuenta hoy)' else 'cuenta hoy' end as impacto,
       t.received_at, t.cancelled_at
from public.shared_expense_split s
join public.transactions t on t.id = s.transaction_id
join public.profiles payer on payer.id = t.user_id
join public.profiles owner_split on owner_split.id = s.user_id
where s.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
order by t.date, t.id;

-- ── §6 · LIQUIDACIONES (settlements) ─────────────────────────────────────────
-- status: pending_receipt | completed | reversed | contra. Una reversión deja la
-- original 'reversed' + una fila 'contra' (reverses_settlement_id apunta a la original).
select s.created_at::date as fecha, s.resolved_at::date as confirmada,
       payer.full_name as pago, receiver.full_name as recibe,
       s.amount, s.currency_code, s.status, s.reverses_settlement_id
from public.settlement s
join public.profiles payer on payer.id = s.payer_id
join public.profiles receiver on receiver.id = s.receiver_id
where s.household_id in (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64')
order by s.created_at;

-- ── §7 · SALDO de la cuenta corriente (aprox., reloj de impacto, HOY) ─────────
-- Reconstrucción del saldo neto por moneda hacia el miembro A. Compará con el
-- "Saldo actual" de la cuenta corriente y con el tile "Qué se deben hoy".
-- (Toma gastos cuyo impacto ya llegó: due_date null o mes <= mes actual; reintegros
--  recibidos; y todas las liquidaciones, donde 'reversed' + 'contra' se cancelan.)
with hh as (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64'),
mes as (select to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM') as ym),
miembros as (
  select array_agg(user_id order by joined_at) as ids
  from public.household_member where household_id in (select id from hh)
),
-- aporte de splits al saldo del miembro A (= ids[1])
splits_a as (
  select t.currency_code,
         sum(
           case
             when t.type = 'expense' then
               case when t.user_id = (select ids[1] from miembros) and s.user_id <> t.user_id then  s.amount_assigned   -- A pagó, el otro le debe
                    when t.user_id <> (select ids[1] from miembros) and s.user_id =  (select ids[1] from miembros) then -s.amount_assigned   -- pagó el otro, A le debe
                    else 0 end
             else -- reimbursement (received) invierte el signo
               case when t.user_id = (select ids[1] from miembros) and s.user_id <> t.user_id then -s.amount_assigned
                    when t.user_id <> (select ids[1] from miembros) and s.user_id =  (select ids[1] from miembros) then  s.amount_assigned
                    else 0 end
           end
         ) as aporte
  from public.shared_expense_split s
  join public.transactions t on t.id = s.transaction_id
  where s.household_id in (select id from hh)
    and ( (t.type='expense' and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from mes)))
       or (t.type='reimbursement' and t.received_at is not null and t.cancelled_at is null
           and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from mes))) )
  group by t.currency_code
),
settle_a as (
  select currency_code,
         sum(case when payer_id = (select ids[1] from miembros) then amount
                  when receiver_id = (select ids[1] from miembros) then -amount else 0 end) as aporte
  from public.settlement
  where household_id in (select id from hh)
  group by currency_code
)
select coalesce(sp.currency_code, se.currency_code) as moneda,
       coalesce(sp.aporte,0) + coalesce(se.aporte,0) as saldo_para_A_positivo_a_su_favor
from splits_a sp
full outer join settle_a se on se.currency_code = sp.currency_code;

-- ── §8 · ECUACIÓN de la cuenta corriente (los 3 componentes del saldo) ───────
-- App: card "Cómo llegamos a este saldo". Las 3 columnas SUMAN el saldo de §7.
--   col1 = "Partes de {otro} en lo que pagaste vos"  (+)
--   col2 = "Tus partes en lo que pagó {otro}"         (−)
--   col3 = "Reintegros y liquidaciones"
with hh as (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64'),
mes as (select to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM') as ym),
a as (select (array_agg(user_id order by joined_at))[1] as id
      from public.household_member where household_id in (select id from hh)),
counting as (
  select t.currency_code, t.type, t.user_id as payer, s.user_id as member, s.amount_assigned as share
  from public.shared_expense_split s
  join public.transactions t on t.id = s.transaction_id
  where s.household_id in (select id from hh)
    and ( (t.type='expense' and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from mes)))
       or (t.type='reimbursement' and t.received_at is not null and t.cancelled_at is null
           and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from mes))) )
)
select c.currency_code,
  sum(case when c.type='expense' and c.payer = (select id from a) and c.member <> (select id from a)
           then c.share else 0 end)                                              as partes_del_otro_que_pagaste_vos,
  sum(case when c.type='expense' and c.payer <> (select id from a) and c.member = (select id from a)
           then -c.share else 0 end)                                             as tus_partes_que_pago_el_otro,
  sum(case when c.type='reimbursement' then
             case when c.payer =  (select id from a) and c.member <> (select id from a) then -c.share
                  when c.payer <> (select id from a) and c.member =  (select id from a) then  c.share
                  else 0 end
           else 0 end)
  + coalesce((select sum(case when payer_id    = (select id from a) then amount
                              when receiver_id = (select id from a) then -amount else 0 end)
              from public.settlement
              where household_id in (select id from hh) and currency_code = c.currency_code), 0)
                                                                                 as reintegros_y_liquidaciones
from counting c
group by c.currency_code;

-- ── §9 · PROYECCIÓN "lo que se viene" · saldo acumulado a un mes futuro ───────
-- App: tile "Lo que se viene" (home) + "Lo que se viene" (cuenta corriente).
-- Cambiá :target por el mes a verificar (ej. '2026-07'). Es §7 pero evaluado
-- con asOf = ese mes (las cuotas con due_date de ese mes o anteriores ya cuentan).
with hh as (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64'),
target as (select '2026-07'::text as ym),   -- <<< CAMBIAR el mes a verificar
a as (select (array_agg(user_id order by joined_at))[1] as id
      from public.household_member where household_id in (select id from hh)),
splits_a as (
  select t.currency_code,
    sum(case
      when t.type='expense' then
        case when t.user_id =  (select id from a) and s.user_id <> t.user_id then  s.amount_assigned
             when t.user_id <> (select id from a) and s.user_id =  (select id from a) then -s.amount_assigned
             else 0 end
      else
        case when t.user_id =  (select id from a) and s.user_id <> t.user_id then -s.amount_assigned
             when t.user_id <> (select id from a) and s.user_id =  (select id from a) then  s.amount_assigned
             else 0 end
    end) as aporte
  from public.shared_expense_split s
  join public.transactions t on t.id = s.transaction_id
  where s.household_id in (select id from hh)
    and ( (t.type='expense' and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from target)))
       or (t.type='reimbursement' and t.received_at is not null and t.cancelled_at is null
           and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from target))) )
  group by t.currency_code
),
settle_a as (
  select currency_code,
    sum(case when payer_id=(select id from a) then amount when receiver_id=(select id from a) then -amount else 0 end) as aporte
  from public.settlement where household_id in (select id from hh) group by currency_code
)
select (select ym from target) as mes,
       coalesce(sp.currency_code, se.currency_code) as moneda,
       coalesce(sp.aporte,0)+coalesce(se.aporte,0)  as saldo_acumulado_a_ese_mes
from splits_a sp full outer join settle_a se on se.currency_code = sp.currency_code;

-- ── §2b · Detalle de los REINTEGROS recibidos del mes (quién + qué compensa) ──
with m as (
  select date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date as s,
         (date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date) + interval '1 month')::date as e
)
select t.date,
       t.amount,
       t.currency_code,
       receiver.full_name              as recibio,        -- user_id del reintegro = quien recibió la plata
       orig.description                as gasto_origen,
       oc.name                         as categoria_origen,
       t.received_at::date             as recibido_el
from public.transactions t
join public.profiles receiver on receiver.id = t.user_id
left join public.transactions orig on orig.id = t.linked_transaction_id
left join public.categories oc on oc.id = orig.category_id, m
where t.is_shared and t.type = 'reimbursement'
  and t.received_at is not null and t.cancelled_at is null
  and t.household_id = '8b24fc6d-56e9-4fdb-9163-48275076bd64'
  and t.date >= m.s and t.date < m.e
order by t.date, t.amount desc;

-- ── §8b · Descomposición de "Reintegros y liquidaciones" (la 3ra caja) ────────
-- App: caja 3 de "Cómo llegamos a este saldo". Separa el aporte de REINTEGROS y
-- el de LIQUIDACIONES al saldo del miembro A (creador). Los dos suman la caja 3.
--   reintegro recibido por el OTRO  → +parte (sube lo que te deben)
--   reintegro recibido por VOS      → −parte del otro
--   liquidación que pagaste VOS     → +monto ; que te pagaron a VOS → −monto
with hh as (select id from public.household where id = '8b24fc6d-56e9-4fdb-9163-48275076bd64'),
mes as (select to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM') as ym),
a as (select (array_agg(user_id order by joined_at))[1] as id
      from public.household_member where household_id in (select id from hh)),
reintegros as (
  select t.currency_code,
    sum(case when t.user_id =  (select id from a) and s.user_id <> t.user_id then -s.amount_assigned
             when t.user_id <> (select id from a) and s.user_id =  (select id from a) then  s.amount_assigned
             else 0 end) as aporte_reintegros
  from public.shared_expense_split s
  join public.transactions t on t.id = s.transaction_id
  where s.household_id in (select id from hh) and t.type='reimbursement'
    and t.received_at is not null and t.cancelled_at is null
    and (t.due_date is null or to_char(t.due_date,'YYYY-MM') <= (select ym from mes))
  group by t.currency_code
),
liquidaciones as (
  select currency_code,
    sum(case when payer_id=(select id from a) then amount when receiver_id=(select id from a) then -amount else 0 end) as aporte_liquidaciones
  from public.settlement where household_id in (select id from hh) group by currency_code
)
select coalesce(r.currency_code, l.currency_code) as moneda,
       coalesce(r.aporte_reintegros,0)            as aporte_reintegros,
       coalesce(l.aporte_liquidaciones,0)         as aporte_liquidaciones,
       coalesce(r.aporte_reintegros,0) + coalesce(l.aporte_liquidaciones,0) as caja3_total
from reintegros r full outer join liquidaciones l on l.currency_code = r.currency_code;
