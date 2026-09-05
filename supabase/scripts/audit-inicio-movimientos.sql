-- ═══════════════════════════════════════════════════════════════════════════
-- Auditoría de datos — Inicio (las tres cards) y Movimientos, por mes.
--
-- Uso: pegar UN bloque por vez en el SQL Editor de Supabase (el editor muestra
-- solo el resultado del último statement, así que correr todo junto no sirve).
--
-- Parámetros: cada bloque arranca con el mismo CTE `p`. Cambiá ahí el mail y el
-- mes (`'YYYY-MM'`), o hacé find/replace de las dos strings en todo el archivo:
--
--     'julieta.malacalza@gmail.com'
--     '2026-08'
--
-- Hay dos tipos de bloque, y la diferencia es el método:
--
--   · RECOMPUTADO — corre como `postgres` (sin RLS) y rehace en SQL la misma
--     regla que la app aplica en TypeScript (`@grana/dashboard`,
--     `@grana/money-logic`). Scopea a la usuaria a mano. Sirve para ver los
--     renglones que forman cada número.
--   · NORMATIVO (§11, §6) — se pone en la piel de la usuaria (`set role
--     authenticated` + claims) y llama a las funciones que la app llama
--     (`get_available_sums`, `get_account_balance_sums`, `get_movements_page`).
--     Es literalmente lo que la app ve, con RLS.
--
-- Si un número RECOMPUTADO no coincide con el NORMATIVO, hay un bug de lectura.
-- Si los dos coinciden entre sí pero no con lo que esperás, el dato cargado es
-- distinto de lo que creés — §10 (detectores) suele decir por qué.
--
-- Cada bloque arranca con `reset role;`: en Supabase local el SQL Editor reusa la
-- conexión, así que el `set role authenticated` de §6/§11 quedaba pegado para el
-- bloque siguiente y `auth.users` fallaba con "permission denied for table users".
--
-- Solo lectura: ningún bloque escribe.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- §1  INICIO — resumen de las tres cards para el mes, en una sola corrida
-- ───────────────────────────────────────────────────────────────────────────
-- Devuelve una fila por concepto con ARS y USD. Las reglas son las de
-- `packages/dashboard/src/{queries,aggregations,month-summary,month-opening,
-- month-spending,committed-window}.ts`. Leé la columna `nota`.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
d as (
  select p.user_id, p.month,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  from p
),
x as (
  select d.*,
         least(d.month_to, d.today) as cut,
         to_char(d.today, 'YYYY-MM') = d.month as is_current,
         (d.month_from + interval '1 month')::date as window_start,
         (d.month_from + interval '2 month' - interval '1 day')::date as window_end
  from d
),
w as (
  select x.*,
         case when x.is_current then x.today else x.month_to end as snapshot,
         case when x.is_current then 'live' else 'snapshot' end as lens,
         x.window_end < x.today as window_elapsed
  from x
),
-- get_owned_account_ids (0051): cash/bank activas
owned as (
  select a.id from public.accounts a, x
  where a.user_id = x.user_id and a.type::text in ('cash', 'bank') and a.is_active
),
-- Patas on-ledger con las reglas de signo de get_account_balance_sums / classifyCashContribution
legs as (
  select t.id, t.date, t.type::text as type, l.account_id, l.currency_code, l.net, l.bucket
  from public.transactions t
  cross join lateral (
    values
      (t.account_id, t.currency_code,
       case t.type::text
         when 'income'        then  t.amount
         when 'expense'       then -t.amount
         when 'transfer'      then -t.amount
         when 'exchange'      then -t.amount
         when 'adjustment'    then  t.amount
         when 'reimbursement' then case when t.reimbursement_target = 'account'
                                         and t.received_at is not null
                                         and t.cancelled_at is null
                                        then t.amount else null end
         when 'settlement'    then case t.settlement_direction
                                     when 'out' then -t.amount
                                     when 'in'  then  t.amount
                                     else null end
         else null
       end,
       case when t.type::text = 'expense'
             and exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
            then 'cardPayment' else t.type::text end),
      (case when t.type::text = 'transfer' then t.transfer_destination_account_id end,
       t.currency_code, t.amount, 'transfer'),
      (case when t.type::text = 'exchange' then t.transfer_destination_account_id end,
       t.destination_currency, t.destination_amount, 'exchange')
  ) as l(account_id, currency_code, net, bucket)
  where t.status is null
    and l.account_id in (select id from owned)
    and l.currency_code in ('ARS', 'USD')
    and l.net is not null
),
-- Hero: por cuenta y moneda, inicial (si su fecha no es posterior al corte) + neto al corte
hero as (
  select a.id as account_id, ac.currency_code,
         case when ac.initial_balance_date is null or ac.initial_balance_date <= x.cut
              then ac.initial_balance else 0 end as initial,
         coalesce((select sum(l.net) from legs l
                    where l.account_id = a.id and l.currency_code = ac.currency_code
                      and l.date <= x.cut), 0) as movements
  from public.accounts a
  join public.account_currencies ac on ac.account_id = a.id
  cross join x
  where a.id in (select id from owned)
),
-- Lo mismo al cierre del mes ANTERIOR: el "Tenías" real
opening as (
  select ac.currency_code,
         sum(case when ac.initial_balance_date is null or ac.initial_balance_date < x.month_from
                  then ac.initial_balance else 0 end) as initial,
         coalesce((select sum(l.net) from legs l
                    where l.currency_code = ac.currency_code and l.date < x.month_from), 0) as movements
  from public.account_currencies ac, x
  where ac.account_id in (select id from owned)
  group by ac.currency_code, x.month_from
),
-- Resumen del mes: buckets del MonthBalanceSeries
series as (
  select l.currency_code, l.bucket, sum(l.net) as signed, sum(abs(l.net)) as magnitude
  from legs l, x
  where l.date >= x.month_from and l.date <= x.cut
  group by 1, 2
),
cur as (select * from (values ('ARS'), ('USD')) c(currency_code)),
summary as (
  select c.currency_code,
    coalesce(sum(case when s.bucket in ('income', 'reimbursement') then s.magnitude end), 0)
      + coalesce(sum(case when s.bucket in ('adjustment', 'settlement', 'exchange', 'transfer')
                           and s.signed > 0 then s.signed end), 0) as entro,
    coalesce(sum(case when s.bucket in ('expense', 'cardPayment') then s.magnitude end), 0)
      + coalesce(sum(case when s.bucket in ('adjustment', 'settlement', 'exchange', 'transfer')
                           and s.signed < 0 then -s.signed end), 0) as se_fue,
    coalesce(sum(case when s.bucket = 'income' then s.magnitude end), 0) as total_income
  from cur c
  left join series s on s.currency_code = c.currency_code
  group by c.currency_code
),
reserve as (
  select c.currency_code,
         coalesce((select sum(r.amount) from public.availability_reserve r, x
                    where r.user_id = x.user_id and r.currency_code = c.currency_code
                      and r.date <= x.cut), 0) as stock
  from cur c
),
bal as (
  select c.currency_code,
         (select coalesce(sum(h.initial + h.movements), 0) from hero h
           where h.currency_code = c.currency_code) as accounts_net,
         (select coalesce(o.initial + o.movements, 0) from opening o
           where o.currency_code = c.currency_code) as opening_real,
         (select coalesce(sum(ac.initial_balance), 0)
            from public.account_currencies ac, x
           where ac.account_id in (select id from owned)
             and ac.currency_code = c.currency_code
             and ac.initial_balance_date >= x.month_from
             and ac.initial_balance_date <= x.cut) as initials_in_month,
         case when x.is_current then r.stock else 0 end as guardado,
         s.entro, s.se_fue, s.total_income
  from cur c
  join reserve r on r.currency_code = c.currency_code
  join summary s on s.currency_code = c.currency_code
  cross join x
),
-- ── Card 2: "Cuánto gastaste" (getMonthSpending) ──────────────────────────
my_accounts as (select a.id from public.accounts a, x where a.user_id = x.user_id),
visible_tx as (   -- lo que RLS le muestra: propios + compartidos del hogar
  select t.* from public.transactions t, x
  where t.user_id = x.user_id
     or (t.is_shared and t.household_id is not null
         and t.household_id in (select hm.household_id from public.household_member hm
                                 where hm.user_id = x.user_id))
),
my_split as (
  select s.transaction_id, s.amount_assigned from public.shared_expense_split s, x
  where s.user_id = x.user_id
),
spend_rows as (
  select t.id, 'expense' as kind, t.currency_code, t.account_id, t.card_period_id,
         case when t.is_shared then ms.amount_assigned else t.amount end as own
  from visible_tx t cross join x
  left join my_split ms on ms.transaction_id = t.id
  where t.type::text = 'expense'
    and t.date between x.month_from and x.month_to
    and (t.status is not null or t.date <= x.today)          -- cajaCutOrFilter
    and not t.is_parent                                       -- countsAsCategorySpend
    and not exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
  union all
  select t.id, 'reimbursement', t.currency_code, t.account_id, t.card_period_id,
         case when t.is_shared then ms.amount_assigned else t.amount end
  from visible_tx t cross join x
  left join my_split ms on ms.transaction_id = t.id
  where t.type::text = 'reimbursement'
    and t.received_at is not null and t.cancelled_at is null
    and t.date between x.month_from and x.month_to
    and (t.status is not null or t.date <= x.today)
),
spend_buckets as (
  select r.currency_code,
         case when r.card_period_id is not null
              then case when r.account_id in (select id from my_accounts) then 'enTusTarjetas' else 'leDebesAlOtro' end
              else case when r.account_id in (select id from my_accounts) then 'pusisteVos' else 'pusoElOtro' end
         end as bucket,
         sum(case when r.kind = 'expense' then r.own else -r.own end) as net
  from spend_rows r
  where r.own is not null and r.account_id is not null
  group by 1, 2
),
spend as (
  select c.currency_code,
         greatest(coalesce(max(case when b.bucket = 'pusisteVos'    then b.net end), 0), 0) as pusiste_vos,
         greatest(coalesce(max(case when b.bucket = 'pusoElOtro'    then b.net end), 0), 0) as puso_el_otro,
         greatest(coalesce(max(case when b.bucket = 'enTusTarjetas' then b.net end), 0), 0) as en_tus_tarjetas,
         greatest(coalesce(max(case when b.bucket = 'leDebesAlOtro' then b.net end), 0), 0) as le_debes_al_otro,
         coalesce(sum(b.net), 0) as sin_piso
  from cur c left join spend_buckets b on b.currency_code = c.currency_code
  group by c.currency_code
),
-- ── Card 3: "Compromisos del próximo mes" (getCommittedOutlookForMonth) ───
credit as (
  select a.id, a.is_active from public.accounts a, w
  where a.user_id = w.user_id and a.type::text = 'credit'
),
cards_in_scope as (select c.id from credit c, w where w.lens = 'snapshot' or c.is_active),
periods as (
  select cp.id, cp.account_id, cp.due_date, cp.end_date from public.card_periods cp, w
  where cp.account_id in (select id from cards_in_scope) and cp.due_date <= w.window_end
),
paid_at_snapshot as (   -- derivePaidAtSnapshot: TODOS los débitos con fecha <= corte
  select pp.period_id
  from public.period_payments pp
  join public.transactions pt on pt.id = pp.transaction_id
  cross join w
  where pp.period_id in (select id from periods)
  group by pp.period_id
  having bool_and(pt.date <= w.snapshot)
),
unpaid as (
  select pr.*,
         case when pr.due_date between w.window_start and w.window_end then 'ventana'
              when pr.due_date < w.snapshot then 'vencido'
              else 'entre_corte_y_ventana' end as grp
  from periods pr, w
  where pr.id not in (select period_id from paid_at_snapshot)
),
card_debt as (
  select u.grp, t.currency_code,
         sum(case when t.type::text = 'reimbursement'
                    then case when t.received_at is not null and t.cancelled_at is null then -t.amount else 0 end
                  when t.status = 'pending' or (w.lens = 'snapshot' and t.status = 'paid') then t.amount
                  else 0 end) as net
  from unpaid u
  join public.transactions t on t.card_period_id = u.id and not t.is_parent
  cross join w
  where u.grp in ('ventana', 'vencido')
  group by 1, 2
),
fixed_instances as (
  select ri.amount, ri.currency_code
  from public.recurrence_instances ri
  join public.recurrences r on r.id = ri.recurrence_id
  cross join w
  where ri.user_id = w.user_id
    and ri.scheduled_date between w.window_start and w.window_end
    and ri.status = any (case when w.lens = 'live' then array['pending'] else array['pending', 'confirmed'] end)
    and r.movement_type = 'expense'
    and ri.account_id not in (select id from credit)
),
projected as (   -- walkOccurrences: desde start_date, saltando interval, cursor = last_generated_date
  select r.id as rule_id, r.movement_type, r.amount, r.currency_code, r.account_id, occ.d as scheduled_date
  from public.recurrences r
  cross join w
  cross join lateral (
    select (r.start_date + (n * r.interval_count)
              * case r.interval_unit when 'day' then interval '1 day'
                                     when 'week' then interval '1 week'
                                     when 'year' then interval '1 year'
                                     else interval '1 month' end)::date as d, n
    from generate_series(0, 2000) n
  ) occ
  where r.user_id = w.user_id and r.status = 'active' and not w.window_elapsed
    and (r.max_occurrences is null or occ.n < r.max_occurrences)
    and occ.d between w.window_start and w.window_end
    and (r.end_date is null or occ.d <= r.end_date)
    and (r.last_generated_date is null or occ.d > r.last_generated_date)
),
committed as (
  select c.currency_code,
         coalesce((select net from card_debt cd where cd.grp = 'ventana' and cd.currency_code = c.currency_code), 0) as tarjetas,
         coalesce((select net from card_debt cd where cd.grp = 'vencido' and cd.currency_code = c.currency_code), 0) as vencido,
         coalesce((select sum(amount) from fixed_instances fi where fi.currency_code = c.currency_code), 0)
           + coalesce((select sum(amount) from projected pj
                        where pj.movement_type = 'expense' and pj.currency_code = c.currency_code
                          and pj.account_id not in (select id from credit)), 0) as gastos_fijos,
         coalesce((select sum(amount) from projected pj
                    where pj.movement_type = 'income' and pj.currency_code = c.currency_code), 0) as ya_entra
  from cur c
),
-- ── Movimientos: dona de egresos (getMonthCategoryBreakdown), para cruzar ──
donut as (
  select r.currency_code, sum(case when r.kind = 'expense' then r.own else -r.own end) as neto
  from spend_rows r where r.own is not null
  group by 1
),
rows_out as (
  select 0 as ord, 'contexto' as seccion, 'mes / corte CAJA / hoy AR / lente compromisos / ventana' as concepto,
         null::numeric as ars, null::numeric as usd,
         w.month || ' · corte ' || w.cut || ' · hoy ' || w.today || ' · ' || w.lens
           || ' · ventana ' || w.window_start || '→' || w.window_end
           || case when w.window_elapsed then ' (ya pasó: sin proyección de reglas)' else '' end as nota
  from w
  union all select 10, 'Saldo', 'Cuentas propias (inicial + neto al corte)',
         (select accounts_net from bal where currency_code = 'ARS'), (select accounts_net from bal where currency_code = 'USD'),
         'Σ "Dónde está". Tiene que coincidir con get_available_sums.accounts_net (§11)'
  union all select 11, 'Saldo', 'Guardado (stock de reservas)',
         (select guardado from bal where currency_code = 'ARS'), (select guardado from bal where currency_code = 'USD'),
         'Solo en el mes corriente; en un mes pasado es 0 por diseño'
  union all select 12, 'Saldo', 'DISPONIBLE (zona oscura)',
         (select accounts_net - guardado from bal where currency_code = 'ARS'), (select accounts_net - guardado from bal where currency_code = 'USD'),
         'cuentas − guardado'
  union all select 20, 'Resumen del mes', 'Tenías (derivado por la card)',
         (select accounts_net - entro + se_fue from bal where currency_code = 'ARS'), (select accounts_net - entro + se_fue from bal where currency_code = 'USD'),
         'disponible − (entró − se fue − guardado). Es lo que la card muestra'
  union all select 21, 'Resumen del mes', 'Tenías REAL (saldo al cierre del mes anterior)',
         (select opening_real from bal where currency_code = 'ARS'), (select opening_real from bal where currency_code = 'USD'),
         'Si difiere del anterior, la diferencia son saldos iniciales fechados dentro del mes (fila siguiente)'
  union all select 22, 'Resumen del mes', 'Saldos iniciales con fecha dentro del mes',
         (select initials_in_month from bal where currency_code = 'ARS'), (select initials_in_month from bal where currency_code = 'USD'),
         'Entran al saldo sin pasar por Entró/Se fue → la card los absorbe en "Tenías"'
  union all select 23, 'Resumen del mes', 'Entró',
         (select entro from bal where currency_code = 'ARS'), (select entro from bal where currency_code = 'USD'),
         'ingresos + reintegros a cuenta + lado positivo de ajustes/saldadas/cambios/transfer con una sola pata propia'
  union all select 24, 'Resumen del mes', 'Se fue',
         (select se_fue from bal where currency_code = 'ARS'), (select se_fue from bal where currency_code = 'USD'),
         'gastos en cuenta + pagos de resumen + lado negativo de los con signo. Consumos con tarjeta NO están (off-ledger)'
  union all select 30, 'Cuánto gastaste', 'GASTASTE',
         (select pusiste_vos + puso_el_otro + en_tus_tarjetas + le_debes_al_otro from spend where currency_code = 'ARS'),
         (select pusiste_vos + puso_el_otro + en_tus_tarjetas + le_debes_al_otro from spend where currency_code = 'USD'),
         'devengado: gasto propio del mes (porción propia en compartidos), incluye consumos y cuotas de tarjeta por su fecha'
  union all select 31, 'Cuánto gastaste', 'Ya se pagó · pusiste vos',
         (select pusiste_vos from spend where currency_code = 'ARS'), (select pusiste_vos from spend where currency_code = 'USD'),
         'salió de una cuenta tuya (sin card_period_id)'
  union all select 32, 'Cuánto gastaste', 'Ya se pagó · lo puso el otro',
         (select puso_el_otro from spend where currency_code = 'ARS'), (select puso_el_otro from spend where currency_code = 'USD'),
         'salió de una cuenta del otro miembro'
  union all select 33, 'Cuánto gastaste', 'Por pagar · en tus tarjetas',
         (select en_tus_tarjetas from spend where currency_code = 'ARS'), (select en_tus_tarjetas from spend where currency_code = 'USD'),
         'consumos/cuotas con card_period_id en tarjeta tuya (pending o paid, cuenta igual: es devengado)'
  union all select 34, 'Cuánto gastaste', 'Por pagar · se lo debés al otro',
         (select le_debes_al_otro from spend where currency_code = 'ARS'), (select le_debes_al_otro from spend where currency_code = 'USD'),
         'en tarjeta del otro'
  union all select 35, 'Cuánto gastaste', 'Ritmo: ingresos del mes (denominador)',
         (select total_income from bal where currency_code = 'ARS'), (select total_income from bal where currency_code = 'USD'),
         'la tira usa solo ARS: Gastaste ARS / ingresos ARS del MonthBalanceSeries'
  union all select 36, 'Cuánto gastaste', 'check: neto sin piso en 0',
         (select sin_piso from spend where currency_code = 'ARS'), (select sin_piso from spend where currency_code = 'USD'),
         'si es menor que GASTASTE, algún bucket quedó negativo (reintegro > gasto) y se pisó en 0'
  union all select 40, 'Compromisos', 'Tarjetas · a pagar en la ventana',
         (select tarjetas from committed where currency_code = 'ARS'), (select tarjetas from committed where currency_code = 'USD'),
         'resúmenes con due_date en la ventana, no saldados al corte: consumos − reintegros en resumen'
  union all select 41, 'Compromisos', 'Tarjetas · vencido',
         (select vencido from committed where currency_code = 'ARS'), (select vencido from committed where currency_code = 'USD'),
         'resúmenes con due_date < corte y no saldados al corte'
  union all select 42, 'Compromisos', 'Gastos fijos',
         (select gastos_fijos from committed where currency_code = 'ARS'), (select gastos_fijos from committed where currency_code = 'USD'),
         'instancias en la ventana (pending; +confirmed en lente snapshot) + proyección de reglas activas, sin las pagadas con tarjeta. §5b marca si una regla está contada dos veces'
  union all select 43, 'Compromisos', 'TOTAL comprometido',
         (select tarjetas + vencido + gastos_fijos from committed where currency_code = 'ARS'),
         (select tarjetas + vencido + gastos_fijos from committed where currency_code = 'USD'),
         'tarjetas + vencido + gastos fijos'
  union all select 44, 'Compromisos', 'Ya entra (ingresos recurrentes proyectados)',
         (select ya_entra from committed where currency_code = 'ARS'), (select ya_entra from committed where currency_code = 'USD'),
         'no se suma al total; banda de contexto'
  union all select 50, 'Movimientos', 'Dona de egresos: Σ porciones − reintegros',
         (select neto from donut where currency_code = 'ARS'), (select neto from donut where currency_code = 'USD'),
         'misma lente que GASTASTE. Difiere solo por filas sin account_id (la card las saltea) o por pisos en 0'
)
select seccion, concepto, ars, usd, nota
from rows_out
order by ord;


