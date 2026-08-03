# Diseño — split de `project-conventions`

## Context

`project-conventions` nació como la capability meta del proyecto y creció hasta 835 líneas / 27 requirements absorbiendo todo lo que no tenía un hogar evidente. Hoy mezcla convenciones de trabajo, arquitectura del repo y reglas contables del producto.

La restricción que domina el diseño de este change es que **OpenSpec no tiene una operación `MOVED`**. Las operaciones soportadas son `ADDED`, `MODIFIED`, `REMOVED` y `RENAMED`. Una reubicación se expresa necesariamente como un par `REMOVED` + `ADDED`, lo cual tiene una consecuencia incómoda: en el vocabulario de la herramienta, mover y borrar se ven igual. Un lector futuro del archive tiene que poder distinguirlos sin ambigüedad, y eso condiciona cómo se escriben los `Reason`/`Migration`.

La segunda restricción es que este change **edita la spec que lo gobierna**. `project-conventions` manda prosa en español bajo `openspec/changes/**` y `openspec/specs/**`, con las keywords del parser en inglés; y exige que cada requirement tenga al menos un `SHALL` o `MUST`. El change no puede violar ninguna de las dos.

## Goals / Non-Goals

**Goals:**

- Que cada requirement quede en la capability que un lector consultaría para encontrarlo.
- Que el texto normativo llegue al destino **byte a byte idéntico** al original.
- Que `project-conventions` quede reducida a una sola pregunta: cómo se trabaja en este repo.
- Que el archive resultante deje claro que las 17 salidas son mudanzas, no bajas.
- Que el change no introduzca referencias colgadas.

**Non-Goals:**

- Corregir requirements desactualizados, ambiguos o duplicados. Se anotan en el `proposal.md` y se difieren.
- Deduplicar los cuatro solapamientos detectados con las capabilities destino.
- Agregar la regla de admisión que evitaría que `project-conventions` se vuelva a llenar. Es un requirement nuevo y se propone como change siguiente.
- Tocar código, migraciones o tests.

## Decisions

### Decisión 1 — La extracción del texto se hace por script, no a mano

El riesgo central de una reubicación de 17 requirements (~570 líneas de prosa normativa en español, con backticks, tablas y bloques de código) es que un copiado manual altere una palabra sin que nadie lo note. Un `SHALL` que se convierte en `SHOULD` en el traslado es un cambio de significado invisible en el diff, porque el diff muestra un bloque agregado en un archivo y un bloque borrado en otro — nunca los enfrenta.

Por eso los bloques `ADDED` se generan con un script que parte el spec maestro por `### Requirement:`, indexa los bloques por título y los emite sin tocarlos. El script además:

- **Falla si un título de la lista de destinos no existe** en el spec — protege contra typos en la clasificación.
- **Falla si algún requirement del spec no quedó clasificado** ni como movido ni como que se queda — hace imposible perder uno en silencio.
- Verifica que ningún requirement tenga dos destinos.

La verificación posterior (ver `tasks.md`) vuelve a comparar cada bloque emitido contra el original con `diff`, ahora que los archivos existen. Es redundante a propósito: el script podría tener un bug de recorte de bordes (líneas en blanco finales, separadores `---`) y el `diff` lo atraparía.

**Alternativa descartada:** copiar a mano y revisar leyendo. Con 17 requirements y ~570 líneas, la revisión por lectura no es confiable y no deja evidencia reproducible.

### Decisión 2 — Cada `Reason` declara "reubicación, no deprecación" y nombra el destino

Como `REMOVED` es el mismo marcador para "esta regla dejó de existir" y para "esta regla se mudó", el archive quedaría ambiguo. Un LLM leyendo el archive dentro de seis meses tiene que poder responder "¿esta regla sigue vigente?" sin abrir otro archivo.

Cada uno de los 17 `REMOVED` lleva por lo tanto:

- Un `**Reason**` que empieza declarando **"Reubicación, no deprecación"**, explica por qué esa capability es el hogar correcto, y cierra con "la regla sigue vigente sin cambios".
- Un `**Migration**` que dice "ninguna migración de código ni de datos" y **nombra el archivo destino** (`openspec/specs/<capability>/spec.md`), para que la regla se pueda seguir en un solo salto.

Además, la sección `## REMOVED Requirements` abre con un párrafo que declara la naturaleza del bloque entero antes del primer requirement. Un lector que abre el archive por el medio no depende de haber leído el `proposal.md`.

### Decisión 3 — Dos capabilities nuevas, no una ni ninguna

Después de sacar las 9 reglas de dominio quedan 18 requirements, y no forman un conjunto coherente: conviven "cómo se nombra una branch" con "dónde vive un módulo isomórfico" y con "qué primitivo compone una superficie de tarjeta".

Se evaluaron tres particiones:

