# Informe: 4 bugs en Recurrencias

**Fecha:** 4 de agosto de 2026
**Change asociado:** `openspec/changes/fix-recurrence-projection-and-orphans/`

---

## Cómo aparecieron

Todo salió de una observación simple: en el listado de movimientos aparecían gastos con fecha
futura (el más lejano, 20 días adelante). Tirando de ese hilo encontramos que en el hub de
Recurrencias las cards "Próximos 7 días" y "Más adelante este mes" mostraban filas repetidas
—$1.500.000 y $270.000 dos veces cada una—.

No era un problema de cómo se dibuja la pantalla. Era una mezcla de **cuatro defectos distintos**,
tres de código y uno de datos que el código venía produciendo en silencio.

Aclaración sobre los movimientos con fecha futura: **eso está bien y no se toca.** Las specs lo
decidieron a propósito dos veces (los changes `exclude-future-dated-from-balance` y
`cut-month-lenses-at-today`). Un movimiento futuro se ve en el listado pero no suma al saldo ni a
los totales del mes hasta que llega su fecha. Lo único que falta ahí es que la fila se distinga
visualmente como futura, y eso queda para otro change.

---

## Bug 1 — El hub mostraba gastos que ya estaban cargados

### Qué pasa

Cada recurrencia tiene una marca interna de "hasta acá ya generé". Hay dos funciones que calculan
"cuándo toca la próxima vez": una respeta esa marca (y hasta explica en un comentario por qué hay
que respetarla), y la otra la ignora y cuenta desde el principio.

Las cards de próximas ocurrencias usaban la que la ignora.

### Qué causaba

- Si cargabas un gasto y le activabas "Recurrente", **ese mismo gasto aparecía anunciado como
  "próximo a venir"**, cuando en realidad ya lo habías registrado.
- Las reglas rotas por el Bug 2 mostraban una fecha que el sistema nunca iba a generar.

### Por qué importa más allá del síntoma

Que dos funciones del mismo archivo contesten distinto a la misma pregunta es el defecto de fondo.
Si solo le agregamos el dato que le falta a una, quedan dos implementaciones vivas y el próximo
criterio que se agregue las vuelve a separar.

---

## Bug 2 — Borrar un movimiento rompía su recurrencia, sin avisar

### Qué pasa

Cuando creás una recurrencia desde un movimiento, la regla queda apuntando a ese movimiento. Si
después borrás el movimiento, la base **borra el vínculo pero deja la regla viva**, y ningún aviso
aparece en pantalla.

### Qué causaba

Depende de la fecha del movimiento borrado:

| Situación | Consecuencia | Cuántas hay |
|---|---|---|
| La regla ya venía generando normalmente | Solo se pierde el rastro de dónde salió. No afecta el funcionamiento | 8 |
| El movimiento borrado tenía **fecha futura** | La regla cree que ya cubrió ese período con un movimiento que ya no existe → **se saltea el período entero** y no genera nada hasta el siguiente | 2 |

En total **10 reglas huérfanas repartidas entre los 4 usuarios de la app**. Las 2 rotas de verdad
son de Cristian, del 31 de julio.

### El caso concreto que disparó todo

1. El 31 de julio se cargaron dos movimientos con fecha 7 de agosto y "Recurrente" activado.
2. En ese momento la app todavía creaba un movimiento real con fecha futura (eso ya se corrigió en
   otro change). Esos eran los movimientos "20 días adelante" del listado.
3. El 4 de agosto se borraron esos movimientos, creyendo que eso eliminaba la recurrencia.
4. Las reglas sobrevivieron, invisibles y rotas.
5. Se crearon reglas nuevas para reemplazarlas → **todo duplicado en el hub**.

---

## Bug 3 — Una regla dice "Semanal" pero corre mensual

### Qué pasa

Cada regla guarda la frecuencia dos veces: la etiqueta que se muestra ("Mensual", "Semanal") y el
intervalo real que usa el motor. Nada garantizaba que coincidieran.

