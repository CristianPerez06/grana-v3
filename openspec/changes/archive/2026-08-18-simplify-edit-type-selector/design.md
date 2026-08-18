# Design: simplify-edit-type-selector

## Decisión 1 — Mostrar el selector read-only, no ocultarlo

Había tres salidas para la tira rota de la edición web:

1. **Ocultar el selector en edición**, como ya hace la nativa, y dejar el tipo sólo en la fila de contexto.
2. **Mostrar sólo el tipo del movimiento**, como una etiqueta o un chip único.
3. **Mostrar el selector completo simplificado**, con el tipo activo y nada accionable.

Se eligió (3). El pedido es continuidad: que la edición se vea como el alta. (1) resuelve el defecto pero deja dos pantallas con forma distinta según el modo, y obliga a la fila "TIPO" a cargar sola con la información. (2) es honesto pero introduce un cuarto tratamiento visual del tipo (alta mobile, edición mobile, escritorio) para nada. (3) reusa el control que el usuario ya conoce del alta y comunica el tipo en el mismo lugar donde lo eligió.

El costo aceptado es que en edición se ven opciones que no se pueden elegir. Se mitiga con el propio contraste del control —la opción activa tiene fondo de card y texto pleno, las otras van en `text-text-muted`— que es el mismo lenguaje del alta, y con que nada responde al tap: no hay estado pressed, no abre nada, no hay handler.

## Decisión 2 — `span` / `View` en vez de `button` / `Pressable` deshabilitado

En edición los slots no son controles deshabilitados: son texto. Un `<button disabled>` o un `Pressable` con `disabled` seguirían siendo focusables/anunciables como controles rotos, y en RN un `Pressable` sin `onPress` igual toma el rol táctil. Renderizar `span` (web) y `View` (nativa) deja el control fuera del orden de tabulación y del árbol de acciones, que es lo correcto para algo inmutable.

Por lo mismo, en web el contenedor pasa a `role="group"` + `aria-label` del tipo, con `aria-current` en la opción activa, y en nativa el `accessibilityRole` cae de `radiogroup` a `none` en edición: no hay nada que elegir, así que anunciarlo como grupo de radios sería mentira.

El popover de "Otros" (web) y el `SelectSheet` (nativa) **no se montan** en edición. No alcanza con no abrirlos: el árbol de opciones secundarias no existe.

## Decisión 3 — El slot "Otros" también cuando el tipo ya no es elegible

`secondaryTabs` sale de `eligibleSecondaryTabs(accounts)`, que gatea por el estado **actual** de las cuentas: `transferencia` pide dos o más cuentas propias, `cambio de moneda` pide capacidad bimoneda. Un movimiento viejo puede ser de un tipo que hoy ya no es elegible —una transferencia hecha cuando había dos cuentas y ahora queda una—. Con la condición del alta (`secondaryTabs.length > 0`) ese slot no se dibujaría y la edición no mostraría el tipo en ninguna parte.

Por eso la condición en edición es `secondaryTabs.length > 0 || isSecondaryTab`. `isSecondaryTab` sale de `SECONDARY_TABS.includes(tab)` —la pertenencia al conjunto, no la elegibilidad—, así que es verdadero para el movimiento aunque su tipo ya no se ofrezca en un alta nueva.

## Decisión 4 — Podar la fila "TIPO", con la excepción de la madre de cuotas

Con el selector nombrando el tipo, la fila "TIPO — Gasto — no editable" justo debajo lo dice dos veces seguidas. Se poda en mobile.

La madre de una compra en cuotas es la excepción: su fila no dice el tipo, dice **"Compra en cuotas"**. El selector la muestra como `Gasto` (que es lo que es contablemente), así que la fila sigue aportando la naturaleza del movimiento y se mantiene. En escritorio la fila queda intacta en todos los casos, porque ahí el selector sigue siendo el `Segmented` completo y el gate de la poda es `isMobile`.

## Riesgo conocido — flash en `/transactions/[txId]/edit` (web)

`useIsMobile()` devuelve `false` hasta montar (es SSR-safe por diseño), así que la ruta de edición server-rendered pinta un instante el layout de escritorio antes de conmutar al mobile. **No es nuevo**: hoy ya pasa con el hero, las filas y el resto del formulario, que están gateados por la misma bandera desde `simplify-movement-form-surface`. Este cambio suma el selector a ese conjunto, no cambia la naturaleza del flash. Resolverlo bien es un cambio aparte (gate por CSS o breakpoint conocido en servidor) y no pertenece a esta pasada.

## Fuera de alcance

- El layout de **escritorio** en edición (Segmented deshabilitado + fila "TIPO"). Sigue igual.
- El **alta**: ni la partición primario/"Otros", ni la elegibilidad, ni el copy cambian.
- Las reglas de **editabilidad** (`getEditableFields`) y las mutations. El tipo ya era inmutable.
