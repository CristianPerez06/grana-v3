# Proposal: simplify-movement-advanced-sections

## Why

El alta de movimientos ya converge en las superficies mobile (web-vista-mobile y app nativa): tabs Gasto/Ingreso/Otros, hero de monto, calculadora, chips de clasificación frecuente y campos secundarios en una tarjeta única. Lo que quedó sin pulir es el **despliegue de las tres secciones avanzadas de Capa 1** —Reintegro, Compartido (split) y Repetir (recurrencia)—: los chips de activación son paritarios, pero **los parámetros que se revelan al activarlas divergen entre superficies y cargan más superficie de la necesaria**.

Auditoría (14-ago-2026), sobre `apps/web/lib/transactions/components/movement-form.tsx` (rama mobile) y `apps/mobile/components/transactions/MovementForm.tsx`:

- **Reintegro.** Al activarlo, el card revela de una todos sus controles: monto estimado, la fila "% del gasto / Tope", la cuenta de acreditación y el "ya me lo acreditaron". Es la sección más cargada de las tres (el usuario la señaló como la que "hay que simplificar"). Además los controles divergen: en web el "ya me lo acreditaron" es un `<input type="checkbox">` crudo, el destino a cuenta/resumen son `<input type="radio">` crudos y la cuenta un `<select>`; en nativo son `Switch`, `RadioRow` y un picker de sheet. La regla del repo dice que superficies equivalentes usan el primitivo equivalente: los controles crudos de web-mobile son los outliers.
- **Compartido.** Divergencia **funcional**, no solo visual. Web ofrece un **input de porcentaje libre (1–99)** más un `Switch` "es 100% del otro" (borde 0/100); nativo ofrece un `Segmented` de **tres presets fijos** (100/50/0) y **no permite un 70/30**, en contra de su propio requirement (`transactions` §alta-nativa: "cualquier reparto") y del `shared` §split (editor `1..99`). Encima cada superficie usa claves i18n distintas (`shared.split.*` vs `transactions.form.split_*`).
- **Repetir.** Divergencia menor: el intervalo custom elige la unidad con un `<select>` en web y con chips en nativo; el resto (chips de frecuencia, count, fecha fin) ya está alineado.

El hook `useMovementForm` ya expone un modelo de datos único (`splitFirstPct: number` 0–100, `reimbursementReceivedNow: boolean`, `intervalUnit`), así que estas divergencias son **puramente de presentación**: se resuelven sin tocar reglas contables ni el contrato del hook.

## What Changes

Bajo la lente de "menos taps / superficie mínima" y paridad mobile-web ↔ nativo:

- **Reintegro — superficie progresiva y controles paritarios.** El card revelado muestra por defecto solo lo esencial: **monto estimado** + **"ya me lo acreditaron"**. El **cálculo por %/tope** pasa detrás de un disparador de un gesto ("calcular por %"), en lugar de estar siempre visible. La **cuenta de acreditación** se oculta cuando hay una sola cuenta cash/bank elegible (misma disciplina que el ocultamiento de la cuenta de origen). Ambas superficies usan los mismos primitivos: `Switch` para "ya me lo acreditaron" (web deja el checkbox crudo) y filas de opción tipo `RadioRow` para el destino a cuenta/resumen (web deja los radios crudos).
- **Compartido — presets de un tap + escape a % libre, paritario.** Ambas superficies ofrecen **Vos / Mitad / El otro** como chips de un gesto (cubren el ~95%) más un chip **"Otro %"** que revela el input de porcentaje libre. El preset **"El otro" fija 0/100**, así que el `Switch` suelto "es 100% del otro" **desaparece** (queda absorbido en el preset). Web recupera nada y nativo **gana** el reparto arbitrario que hoy le falta. Se unifica el copy i18n en una sola familia de claves.
- **Repetir — unidad de intervalo como chips en ambas.** El `<select>` de unidad de web-mobile pasa a chips, espejo del nativo. Sin otros cambios.

Nada de esto altera un campo, un tipo de movimiento, una regla contable ni el contrato del hook. La paridad se evalúa por **rol y estructura**, no por píxeles. La superficie **desktop** de web no se toca (sigue gateada por breakpoint).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. **Nuevo requirement** "El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile" — regla transversal que gobierna, por rol y estructura, cómo se revelan los parámetros de Reintegro, Compartido y Repetir en web-mobile y en nativo (disclosure del %/tope, ocultamiento de la cuenta de acreditación, Switch/RadioRow, presets + "Otro %", chips de unidad).
  2. "El formulario ofrece las funcionalidades avanzadas según el contexto y las activa en el lugar" — se refina para exigir superficie mínima al revelar (no volcar todos los controles secundarios de una).
  3. "La app nativa expone la pantalla de alta de movimiento `/transactions/new`" — se alinea la descripción de los controles: el split pasa a presets + "Otro %", el "ya lo recibí" es `Switch`, y el %/tope del reintegro vive detrás de un disclosure.

- `shared`:
  1. "El usuario puede marcar un gasto como compartido con un split por porcentaje" — el caso 0/100 deja de expresarse con un **toggle dedicado** y pasa a ser el **preset "El otro"** dentro del control de presets; el editor de % libre se revela con "Otro %". La semántica (`{pagador: 0, otro: 100}`, porcentajes 0–100 que suman 100) no cambia; el editor del **split por defecto del hogar** en `/shared/settings` sigue acotado a `1..99` y **no** se toca.

## Impact

- **Sin migración, sin cambios de schema, sin cambios en el hook compartido.** El estado (`splitFirstPct`, `reimbursementReceivedNow`, `reimbursementPercent`/`Cap`, `intervalUnit`) ya existe.
- `apps/web/lib/transactions/components/movement-form.tsx` (rama `isMobile`): reintegro (disclosure %/tope, ocultar cuenta única, checkbox→`Switch`, radios→filas de opción), compartido (presets + "Otro %", quita el `Switch` fully-other), repetir (`<select>` unidad → chips). La rama desktop queda intacta.
- `apps/mobile/components/transactions/MovementForm.tsx`: compartido (Segmented de 3 presets → presets + "Otro %" con input libre); reintegro (disclosure del %/tope; ocultar cuenta cuando hay una sola). El `Switch`/`RadioRow` ya existen en nativo.
- `packages/i18n-messages`: unificación de las claves del split (una sola familia usada por ambas superficies) y copy nuevo del disparador "Otro %" / "calcular por %".
- **UX**: el card de Reintegro arranca con dos controles en vez de cinco; el split se resuelve de un tap en el caso común y conserva el reparto fino; ambas superficies quedan indistinguibles por rol. Ningún gasto simple atraviesa nada de esto (las secciones siguen arrancando desactivadas).
- **Revisión**: el web-vista-mobile lo verifica el usuario en el navegador (viewport de celular); el nativo lo revisa el tech lead (sin device en esta sesión).
