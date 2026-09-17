## Context

Ver `proposal.md` — Why.

Lo que hay hoy y condiciona el enfoque:

- **Las decisiones del bloque de vencimientos ya viven en un solo lugar**:
  `packages/recurrences/src/review-surface.ts`. Ahí están si el bloque arranca abierto,
  cuán vencida está cada fila y qué movimiento va a crear. El comentario del módulo dice
  por qué existe: web y nativo contestaban las mismas preguntas por separado, y así fue
  como se separaron. Lo nuevo entra ahí.
- **Desde `fix-recurrence-backlog` los vencimientos atrasados existen como filas**, pero
  **no necesariamente todos a la vez**: la materialización corre por lotes de
  `RECONSTRUCTION_BATCH_SIZE = 50` y lo que no entra queda en `remaining` para la
  corrida siguiente. Eso acota lo que el aviso puede afirmar: contar filas dice cuántas
  hay **para revisar**, no cuánto es el atraso completo.
- **El bloque de vencimientos NO agrupa por regla.** Web y nativo muestran una lista
  plana de ocurrencias. No existe una cabecera de grupo donde colgar un aviso por regla,
  y agrupar la lista es otra entrega.
- **La proyección descarta un conjunto de fechas cubiertas, no un cursor.**
  `covered` reemplazó a `last_generated_date` justamente porque el cursor fallaba en las
  dos direcciones (cubría de más al resolver fuera de orden, y de menos con una pendiente
  sin resolver — el #118). Este change no lo toca: sólo corrige el texto del spec, que
  seguía pidiendo el cursor.
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

La pregunta se puede hacer de dos formas y dan resultados distintos: contando los
vencidos del bloque, o contando los de cada regla. Tres reglas con un vencido cada una
**no** son tres reglas trabadas: es un usuario que estuvo unos días sin entrar, y
llamarlo «trabado» sería alarmismo. Una regla con veintisiete sin resolver sí lo está.
Así que la cuenta se hace por regla, aunque la lista que el usuario ve sea plana.

**Dónde se dibuja, dado que la lista es plana.** Una línea **por cada regla trabada**, en
una tira al principio del bloque, cada una con el nombre de su regla, su fecha y su
conteo. No es un aviso que suma: dos reglas trabadas son dos líneas, no un total.

Alternativa descartada: un aviso único arriba que sume todo. Contaría una historia que no
pasó —«tenés 30 vencimientos trabados»— cuando en realidad hay una regla rota y dos que
esperan un toque. Alternativa descartada por alcance: agrupar la lista por regla y poner
el aviso en cada cabecera. Es la ubicación más natural y no existe hoy; agrupar el bloque
es una entrega propia y no entra acá.

**2 · El umbral: dos o más sin resolver, y la más vieja ya vencida.**

Las dos condiciones hacen falta. Sólo «dos o más» marcaría como trabada a una regla
quincenal que generó las dos ocurrencias del mes y todavía no venció ninguna. Sólo «hay
una vencida» marcaría a cualquiera que se atrasó un día.

El relevamiento decía «dos períodos sin resolverse»; esto lo escribe en términos de lo
que se puede contar sin ambigüedad —filas sin resolver y la fecha de la más vieja—
porque «período» no está definido para una regla personalizada de cada 10 días.

**Y el conteo dice «para revisar», no «en total».** Con la reconstrucción por lotes, un
atraso largo puede tener ocurrencias todavía sin crear, así que un total sería un número
que el sistema no tiene. Cuando queda reconstrucción pendiente el aviso lo dice en vez de
dar el conteo por cerrado. Alternativa descartada: calcular el atraso real caminando el
calendario en cada lectura del bloque — es trabajo por regla en una pantalla que se abre
todo el tiempo, para un número que la próxima corrida va a materializar igual.

**2b · El orden con que se nombra una regla vive en el paquete, y la subcategoría entra antes que la categoría.**

Apareció en la QA. El aviso de trabada tenía que nombrar la regla «igual que el hub», y para eso
hacía falta preguntarse qué hace el hub — que resultó ser la décima copia de la misma cadena: nueve
lugares entre las dos apps retipean `descripción → categoría → tipo`. Ya había divergido sin que
nadie lo notara: los «Compromisos» del dashboard leen `descripción → subcategoría → categoría` para
**esas mismas reglas**, así que una regla sin descripción se llamaba «Internet» en el inicio y
«Servicios» en el hub. Retipear la cadena una vez más es cómo vuelve a pasar, así que el orden pasa
a `@grana/recurrences` y las superficies de recurrencias lo consumen.

**Hasta dónde llega, dicho con todas las letras.** Los «Compromisos» del inicio quedan afuera: es una
lectura de `@grana/dashboard`, que arma el nombre en la query y devuelve texto ya resuelto, no la
clasificación. Respeta el mismo orden, pero usa el nombre **guardado** de la categoría en vez del
traducido, así que en inglés dice «Servicios» donde el hub dice «Services». Cerrarlo pide cambiar qué
devuelve esa lectura y resolver el nombre en cada superficie con su catálogo —trabajo propio, en una
pantalla que este change no toca y que habría que volver a QA-ear—. Se deja anotado como divergencia
conocida en el spec en lugar de afirmar un alcance que no tiene: media verdad escrita como requisito
es peor que la divergencia, porque la siguiente sesión deja de buscarla.

La función toma los nombres **ya resueltos**, no las filas: una categoría del sistema se nombra por
el traductor (`categories.{canonical_name}`) y cada app tiene el suyo. Lo que hay que decidir una
sola vez es el ORDEN, y es lo único que está ahí.

Y el orden gana un escalón: la **subcategoría antes que la categoría**. Una regla sin descripción se
nombra por su clasificación, y la mitad angosta es la que distingue —«Internet» y «Gas» dicen qué es
cada una; las dos se llaman «Servicios»—. La categoría queda como el paso siguiente, porque una regla
puede estar clasificada sólo hasta ahí.

Consecuencia que no es opcional: la regla tiene que **viajar con su subcategoría**, no sólo con su
categoría (`attachRuleClassification`). Traer una sola deja el aviso un escalón por debajo del hub,
que es exactamente la divergencia que este punto vino a cerrar.

Y la **ficha muestra la subcategoría**. Si el título sale de ella, una ficha que lista sólo la
categoría deja el nombre de arriba sin origen visible en la pantalla cuyo trabajo es explicarlo.

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

**Una regla pausada con vencimientos viejos va a mostrarse como trabada** → Es correcto:
pausar no resuelve lo que quedó pendiente. El change de la pausa tampoco lo va a volver
imposible — omitir deja las ocurrencias en el historial como omitidas, y las reglas que
ya estaban pausadas conservan sus pendientes porque el diálogo nuevo sólo corre cuando
alguien pausa. Lo que cambia entonces es cuántas veces se da el caso, no si puede darse,
así que esta regla no depende de aquel change.

**Cambiar la ventana a 30 días hace que la segunda tarjeta casi nunca esté vacía** →
Deseado. Hoy está vacía una semana de cada cuatro, y esa es la falla.

**Nativo no tiene runner de tests**, así que el aviso del lado nativo se
sostiene en el modelo compartido, el typecheck y la QA manual → El umbral y la
derivación se pinchan con tests en `@grana/recurrences`, que es donde se decide; lo que
queda sin cubrir en nativo es el dibujo, no la regla.
