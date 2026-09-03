-- Cards — patas de pago: pagar la deuda en dólares EN dólares, y pagar de a partes.
--
-- Run AFTER 0060_available_sums_initial_balance.sql.
--
-- Hasta acá, pagar un resumen era UN evento: una fila en `period_payments` con
-- `period_id UNIQUE`, un gasto en ARS, y el barrido de todos los consumos a 'paid'.
-- Ese atajo hacía imposibles dos cosas que el banco sí permite: cancelar los consumos
-- en dólares CON dólares, y pagar menos que el total (el pago mínimo).
--
-- El modelo pasa a separar cuatro cosas que estaban fusionadas:
--
--   EL RESUMEN        la deuda original, por moneda (consumos − reintegros recibidos)
--   LA TRANSACCIÓN    de dónde salió la plata y en qué moneda
--   LA IMPUTACIÓN     qué parte de esa plata cancela deuda ARS o deuda USD  ← nuevo
--   EL ESTADO         impago / parcial / saldado, DERIVADO de las tres anteriores
--
-- Una **pata de pago** es una fila de `period_payments` que declara la imputación.
-- Un resumen puede tener varias; una transacción también (un único débito bancario
-- puede cancelar pesos y dólares pesificados a la vez, que es exactamente lo que hace
-- hoy el pago "todo en pesos" de un resumen mixto).
--
-- Sacar `period_id UNIQUE` saca, sin querer, la red que hoy mata un doble pago
-- concurrente: la app valida "no hay pago" y el índice mata al segundo INSERT. Por eso
-- esta migración NO se limita a las columnas — mueve la garantía contable a la base:
--
--   * `card_period_pending()`  la ÚNICA definición SQL del pendiente por moneda.
--   * un trigger BEFORE INSERT por fila  que bloquea el período (`FOR UPDATE`),
--     serializa los inserts concurrentes y rechaza el exceso, el cruce de monedas
--     inválido, la imputación de un mismo gasto a dos resúmenes y la cotización
--     incoherente.
--   * un CONSTRAINT TRIGGER DIFERIDO  para `monto = Σ imputaciones`, que NO puede
--     verificarse fila por fila: con dos patas sobre un mismo gasto, la primera nunca
--     llega al total y rechazarla ahí bloquearía un pago legítimo.
--
-- Compatibilidad: los pagos ya registrados NO se recalculan ni se adivinan. Se marcan
-- con `settlement_known = false` y se leen como lo que eran — pago del saldo total.
--
-- Supabase es online-only: aplicar pegando en el SQL Editor del dashboard, y después
-- regenerar los tipos. Toda la migración corre en una transacción.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · `period_payments` pasa de "un pago" a "una pata de pago"
-- ═══════════════════════════════════════════════════════════════════════════

-- Un resumen puede recibir varias patas. El UNIQUE que lo impedía era, además, la
-- protección anti-doble-pago: se reemplaza por el trigger de la sección 4, que protege
-- lo que de verdad importa (que la suma no exceda la deuda) en vez de "que haya una".
alter table public.period_payments
  drop constraint if exists period_payments_period_id_key;

alter table public.period_payments
  -- Qué patas nacieron de una misma operación del usuario. Deshacer opera por grupo:
  -- una operación puede crear dos patas (los pesos y los dólares del mismo resumen) y
  -- revertir una sola dejaría medio pago que nadie hizo así.
  add column if not exists payment_group_id uuid,
  -- La moneda de la DEUDA que esta pata cancela. Distinta, en general, de la moneda de
  -- la transacción: pagar US$ 500 desde una cuenta en pesos es una transacción ARS con
  -- una pata USD.
  add column if not exists settles_currency text
    references public.currencies(code),
  -- Cuánto de esa deuda cancela, expresado en `settles_currency`.
  add column if not exists settles_amount numeric(18,2),
  -- La cotización, SOLO en el único cruce permitido (transacción ARS → deuda USD).
  add column if not exists fx_rate_to_ars numeric(18,6),
  -- Falso en las filas anteriores a esta migración: esas patas no saben qué imputaron,
  -- y se leen como pago del saldo total. Mismo patrón que `stamp_tax_link_known` (0050),
  -- por el mismo motivo: marcar lo que no se sabe es barato, adivinarlo corrompe.
  add column if not exists settlement_known boolean not null default true;

-- Backfill, una sola vez. Los montos NO se reconstruyen: en un pago viejo de un resumen
-- mixto, cuánto de esa expensa en pesos canceló dólares depende de una cotización que se
-- guardaba solo a veces. `payment_group_id = id` sí es determinístico y verdadero: cada
-- pago legacy era su propio grupo, de una sola pata.
DO $backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM public.period_payments WHERE payment_group_id IS NULL) THEN
    UPDATE public.period_payments
       SET payment_group_id = id,
           settlement_known = false
     WHERE payment_group_id IS NULL;
  END IF;
END $backfill$;

alter table public.period_payments
  alter column payment_group_id set not null,
  alter column payment_group_id set default gen_random_uuid();