-- ───────────────────────────────────────────────────────────────────────────
-- §2  INICIO — "Dónde está": saldo por cuenta y moneda al corte del mes
-- ───────────────────────────────────────────────────────────────────────────
-- Incluye también las archivadas y las tarjetas (marcadas) para que veas plata
-- que EXISTE pero no entra al Disponible.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id, p.month,
         (p.month || '-01')::date as month_from,
         least(((p.month || '-01')::date + interval '1 month' - interval '1 day')::date,
               (now() at time zone 'America/Argentina/Buenos_Aires')::date) as cut
  from p
),
legs as (
  select t.id, t.date, l.account_id, l.currency_code, l.net
  from public.transactions t
  cross join lateral (
    values
      (t.account_id, t.currency_code,
       case t.type::text
         when 'income' then t.amount when 'expense' then -t.amount
         when 'transfer' then -t.amount when 'exchange' then -t.amount
         when 'adjustment' then t.amount
         when 'reimbursement' then case when t.reimbursement_target = 'account' and t.received_at is not null and t.cancelled_at is null then t.amount else null end
         when 'settlement' then case t.settlement_direction when 'out' then -t.amount when 'in' then t.amount else null end
         else null end),
      (case when t.type::text = 'transfer' then t.transfer_destination_account_id end, t.currency_code, t.amount),
      (case when t.type::text = 'exchange' then t.transfer_destination_account_id end, t.destination_currency, t.destination_amount)
  ) as l(account_id, currency_code, net)
  where t.status is null and l.account_id is not null and l.net is not null
)
select a.name as cuenta,
       coalesce(i.name, '') as institucion,
       a.type::text as tipo,
       a.is_active as activa,
       case when a.type::text in ('cash', 'bank') and a.is_active then 'SÍ' else 'no (fuera del Disponible)' end as cuenta_propia,
       ac.currency_code as moneda,
       ac.initial_balance as inicial_declarado,
       ac.initial_balance_date as fecha_inicial,
       case when ac.initial_balance_date <= x.cut then ac.initial_balance else 0 end as inicial_que_cuenta,
       coalesce((select sum(l.net) from legs l where l.account_id = a.id and l.currency_code = ac.currency_code and l.date <= x.cut), 0) as neto_movimientos,
       case when ac.initial_balance_date <= x.cut then ac.initial_balance else 0 end
         + coalesce((select sum(l.net) from legs l where l.account_id = a.id and l.currency_code = ac.currency_code and l.date <= x.cut), 0) as saldo_al_corte,
       (select count(*) from legs l where l.account_id = a.id and l.currency_code = ac.currency_code and l.date <= x.cut) as cant_patas,
       (select count(*) from legs l where l.account_id = a.id and l.currency_code = ac.currency_code and l.date > x.cut) as patas_futuras_no_contadas
