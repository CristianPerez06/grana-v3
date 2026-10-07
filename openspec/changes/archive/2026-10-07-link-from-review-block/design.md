## Context

«Ya lo tengo cargado» ya existe en las dos plataformas, pero pegado a resolver por anticipado:
`ResolveAheadActions` en web (`app/(app)/transactions/recurring/_components/`) y en nativo
(`components/recurrences/`) montan en un mismo componente el botón, la lectura de candidatos (con su
protección contra respuestas viejas y «Ampliar la búsqueda») y la hoja de candidatos. El bloque de
por revisar vive en otro lado: `apps/web/lib/recurrences/components/pending-recurrences-block.tsx`,
montado en `/transactions` y en el inicio, y `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx`.

La base ya admite vincular una ocurrencia existente: `recurrence_link_movement` actualiza la fila
`pending` en lugar de crear una. No hace falta ninguna migración.

El estado inicial del bloque lo decide `shouldOpenReviewBlock` (`@grana/recurrences`), y un test de
paridad (`apps/web/lib/recurrences/__tests__/review-surface-parity.test.ts`) exige que los dos bloques
lo usen. Las líneas de reglas trabadas salen de `stuckRules`, y las dos plataformas hoy las dibujan
sólo con el bloque abierto.

## Goals / Non-Goals

**Goals:**
- Una sola pieza por plataforma para «Ya lo tengo cargado», usada por el hub, la ficha y el bloque.

**Non-Goals:**
- Unificar la fila entera del bloque con la del historial de la ficha. Eso es la 1b, que es donde
  aparece el segundo consumidor de la fila.

## Decisions

**1. Se extrae `AlreadyLoadedAction` por plataforma, y `ResolveAheadActions` lo compone.** El botón,
la lectura de candidatos y la hoja pasan a un componente propio que recibe la regla y el vencimiento
(`recurrenceId`, `dueDate`, `ruleAmount`, `ruleCurrency`, `shared`), un `onLinked` y un
`renderTrigger(open)` para el botón. El hub y la ficha
lo siguen usando a través de `ResolveAheadActions`; el bloque lo monta directo en cada fila. Copiar la
lectura en el bloque duplicaría la protección contra respuestas viejas, que es lo que evita el
duplicado que este change existe para cerrar.

- Web: `AlreadyLoadedAction` y `LinkCandidatesDrawer` se mueven a `apps/web/lib/recurrences/components/`.
  El bloque vive en `lib/` y lo montan dos rutas, así que no puede depender de los `_components` de
  `/transactions/recurring`. El aviso de éxito sigue siendo responsabilidad de quien lo monta: el hub
  usa su `useRecurrenceNotice`, y el bloque su propio aviso persistente con
  `recurrences.link.linked_success`. Después de vincular, el bloque invalida con
  `invalidateAfterRecurrenceInstanceMutation(qc, { confirmed: true })`: el movimiento vinculado
  cambia en la lista (rótulo de vinculado y, si se convirtió, pasa a compartido).
- Nativo: `AlreadyLoadedAction` en `components/recurrences/`, con la invalidación
  (`invalidateAfterRecurrenceResolution`) adentro, como ya hace `ResolveAheadActions`, para que ningún
  consumidor la pueda elegir mal.

**2. El estado inicial pasa a ser una constante compartida.** `shouldOpenReviewBlock` se reemplaza por
`REVIEW_BLOCK_STARTS_OPEN = false` en `review-surface.ts`. Una función que siempre devuelve `false` con
un parámetro que no usa miente sobre lo que decide. La constante mantiene la decisión en un solo
lugar, y el test de paridad pasa a exigir que los dos bloques la usen. Web: `useState(REVIEW_BLOCK_STARTS_OPEN)`.
Nativo: `openOverride ?? REVIEW_BLOCK_STARTS_OPEN`. Así la elección del usuario sobrevive un refetch
sin efecto, como hoy.

**3. Las líneas de reglas trabadas y el aviso de reconstrucción salen de la guarda `isOpen`.** En las
dos plataformas, sólo la lista de filas (y el «todo al día») queda dentro de esa guarda.

**4. `stuckRules` filtra antes de agrupar.** Sólo agrupa las ocurrencias con `due_date <= today`. Con
eso «dos o más» y «el conteo» hablan de lo ya llegado, y la condición de que la más vieja ya venció
se cumple sola. Es una función pura con tests propios, y las dos plataformas la usan.

**5. `countPendingSharedRecurrenceInstances` recibe `today`.** Agrega `.lte('due_date', today)`. El
llamador (`TeaserSection`, web) pasa `getTodayAR()`. El aviso existe sólo en web porque Compartido
todavía no tiene paridad nativa.

## Risks / Trade-offs

- [Mover `LinkCandidatesDrawer` rompe imports del hub] → se actualizan en el mismo commit; `pnpm
  typecheck` lo detecta.
- [Con el bloque siempre plegado, un vencimiento vencido puede pasar desapercibido] → el encabezado
  conserva el conteo y las líneas de reglas trabadas a la vista; es la decisión del usuario.
- [Tres botones no entran en el ancho de un teléfono] → la fila del bloque usa botones de ancho
  propio (`w-auto`) en una fila que puede partirse (`flex-wrap`): si no entran, «Omitir» baja de
  renglón en vez de truncarse. `AlreadyLoadedAction` no dibuja su propio botón: recibe un
  `renderTrigger(open)` y quien lo monta dibuja el disparador con la escala de su fila (los botones
  `sm` del bloque web, los del bloque nativo, los `xs` del hub). Se verifica en web a ancho de teléfono y en nativo.