-- CHECK local: solo lo que se ve DESDE LA FILA. El cruce de monedas necesita
-- `transactions.currency_code`, que vive en otra tabla, y un CHECK no cruza tablas —
-- eso va en el trigger de la sección 4.
alter table public.period_payments
  drop constraint if exists chk_period_payment_settlement,
  add constraint chk_period_payment_settlement check (
    (settlement_known and settles_currency is not null and settles_amount is not null and settles_amount > 0)
    or
    (not settlement_known and settles_currency is null and settles_amount is null and fx_rate_to_ars is null)
  ),
  drop constraint if exists chk_period_payment_fx_positive,
  add constraint chk_period_payment_fx_positive check (
    fx_rate_to_ars is null or fx_rate_to_ars > 0
  ),
  drop constraint if exists chk_period_payment_settles_currency,
  add constraint chk_period_payment_settles_currency check (
    settles_currency is null or settles_currency in ('ARS', 'USD')
  );

create index if not exists idx_period_payments_period_group
  on public.period_payments (period_id, payment_group_id);

-- Orden determinístico para "el grupo más reciente": dos patas de una misma operación
-- comparten `created_at`, así que sin el desempate por `id` el más reciente no existe.
create index if not exists idx_period_payments_period_created
  on public.period_payments (period_id, created_at, id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · El pago mínimo es un dato DEL RESUMEN
-- ═══════════════════════════════════════════════════════════════════════════

-- El banco lo imprime en el extracto y sobrevive al pago: alimenta el atajo del
-- formulario y el aviso de "estás pagando menos que el mínimo". Nullable sin default:
-- la mayoría de los resúmenes se paga entero y nunca se carga, y un cero NO es lo mismo
-- que "no lo cargué".
alter table public.card_periods
  add column if not exists minimum_payment_ars numeric(18,2),
  add column if not exists minimum_payment_usd numeric(18,2);

alter table public.card_periods
  drop constraint if exists chk_card_period_minimums,
  add constraint chk_card_period_minimums check (
    (minimum_payment_ars is null or minimum_payment_ars >= 0)
    and (minimum_payment_usd is null or minimum_payment_usd >= 0)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · `card_period_pending` — la única definición del pendiente
-- ═══════════════════════════════════════════════════════════════════════════

-- Espejo exacto de `computePeriodAmounts` (@grana/money-logic), en SQL, para que el
-- trigger y los RPC no reimplementen la regla contable con otras palabras.
--
-- El total NO se lee del estado de los consumos, se lee de los consumos: se suman los
-- `pending` Y los `paid`. Es lo que hace que la fórmula valga igual antes y después del
-- barrido — mirando solo los `pending`, un resumen saldado daría pendiente NEGATIVO
-- (cero consumos menos las patas).
--
-- Las madres de cuotas no aparecen: son off-ledger y no llevan `card_period_id`; el
-- período solo alcanza a las hijas.
create or replace function public.card_period_pending(p_period_id uuid)
returns table (
  currency_code text,
  total   numeric(18,2),
  paid    numeric(18,2),
  pending numeric(18,2)
)
language sql
stable
security invoker
set search_path = public
as $pending$
  with currencies(code) as (
    values ('ARS'), ('USD')
  ),
  -- Una pata legacy no sabe qué imputó: satura el resumen y se lee como saldo total.
  legacy as (
    select exists (
      select 1 from public.period_payments pp
       where pp.period_id = p_period_id and pp.settlement_known = false
    ) as saturates
  ),
  consumos as (
    select c.code,
           coalesce(sum(
             case when t.type::text <> 'reimbursement' then abs(t.amount) else 0 end
           ), 0)::numeric(18,2) as charged,
           -- Solo el reintegro RECIBIDO y no cancelado descuenta: uno pendiente es una
           -- expectativa y vive fuera del resumen.
           coalesce(sum(
             case when t.type::text = 'reimbursement'
                   and t.received_at is not null
                   and t.cancelled_at is null
                  then abs(t.amount) else 0 end
           ), 0)::numeric(18,2) as reimbursed
      from currencies c
      left join public.transactions t
        on t.card_period_id = p_period_id
       and t.currency_code = c.code
     group by c.code
  ),
  settled as (
    select c.code,
           coalesce(sum(pp.settles_amount), 0)::numeric(18,2) as paid
      from currencies c
      left join public.period_payments pp
        on pp.period_id = p_period_id
       and pp.settles_currency = c.code
       and pp.settlement_known
     group by c.code
  )
  select
    co.code,
    (co.charged - co.reimbursed)::numeric(18,2) as total,
    case when l.saturates then (co.charged - co.reimbursed) else se.paid end::numeric(18,2) as paid,
    case when l.saturates then 0::numeric(18,2)
         else (co.charged - co.reimbursed - se.paid)::numeric(18,2) end as pending
  from consumos co
  join settled se on se.code = co.code
  cross join legacy l
  order by co.code;
$pending$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Los invariantes de una pata, en la base
-- ═══════════════════════════════════════════════════════════════════════════

-- BEFORE INSERT, por fila. Todo lo que se puede decidir mirando la fila que entra más
-- el estado ya escrito. El `FOR UPDATE` sobre el período es lo que serializa dos pagos
-- concurrentes: sin él, los dos leen el mismo pendiente, los dos validan, y el resumen
-- queda pagado de más sin que nada lo note.
create or replace function public.trg_fn_period_payment_row_invariants()
returns trigger
language plpgsql
security invoker
set search_path = public
as $row_inv$
declare
  v_tx_currency text;
  v_tx_fx       numeric(18,6);
  v_pending     numeric(18,2);
  v_other       record;
begin
  -- Una pata legacy (backfill) no declara imputación: nada que validar.
  if not NEW.settlement_known then
    return NEW;
  end if;

  -- Serializa contra cualquier otro INSERT sobre el mismo resumen.
  perform 1 from public.card_periods where id = NEW.period_id for update;

  select t.currency_code, t.fx_rate_to_ars
    into v_tx_currency, v_tx_fx
    from public.transactions t
   where t.id = NEW.transaction_id;

  if v_tx_currency is null then
    raise exception 'I-PAY-1: payment leg references a missing transaction';
  end if;

  -- ── Cruce de monedas: lista cerrada, no regla general ──────────────────────
  -- ARS→ARS y USD→USD sin cotización; ARS→USD con cotización. USD→deuda ARS se
  -- rechaza: eso es un canje de moneda, y para eso existe el movimiento `exchange`.
  if v_tx_currency = NEW.settles_currency then
    if NEW.fx_rate_to_ars is not null then
      raise exception
        'I-PAY-2: a leg settling % from a % transaction must not carry fx_rate_to_ars',
        NEW.settles_currency, v_tx_currency;
    end if;
  elsif v_tx_currency = 'ARS' and NEW.settles_currency = 'USD' then
    if NEW.fx_rate_to_ars is null then
      raise exception 'I-PAY-2: settling USD debt with an ARS transaction requires fx_rate_to_ars';
    end if;
    -- La cotización de la pata y la de su transacción son el mismo hecho.
    if v_tx_fx is distinct from NEW.fx_rate_to_ars then
      raise exception
        'I-PAY-3: leg fx_rate_to_ars (%) does not match its transaction fx_rate_to_ars (%)',
        NEW.fx_rate_to_ars, v_tx_fx;
    end if;
  else
    raise exception
      'I-PAY-2: a % transaction cannot settle % debt of a statement',
      v_tx_currency, NEW.settles_currency;
  end if;

  -- ── Pertenencia: un gasto, un resumen, un grupo ────────────────────────────
  -- La contracara de haber soltado UNIQUE(transaction_id): sin esto un mismo débito
  -- podría quedar imputado a dos resúmenes distintos.
  select pp.period_id, pp.payment_group_id, pp.fx_rate_to_ars, pp.settles_currency
    into v_other
    from public.period_payments pp
   where pp.transaction_id = NEW.transaction_id
     and pp.settlement_known
   limit 1;

  if found then
    if v_other.period_id is distinct from NEW.period_id then
      raise exception 'I-PAY-4: a payment transaction cannot be imputed to two statements';
    end if;
    if v_other.payment_group_id is distinct from NEW.payment_group_id then
      raise exception 'I-PAY-4: legs sharing a transaction must share their payment group';
    end if;
    -- Un débito ocurre un día y a un tipo de cambio: dos cotizaciones distintas dentro
    -- del mismo gasto no describen nada real.
    if NEW.settles_currency = 'USD' and v_other.settles_currency = 'USD'
       and v_other.fx_rate_to_ars is distinct from NEW.fx_rate_to_ars then
      raise exception 'I-PAY-3: legs of the same transaction must share one fx rate';
    end if;
  end if;

  -- ── El piso: ninguna pata cancela más de lo que el resumen debe ────────────
  select p.pending into v_pending
    from public.card_period_pending(NEW.period_id) p
   where p.currency_code = NEW.settles_currency;

  if NEW.settles_amount > coalesce(v_pending, 0) then
    raise exception
      'I-PAY-5: leg settles % % but only % is pending in that currency',
      NEW.settles_amount, NEW.settles_currency, coalesce(v_pending, 0)
      using errcode = 'GRN03', detail = coalesce(v_pending, 0)::text;
  end if;

  return NEW;
end;
$row_inv$;

drop trigger if exists trg_period_payment_row_invariants on public.period_payments;
create trigger trg_period_payment_row_invariants
  before insert on public.period_payments
  for each row execute function public.trg_fn_period_payment_row_invariants();

-- CONSTRAINT TRIGGER DIFERIDO: `monto de la transacción = Σ de sus imputaciones`.
--
-- Diferido a propósito. Fila por fila esta identidad es FALSA en un pago legítimo: al
-- insertar la primera de dos patas de un mismo gasto, la suma todavía no llega al total.
-- Al COMMIT la ve completa.
--
-- El redondeo NO es decorativo: `fx_rate_to_ars` es numeric(18,6) y el producto tiene
-- que aterrizar en los numeric(18,2) del monto. `round(x, 2)` de Postgres redondea medio
-- hacia afuera del cero y `Money.multiply` (TS) usa toDecimalPlaces(2) sobre decimal.js
-- sin configuración global, o sea ROUND_HALF_UP: para montos positivos, que es todo lo
-- que hay acá, son la misma función y dan el mismo centavo.
create or replace function public.trg_fn_period_payment_amount_matches()
returns trigger
language plpgsql
security invoker
set search_path = public
as $amount_inv$
declare
  v_tx_id     uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
  v_tx_amount numeric(18,2);
  v_sum       numeric(18,2);
begin
  select t.amount into v_tx_amount from public.transactions t where t.id = v_tx_id;
  -- La transacción se borró en esta misma operación (una reversión): nada que atar.
  if not found then
    return null;
  end if;

  select coalesce(sum(
           case when pp.settles_currency = 'USD' and pp.fx_rate_to_ars is not null
                then round(pp.settles_amount * pp.fx_rate_to_ars, 2)
                else pp.settles_amount
           end
         ), 0)
    into v_sum
    from public.period_payments pp
   where pp.transaction_id = v_tx_id
     and pp.settlement_known;

  -- Sin patas conocidas (todas legacy, o la última se revirtió): nada que verificar.
  if v_sum = 0 and not exists (
    select 1 from public.period_payments pp
     where pp.transaction_id = v_tx_id and pp.settlement_known
  ) then
    return null;
  end if;

  if v_sum <> v_tx_amount then
    raise exception
      'I-PAY-6: payment transaction amount (%) does not match the sum of its allocations (%)',
      v_tx_amount, v_sum;
  end if;

  return null;
end;
$amount_inv$;

drop trigger if exists trg_period_payment_amount_matches on public.period_payments;
create constraint trigger trg_period_payment_amount_matches
  after insert or update or delete on public.period_payments
  deferrable initially deferred
  for each row execute function public.trg_fn_period_payment_amount_matches();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · `pay_card_period_legs` — el dinero, en UNA transacción
-- ═══════════════════════════════════════════════════════════════════════════

-- Reemplaza la cadena de rollbacks manuales de `payCardPeriod`: con varias patas por
-- operación, cada camino de error tendría que acordarse de deshacer a mano todo lo
-- insertado antes, y un fallo intermedio dejaría un resumen que nadie puede reconstruir.
--
-- El input viene ANIDADO: `payments[] → allocations[]`. Un pago es un débito de una
-- cuenta; sus allocations son lo que ese débito cancela. Una lista plana de patas no
-- podría decir cuándo dos imputaciones son un mismo débito bancario y cuándo son dos, y
-- ese agrupamiento es un dato que el usuario declara al elegir de qué cuenta sale cada
-- cosa — no algo que el backend deba deducir comparando montos.
--
-- El CALENDARIO no entra acá (ver `confirm_running_cycle`): las fechas del ciclo en
-- curso son hechos leídos del resumen de papel y valen aunque el pago falle.
--
-- SECURITY DEFINER: `period_payments` no tiene policies de escritura (sección 7), así
-- que esta función tiene que poder algo que el usuario directo no. La propiedad se
-- verifica explícitamente acá adentro, nunca se delega en RLS.
create or replace function public.pay_card_period_legs(
  p_period_id        uuid,
  p_payments         jsonb,
  p_today            date,
  p_stamp_tax_amount numeric(18,2) default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pay$
declare
  v_uid          uuid := auth.uid();
  v_period       record;
  v_owner        uuid;
  v_card_name    text;
  v_group        uuid := gen_random_uuid();
  v_has_legs     boolean;
  v_stamp_base   numeric(18,2);
  v_stamp_tx     uuid;
  v_cat          uuid;
  v_subcat       uuid;
  v_payment      jsonb;
  v_alloc        jsonb;
  v_tx           uuid;
  v_tx_currency  text;
  v_tx_amount    numeric(18,2);
  v_tx_fx        numeric(18,6);
  v_account_id   uuid;
  v_date         date;
  v_tx_ids       uuid[] := '{}';
  v_pending_ars  numeric(18,2);
  v_pending_usd  numeric(18,2);
  v_settled      boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select cp.id, cp.account_id, cp.start_date, cp.end_date, cp.due_date
    into v_period
    from public.card_periods cp
   where cp.id = p_period_id;
  if not found then
    raise exception 'period_not_found';
  end if;

  select a.user_id, a.name into v_owner, v_card_name
    from public.accounts a where a.id = v_period.account_id;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  -- Un resumen abierto todavía acumula consumos: pagarlo no significa nada. `p_today`
  -- viene de la app porque la fecha del usuario es AR, no la del servidor.
  if p_today <= v_period.end_date then
    raise exception 'period_not_closed';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'no_payments';
  end if;

  select exists (
    select 1 from public.period_payments pp where pp.period_id = p_period_id
  ) into v_has_legs;

  -- ── El sello va PRIMERO, y solo en el primer pago ──────────────────────────
  -- Es un cargo del resumen: sube la deuda en pesos. Si se insertara después de las
  -- patas, una pata que paga el total —sello incluido, que es lo que la UI sugiere—
  -- sería rechazada por exceder un pendiente calculado sin el sello.
  if coalesce(p_stamp_tax_amount, 0) > 0 then
    if v_has_legs then
      raise exception 'stamp_tax_only_on_first_payment';
    end if;

    -- La base de la alícuota se congela ANTES de insertar el sello, para que no se
    -- incluya en su propia base. Es un "antes" distinto del de la cobertura, que se
    -- calcula DESPUÉS: confundirlos da un sello que se cobra a sí mismo.
    select p.pending into v_stamp_base
      from public.card_period_pending(p_period_id) p
     where p.currency_code = 'ARS';

    select id into v_cat from public.categories
     where canonical_name = 'impuestos' and user_id is null limit 1;
    select id into v_subcat from public.subcategories
     where canonical_name = 'impuesto-de-sellos' and user_id is null limit 1;

    insert into public.transactions (
      user_id, account_id, type, amount, currency_code, date,
      category_id, subcategory_id, description, is_parent, status,
      card_period_id, due_date, fx_rate_to_ars
    ) values (
      v_uid, v_period.account_id, 'expense', p_stamp_tax_amount, 'ARS', v_period.end_date,
      v_cat, v_subcat, 'Impuesto de sellos', false, 'pending',
      p_period_id, v_period.due_date, null
    )
    returning id into v_stamp_tx;
  end if;

  -- ── Los pagos: una transacción por débito, sus allocations como patas ──────
  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_account_id := (v_payment ->> 'account_id')::uuid;
    v_date       := (v_payment ->> 'date')::date;

    if not exists (
      select 1 from public.accounts a
       where a.id = v_account_id and a.user_id = v_uid and a.type::text <> 'credit'
    ) then
      raise exception 'payment_account_invalid';
    end if;

    -- La moneda del débito sale de las allocations: una transacción tiene UNA moneda,
    -- y es la de la cuenta de la que sale la plata. Si alguna allocation pesifica, el
    -- débito es en ARS; si no, es en la moneda que cancela.
    select
      case when bool_or((a ->> 'fx_rate_to_ars') is not null) then 'ARS'
           else min(a ->> 'settles_currency') end,
      max((a ->> 'fx_rate_to_ars')::numeric(18,6)),
      sum(
        case when (a ->> 'fx_rate_to_ars') is not null
             then round((a ->> 'settles_amount')::numeric * (a ->> 'fx_rate_to_ars')::numeric, 2)
             else (a ->> 'settles_amount')::numeric
        end
      )
      into v_tx_currency, v_tx_fx, v_tx_amount
      from jsonb_array_elements(v_payment -> 'allocations') a;

    if v_tx_amount is null or v_tx_amount <= 0 then
      raise exception 'payment_without_allocations';
    end if;

    if not exists (
      select 1 from public.account_currencies ac
       where ac.account_id = v_account_id and ac.currency_code = v_tx_currency and ac.is_active
    ) then
      raise exception 'payment_account_currency_inactive';
    end if;

    insert into public.transactions (
      user_id, account_id, type, amount, currency_code, date,
      category_id, description, is_parent, status, card_period_id, fx_rate_to_ars
    ) values (
      v_uid, v_account_id, 'expense', v_tx_amount, v_tx_currency, v_date,
      null, 'Pago de tarjeta ' || v_card_name, false, null, null, v_tx_fx
    )
    returning id into v_tx;

    v_tx_ids := v_tx_ids || v_tx;

    for v_alloc in select value from jsonb_array_elements(v_payment -> 'allocations')
    loop
      -- El trigger de la sección 4 valida cada una: cobertura, cruce de monedas,
      -- pertenencia y cotización coherente. Acá no se re-valida nada.
      insert into public.period_payments (
        period_id, transaction_id, payment_group_id,
        settles_currency, settles_amount, fx_rate_to_ars, stamp_tax_transaction_id
      ) values (
        p_period_id, v_tx, v_group,
        v_alloc ->> 'settles_currency',
        (v_alloc ->> 'settles_amount')::numeric(18,2),
        (v_alloc ->> 'fx_rate_to_ars')::numeric(18,6),
        v_stamp_tx
      );
      -- El sello se ata a UNA sola pata: la primera de la operación.
      v_stamp_tx := null;
    end loop;
  end loop;

  -- ── El barrido, solo si el resumen quedó saldado ───────────────────────────
  select
    max(case when p.currency_code = 'ARS' then p.pending end),
    max(case when p.currency_code = 'USD' then p.pending end)
    into v_pending_ars, v_pending_usd
    from public.card_period_pending(p_period_id) p;

  v_settled := coalesce(v_pending_ars, 0) = 0 and coalesce(v_pending_usd, 0) = 0;

  if v_settled then
    update public.transactions
       set status = 'paid'
     where card_period_id = p_period_id
       and status = 'pending';
  end if;

  return jsonb_build_object(
    'payment_group_id',  v_group,
    'transaction_ids',   to_jsonb(v_tx_ids),
    'settled',           v_settled,
    'pending_ars',       coalesce(v_pending_ars, 0),
    'pending_usd',       coalesce(v_pending_usd, 0),
    -- La app deriva y persiste la alícuota con `deriveStampTaxRate`, que ya existe y
    -- está testeada; acá solo viaja la base contra la que hay que derivarla. Es un
    -- aprendizaje, no un hecho contable: no necesita estar en esta transacción.
    'stamp_tax_base_ars', v_stamp_base
  );
end;
$pay$;

revoke execute on function public.pay_card_period_legs(uuid, jsonb, date, numeric) from public;
grant  execute on function public.pay_card_period_legs(uuid, jsonb, date, numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5b · `confirm_running_cycle` — el calendario, atómico y revalidado
-- ═══════════════════════════════════════════════════════════════════════════

-- El calendario NO va dentro del RPC de dinero, y es deliberado: las fechas del ciclo en
-- curso son hechos leídos del resumen de papel y valen aunque el pago falle. Pero como
-- paso suelto necesitaba un lock, y un `FOR UPDATE` desde TS no existe: cada llamada de
-- PostgREST es su propia transacción y suelta el lock al responder. Por eso es una
-- función SQL corta en vez de una cadena de updates.
--
-- La DECISIÓN sigue en TS (`planRunningCycleConfirmation`), donde está testeada como
-- función pura: acá llega ya resuelta, en `p_plan`. Lo que esta función agrega es que la
-- decisión no se aplique a ciegas — entre la lectura que la generó y esta llamada puede
-- haber cambiado cualquier cosa, así que revalida los ANCLAJES que el plan da por
-- ciertos antes de escribir nada. TS decide, SQL verifica que la decisión sigue siendo
-- aplicable, y escribe.
--
-- Idempotente: si el resumen ya tiene patas, la confirmación ya ocurrió y no hace nada.
create or replace function public.confirm_running_cycle(
  p_period_id     uuid,
  p_next_end_date date,
  p_next_due_date date,
  p_plan          jsonb,
  p_projected_end date,
  p_projected_due date,
  p_expected      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $confirm$
declare
  v_uid        uuid := auth.uid();
  v_period     record;
  v_owner      uuid;
  v_next       record;
  -- uuid suelto, NO un record: en plpgsql leer un record nunca asignado tira
  -- "record is not assigned yet" en vez de dar null, y P(n+2) puede no existir.
  v_next_next_id uuid;
  v_new_start  date := p_next_end_date + 1;
  v_next_id    uuid;
  v_eager_id   uuid;
  v_op         text := coalesce(p_plan ->> 'next_next_op', 'none');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select cp.id, cp.account_id, cp.start_date, cp.end_date
    into v_period
    from public.card_periods cp
   where cp.id = p_period_id
     for update;
  if not found then
    raise exception 'period_not_found';
  end if;

  select a.user_id into v_owner from public.accounts a where a.id = v_period.account_id;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  -- Ya hubo un primer pago: la confirmación es un hecho del primer pago y no se repite.
  if exists (select 1 from public.period_payments pp where pp.period_id = p_period_id) then
    return jsonb_build_object('status', 'noop', 'reason', 'already_has_payments');
  end if;

  -- ── Revalidación de anclajes ──────────────────────────────────────────────
  -- El plan se calculó sobre una lectura previa. Si el estado cambió, aplicarlo pisaría
  -- con datos viejos: mejor fallar y que la app relea.
  if v_period.end_date is distinct from (p_expected ->> 'paid_end_date')::date then
    raise exception 'running_cycle_state_changed';
  end if;

  if (p_expected ->> 'next_period_id') is not null then
    select cp.id, cp.start_date, cp.end_date, cp.due_date
      into v_next
      from public.card_periods cp
     where cp.id = (p_expected ->> 'next_period_id')::uuid
       and cp.account_id = v_period.account_id;
    if not found
       or v_next.end_date is distinct from (p_expected ->> 'next_end_date')::date
       or v_next.due_date is distinct from (p_expected ->> 'next_due_date')::date then
      raise exception 'running_cycle_state_changed';
    end if;
    v_next_id := v_next.id;
  end if;

  if (p_expected ->> 'next_next_id') is not null then
    select cp.id into v_next_next_id
      from public.card_periods cp
     where cp.id = (p_expected ->> 'next_next_id')::uuid
       and cp.account_id = v_period.account_id;
    if v_next_next_id is null then
      raise exception 'running_cycle_state_changed';
    end if;
  end if;

  -- ── El plan, ejecutado ────────────────────────────────────────────────────

  -- Borde legacy: no hay fila para el ciclo en curso, se crea ya confirmada.
  if coalesce((p_plan ->> 'create_confirmed_next')::boolean, false) then
    insert into public.card_periods (account_id, start_date, end_date, due_date, is_estimated)
    values (v_period.account_id, v_period.end_date + 1, p_next_end_date, p_next_due_date, false)
    on conflict (account_id, start_date) do update
      set end_date = excluded.end_date,
          due_date = excluded.due_date,
          is_estimated = false
    returning id into v_next_id;
  end if;

  if v_next_next_id is not null and v_op <> 'none' then
    if v_op = 'reproject' then
      -- El cierre confirmado se comía un P(n+2) estimado y vacío: se re-proyecta en vez
      -- de rechazar.
      update public.card_periods
         set start_date = v_new_start,
             end_date   = p_projected_end,
             due_date   = p_projected_due
       where id = v_next_next_id;
    else
      if v_op = 'shift_extend' then
        -- Días que ahora cubre el ciclo en curso: sus consumos vuelven de P(n+2).
        update public.transactions
           set card_period_id = v_next_id
         where card_period_id = v_next_next_id
           and date <= p_next_end_date;
      else
        -- Se achicó: los consumos posteriores al cierre real son de P(n+2).
        update public.transactions
           set card_period_id = v_next_next_id
         where card_period_id = v_next_id
           and date > p_next_end_date;
      end if;

      update public.card_periods set start_date = v_new_start where id = v_next_next_id;
    end if;
  end if;

  -- Confirmación del ciclo en curso con las fechas del resumen en mano.
  if not coalesce((p_plan ->> 'create_confirmed_next')::boolean, false) and v_next_id is not null then
    update public.card_periods
       set end_date = p_next_end_date,
           due_date = p_next_due_date,
           is_estimated = false
     where id = v_next_id;
  end if;

  -- Invariante eager: siempre hay un estimado después del ciclo en curso, así que el
  -- "Próximo" del timeline nunca desaparece y los consumos posteriores tienen dónde caer.
  if coalesce((p_plan ->> 'create_eager_estimated')::boolean, false) then
    insert into public.card_periods (account_id, start_date, end_date, due_date, is_estimated)
    values (v_period.account_id, v_new_start, p_projected_end, p_projected_due, true)
    on conflict (account_id, start_date) do update
      set end_date = excluded.end_date,
          due_date = excluded.due_date
    returning id into v_eager_id;

    if coalesce((p_plan ->> 'reassign_shrunk_tail_to_eager')::boolean, false) and v_next_id is not null then
      update public.transactions
         set card_period_id = v_eager_id
       where card_period_id = v_next_id
         and date > p_next_end_date;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'running_period_id', v_next_id,
    'eager_period_id', v_eager_id
  );
end;
$confirm$;

revoke execute on function public.confirm_running_cycle(uuid, date, date, jsonb, date, date, jsonb) from public;
grant  execute on function public.confirm_running_cycle(uuid, date, date, jsonb, date, date, jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · `revert_card_period_payment` — deshacer, por GRUPO
-- ═══════════════════════════════════════════════════════════════════════════

-- Reescribe la función de la 0050. Dos cambios:
--
--   * Deshacer opera por GRUPO, no por pata. Una operación puede haber creado dos patas
--     (los pesos y los dólares del mismo resumen); revertir una sola dejaría medio pago
--     que el usuario nunca hizo así. Sin `p_group_id` se revierte todo el resumen.
--   * SECURITY DEFINER (era INVOKER). El motivo del INVOKER original era no darle a la
--     función más permisos que al usuario. Acá el objetivo es el opuesto y deliberado:
--     `period_payments` ya no tiene policies de escritura (sección 7), así que borrar
--     una pata es justamente algo que el usuario directo NO debe poder — solo esta
--     función, que verifica la propiedad explícitamente. Mismo patrón que
--     `reverse_settlement` (0023). El self-check de la 0050 que exigía INVOKER queda
--     reemplazado por el de la sección 8.
--
-- Lo que NO revierte sigue igual: las fechas confirmadas del ciclo, el período estimado
-- creado, las reasignaciones de consumos y la alícuota aprendida. Son hechos del resumen
-- de papel y no dependen de que el pago se haya cargado bien.

drop function if exists public.revert_card_period_payment(uuid);

create or replace function public.revert_card_period_payment(
  p_period_id uuid,
  p_group_id  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $revert$
declare
  v_uid          uuid := auth.uid();
  v_account_id   uuid;
  v_start_date   date;
  v_owner        uuid;
  v_blocking     date;
  v_latest_group uuid;
  v_was_settled  boolean;
  v_stamp_tx     uuid;
  v_link_known   boolean;
  v_candidates   uuid[];
  v_stamp_status text;
  v_tx_ids       uuid[];
  v_reverted     jsonb;
  v_movements    int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select cp.account_id, cp.start_date into v_account_id, v_start_date
    from public.card_periods cp where cp.id = p_period_id;
  if not found then
    raise exception 'period_not_found';
  end if;

  select a.user_id into v_owner from public.accounts a where a.id = v_account_id;
  if v_owner is distinct from v_uid then
    raise exception 'not_owner';
  end if;

  if not exists (select 1 from public.period_payments where period_id = p_period_id) then
    raise exception 'period_not_paid';
  end if;

  -- ── Guarda cronológica ────────────────────────────────────────────────────
  -- Antes: "un resumen posterior está pagado". Ahora alcanza con que TENGA patas: un
  -- parcial posterior también es un pasado sobre el que algo se construyó.
  select cp.end_date into v_blocking
    from public.card_periods cp
   where cp.account_id = v_account_id
     and cp.start_date > v_start_date
     and exists (select 1 from public.period_payments pp2 where pp2.period_id = cp.id)
   order by cp.start_date asc
   limit 1;

  if v_blocking is not null then
    raise exception
      'cannot revert payment of period % while a later period (closing %) has payments',
      p_period_id, v_blocking
      using errcode = 'GRN02', detail = v_blocking::text;
  end if;

  -- ── Qué grupos se revierten ───────────────────────────────────────────────
  -- El orden es (created_at, id), nunca created_at solo: las patas de un mismo grupo
  -- comparten el instante y sin el desempate "el más reciente" no está definido.
  select pp.payment_group_id into v_latest_group
    from public.period_payments pp
   where pp.period_id = p_period_id
   order by pp.created_at desc, pp.id desc
   limit 1;

  if p_group_id is not null and p_group_id is distinct from v_latest_group then
    raise exception 'not_latest_payment_group';
  end if;

  -- Si el resumen estaba saldado, sus consumos fueron barridos y hay que devolverlos.
  select coalesce(sum(p.pending), 0) = 0
    into v_was_settled
    from public.card_period_pending(p_period_id) p;

  -- ── El sello: solo si se revierte el grupo que lo trajo ───────────────────
  select pp.stamp_tax_transaction_id, bool_and(pp.stamp_tax_link_known)
    into v_stamp_tx, v_link_known
    from public.period_payments pp
   where pp.period_id = p_period_id
     and pp.stamp_tax_transaction_id is not null
     and (p_group_id is null or pp.payment_group_id = p_group_id)
   group by pp.stamp_tax_transaction_id
   limit 1;

  -- Payload de feedback, leído ANTES de los borrados, por moneda.
  select
    jsonb_agg(jsonb_build_object(
      'amount', x.amount, 'currency_code', x.currency_code, 'account_name', x.account_name
    )),
    array_agg(distinct x.id)
    into v_reverted, v_tx_ids
    from (
      select distinct t.id, t.amount, t.currency_code, a.name as account_name
        from public.period_payments pp
        join public.transactions t on t.id = pp.transaction_id
        join public.accounts a on a.id = t.account_id
       where pp.period_id = p_period_id
         and (p_group_id is null or pp.payment_group_id = p_group_id)
    ) x;

  -- ── La reversión ──────────────────────────────────────────────────────────

  -- (a) Las patas primero: liberan el FK RESTRICT que protege al gasto.
  delete from public.period_payments
   where period_id = p_period_id
     and (p_group_id is null or payment_group_id = p_group_id);

  -- (b) Los consumos vuelven a `pending` solo si el barrido había ocurrido.
  if v_was_settled then
    update public.transactions
       set status = 'pending'
     where card_period_id = p_period_id
       and status = 'paid';
    get diagnostics v_movements = row_count;
  end if;

  -- (c) El sello, por el vínculo explícito o —solo en pagos pre-0050— por heurística.
  if v_stamp_tx is not null then
    delete from public.transactions where id = v_stamp_tx;
    v_stamp_status := 'deleted';
    v_movements := greatest(v_movements - 1, 0);
  elsif coalesce(v_link_known, true) then
    v_stamp_status := 'none';
  else
    select array_agg(t.id) into v_candidates
      from public.transactions t
      join public.subcategories s on s.id = t.subcategory_id
     where t.card_period_id = p_period_id
       and s.canonical_name = 'impuesto-de-sellos';

    if v_candidates is null then
      v_stamp_status := 'none';
    elsif array_length(v_candidates, 1) = 1 then
      delete from public.transactions where id = v_candidates[1];
      v_stamp_status := 'deleted';
      v_movements := greatest(v_movements - 1, 0);
    else
      v_stamp_status := 'ambiguous';
    end if;
  end if;

  -- (d) Los débitos de las patas revertidas.
  delete from public.transactions where id = any(v_tx_ids);

  return jsonb_build_object(
    'reverted',          coalesce(v_reverted, '[]'::jsonb),
    'movements_reverted', v_movements,
    'stamp_tax',         coalesce(v_stamp_status, 'none'),
    'fully_reverted',    p_group_id is null
  );
end;
$revert$;

revoke execute on function public.revert_card_period_payment(uuid, uuid) from public;
grant  execute on function public.revert_card_period_payment(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · `period_payments` deja de escribirse directo
-- ═══════════════════════════════════════════════════════════════════════════

-- Solo SELECT. Las dos operaciones legítimas pasan por sus RPC.
--
-- Quitar solo el UPDATE dejaba la puerta de al lado abierta: con DELETE directo un
-- cliente borra la pata sin borrar su transacción, y queda un gasto huérfano que deja de
-- figurar como pago de tarjeta — liberando, encima, el FK RESTRICT que es justamente lo
-- que impide borrarlo desde el detalle del movimiento. La deuda del resumen reaparece y
-- la plata ya salió.

drop policy if exists "users insert own period_payments" on public.period_payments;
drop policy if exists "users update own period_payments" on public.period_payments;
drop policy if exists "users delete own period_payments" on public.period_payments;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_n int;
BEGIN
  -- El UNIQUE que impedía varias patas no puede volver: sería el bug original.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.period_payments'::regclass AND contype = 'u'
       AND pg_get_constraintdef(oid) ILIKE '%(period_id)%'
  ) THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: period_payments still has a UNIQUE on period_id';
  END IF;

  -- Ninguna fila legacy puede quedar diciendo que sabe qué imputó.
  SELECT count(*) INTO v_n FROM public.period_payments
   WHERE settlement_known AND (settles_currency IS NULL OR settles_amount IS NULL);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: % rows claim a known settlement without one', v_n;
  END IF;

  -- Los dos triggers: el de fila y el DIFERIDO. Si el segundo dejara de ser diferido,
  -- rechazaría la primera pata de todo pago de dos patas.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.period_payments'::regclass
      AND tgname = 'trg_period_payment_row_invariants'
  ) THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: the row invariants trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.period_payments'::regclass
      AND tgname = 'trg_period_payment_amount_matches' AND tgdeferrable AND tginitdeferred
  ) THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: the amount identity trigger is missing or not deferred';
  END IF;

  -- Ninguna policy de escritura: el invariante se saltea igual de fácil por INSERT,
  -- UPDATE o DELETE directo.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'period_payments' AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: period_payments still has % write polic(ies)', v_n;
  END IF;

  -- Los dos RPC tienen que ser SECURITY DEFINER: sin policies de escritura, un INVOKER
  -- no podría escribir nada. Esto REEMPLAZA el self-check de la 0050, que exigía lo
  -- contrario cuando la tabla todavía era escribible por el usuario.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('pay_card_period_legs', 'revert_card_period_payment')
     AND p.prosecdef;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: expected 2 SECURITY DEFINER payment RPCs, found %', v_n;
  END IF;

  RAISE NOTICE 'card payment legs validated: coverage in the database, no direct writes, deferred amount identity.';
END $check$;

select '✓ 0061 card payment legs applied' as status;

commit;
