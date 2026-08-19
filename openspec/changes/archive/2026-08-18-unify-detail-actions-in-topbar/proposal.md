# Proposal: unify-detail-actions-in-topbar

## Why

El detalle de un movimiento ofrece dos acciones —Editar y Eliminar— y hoy las presenta de tres formas distintas según dónde se lo mire:

- **Web escritorio**: las dos juntas a la derecha de la topbar, como icon buttons (Eliminar bordeado, Editar en sólido navy).
- **Web en viewport angosto**: Eliminar escondida detrás de un menú **"···"** y Editar como **barra fija full-width al pie**. Las dos acciones del mismo objeto quedan en dos lugares distintos de la pantalla, y una de ellas requiere un tap extra para aparecer.
- **App nativa**: las dos juntas en el `PageHeader`, en blanco sobre navy — o sea, ya hace lo que hace el escritorio.

La divergencia es sólo de la web angosta, y le cuesta caro: la barra inferior fija **tapa el final del scroll** (el contenedor compensaba con `pb-24`), y el "···" esconde un borrado que en escritorio está a un clic. La app nativa ya demuestra que el patrón de dos iconos funciona bien en un teléfono.

## What Changes

- **Web en viewport angosto adopta la disposición del escritorio**: Eliminar y Editar como dos icon buttons contiguos en la topbar, que ya es sticky en ese viewport — así las dos quedan a la vista durante todo el scroll.
- **Se va el menú "···"** del detalle y **se va la barra inferior fija** con "Editar movimiento". Con la barra fuera, el contenedor deja de reservar `pb-24` para no quedar tapado.
- **La app nativa no cambia**: ya renderiza los dos iconos en el `PageHeader`. Lo que hace esta change es que las tres superficies converjan en el patrón que la nativa y el escritorio ya comparten.
- **Nada de lógica cambia**: permisos (`canEdit` / `canDelete`), el `AlertDialog` de borrado con copy contextual (parent / pago de resumen / default), el flujo de recurrencia sembrada y la invalidación de cache quedan intactos. Sólo cambia dónde se dibujan los disparadores.
- **Limpieza de i18n**: `transactions.detail.actions.more` y `edit_movement` quedan sin uso y se eliminan de ambos catálogos, junto con `menu_label`, que ya estaba huérfano desde que se sacó el kebab.

**Trade-off asumido**: "Editar" pierde el alcance del pulgar y el peso visual del botón full-width. Se acepta a cambio de tener las dos acciones juntas, siempre visibles y consistentes entre superficies — que es el criterio que ya gobierna el escritorio y la nativa.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement de las acciones del detalle se renombra (su título todavía decía "kebab menu", un resto de una pasada anterior que el cuerpo ya contradecía) y pasa a exigir la **misma disposición en todos los viewports y superficies**, en vez de especificar una variante mobile con "···" + barra inferior.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` también tiene deltas sobre `transactions`, pero sobre requirements disjuntos (proyección de recurrencias, duplicados de reglas, borrado, edición desde el módulo global). No hay solapamiento con el requirement que toca esta change.

## Impact

- **`apps/web/app/(app)/transactions/[txId]/_components/detail/detail-actions.tsx`** — único archivo con cambio de comportamiento: el bloque `hidden sm:flex` pasa a `flex`, y se eliminan el `DropdownMenu` del "···" y la barra inferior fija junto con sus imports (`MoreHorizontal`, `DropdownMenu*`, `Button`).
- **`apps/web/app/(app)/transactions/[txId]/_components/global-transaction-detail.tsx`** — el contenedor pasa de `pb-24 sm:pb-2` a `pb-6 sm:pb-2`: ya no hay barra fija que esquivar.
- **`packages/i18n-messages/src/{es,en}.json`** — se eliminan tres claves sin uso bajo `transactions.detail.actions`.
- **`apps/web/app/(app)/transactions/[txId]/edit/page.tsx`** y **`.../_components/tx-back-link.tsx`** (eliminado) — la ruta de edición montaba **dos** afordancias de volver apiladas: la del layout (`EditChrome` → "← Detalle") y un `TxBackLink` heredado que apuntaba a `/transactions`. Dos flechas seguidas hacia destinos distintos, resto de cuando el detalle todavía no tenía topbar propia. Queda sólo la del layout; el componente no tenía otro consumidor.
- **`apps/mobile`** — **sin cambios**.
- **Sin impacto** en las server actions, en las queries, en `@grana/ui-contracts` ni en el schema. El primitivo `dropdown-menu` sigue en uso en Configuración → Categorías, así que no queda huérfano.
