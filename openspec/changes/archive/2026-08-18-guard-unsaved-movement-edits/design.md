# Design: guard-unsaved-movement-edits

## Decisión 1 — El snapshot vive en el hook, no en cada plataforma

`isDirty` podría calcularse en cada `MovementForm` comparando props contra estado. Se hizo en el hook porque el estado **es** del hook: web y la nativa sólo lo leen. Un cálculo por plataforma se desincroniza en cuanto alguien agregue un campo — exactamente el patrón "mirror … keep in sync" que el repo prohíbe.

La implementación es un `JSON.stringify` de una tupla de campos comparado contra el valor del **primer render**, guardado en un `useRef`. El primer render es el estado pristine: todos los `useState` siembran de `edit` (o de los defaults de alta) y ninguna cascada corre antes del paint. Es O(campos) por render sobre un puñado de strings — irrelevante frente a lo que ya cuesta renderizar el formulario.

Se descartó comparar contra un "snapshot inicial" recalculado desde `edit`: obligaría a duplicar cada expresión de inicialización y a mantener las dos copias en línea.

## Decisión 2 — El reintegro entra al snapshot sólo cuando está activo

El hook tiene **un** efecto de montaje: cuando `reimbursementAccountId` está vacío, elige una cuenta por defecto una vez que las cuentas están cargadas. Esa escritura ocurre después del primer render y no es una edición del usuario — con un snapshot naive, el formulario nacería sucio.

La solución no es excluir el campo, sino **condicionar el bloque entero a `reimbursementEnabled`**: mientras el reintegro está apagado, sus campos tampoco forman parte del payload, así que ignorarlos es exacto. Y prenderlo cambia `reimbursementEnabled`, que sí está en el snapshot. Hay un test que fija esta regla (`stays pristine through the mount-time reimbursement account default`).

## Decisión 3 — El guard vive en el host, no en el formulario

Tentador: que el formulario muestre su propia confirmación al tocar la ✕. Cubriría **un** camino de tres. `Esc` y el click en el scrim los maneja Radix, que llama al `onClose` que le pasó el **host** — el formulario ni se entera.

Por eso el embudo correcto es el host: envuelve su `close` una sola vez y se lo pasa tanto al `Drawer` como al formulario. Los tres caminos terminan en el mismo handler guardado. El formulario sólo reporta si está sucio, por `onDirtyChange`, con una identidad estable (`useCallback`) para que el efecto que lo llama no se dispare en loop.

La alternativa —agregar `preventClose` al primitivo `Drawer`— se descartó: `DrawerProps` vive en `@grana/ui-contracts` y lo comparten las dos plataformas, así que un cambio ahí obliga a la nativa a implementar algo que su `Drawer` no necesita.

## Decisión 4 — La confirmación NO es un segundo modal de Radix

Primera implementación: un `AlertDialog` de Radix montado por el host, al lado del `Drawer`. Se veía bien y **no funcionaba**: el botón "Seguir editando" no respondía al click.

La causa es la anidación. Un segundo modal de Radix abierto sobre un `Dialog` abierto portalea a `document.body`, o sea **fuera** del subtree bloqueado del drawer, y hereda los efectos de ese bloqueo: el modal externo pone `pointer-events: none` en el `body`, marca todo lo demás como `aria-hidden` (verificado: el contenido del alert dialog quedaba con `aria-hidden="true"`), y las dos capas descartables se disputan Esc y los clicks afuera. `drawer.tsx` ya documenta la misma trampa para los popovers portaleados al body — el repo la conocía, con otro síntoma.

La solución no es pelearle a la anidación sino no anidar. La confirmación pasa a ser una capa **absoluta dentro del panel del drawer**: sin portal, sin segundo focus trap, sin stack de capas. El `Dialog.Content` del drawer es `position: fixed`, así que `absolute inset-0` cubre exactamente el panel. De paso resuelve el doble scrim (antes se apilaba el del alert dialog sobre el del drawer) y lee mejor: pregunta el drawer, no una ventana a nivel página.

Por eso `useDiscardGuard` quedó como hook **de estado solamente** (`asking`, `discard`, `keepEditing`, `requestClose`, `setDirty`) y la UI vive en `<DiscardChangesDialog>`, que el host renderiza **dentro** del `<Drawer>`.

**Nota de verificación**: el bug NO se reproduce en un DOM headless. Se escribió un harness con el `Drawer` real y el guard real bajo happy-dom y pasaba con la versión rota — happy-dom no modela `pointer-events` heredado ni el stacking. Lo que el harness sí confirmó es la estructura: con el `AlertDialog` el contenido quedaba con `aria-hidden="true"` y colgando del `body`; con la capa interna cuelga del panel y sin `aria-hidden`. La verificación funcional de este arreglo es manual, en navegador.

## Fuera de alcance

- El guard de salida en la pantalla nativa de edición y en la ruta web `/transactions/[txId]/edit` (ver "Asimetría conocida" en el proposal).
- Un `beforeunload` para recargar/cerrar la pestaña: cubre un caso distinto (salir del sitio) y no el que motiva esta change.
