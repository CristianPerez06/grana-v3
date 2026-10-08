## 1. Base de datos — migración 0075

- [x] 1.1 Reproducir #104 en el harness PGlite (`packages/recurrences/__tests__/support/recurrence-identity-db.ts`).
  - Test nuevo `undo-reopens-occurrence.test.ts`: borrar un movimiento que resuelve una ocurrencia `created` falla con el CHECK sin 0075. Lo mismo con una `linked`.
  - El test carga sin 0075 con la opción `undoReopens: false`.
- [x] 1.2 Escribir `supabase/migrations/0075_undo_reopens_occurrence.sql`. El número se eligió contra `main`, donde la última es 0074.
  - `trg_occurrence_back_to_review`: al pasar de `confirmed` a `pending`, la ocurrencia trae de la regla descripción, categoría, subcategoría, cuenta e importe.
  - `trg_reopen_occurrence_on_delete`: reabre la ocurrencia, o borra la fila si es un pago viejo o de una regla eliminada.
  - Self-check al final.
  - Cargar 0075 en el harness.
- [x] 1.3 Tests de la migración en `undo-reopens-occurrence.test.ts`, todos en verde:
  - `created` y `linked` vuelven a `pending` con fecha intacta y datos de la regla;
  - un pago anterior a 0064 borra la fila;
  - una regla eliminada borra la fila;
  - una regla pausada reabre;
  - un gasto compartido con liquidación vigente posterior falla con `GRN01` y no cambia nada;
  - un pago anticipado deshecho libera la posición, y uno con fecha pasada no;
  - deshacer y volver a resolver no agrega vencimientos.
- [x] 1.4 Desvincular restaura los datos de la regla: el caso del #186, con $500 en Billetera vs «Comida» $3.333,33 en Visa Galicia. Los tests existentes de `link-movement-rpc.test.ts` siguen en verde sin cambios.
- [x] 1.5 `packages/supabase/src/types.ts`: 0075 no agrega columnas ni RPC, así que no hay nada que reflejar. `pnpm typecheck` se corre en 5.2.

## 2. Paquetes compartidos

- [x] 2.1 `canUndo(instance)` en `packages/recurrences/src/review-surface.ts`, junto a `canUnlink`. Tests en `link-surface.test.ts`: sí para `created`, no para `linked`, `pending` ni `skipped`.
- [x] 2.2 `getRecurrenceLinkForTransaction` devuelve además `due_date` y la regla (estado y los datos para `recurrenceTitle`). `occurrenceAfterDelete` decide, una vez para las dos apps, si el vencimiento vuelve a revisión o sale del historial. Tests en `link-for-transaction.test.ts`, incluido el pago viejo.
- [x] 2.3 `deleteMovementExplained` y `deleteErrorMessageKeys` en `packages/recurrences/src/undo.ts`. Es la llamada de las dos puertas en las dos apps: en un `GRN01` describe qué liquidación traba, y el mapeo dice dónde se resuelve cada rechazo. Tests en `delete-messages.test.ts`.
- [x] 2.4 Mensajes en `es.json` y `en.json`:
  - `transactions.delete_errors.*`;
  - `recurrences.link.undo*`, `undone_success*` y `delete_*`.

  Test de catálogo en `apps/web/lib/recurrences/__tests__/link-error-catalog.test.ts`.

## 3. Web

- [x] 3.1 La acción `deleteTransaction` usa `deleteMovementExplained` y traduce con `deleteErrorMessageKeys`:
  - `GRN01` dice revertir o cancelar según la liquidación;
  - `paid` dice dónde se resuelve.

  Revalida también las rutas de recurrencias.
- [x] 3.2 Diálogo de eliminar del detalle: `page.tsx` arma `occurrenceNotice` (el saldo cambia, y qué vencimiento de qué regla vuelve a revisión o sale del historial) y `DetailActions` lo muestra. Después de borrar, invalida también por revisar.
- [x] 3.3 `UndoInstanceButton` en la fila del historial, junto a «Desvincular».
  - Usa los primitivos `Button` y `Dialog`, con confirmación destructiva.
  - Llama a la misma acción de borrado con el `confirmed_transaction_id`.
  - El rechazo se lee dentro del diálogo.
  - `notice-wiring.test.ts` lo suma a los consumidores del acuse.

## 4. Nativo

- [x] 4.1 `deleteMovement` usa `deleteMovementExplained` y localiza con `deleteErrorMessageKeys`, en vez de caer siempre en `generic`. Test en `apps/mobile/lib/transactions/__tests__/delete-errors.test.ts`.
- [x] 4.2 Detalle nativo:
  - la confirmación agrega la línea del vencimiento, con las mismas claves que web;
  - después de borrar, `invalidateAfterRecurrenceResolution`, que incluye Compartido.
- [x] 4.3 «Deshacer» en `RecurrenceInstancesList.tsx`, con el `Button` de la app y sin íconos. Confirmación con `Alert.alert` destructivo, y después `invalidateAfterRecurrenceResolution`.
- [x] 4.4 `invalidation-wiring.test.ts` suma `deleteMovement` a las mutaciones vigiladas. Sus dos llamadores usan la invalidación ancha.

## 5. Spec y cierre

- [ ] 5.1 Verificar que el texto del spec coincide con lo implementado, en especial los copys y la variante de pago viejo. `pnpm openspec:check` en verde.
- [ ] 5.2 `git fetch origin main` y `pnpm verify` en verde. Reintentar `pnpm build` si falla bajando Google Fonts.
- [ ] 5.3 Dejar listo el QA manual para el usuario: web a 360 px y simulador iOS con la cuenta «Juli», regla «Prueba recurr».
  - deshacer desde la ficha;
  - eliminar desde el detalle;
  - eliminar un vinculado;
  - desvincular y ver los datos de la regla;
  - el bloqueo por resumen pagado.
