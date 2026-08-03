# Regla de admisión a las capabilities meta

## Why

`split-project-conventions` desarmó un grab-bag de 835 líneas sacándole 17 requirements a `project-conventions`, pero **no eliminó la causa**. Su propio proposal lo dice: la spec no se degradó por descuido, funcionó como el vertedero por defecto porque era el único lugar que aceptaba cualquier cosa. Esa condición sigue vigente. Mañana aparece una regla sin hogar evidente y el camino de menor resistencia vuelve a ser el mismo archivo.

El mecanismo de la falla no fue negligencia, fue una heurística razonable aplicada mal. "Preferir una capability existente antes que crear una" es un buen consejo, pero combinado con "esta regla no tiene un hogar obvio" produce siempre el mismo resultado: la capability meta gana, porque es la única que acepta cualquier cosa. Nadie decidió llenar `project-conventions`; cada requirement individual pareció una decisión defendible.

Hoy el riesgo es mayor que antes del split, no menor: donde había una capability meta ahora hay tres. `repo-architecture` y `ui-foundations` nacieron hace días con nombres estrechos pero sin nada que impida que se ensanchen.

Este es el último ítem estructural de la deuda que dejó `split-project-conventions`. Los demás limpiaron instancias del problema; éste es el que evita que vuelva.

## What Changes

Se agrega a `project-conventions` un requirement de admisión, `Una capability meta sólo admite requirements cuyo sujeto es el suyo`, que:

- **Nombra las tres capabilities meta y el sujeto de cada una** en una tabla, con la pregunta de lector que responde. Sin eso, "capability meta" es una categoría que cada quien interpreta a su gusto.
- **Define el test de admisión por sujeto, no por ámbito.** La distinción es la que falló antes: una regla de aritmética decimal *aplica* a todo el repo, pero *habla* de plata. Aplicabilidad universal no es lo mismo que ser una regla meta, y confundirlas es lo que mandó nueve reglas de dominio a una spec de convenciones.
- **Corta el razonamiento por descarte**: la ausencia de un hogar obvio NO es razón para usar una capability meta. Si la capability destino no existe, se crea.
- **Acota la heurística de "preferir lo existente"** a capabilities cuyo sujeto coincide con el del requirement, y dice explícitamente que no habilita a preferir una meta.
- **Da un test de una línea**: "¿de qué habla este requirement?" — la respuesta nombra la capability.
- **Se aplica a sí mismo hacia adelante**: una capability meta nueva declara su sujeto en su `Purpose` y se agrega a la tabla.

El requirement se ubica en `project-conventions` porque su sujeto **es** el proceso de trabajo sobre el repo —específicamente el workflow de autoría de specs, que esa capability ya gobierna con el requirement de specs cross-platform—. Ubicarlo en cualquier otro lado violaría la regla que enuncia.

No es **BREAKING**: no reubica ni modifica ningún requirement existente. Los 10 requirements que hoy tiene `project-conventions` pasan el test de admisión sin cambios.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `project-conventions`: 1 `ADDED` — el requirement de admisión. Queda con 11 requirements.

## Impact

- **Código**: ninguno. No se toca `apps/`, `packages/`, `supabase/migrations/` ni tests.
- **Datos**: ninguno.
- **Specs**: 1 capability tocada, 1 `ADDED`. Ningún requirement existente se modifica.
- **Efecto real**: aplica a la autoría futura de specs. No reordena nada de lo que hay hoy, y no pretende hacerlo — es un guardarraíl, no una migración.
- **Riesgo**: bajo. El riesgo residual es que la regla se ignore, que es el mismo riesgo de cualquier convención escrita; se mitiga poniéndola donde un colaborador que va a escribir un requirement ya está mirando.
- **Solapamiento con changes activas**: ninguna. No hay changes activas.