from public.accounts a
join public.account_currencies ac on ac.account_id = a.id
left join public.institutions i on i.id = a.institution_id
cross join x
where a.user_id = x.user_id
order by cuenta_propia desc, a.type, a.name, ac.currency_code;


-- ───────────────────────────────────────────────────────────────────────────
-- §3  INICIO — "Resumen del mes": los movimientos CAJA detrás de Entró / Se fue
-- ───────────────────────────────────────────────────────────────────────────
-- Una fila por PATA (una transferencia entre dos cuentas propias son dos filas
-- que se cancelan). `lado` dice a qué columna de la card va.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id, p.month,
         (p.month || '-01')::date as month_from,
         least(((p.month || '-01')::date + interval '1 month' - interval '1 day')::date,
               (now() at time zone 'America/Argentina/Buenos_Aires')::date) as cut
  from p
),
owned as (
  select a.id from public.accounts a, x
  where a.user_id = x.user_id and a.type::text in ('cash', 'bank') and a.is_active
),
legs as (
  select t.id, t.date, t.type::text as type, t.description, t.category_id, l.account_id, l.currency_code, l.net, l.bucket, l.leg
  from public.transactions t
  cross join lateral (
    values
      (t.account_id, t.currency_code,
       case t.type::text
         when 'income' then t.amount when 'expense' then -t.amount
         when 'transfer' then -t.amount when 'exchange' then -t.amount
         when 'adjustment' then t.amount
         when 'reimbursement' then case when t.reimbursement_target = 'account' and t.received_at is not null and t.cancelled_at is null then t.amount else null end
         when 'settlement' then case t.settlement_direction when 'out' then -t.amount when 'in' then t.amount else null end
         else null end,
       case when t.type::text = 'expense' and exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
            then 'cardPayment' else t.type::text end,
       'origen'),
      (case when t.type::text = 'transfer' then t.transfer_destination_account_id end, t.currency_code, t.amount, 'transfer', 'destino'),
      (case when t.type::text = 'exchange' then t.transfer_destination_account_id end, t.destination_currency, t.destination_amount, 'exchange', 'destino')
  ) as l(account_id, currency_code, net, bucket, leg)
  where t.status is null
    and l.account_id in (select id from owned)
    and l.currency_code in ('ARS', 'USD')
    and l.net is not null
)
select l.date as fecha,
       l.type as tipo,
       l.bucket,
       l.leg as pata,
       a.name as cuenta,
       l.currency_code as moneda,
       l.net as efecto_en_saldo,
       case when l.bucket in ('income', 'reimbursement') then 'Entró'
            when l.bucket in ('expense', 'cardPayment') then 'Se fue'
            when l.net > 0 then 'Entró (con signo)'
            when l.net < 0 then 'Se fue (con signo)'
            else 'se cancela' end as lado,
       c.name as categoria,
       l.description as descripcion,
       l.id as tx_id
