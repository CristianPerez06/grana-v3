-- Tarjetas — un solo vencimiento por mes calendario en los resúmenes estimados.
--
-- Run AFTER 0075_undo_reopens_occurrence.sql.
--
-- Change: openspec/changes/archive/2026-11-01-one-due-date-per-month/
--
-- Supabase es online-only: se aplica pegando este archivo en el SQL Editor del
-- dashboard. Corre en una sola transacción. No cambia el contrato público —ni
-- columnas ni RPC nuevas—, así que `packages/supabase/src/types.ts` no cambia.
--
-- NO ES DESTRUCTIVA: solo corre hacia adelante el `due_date` de períodos
-- ESTIMADOS y SIN PAGO. No toca fechas que el usuario cargó de un resumen real
-- (`is_estimated = false`), ni resúmenes pagados, ni `start_date`/`end_date`, ni
-- la asignación de consumos (que depende del cierre, no del vencimiento).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- El defecto
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El vencimiento de un resumen futuro se proyecta sumando días promedio al
-- cierre (`suggestNextPeriodDates`, @grana/money-logic). Eso puede dejar dos
-- vencimientos de la misma tarjeta en el mismo mes: el resumen anterior vence el
-- 02/11 y el que cierra el 19/11 se proyecta al 30/11. En la vida real un banco
-- emite un resumen por mes, así que «Compromisos de noviembre» sumaba dos
-- resúmenes de la tarjeta y diciembre quedaba sin ninguno.
--
-- La proyección ya aplica la regla para los períodos nuevos. Esta migración
-- corrige los estimados que ya estaban guardados: si un estimado sin pago vence
-- en el mismo mes que el resumen anterior de su tarjeta (o antes), pasa al día
-- 1 del mes siguiente al vencimiento anterior. Se repite hasta que no quede
-- ninguno, porque correr uno puede alcanzar al siguiente de la misma tarjeta.
-- El tope de vueltas solo protege contra datos corruptos.

do $$
declare
  v_rounds int := 0;
  v_moved  int;
begin
  loop
    with ordered as (
      select cp.id,
             cp.due_date,
             cp.is_estimated,
             lag(cp.due_date) over (partition by cp.account_id order by cp.end_date) as prev_due
        from public.card_periods cp
    )
    update public.card_periods cp
       set due_date = (date_trunc('month', o.prev_due) + interval '1 month')::date
      from ordered o
     where cp.id = o.id
       and o.is_estimated
       and o.prev_due is not null
       and date_trunc('month', o.due_date) <= date_trunc('month', o.prev_due)
       and not exists (select 1 from public.period_payments pp where pp.period_id = cp.id);

    get diagnostics v_moved = row_count;
    v_rounds := v_rounds + 1;
    exit when v_moved = 0 or v_rounds >= 120;
  end loop;
end
$$;