### Qué causaba

Hay **una regla que muestra "Semanal" en pantalla y en realidad se ejecuta una vez por mes**. La
etiqueta miente; el comportamiento real es el mensual.

Julieta, esta es tuya (la de $9.227,90). No cambió nunca de comportamiento — siempre corrió
mensual. Lo que estaba mal es el cartelito. Si la querías semanal, hay que editarla.

---

## Bug 4 — Nada frena crear una regla que ya existe

### Qué pasa

Se pueden crear dos recurrencias idénticas y la app no dice nada.

### Qué causaba

Cada duplicado dibuja su propia fila en el hub, así que todo se ve doble.

| Usuario | Situación |
|---|---|
| Cristian | 4 pares duplicados |
| Azul | ALQUILER dos veces y EXPENSAS dos veces, creadas con minutos de diferencia en junio |
| Marcelo | Dos reglas de USD 20 en la misma tarjeta — **no son duplicados**: son "chat gpt" y "claude" |

El caso de Marcelo es importante: muestra que dos reglas con el mismo monto, la misma cuenta y el
mismo tipo pueden ser perfectamente legítimas. Por eso el aviso que vamos a agregar **no puede
bloquear**, solo avisar.

---

## Qué vamos a hacer

### En el código (alto nivel)

| # | Cambio | Efecto |
|---|---|---|
| 1 | **Un solo calculador de calendario.** Las dos funciones que hoy compiten pasan a ser dos formas de preguntarle a la misma pieza | Imposible que la pantalla y el motor se contradigan. Se agrega un test que verifica que coinciden |
| 2 | **La base rechaza borrar un movimiento que creó una recurrencia.** La app pregunta antes: ¿borro también la regla, o la dejo viva y solo la desvinculo? | Nunca más una regla huérfana en silencio. Aplica a web, mobile y a cualquier consulta manual |
| 3 | **La base impide guardar una etiqueta de frecuencia que no coincida con el intervalo real** | El cartelito no puede volver a mentir |
| 4 | **Aviso al crear una regla parecida a una existente** (misma cuenta, moneda, tipo y monto), mostrando cuál es. Nunca bloquea | Se corta el problema en el origen. El hub además marca las duplicadas que ya existen |

**Costo consciente del punto 2:** borrar un movimiento que creó una recurrencia pasa a ser una
operación de dos pasos. Es a propósito: preferimos ese click extra a que se rompa algo sin que
nadie se entere. La opción "conservar la regla, desvincular" es un solo click y deja todo sano.

### En la base de datos (migración automática, corre sola al desplegar)

Cuatro pasos en este orden:

```sql
-- 1. Corregir las etiquetas de frecuencia que no coinciden con su intervalo real.
--    No cambia cuándo dispara ninguna regla: solo deja de mentir la etiqueta.
update public.recurrences
   set frequency = case
         when interval_count = 1 and interval_unit = 'week'  then 'weekly'
         when interval_count = 2 and interval_unit = 'week'  then 'biweekly'
         when interval_count = 1 and interval_unit = 'month' then 'monthly'
         when interval_count = 1 and interval_unit = 'year'  then 'annual'
         else 'custom'
       end
 where frequency <> 'custom'
   and not (
         (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
      or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
      or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
      or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
   );

-- 2. Impedir que vuelva a pasar.
alter table public.recurrences
  add constraint recurrences_frequency_matches_interval check (
    frequency = 'custom'
    or (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
    or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
    or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
    or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
  );

-- 3. Reparar SOLO las reglas rotas de verdad: las que dicen haber cubierto una
--    fecha futura con un movimiento que ya no existe. Al ponerlas en NULL, el
--    sistema vuelve a proponer esa ocurrencia y pasa por el gate de aprobación.
update public.recurrences
   set last_generated_date = null
 where status = 'active'
   and created_from_transaction_id is null
   and last_generated_date is not null
   and last_generated_date = start_date
   and last_generated_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date;

-- 4. Que la base rechace borrar un movimiento que creó una recurrencia.
alter table public.recurrences
  drop constraint recurrences_created_from_transaction_id_fkey,
  add  constraint recurrences_created_from_transaction_id_fkey
       foreign key (created_from_transaction_id)
       references public.transactions(id)
       on delete restrict;
```