| Opción | Resultado | Veredicto |
| --- | --- | --- |
| **A** — dejar los 18 juntos | `project-conventions` queda con 18 requirements de tres temas | Descartada: no resuelve el problema, sólo lo achica |
| **B** — `project-conventions` + `repo-architecture` (con UI adentro) | 10 + 8 | Descartada: `repo-architecture` nacería con 8 requirements de dos temas — el mismo grab-bag a menor escala |
| **C** — `project-conventions` + `repo-architecture` + `ui-foundations` | 10 + 3 + 4 (+1 a `route-loading-and-errors`) | **Elegida** |

El criterio de corte es la pregunta del lector, no el tamaño del archivo. "¿Esto va en `packages/` o en `apps/web/lib/`?" y "¿puedo tipear el shell de tarjeta inline?" son dos preguntas de dos momentos distintos del trabajo. Que las respuestas hoy estén en el mismo archivo es un accidente histórico, no una afinidad.

`ui-foundations` además calza con un patrón que el repo ya tiene: `overlay-primitives` y `page-header` son capabilities de UI nombradas por familia de componente. `ui-foundations` es su hermana para los primitivos base (`Card`, `Button`), las capas y los tokens — no una categoría inventada para este change.

Ambos nombres van **sin prefijo de plataforma**, como manda el requirement de specs cross-platform que se queda en `project-conventions`: las reglas aplican a web y a mobile por igual.

**Riesgo asumido:** dos capabilities nuevas nacen sin la regla de admisión que se propone como seguimiento, así que heredan el riesgo de acumulación. Se mitiga con nombres estrechos —`repo-architecture` es sobre el carveado del repo, `ui-foundations` sobre el design system— y no con un nombre paraguas tipo `architecture` que aceptaría cualquier cosa.

### Decisión 4 — Los punteros rotos se reparan en este change

Tres requirements de otras capabilities referencian `project-conventions` para reglas que se están mudando: uno en `transactions` (ordenamiento determinístico), uno en `route-loading-and-errors` (regla del primitivo `Button`) y uno en `page-header` (custom properties de `@grana/ui-tokens`).

Hay tensión con la regla del change ("no editar texto de requirements"). Se resuelve a favor de repararlos, por tres motivos:

1. El defecto **no preexiste**: lo crea esta reubicación. Dejarlo sería mergear a sabiendas una spec que apunta a un lugar donde la regla ya no está.
2. La edición **no toca contenido normativo**. En los tres casos cambia el nombre de una capability dentro de un paréntesis o una cláusula de referencia. Ningún `SHALL`, ningún scenario, ninguna condición.
3. Un change de seguimiento cuyo alcance total fuera "cambiar tres nombres de capability" sería más ceremonia que valor.

Los tres se expresan como `MODIFIED` con el requirement completo restatado —lo que exige OpenSpec— y el `proposal.md` declara exactamente qué cláusula cambia en cada uno, para que el reviewer pueda verificar que no se coló nada más.

Un cuarto puntero, en `mobile-app-shell`, apunta a la regla de "código en inglés" — que **se queda** en `project-conventions`. No se toca.

### Decisión 5 — Los solapamientos se hacen visibles, no se resuelven

Cuatro de las reglas reubicadas ya tienen una gemela en su capability destino (detalle en el `proposal.md`). La tentación es fusionarlas en el mismo movimiento.

Se descarta: elegir qué texto sobrevive es una decisión de contenido, y las gemelas no son idénticas —una suele tener cláusulas que la otra no—. Fusionar mientras se mueve mezcla dos operaciones con perfiles de riesgo muy distintos: mover es mecánico y verificable con `diff`; fusionar exige juicio y puede perder una cláusula sin dejar rastro.

Lo que sí aporta este change es **colocalizar los duplicados**. Hoy la regla de `fx_rate_to_ars` está escrita dos veces en dos archivos separados y nadie las ve juntas; después de este change están en el mismo archivo, a pocas líneas. La deduplicación pasa de ser un hallazgo improbable a ser evidente para el próximo que abra la spec.

## Risks / Trade-offs

- **La spec queda temporalmente con más duplicación que antes.** El requirement de off-ledger de tarjetas pasa de dos copias a tres. Es un empeoramiento real y deliberado, acotado en el tiempo por la change de dedup que se propone como seguimiento. El trade-off se acepta porque la alternativa —fusionar mientras se mueve— cambia significado dentro de un change que se declaró de significado invariante.
- **Conflicto de merge con `cards-mobile-density`.** Ambas tocan `cards`. No hay solapamiento de requirements y el orden propuesto es esa primero; en el peor caso hay un rebase mecánico.
- **Superficie amplia.** Nueve capabilities tocadas en un solo change es mucho, y eso complica el review. Se mitiga con la aritmética explícita del `proposal.md` (17 = 17, 17 + 10 = 27) y con la verificación por `diff` de los cuerpos movidos, que le da al reviewer una forma de confirmar la invariancia sin leer 570 líneas.
- **Los `Purpose` de las capabilities nuevas se escriben en el archivado**, no ahora. Si el archivado se hace apurado, `pnpm openspec:check` falla por los placeholders `TBD` — que es precisamente el comportamiento deseado del gate.