from legs l
join public.accounts a on a.id = l.account_id
left join public.categories c on c.id = l.category_id
cross join x
where l.date >= x.month_from and l.date <= x.cut
order by l.date, l.id, l.leg;


-- ───────────────────────────────────────────────────────────────────────────
-- §3b INICIO — "Entró" y "Se fue" desglosados por origen
-- ───────────────────────────────────────────────────────────────────────────
-- "Entró" NO es "ingresos". Es todo lo que subió el saldo de las cuentas propias:
-- ingresos + reintegros recibidos a cuenta + saldadas cobradas + la pata que
-- llega de un cambio de moneda + ajustes positivos + transferencias con una sola
-- pata propia. La dona "De dónde vino" y la tira de ritmo usan SOLO `income`.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id, p.month,
         (p.month || '-01')::date as month_from,
         least(((p.month || '-01')::date + interval '1 month' - interval '1 day')::date,
               (now() at time zone 'America/Argentina/Buenos_Aires')::date) as cut
  from p
),
owned as (
  select a.id from public.accounts a, x
  where a.user_id = x.user_id and a.type::text in ('cash', 'bank') and a.is_active
),
legs as (
  select t.id, t.date, l.account_id, l.currency_code, l.net, l.bucket
  from public.transactions t
  cross join lateral (
    values
      (t.account_id, t.currency_code,
       case t.type::text
         when 'income' then t.amount when 'expense' then -t.amount
         when 'transfer' then -t.amount when 'exchange' then -t.amount
         when 'adjustment' then t.amount
         when 'reimbursement' then case when t.reimbursement_target = 'account' and t.received_at is not null and t.cancelled_at is null then t.amount else null end
         when 'settlement' then case t.settlement_direction when 'out' then -t.amount when 'in' then t.amount else null end
         else null end,
       case when t.type::text = 'expense' and exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
            then 'cardPayment' else t.type::text end),
      (case when t.type::text = 'transfer' then t.transfer_destination_account_id end, t.currency_code, t.amount, 'transfer'),
      (case when t.type::text = 'exchange' then t.transfer_destination_account_id end, t.destination_currency, t.destination_amount, 'exchange')
  ) as l(account_id, currency_code, net, bucket)
  where t.status is null
    and l.account_id in (select id from owned)
    and l.currency_code in ('ARS', 'USD')
    and l.net is not null
),
agg as (
  select l.currency_code, l.bucket, sum(l.net) as signed, sum(abs(l.net)) as magnitude, count(*) as patas
  from legs l, x
  where l.date >= x.month_from and l.date <= x.cut
  group by 1, 2
)
select currency_code as moneda,
       case bucket
         when 'income' then 'ingresos (lo que muestra "De dónde vino" y el ritmo)'
         when 'reimbursement' then 'reintegros recibidos a cuenta'
         when 'expense' then 'gastos pagados desde una cuenta'
         when 'cardPayment' then 'pagos de resumen de tarjeta'
         when 'adjustment' then 'ajustes (con signo)'
         when 'settlement' then 'saldadas del hogar (con signo)'
         when 'exchange' then 'cambio de moneda, pata en esta moneda (con signo)'
         when 'transfer' then 'transferencias con una sola pata propia (con signo)'
         else bucket end as origen,
       case when bucket in ('income', 'reimbursement') then 'Entró'
            when bucket in ('expense', 'cardPayment') then 'Se fue'
            when signed >= 0 then 'Entró' else 'Se fue' end as lado,
       case when bucket in ('income', 'reimbursement', 'expense', 'cardPayment') then magnitude else abs(signed) end as monto,
       patas
from agg
order by moneda, lado, monto desc;

-- ───────────────────────────────────────────────────────────────────────────
-- §4  INICIO — "Cuánto gastaste": cada gasto/reintegro del mes con su bucket
-- ───────────────────────────────────────────────────────────────────────────
-- Devengado. `porcion_propia` NULL = compartido sin split para vos (la card lo
-- saltea). `bucket` NULL = sin cuenta (la card lo saltea). `motivo_exclusion`
-- explica las filas que la card no cuenta.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id, p.month,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  from p
),
my_accounts as (select a.id from public.accounts a, x where a.user_id = x.user_id),
visible_tx as (
  select t.* from public.transactions t, x
  where t.user_id = x.user_id
     or (t.is_shared and t.household_id is not null
         and t.household_id in (select hm.household_id from public.household_member hm where hm.user_id = x.user_id))
),
my_split as (
  select s.transaction_id, s.amount_assigned from public.shared_expense_split s, x where s.user_id = x.user_id
)
select t.date as fecha,
       t.type::text as tipo,
       t.amount as monto_total,
       case when t.is_shared then ms.amount_assigned else t.amount end as porcion_propia,
       t.currency_code as moneda,
       a.name as cuenta,
       case when t.user_id = x.user_id then 'mío' else 'del otro (compartido)' end as dueño,
       t.is_shared as compartido,
       t.status as status_tarjeta,
       case when t.card_period_id is not null then 'sí' else '' end as en_resumen,
       t.installment_n || '/' || t.installments_total as cuota,
       case
         when t.is_parent then 'EXCLUIDO: parent de cuotas (cuentan las cuotas por su fecha)'
         when exists (select 1 from public.period_payments pp where pp.transaction_id = t.id) then 'EXCLUIDO: pago de resumen (los consumos ya contaron)'
         when t.type::text = 'reimbursement' and (t.received_at is null or t.cancelled_at is not null) then 'EXCLUIDO: reintegro no recibido / cancelado'
         when t.status is null and t.date > x.today then 'EXCLUIDO: fecha futura (corte CAJA)'
         when t.is_shared and ms.amount_assigned is null then 'EXCLUIDO: compartido sin split para vos'
         when t.account_id is null then 'EXCLUIDO: sin cuenta'
         else ''
       end as motivo_exclusion,
       case when t.card_period_id is not null
            then case when t.account_id in (select id from my_accounts) then 'Por pagar · en tus tarjetas' else 'Por pagar · se lo debés al otro' end
            else case when t.account_id in (select id from my_accounts) then 'Ya se pagó · pusiste vos' else 'Ya se pagó · lo puso el otro' end
       end as bucket,
       case when t.type::text = 'reimbursement' then 'resta' else 'suma' end as efecto,
       c.name as categoria,
       t.description as descripcion,
       t.id as tx_id
from visible_tx t
cross join x
left join my_split ms on ms.transaction_id = t.id
left join public.accounts a on a.id = t.account_id
left join public.categories c on c.id = t.category_id
where t.type::text in ('expense', 'reimbursement')
  and t.date between x.month_from and x.month_to
order by motivo_exclusion, t.date, t.created_at;


