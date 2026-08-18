# Design: collapse-edit-context-into-one-line

## Decisión 1 — Línea, no card

Tres formatos posibles para el contexto inmutable:

1. **Card de filas label/valor** (lo que había): explícito, etiquetado, y caro — ~48px por dato, más el borde de la card.
2. **Chips**: compacto, pero un chip es una affordance; sugiere que se puede tocar, que es exactamente lo contrario de lo que estos datos son.
3. **Una línea de texto atenuado**, separada por `·`.

Se eligió (3). Es el tratamiento que el producto ya usa para metadata inerte, no compite con nada y cuesta una línea (dos cuando envuelve). El costo aceptado es que se pierden las etiquetas: la línea dice `ARS`, no `MONEDA: ARS`. Es aceptable porque los valores son autodescriptivos en su contexto —un código de moneda, un nombre de cuenta, un tipo de movimiento— y el caption final aclara la naturaleza del conjunto.

## Decisión 2 — El monto bloqueado no se atenúa

La change anterior (`show-locked-fields-as-context`) existió justamente para que el monto de un consumo pagado no desapareciera. Mandarlo a micro-texto atenuado dentro de la línea sería deshacer eso por la puerta de atrás: técnicamente visible, prácticamente perdido.

Por eso el monto, cuando está bloqueado, encabeza la línea en `font-bold text-text` mientras el resto va en `text-text-muted`. La línea queda con dos niveles: el hecho que importa, y la metadata alrededor. Cuando el monto **sí** es editable no aparece en la línea — ya está el héroe arriba, en tamaño completo.

Esto refina la decisión del design anterior ("el monto abre el bloque y la fecha lo cierra"), que anticipaba explícitamente esta pasada: *"si más adelante el bloque inmutable se colapsa en una sola línea, esta decisión no estorba"*. Se cumplió: las filas ya eran un conjunto homogéneo y colapsarlas fue directo.

## Decisión 3 — Debajo del héroe, en las dos plataformas

En web el bloque ya vivía después del monto (dentro de la card de campos). En la nativa vivía **antes**, herencia de haber ocupado el lugar del selector de tipo. Se unifica abajo: el héroe abre la pantalla, la línea lo anota, los campos editables siguen. Cuando el monto está bloqueado no hay héroe y la línea queda arriba de todo, llevando ella misma el número — que es el orden correcto en ese caso.

## Decisión 4 — El escritorio entra

El resto de la serie de simplificación se gateó en `isMobile` para no tocar el escritorio. Acá no: la card de contexto era idéntica en los dos viewports, así que un gate significaría **dos** presentaciones de los mismos datos, mantenidas a mano. El argumento que motiva el cambio (alto muerto antes del primer campo editable) vale igual en una ventana ancha. Es una excepción deliberada al gate, no un descuido.

## Riesgo — líneas largas

El peor caso es la madre de una compra en cuotas con el monto bloqueado: `−$200.000 · Compra en cuotas · 12 cuotas · ARS · Visa · 28 jul 2026 — no editable`. En un teléfono angosto eso envuelve a dos o tres líneas. Sigue siendo una fracción de las seis filas que reemplaza, y envolver es preferible a truncar: ningún dato se corta. Por eso la línea usa `leading` holgado y no aplica `numberOfLines` ni `truncate`.
