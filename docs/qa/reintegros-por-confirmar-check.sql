-- =============================================================================
-- Diagnóstico · Bug #95 — "Reintegros por confirmar" lista reintegros ajenos
--
-- Pegá cada bloque en el SQL Editor de Supabase (corre como service_role, así que
-- NO aplica RLS: por eso cada consulta replica a mano el predicado de RLS que sí
-- aplica en la app). Reemplazá los emails de §0 si querés mirar otro par.
--
-- Qué estamos probando: la LECTURA que alimenta el bloque
-- (`getPendingReimbursements`, packages/transactions/src/queries.ts) NO filtra por
-- dueño y se apoya solo en RLS; y la política SELECT de `transactions` (migración
-- 0023) fue ampliada a las filas compartidas del hogar:
--
--   using (user_id = auth.uid()
--          OR (is_shared AND household_id IS NOT NULL AND is_household_member(household_id)))
--
-- La ESCRITURA (`confirmReimbursement` / `cancelReimbursement`,
-- packages/transactions-mutations/src/thin-mutations.ts) sí filtra
-- `.eq('user_id', userId)` y por eso devuelve "Reintegro no encontrado.".
-- Los bloques de abajo muestran esa asimetría con datos reales.
-- =============================================================================

-- ── §0 · Los dos usuarios y su hogar ─────────────────────────────────────────
-- Guardá los ids que devuelve: el "afectado" (quien ve el bloque roto) y el
-- "autor" (quien cargó el gasto compartido).
select p.id as user_id, p.email, p.full_name,
       hm.household_id, h.name as hogar, h.is_active
  from public.profiles p
  left join public.household_member hm on hm.user_id = p.id
  left join public.household h         on h.id = hm.household_id
 where p.email in ('cristian.ap84@gmail.com', 'julieta.malacalza@gmail.com')
 order by p.email;

-- ── §1 · Lo que HOY devuelve la lectura del bloque, para el usuario afectado ──
-- Réplica exacta de `getPendingReimbursements(supabase)`: type='reimbursement',
-- received_at IS NULL, cancelled_at IS NULL, sin filtro de dueño, con el predicado
-- de RLS del usuario logueado aplicado a mano.
-- La columna `pertenencia` es el diagnóstico: 'propio' vs 'ajeno (del hogar)'.
with yo as (
  select id from public.profiles where email = 'cristian.ap84@gmail.com'
),
mis_hogares as (
  select hm.household_id from public.household_member hm, yo where hm.user_id = yo.id
)
select t.id as reintegro_id,
       case when t.user_id = (select id from yo) then 'propio'
            else 'ajeno (del hogar)' end                    as pertenencia,
       dueno.email                                          as dueno,
       t.reimbursement_target                               as destino,
       t.estimated_amount, t.currency_code, t.date,
       t.is_shared, t.household_id,
       a.name                                               as cuenta,
       a_dueno.email                                        as dueno_de_la_cuenta,
       t.linked_transaction_id                              as gasto_origen_id,
       gasto.description                                    as gasto_origen
  from public.transactions t
  join public.profiles dueno   on dueno.id = t.user_id
  left join public.accounts a  on a.id = t.account_id
  left join public.profiles a_dueno on a_dueno.id = a.user_id
  left join public.transactions gasto on gasto.id = t.linked_transaction_id
 where t.type = 'reimbursement'
   and t.received_at  is null
   and t.cancelled_at is null
   -- ← predicado de RLS (0023), el mismo que deja pasar la fila ajena:
   and ( t.user_id = (select id from yo)
         or (t.is_shared and t.household_id in (select household_id from mis_hogares)) )
 order by pertenencia desc, t.date;

-- ── §2 · Solo las filas que rompen (las ajenas visibles) ─────────────────────
-- Estas son las que el bloque muestra con "Confirmar" / "Cancelar" habilitados y
-- que la mutación rechaza. Si devuelve 0 filas, el bug no está reproducido con
-- estos datos.
with yo as (
  select id from public.profiles where email = 'cristian.ap84@gmail.com'
),
mis_hogares as (
  select hm.household_id from public.household_member hm, yo where hm.user_id = yo.id
)
select t.id as reintegro_id, dueno.email as dueno, t.estimated_amount, t.currency_code,
       t.date, t.reimbursement_target as destino, t.household_id
  from public.transactions t
  join public.profiles dueno on dueno.id = t.user_id
 where t.type = 'reimbursement'
   and t.received_at  is null
   and t.cancelled_at is null
   and t.user_id <> (select id from yo)
   and t.is_shared
   and t.household_id in (select household_id from mis_hogares)
 order by t.date;

