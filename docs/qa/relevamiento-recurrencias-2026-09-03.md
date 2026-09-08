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

### Tres defectos que aparecieron al revisar la propuesta de arreglo

Se encontraron mirando el diseño del arreglo, no la app — pero **no son todos futuros**, y una
versión anterior de esta sección los presentaba a los tres como latentes, contradiciendo su propio
contenido:

| | ¿Pasa hoy? |
|---|---|
| **D13** cursor que retrocede | **No.** Hoy sólo hay una pendiente y siempre se resuelve en orden. Se vuelve real en el momento en que se permite backlog. |
| **D14** se pierde el vencimiento original | **Sí.** Ocurre cada vez que alguien cambia la fecha al confirmar. Hoy pasa desapercibido; con backlog además rompe la identidad. |
| **D15** compromiso contado dos veces | **Sí.** Es plata mal mostrada ahora mismo, y no depende de nada de esto. |

**D13 · El cursor puede retroceder si resolvés fuera de orden. (verificado)**
Tanto confirmar como omitir escriben `last_generated_date = instance.scheduled_date`
**incondicionalmente** (`mutations.ts:443` y `:500`). Con una sola pendiente por vez eso es correcto,
porque siempre se resuelve la más vieja. Con backlog no: si Julieta registra el alquiler de agosto y
después el de julio, el cursor va de agosto **para atrás** a julio, y el generador puede volver a
proponer agosto. Es decir: la solución al #96, mal implementada, fabrica duplicados.

La consecuencia de diseño es que **el avance de la generación tiene que dejar de ser un efecto de
resolver un pago**. Son dos cosas distintas y hoy están pegadas.

**D14 · Confirmar borra el vencimiento original. (verificado)**
`confirmRecurrenceInstance` escribe `scheduled_date: effective.scheduled_date`
(`mutations.ts:415`), o sea la fecha que el usuario eligió al confirmar. La instancia **pierde para
siempre** el vencimiento que le dio origen. Hoy casi no molesta; con backlog rompe dos cosas a la
vez: no se puede usar la fecha como identidad de la ocurrencia, y el historial no puede contestar
"¿qué vencimiento pagué el 3 de septiembre?".

Por eso una ocurrencia necesita **vencimiento previsto** y **fecha de pago** como dos campos
separados. Es la base de todo lo demás y va primero.

**D15 · El dashboard cuenta dos veces la misma recurrencia. (verificado numéricamente)**
Este no es latente: **está pasando hoy** y es un error de plata a la vista. "Gastos fijos" suma dos
fuentes —las instancias materializadas de la ventana y la proyección de las reglas activas— y el
comentario del código afirma que *«the two never overlap»*. Se contradice con el contrato de
`walkOccurrences`, que dice lo opuesto con todas las letras: una pendiente **no** mueve el cursor,
así que su fecha **se sigue emitiendo** en la proyección.

Reproducido: hoy 08/09, el navegador en agosto (⇒ ventana septiembre), una regla mensual de $100.000
del día 5 con su instancia pendiente ya generada. `generatedExpenses` aporta $100.000, la proyección
aporta otros $100.000 → **"Gastos fijos" muestra $200.000 para una regla que vale $100.000.**

Alcance exacto, que importa: bajo el lente `live` no puede pasar —la ventana es el mes **siguiente**
al seleccionado y una pendiente siempre está fechada hoy o antes—, así que se manifiesta en la
posición "mes anterior" del navegador. Merece su propio ticket: es independiente del #96 y no espera
a nada de esto.

---

## Parte 2 — Arreglos de funcionalidad

Esta parte está escrita para decidir, no para implementar. Cada arreglo dice **qué pasa hoy**, **qué
pasaría después**, **qué vas a ver distinto en la pantalla** y, cuando corresponde, **qué tenés que
decidir vos**. El detalle técnico de cada uno vive al final de la sección, en "Cómo se hace".

Para que se entienda, un solo ejemplo que atraviesa todo:

> Julieta tiene el alquiler cargado como recurrencia: **$450.000, todos los 23**. La instancia de
> junio le apareció, no la confirmó —estaba de viaje— y nunca más la tocó. Hoy es 3 de septiembre.

---

### A · Que el atraso se acumule, en vez de cortar la recurrencia

**Hoy.** Julieta tiene una sola cosa pendiente: el alquiler del 23 de junio. Julio y agosto **no
existen** en la app. No están pendientes, no están pagos, no están omitidos: no están. Si mira el
mes de julio, sus gastos fijos dan $0. Y mientras no toque la de junio, esto no se destraba nunca.

