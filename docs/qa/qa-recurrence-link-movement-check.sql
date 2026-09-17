-- QA — recurrence-link-movement
--
-- Lo que la pantalla NO muestra: con qué identidad quedó cada ocurrencia, si
-- alguna quedó pendiente con fecha futura, y si algún movimiento está resolviendo
-- más de un vencimiento.
--
-- Se pega en el SQL Editor. Todo es de LECTURA: no escribe nada.
-- Reemplazar <TU_USER_ID> por el uuid del usuario con el que se hace el QA.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · ¿Existen las funciones que el change agrega?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Si alguna falta, la migración 0072 no se aplicó y el resto del QA no significa
-- nada: las pantallas van a fallar al primer toque.

select
  p.proname                                as funcion,
  pg_get_function_identity_arguments(p.oid) as firma,
  case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seguridad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'recurrence_link_candidates',
    'recurrence_link_movement',
    'recurrence_unlink_movement',
    'settlement_is_live',
    'recurrence_link_window',
    'recurrence_split_matches'
  )
order by p.proname;
-- Esperado: 6 filas, todas INVOKER.

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · ¿Las guardas usan el criterio de vigencia?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Las dos gemelas —borrar y descompartir— tienen que contestar igual. Si una dice
-- `false`, el sistema responde distinto a dos preguntas que el spec define juntas.

select
  p.proname as guarda,
  (prosrc like '%settlement_is_live%') as usa_el_criterio
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'trg_fn_block_shared_delete_with_settlement',
    'trg_fn_block_unshare_with_settlement'
  );
-- Esperado: 2 filas, las dos en true.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · NINGUNA ocurrencia sin resolver puede tener fecha futura
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Es el caso trampa de «Ya lo pagué»: si el registro anticipado dejara una fila
-- pendiente fechada adelante, el bloque de «por revisar» le pediría al usuario
-- algo que acaba de pagar. Esta consulta tiene que volver VACÍA.

select
  i.id,
  i.recurrence_id,
  i.due_date,
  i.status,
  'PENDIENTE CON FECHA FUTURA — no debería existir' as problema
from public.recurrence_instances i
where i.user_id = '<TU_USER_ID>'
  and i.status = 'pending'
  and i.due_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date;
-- Esperado: 0 filas.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Un movimiento resuelve UN vencimiento
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Si alguno resolviera dos, la regla parecería al día con la mitad de los pagos.
-- Tiene que volver VACÍA.

select
  i.confirmed_transaction_id,
  count(*) as vencimientos_que_resuelve,
  array_agg(i.due_date order by i.due_date) as fechas
from public.recurrence_instances i
where i.user_id = '<TU_USER_ID>'
  and i.confirmed_transaction_id is not null
group by i.confirmed_transaction_id
having count(*) > 1;
-- Esperado: 0 filas.

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · Cómo quedó resuelta cada ocurrencia
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `vencimiento` es la identidad de la ocurrencia y `fecha_de_pago` es la del
-- movimiento: son DOS HECHOS DISTINTOS y pueden no coincidir. Que difieran es
-- exactamente lo que este change habilita — no es un error.
--
-- `resolucion` decide qué se puede deshacer: 'linked' ofrece desvincular,
-- 'created' no (borrar el movimiento es otra operación, #104).

select
  r.description                     as regla,
  i.due_date                        as vencimiento,
  t.date                            as fecha_de_pago,
  i.status                          as estado,
  i.resolution_kind                 as resolucion,
  i.linked_conversion               as convirtio_a_compartido,
  t.amount                          as importe_del_movimiento,
  r.amount                          as importe_de_la_regla,
  t.is_shared                       as movimiento_compartido
from public.recurrence_instances i
join public.recurrences r on r.id = i.recurrence_id
left join public.transactions t on t.id = i.confirmed_transaction_id
where i.user_id = '<TU_USER_ID>'
order by r.description, i.due_date desc;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · El avance del límite, como lo lee el sistema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Este es el número normativo: el mismo que corta la generación. Si la pantalla
-- dice otra cosa, la que está mal es la pantalla.
--
-- Una posición se gasta al llegar su fecha O al resolverse antes, una sola vez.

select
  r.description                                as regla,
  r.max_occurrences                            as tope,
  public.recurrence_positions_spent(
    r.id,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )                                            as gastadas,
  r.max_occurrences - public.recurrence_positions_spent(
    r.id,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )                                            as restantes
from public.recurrences r
where r.user_id = '<TU_USER_ID>'
  and r.max_occurrences is not null
  and r.status <> 'deleted'
order by r.description;
-- `gastadas` nunca puede superar el tope, y `restantes` nunca puede ser negativo.

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Qué liquidaciones siguen protegiendo algo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Para entender por qué una desvinculación quedó trabada — y qué acción la
-- destraba, que NO es siempre «revertir»:
--
--   completed        se revierte (contraasiento)
--   pending_receipt  se CANCELA, y sólo puede hacerlo quien la registró
--   reversed/contra  ya no protegen nada: no deberían bloquear

select
  s.id,
  s.status,
  pm.date                       as fecha_de_la_liquidacion,
  s.payer_id                    as la_registro,
  public.settlement_is_live(s)  as sigue_protegiendo,
  case s.status
    when 'completed'       then 'se revierte'
    when 'pending_receipt' then 'se cancela (sólo quien la registró)'
    else                        'ya no bloquea'
  end                           as como_se_resuelve
from public.settlement s
left join public.transactions pm on pm.id = s.payer_movement_id
order by pm.date desc nulls last;