-- ───────────────────────────────────────────────────────────────────────────
-- §5a INICIO — "Compromisos": resúmenes de tarjeta candidatos y su estado al corte
-- ───────────────────────────────────────────────────────────────────────────
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
w as (
  select p.user_id,
         (p.month || '-01')::date + interval '1 month' as window_start,
         ((p.month || '-01')::date + interval '2 month' - interval '1 day')::date as window_end,
         case when to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') = p.month
              then (now() at time zone 'America/Argentina/Buenos_Aires')::date
              else ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date end as snapshot,
         case when to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') = p.month
              then 'live' else 'snapshot' end as lens
  from p
)
select coalesce(i.name, a.name) as tarjeta,
       a.is_active as activa,
       cp.start_date as desde, cp.end_date as cierre, cp.due_date as vence,
       case when a.is_active or w.lens = 'snapshot' then 'sí' else 'no (archivada, lente live)' end as entra_en_scope,
       (select string_agg(pt.date::text || ' ' || pt.currency_code || ' ' || pt.amount, ' | ')
          from public.period_payments pp join public.transactions pt on pt.id = pp.transaction_id
         where pp.period_id = cp.id) as pagos,
       case when exists (select 1 from public.period_payments pp where pp.period_id = cp.id)
             and (select bool_and(pt.date <= w.snapshot) from public.period_payments pp
                    join public.transactions pt on pt.id = pp.transaction_id where pp.period_id = cp.id)
            then 'PAGADO al corte'
            when cp.due_date between w.window_start and w.window_end then 'A PAGAR (ventana)'
            when cp.due_date < w.snapshot then 'VENCIDO'
            else 'fuera (vence entre el corte y la ventana → hueco conocido)' end as estado,
       (select sum(case when t.type::text = 'reimbursement'
                          then case when t.received_at is not null and t.cancelled_at is null then -t.amount else 0 end
                        when t.status = 'pending' or (w.lens = 'snapshot' and t.status = 'paid') then t.amount
                        else 0 end)
          from public.transactions t where t.card_period_id = cp.id and not t.is_parent and t.currency_code = 'ARS') as deuda_ars,
       (select sum(case when t.type::text = 'reimbursement'
                          then case when t.received_at is not null and t.cancelled_at is null then -t.amount else 0 end
                        when t.status = 'pending' or (w.lens = 'snapshot' and t.status = 'paid') then t.amount
                        else 0 end)
          from public.transactions t where t.card_period_id = cp.id and not t.is_parent and t.currency_code = 'USD') as deuda_usd,
       (select count(*) from public.transactions t where t.card_period_id = cp.id and not t.is_parent) as consumos,
       (select count(*) from public.transactions t where t.card_period_id = cp.id and not t.is_parent and t.status = 'pending') as pendientes,
       (select count(*) from public.transactions t where t.card_period_id = cp.id and not t.is_parent and t.status = 'paid') as pagados,
       cp.id as period_id
from public.card_periods cp
join public.accounts a on a.id = cp.account_id
left join public.institutions i on i.id = a.institution_id
cross join w
where a.user_id = w.user_id and a.type::text = 'credit'
  and cp.due_date <= w.window_end
order by estado, cp.due_date desc, tarjeta;


-- ───────────────────────────────────────────────────────────────────────────
-- §5b INICIO — "Compromisos": gastos fijos en la ventana (instancias + proyección)
-- ───────────────────────────────────────────────────────────────────────────
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
w as (
  select p.user_id,
         ((p.month || '-01')::date + interval '1 month')::date as window_start,
         ((p.month || '-01')::date + interval '2 month' - interval '1 day')::date as window_end,
         case when to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') = p.month
              then 'live' else 'snapshot' end as lens,
         ((p.month || '-01')::date + interval '2 month' - interval '1 day')::date
           < (now() at time zone 'America/Argentina/Buenos_Aires')::date as window_elapsed
  from p
),
credit as (select a.id from public.accounts a, w where a.user_id = w.user_id and a.type::text = 'credit')
select 'instancia' as origen, ri.scheduled_date as fecha, r.movement_type as tipo, ri.status,
       ri.amount, ri.currency_code as moneda, a.name as cuenta,
       coalesce(ri.description, sc.name, c.name) as etiqueta,
       case when r.movement_type <> 'expense' then 'no cuenta: no es gasto'
            when ri.account_id in (select id from credit) then 'no cuenta: pagada con tarjeta (va en el resumen)'
            when ri.status = 'skipped' then 'no cuenta: omitida'
            when ri.status = 'confirmed' and w.lens = 'live' then 'no cuenta en live: ya confirmada'
            else 'CUENTA' end as cuenta_en_card,
       r.id as rule_id
from public.recurrence_instances ri
join public.recurrences r on r.id = ri.recurrence_id
left join public.accounts a on a.id = ri.account_id
left join public.categories c on c.id = ri.category_id
left join public.subcategories sc on sc.id = ri.subcategory_id
cross join w
where ri.user_id = w.user_id and ri.scheduled_date between w.window_start and w.window_end
union all
select 'proyección', occ.d, r.movement_type, r.status,
       r.amount, r.currency_code, a.name,
       coalesce(r.description, sc.name, c.name),
       case when w.window_elapsed then 'no cuenta: ventana ya pasada, no se proyecta'
            when r.movement_type = 'expense' and r.account_id in (select id from credit) then 'no cuenta: pagada con tarjeta'
            when r.movement_type = 'expense' then 'CUENTA (gasto fijo)'
            when r.movement_type = 'income' then 'CUENTA en "Ya entra"'
            else 'no cuenta: transferencia' end
       -- El generador NO mueve last_generated_date al crear la instancia pendiente
       -- (solo confirmar/omitir lo mueven). Si ya existe una instancia con esta
       -- misma fecha, la card suma la instancia Y la proyección: doble conteo.
       || case when exists (select 1 from public.recurrence_instances ri
                             where ri.recurrence_id = r.id and ri.scheduled_date = occ.d
                               and ri.status <> 'skipped')
               then ' ⚠ TAMBIÉN HAY INSTANCIA CON ESTA FECHA → la card la cuenta dos veces'
               else '' end,
       r.id
from public.recurrences r
left join public.accounts a on a.id = r.account_id
left join public.categories c on c.id = r.category_id
left join public.subcategories sc on sc.id = r.subcategory_id
cross join w
cross join lateral (
  select (r.start_date + (n * r.interval_count)
            * case r.interval_unit when 'day' then interval '1 day' when 'week' then interval '1 week'
                                   when 'year' then interval '1 year' else interval '1 month' end)::date as d, n
  from generate_series(0, 2000) n
) occ
where r.user_id = w.user_id and r.status = 'active'
  and (r.max_occurrences is null or occ.n < r.max_occurrences)
  and occ.d between w.window_start and w.window_end
  and (r.end_date is null or occ.d <= r.end_date)
  and (r.last_generated_date is null or occ.d > r.last_generated_date)
order by 1, 2;


-- ───────────────────────────────────────────────────────────────────────────
-- §6  MOVIMIENTOS — la lista del mes tal como la ve la app (RPC + RLS)
-- ───────────────────────────────────────────────────────────────────────────
-- NORMATIVO. Llama a get_movements_page con los claims de la usuaria. La app
-- pagina de a 50 (hasta 500); acá pedimos 500. `excludeShared` = true es el
-- default de la UI (toggle "mostrar compartidos" apagado): cambialo si lo tenés
-- prendido.
reset role;
select set_config('request.jwt.claims',
  (select json_build_object('sub', u.id, 'role', 'authenticated')::text
     from auth.users u where u.email = 'julieta.malacalza@gmail.com'), false);
set role authenticated;
select j->>'date' as fecha,
       case when (j->>'is_parent')::boolean then 'installment_purchase'
            when jsonb_array_length(coalesce(j->'period_payments', '[]'::jsonb)) > 0 then 'card_payment'
            else j->>'type' end as kind,
       (j->>'amount')::numeric as monto,
       j->>'currency_code' as moneda,
       j->'category'->>'name' as categoria,
       j->'subcategory'->>'name' as subcategoria,
       j->'source_account'->>'name' as cuenta,
       j->'destination_account'->>'name' as destino,
       j->>'description' as descripcion,
       j->'linked_expense'->>'description' as gasto_vinculado,
       (j->>'is_shared')::boolean as compartido,
       j->>'status' as status_tarjeta,
       j->>'installment_n' || '/' || (j->>'installments_total') as cuota,
       j->>'id' as tx_id
from public.get_movements_page(
       jsonb_build_object(
         'from', '2026-08' || '-01',
         'to',   (('2026-08' || '-01')::date + interval '1 month' - interval '1 day')::date::text,
         'excludeShared', true
       ),
       500, 0) as j;


