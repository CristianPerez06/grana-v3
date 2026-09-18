-- QA — recurrence-link-movement · BLOQUE B: qué movimiento cargar
--
-- Todo es de LECTURA. No escribe nada, y el movimiento se carga DESDE LA APP,
-- nunca desde acá: cargarlo por SQL saltearía las validaciones y los triggers,
-- y entonces el QA no probaría lo que el usuario hace.
--
-- Contesta la única pregunta que hace falta para empezar: con qué regla conviene
-- probar, con qué fecha, qué importe, qué cuenta y qué moneda.
--
-- La VENTANA es lo que decide si un movimiento aparece entre los candidatos: va
-- del vencimiento anterior al siguiente, tomados del calendario real de la regla.
-- Por eso una regla mensual admite «veinte días antes» y una de cada tres días no:
-- en esa el vencimiento anterior cae tres días atrás. La ventana ampliada es la
-- que muestra «Ampliar la búsqueda», con tres vecinos de cada lado.

with yo as (
  select id as user_id
    from auth.users
   where email = 'jmalacalza83@gmail.com'
),
hoy as (
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d
),
reglas as (
  select r.id, r.description, r.frequency, r.movement_type, r.amount,
         r.currency_code, r.account_id, r.household_id
    from public.recurrences r
    join yo on yo.user_id = r.user_id
   where r.status = 'active'
),
proximo as (
  -- El próximo vencimiento de cada regla: el primero del calendario después de hoy.
  select g.*, n.hi as vencimiento
    from reglas g
    cross join hoy
    cross join lateral public.recurrence_calendar_around(g.id, hoy.d, 1, 1) n
)
select
  p.id                                        as regla_id,
  coalesce(nullif(btrim(p.description), ''), '(sin descripción)') as regla,
  p.frequency                                 as frecuencia,
  p.movement_type                             as tipo_de_movimiento,
  p.vencimiento                               as vence_el,
  a.name                                      as cargar_en_la_cuenta,
  p.currency_code                             as moneda,
  p.amount                                    as importe_de_la_regla,
  w.lo                                        as ventana_desde,
  w.hi                                        as ventana_hasta,
  -- Lo más lejos que se puede ir hacia atrás sin salir de la ventana, con un
  -- tope de 20 días: es el caso que motivó el change (pagar el 3 lo que vence el 23).
  greatest(w.lo, p.vencimiento - 20)          as fecha_para_el_caso_normal,
  -- Un día antes del borde: NO aparece en la lista inicial y sí al ampliar.
  (w.lo - 1)                                  as fecha_para_probar_ampliar,
  w3.lo                                       as ampliada_desde,
  w3.hi                                       as ampliada_hasta,
  case when p.household_id is not null then 'SÍ — probá también la conversión'
       else 'no' end                          as regla_compartida
from proximo p
left join public.accounts a on a.id = p.account_id
cross join lateral public.recurrence_calendar_around(p.id, p.vencimiento, 1, 1) w
cross join lateral public.recurrence_calendar_around(p.id, p.vencimiento, 3, 3) w3
where p.vencimiento > (select d from hoy)
-- La ventana más ancha primero: es la regla más cómoda para el caso normal.
order by (w.hi - w.lo) desc, p.vencimiento;

-- Cómo se lee el resultado
--
-- 1. Tomá la PRIMERA fila: es la regla con la ventana más ancha.
-- 2. En la app, cargá un gasto (o ingreso, según `tipo_de_movimiento`) con:
--      fecha   = `fecha_para_el_caso_normal`
--      cuenta  = `cargar_en_la_cuenta`
--      moneda  = `moneda`
--      importe = el de la regla, o uno bien distinto para el caso B3
--    Sin descripción está bien: la lista lo va a nombrar «Movimiento sin descripción».
-- 3. Volvé al hub, tocá «Ya lo tengo cargado» en el vencimiento `vence_el` de esa regla.
--    Ese movimiento tiene que estar en la lista.
-- 4. Para probar «Ampliar la búsqueda», cargá otro con `fecha_para_probar_ampliar`:
--    NO tiene que aparecer al abrir, y SÍ después de ampliar.
