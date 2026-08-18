# Proposal: collapse-edit-context-into-one-line

## Why

En modo edición, lo que el usuario **no** puede cambiar se dibujaba como una card de filas etiquetadas: TIPO, MONEDA, CUENTA. Tres filas de ~48px cada una, en el mejor lugar de la pantalla, empujando hacia abajo los campos que la persona abrió el formulario para tocar.

La change `show-locked-fields-as-context` —correcta y necesaria— empeoró esa cuenta: al dejar de ocultar el monto y la fecha bloqueados, la card pasa a **seis** filas en el caso de la madre de una compra en cuotas con una cuota paga. Casi una pantalla de teléfono de datos inertes antes del primer campo editable.

El problema no es que la información esté: es el **formato**. Un par label/valor por dato, cada uno repitiendo su propio "— no editable", es el tratamiento que se le da a un campo. Estos no son campos.

## What Changes

- **Una sola línea de contexto**, atenuada, debajo del monto: `Gasto · ARS · Cta remunerada — no editable`. Reemplaza la card de filas en las tres superficies.
- **El caption se dice una vez**, al final de la línea, en lugar de una vez por fila.
- **El monto bloqueado encabeza la línea con peso pleno** (`−$200.000` en negrita sobre el resto atenuado). Es el número identificatorio del movimiento: colapsarlo a micro-texto junto al resto sería perder lo que la change anterior acaba de recuperar.
- **Transferencia y cambio de moneda unen sus dos cuentas** en un segmento con flecha (`Galicia → Brubank`) en vez de dos filas.
- **La card de campos deja de dibujarse vacía**: en web se omite cuando en edición no queda ninguna fila editable (la nativa ya lo hacía — su `GroupCard` devuelve `null` sin hijos).
- **La línea se ubica debajo del héroe en las dos plataformas.** En la nativa el bloque de contexto estaba *arriba* del monto; ahora el héroe abre la pantalla en ambas.

Sin cambios de datos, validación ni contables: la misma información, en un formato proporcional a su importancia.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del formulario único pasa a exigir que el contexto inmutable sea una única línea atenuada bajo el monto —con el monto bloqueado encabezándola— en vez de filas etiquetadas apiladas.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` toca `transactions` sobre requirements disjuntos. Sin solapamiento.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — `contextRows` (array de label/valor) pasa a `contextParts` (array de strings) + `lockedAmount`, renderizados como un `<p>`; se elimina el `map` de filas del `fieldGroup`; el `fieldGroup` devuelve `null` en edición sin filas editables; la línea se monta en `body`, justo después del héroe.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — mismo cambio, y la línea se mueve de arriba del héroe a abajo.
- **i18n**: sin claves nuevas ni huérfanas. `transactions.labels.{type,currency,account,source_account,destination_account,installments,amount,date}` siguen en uso en el alta y en el detalle; sólo dejan de usarse **como etiquetas de estas filas**.
- **Sin impacto** en `@grana/movement-form`, en las server actions ni en el schema.

### Nota sobre el escritorio

Esta pasada **sí** toca el layout de escritorio, a diferencia del resto de la serie de simplificación, que se gateó en `isMobile`. La razón: este bloque no es una divergencia de viewport —era la misma card en ambos— y mantener dos presentaciones de los mismos hechos inmutables duplicaría la lógica sin ganar nada. El escritorio gana lo mismo que el teléfono: menos alto muerto antes del primer campo.
