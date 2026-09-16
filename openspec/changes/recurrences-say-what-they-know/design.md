## Context

Ver `proposal.md` — Why.

Lo que hay hoy y condiciona el enfoque:

- **Las decisiones del bloque de vencimientos ya viven en un solo lugar**:
  `packages/recurrences/src/review-surface.ts`. Ahí están si el bloque arranca abierto,
  cuán vencida está cada fila y qué movimiento va a crear. El comentario del módulo dice
  por qué existe: web y nativo contestaban las mismas preguntas por separado, y así fue
  como se separaron. Lo nuevo entra ahí.
- **Desde `fix-recurrence-backlog` los vencimientos atrasados existen como filas.**
  Antes se materializaba uno por regla; ahora se materializan todos. Eso importa para
  el aviso de regla trabada: contar filas sin resolver es contar la realidad, no una
  estimación.
- **Las dos tarjetas de «lo que viene» son sólo de web**
  (`upcoming-recurrences.tsx`). El hub nativo muestra la próxima fecha en cada fila de
  regla y no tiene tarjetas equivalentes.

## Goals / Non-Goals

**Goals:**

- Que las dos respuestas nuevas —está trabada, qué entra en la ventana— se decidan una
  sola vez y las dos plataformas las consuman.
- Que el aviso de regla trabada tenga un umbral escrito y comprobable, no una impresión.

**Non-Goals:**

- No se toca la generación, ni el cálculo de la próxima fecha, ni ningún monto.
- No se agrega ninguna acción. El aviso de trabada usa las que ya existen.
- No se construyen las tarjetas de «lo que viene» en nativo (ver `proposal.md`).
- No se toca qué pasa al pausar una regla. Ese comportamiento se separó en un change
  propio: escribe en la base y necesita un diálogo nuevo, y mezclarlo acá convertiría un
  cambio que no toca datos en uno que sí.

## Decisions

**1 · «Trabada» es una propiedad de la REGLA, no del bloque.**

El bloque agrupa por regla, así que la pregunta se puede hacer de dos formas y dan
resultados distintos. Tres reglas con un vencido cada una **no** son tres reglas
trabadas: es un usuario que estuvo unos días sin entrar, y llamarlo «trabado» sería
alarmismo. Una regla con veintisiete sin resolver sí lo está.

El aviso se emite **por regla** y se dibuja en la cabecera del grupo de esa regla, no
arriba del bloque. Alternativa descartada: un aviso único arriba que sume todo. Contaría
una historia que no pasó —«tenés 30 vencimientos trabados»— cuando en realidad hay una
regla rota y dos que esperan un toque.

**2 · El umbral: dos o más sin resolver, y la más vieja ya vencida.**

Las dos condiciones hacen falta. Sólo «dos o más» marcaría como trabada a una regla
quincenal que generó las dos ocurrencias del mes y todavía no venció ninguna. Sólo «hay
una vencida» marcaría a cualquiera que se atrasó un día.

El relevamiento decía «dos períodos sin resolverse»; esto lo escribe en términos de lo
que se puede contar sin ambigüedad —filas sin resolver y la fecha de la más vieja—
porque «período» no está definido para una regla personalizada de cada 10 días.

**3 · La segunda ventana pasa a `[hoy+8, hoy+30]` y sigue siendo disjunta de la primera.**

Lo único que cambia es el final: `hoy+30` en vez de `fin de mes`. El comienzo sigue en
`hoy+8` para que las dos tarjetas no muestren la misma ocurrencia dos veces, que es lo
que el spec ya exige.

Alternativa evaluada: una sola tarjeta de 30 días. Se descartó porque «esta semana» y
«este mes» son dos preguntas distintas y la separación en dos tarjetas ya funciona —el
defecto era el borde, no la división.

## Risks / Trade-offs

**El aviso de regla trabada puede leerse como un reproche** → El texto nombra el hecho y
la fecha, no al usuario, y no afirma deuda: «Esta recurrencia está trabada desde el 10
de junio. Hay 27 ocurrencias sin registrar.» Es la misma línea que el bloque ya sostiene
para el resto de su lenguaje.

**Una regla pausada con vencimientos viejos va a mostrarse como trabada** → Es
correcto mientras pausar no los resuelva, que es como funciona hoy. Cuando entre el
change de la pausa, esos vencimientos dejarán de existir al pausar y el caso se vuelve
imposible por construcción — sin que esta regla tenga que cambiar.

**Cambiar la ventana a 30 días hace que la segunda tarjeta casi nunca esté vacía** →
Deseado. Hoy está vacía una semana de cada cuatro, y esa es la falla.

**Nativo no tiene runner de tests**, así que el aviso del lado nativo se
sostiene en el modelo compartido, el typecheck y la QA manual → El umbral y la
derivación se pinchan con tests en `@grana/recurrences`, que es donde se decide; lo que
queda sin cubrir en nativo es el dibujo, no la regla.
