-- ═══════════════════════════════════════════════════════════════════════════
-- 0060 — get_available_sums: el saldo inicial faltaba en accounts_net
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BUG QUE ARREGLA
--
-- La 0057 compuso `accounts_net` así:
--
--     select sum(b.net) from get_account_balance_sums(null, cut) b group by ...
--
-- y `get_account_balance_sums` devuelve el NETO DE MOVIMIENTOS por cuenta y
-- moneda — no el saldo final. El saldo de una cuenta en Grana es
-- `initial_balance + neto de movimientos`, y el sumando del saldo inicial
-- **nunca entró**. La palabra `initial_balance` no aparecía en la 0057.
--
-- Consecuencia: `accounts_net` y `available` venían bajos por exactamente la
-- suma de los saldos iniciales declarados. Y como la card del dashboard deriva
-- «Tenías» del disponible, TODOS los términos se corrían juntos — la card
-- seguía cerrando, alrededor de un número equivocado.
--
-- Cuatro consumidores estaban afectados: el Hero, el tope del drawer de guardar
-- (dejaba guardar menos de lo que había), la validación del write path, y el
-- puente «Tu banco muestra» del módulo de ahorro.
--
-- POR QUÉ EL FIX VA ACÁ Y NO EN get_account_balance_sums
--
-- Esa función tiene un significado propio y correcto —el neto de movimientos—
-- y otros consumidores la componen con el inicial por su cuenta (el Hero lo
-- hace en `aggregateHero`). Cambiarle el significado arreglaría este call site
-- y rompería los otros. La que estaba mal es esta, que usaba ese neto como si
-- fuera el saldo completo.
--
-- PARIDAD CON EL HERO — la regla se copia, no se mejora
--
-- El Hero suma el inicial de CADA fila de `account_currencies` de una cuenta
-- propia cuya `initial_balance_date` no sea posterior al corte. En particular
-- **no filtra por `account_currencies.is_active`** — ni siquiera selecciona la
-- columna. Esta función espeja esa regla al pie de la letra, incluida esa
-- omisión: si algún día hay que filtrar por moneda desactivada, tiene que
-- cambiar en los dos lados **a la vez**. Un lado solo es cómo nació este bug.
--
-- FILAS VACÍAS — decisión explícita
--
-- Sumar `account_currencies` sin cuidado haría aparecer ARS y USD en cero para
-- todo el mundo: la app provisiona las dos monedas a todos («bimoneda por
-- defecto»). Eso cambiaría el contrato para usuarios cuyo número estaba bien.
-- Por eso el aporte del inicial entra al universo de monedas **solo cuando no
-- es cero** (`having sum(...) <> 0`). El comportamiento de hoy se conserva salvo
-- donde el número estaba mal:
--
--   · usuario sin dólares (inicial 0, sin movimientos, sin reservas) → sigue sin
--     fila de USD, como hoy;
--   · usuario con inicial en USD y ningún movimiento → AHORA aparece con su
--     saldo. Antes no tenía fila y la app lo leía como cero: ese era el bug.
--
-- Aditiva: reemplaza una función, no toca tablas, no migra datos.

begin;

