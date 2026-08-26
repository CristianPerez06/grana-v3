# Proposal: close-native-reimbursements-block-parity

## Why

El bloque **"Reintegros a confirmar"** de la app nativa ya existe y ya funciona: `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx` lee los pendientes sin scope, confirma con monto + fecha reales expandiendo la fila, cancela con `Alert` destructivo e invalida cache. Nada de eso falta.

Lo que falta es **decirle al usuario que pasó algo**. Hoy el bloque cierra su render con `if (items.length === 0) return null`, y el handler de éxito hace exactamente una cosa: invalidar. Entonces confirmar el último reintegro pendiente produce esta secuencia: el usuario toca "Confirmar", la query se invalida, la lista vuelve vacía y **el bloque entero se desmonta sin un solo mensaje**. Desde la pantalla, la acción exitosa y un crash silencioso se ven igual: algo desapareció.

Web resuelve esto desde que el bloque existe (`apps/web/lib/transactions/components/pending-reimbursements-block.tsx`): mantiene un `successMessage`, lo usa **también** como condición de montaje (`if (pending.length === 0 && !successMessage) return null`), y cuando la lista queda vacía habiendo actuado muestra la fila "Todo al día" en vez de irse. Las cinco claves de i18n que hacen falta —`transactions.reimbursement.pending.confirmed_success`, `.cancelled_success`, `.all_clear`, `.subtitle`, `.close_notice`— **ya están escritas y traducidas** en `@grana/i18n-messages`; en mobile no las consume nadie.

Alrededor de eso hay una brecha de presentación más chica y del mismo origen: web presenta el bloque como card con header accionable (badge slate con `Undo2`, título, subtítulo, pill de count) y lo colapsa cuando hay varios pendientes, mientras el nativo dibuja un label en mayúsculas sobre una card plana. Y cada fila nativa recibe `categoryIcon` y `categoryColor` en el VM (`PendingReimbursementVM`, `packages/transactions/src/types.ts:132-133`) y los **descarta**.

Cierra el issue [#70](https://github.com/CristianPerez06/grana-v3/issues/70).

## What Changes

Todo el change vive en un archivo de `apps/mobile`. Sin migraciones, sin tocar reads, mutators ni invalidación, y **sin una sola key de i18n nueva**.

- **El aviso de éxito es el cambio que importa, y es persistente, no un toast.** Confirmar o cancelar con éxito deja un banner dentro del bloque con la copy correspondiente y un botón de cierre (`…pending.close_notice`). Se va cuando el usuario lo cierra o cuando actúa de nuevo, no solo. La razón de que no sea transitorio es la misma que en web: el aviso es lo único que explica por qué la lista se vació, así que no puede desaparecer antes de que el usuario mire.

- **Ese mismo aviso es la condición de montaje.** El bloque pasa de `items.length === 0 → null` a `items.length === 0 && !notice → null`. Entrar sin pendientes sigue sin renderizar nada —en eso el nativo ya estaba bien, y web hace lo mismo—; **vaciar la lista actuando** deja el bloque montado mostrando `…pending.all_clear`. Es una sola condición la que separa "no tenías nada" de "acabás de terminar", y es la que hoy no existe.

- **El bloque compone el `Card` del design system** con el header accionable: badge slate con `Undo2`, título, subtítulo, pill de count y chevron. El header es el toggle de colapso.

- **Colapsable con la regla de web: abierto con ≤1 pendiente, colapsado con 2 o más.** En web ese default se puede calcular en el `useState` inicial porque `pending` llega por prop desde RSC. En nativo la lista llega por `useQuery`, así que en el primer render **todavía no se sabe cuántos hay** y un `useState(items.length <= 1)` se congelaría en el valor de la lista vacía. Se resuelve derivando el estado (`open = override ?? items.length <= 1`) en vez de sincronizarlo con un efecto: el default sigue a los datos hasta que el usuario toca el header, y a partir de ahí manda su elección.

- **Cada fila suma el chip de ícono + tinte de la categoría**, con el mismo tratamiento que web: fondo = color de la categoría al 10%, emoji adentro. Solo se dibuja cuando el reintegro tiene ícono derivado; sin ícono la fila queda como está hoy, no aparece un cuadrado vacío.

**Lo que este change NO toca, a propósito:**

- **El `PendingRecurrencesBlock` nativo**, que tiene exactamente la misma presentación plana (label en mayúsculas + count, sin card ni colapso). Su hermano web **sí** es un hub colapsable con badge dorado, así que la brecha existe igual — pero es otra superficie, con su propia copy y su propio módulo (`recurring-movements`), y meterla acá convertiría un change de un archivo en uno de dos módulos. Queda anotado como brecha conocida, no como algo que este change dejó a medias.
- **La subtítulo de la fila.** Web muestra `target · accountName`; el nativo muestra la categoría. No se unifica: el issue enumera la diferencia de **chip de categoría**, y cambiar además qué dice la segunda línea es un cambio de contenido que nadie pidió.
- **El borde slate exacto de web** (`#C7D8E2` inline). Es un hex literal que la propia web no toma de un token, y la convención del repo prohíbe copiarlo. El nativo traduce la intención —acento slate, informacional— con los tokens que sí existen (`slate`, `slate-soft`); ver `design.md`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement **"La app nativa muestra los reintegros pendientes accionables en el feed"** (`openspec/specs/transactions/spec.md:4003`) dice hoy dos cosas que este change cambia. Primero, "El bloque SHALL renderizar **nada** cuando no hay reintegros pendientes" — sin distinguir entrar vacío de quedar vacío, que es justo la distinción que falta. Segundo, "La fila SHALL mostrar … un aviso de éxito transitorio" — que además de ser lo contrario de lo que hace web (persistente, descartable a mano), **no está implementado en ninguna forma**: es drift de la spec contra el código, no una decisión de diseño que se esté revirtiendo. El delta corrige ambas, y suma la presentación (card + header + colapso) y el chip de categoría, que la spec no cubría porque hasta ahora no había nada que decir.

**Pre-change check.** El único change activo es `mirror-native-chrome-on-web-mobile` (13 de 44 tareas pendientes), que toca `overlay-primitives`, `page-header` y `web-app-shell` — chrome **web**, ningún archivo de `apps/mobile`. No toca `transactions` ni se solapa con este change. (Los directorios `add-mobile-money-calculator`, `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps` y `fix-native-movement-form-spec-drift` bajo `openspec/changes/` están **vacíos**: son restos locales sin trackear de changes ya archivados.)

## Impact

**Mobile — el único código que cambia**

- `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx` — el card, el header colapsable, el aviso de éxito, la fila `all_clear` y el chip de categoría. El `PendingRow` conserva su lógica de confirmar/cancelar tal cual; lo único que cambia en él es que reporta **qué** acción salió bien (`onDone('confirmed' | 'cancelled')`) para que el bloque elija la copy.

**No cambia**

- `apps/mobile/lib/transactions/queries.ts`, `mutators.ts`, `invalidate.ts` — el read, los mutators y la invalidación quedan intactos.
- `packages/i18n-messages` — cero keys nuevas; las cinco que hacían falta ya existen en `es` y `en`.
- `apps/web/**` — el bloque web es la referencia, no el objeto del change.

**Specs**

- `openspec/specs/transactions/spec.md` — vía el delta de arriba.