-- ───────────────────────────────────────────────────────────────────────────
-- §6b MOVIMIENTOS — lo que existe en el mes pero la lista NO muestra, y por qué
-- ───────────────────────────────────────────────────────────────────────────
-- RECOMPUTADO. Si "no ves" un movimiento, casi seguro está acá.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to
  from p
),
visible_tx as (
  select t.* from public.transactions t, x
  where t.user_id = x.user_id
     or (t.is_shared and t.household_id is not null
         and t.household_id in (select hm.household_id from public.household_member hm where hm.user_id = x.user_id))
)
select t.date as fecha, t.type::text as tipo, t.amount, t.currency_code as moneda,
       a.name as cuenta, c.name as categoria, t.description as descripcion,
       t.installment_n || '/' || t.installments_total as cuota,
       case
         when t.parent_id is not null then 'cuota hija: la lista muestra la COMPRA (parent); la cuota se ve en el detalle y en la tarjeta'
         when t.type::text = 'reimbursement' and t.cancelled_at is not null then 'reintegro cancelado'
         when t.type::text = 'reimbursement' and t.received_at is null then 'reintegro pendiente: está en "Por confirmar", no en la historia'
         when t.is_shared and t.user_id <> x.user_id then 'compartido cargado por el otro: se ve solo con "mostrar compartidos"'
         when t.is_shared then 'compartido tuyo: se ve solo con "mostrar compartidos"'
       end as por_que_no_se_ve,
       t.id as tx_id
from visible_tx t
cross join x
left join public.accounts a on a.id = t.account_id
left join public.categories c on c.id = t.category_id
where t.date between x.month_from and x.month_to
  and (t.parent_id is not null
       or (t.type::text = 'reimbursement' and (t.received_at is null or t.cancelled_at is not null))
       or t.is_shared)
order by t.date, t.created_at;


-- ───────────────────────────────────────────────────────────────────────────
-- §7  MOVIMIENTOS — "En qué se fue": dona de egresos por categoría
-- ───────────────────────────────────────────────────────────────────────────
-- getMonthCategoryBreakdown. Neto > 0 = porción de la dona; neto < 0 = crédito
-- ("te devolvieron"). El reintegro toma la categoría del gasto vinculado.
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  from p
),
visible_tx as (
  select t.* from public.transactions t, x
  where t.user_id = x.user_id
     or (t.is_shared and t.household_id is not null
         and t.household_id in (select hm.household_id from public.household_member hm where hm.user_id = x.user_id))
),
my_split as (
  select s.transaction_id, s.amount_assigned from public.shared_expense_split s, x where s.user_id = x.user_id
),
rows_in as (
  select t.category_id, t.currency_code,
         case when t.is_shared then ms.amount_assigned else t.amount end as own, 'expense' as kind
  from visible_tx t cross join x left join my_split ms on ms.transaction_id = t.id
  where t.type::text = 'expense'
    and t.date between x.month_from and x.month_to
    and (t.status is not null or t.date <= x.today)
    and not t.is_parent
    and not exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
  union all
  select le.category_id, t.currency_code,
         case when t.is_shared then ms.amount_assigned else t.amount end, 'reimbursement'
  from visible_tx t cross join x
  left join my_split ms on ms.transaction_id = t.id
  left join public.transactions le on le.id = t.linked_transaction_id
  where t.type::text = 'reimbursement'
    and t.received_at is not null and t.cancelled_at is null
    and t.date between x.month_from and x.month_to
    and (t.status is not null or t.date <= x.today)
)
select case when r.category_id is null then '(sin categoría → la UI dice "Sin categoría")'
            when c.name is null or btrim(c.name) = '' then '⚠ NOMBRE VACÍO'
            else c.name end as categoria,
       c.canonical_name as canonical,
       case when c.id is null then null when c.user_id is null then 'sistema (la UI traduce por canonical)' else 'propia' end as origen,
       r.category_id,
       r.currency_code as moneda,
       sum(case when r.kind = 'expense' then r.own else 0 end) as gastos,
       sum(case when r.kind = 'reimbursement' then r.own else 0 end) as reintegros,
       sum(case when r.kind = 'expense' then r.own else -r.own end) as neto,
       case when sum(case when r.kind = 'expense' then r.own else -r.own end) > 0 then 'porción de la dona'
            when sum(case when r.kind = 'expense' then r.own else -r.own end) < 0 then 'crédito ("te devolvieron")'
            else 'no se muestra (neto 0)' end as en_pantalla,
       count(*) filter (where r.kind = 'expense') as cant_gastos
from rows_in r
left join public.categories c on c.id = r.category_id
where r.own is not null
group by 1, 2, 3, 4, 5
order by r.currency_code, neto desc;


-- ───────────────────────────────────────────────────────────────────────────
-- §7b MOVIMIENTOS — cada reintegro RECIBIDO en el mes y el gasto que devuelve
-- ───────────────────────────────────────────────────────────────────────────
-- El reintegro toma la categoría del gasto vinculado, aunque ese gasto sea de
-- OTRO mes. Si en el mes no hubo gasto en esa categoría (o hubo menos), el neto
-- queda negativo y la dona lo muestra abajo como "Te devolvieron".
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to
  from p
),
visible_tx as (
  select t.* from public.transactions t, x
  where t.user_id = x.user_id
     or (t.is_shared and t.household_id is not null
         and t.household_id in (select hm.household_id from public.household_member hm where hm.user_id = x.user_id))
)
select r.date as fecha_reintegro,
       r.amount as monto,
       (select s.amount_assigned from public.shared_expense_split s, x where s.transaction_id = r.id and s.user_id = x.user_id) as porcion_propia_si_compartido,
       r.currency_code as moneda,
       r.reimbursement_target as destino,
       case r.reimbursement_target
         when 'account' then 'sube el saldo de ' || coalesce(a.name, '?') || ' → cuenta en "Entró" y resta en "Ya se pagó"'
         when 'statement' then 'baja la deuda del resumen → resta en "Por pagar" y en Compromisos'
         else '?' end as efecto,
       le.date as fecha_gasto,
       le.description as gasto,
       le.amount as monto_gasto,
       coalesce(c.name, '(sin categoría)') as categoria_del_gasto,
       case when le.date < x.month_from or le.date > x.month_to then 'el gasto es de OTRO mes' else '' end as nota,
       r.id as reintegro_id, le.id as gasto_id
from visible_tx r
cross join x
left join public.transactions le on le.id = r.linked_transaction_id
left join public.categories c on c.id = le.category_id
left join public.accounts a on a.id = r.account_id
where r.type::text = 'reimbursement'
  and r.received_at is not null and r.cancelled_at is null
  and r.date between x.month_from and x.month_to
order by r.date;

-- ───────────────────────────────────────────────────────────────────────────
-- §8  MOVIMIENTOS — "De dónde vino": ingresos por categoría
-- ───────────────────────────────────────────────────────────────────────────
-- getMonthIncomeBreakdown. Solo type='income' (los reintegros NO son ingreso).
reset role;
with p as (
  select u.id as user_id, '2026-08'::text as month
  from auth.users u
  where u.email = 'julieta.malacalza@gmail.com'
),
x as (
  select p.user_id,
         (p.month || '-01')::date as month_from,
         ((p.month || '-01')::date + interval '1 month' - interval '1 day')::date as month_to,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  from p
)
select coalesce(c.name, '(sin categoría)') as categoria,
       t.currency_code as moneda,
       sum(t.amount) as total,
       count(*) as cant,
       string_agg(t.date::text || ' ' || t.amount || coalesce(' ' || t.description, ''), ' | ' order by t.date) as detalle
from public.transactions t
cross join x
left join public.categories c on c.id = t.category_id
where t.user_id = x.user_id
  and t.type::text = 'income'
  and t.date between x.month_from and x.month_to
  and (t.status is not null or t.date <= x.today)
group by 1, 2
order by t.currency_code, total desc;


-- ───────────────────────────────────────────────────────────────────────────
-- §9  MOVIMIENTOS — bloques "Por confirmar" (no dependen del mes)
-- ───────────────────────────────────────────────────────────────────────────
reset role;
with p as (
  select u.id as user_id from auth.users u where u.email = 'julieta.malacalza@gmail.com'
)
select 'reintegro pendiente' as bloque, t.date as fecha,
       t.estimated_amount as monto, t.currency_code as moneda, a.name as cuenta,
       t.reimbursement_target as destino,
       coalesce(le.description, c.name) as etiqueta, t.id
from public.transactions t
cross join p
left join public.accounts a on a.id = t.account_id
left join public.transactions le on le.id = t.linked_transaction_id
left join public.categories c on c.id = le.category_id
where t.user_id = p.user_id and t.type::text = 'reimbursement'
  and t.received_at is null and t.cancelled_at is null
union all
select 'recurrencia pendiente', ri.scheduled_date, ri.amount, ri.currency_code, a.name,
       r.movement_type, coalesce(ri.description, sc.name, c.name), ri.id
