# Proposal: drop-edit-type-selector

## Why

El tipo de un movimiento es **inmutable post-creación** — está especificado así para ingresos/gastos, transferencias, ajustes y cambios de moneda. Un gasto no se convierte en ingreso ni en ajuste: para eso se borra y se carga de nuevo.

Aun así, el formulario de edición seguía dibujando un **selector de tipo**, y cada superficie lo hacía distinto:

- **Web escritorio**: el `Segmented` de cinco tipos en estado `disabled`.
- **Web en viewport angosto**: el mismo `Segmented`, pero **cortado** por el ancho del teléfono (se leía "Gasto · Ingreso · Transferencia · Ajuste · Ca…"). El gate del rediseño de superficie era `isMobile && !isEdit`, así que la edición caía al branch de escritorio.
- **App nativa**: sin selector. El tipo aparecía como fila de contexto read-only.

Un primer intento de esta pasada replicó el control simplificado del alta (dos primarias + "Otros") en edición, read-only. Probándolo quedó claro que el problema no era **cuál** control, sino que hubiera control: una tira de opciones que no se pueden elegir es chrome con forma de acción. "Otros" es el caso peor — la palabra promete una lista que nunca se abre. La nativa, que ya no lo mostraba, tenía razón.

## What Changes

- **En edición no hay selector de tipo, en ninguna superficie.** Se va el `Segmented` deshabilitado del escritorio y se va la tira en viewport angosto. La nativa queda como está: ya lo hacía.
- **El tipo se enuncia como contexto read-only**, junto a la moneda y la(s) cuenta(s), con el mismo caption de "no editable" que esas dos. Los tres datos inmutables quedan con el mismo tratamiento, en el mismo lugar, en vez de uno disfrazado de control y dos como filas. En la madre de una compra en cuotas la fila sigue diciendo "Compra en cuotas".
- **El alta no se toca.** La partición `Gasto` / `Ingreso` / "Otros" en mobile, el `Segmented` de cinco en escritorio, la elegibilidad de los tipos secundarios y todo el flujo quedan exactamente como están.
- **Efecto lateral querido**: el drawer de edición en viewport angosto arranca directo en el monto, sin una fila de chrome muerta entre el header y el héroe.

Sin cambios de datos, de validación ni contables: el tipo ya era inmutable en edición antes y después.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del selector de tipo pasa a declararse explícitamente como regla del **alta**, y su escenario de edición cambia de "el tipo se muestra como contexto inmutable / la partición no ofrece cambiarlo" a "no hay selector de tipo". El requirement del drawer en modo edición deja de decir "el selector de tipo está deshabilitado".

El requirement de la edición en la app nativa **no se toca**: ya dice "ocultar el selector de tipo (el tipo es inmutable); mostrar filas de contexto read-only". Lo que hace esta change es elevar esa regla —que hoy vale sólo para la nativa— a regla de las tres superficies.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` también tiene deltas sobre `transactions`, pero sobre requirements disjuntos (proyección de recurrencias, duplicados de reglas, borrado, edición desde el módulo global). No hay solapamiento con los dos requirements que toca esta change; pueden avanzar y archivarse en cualquier orden.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — único archivo con cambio de comportamiento. `typeSelector` pasa a ser `null` cuando `isEdit` (antes: strip en create mobile, `Segmented` deshabilitado en el resto); el header del drawer deja de reservar el espacio del selector cuando no hay nada que poner; la fila "TIPO" de `contextRows` queda intacta y pasa a ser la única fuente del dato.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — **sin cambios**. Ya ocultaba el selector en edición.
- **`docs/design/movement-form/README.md`** — nota en la sección Tabs: el control es del alta; en edición no existe.
- **i18n**: sin claves nuevas ni claves huérfanas (`transactions.form.other_types` y `transactions.labels.type` siguen en uso por el alta y por la fila de contexto).
- **Sin impacto** en `@grana/movement-form`, en `@grana/ui-contracts`, en las server actions ni en el schema.