create or replace function public.get_available_sums(
  p_today date default null
)
returns table (
  currency_code text,
  accounts_net  numeric,
  reserved      numeric,
  available     numeric
)
language sql
stable
security invoker
set search_path = public
as $$
with cut as (
  select coalesce(
    p_today,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) as d
),
-- El neto de MOVIMIENTOS, cortado a la fecha. Definición normativa 0051/0052:
-- no se recompone acá, se compone con el sumando que le falta.
movements as (
  select b.currency_code as code, sum(b.net)::numeric as net
  from public.get_account_balance_sums(null, (select d from cut)) b
  group by b.currency_code
),
-- El SALDO INICIAL declarado de las cuentas propias. Es el otro sumando del
-- saldo de una cuenta, y es el que faltaba.
--
-- `initial_balance_date` respeta el mismo corte que todo lo demás: la plata que
-- el usuario dice haber tenido el día que creó la cuenta no es plata que tenía
-- un mes antes. La rama `is null` es defensiva —hoy la columna es NOT NULL— y
-- existe para espejar la regla del Hero, que trata la ausencia como «siempre
-- cuenta».
--
-- El `having` es la decisión de filas vacías documentada arriba.
initials as (
  select ac.currency_code as code, sum(ac.initial_balance)::numeric as net
  from public.account_currencies ac
  where ac.account_id in (select public.get_owned_account_ids())
    and ac.currency_code in ('ARS', 'USD')
    and (ac.initial_balance_date is null
         or ac.initial_balance_date <= (select d from cut))
  group by ac.currency_code
  having sum(ac.initial_balance) <> 0
),
reserves as (
  select r.currency_code as code, sum(r.amount)::numeric as reserved
  from public.availability_reserve r
  where r.date <= (select d from cut)
    and r.currency_code in ('ARS', 'USD')
  group by r.currency_code
),
codes as (
  select m.code from movements m
  union
  select i.code from initials i
  union
  select r.code from reserves r
)
-- Los ceros se escriben `0.00` y no `0`: los montos de plata son numeric(18,2) y
-- una columna que a veces vuelve con escala y a veces sin ella es una fuente de
-- comparaciones sorpresa aguas abajo.
select
  c.code                                                          as currency_code,
  (coalesce(m.net, 0.00) + coalesce(i.net, 0.00))::numeric        as accounts_net,
  coalesce(r.reserved, 0.00)::numeric                             as reserved,
  (coalesce(m.net, 0.00) + coalesce(i.net, 0.00)
     - coalesce(r.reserved, 0.00))::numeric                       as available
from codes c
left join movements m on m.code = c.code
left join initials  i on i.code = c.code
left join reserves  r on r.code = c.code
$$;

comment on function public.get_available_sums(date) is
  'Definición normativa del disponible real, por moneda: (saldo inicial vigente + neto de movimientos) de las cuentas propias, menos lo reservado, cortado a hoy (timezone financiero AR, o p_today). Devuelve la resta YA HECHA. accounts_net debe coincidir con el total de cuentas del Hero para la misma fecha: el Hero suma el mismo inicial con la misma regla de initial_balance_date, y si los dos dejan de coincidir hay un bug (0060).';

revoke execute on function public.get_available_sums(date) from public;
grant  execute on function public.get_available_sums(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-checks
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La 0057 ya verificaba que la función DERIVE de `get_account_balance_sums` —la
-- lección de la 0051 sobre no replicar predicados— y pasó en verde mientras el
-- número estaba mal: comprobaba la composición y no la aritmética. Acá se agrega
-- el sumando que faltaba como condición explícita.
--
-- La paridad numérica contra el Hero no se puede afirmar desde una migración sin
-- datos: vive en `apps/web/lib/savings/__tests__/available-sums-migration.test.ts`,
-- que corre esta misma SQL sobre PGlite y la compara contra `aggregateHero`.

do $$
declare
  v_secdef boolean;
  v_src    text;
begin
  select p.prosecdef, p.prosrc into v_secdef, v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_available_sums';

  if v_secdef is null then
    raise exception 'SELF-CHECK FAILED: get_available_sums missing';
  end if;

  if v_secdef is distinct from false then
    raise exception 'SELF-CHECK FAILED: get_available_sums must be SECURITY INVOKER';
  end if;

  -- Sigue derivando del universo y del neto normativos (0051/0052).
  if v_src not like '%get_account_balance_sums%' then
    raise exception 'SELF-CHECK FAILED: get_available_sums does not derive from get_account_balance_sums';
  end if;

  if v_src not like '%get_owned_account_ids%' then
    raise exception 'SELF-CHECK FAILED: get_available_sums does not derive the owned-account universe';
  end if;

  -- El sumando que faltaba, y el que este fix existe para garantizar.
  if v_src not like '%account_currencies%' or v_src not like '%initial_balance%' then
    raise exception 'SELF-CHECK FAILED: get_available_sums must add initial_balance from account_currencies';
  end if;

  -- Y el corte del inicial, que es lo que lo mantiene consistente con el Hero.
  if v_src not like '%initial_balance_date%' then
    raise exception 'SELF-CHECK FAILED: get_available_sums must respect initial_balance_date';
  end if;
end $$;

commit;
