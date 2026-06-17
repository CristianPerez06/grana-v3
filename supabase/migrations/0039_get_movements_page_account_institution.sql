-- ═══════════════════════════════════════════════════════════════════════════
-- 0039 — get_movements_page: institución de la cuenta en source/destination
--
-- La fila del listado muestra la institución como principal (igual que el
-- módulo Cuentas y el detalle). Para eso el RPC ahora embebe `institution`
-- ({ name }) dentro de `source_account` y `destination_account`, que
-- toFinancialMovement aplana a account_institution_name /
-- destination_account_institution_name.
--
-- Solo cambian esos dos objetos jsonb + los joins a institutions; el resto de
-- la función es idéntico a la 0030.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_movements_page(
  p_filters jsonb default '{}'::jsonb,
  p_limit   integer default 50,
  p_offset  integer default 0
)
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
with f as (
  select
    nullif(p_filters->>'from', '')::date       as date_from,
    nullif(p_filters->>'to', '')::date         as date_to,
    nullif(p_filters->>'categoryId', '')::uuid as category_id,
    nullif(p_filters->>'subcategoryId', '')    as subcategory_marker,
    nullif(p_filters->>'currency', '')         as currency,
    nullif(p_filters->>'accountId', '')::uuid  as account_id,
    nullif(p_filters->>'type', '')             as kind_filter,
    -- Pattern pre-escapado para ILIKE: el query del usuario es texto literal,
    -- no un patrón (paridad con String.includes del filtrado JS previo).
    case
      when nullif(trim(coalesce(p_filters->>'query', '')), '') is null then null
      else '%' || replace(replace(replace(
             trim(p_filters->>'query'), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end                                        as text_pattern,
    (p_filters->>'amountMin')::numeric         as amount_min,
    (p_filters->>'amountMax')::numeric         as amount_max
)
select
  to_jsonb(t) || jsonb_build_object(
    'category', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'name', c.name, 'canonical_name', c.canonical_name,
      'color', c.color, 'icon', c.icon, 'user_id', c.user_id
    ) end,
    'subcategory', case when s.id is null then null else jsonb_build_object(
      'id', s.id, 'name', s.name, 'canonical_name', s.canonical_name,
      'category_id', s.category_id, 'user_id', s.user_id
    ) end,
    'source_account', case when sa.id is null then null else jsonb_build_object(
      'id', sa.id, 'name', sa.name, 'type', sa.type,
      'institution', case when sai.id is null then null else jsonb_build_object('name', sai.name) end
    ) end,
    'destination_account', case when da.id is null then null else jsonb_build_object(
      'id', da.id, 'name', da.name, 'type', da.type,
      'institution', case when dai.id is null then null else jsonb_build_object('name', dai.name) end
    ) end,
    'period_payments', coalesce(pp.payments, '[]'::jsonb),
    'linked_expense', case
      when t.type::text = 'reimbursement' and le.id is not null then jsonb_build_object(
        'id', le.id, 'description', le.description, 'amount', le.amount,
        'currency_code', le.currency_code, 'date', le.date,
        'category', case when lc.id is null then null else jsonb_build_object(
          'id', lc.id, 'name', lc.name, 'canonical_name', lc.canonical_name,
          'color', lc.color, 'icon', lc.icon, 'user_id', lc.user_id
        ) end,
        'subcategory', case when ls.id is null then null else jsonb_build_object(
          'id', ls.id, 'name', ls.name, 'canonical_name', ls.canonical_name,
          'category_id', ls.category_id, 'user_id', ls.user_id
        ) end
      )
      else null
    end
  )
from f
join transactions t
  on t.parent_id is null
 -- isHistoryRow: solo reintegros RECIBIDOS pertenecen a la historia.
 and (t.type::text <> 'reimbursement'
      or (t.received_at is not null and t.cancelled_at is null))
 and (f.date_from is null or t.date >= f.date_from)
 and (f.date_to   is null or t.date <= f.date_to)
 and (f.category_id is null or t.category_id = f.category_id)
 and (f.subcategory_marker is null
      or (f.subcategory_marker = '__none__' and t.subcategory_id is null)
      or (f.subcategory_marker <> '__none__'
          and t.subcategory_id = f.subcategory_marker::uuid))
 and (f.currency is null or t.currency_code = f.currency)
 and (f.account_id is null
      or t.account_id = f.account_id
      or t.transfer_destination_account_id = f.account_id
      -- Parent de cuotas con al menos un hijo en la cuenta filtrada.
      or exists (select 1 from transactions ch
                  where ch.parent_id = t.id and ch.account_id = f.account_id)
      -- Pago de resumen de un período de la cuenta (tarjeta) filtrada.
      or exists (select 1 from period_payments xp
                   join card_periods xcp on xcp.id = xp.period_id
                  where xp.transaction_id = t.id and xcp.account_id = f.account_id))
 and (f.amount_min is null or abs(t.amount) >= f.amount_min)
 and (f.amount_max is null or abs(t.amount) <= f.amount_max)
left join categories    c  on c.id = t.category_id
left join subcategories s  on s.id = t.subcategory_id
left join accounts      sa on sa.id = t.account_id
left join accounts      da on da.id = t.transfer_destination_account_id
left join institutions  sai on sai.id = sa.institution_id
left join institutions  dai on dai.id = da.institution_id
left join transactions  le on le.id = t.linked_transaction_id
                          and t.type::text = 'reimbursement'
left join categories    lc on lc.id = le.category_id
left join subcategories ls on ls.id = le.subcategory_id
left join lateral (
  select jsonb_agg(jsonb_build_object(
           'id', xp.id,
           'period_id', xp.period_id,
           'period', jsonb_build_object(
             'id', xcp.id, 'start_date', xcp.start_date, 'end_date', xcp.end_date,
             'due_date', xcp.due_date,
             'account', case when xpa.id is null then null else jsonb_build_object(
               'id', xpa.id, 'name', xpa.name, 'type', xpa.type
             ) end
           )
         )) as payments
    from period_payments xp
    join card_periods xcp on xcp.id = xp.period_id
    left join accounts xpa on xpa.id = xcp.account_id
   where xp.transaction_id = t.id
) pp on true
cross join lateral (
  select
    -- Espejo exacto del orden de precedencia de toFinancialMovement.
    case
      when t.is_parent then 'installment_purchase'
      when pp.payments is not null then 'card_payment'
      when t.type::text in ('income', 'expense', 'transfer', 'exchange', 'reimbursement')
        then t.type::text
      else 'adjustment'  -- adjustment + settlement
    end as kind,
    case
      when t.is_parent then coalesce(t.description, c.name, 'Compra en cuotas')
      when pp.payments is not null then 'Pago de resumen'
      when t.type::text = 'reimbursement'
        then coalesce(le.description, t.description, 'Reintegro')
      when t.type::text = 'income' then coalesce(c.name, 'Ingreso')
      when t.type::text = 'expense' then coalesce(c.name, 'Gasto')
      when t.type::text = 'transfer' then 'Transferencia'
      when t.type::text = 'exchange' then 'Cambio'
      when t.type::text = 'settlement'
        then case when t.settlement_direction = 'in' then 'Pago recibido' else 'Saldar deuda' end
      else 'Ajuste'
    end as title,
    -- El reimbursement hereda la descripción del gasto vinculado (la fila se
    -- lee igual que su gasto) — misma regla que el mapper TS.
    case when t.type::text = 'reimbursement'
      then coalesce(le.description, t.description)
      else t.description
    end as eff_description
) calc
where (f.kind_filter is null or calc.kind = f.kind_filter)
  and (f.text_pattern is null
       or concat_ws(' ',
            calc.title,
            calc.eff_description,
            sa.name,
            case when calc.kind = 'transfer' then da.name end
          ) ilike f.text_pattern)
order by t.date desc, t.created_at desc, t.id desc
limit p_limit + 1 offset p_offset
$$;

-- ─── Self-check ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_secdef boolean;
BEGIN
  SELECT prosecdef INTO v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_movements_page';

  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'get_movements_page must be SECURITY INVOKER so RLS applies to the caller';
  END IF;
END $$;
