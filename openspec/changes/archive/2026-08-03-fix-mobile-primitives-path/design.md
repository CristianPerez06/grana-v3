# Diseño — corregir la ruta de los primitivos mobile

## Context

La contradicción no nació de un descuido de redacción: los dos requirements convivían en `project-conventions`, donde discrepaban dentro del mismo archivo. `split-project-conventions` los separó a `repo-architecture` y `ui-foundations` —separación correcta, son temas distintos— y al hacerlo transformó una inconsistencia visible en dos contratos autoritativos que se contradicen sin referenciarse. Aquel change se había prohibido editar contenido, así que dejó la corrección anotada como deuda explícita.

El hecho decisivo es del filesystem, no de interpretación: `apps/mobile/components/ui/` tiene 26 primitivos y `apps/mobile/components/` no tiene ningún `.tsx` suelto. No hay lectura alternativa que salve el texto de `repo-architecture`.

## Goals / Non-Goals

**Goals:**

- Que las dos capabilities digan lo mismo sobre dónde viven los primitivos de mobile.
- Que ningún scenario nombre una ruta que no existe en el repo.
- Que quede escrito **quién es el dueño** del tema, para que la divergencia no se repita.

**Non-Goals:**

- Mover código. Los primitivos ya están donde corresponde; lo que estaba mal era la spec.
- Tocar `ui-foundations`. Ya dice lo correcto; editarla sería ruido.
- Rediseñar la política de paridad web↔mobile. Sólo se corrige la ubicación que menciona.
- Resolver el resto de la deuda que dejó `split-project-conventions` (solapamientos, bimoneda, layout del monorepo). Cada una tiene su propia change.

## Decisions

### Decisión 1 — Gana `ui-foundations`, y se dice explícitamente

La corrección obvia es cambiar la ruta en `repo-architecture`. Lo que no es obvio es qué impide que vuelvan a divergir: son dos archivos que hablan del mismo path sin conocerse, y la próxima edición de cualquiera de los dos puede reintroducir el conflicto.

Por eso el requirement corregido agrega una cláusula de deslinde: las capas de componentes y su ubicación canónica son propiedad de `ui-foundations`, y ante una ruta que aparezca en ambas capabilities, prevalece la de `ui-foundations`. Es una regla de desempate, no una duplicación más.

El criterio de asignación no es arbitrario: "dónde vive un primitivo" es una pregunta del design system, y `ui-foundations` existe justamente para responderla. `repo-architecture` responde "qué va en `packages/` y qué en `apps/`".

**Alternativa descartada:** sacar toda mención de rutas de UI de `repo-architecture` y dejar sólo el puntero. Se descarta porque el requirement necesita nombrar las dos ubicaciones para que su política de paridad se entienda leyéndolo solo; un requirement que obliga a abrir otro archivo para saber de qué habla es peor que uno con una ruta redundante y un desempate declarado.

### Decisión 2 — Se agrega un scenario de ubicación, no sólo se corrige la ruta

Corregir las dos menciones alcanza para que la spec deje de mentir, pero no deja nada que falle si alguien crea un primitivo suelto en `apps/mobile/components/`. El scenario nuevo ("Un primitivo mobile nuevo se crea bajo components/ui/") convierte la convención en algo verificable, y de paso documenta para qué está reservado `apps/mobile/components/`: carpetas por feature.

Es contenido nuevo dentro de un requirement que ya existía, no un requirement nuevo — la política que describe ya estaba vigente, sólo que sin un scenario que la ejerciera.

### Decisión 3 — El scenario roto se corrige en vez de borrarse

El scenario "Una prop nueva en el contrato obliga a mobile a implementarla" nombra `apps/mobile/components/Button.tsx`, que no existe. Se corrige la ruta en lugar de eliminar el scenario: la regla que describe —el contrato compartido rompe el typecheck de mobile hasta que implemente— es válida y verificable, y `apps/mobile/components/ui/Button.tsx` sí existe. El defecto era la ruta, no la idea.

## Risks / Trade-offs

- **Riesgo muy bajo.** La corrección es verificable contra el filesystem y no hay ambigüedad posible. El peor caso es que alguien haya escrito código apoyándose en el texto viejo, pero eso implicaría un `.tsx` suelto en `apps/mobile/components/`, y no hay ninguno.
- **La cláusula de desempate agrega un puntero entre capabilities**, y los punteros envejecen: si `ui-foundations` se renombrara, esta cláusula quedaría colgada. Es el mismo riesgo que ya corre cualquier referencia cruzada del repo, y a cambio evita que la contradicción se reabra en silencio.
- **La ruta sigue estando escrita en dos lugares.** Se acepta a conciencia (ver Decisión 1): la alternativa —dejar `repo-architecture` sin mencionarla— haría el requirement ilegible por sí solo. El desempate declarado es lo que hace que la duplicación sea segura en vez de peligrosa.
