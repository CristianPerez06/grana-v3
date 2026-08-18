# Proposal: trim-edit-immutable-context

## Why

En modo edición, lo que el usuario **no** puede cambiar se dibujaba como una card de filas etiquetadas: TIPO, MONEDA, CUENTA. Tres filas de ~48px cada una, en el mejor lugar de la pantalla, empujando hacia abajo los campos que la persona abrió el formulario para tocar.

La change `show-locked-fields-as-context` —correcta y necesaria— empeoró esa cuenta: al dejar de ocultar el monto y la fecha bloqueados, la card pasaba a **seis** filas en el caso de la madre de una compra en cuotas con una cuota paga. Casi una pantalla de teléfono de datos inertes antes del primer campo editable.

El diagnóstico no era el formato sino el **contenido**: la mitad de esas filas repetía algo que ya estaba a la vista. El tipo se lee del signo y el color del monto (`−$58.000` en terracota es un gasto). La moneda es el chip del propio bloque del monto. Y el monto es el bloque del monto. Sólo la cuenta, la cantidad de cuotas y la fecha bloqueada viven exclusivamente ahí.

## What Changes

- **El contexto inmutable enuncia sólo lo que no está a la vista en otro lado**: la cuenta (o las dos puntas de una transferencia/cambio), la cantidad de cuotas de una madre, y la fecha cuando `getEditableFields` la bloquea. Se van las filas de **tipo** y **moneda**.
- **El monto conserva siempre su bloque de héroe.** Cuando está bloqueado, el héroe se dibuja **read-only** —misma card, mismo cuerpo tipográfico, sin input, sin calculadora, la moneda como chip estático y el caption de "no editable"— en vez de omitirse.
- **El formato sigue siendo filas etiquetadas** (etiqueta · valor · "no editable"), en su propia card entre el héroe y los campos editables.
- **La card no se dibuja vacía**: cuando no queda ninguna fila (un pago de resumen con cuenta y fecha editables), no hay card. En la nativa `GroupCard` ya devolvía `null` sin hijos; en web hizo falta el guard.

Sin cambios de datos, validación ni contables.

## Dos intentos descartados en el camino

Quedan anotados porque el razonamiento vale más que el resultado:

1. **Colapsar todo a una línea atenuada** (`Gasto · ARS · Visa BBVA — no editable`). Resolvía el alto pero creaba un huérfano visual: una tira de texto gris sin contenedor, flotando entre cards redondeadas. Y seguía diciendo lo mismo que el héroe.
2. **Que el monto bloqueado encabezara esa línea en negrita.** Peor: como un monto bloqueado no dibujaba héroe, la línea pasaba a ser lo primero del panel y el número que identifica al movimiento terminaba siendo lo más chico de la pantalla.

Los dos fallaban por lo mismo: buscaban comprimir el contenedor en vez de sacar lo que sobraba adentro.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del formulario único pasa a acotar qué enuncia el contexto inmutable (sólo lo que no está a la vista) y a exigir que el monto conserve su bloque de héroe, read-only cuando está bloqueado.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` toca `transactions` sobre requirements disjuntos. Sin solapamiento.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — `contextRows` se acota a cuenta/cuotas/fecha y sale del `fieldGroup` a su propia card; el héroe gana su variante read-only; `TYPE_LABELS` queda sin uso y se elimina.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — mismo cambio; además la card de contexto se mueve de **arriba** del héroe a **abajo**, igualando el orden de web.
- **i18n**: sin claves nuevas. `transactions.labels.type` y `labels.currency` siguen en uso en el alta y el detalle.
- **Sin impacto** en `@grana/movement-form`, en las server actions ni en el schema.

### Nota sobre el escritorio

Esta pasada **sí** toca el layout de escritorio, a diferencia del resto de la serie de simplificación, que se gateó en `isMobile`. La razón: este bloque no es una divergencia de viewport —era la misma card en ambos— y mantener dos presentaciones de los mismos hechos inmutables duplicaría la lógica sin ganar nada.
