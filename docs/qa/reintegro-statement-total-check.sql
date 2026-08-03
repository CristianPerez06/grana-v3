-- =============================================================================
-- Verificación de datos · Reintegro "en resumen" no descontado del total pagado
-- Pegá cada bloque en el SQL Editor de Supabase.
--
-- CONTEXTO
-- El bug de LECTURA (total del resumen pagado no restaba el reintegro recibido)
-- se corrige en el código (`computePeriodAmounts`): el total se DERIVA en cada
-- lectura, así que apenas se despliega el fix, todos los resúmenes muestran el
-- total correcto sin tocar la base.
--
-- Lo que este script diagnostica es distinto: si el GASTO de pago que se registró
-- en la cuenta (lo que efectivamente se debitó) fue el neto correcto o el bruto.
-- Eso depende de si el reintegro ya estaba "recibido" (received_at seteado) en el
-- momento en que se pagó el resumen:
--   · recibido ANTES de pagar  → el form precargó el neto → se pagó bien → nada que hacer.
--   · recibido DESPUÉS de pagar → se pagó de más por el monto del reintegro → remediar.
-- =============================================================================

-- ── §0 · Reemplazá con tu user_id (o dejá el sub-select por email) ───────────
-- select id, email from auth.users where email = 'cristian.ap84@gmail.com';

-- ── §1 · Resúmenes PAGADOS que tienen un reintegro "en resumen" recibido ─────
-- Compara, por período pagado, el bruto (Σ consumos paid), el reintegro recibido
-- y el neto correcto, contra el monto del gasto de pago que quedó registrado.
--   diff_ars = pago_registrado_ars − neto_ars
--     · diff ≈ 0            → se pagó el neto: OK, solo faltaba el fix de lectura.
--     · diff ≈ reintegro    → se pagó el BRUTO: hay que remediar (ver §2).
-- Nota: el gasto de pago es siempre ARS (la deuda USD se convierte al pagar); si
-- el período tenía deuda USD, `pago_registrado_ars` incluye esa conversión y el
-- diff hay que leerlo contemplándola.
with paid as (
  select cp.id            as period_id,
         a.name           as card_name,
         cp.start_date,
         cp.end_date,
         pp.transaction_id as payment_expense_id
  from public.card_periods cp
  join public.accounts a        on a.id = cp.account_id
  join public.period_payments pp on pp.period_id = cp.id
  where a.type = 'credit'
    and a.user_id = (select id from auth.users where email = 'cristian.ap84@gmail.com')
),
bruto as (  -- Σ consumos paid ARS del resumen (excluye reintegros y el padre de cuotas)
  select t.card_period_id as period_id, sum(t.amount) as bruto_ars
  from public.transactions t
  where t.type <> 'reimbursement' and t.status = 'paid'
    and t.currency_code = 'ARS' and t.is_parent = false
  group by t.card_period_id
),
reint as (  -- Σ reintegros "en resumen" recibidos ARS del resumen
  select t.card_period_id as period_id, sum(t.amount) as reintegro_ars
  from public.transactions t
  where t.type = 'reimbursement' and t.reimbursement_target = 'statement'
    and t.received_at is not null and t.cancelled_at is null
    and t.currency_code = 'ARS'
  group by t.card_period_id
)
select p.card_name,
       p.start_date, p.end_date,
       coalesce(b.bruto_ars, 0)                                   as bruto_ars,
       coalesce(r.reintegro_ars, 0)                               as reintegro_ars,
       coalesce(b.bruto_ars, 0) - coalesce(r.reintegro_ars, 0)    as neto_ars,
       pe.amount                                                  as pago_registrado_ars,
       pe.amount - (coalesce(b.bruto_ars, 0) - coalesce(r.reintegro_ars, 0)) as diff_ars
from paid p
join public.transactions pe on pe.id = p.payment_expense_id
left join bruto b on b.period_id = p.period_id
left join reint r on r.period_id = p.period_id
where coalesce(r.reintegro_ars, 0) > 0   -- solo los resúmenes con reintegro recibido
order by p.end_date desc;

-- ── §2 · Remediación (SOLO si §1 muestra diff_ars ≈ reintegro_ars) ────────────
-- No se arregla con SQL: usá la app, que mantiene la integridad (revierte el gasto,
-- devuelve la plata a la cuenta y vuelve los consumos a pendiente) en una sola
-- transacción vía `revert_card_period_payment`:
--   1. Abrí el resumen → "Deshacer pago".
--   2. Volvé a pagarlo. Con el reintegro ya recibido, el form precarga el neto
--      correcto (`pendingAmountARS` ya lo descuenta) y el débito queda por el
--      monto real.
-- Si diff_ars ≈ 0, no hay nada que remediar: el pago ya fue por el neto y el fix
-- de lectura corrige lo único que estaba mal (el total mostrado).
