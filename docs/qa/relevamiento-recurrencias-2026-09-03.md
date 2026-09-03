# Relevamiento completo de Recurrencias

**Fecha:** 3 de septiembre de 2026
**Disparador:** [#96 — Una instancia pendiente sin resolver traba la recurrencia para siempre](https://github.com/CristianPerez06/grana-v3/issues/96), más tres síntomas reportados desde el uso real:

> «tengo recurrencias que no veo, otras que las veo si voy a recurrencias pero no me aparece el aviso, otras que por ejemplo vencen en 20 días, y el pago lo hice hoy y no tengo manera de marcarla hoy como pagada»

Los tres síntomas son reales, y ninguno de los tres es #96. #96 es el cuarto.

Este documento tiene cinco partes: cómo funciona hoy, qué está roto, y las tres tandas de propuestas
pedidas (arreglos, upgrades, UX) más la comparativa con el mercado.

---

## Parte 0 — Cómo funciona hoy

### El modelo

Hay dos entidades y un cursor.

| | Qué es |
|---|---|
| `recurrences` | La **regla**. Monto, cuenta, categoría, intervalo, `start_date`, `end_date`, `max_occurrences`. No es plata. |
| `recurrence_instances` | Una **propuesta** de movimiento para una fecha. `pending` / `confirmed` / `skipped`. Mientras está `pending` no toca saldos, ni resúmenes, ni el gasto del mes. |
| `recurrences.last_generated_date` | El **cursor**: "hasta acá ya está cubierto". Avanza al confirmar y al omitir. Nunca al generar. |

El modelo es **base caja y propuesta+confirmación**: nada es plata hasta que el usuario dice que sí.
Eso está bien y es lo que hace coherente al módulo Compartido (una recurrencia compartida pendiente
no genera deuda en el hogar). El problema no es el modelo. Es todo lo que le falta alrededor.

### El motor

`decideRecurrenceInstance` (`packages/money-logic/src/recurrences.ts`) contesta una sola pregunta por
regla y por corrida: *¿genero una instancia ahora, y para qué fecha?* En orden:

1. ¿Ya hay una pendiente? → **no genero** (`has_pending`).
2. ¿Llegó a `max_occurrences`? → no genero.
3. Próxima fecha = `start_date` si el cursor es null, si no `cursor + intervalo`.
4. ¿Esa fecha es futura? → no genero (`not_due`).
5. ¿Pasó `end_date`? → no genero.

`generateDueRecurrenceInstances` (`packages/recurrences/src/queries.ts`) envuelve eso: trae las
reglas activas, pregunta una vez por regla, inserta **como máximo una instancia por regla por
corrida**.

Y `walkOccurrences` (mismo archivo de money-logic) es el calendario puro: camina desde `start_date`
sumando intervalos, y contesta "las próximas N ocurrencias". Alimenta el "Próximo" del hub y las
cards de "Próximas ocurrencias". **No genera nada.**

### Quién dispara el motor

Esto es lo que más sorprende: **nadie, del lado del servidor.** No hay cron, no hay `pg_cron`, no hay
Edge Function. El generador es un efecto de cliente que corre en cuatro lugares y sólo cuatro:

| Dónde | Cuándo |
|---|---|
| `apps/web/.../transactions-shell.tsx` | al montar `/transactions` |
| `apps/web/.../recurrence-generation-trigger.tsx` | al montar `/transactions/recurring` |
| `packages/recurrences/src/mutations.ts` | eager, al crear una regla |
| `apps/mobile/app/(app)/transactions/recurring/index.tsx` | al enfocar el hub nativo |

La app abre en `/dashboard` (`apps/web/app/page.tsx:4`). **Si entrás y te quedás en el dashboard, no
se materializa nada, nunca.** Y en la app nativa el feed de movimientos *muestra* el bloque de
pendientes pero *no* dispara la generación — sólo el hub lo hace, lo que rompe la paridad web↔mobile
que exige `AGENTS.md`.

### Las superficies

| Superficie | Qué muestra | Dónde vive |
|---|---|---|
| Bloque "Por confirmar" | Instancias `pending` (siempre con fecha ≤ hoy) | `/transactions` y el hub. **No en el dashboard.** |
| Cards "Próximos 7 días" / "Más adelante este mes" | Proyección pura, sin escribir nada | Sólo el hub |
| Tabs Activas / Pausadas / Finalizadas | Las reglas, con su "Próximo" | Sólo el hub |
| "Gastos fijos" en Compromisos | Pendientes + proyección de reglas activas | Dashboard |

---

## Parte 1 — Qué está roto

Doce defectos. Los agrupo por dónde duelen, y marco cuáles producen cada síntoma reportado.

### Motor y generación

**D1 · La generación depende de que entres por la puerta correcta.** *(→ «recurrencias que no veo»)*
Detallado arriba. Una regla puede estar perfecta y no existir en ningún lado porque tu sesión de hoy
fue dashboard → cuentas → salir. No es un bug de código, es una arquitectura que delega el reloj al
navegador del usuario.

**D2 · Una pendiente sin resolver corta la cadena — no la atrasa.** *(#96)*
`decideRecurrenceInstance` paso 1, respaldado por el índice único
`recurrence_instances_one_pending_per_rule` (`0011_recurring_movements.sql`). La intención —no
acumular ítems duplicados— es buena. El efecto no es "se atrasa": es **se corta y no se reanuda
sola**. El caso de producción del ticket (regla cada 3 días, cursor en `2026-06-10`, cero instancias
en julio/agosto/septiembre) es exactamente esto.

**D3 · Recuperar el atraso cuesta un ciclo de navegación por instancia.**
El ticket sospechaba que recuperar 3 meses eran ~30 confirmaciones. Es peor: **son 30 confirmaciones
y 30 recargas.** Después de confirmar, ni web ni mobile vuelven a disparar el generador —
`generationFired = useRef(false)` sólo corre al montar, y `router.refresh()` no remonta el
componente cliente; `revalidateAfterRecurrenceMutation()` revalida rutas RSC pero no genera nada. En
nativo es un blur/focus del hub por instancia. En la práctica la regla está muerta aunque la quieras
recuperar.

**D4 · `max_occurrences` tiene tres respuestas distintas. (verificado)**
La proyección cuenta ocurrencias desde `start_date`; el generador cuenta **filas** en
`recurrence_instances`, y la semilla de una regla creada desde un movimiento no es una fila. Regla
mensual creada desde un movimiento del 10/01 con `max_occurrences = 3`:

```
proyección promete:            2026-02-10, 2026-03-10          → 2 ocurrencias
generador produce:             2026-02-10, 2026-03-10, 2026-04-10 → 3
ocurrencias reales (con semilla): 4
```

Tres números para el mismo campo. Si esto se usó para modelar cuotas, el conteo está mal.

**D5 · Paridad rota: el feed nativo muestra pendientes que nunca genera.**
Web `/transactions` genera; el feed nativo no. Mismo bloque, misma promesa al usuario, distinto
comportamiento. `AGENTS.md` lo prohíbe explícitamente.

### Lo que ves (y lo que no)

**D6 · No hay forma de pagar antes de la fecha.** *(→ «vence en 20 días y lo pagué hoy»)*
`confirmRecurrenceInstance` exige una instancia `pending`, y esa instancia **sólo nace cuando la
fecha llegó** (paso 4: `not_due`). El detalle de la regla ofrece Editar / Pausar / Eliminar
(`recurrence-actions.tsx`) y nada más. El drawer de confirmación sí deja cambiar fecha, monto y
cuenta — pero recién cuando la instancia ya existe.

El workaround disponible hoy —cargar el gasto a mano— es **peor que no hacer nada**: el movimiento
queda sin vincular, la regla sigue creyendo que te debe esa ocurrencia, y en 20 días te la va a
proponer igual. O la contás dos veces, o la omitís a mano y perdés el rastro.

**D7 · El aviso vive en una sola ruta y se esconde justo cuando más hace falta.** *(→ «no me aparece el aviso»)*
Tres cosas apiladas:
- El bloque sólo se monta en `/transactions` y en el hub. **El dashboard —la pantalla que abre la app— no tiene nada.**
- Arranca **plegado** cuando hay 2 o más pendientes: `useState(pending.length <= 1)`. Cuantas más cosas debés, más escondido está el aviso.
- No hay badge en la navegación (`components/layout/` no tiene ninguno), no hay push, no hay mail.

**D8 · "Próximas ocurrencias" se corta a fin de mes y la ventana se achica sola.**
Los dos buckets son `[hoy, hoy+7]` y `[hoy+8, fin de mes]`. El 25 de septiembre el segundo bucket
arranca el 3 de octubre y termina el 30 de septiembre: **está vacío por definición**. Una regla que
vence el 10 de octubre no aparece en ninguna de las dos cards. Del día ~24 en adelante, el horizonte
del hub son 7 días y nada más.

**D9 · El hub muestra un "Próximo" que el motor no va a honrar.**
`next_occurrence` se calcula con el calendario puro: la próxima fecha ≥ hoy y > cursor. Para una
regla trabada por D2, el hub dice "Próximo: 4 sep" mientras el generador, cuando por fin se
destrabe, va a producir el 13 de junio. La pantalla afirma una fecha que el motor tiene decidido
ignorar. (El informe de agosto arregló la familia de este bug unificando en `walkOccurrences`; lo
que quedó vivo es esta divergencia, que es consecuencia directa de D2.)

**D10 · Una regla pausada te sigue pidiendo confirmación.**
`pauseRecurrence` deja la instancia pendiente viva a propósito (está documentado), pero
`getPendingRecurrenceInstances` no filtra por estado de la regla ni la marca. Pausás algo y te sigue
apareciendo en "por confirmar", sin decir que está pausado.

**D11 · No podés decir "esto ya lo cargué a mano".**
Las dos únicas salidas de una instancia son confirmar (crea un movimiento nuevo) u omitir (no crea
nada). No existe "vincular a un movimiento existente". Es la otra mitad de D6.

### Contabilidad

**D12 · Los meses cerrados leen $0 y no se arreglan solos.**
Está documentado como KNOWN GAP en `packages/dashboard/src/queries.ts:615`: una regla trabada en
julio no generó nada en agosto ni septiembre, y esos meses leen "sin gastos fijos". **Arreglar #2 no
repara el pasado**: bajo el lente `snapshot`, un mes cerrado es un registro reconstruido a partir de
lo que se materializó entonces, y no se materializó nada. Re-proyectar las reglas de hoy sobre un
mes viejo usaría los montos de hoy, perdería las reglas retiradas e inventaría las creadas después.

---

## Parte 2 — Arreglos de funcionalidad

### A · Cambiar el invariante: de "una pendiente por regla" a "una por (regla, fecha)"

Es el arreglo de fondo, y es más chico de lo que parece. El invariante que de verdad importa —el que
evita duplicados— es que no haya dos instancias para la **misma ocurrencia**. "Una pendiente por
regla" es una aproximación grosera de eso que además rompe el calendario.

```sql
drop index recurrence_instances_one_pending_per_rule;
create unique index recurrence_instances_one_pending_per_rule_date
  on public.recurrence_instances (recurrence_id, scheduled_date)
  where status = 'pending';
```

Y el generador pasa de "preguntar una vez" a "caminar el calendario desde el cursor hasta hoy",
usando el `walkOccurrences` que ya existe, con un tope de backlog (`RECURRENCE_MAX_BACKLOG`, propongo
**12**) y `end_date`/`max_occurrences` respetados como siempre. `decideRecurrenceInstance` deja de
tener el parámetro `hasPending` y pasa a devolver una **lista** de fechas.

Esto arregla D2, D3 y D9 de una sola vez: con el backlog materializado, el "Próximo" del calendario
y lo que el motor va a hacer vuelven a ser lo mismo, sin código extra.

**Decisión abierta:** qué pasa cuando el backlog supera el tope. Propongo colapsar el excedente en
una fila agrupada ("12 ocurrencias anteriores sin resolver") con una sola acción, en vez de
materializar 90 filas de una regla diaria abandonada.

### B · "Ponerse al día" como una acción, no como 30

Con el backlog acumulado hace falta resolverlo en bloque: seleccionar todas / confirmar todas /
omitir todas, con preview del impacto ("vas a crear 6 gastos por $15.000 total; el saldo de Santander
queda en $X"). Hoy no existe nada equivalente y es lo que vuelve inservible la recuperación.

### C · "Registrar ahora" — adelantar una ocurrencia (arregla D6)

En el detalle de la regla y en la fila del hub, una acción que **materializa la próxima ocurrencia
aunque falte** y abre el mismo drawer de confirmación, con la fecha por defecto en hoy y editable.

Un detalle importante de diseño: el **cursor avanza a la fecha programada original, no a hoy**. Si
la regla vence el 23 y pagás el 3, la siguiente sigue siendo el 23 del mes que viene. El ritmo de la
regla no se desplaza porque pagaste antes. (La lógica ya existe: `confirmRecurrenceInstance` usa
`instance.scheduled_date` y no la override para el cursor.)

Es literalmente el "Enter Now" de YNAB y el "marcar como pagado" de Mobills. Es el arreglo con mejor
relación valor/esfuerzo de toda la lista.

### D · Mover la generación al servidor

Tres opciones, de menos a más:

| | Qué | Arregla | Costo |
|---|---|---|---|
| D-1 | Subir el trigger al layout `(app)` (web) y agregarlo al feed nativo | D1 parcial, D5 | Trivial |
| D-2 | Un RPC `generate_due_recurrence_instances()` que el cliente llama una vez por sesión | D1 parcial, D5 | Bajo |
| D-3 | `pg_cron` diario + función `SECURITY DEFINER` que corre para todos los usuarios | D1 completo | Medio |

**Recomiendo D-1 ahora (es media hora y tapa el 90% del síntoma) y D-3 después**, porque D-3 es la
única que hace que el dato sea correcto sin que el usuario tenga que pasar por una puerta — y es
condición necesaria para cualquier aviso por push o mail, y para que las recurrencias compartidas del
hogar se materialicen sin depender de qué miembro abrió la app.

### E · Una sola definición de `max_occurrences` (arregla D4)

El generador tiene que preguntarle al calendario cuántas ocurrencias van, no contar filas. Decisión
de producto a tomar de paso: **¿la semilla cuenta?** Propongo que sí (`max_occurrences = 3` en una
regla creada desde un movimiento ⇒ el movimiento original más 2 instancias), porque es lo que
significa "3 cuotas" para cualquiera. Hay que decidirlo y escribirlo en el spec, porque hoy el campo
no significa nada verificable.

### F · Regla pausada, aviso pausado (arregla D10)

O el pendiente de una regla pausada no aparece en "Por confirmar", o aparece con un sello "Pausada".
Prefiero lo segundo: esconderlo perdería una instancia que el usuario todavía puede querer resolver.

### G · Ampliar la ventana de "Próximas" (arregla D8)

Bucket 2 pasa de "resto del mes" a **"próximos 30 días"**, o directamente a un tercer bucket "mes que
viene". La regla de negocio real es "lo que se viene", no "lo que cabe en el mes calendario".

---

## Parte 3 — Upgrades de funcionalidad

Ordenados por cuánto pesan en el contexto argentino.

**U1 · Monto variable / estimado.** Hoy `amount` es fijo y, al confirmar con otro monto, D6 lo
propaga a la regla — así que la luz reescribe la regla todos los meses. Propongo
`amount_mode: 'fixed' | 'estimated'`: en `estimated` el monto es una referencia para proyectar, no se
propaga, y la instancia pide el monto real al confirmar. Es el caso de luz, gas, agua, celular,
tarjeta: la mitad de los gastos fijos de cualquiera.

**U2 · Ajuste automático del monto.** El upgrade más argentino de la lista.
`adjustment: none | percentage | index | usd_linked` + `adjustment_period`. Un alquiler que ajusta
cada 3 meses por ICL o IPC, una cuota que sube 8% por trimestre, un servicio en USD. Hoy hay que
editar la regla a mano cada vez, y si te olvidás, la proyección del dashboard queda vieja y sigue
mostrando el número del año pasado con cara de certeza. Ninguna app internacional resuelve esto
porque en sus mercados no hace falta.

**U3 · Débito automático → auto-confirmación.** `auto_confirm: true` en reglas donde la plata sale
sí o sí (débito en cuenta, débito en tarjeta). Al llegar la fecha, la instancia se confirma sola y
notifica en vez de preguntar. Esto elimina la mayor fuente de fricción y de instancias trabadas:
nadie quiere confirmarle a mano a la app algo que el banco ya hizo. Ojo con el orden: **esto sólo se
puede construir después de D-3** (generación en servidor).

**U4 · Vincular un movimiento existente a una instancia** (arregla D11). "Esto que cargué el martes
es el alquiler de septiembre" → la instancia queda `confirmed`, `confirmed_transaction_id` apunta al
movimiento que ya existía, el cursor avanza, no se crea nada nuevo. Es la reconciliación mínima y
elimina el doble conteo.

**U5 · Recordatorio con anticipación por regla.** `notify_days_before` (0 = el día, 3 = tres días
antes). El alquiler quiere 5 días; Netflix, cero.

**U6 · Historial de montos.** Un sparkline en el detalle: "el alquiler pasó de $450.000 a $520.000 a
$610.000". El dato ya existe en las instancias confirmadas; sólo falta dibujarlo. Con inflación es
información de verdad, no decoración.

**U7 · Proyección a 12 meses.** Hoy el horizonte es el mes. "¿Cuánto tengo comprometido de acá a
fin de año?" es una pregunta que el modelo ya puede contestar (`walkOccurrences` con `MAX_WALK_STEPS`
de 750 pasos) y ninguna pantalla hace.

**U8 · Pausa con fecha.** "Pausar hasta marzo" en vez de pausar y acordarse. Vacaciones, servicios
estacionales, la cuota del club en verano.

---

## Parte 4 — Mejoras orientadas al uso

Estas no agregan features: cambian dónde y cómo aparece lo que ya existe. Son las que más van a mover
la sensación de "esto no me cierra".

**X1 · El pendiente sube al dashboard.** El aviso tiene que estar en la pantalla que abre la app, no
a dos toques de distancia. Una tira arriba de todo, con el conteo y el monto: "3 recurrencias por
confirmar · $87.400". Es el arreglo de D7 con más impacto.

**X2 · Invertir la lógica de plegado.** Hoy: 1 pendiente ⇒ abierto, 5 pendientes ⇒ cerrado. Tiene
que ser al revés, o mejor: **abierto siempre que haya algo vencido**, plegado si todo lo pendiente
vence en el futuro.

**X3 · Badge en la navegación.** El número de vencidos en el ítem de Movimientos, en web y en el
tab bar nativo. Es la señal que hace que el usuario sepa que tiene que entrar.

**X4 · Que la fila diga qué va a pasar antes de tocar.** Hoy el botón dice "Confirmar" y el usuario
no sabe si eso mueve el saldo de hoy o el de junio. Debería decir:
«Confirmar → crea un gasto de $45.000 con fecha 13/06 en Santander». La fecha pasada es
especialmente importante porque cambia meses ya cerrados.

**X5 · Decir cuando algo está trabado, en vez de callarse.** Si una regla lleva dos períodos sin
resolverse, la app tiene que decirlo con todas las letras: «Esta recurrencia está trabada desde el 10
de junio. Hay 27 ocurrencias sin registrar.» El silencio es lo que convirtió #96 en un bug de tres
meses en vez de una molestia de tres días.

**X6 · Vista calendario del mes.** Una grilla con las ocurrencias marcadas contesta "¿qué me queda
por pagar este mes?" mucho mejor que dos listas. Es la vista que Mobills usa como pantalla principal
de gastos fijos.

**X7 · Copy honesto en la fila futura.** «Vence en 20 días» acompañado de un botón secundario «Ya lo
pagué» — que es exactamente el arreglo C, expuesto donde el usuario tiene el problema.

**X8 · Separar "vencido" de "por vencer" visualmente.** El label de urgencia ya existe
(`pending.overdue` / `due_today` / `due_in`), pero vive adentro de un bloque plegado. Vencido debería
tener su propio tratamiento y su propio orden.

**X9 · Distinguir la fila de un movimiento futuro en el listado.** Quedó pendiente del informe de
agosto y sigue abierto.

---

## Parte 5 — Comparativa con el mercado

El panorama argentino real tiene tres capas: las apps dedicadas de control de gastos
(Mobills, Money Manager, Monefy, Spendee, Wallet), las billeteras que hacen control de gastos como
subproducto (Mercado Pago, Ualá, Naranja X), las apps internacionales de presupuesto (YNAB, Monarch),
y —sin ironía— **Excel y Google Sheets, que siguen siendo el competidor más grande**.

### Cómo resuelve cada una la recurrencia

| | Modelo | ¿Se acumula el atraso? | ¿Pagar antes? | Aviso | Ajuste por inflación |
|---|---|---|---|---|---|
| **Grana hoy** | Propuesta + confirmación | **No — se corta** | **No** | Bloque en una ruta interna | No |
| **Grana propuesto** | Propuesta + confirmación | Sí, acotado | Sí ("Registrar ahora") | Dashboard + badge + push | Sí (U2) |
| **Mobills** | Cuenta fija con estado (pendiente/pagado) | Sí, se apilan | **Sí** — marcar como pagado | Push + mail de vencimiento | No |
| **YNAB** | Transacción programada, **auto-postea** | Sí, entran todas y quedan sin aprobar | **Sí** — "Enter Now" | En el registro | No |
| **Money Manager / Monefy** | Auto-inserción al llegar la fecha | Sí, se insertan solas | Parcial | Notificación local | No |
| **Wallet (BudgetBakers)** | Plantilla recurrente | Sí | Sí | Push | No |
| **MP / Ualá / Naranja X** | Débito automático real | N/A — la plata sale | N/A | **Push, lo mejor del mercado** | N/A |
| **Excel** | Vos | Vos | Vos | No | Vos, y por eso funciona |

### Lo que se lee de la tabla

**El modelo de Grana no es el problema.** Propuesta+confirmación es *más* conservador que el
auto-posteo de YNAB o Monefy, y es lo correcto para un contexto donde el débito automático no es
universal y donde el módulo Compartido necesita base caja para que la deuda del hogar sea real. La
apuesta es defendible.

**Lo que falta son las dos válvulas de escape que todas las demás tienen.** Mobills tiene "marcar
como pagado", YNAB tiene "Enter Now" — las dos son la misma idea: *el calendario propone, el usuario
dispone, en cualquier momento*. Grana propone y después no te deja disponer hasta que el calendario
le dé permiso. Esa es la queja del usuario, textual, y es un agujero que ninguna competidora tiene.

**En avisos perdemos contra las billeteras y no hay vuelta.** MP y Ualá te pushean. Mobills manda
mail. Grana tiene un bloque plegado en una ruta que no es la landing. Esto es X1+X3+D-3.

**En inflación no hay competencia — el campo está vacío.** Ninguna app internacional ajusta montos
por índice, porque en sus mercados no hace falta. Un alquiler que se ajusta solo por ICL, o una regla
en USD que proyecta a la cotización de hoy, es una feature que **sólo tiene sentido acá** y que
ninguna de las apps de la tabla ofrece. Si Grana quiere un diferencial real frente a Mobills, U2 es
ese diferencial, no una pantalla más linda.

**Y donde ya ganamos, conviene no perderlo:** bimoneda de verdad, gasto compartido con hogar,
resúmenes de tarjeta reales con período y vencimiento, y detección de patrones para sugerir
recurrencias. Nada de la tabla hace esas cuatro cosas bien para Argentina.

---

## Recomendación de orden

**Tanda 1 — parar la hemorragia** (arregla los tres síntomas reportados y #96)
`A` invariante por (regla, fecha) · `B` ponerse al día · `C` registrar ahora · `D-1` generar en el
layout y en el feed nativo · `X1` pendiente en el dashboard · `X2` plegado invertido

**Tanda 2 — que el dato deje de mentir**
`E` `max_occurrences` · `F` pausada · `G` ventana de próximas · `X4` decir qué va a pasar ·
`X5` avisar cuando algo está trabado · `U4` vincular movimiento existente

**Tanda 3 — que la app trabaje sola**
`D-3` `pg_cron` · `U3` auto-confirmación · `U5` recordatorios · `X3` badge

**Tanda 4 — el diferencial**
`U1` monto variable · `U2` ajuste por índice · `U6` historial · `U7` proyección a 12 meses

---

## Dos decisiones que no puedo tomar solo

1. **¿Se relaja el invariante "una sola pendiente por regla"?** Está escrito en el spec de
   `transactions` (requirement "El sistema genera instancias recurrentes de forma secuencial",
   escenario "Usuario vuelve después de varios meses"). Mi recomendación es reemplazarlo por "una por
   (regla, fecha)" con backlog acotado — pero eso **modifica una requirement existente**, no agrega
   una, y hay que escribirlo como `## MODIFIED Requirements` en el change de OpenSpec.

2. **¿Se hace backfill de los meses cerrados?** Mi recomendación es **no reconstruir**: re-proyectar
   con los montos de hoy sería inventar un pasado. En cambio, marcar explícitamente los meses
   afectados como incompletos ("faltan datos de recurrencias en este período") es honesto y barato.
   La alternativa —materializar el backlog con fechas viejas y dejar que el usuario confirme— sí
   repara el pasado, pero mueve saldos históricos y hay que quererlo a propósito.

---

## Fuentes de la comparativa

- [Scheduled Transactions in YNAB: A Guide](https://support.ynab.com/en_us/scheduled-transactions-a-guide-BygrAIFA9)
- [Mobills — Control de Gastos para tus Finanzas Personales](https://www.mobillsapp.com/es)
- [Con esta app puedes controlar todos tus gastos fijos de un solo vistazo (Xataka Móvil)](https://www.xatakamovil.com/aplicaciones/esta-app-puedes-controlar-todos-tus-gastos-fijos-solo-vistazo)
- [Las mejores apps de finanzas personales en Argentina 2026 (Segundo Enfoque)](https://segundoenfoque.com/las-mejores-apps-de-finanzas-personales-en-argentina-2026-cuales-usar-y-para-que)
- [Las cuatro apps para ordenar tus finanzas (El Cronista)](https://www.cronista.com/infotechnology/finanzas-digitales/las-cuatro-apps-para-ordenar-tus-finanzas-se-anotan-los-gastos-dia-por-dia-y-te-ensenan-a-ahorrar/)

## Referencias del código

- `packages/money-logic/src/recurrences.ts` — `decideRecurrenceInstance`, `walkOccurrences`, `getNextExpectedOccurrence`
- `packages/recurrences/src/queries.ts` — `generateDueRecurrenceInstances`
- `packages/recurrences/src/mutations.ts` — `confirmRecurrenceInstance`, `skipRecurrenceInstance`, `pauseRecurrence`
- `supabase/migrations/0011_recurring_movements.sql` — el índice único
- `supabase/migrations/0053_recurrence_integrity.sql` — reparaciones previas de integridad
- `packages/dashboard/src/queries.ts:615` — el KNOWN GAP de los meses cerrados
- `docs/qa/informe-recurrencias-2026-08-04.md` — los cuatro bugs anteriores