**Después.** Julieta ve tres cosas pendientes: alquiler de junio, de julio y de agosto. La cadena
sigue corriendo aunque ella no conteste.

**Qué va a ver distinto.** Más pendientes que hoy. Esto es importante y conviene decirlo sin
maquillaje: **el arreglo hace que la app se vea más "cargada", no menos.** Hoy se ve prolija porque
está escondiendo trabajo sin hacer. La sensación de "uf, tengo 8 cosas" es el dato real apareciendo,
no una regresión.

**El tope.** Si en vez del alquiler fuera algo diario abandonado hace tres meses, serían 90 filas.
Por eso propongo cortar en un número (12) y que el resto se muestre agrupado en una sola línea:
*"y 78 ocurrencias anteriores"*, con una sola acción para resolverlas.

**El "12" no es una decisión tuya, y una versión anterior de este documento te la pasaba mal.**
Confundía tres cosas que hay que separar:

| | Qué es | Quién decide |
|---|---|---|
| Tamaño de tanda | De a cuántas procesa el generador por corrida | Implementación |
| Tope visual | Cuántas se muestran antes de agrupar el resto | Diseño, se prueba en pantalla |
| Alcance del modelo | Cuántas ocurrencias la app **reconoce que existen** | **Ninguna se pierde. No es negociable.** |

El error de la versión anterior era usar 12 como límite de lo que la app reconoce. Si Julieta tiene
90 atrasos y el generador toma "las 12 más viejas", **la de este mes no se genera** — que es
exactamente el bug #96 otra vez, con otro número. Sea cual sea la tanda, la ocurrencia vigente
siempre entra, y a todas las anteriores se llega desde el grupo.

**Lo que sí tenés que decidir:** si una regla arrancó en 2024 y nunca se usó, ¿le mostramos todo el
historial o cortamos en algún punto razonable hacia atrás?

---

### B · Poder resolver el atraso de una vez

**Hoy.** No aplica, porque hoy el atraso no existe (ver A). Pero apenas exista, resolverlo de a una
sería insoportable: hoy incluso confirmar dos seguidas requiere recargar la página entre medio.

**Después.** Un botón "Ponerse al día" que resuelve el grupo entero: confirmar todas, omitir todas, o
elegir cuáles.

**Qué va a ver distinto.** Antes de aplicar, un resumen del impacto:
*"Vas a registrar 3 gastos por $1.350.000 en total. El saldo de Santander pasa de $X a $Y."*

**La pregunta correcta no es "¿qué fecha usamos?".** Una versión anterior de este documento la
planteaba como una política a elegir —vencimiento vs. hoy— y estaba mal planteada: son dos hechos
distintos, no dos opciones. El vencimiento es del alquiler; la fecha de pago es de Julieta. La app
tiene que guardar los dos y **preguntarle cuándo pagó**, no adivinarlo con una regla general.

| Lo que realmente pasó | Qué tiene que hacer Grana |
|---|---|
| Pagó el 23/06 y recién lo carga en septiembre | Registrar el pago el **23/06**. Junio se corrige, y está bien que se corrija. |
| Vencía el 23/06 pero pagó recién el 03/09 | Registrar el pago el **03/09**, dejando asentado que corresponde al vencimiento de junio. |
| Vencía el 23/09 y pagó el 03/09 | Registrar el pago el **03/09**. El próximo vencimiento sigue siendo el 23/10. |
| Ya lo había cargado como movimiento suelto | **Vincularlo**, sin crear otro gasto. |
| Todavía no lo pagó | Queda pendiente. No descuenta plata. |

Que septiembre termine con tres alquileres es **correcto** si efectivamente pagó los tres en
septiembre. Que cambien los números de junio es **correcto** si está agregando un pago que realmente
hizo en junio. Lo incorrecto es que la app decida por ella.

**Consecuencia sobre el lenguaje, y no es cosmética:** tres recurrencias sin confirmar **no** son
tres alquileres impagos. Pueden ser tres pagos que hizo y no registró. La app sabe que le falta
información; no sabe que Julieta debe esa plata. Por eso el grupo tiene que decir **"3 pagos por
revisar"**, no "3 pagos pendientes" ni "debés $1.350.000".

