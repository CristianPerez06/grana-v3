# Design: add-savings-purpose

Decisiones cerradas de la fase 2, con su porqué. El modelo conceptual completo está en
`docs/modelo-de-dinero.md`; las decisiones de la fase 1 están en `add-savings-set-aside/design.md`
y esta change no las revisa.

## D0 — Un propósito es un nombre y un ícono, y nada más

Sin monto objetivo, sin fecha, sin progreso. Eso es una **meta**, y es de la fase 4.

La separación es lo que mantiene barata la fase, pero el motivo de fondo no es el costo: una meta
sin posiciones detrás es una barra de progreso que **no sabe en qué está parada la plata**. En
Argentina esa es precisamente la enseñanza que hay que dar —*tu objetivo está en dólares y tu ahorro
en pesos*— y una barra que mide el número nominal enseña lo contrario.

## D1 — El propósito no participa de ningún número

`get_available_sums` y `get_reserve_flow_sums` quedan **idénticas**, y el dashboard no se toca.

Es la propiedad que hace que la fase no pueda romper la fase 1: si ninguna lectura de plata cambia,
ninguna identidad de la card puede dejar de cerrar. El propósito es un corte del guardado, no un
término de ninguna resta.

## D2 — El piso pasa a ser por (propósito, moneda); el tope NO

La asimetría es deliberada.

Con propósitos, *"no podés volver a usar más de lo que tenés guardado"* deja de alcanzar. Con
Emergencia en $50.000 y *Sin destino* en $140.000, volver a usar $80.000 parado en Emergencia pasa
cualquier control sobre el total de $190.000 y deja ese grupo en **−$30.000**: afirmaría que se puede
gastar plata que el grupo no tiene, mientras todos los números de la pantalla siguen cerrando.

Guardar, en cambio, **no se topea por propósito**: sin objetivo no hay contra qué toparlo. El tope
sigue siendo el disponible de la moneda.

La suma por propósito vive en SQL (`get_purpose_sums`) y no se recompone en TS. Es la lección de la
migración 0051 un nivel más abajo: ahí el criterio de "cuenta propia" estaba replicado a mano en cada
call site y ya había divergido en producción.

## D3 — «Sin destino» es un grupo, no una ausencia

`purpose_id` en null tiene **las mismas reglas que cualquier propósito**, incluido el piso.

Tratarlo como "las que todavía no tienen nombre" sería justo por donde se escaparía el control de D2:
el grupo sin etiqueta es, para casi todos los usuarios, el que más plata tiene.

El rótulo es copy y vive en i18n. La base devuelve `purpose_name` en null: no habla castellano.

## D4 — Borrar un propósito no puede cambiar ningún número

`ON DELETE SET NULL`, con un `do $check$` que **falla la migración** si alguien lo cambia.

Las tres opciones y por qué:

| Regla | Qué haría | Por qué no |
|---|---|---|
| `CASCADE` | Borra las reservas | Le baja el guardado al usuario sin que nadie lo haya decidido. Y todas las lecturas seguirían cerrando — con menos plata. Ninguna suite lo notaría |
| `RESTRICT` | Obliga a vaciar el propósito antes | Es pedirle que devuelva plata al disponible para poder renombrar una idea |
| **`SET NULL`** | La plata vuelve a *Sin destino* | Borrar una **etiqueta** no toca ningún **número** |

La app avisa cuánta plata se mueve antes de borrar, con el monto por moneda.

## D5 — Nombre único por usuario, normalizado

Índice único sobre `(user_id, lower(btrim(name)))`.

Dos *Emergencia* no se distinguen mirándolos, y el problema no aparece al crearlos: aparece meses
después, cuando el usuario no entiende por qué su plata quedó partida en dos.

**Límite conocido:** no pliega acentos, así que *Japon* y *Japón* conviven. `unaccent` no es
`IMMUTABLE` y no entra en un índice sin un wrapper propio. Si molesta, se resuelve con un
`canonical_name` como el de `categories`.

## D6 — Sin propósitos de sistema: las sugerencias viven en la app

`categories` siembra filas de sistema (`user_id` nulo) y sería el precedente obvio. **No se copia.**

Una categoría de sistema no se puede renombrar y está bien: *Comida* le sirve igual a todos. Un
propósito de sistema tampoco se podría renombrar, y ahí el costo es la fase entera: si *Viaje* viene
de fábrica, no se puede convertir en **Japón** — y el nombre personal *es* el valor de esta fase.

Las sugeridas (**🚑 Emergencia · ✈️ Viaje · 🚗 Auto · 🏠 Casa · 🎓 Estudio**) son copy en i18n. Tocar
una **crea un propósito propio**, editable y borrable, con el nombre ya escrito y el foco adentro:
cero tipeo para arrancar, nada intocable al final.

*Emergencia* va primero a propósito. Es la única con contenido financiero real detrás, y ponerla a la
vista es lo más parecido a un consejo que Grana puede dar sin dar consejos.

Una sugerencia cuyo nombre el usuario ya tiene **no se ofrece**: el atajo pensado para ahorrar tipeo
sería, si no, la forma más fácil de chocar contra D5.

## D7 — Un solo campo de texto, no nombre + descripción

Se evaluó que el propósito tuviera **nombre** (de una lista) y **descripción** libre —*Viaje* +
*Japón*— y se descartó.