**Por qué el paso 3 es tan restrictivo.** Solo repara las reglas cuya fecha pendiente es **futura**.
Las que quedaron huérfanas con fecha pasada se dejan como están: si las "reparáramos", el sistema
propondría re-crear un movimiento que el usuario borró a propósito. Sería peor que el bug.

### Limpieza manual de duplicados (una sola vez, por usuario)

Esto **no** va en la migración. Elegir cuál de dos reglas duplicadas sobrevive es una decisión de
quien la creó, no del código: cuál categoría es la correcta, si el vencimiento es el día 5 o el 21.
Una migración que lo decida por regla automática se equivocaría con la mitad.

Para ver los grupos duplicados de cada usuario:

```sql
select p.email, r.amount, r.currency_code, r.movement_type, a.name as cuenta,
       count(*) as reglas,
       array_agg(coalesce(nullif(trim(r.description), ''), '(sin título)')
                 order by r.created_at) as titulos,
       array_agg(r.start_date order by r.created_at) as fechas_inicio,
       array_agg(r.id         order by r.created_at) as ids
from public.recurrences r
join public.profiles p      on p.id = r.user_id
left join public.accounts a on a.id = r.account_id
where r.status = 'active'
group by p.email, r.user_id, r.amount, r.currency_code, r.movement_type, r.account_id, a.name
having count(*) > 1
order by p.email, r.amount desc;
```

Y para dar de baja las que sobran, una vez elegidas:

```sql
begin;

update public.recurrences
   set status = 'deleted'
 where id = any (array['<id-1>','<id-2>']::uuid[])
   and user_id = (select id from public.profiles where email = '<email>');

delete from public.recurrence_instances
 where recurrence_id = any (array['<id-1>','<id-2>']::uuid[])
   and user_id = (select id from public.profiles where email = '<email>')
   and status = 'pending';

commit;
```

⚠️ **Los dos comandos van juntos, siempre.** La regla se da de baja lógicamente (nunca se borra
físicamente, para no romper el historial de los movimientos que ya generó), pero si no se borran
además sus propuestas pendientes, quedan flotando en "por confirmar" apuntando a una regla que ya
no existe en ninguna lista — y se pueden confirmar, creando movimientos reales.

---

## Lo que NO vamos a hacer, y por qué

- **No borramos duplicados por migración.** Es data de cada persona y la decisión correcta la sabe
  quien la creó.
- **No reparamos las reglas huérfanas "benignas".** Funcionan bien; lo único que perdieron es el
  rastro de qué movimiento las originó, y ese movimiento ya no existe: no hay nada que restaurar.
- **No ocultamos los movimientos con fecha futura del listado.** Está decidido en las specs y es
  correcto: existen, se ven, y no cuentan hasta que llega su fecha.
- **No tocamos el vínculo de las instancias ya confirmadas** con su movimiento, que tiene un
  problema parecido pero más leve. Si molesta, es un change aparte.

---

## Estado

El change ya está escrito y validado en `openspec/changes/fix-recurrence-projection-and-orphans/`
(propuesta, diseño técnico, specs con 30 escenarios de prueba, y 30 tareas de implementación).
Falta implementarlo.

Antes de tocar el esquema se verifica un riesgo: que la regla nueva del paso 4 no bloquee ningún
borrado legítimo. Ya lo revisamos contra el esquema y no ocurre —una cuenta solo se puede eliminar
si nunca tuvo movimientos, y las cuotas de una compra nunca son origen de una recurrencia— pero
queda como tarea de verificación explícita, no como suposición.