-- ── §3 · El gasto de origen de esas filas (¿vino de Compartido?) ─────────────
-- Confirma la hipótesis del ticket: el reintegro ajeno nace de un gasto compartido
-- cargado por la otra persona, y hereda is_shared + household_id
-- (packages/transactions-mutations/src/internal/shared-splits.ts).
with yo as (
  select id from public.profiles where email = 'cristian.ap84@gmail.com'
),
mis_hogares as (
  select hm.household_id from public.household_member hm, yo where hm.user_id = yo.id
),
ajenos as (
  select t.* from public.transactions t
   where t.type = 'reimbursement' and t.received_at is null and t.cancelled_at is null
     and t.user_id <> (select id from yo)
     and t.is_shared and t.household_id in (select household_id from mis_hogares)
)
select r.id                    as reintegro_id,
       r.estimated_amount      as reintegro_estimado,
       g.id                    as gasto_id,
       g.description           as gasto,
       g.amount                as gasto_total,
       g.date                  as gasto_fecha,
       g.is_shared             as gasto_compartido,
       autor.email             as gasto_cargado_por,
       c.name                  as categoria,
       s.user_id               as split_user_id,
       sp.email                as split_de,
       s.percentage, s.amount_assigned
  from ajenos r
  left join public.transactions g on g.id = r.linked_transaction_id
  left join public.profiles autor on autor.id = g.user_id
  left join public.categories c   on c.id = g.category_id
  left join public.shared_expense_split s on s.transaction_id = g.id
  left join public.profiles sp    on sp.id = s.user_id
 order by r.id, sp.email;

-- ── §4 · Lo que ve la MUTACIÓN para esas mismas filas ────────────────────────
-- `confirmReimbursement` / `cancelReimbursement` hacen
--   select ... .eq('id', id).eq('user_id', userId).single()
-- Este bloque devuelve 0 filas para cada reintegro ajeno ⇒ "Reintegro no encontrado.".
-- Pegá acá el/los ids que devolvió §2.
select t.id, t.type, t.received_at, t.cancelled_at
  from public.transactions t
 where t.id = '00000000-0000-0000-0000-000000000000'   -- ← id del §2
   and t.user_id = (select id from public.profiles where email = 'cristian.ap84@gmail.com');

-- ── §5 · Ruta Cuentas · ¿el mismo desajuste? ─────────────────────────────────
-- El bloque de la ruta de cuentas usa la misma lectura con `accountId`. Un
-- reintegro ajeno solo aparecería si su `account_id` fuese una cuenta que el
-- usuario abre; este bloque lista, por cuenta del usuario afectado, los reintegros
-- pendientes que NO son suyos. Esperado: 0 filas (las cuentas son owner-only).
with yo as (
  select id from public.profiles where email = 'cristian.ap84@gmail.com'
)
select a.id as cuenta_id, a.name as cuenta, t.id as reintegro_id,
       dueno.email as dueno_del_reintegro, t.estimated_amount, t.currency_code
  from public.accounts a
  join public.transactions t on t.account_id = a.id
  join public.profiles dueno on dueno.id = t.user_id
 where a.user_id = (select id from yo)
   and t.type = 'reimbursement'
   and t.received_at is null and t.cancelled_at is null
   and t.user_id <> (select id from yo)
 order by a.name;

-- ── §6 · Inventario de control ───────────────────────────────────────────────
-- Cuántos reintegros pendientes tiene cada persona. Sirve de "antes/después":
-- tras el fix, el bloque del usuario afectado debe mostrar exactamente sus
-- `pendientes_propios` (y sus confirmar/cancelar deben seguir funcionando).
select p.email,
       count(*) filter (where t.received_at is null and t.cancelled_at is null) as pendientes_propios,
       count(*) filter (where t.received_at is not null)                        as recibidos,
       count(*) filter (where t.cancelled_at is not null)                       as cancelados,
       count(*) filter (where t.is_shared and t.received_at is null
                          and t.cancelled_at is null)                           as pendientes_compartidos
  from public.transactions t
  join public.profiles p on p.id = t.user_id
 where t.type = 'reimbursement'
 group by p.email
 order by p.email;