**Poder revisar fecha, importe y cuenta de cada fila antes de guardar es parte del funcionamiento
básico, no una opción.** Una versión anterior te lo preguntaba: si estás registrando pagos reales
—que ya ocurrieron, con el importe que efectivamente salió— necesitás poder corregirlos. Un alquiler
que ajustó, un mes que pagaste desde otra cuenta. No hay versión útil de "ponerse al día" que te
obligue a aceptar el importe que la regla suponía.

---

### C · Poder decir "esto ya lo pagué" antes de que venza

Este es tu síntoma, textual, y el arreglo con mejor relación valor/esfuerzo de toda la lista.

**Hoy.** El alquiler vence el 23. Julieta lo paga el 3. Entra a la app y **no hay ningún botón**. La
recurrencia aparece listada en el hub con "Próximo: 23 de septiembre" y nada más — ni confirmar, ni
marcar, ni adelantar. Sus dos opciones son esperar 20 días, o cargar el gasto a mano.

**Y cargarlo a mano es peor que no hacer nada**: ese gasto queda suelto, sin vínculo con la regla. El
23 la app le va a proponer el alquiler igual, como si no lo hubiera pagado. Ahí Julieta o lo confirma
—y el alquiler queda cargado dos veces— o lo omite, y pierde el rastro de que sí lo pagó.

**Después.** En la fila de la recurrencia, un botón **"Ya lo pagué"**. Abre el mismo formulario de
confirmación de siempre, con la fecha en hoy y editable. Se registra el gasto, la recurrencia queda
saldada, y el 23 no le pregunta nada.

**Lo que tenés que decidir.** Julieta pagó el 3 el alquiler que vencía el 23. **¿Cuándo vence el
próximo?**

- **El 23 de octubre** (mi propuesta): el ritmo de la regla es del alquiler, no de cuándo ella pagó.
  Pagar antes no adelanta el calendario.
- **El 3 de octubre**: el ciclo se recalcula desde el pago real.

Con la primera, si Julieta paga siempre unos días antes, el calendario se mantiene estable año tras
año. Con la segunda, la fecha va a ir corriéndose para atrás mes a mes hasta desfasarse del alquiler
real. Por eso recomiendo la primera — pero es una decisión de producto, no técnica.

---

### D · Que la app se entere sola de que pasó el tiempo

**Hoy.** Esto es lo más sorprendente de todo el relevamiento, y explica tu "tengo recurrencias que no
veo": **la app sólo revisa si venció algo cuando entrás a Movimientos.** No cuando abrís la app, no
cuando entrás al inicio, no de noche. Si Julieta abre Grana, mira el inicio y sale, la app **nunca se
entera** de que hoy venció el alquiler. Puede pasar un mes entero así.

**Después.** Un proceso diario del lado del servidor revisa las recurrencias de todos, todas las
noches, sin que nadie tenga que entrar.

**Qué va a ver distinto.** Al abrir la app, lo pendiente ya está ahí — no aparece recién cuando pasa
por la pantalla correcta.

**Por qué importa más allá del síntoma.** Tres cosas dependen de esto y hoy son directamente
imposibles:
- **Notificaciones.** No se puede avisar "vence hoy el alquiler" si nadie miró que vencía.
- **Gastos compartidos del hogar.** Hoy, si vos y tu pareja comparten una recurrencia, la instancia
  sólo se crea cuando **el dueño de la regla** abre la app. El otro puede estar esperando algo que no
  existe todavía.
- **Que los informes del mes estén bien** sin depender de por dónde navegó cada uno.

Se puede hacer en dos etapas: primero un parche chico (que la revisión corra en cualquier pantalla,
no sólo en Movimientos) que tapa la mayor parte del síntoma en poco tiempo, y después el proceso
nocturno de verdad.

---

### E · Que "12 cuotas" signifique 12 cuotas

**Hoy.** El campo existe y no significa nada verificable. Lo verifiqué corriendo el cálculo: una
recurrencia creada desde un movimiento con el límite en 3 termina generando **4 movimientos**, y la
pantalla de "próximas" muestra **2**. Tres números distintos para el mismo campo.

**Después.** Un solo número, el que dice la pantalla.

**Ojo con el ejemplo.** Una versión anterior ilustraba esto con "la heladera en 12 cuotas", y estaba
mal elegido: **las compras en cuotas con tarjeta tienen su propio circuito en Grana** y no pasan por
recurrencias. El caso real acá es otro: una cuota de colegio de marzo a diciembre, un seguro con 6
pagos, un préstamo entre particulares.