- **Choca con D5.** *Viaje → Japón* y *Viaje → Bariloche* son dos propósitos **llamados igual**: el
  índice los rechaza. Y sacando el índice, el selector muestra dos chips que dicen *Viaje* y *Viaje*,
  que es el problema de D5 entrando por la otra puerta.
- **No entra en pantalla.** El nombre aparece en el selector, en el detalle y —en fase 4— en la card.
  *"para Japón"* entra; *"para Viaje · Japón"* es casi el doble en filas que ya se pelean por una
  línea en el teléfono. Y mostrar solo una de las dos convierte a la otra en un campo que se llena y
  no se ve nunca.
- **Lo que se buscaba se resuelve con prefill** (D6), que da el mismo ahorro de tipeo con un campo.

No hace falta un estado *"Personalizada"*: ese estado supone una lista cerrada de la que uno se salió,
y acá **todos los propósitos son del usuario desde el primer momento**.

Si en fase 4 aparece la necesidad de una **nota** (*"marzo 2027, con Ana"*), la pantalla de detalle de
la meta tiene lugar de sobra y la columna es aditiva.

## D8 — Los propósitos son planos; la jerarquía se revisa en fase 4

Se evaluó una estructura de dos niveles al estilo `categories`/`subcategories` —*Viaje* como grupo,
*Japón* y *Bariloche* adentro— y se difiere.

**El precedente no aplica: una categoría no tiene saldo.** *Comida* etiqueta un gasto que ya ocurrió;
el número vive en la transacción. Un propósito tiene un **stock derivado que debe respetar un piso**
(D2), y ahí la jerarquía abre una pregunta que la etiqueta nunca tuvo que contestar: **¿la plata se
guarda en el grupo o en el subgrupo?**

Si se permite en los dos, el grupo tiene plata que no es de ningún subgrupo —un *Sin destino* dentro
de cada grupo— y volver a usar parado en el padre exige **imputar**: ¿sale de lo suelto, de Japón,
repartido? Esa pregunta ya se contestó que no en la fase 1, y es la razón por la que una reserva no
tiene `account_id`: imputar retiros parciales es exactamente lo que el modelo se niega a inventar.

**Y el costo lo paga todo el mundo.** La jerarquía rinde a partir de muchos ítems por grupo; con uno o
dos viajes es un selector de dos pasos y un detalle de dos niveles para agrupar dos cosas. En una lista
plana, ✈️ *Japón* y ✈️ *Bariloche* ya se leen como familia: el **ícono** hace ese trabajo sin schema.

**Si alguna vez se hace, la única versión que cierra** es que la plata viva **solo en las hojas** y el
padre sea rótulo puro que suma lo de abajo: sin plata suelta en el padre no hay nada que imputar y el
piso sigue siendo por hoja. La versión que no funciona es la que deja guardar en los dos niveles.

**Fase 4 es el momento natural para revisarlo**, porque ahí los propósitos ganan objetivo y la suma de
un grupo significa algo: *"entre Japón y Bariloche tengo US$ 3.000 de los US$ 5.000 que necesito"*. Hoy
sumaría números sin nada contra qué compararlos. Agregar un `parent_id` nullable es aditivo y los
propósitos existentes quedan como raíces, sin migrar nada.

## D9 — El propósito se hereda de dónde se tocó, no se pregunta

Al volver a usar plata desde un propósito, **no hay campo de propósito**: se llegó tocando ese grupo,
así que Grana ya sabe de dónde sale — igual que el drawer de la fase 1 hereda la moneda.

El único caso en que sí pregunta es abrir *Volver a usar* desde el total teniendo **más de un grupo con
saldo**. Ahí la primera pantalla es elegir cuál, con los montos a la vista. **No hay una tercera
opción**: repartirlo automáticamente sería inventar una imputación (D8).

## D10 — La pertenencia del propósito se valida contra la base

RLS impide **leer** el propósito de otro usuario, pero el FK **no mira dueños**: sin un chequeo
explícito, un cliente modificado podría colgar una reserva propia de una etiqueta ajena. No filtra
datos —el otro usuario nunca la vería— pero si esa persona borra su propósito, la reserva se mueve
sola por D4.

Se valida en la mutación, como el tope y el piso, y por la misma razón: un schema valida la **forma**;
el estado del servidor lo valida el servidor.

## D11 — Asignar ⇄ desasignar: el segundo par de verbos

Se llega tocando un movimiento del historial, y es una operación sobre una reserva que **ya
existe**.

Es el segundo par de verbos del modelo. Igual que guardar y volver a usar, no mueve plata; pero a
diferencia de ellos, **tampoco cambia el disponible ni el total guardado**. Es la operación más
inofensiva del modelo, y por eso no tiene tope, ni piso, ni confirmación: no hay ningún número que
pueda quedar mal.

**Existe porque sin ella la fase serviría solo hacia adelante.** Todo lo que el usuario venía
guardando quedaría condenado a «Sin destino» para siempre, y la fase se estrenaría con la plata de la
gente ya del lado equivocado — que es la peor primera impresión posible para algo cuyo valor es
justamente poder decir para qué.

Desasignar no es un botón aparte: es elegir «Sin destino» en la misma lista. El par es simétrico y se
expresa con un solo control.

La entrada está en las **dos** listas de historial —la de la moneda y la de un grupo—, y la segunda es
la que más importa: parado en «Sin destino», el usuario está mirando exactamente la plata que quiere
etiquetar.
