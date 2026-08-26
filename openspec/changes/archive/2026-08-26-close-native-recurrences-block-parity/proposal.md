# Proposal: close-native-recurrences-block-parity

## Why

El bloque **"Recurrencias pendientes"** de la app nativa ya existe y ya funciona: `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx` lista las instancias pendientes, confirma con el snapshot, omite e invalida cache. Nada de eso falta.

Lo que falta es **decirle al usuario que pasó algo**. Hoy el bloque cierra su render con `if (instances.length === 0) return null` (línea 104), y su handler de éxito hace exactamente una cosa: invalidar (línea 108). Entonces confirmar la última recurrencia pendiente produce esta secuencia: el usuario toca "Confirmar", la query se invalida, la lista vuelve vacía y **el bloque entero se desmonta sin un solo mensaje**. Desde la pantalla, la acción exitosa y una falla silenciosa se ven igual: algo desapareció.

Es el mismo bug, en el mismo feed, que ya se arregló un componente más arriba en [#70](https://github.com/CristianPerez06/grana-v3/issues/70) (`close-native-reimbursements-block-parity`, mergeado en `2be8c29d`). Su hermano web (`apps/web/lib/recurrences/components/pending-recurrences-block.tsx:85`) nunca lo tuvo: mantiene un `successMessage`, lo usa **también** como condición de montaje, y cuando la lista queda vacía habiendo actuado muestra la fila "Todo al día" en vez de irse.

Alrededor de eso hay una brecha de presentación del mismo origen: web presenta el bloque como card con header accionable (badge dorado con `Clock`, título, subtítulo, pill de count, chevron) y lo colapsa cuando hay varias pendientes, mientras el nativo dibuja un label en mayúsculas sobre una card plana. Las cinco claves de i18n que hacen falta —`recurrences.pending.subtitle`, `.all_clear`, `.confirmed_success`, `.skipped_success`, `.close_notice`— **ya están escritas y traducidas** en `@grana/i18n-messages` (`es` y `en`); en mobile no las consume nadie.

Cierra el issue [#83](https://github.com/CristianPerez06/grana-v3/issues/83).

## What Changes

El change espeja `openspec/changes/archive/2026-08-26-close-native-reimbursements-block-parity/`, que resolvió estos mismos problemas y dejó sus decisiones escritas. Sin migraciones, sin tocar reads, mutators ni invalidación, y **sin una sola key de i18n nueva**.

- **El aviso de éxito es el cambio que importa, y es persistente, no un toast.** Confirmar u omitir con éxito deja un banner dentro del bloque con la copy correspondiente (`…pending.confirmed_success` / `.skipped_success`) y un botón de cierre (`…pending.close_notice`). Se va cuando el usuario lo cierra o cuando actúa de nuevo, no solo: el aviso es lo único que explica por qué la lista se vació, así que no puede desaparecer antes de que el usuario mire.

- **Ese mismo aviso es la condición de montaje.** El bloque pasa de `instances.length === 0 → null` a `instances.length === 0 && !notice → null`. Entrar sin pendientes sigue sin renderizar nada —en eso el nativo ya estaba bien, y web hace lo mismo—; **vaciar la lista actuando** deja el bloque montado mostrando `…pending.all_clear`.

- **El bloque compone el `Card` del design system** con header accionable: badge dorado con `Clock`, título, subtítulo, pill de count (oculta con la lista vacía) y chevron. El header es el toggle de colapso.

- **Colapsable con la regla de web: abierto con ≤1 pendiente, colapsado con 2 o más.** El estado se **deriva** (`openOverride ?? instances.length <= 1`) en vez de sincronizarse con un efecto, porque en nativo la lista llega por `useQuery` y en el primer render todavía no se sabe cuántas hay. Ver `design.md`.

- **El acento dorado se traduce a tokens** (`warning`, `warning-bg`), no se copia el hex literal que web escribe inline (`#EAD9A8`, `rgba(181,138,30,0.06)`). El halo de 4px se vuelve un **anillo de layout**, porque las sombras de RN no tienen `spread`.

- **`apps/mobile/lib/colors.ts` suma `warning: '#C49A3C'`.** El mirror JS de tokens tiene hoy `warningDeep` pero no `warning`, y el ícono `Clock` necesita el valor numérico para su prop `color`. Es el único archivo fuera del bloque que cambia, y la elección de tono está justificada en `design.md`.

- **`PendingRow` reporta cuál acción salió bien** (`onDone('confirmed' | 'skipped')`), para que el bloque —que es el dueño del aviso— elija la copy. El resto de su lógica queda intacta.

**Lo que este change NO toca, a propósito:**

- **Todo lo que web hace de más por fila**, y que explica sus 635 líneas contra 131: modo edición de la instancia (monto, fecha, descripción, cuenta), línea de urgencia con color, picker de cuenta con el caso de cuenta archivada, calculadora de monto y aviso de saldo negativo. El requirement vigente dice explícito que en esta slice confirmar usa el **snapshot** de la instancia, así que el recorte ya está respaldado por la spec y no hace falta tocarla para sostenerlo.
- **El `RecurrenceSuggestionBanner`**, que tiene su propia versión del mismo bug: `onAccept` crea la regla, invalida y nada más — ni navega a la regla creada ni avisa que salió bien. Es otra superficie y merece su propio ticket; ver la nota de deep-link más abajo.
- **La segunda línea de la fila y el badge de compartida**, que se quedan como están.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement **"La app nativa muestra los pendientes recurrentes y la sugerencia en el feed"** (`openspec/specs/transactions/spec.md:3932`). A diferencia del caso de reintegros —donde la spec afirmaba dos cosas falsas que hubo que corregir—, acá la spec está **en silencio, no equivocada**: describe el read, las acciones y la slice de snapshot, y no dice nada de presentación, estado vacío ni feedback. El delta es aditivo dentro del `MODIFIED`: suma presentación (card + header + colapso), el aviso persistente y la distinción entre entrar vacío y quedar vacío.

  El delta además **parte una frase existente** que hoy afirma dos cosas, las dos incumplidas en nativo: *"El bloque de pendientes y el banner SHALL ofrecer un deep-link al hub / a la regla"*. La mitad del **bloque** se reescribe para describir la realidad —la afordancia al hub vive en el `PageHeader` de la pantalla (`apps/mobile/app/(app)/transactions/index.tsx:288`), y ni el bloque ni el banner la duplican, igual que en web, cuyo bloque tampoco linkea—. La mitad del **banner** se deja **intacta como SHALL incumplido**: `acceptRecurrenceSuggestion` no navega a la regla creada, y reescribir la frase entera borraría un gap real en vez de arreglarlo.

**Pre-change check.** El único change activo con artefactos es `mirror-native-chrome-on-web-mobile` (31 de 44 tareas), cuyas tareas pendientes son verificación en navegador y los deltas de `overlay-primitives`, `page-header` y `web-app-shell`. Toca `apps/web` y un solo archivo de mobile (`components/layout/AppMenu.tsx`); no toca `transactions` ni el feed de Movimientos nativo. Sin solapamiento. (Los directorios `add-mobile-money-calculator`, `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps` y `fix-native-movement-form-spec-drift` bajo `openspec/changes/` contienen sólo un `specs/` vacío y están sin trackear en git: son restos locales de changes ya archivados.)

## Impact

**Mobile — el único código que cambia**

- `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx` — el anillo, el `Card`, el header colapsable, el aviso de éxito y la fila `all_clear`. `PendingRow` conserva su lógica de confirmar/omitir; lo único que cambia en él es que reporta **qué** acción salió bien.
- `apps/mobile/lib/colors.ts` — suma `warning: '#C49A3C'` al mirror JS de tokens.

**No cambia**

- `apps/mobile/lib/recurrences/queries.ts`, `mutators.ts`, `invalidate.ts` — el read, los mutators y la invalidación quedan intactos.
- `apps/mobile/app/(app)/transactions/index.tsx` — el bloque se monta igual que hoy, sin props nuevas.
- `packages/i18n-messages` — cero keys nuevas; las cinco que hacían falta ya existen en `es` y `en`.
- `packages/ui-tokens` — `warning` ya existe como token CSS y como clase de NativeWind; sólo faltaba en el mirror JS.
- `apps/web/**` — el bloque web es la referencia, no el objeto del change.

**Specs**

- `openspec/specs/transactions/spec.md` — vía el delta de arriba.