**Más que una decisión, es un problema de rótulo.** No hay que elegir entre dos comportamientos
equivalentes: hay que escribir en la pantalla cuál de los dos es, sin ambigüedad —
**"12 pagos en total"** o **"12 repeticiones además de esta"**. Hoy el campo dice "12" a secas, el
código hace lo segundo y la pantalla de próximas muestra un tercer número.

---

### F · Que una recurrencia pausada no te siga pidiendo cosas

**Hoy.** Julieta pausa el gimnasio. La app le sigue mostrando la cuota de febrero en "Por confirmar",
sin ninguna marca de que está pausada. Pausar no se siente como pausar.

**Después.** Sigue apareciendo —puede querer resolverla— pero con un sello **"Pausada"** para que se
entienda por qué está ahí y que no van a venir más.

**Alternativa:** esconderla del todo. No la recomiendo: le sacaría de la vista algo que todavía puede
querer confirmar u omitir.

---

### G · Que "lo que viene" no se corte a fin de mes

**Hoy.** Las tarjetas de próximas ocurrencias son "Próximos 7 días" y "Más adelante este mes". El 25
de septiembre, la segunda **está vacía por definición** —arranca el 3 de octubre y termina el 30 de
septiembre— así que el alquiler del 23 de octubre no aparece en ninguna parte. Del día 24 en
adelante, el horizonte de la app son 7 días.

**Después.** "Próximos 30 días" en vez de "lo que queda del mes". La pregunta real de cualquiera es
"qué se me viene", no "qué entra en el mes calendario".

---

### Cómo se hace (detalle técnico)

Para el que implemente. Nada de esto cambia lo de arriba.

- **A** — El invariante que importa no es "una pendiente por regla" —eso rompe el calendario— sino
  "una instancia por ocurrencia". **Un índice parcial sobre `(recurrence_id, scheduled_date) WHERE
  status = 'pending'` NO alcanza**, y una versión anterior de este documento lo proponía como si sí:
  al confirmarse, la fila sale del índice parcial y deja de estar protegida, con lo que la misma
  ocurrencia puede volver a generarse. Y como `confirm` además **pisa** `scheduled_date` (D14), la
  fecha ni siquiera sirve como identidad. Hace falta una identidad de ocurrencia estable, derivada
  del calendario y no de lo que el usuario elija al pagar, protegida en **todos** los estados.
  Recién sobre esa base, `decideRecurrenceInstance` pierde el parámetro `hasPending` y devuelve una
  **lista** de fechas caminando con el `walkOccurrences` que ya existe. Además hay que separar el
  avance de la generación de la resolución de un pago (D13), y adaptar consultas y tipos que hoy
  asumen **una** pendiente por regla (`getPendingInstancesByRecurrenceId` devuelve un
  `Map<string, RecurrenceInstance>`, uno solo por regla; `RecurrenceSummary.pending_instance` es
  singular) — si no, parte del atraso queda invisible aunque exista en la base.
  **Dependencia cruzada con #104:** su plan de arreglo se apoya explícitamente en que el índice
  `one_pending_per_rule` exista (pasa la instancia a `skipped` en vez de `pending` para no chocar con
  él). Los dos changes tocan la misma restricción y hay que ordenarlos, no correrlos en paralelo.
- **B** — Acción de resolución en lote sobre el grupo, con preview del delta de saldo por cuenta.
- **C** — Materializar la próxima ocurrencia bajo demanda y abrir el drawer de confirmación que ya
  existe. **Definición única del avance, que reemplaza cualquier otra en versiones anteriores de este
  documento:** resolver un pago NO avanza el cursor de generación (D13). Que hoy
  `confirmRecurrenceInstance` use el `scheduled_date` original en vez de la fecha elegida es correcto
  pero insuficiente — el problema no es *qué* fecha escribe, es *que escriba*. El calendario de la
  regla se deriva de su propio cronograma y del conjunto de ocurrencias ya resueltas, no del último
  pago registrado.
- **D** — Etapa 1: subir el trigger al layout `(app)` en web y agregarlo al feed nativo (arregla
  también la paridad rota D5). Etapa 2: `pg_cron` diario + función `SECURITY DEFINER`.
- **E** — El generador tiene que contar ocurrencias contra el calendario, no filas en
  `recurrence_instances`: la semilla de una regla creada desde un movimiento no es una fila.
- **F** — `getPendingRecurrenceInstances` trae el estado de la regla y la UI lo sella.
- **G** — El segundo bucket pasa de "resto del mes" a 30 días.

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
mostrando el número del año pasado con cara de certeza. No encontré esta función en la documentación
de las apps que revisé, lo cual es esperable —en sus mercados el problema no existe con esta
intensidad—, pero no revisé el mercado entero: tomalo como una oportunidad a validar, no como un
hecho establecido.

