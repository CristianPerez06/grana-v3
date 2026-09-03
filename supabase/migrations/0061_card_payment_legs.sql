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

commit;
