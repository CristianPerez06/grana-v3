## 1. Base de datos — migración 0075

- [ ] 1.1 Reproducir #104 en el harness PGlite (`packages/recurrences/__tests__/support/recurrence-identity-db.ts`).
  - Test nuevo `undo-reopens-occurrence.test.ts`: borrar un movimiento que resuelve una ocurrencia `created` falla con el CHECK sin 0075. Lo mismo con una `linked`.
  - Verificar que el test está rojo antes de escribir la migración.
- [ ] 1.2 Escribir `supabase/migrations/0075_undo_reopens_occurrence.sql`. El número se eligió contra `main`, donde la última es 0074.
  - `recurrence_reopen_occurrence(uuid)`: interna, sin `EXECUTE` para `authenticated`. Restaura de la regla descripción, categoría, subcategoría, cuenta e importe, y limpia el vínculo.
  - El trigger `BEFORE DELETE` `trg_reopen_occurrence_on_delete` en `transactions`. Reabre la ocurrencia si tiene `due_date` y la regla no está eliminada; si no, borra la fila.
  - `recurrence_unlink_movement`, reemplazada entera: idéntica a 0072 salvo el `update` final, que pasa a usar la función.
  - Self-check al final.
  - Cargar 0075 en el harness. Verificar que 1.1 queda verde.
- [ ] 1.3 Tests de la migración en `undo-reopens-occurrence.test.ts`. Verificar todos en verde:
  - `created` y `linked` vuelven a `pending` con fecha intacta y datos de la regla;
  - un pago anterior a 0064 (`due_date NULL`) borra la fila;
  - una regla eliminada borra la fila;
  - una regla pausada reabre;
  - un gasto compartido con liquidación vigente posterior falla con `GRN01` y no cambia ni el movimiento ni la ocurrencia;
  - un pago anticipado deshecho libera la posición de `recurrence_positions_spent`, y uno con fecha pasada no;
  - deshacer y volver a registrar no agrega posiciones.
- [ ] 1.4 Desvincular restaura los datos de la regla: el caso del #186, con $500 en Billetera vs «Comida» $3.333,33 en Visa Galicia. Ajustar los tests existentes de `link-movement-rpc.test.ts` que asumían la foto del movimiento tras desvincular. Verificar con `pnpm --filter @grana/recurrences test`.
- [ ] 1.5 Comparar `packages/supabase/src/types.ts` contra 0075 línea por línea. No se espera cambio: no hay RPC expuesta nueva ni columnas. Verificar con `pnpm typecheck` + `pnpm typecheck:mobile`.

## 2. Paquetes compartidos

- [ ] 2.1 `canUndo(instance)` en `packages/recurrences/src/review-surface.ts`, junto a `canUnlink`. Tests en `link-surface.test.ts`: sí para `created`, no para `linked`, `pending` ni `skipped`.
- [ ] 2.2 `getRecurrenceLinkForTransaction` devuelve además:
  - `due_date`;
  - el nombre de la regla vía `recurrenceTitle`;
  - el estado de la regla.

  Test de la lectura con un pago viejo (`due_date null`).
- [ ] 2.3 Mensajes en `packages/i18n-messages/src/es.json` y `en.json`. Verificar que existen en los dos catálogos:
  - el botón «Deshacer» y su estado en curso;
  - el título y el cuerpo de la confirmación, con la variante de pago viejo y regla eliminada;
  - la línea nueva del diálogo de eliminar;
  - el texto de `paid` que dice dónde se resuelve;
  - las claves de guarda de borrado para nativo.

## 3. Web

- [ ] 3.1 Acción de borrado (`apps/web/app/_actions/transactions.ts`):
  - `GRN01` usa `describeBlockingSettlements` y los textos de `recurrences.link.errors.blocked_*`;
  - `paid` dice dónde se resuelve;
  - si el movimiento resolvía una ocurrencia, revalida también `revalidateAfterRecurrenceMutation()`.

  Verificar con un test de la acción o del mapeo.
- [ ] 3.2 Diálogo de eliminar del detalle (`detail-actions.tsx` + `page.tsx`): la línea «El vencimiento del … de … vuelve a quedar por revisar», o la variante de pago viejo. Verificar a 360 px.
- [ ] 3.3 Botón «Deshacer» en `recurrence-instances-list.tsx`, en el lugar de «Desvincular».
  - Usa el primitivo `Button` y un `AlertDialog` de confirmación.
  - Llama a la acción de borrado con el `confirmed_transaction_id`.
  - Los errores se muestran inline, igual que desvincular.

  Verificar a 360 px que la fila no se rompe.

## 4. Nativo

- [ ] 4.1 `deleteMovement` (`apps/mobile/lib/transactions/mutators.ts`) localiza cada guarda de borrado y `GRN01` (con `describeBlockingSettlements`) en vez de `generic`. Test en `apps/mobile/lib/**/__tests__`.
- [ ] 4.2 Detalle nativo (`app/(app)/transactions/[txId]/index.tsx`):
  - la línea del vencimiento en la confirmación;
  - después de borrar, `invalidateAfterRecurrenceResolution`.
- [ ] 4.3 Botón «Deshacer» en `components/recurrences/RecurrenceInstancesList.tsx`.
  - Usa el `Button` de la app, sin íconos girados con `transform`.
  - Confirmación con `Alert.alert` destructivo, y después `invalidateAfterRecurrenceResolution`.
- [ ] 4.4 Sumar los llamadores de `deleteMovement` a `invalidation-wiring.test.ts`. Verificar que falla si se usa la invalidación angosta.

## 5. Spec y cierre

- [ ] 5.1 Verificar que el texto del spec coincide con lo implementado, en especial los copys y la variante de pago viejo. `pnpm openspec:check` en verde.
- [ ] 5.2 `git fetch origin main` y `pnpm verify` en verde. Reintentar `pnpm build` si falla bajando Google Fonts.
- [ ] 5.3 Dejar listo el QA manual para el usuario: web a 360 px y simulador iOS con la cuenta «Juli», regla «Prueba recurr».
  - deshacer desde la ficha;
  - eliminar desde el detalle;
  - eliminar un vinculado;
  - desvincular y ver los datos de la regla;
  - el bloqueo por resumen pagado.
