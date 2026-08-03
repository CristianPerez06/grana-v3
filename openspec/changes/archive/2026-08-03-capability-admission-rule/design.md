# Diseño — regla de admisión a las capabilities meta

## Context

Esta change cierra la deuda estructural de `split-project-conventions`. Aquel change movió 17 requirements fuera de un grab-bag; éste evita que se rearme.

La restricción de diseño que domina: el requirement tiene que ser **aplicable por una persona o un LLM en el momento de escribir un requirement nuevo**, sin que nadie audite después. No hay gate automático posible acá —ningún linter sabe de qué habla un párrafo en español— así que toda la fuerza de la regla está en que el test sea corto y difícil de racionalizar.

## Goals / Non-Goals

**Goals:**

- Que "capability meta" deje de ser una categoría interpretable y pase a ser una lista con sujetos declarados.
- Que el razonamiento por descarte ("no tiene hogar obvio, va acá") quede explícitamente prohibido.
- Que la regla cubra las tres capabilities meta, no sólo la que se desbordó.
- Que el test quepa en una línea que alguien recuerde.

**Non-Goals:**

- Auditar los 29 specs actuales buscando requirements mal ubicados. La regla mira hacia adelante; lo que había mal ubicado en `project-conventions` ya se movió.
- Automatizar el chequeo. No es automatizable con las herramientas del repo, y fingir que sí lo es sería peor que no tenerlo.
- Prohibir capabilities meta nuevas. Se admiten, con la condición de declarar su sujeto.

## Decisions

### Decisión 1 — El test es por sujeto, no por ámbito de aplicación

Es la decisión central y es la que explica la falla original. Las nueve reglas de dominio que terminaron en `project-conventions` tenían todas una propiedad real: aplican a todo el repo. "Los cálculos monetarios usan aritmética decimal" gobierna código de web, de mobile y de los packages. Bajo un criterio de *ámbito*, pertenecer a una capability transversal es defendible.

Bajo un criterio de *sujeto*, no lo es: esa regla **habla de plata**, y su hogar es donde vive el tipo `Money`. El requirement fija el criterio de sujeto y nombra la trampa explícitamente, porque es la que un colaborador razonable vuelve a pisar.

**Alternativa descartada:** definir las capabilities meta por exclusión ("lo que no encaja en ninguna otra"). Es exactamente la definición que produjo el problema.

### Decisión 2 — La regla acota la heurística de "preferir lo existente" en vez de ignorarla

La instrucción "preferir una capability existente antes que crear una" es sensata y es la que todo el mundo aplica. El requirement no la contradice: la acota a capabilities cuyo sujeto coincide con el del requirement, y declara que una capability meta no cuenta como candidata sólo por aceptar cualquier cosa.

Dejarla sin mencionar habría sido peor que no escribir la regla: quien tenga las dos en la cabeza va a resolver el conflicto a favor de la que ya conoce.

### Decisión 3 — Crear una capability es el default, no el último recurso

El requirement invierte la carga: si no hay hogar, se crea. La justificación es de descubribilidad, no de pureza taxonómica — una capability nueva y estrecha se encuentra por su nombre, mientras que un requirement de tarjetas escondido en una spec de convenciones no se encuentra nunca. Eso fue literalmente lo que pasó: cinco invariantes contables de tarjeta vivían donde ningún lector de `cards` los iba a ver.

El costo de una capability de más es un archivo chico. El costo de un requirement mal ubicado es que nadie lo lea.

### Decisión 4 — La tabla se mantiene a mano, y el requirement lo dice

La tabla de capabilities meta puede desactualizarse si alguien crea una cuarta. Se acepta a conciencia, con dos mitigaciones: un scenario obliga a que una capability meta nueva se agregue a la tabla, y la lista es corta y de crecimiento raro —muy distinto del inventario de paquetes que `refresh-monorepo-layout` tuvo que sacar de `repo-architecture`, donde el elemento enumerado crece seguido—.

La diferencia entre los dos casos no es de forma sino de tasa de cambio: enumerar algo que cambia todos los meses es una trampa; enumerar algo que cambió tres veces en la vida del proyecto, y cuyos miembros necesitan definición individual, es apropiado.

## Risks / Trade-offs

- **La regla no tiene enforcement automático.** Es una convención escrita y depende de que se lea. Se mitiga ubicándola en `project-conventions`, junto al resto de las reglas de autoría de specs, que es lo que alguien consulta antes de escribir un requirement nuevo.
- **El test por sujeto tiene casos borde.** Un requirement sobre "cómo se documentan las decisiones de arquitectura" habla a la vez de proceso y de arquitectura. El requirement da la salida —si la respuesta nombra dos cosas, probablemente son dos requirements— pero no elimina el juicio, y no pretende hacerlo.
- **Agregar un requirement a `project-conventions` en una change cuyo objetivo es que `project-conventions` no crezca** tiene una ironía evidente. Pasa su propio test: su sujeto es el workflow de autoría de specs, que es proceso de trabajo sobre el repo.
