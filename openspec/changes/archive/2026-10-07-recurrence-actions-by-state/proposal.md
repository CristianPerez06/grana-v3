## Why

Después de catorce changes seguidos sobre recurrencias, el spec dice **qué** se puede hacer con un vencimiento pero no **dónde**: sobre qué vencimiento se ofrece «Ya lo pagué», «Ya lo tengo cargado», «Confirmar», «Omitir» y «Desvincular». Hoy esa decisión vive en cuatro condiciones distintas, una por pantalla, deducidas del código, y una de ellas dice lo contrario del spec: las dos salidas nuevas se ofrecen sólo sobre un vencimiento que **todavía no existe como fila**, cuando el spec de vincular contempla explícitamente «resolver la que el generador ya dejó pendiente». Es la causa del #162. Además el spec se contradice en dos lugares, siete comentarios del código siguen afirmando que «si una ocurrencia existe, su fecha ya pasó» (el supuesto que el último QA encontró roto tres veces), y 33 mensajes de rechazo del módulo están escritos en español fijo: en inglés aparecen en español, y en la app nativa casi todos se degradan a «Algo salió mal».

## What Changes

- **El spec dice dónde va cada acción**, con una sola regla: qué vencimiento se **anuncia** como próximo y sobre qué vencimiento se puede **operar** son dos preguntas distintas, y la segunda no puede excluir un vencimiento por el hecho de que ya exista. Se escribe la tabla por estado del vencimiento (proyectado, existente sin resolver, resuelto registrando, resuelto vinculando), la regla para reglas pausadas, y que web y nativo ofrecen las acciones sobre el **mismo** conjunto de vencimientos. Lo que hoy no se cumple queda nombrado como divergencia conocida, con su ticket (#162), para que ninguna pantalla se dé por cumplida: el bloque «Vencimientos por revisar» y el historial de la ficha todavía no ofrecen vincular, y el hub web y el nativo no ofrecen las acciones sobre los mismos vencimientos.
- **Se corrige la frase del bloque de por revisar** que prohibía «introducir una acción nueva». Se escribió para el aviso de regla trabada y, leída sola, prohíbe el arreglo del #162.
- **Se corrigen dos contradicciones del spec.** Decía que una regla en tarjeta USD pide cotización al confirmar, y cuatro páginas después que no la exige: queda lo segundo, que es lo que la app hace. Decía que la próxima fecha se calcula «honrando `last_generated_date`», y en otro requirement que ninguna proyección puede usar ese cursor: queda lo segundo.
- **Los mensajes de rechazo del módulo se traducen al idioma del usuario**, en web y en nativo, con el mismo mecanismo por código que ya usan los de vincular. Qué ve el usuario: «Esta instancia ya fue resuelta» en vez de «Algo salió mal» en nativo, y «This occurrence was already resolved» en vez de español en una app en inglés.
- **Se reescriben los comentarios del código que afirman el supuesto viejo** («sólo se materializa hasta hoy», «una pendiente por regla», «confirmar propaga el importe a la regla», «finalizada se deriva de la fecha de fin»). No cambian comportamiento; cambian lo que una sesión nueva lee como verdad.

**Lo que NO se hace acá:** no se implementa el #162 (vincular desde el bloque y desde la ficha) ni se iguala el hub web al nativo; el spec los deja escritos como divergencia conocida y el arreglo es un change propio. No se toca el #104. No se corrige la prioridad del lote del generador que trata una ocurrencia resuelta por anticipado como «la actual ya materializada»: queda en `findings.md`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  - **ADDED** «Qué se puede hacer sobre un vencimiento depende de su estado, no de la pantalla»: la tabla de acciones por estado, la separación anunciar/operar, reglas pausadas, paridad web/nativo, y la divergencia conocida del #162.
  - **ADDED** «Los rechazos del módulo de recurrencias se dicen en el idioma del usuario»: todo mensaje de guarda que llega a pantalla sale del catálogo, en las dos plataformas.
  - **MODIFIED** «El modulo Movimientos muestra pendientes recurrentes separados del historial»: la frase «NO SHALL introducir una acción nueva» pasa a hablar sólo del aviso de regla trabada y delega el conjunto de acciones al requirement nuevo.
  - **MODIFIED** «El usuario puede gestionar, pausar y eliminar reglas recurrentes»: la próxima fecha se deriva descartando el conjunto de fechas cubiertas, no «honrando `last_generated_date`».
  - **MODIFIED** «El usuario puede crear una regla recurrente directamente, sin movimiento de origen»: la regla en tarjeta USD no pide cotización al confirmar; la conversión es al pagar el resumen.

## Impact

- `openspec/specs/transactions/spec.md` (al archivar).
- `packages/recurrences/src/mutations.ts`, `link.ts`: cada rechazo lleva además un código de guarda; se exporta la lista de códigos. `types.ts`, `queries.ts`: comentarios.
- `packages/i18n-messages/src/es.json` y `en.json`: sección `recurrences.guards`.
- `apps/web/app/_actions/recurrences.ts` y `apps/mobile/lib/recurrences/mutators.ts`: traducen el código de guarda antes de mostrar el texto.
- Comentarios en `apps/web/app/(app)/transactions/recurring/_components/recurring-tabs.tsx`, `apps/mobile/lib/recurrences/queries.ts`, `packages/dashboard/src/queries.ts`, `packages/money-logic/src/recurrence-end-condition.ts`.
- Tests: el catálogo tiene todos los códigos en los dos idiomas y los dos idiomas difieren; nativo traduce el código de guarda en las mutaciones de ciclo de vida y en los formularios.
- Sin migraciones. Sin cambios de datos.