from public.recurrence_instances ri
join public.recurrences r on r.id = ri.recurrence_id
cross join p
left join public.accounts a on a.id = ri.account_id
left join public.categories c on c.id = ri.category_id
left join public.subcategories sc on sc.id = ri.subcategory_id
where ri.user_id = p.user_id and ri.status = 'pending'
order by 1, 2;


-- ───────────────────────────────────────────────────────────────────────────
-- §10 DETECTORES DE INCONSISTENCIAS — toda la historia de la usuaria
-- ───────────────────────────────────────────────────────────────────────────
-- Cada fila es un dato que, por cómo está cargado, NO se va a ver donde
-- esperás. No es un error de la app necesariamente: es dónde mirar primero.
reset role;
with p as (
  select u.id as user_id,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
  from auth.users u where u.email = 'julieta.malacalza@gmail.com'
),
tx as (
  select t.*, a.type::text as account_type, a.user_id as account_owner, a.is_active as account_active
  from public.transactions t
  cross join p
  left join public.accounts a on a.id = t.account_id
  where t.user_id = p.user_id
),
found as (
  select 'fecha futura (no cuenta en el saldo hasta que llegue)' as detector, t.id, t.date, t.type::text as type, t.amount, t.currency_code,
         'date > hoy AR' as detalle
  from tx t, p where t.status is null and t.date > p.today
  union all
  select 'gasto en tarjeta sin status (queda on-ledger y descuenta el saldo)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'account.type = credit pero status es null'
  from tx t where t.account_type = 'credit' and t.status is null and not t.is_parent
  union all
  select 'fila con status de tarjeta en cuenta que no es tarjeta (no cuenta en el saldo)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'status = ' || t.status || ' en cuenta ' || t.account_type
  from tx t where t.status is not null and t.account_type <> 'credit'
  union all
  select 'consumo de tarjeta sin resumen asignado (no entra en Compromisos)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'status = ' || t.status || ', card_period_id null'
  from tx t where t.status is not null and t.card_period_id is null and not t.is_parent
  union all
  select 'cuota hija sin parent', t.id, t.date, t.type::text, t.amount, t.currency_code, 'installment_n con parent_id null'
  from tx t where t.installment_n is not null and t.parent_id is null and not t.is_parent
  union all
  select 'parent de cuotas: Σ hijas ≠ monto del parent', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'Σ hijas = ' || (select sum(ch.amount) from public.transactions ch where ch.parent_id = t.id)
           || ', hijas = ' || (select count(*) from public.transactions ch where ch.parent_id = t.id)
           || ', declaradas = ' || coalesce(t.installments_total::text, '?')
  from tx t where t.is_parent
    and ((select count(*) from public.transactions ch where ch.parent_id = t.id) <> coalesce(t.installments_total, -1)
      or abs(coalesce((select sum(ch.amount) from public.transactions ch where ch.parent_id = t.id), 0) - t.amount) > 0.05)
  union all
  select 'compartido sin split para vos (la app lo saltea)', t.id, t.date, t.type::text, t.amount, t.currency_code, 'is_shared sin fila en shared_expense_split con tu user_id'
  from tx t, p where t.is_shared and not t.is_parent
    and not exists (select 1 from public.shared_expense_split s where s.transaction_id = t.id and s.user_id = p.user_id)
  union all
  select 'compartido: Σ splits ≠ monto', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'Σ splits = ' || (select sum(s.amount_assigned) from public.shared_expense_split s where s.transaction_id = t.id)
  from tx t where t.is_shared and not t.is_parent
    and abs(coalesce((select sum(s.amount_assigned) from public.shared_expense_split s where s.transaction_id = t.id), 0) - t.amount) > 0.05
  union all
  select 'reintegro "en resumen" sin card_period_id', t.id, t.date, t.type::text, t.amount, t.currency_code, 'reimbursement_target = statement'
  from tx t where t.type::text = 'reimbursement' and t.reimbursement_target = 'statement' and t.card_period_id is null
  union all
  select 'reintegro "a cuenta" sin cuenta', t.id, t.date, t.type::text, t.amount, t.currency_code, 'reimbursement_target = account, account_id null'
  from tx t where t.type::text = 'reimbursement' and t.reimbursement_target = 'account' and t.account_id is null
  union all
  select 'reintegro recibido Y cancelado', t.id, t.date, t.type::text, t.amount, t.currency_code, 'received_at y cancelled_at ambos con valor'
  from tx t where t.type::text = 'reimbursement' and t.received_at is not null and t.cancelled_at is not null
  union all
  select 'reintegro sin gasto vinculado (va a "sin categoría" en la dona)', t.id, t.date, t.type::text, t.amount, t.currency_code, 'linked_transaction_id null'
  from tx t where t.type::text = 'reimbursement' and t.linked_transaction_id is null
  union all
  select 'transferencia/cambio sin destino, o transferencia a la misma cuenta', t.id, t.date, t.type::text, t.amount, t.currency_code, 'transfer_destination_account_id'
  from tx t where t.type::text in ('transfer', 'exchange')
    and (t.transfer_destination_account_id is null
         or (t.type::text = 'transfer' and t.transfer_destination_account_id = t.account_id))
  union all
  select 'cambio de moneda sin monto/moneda destino', t.id, t.date, t.type::text, t.amount, t.currency_code, 'destination_amount / destination_currency null'
  from tx t where t.type::text = 'exchange' and (t.destination_amount is null or t.destination_currency is null)
  union all
  select 'transferencia con una pata en cuenta archivada (mueve el Disponible)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'una de las dos cuentas no es propia activa'
  from tx t
  left join public.accounts da on da.id = t.transfer_destination_account_id
  where t.type::text = 'transfer' and t.status is null
    and ((t.account_type in ('cash', 'bank') and t.account_active) <> (da.type::text in ('cash', 'bank') and da.is_active))
  union all
  select 'saldada (settlement) sin dirección', t.id, t.date, t.type::text, t.amount, t.currency_code, 'settlement_direction null → no mueve saldo'
  from tx t where t.type::text = 'settlement' and t.settlement_direction is null
  union all
  select 'movimiento en cuenta de OTRO usuario', t.id, t.date, t.type::text, t.amount, t.currency_code, 'accounts.user_id ≠ transactions.user_id'
  from tx t, p where t.account_owner is not null and t.account_owner <> p.user_id
  union all
  select 'movimiento en moneda sin fila en account_currencies (el Hero no lo suma)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'cuenta ' || t.account_id
  from tx t where t.status is null and t.account_id is not null
    and not exists (select 1 from public.account_currencies ac where ac.account_id = t.account_id and ac.currency_code = t.currency_code)
  union all
  select 'pago de resumen que no es un gasto desde cuenta propia', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'period_payments apunta a type=' || t.type::text || ' en cuenta ' || coalesce(t.account_type, 'null')
  from tx t where exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
    and (t.type::text <> 'expense' or t.account_type not in ('cash', 'bank'))
  union all
  select 'posible duplicado (misma fecha, monto, cuenta, tipo y descripción)', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'también: ' || (select string_agg(o.id::text, ', ') from tx o
                          where o.id <> t.id and o.date = t.date and o.amount = t.amount and o.currency_code = t.currency_code
                            and o.type = t.type and o.account_id is not distinct from t.account_id
                            and o.description is not distinct from t.description and not o.is_parent)
  from tx t where not t.is_parent and t.parent_id is null
    and exists (select 1 from tx o
                 where o.id <> t.id and o.date = t.date and o.amount = t.amount and o.currency_code = t.currency_code
                   and o.type = t.type and o.account_id is not distinct from t.account_id
                   and o.description is not distinct from t.description and not o.is_parent)
  union all
  select 'gasto sin categoría', t.id, t.date, t.type::text, t.amount, t.currency_code, 'va a "Sin categoría" en la dona'
  from tx t where t.type::text = 'expense' and t.category_id is null and not t.is_parent
    and not exists (select 1 from public.period_payments pp where pp.transaction_id = t.id)
),
other as (
  select 'cuenta archivada con saldo (no está en el Disponible)' as detector, null::uuid as id, null::date as date, 'account' as type,
         coalesce(b.net, 0) + ac.initial_balance as amount, ac.currency_code,
         a.name || ' (' || a.type || ')' as detalle
  from public.accounts a
  join public.account_currencies ac on ac.account_id = a.id
  cross join p
  left join lateral (
    select sum(case when t.account_id = a.id then
                 case t.type::text when 'income' then t.amount when 'expense' then -t.amount when 'transfer' then -t.amount
                   when 'exchange' then -t.amount when 'adjustment' then t.amount
                   when 'reimbursement' then case when t.reimbursement_target = 'account' and t.received_at is not null and t.cancelled_at is null then t.amount else 0 end
                   when 'settlement' then case t.settlement_direction when 'out' then -t.amount when 'in' then t.amount else 0 end else 0 end
               else case when t.type::text = 'transfer' then t.amount else 0 end end) as net
    from public.transactions t
    where t.status is null and t.currency_code = ac.currency_code
      and (t.account_id = a.id or (t.type::text = 'transfer' and t.transfer_destination_account_id = a.id))
  ) b on true
  where a.user_id = p.user_id and a.type::text in ('cash', 'bank') and not a.is_active
    and abs(coalesce(b.net, 0) + ac.initial_balance) > 0.005
  union all
  select 'saldo inicial con fecha futura (no cuenta todavía)', null, ac.initial_balance_date, 'account_currency', ac.initial_balance, ac.currency_code, a.name
  from public.accounts a join public.account_currencies ac on ac.account_id = a.id, p
  where a.user_id = p.user_id and ac.initial_balance_date > p.today
  union all
  select 'saldo inicial fechado después de movimientos de esa cuenta (los anteriores no lo ven)', null, ac.initial_balance_date, 'account_currency', ac.initial_balance, ac.currency_code,
         a.name || ' · primer movimiento ' || (select min(t.date) from public.transactions t where t.account_id = a.id and t.currency_code = ac.currency_code and t.status is null)
  from public.accounts a join public.account_currencies ac on ac.account_id = a.id, p
  where a.user_id = p.user_id and ac.initial_balance <> 0
    and ac.initial_balance_date > (select min(t.date) from public.transactions t where t.account_id = a.id and t.currency_code = ac.currency_code and t.status is null)
  union all
  select 'categoría con nombre vacío (la dona la muestra sin etiqueta)', c.id, null, 'category', 0, '',
         'canonical = ' || coalesce(c.canonical_name, 'null') || ' · sistema = ' || (c.user_id is null)::text
  from public.categories c, p
  where (c.user_id = p.user_id or c.user_id is null) and (c.name is null or btrim(c.name) = '')
  union all
  select 'regla activa con más de una instancia pendiente', r.id, null, 'recurrence', r.amount, r.currency_code,
         coalesce(r.description, '') || ' · pendientes = ' || (select count(*) from public.recurrence_instances ri where ri.recurrence_id = r.id and ri.status = 'pending')
  from public.recurrences r, p
  where r.user_id = p.user_id and r.status = 'active'
    and (select count(*) from public.recurrence_instances ri where ri.recurrence_id = r.id and ri.status = 'pending') > 1
  union all
  select 'instancia pendiente que la proyección de Compromisos vuelve a producir (doble conteo en la ventana que la contenga)',
         ri.id, ri.scheduled_date, 'recurrence_instance', ri.amount, ri.currency_code,
         coalesce(ri.description, r.description, '') || ' · cursor de la regla = ' || coalesce(r.last_generated_date::text, 'null')
  from public.recurrence_instances ri join public.recurrences r on r.id = ri.recurrence_id, p
  where ri.user_id = p.user_id and ri.status = 'pending' and r.status = 'active'
    and (r.last_generated_date is null or ri.scheduled_date > r.last_generated_date)
  union all
  select 'regla activa con cursor en el futuro', r.id, r.last_generated_date, 'recurrence', r.amount, r.currency_code, coalesce(r.description, '')
  from public.recurrences r, p
  where r.user_id = p.user_id and r.status = 'active' and r.last_generated_date > p.today
  union all
  select 'resumen de tarjeta sin consumos', cp.id, cp.due_date, 'card_period', 0, '',
         a.name || ' ' || cp.start_date || '→' || cp.end_date
  from public.card_periods cp join public.accounts a on a.id = cp.account_id, p
  where a.user_id = p.user_id
    and not exists (select 1 from public.transactions t where t.card_period_id = cp.id)
  union all
  select 'resumen pagado con consumos todavía "pending"', cp.id, cp.due_date, 'card_period',
         (select sum(t.amount) from public.transactions t where t.card_period_id = cp.id and t.status = 'pending'), '',
         a.name || ' ' || cp.start_date || '→' || cp.end_date
  from public.card_periods cp join public.accounts a on a.id = cp.account_id, p
  where a.user_id = p.user_id
    and exists (select 1 from public.period_payments pp where pp.period_id = cp.id)
    and exists (select 1 from public.transactions t where t.card_period_id = cp.id and t.status = 'pending')
  union all
  select 'resumen sin pagar con consumos "paid"', cp.id, cp.due_date, 'card_period',
         (select sum(t.amount) from public.transactions t where t.card_period_id = cp.id and t.status = 'paid'), '',
         a.name || ' ' || cp.start_date || '→' || cp.end_date
  from public.card_periods cp join public.accounts a on a.id = cp.account_id, p
  where a.user_id = p.user_id
    and not exists (select 1 from public.period_payments pp where pp.period_id = cp.id)
    and exists (select 1 from public.transactions t where t.card_period_id = cp.id and t.status = 'paid')
  union all
  select 'consumo fechado fuera del período de su resumen', t.id, t.date, t.type::text, t.amount, t.currency_code,
         'resumen ' || cp.start_date || '→' || cp.end_date
  from public.transactions t join public.card_periods cp on cp.id = t.card_period_id, p
  where t.user_id = p.user_id and not t.is_parent and t.type::text = 'expense'
    and (t.date < cp.start_date or t.date > cp.end_date)
)
select detector, count(*) over (partition by detector) as cant, date as fecha, type as tipo, amount as monto, currency_code as moneda, detalle, id
from (select * from found union all select * from other) all_rows
order by detector, date nulls last;


