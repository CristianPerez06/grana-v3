-- Propósito — la etiqueta de para qué se guardó, y el piso por propósito.
--
-- Run AFTER 0057_availability_reserve.sql.
--
-- La fase 1 dejó al usuario pudiendo decir "esto no lo voy a gastar". Esta dice
-- PARA QUÉ. Y la diferencia de precio entre las dos es enorme: "Guardaste
-- $200.000" es una abstracción, "Guardaste $200.000 para Japón" es una razón para
-- volver — y no requiere saber dónde está esa plata ni cuánto rinde.
--
-- Un propósito es un NOMBRE Y UN ÍCONO. No tiene monto objetivo, ni fecha, ni
-- progreso: eso es una META y es de la fase 4, cuando existan las posiciones que
-- la respalden. Adelantarla acá dejaría una barra de progreso que no sabe en qué
-- moneda está parada la plata — que en Argentina es exactamente lo que no hay que
-- hacer.
--
-- Lo que esta migración NO toca, y es lo que la hace barata:
--
--   · `get_available_sums` y `get_reserve_flow_sums` quedan IDÉNTICAS. El
--     propósito no participa de ningún número de la card. El dashboard no cambia.
--   · Ninguna fila existente se migra. Las reservas de la fase 1 quedan con
--     `purpose_id` en nulo y se leen como «Sin destino».
--
-- Agrega UNA función normativa:
--
--   · get_purpose_sums(date) — STOCK por (propósito, moneda). Tiene dos
--     consumidores: el detalle agrupado del drawer y —lo importante— el PISO del
--     write path.
--
-- Por qué el piso necesita una función y no una suma en TS: con propósitos, "no
-- podés volver a usar más de lo que tenés guardado" deja de alcanzar. Si
-- Emergencia tiene $50.000 y Sin destino $140.000, volver a usar $80.000 parado
-- en Emergencia pasa el control global —el total es $190.000— y deja a Emergencia
-- en −$30.000: afirmaría que podés gastar plata que ese grupo no tiene, mientras
-- el total sigue cerrando bien. El piso pasa a ser por (propósito, moneda), y esa
-- suma se define UNA vez, acá. Es la lección de 0051 un nivel más abajo.
--
-- Aditiva: tabla nueva, columna nullable, función nueva. Cero cambios a lo
-- existente.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. savings_purpose — la etiqueta, y nada más
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sin filas de sistema (`user_id` nulo), a diferencia de `categories`. La
-- comparación es tentadora y no aplica: una categoría de sistema no se puede
-- renombrar y está bien, porque "Comida" le sirve igual a todos. Un propósito de
-- sistema tampoco se podría renombrar, y ahí el costo es el producto entero: si
-- "Viaje" viene de fábrica, no se puede convertir en "Japón", y el nombre
-- personal ES el valor de la fase.
--
-- Los propósitos sugeridos viven en la app como texto (i18n), no como filas.
-- Tocar una sugerencia CREA un propósito propio del usuario, editable y
-- borrable. Cero tipeo para arrancar, y nada intocable al final.
--
-- Sin `currency_code`: un propósito NO tiene moneda. La tienen los guardados que
-- cuelgan de él, y "Japón" es bimoneda por naturaleza. En pantalla se ve separado
-- por moneda porque el drawer ya es por moneda y las monedas nunca se suman.

create table public.savings_purpose (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,
  created_at timestamptz not null default now(),
  constraint chk_savings_purpose_name_not_blank check (btrim(name) <> '')
);

-- Un nombre por usuario, sin que la diferencia sea el shift. Dos "Emergencia" no
-- se distinguen mirándolos, y el problema no aparece al crearlos: aparece meses
-- después, cuando no entendés por qué la plata quedó partida en dos.
--
-- Normaliza mayúsculas y espacios de borde. NO pliega acentos: "Japon" y "Japón"
-- conviven, y es un límite conocido — `unaccent` no es IMMUTABLE y no entra en un
-- índice sin un wrapper propio. Si algún día molesta, se resuelve con un
-- `canonical_name` como el de `categories`.
create unique index uq_savings_purpose_user_name
  on public.savings_purpose (user_id, lower(btrim(name)));

alter table public.savings_purpose enable row level security;

create policy "users read own savings purposes"
  on public.savings_purpose for select
  using (user_id = auth.uid());

create policy "users insert own savings purposes"
  on public.savings_purpose for insert
  with check (user_id = auth.uid());

create policy "users update own savings purposes"
  on public.savings_purpose for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own savings purposes"
  on public.savings_purpose for delete
  using (user_id = auth.uid());

comment on table public.savings_purpose is
  'Para qué se guardó: nombre e ícono, propiedad del usuario. NO es una meta — sin objetivo, fecha ni progreso (eso es fase 4). No participa de ningún número del dashboard.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. availability_reserve.purpose_id — opcional, y opcional para siempre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nullable sin default y sin backfill. El nulo no es "todavía no lo etiquetó":
