-- =============================================================================
-- Verificación de datos · Fecha del reintegro desalineada del gasto de origen
-- Pegá cada bloque en el SQL Editor de Supabase.
--
-- CONTEXTO
-- La fecha contable de un reintegro toma por default la fecha del GASTO que le
-- dio origen (nunca el día de carga). El bug: editar la fecha del gasto DESPUÉS
-- de crearlo no se propagaba al reintegro vinculado, que quedaba varado en el día
-- en que se cargó. Corregido en código (`updateTransaction` cascadea la nueva
-- fecha a los reintegros cuya fecha aún coincidía con la fecha vieja del gasto).
--
-- El fix corrige de acá en adelante; los reintegros ya desalineados hay que
-- corregirlos en la base con §2.
-- =============================================================================

-- ── §1 · Reintegros cuya fecha NO coincide con la del gasto vinculado ─────────
-- `reintegro_en_dia_de_carga = true` es la firma del bug: el reintegro quedó en
-- su propio día de creación en vez de la fecha del gasto. Revisá esta lista antes
-- de correr el update de §2 (una fecha de acreditación puesta a mano a propósito
-- también aparece acá y NO habría que pisarla).
select
  r.id                            as reintegro_id,
  r.date                          as reintegro_date,
  e.date                          as gasto_date,
  (r.date = r.created_at::date)   as reintegro_en_dia_de_carga,
  r.reimbursement_target          as destino,
  r.received_at is not null       as recibido,
  e.description                   as gasto_descripcion
from public.transactions r
join public.transactions e on e.id = r.linked_transaction_id
join auth.users u on u.id = r.user_id
where u.email = 'julieta.malacalza@gmail.com'   -- reemplazá por el usuario a auditar
  and r.type = 'reimbursement'
  and r.date <> e.date
order by r.created_at desc;

-- ── §2 · Corregir UN reintegro puntual (iguala su fecha a la del gasto) ───────
-- Seguro: los balances y la deuda del hogar son derivados (no hay saldo que
-- recalcular), y el trigger `trg_fn_reimbursement_invariants` no restringe `date`.
update public.transactions r
set date = e.date
from public.transactions e
where r.id = '<REINTEGRO_ID>'          -- de §1
  and e.id = r.linked_transaction_id;

-- ── §3 · Corregir en lote SOLO los que tienen la firma del bug ────────────────
-- Alinea la fecha del reintegro a la del gasto únicamente cuando el reintegro
-- había quedado en su día de carga (firma del bug), evitando pisar fechas de
-- acreditación puestas a mano. Corré §1 primero para ver exactamente qué toca.
update public.transactions r
set date = e.date
from public.transactions e
where r.linked_transaction_id = e.id
  and r.type = 'reimbursement'
  and r.user_id = (select id from auth.users where email = 'julieta.malacalza@gmail.com')
  and r.date <> e.date
  and r.date = r.created_at::date;