**U3 · Débito automático — pero separando dos cosas que una versión anterior mezclaba.**
Esa versión daba por sentado que en un débito automático "la plata sale sí o sí". **Es falso:** un
débito se rechaza por falta de fondos, cambia de importe o se ejecuta otro día. Tener un débito
programado no prueba que ocurrió.

Son dos funciones distintas:
- **Avisar que esperabas un débito** — planificación. Segura, útil, no afirma nada.
- **Registrar que el débito ocurrió** — requiere confirmación del usuario o evidencia del movimiento.

Un registro automático puede existir como opción explícita del producto, siempre revisable y
reversible. **Fuera de la primera entrega**, y en ningún caso como solución al bloqueo del #96.

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
| **Money Manager** (Realbyte) | Registros repetidos, con opción de mostrarlos en su fecha o desde el 1º | Sí | No verificado | Notificación local | No |
| **Monefy** | Auto-inserción al llegar la fecha | Sí, se insertan solas | No verificado | Notificación local | No |
| **Wallet (BudgetBakers)** | Plantilla recurrente | Sí | Sí | Push | No |
| **MP / Ualá / Naranja X** | Débito automático real | N/A — lo ejecuta el banco | N/A | Push nativo | N/A |
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

**En avisos perdemos, aunque la comparación no es del todo pareja.** MP y Ualá pushean, Mobills manda
mail; Grana tiene un bloque plegado en una ruta que no es la landing. La salvedad: una billetera
avisa de un débito **que ella misma ejecutó** —tiene el hecho—, mientras Grana avisaría de un
vencimiento previsto. Es información distinta, y la de Grana necesita que el usuario confirme. Aun
con esa salvedad, la brecha en avisos es real. Esto es X1+X3+D-3.

**En inflación puede haber una oportunidad, y es una hipótesis a validar, no una conclusión.** No
encontré ajuste por índice en la documentación que revisé. Un alquiler que se ajusta solo por ICL, o una regla
en USD que proyecta a la cotización de hoy, es una feature que **sólo tiene sentido acá** y que
ninguna de las apps de la tabla ofrece. Si Grana quiere un diferencial real frente a Mobills, U2 es
ese diferencial, no una pantalla más linda.

**Y donde ya ganamos, conviene no perderlo:** bimoneda de verdad, gasto compartido con hogar,
resúmenes de tarjeta reales con período y vencimiento, y detección de patrones para sugerir
recurrencias. No encontré ese conjunto reunido en ninguna de las apps que miré — con el alcance que
eso tiene: revisé documentación de producto, no las apps en uso.

---

## El alcance de la primera entrega

Esto es lo que hay que acordar antes de escribir código. Está en forma de **comportamientos que
podés validar vos mismo usando la app** — no de tareas técnicas. Si al terminar la entrega los ocho
se cumplen, la entrega está bien; si alguno no, no importa qué se haya construido.

1. Dejo junio sin revisar y **igual puedo registrar septiembre**.
2. Pago hoy algo que vence dentro de veinte días y **lo registro hoy**, sin esperar el aviso.
3. Después de eso, **el próximo vencimiento conserva la fecha que configuré** (el 23, no el día que pagué).
4. Si el pago ya estaba cargado como movimiento suelto, **lo vinculo sin duplicarlo**.
5. Reviso varios meses juntos y, en cada uno, **puedo corregir fecha, importe y cuenta** antes de guardar.
6. Si me equivoco, **puedo deshacerlo**.
7. Lo que falta revisar **sigue visible**, y la app no afirma que necesariamente debo esa plata.
8. **Todo funciona igual en web y en la app nativa.**

### Una distinción que hay que definir antes de tocar el #104

El punto 6 esconde dos intenciones distintas que hoy terminarían en el mismo estado:

| Lo que quiso decir el usuario | Qué tiene que quedar |
|---|---|
| **"Me equivoqué al registrar este pago"** | El pago se borra y el vencimiento **vuelve a estar por revisar**. |
| **"Este período no corresponde"** | La ocurrencia queda **omitida**. No se espera ningún pago. |

El plan actual del #104 convierte **siempre** el pago borrado en "omitido". Eso resuelve una
restricción técnica de la base, pero le hace decir al dato algo que el usuario puede no haber
querido: que ese mes no correspondía, cuando quizá sólo se equivocó al cargarlo. La diferencia tiene
que quedar escrita antes de implementar cualquiera de los dos changes.