-- es un grupo más, «Sin destino», con exactamente las mismas reglas que
-- cualquier propósito — incluido el piso. Tratarlo como una ausencia sería
-- justamente por dónde se escaparía el control de arriba.
--
-- ON DELETE SET NULL, y es la decisión importante de esta migración: borrar una
-- ETIQUETA no puede cambiar ningún NÚMERO. Con cascade, borrar "Japón" borraría
-- las reservas y le bajaría el guardado al usuario sin que nadie lo haya
-- decidido; con restrict, tendría que vaciar el propósito antes de borrarlo, que
-- es pedirle que devuelva plata al disponible para poder renombrar una idea. Al
-- borrar, la plata vuelve a «Sin destino» — no se pierde, no se gasta, no se
-- mueve de ninguna cuenta. La app avisa cuánta antes de hacerlo.

alter table public.availability_reserve
  add column purpose_id uuid references public.savings_purpose(id) on delete set null;

comment on column public.availability_reserve.purpose_id is
  'Para qué se guardó. NULL = «Sin destino», que es un grupo con las mismas reglas que cualquier propósito, no una ausencia. Al borrar el propósito la plata vuelve acá (ON DELETE SET NULL): borrar una etiqueta nunca cambia un número.';

-- El group by de get_purpose_sums y, sobre todo, el SET NULL del borrado, que
-- tiene que encontrar las filas de un propósito sin recorrer la tabla.
create index idx_availability_reserve_purpose
  on public.availability_reserve (user_id, purpose_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_purpose_sums — STOCK por (propósito, moneda), a una fecha
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Devuelve una fila por cada par (propósito, moneda) que tenga al menos una
-- reserva vigente al corte, con el nombre y el ícono ya resueltos para que el
-- drawer no tenga que hacer un segundo viaje. «Sin destino» viene con
-- `purpose_id` nulo y nombre nulo: el rótulo es copy y vive en i18n, no acá — la
-- base no habla castellano.
--
-- Incluye los grupos que suman CERO (guardaste $100.000 y volviste a usar los
-- $100.000). No es ruido: el piso de ese grupo es cero y el write path necesita
-- leerlo como cero, no como la ausencia de la fila. Los propósitos sin ninguna
-- reserva no aparecen — esos salen de la tabla, que es una lectura aparte y no
-- de plata.
--
-- Mismo corte temporal que el resto: `date <= hoy` en timezone financiero AR,
-- nunca `current_date` a secas (el servidor corre en UTC y adelantaría el corte
-- hasta 3 horas).
--
-- El total por moneda de esta función es, por construcción, el `reserved` de
-- `get_available_sums`. No se recalcula ninguno de los dos a partir del otro:
-- son dos cortes de las mismas filas y la única fuente sigue siendo la tabla.

create or replace function public.get_purpose_sums(
  p_today date default null
)
returns table (
  purpose_id    uuid,
  purpose_name  text,
  purpose_icon  text,
  currency_code text,
  reserved      numeric
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
)
select
  r.purpose_id                as purpose_id,
  p.name                      as purpose_name,
  p.icon                      as purpose_icon,
  r.currency_code             as currency_code,
  coalesce(sum(r.amount), 0.00)::numeric as reserved
from public.availability_reserve r
left join public.savings_purpose p on p.id = r.purpose_id
where r.date <= (select d from cut)
  and r.currency_code in ('ARS', 'USD')
group by r.purpose_id, p.name, p.icon, r.currency_code
$$;

comment on function public.get_purpose_sums(date) is
  'Definición normativa del guardado por (propósito, moneda), cortado a hoy (timezone financiero AR, o p_today). Dos consumidores: el detalle agrupado del drawer y el PISO del write path — volver a usar no puede dejar un propósito en negativo aunque el total cierre. purpose_id NULL es «Sin destino».';

revoke execute on function public.get_purpose_sums(date) from public;
grant  execute on function public.get_purpose_sums(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Self-check — borrar una etiqueta no puede borrar plata
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El equivalente al check de `account_id` que dejó 0057. La regla de borrado del
-- FK es una decisión de producto disfrazada de detalle de schema: si alguien la
-- cambia a CASCADE en una migración futura, borrar un propósito le baja el
-- guardado al usuario en silencio y ninguna suite lo va a notar, porque todas
-- las lecturas seguirían cerrando — con menos plata. Sobre una base limpia las
-- migraciones corren de cero y esto lo frena ahí.

do $check$
declare
  v_rule char;
begin
  select confdeltype into v_rule
  from pg_constraint
  where conrelid = 'public.availability_reserve'::regclass
    and confrelid = 'public.savings_purpose'::regclass
    and contype = 'f';

  if v_rule is null then
    raise exception
      'availability_reserve debería tener un FK a savings_purpose y no lo tiene.';
  end if;

  if v_rule <> 'n' then
    raise exception
      'El FK availability_reserve.purpose_id → savings_purpose tiene regla de borrado "%" y debe ser SET NULL. Borrar un propósito es borrar una ETIQUETA: la plata vuelve a «Sin destino», no desaparece. Ver el comentario de la columna en 0058.',
      v_rule;
  end if;
end
$check$;

commit;
