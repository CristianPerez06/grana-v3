# Design: drop-edit-type-selector

## Decisión — sacar el control, no rediseñarlo

Había tres salidas para la tira de cinco tipos cortada en la edición mobile-web:

1. **Replicar el control simplificado del alta** (dos primarias + "Otros") en edición, read-only.
2. **Mostrar sólo el tipo del movimiento**, como una etiqueta o un chip único.
3. **No mostrar selector**, y dejar el tipo en las filas de contexto read-only.

Se implementó (1) primero y se descartó al verlo funcionando. El argumento en contra es el mismo que ya condenaba al `Segmented` deshabilitado: **un selector que no selecciona no es un selector**. Peor todavía en la partición nueva, porque "Otros" no nombra un tipo — nombra una lista. El usuario lee una promesa de despliegue y toca; no pasa nada. Un control roto es peor que ningún control.

(2) evita la promesa falsa pero introduce un cuarto tratamiento visual del tipo (alta mobile, alta escritorio, edición, filas de contexto) sin ganar información: la etiqueta diría lo mismo que la fila que está diez píxeles más abajo.

Se eligió (3). El tipo **es** contexto inmutable, igual que la moneda y la cuenta, y ya existía el lugar donde esos tres se enuncian con el mismo tratamiento y el mismo caption de "no editable". Poner los tres juntos es más honesto que tener uno con forma de control y dos como filas. El dato además está reforzado por el héroe del monto, que ya distingue el tipo por signo y color (`− $ 200.000` oscuro para gasto, `+` en verde para ingreso).

Como bonus, la nativa —que ocultaba el selector desde el principio— deja de ser la excepción y pasa a ser la regla: las tres superficies convergen sin tocar su código.

## Qué no cambia

- El **alta**: partición primario/"Otros" en mobile, `Segmented` de cinco en escritorio, elegibilidad de los tipos secundarios, copy. Todo igual.
- Las reglas de **editabilidad** (`getEditableFields`) y las mutations. El tipo ya era inmutable; esto sólo deja de fingir lo contrario.
- La fila "TIPO" de la **madre de una compra en cuotas**, que dice "Compra en cuotas" y no el tipo contable. Sigue tal cual.

## Detalle de implementación

`typeSelector` pasa a ser `null` en edición, y el header del drawer condiciona su wrapper (`<div className="mt-4">`) a que haya algo que envolver: si no, quedaría un contenedor vacío empujando 16px entre el título y el monto. En el layout de página el selector es hijo de un `flex flex-col gap-4`, así que un `null` no deja hueco y no necesita gate.

La opción `disabled: isEdit` del `Segmented` se elimina en vez de dejarse: en el único branch que ahora la evalúa, `isEdit` es siempre `false`.