-- ───────────────────────────────────────────────────────────────────────────
-- §11a NORMATIVO — get_available_sums al corte del mes (lo que ve el Hero)
-- ───────────────────────────────────────────────────────────────────────────
-- accounts_net tiene que ser igual a "Cuentas propias" de §1; available igual
-- a DISPONIBLE (en el mes corriente).
reset role;
select set_config('request.jwt.claims',
  (select json_build_object('sub', u.id, 'role', 'authenticated')::text
     from auth.users u where u.email = 'julieta.malacalza@gmail.com'), false);
set role authenticated;
select *
from public.get_available_sums(
  least((('2026-08' || '-01')::date + interval '1 month' - interval '1 day')::date,
        (now() at time zone 'America/Argentina/Buenos_Aires')::date)
);


-- ───────────────────────────────────────────────────────────────────────────
-- §11b NORMATIVO — get_account_balance_sums por cuenta al corte del mes
-- ───────────────────────────────────────────────────────────────────────────
-- Es el "neto_movimientos" de §2 para las cuentas propias, calculado por la
-- función de la base. Si un renglón difiere de §2, hay bug.
reset role;
select set_config('request.jwt.claims',
  (select json_build_object('sub', u.id, 'role', 'authenticated')::text
     from auth.users u where u.email = 'julieta.malacalza@gmail.com'), false);
set role authenticated;
select a.name as cuenta, b.currency_code as moneda, b.net as neto_movimientos,
       ac.initial_balance as inicial, ac.initial_balance_date as fecha_inicial
from public.get_account_balance_sums(null,
       least((('2026-08' || '-01')::date + interval '1 month' - interval '1 day')::date,
             (now() at time zone 'America/Argentina/Buenos_Aires')::date)) b
join public.accounts a on a.id = b.account_id
left join public.account_currencies ac on ac.account_id = a.id and ac.currency_code = b.currency_code
order by a.name, b.currency_code;


-- ───────────────────────────────────────────────────────────────────────────
-- §12 Meses con actividad — para saber qué meses vale la pena auditar
-- ───────────────────────────────────────────────────────────────────────────
reset role;
with p as (
  select u.id as user_id from auth.users u where u.email = 'julieta.malacalza@gmail.com'
)
select to_char(t.date, 'YYYY-MM') as mes,
       count(*) as movimientos,
       count(*) filter (where t.status is null) as on_ledger,
       count(*) filter (where t.status is not null) as en_tarjeta,
       count(*) filter (where t.is_parent) as compras_en_cuotas,
       count(*) filter (where t.is_shared) as compartidos,
       sum(t.amount) filter (where t.type::text = 'income' and t.currency_code = 'ARS') as ingresos_ars,
       sum(t.amount) filter (where t.type::text = 'expense' and not t.is_parent and t.currency_code = 'ARS') as gastos_ars,
       min(t.created_at)::date as primera_carga, max(t.created_at)::date as ultima_carga
from public.transactions t, p
where t.user_id = p.user_id
group by 1
order by 1 desc;