### Qué NO entra en la primera entrega

Recordatorios y notificaciones · registro automático de débitos (U3) · ajuste de importes por índice
(U2) · calendarios tipo "segundo jueves" (#35) · pausa con fecha · historial de importes.

---

## Recomendación de orden

Cómo se organiza el trabajo para cumplir el alcance de arriba es una **recomendación técnica**, no
algo que haya que aprobar: lo que se aprueba son los ocho comportamientos.

**Tanda 0 — los cimientos** (sin esto, la Tanda 1 fabrica duplicados)
Identidad estable de ocurrencia · vencimiento previsto y fecha de pago como campos separados (D14) ·
separar el avance de la generación de la resolución de un pago (D13). Va primero porque todo lo
demás se apoya acá, no porque sea prolijo.

**Tanda 1 — parar la hemorragia** (arregla los tres síntomas reportados y #96)
`A` backlog · `B` ponerse al día · `C` registrar ahora · `U4` vincular un movimiento ya cargado ·
`E` contar bien los pagos · `D-1` generar en el layout y en el feed nativo · `X1` pendiente en el
dashboard · `X2` plegado invertido

`U4` y `E` subieron acá desde la Tanda 2: sin poder vincular lo ya cargado, ponerse al día empuja al
usuario a duplicar gastos; y sin contar bien, el pago anticipado descuadra el total de una regla con
límite. Los dos sostienen la Tanda 1, no la adornan.

**Tanda 1b — en paralelo, con distinto grado de independencia**
`D15` el doble conteo del dashboard — **totalmente independiente**: se arregla sin tocar nada de
recurrencias y es plata mal mostrada hoy. Ticket y arreglo propios, prioritario.

`#104` deshacer una confirmación — **no es independiente**, y una versión anterior de este documento
lo listaba como si lo fuera. Puede tener un arreglo previo compatible, pero no debe implementarse con
una interpretación de "deshacer" distinta de la que quede acordada acá (ver abajo), y su plan actual
se apoya en el índice que este change elimina.

**Tanda 2 — que el dato deje de mentir**
`F` pausada · `G` ventana de próximas · `X4` decir qué va a pasar ·
`X5` avisar cuando algo está trabado

**Tanda 3 — que la app trabaje sola**
`D-3` `pg_cron` · `U3` auto-confirmación · `U5` recordatorios · `X3` badge

**Tanda 4 — el diferencial**
`U1` monto variable · `U2` ajuste por índice · `U6` historial · `U7` proyección a 12 meses

---

## Decisiones tomadas

Ambas se resolvieron el 3 de septiembre y quedan acá para que el change que las implemente no las
vuelva a discutir.

**1 · El invariante se relaja: una regla puede tener varias ocurrencias sin resolver a la vez.**
Esto **modifica** la requirement "El sistema genera instancias recurrentes de forma secuencial" del
spec de `transactions` —en particular el escenario "Usuario vuelve después de varios meses"—, así que
el change tiene que escribirla como `## MODIFIED Requirements`, no agregar una nueva al lado.

Lo que **no** queda decidido acá, y una versión anterior de este documento daba por cerrado: el
número 12 (ver el arreglo A — es tamaño de tanda y de presentación, no alcance del modelo) y **cómo
se identifica una ocurrencia**. `(regla, fecha_programada)` NO alcanza: ver D13 y D14. Esa es la
primera tarea del change, no un detalle de implementación.

**2 · El pasado no se re-proyecta: se marca como incompleto y se deja completar con datos reales.**
Re-proyectar automáticamente usaría los montos de hoy, perdería las reglas retiradas e inventaría las
creadas después: sería fabricar un pasado que no ocurrió. Eso queda descartado.

Lo que **no** queda descartado —y una versión anterior de este documento lo mezclaba— es que Julieta
complete el pasado con pagos que realmente hizo. El aviso correcto es *"estos meses tienen
información incompleta, podés registrar los pagos que falten"*, no un cartel de sólo lectura.

Una precisión contable que la versión anterior tenía mal: **crear una instancia pendiente no mueve
ningún saldo.** El saldo se mueve cuando se crea un movimiento confirmado. Lo que una pendiente sí
cambia es la vista de compromisos — y para meses cerrados el cambio es real, porque bajo el lente
`snapshot` el total cuenta las instancias materializadas `pending` **y** `confirmed`. Son dos efectos
distintos y conviene no confundirlos al comunicarlo.

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
