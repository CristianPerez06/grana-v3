## 1. Lógica compartida (`@grana/recurrences`)

- [ ] 1.1 Reemplazar `shouldOpenReviewBlock` por la constante `REVIEW_BLOCK_STARTS_OPEN = false` en `review-surface.ts` y su export en `index.ts`; reescribir sus tests en `__tests__/review-surface.test.ts`. Verifica: `pnpm --filter @grana/recurrences test`.
- [ ] 1.2 `stuckRules` agrupa sólo ocurrencias con `due_date <= today`; agregar tests de «una vencida y una futura no es trabada» y «el conteo de la línea excluye las futuras». Verifica: tests del paquete en verde.
- [ ] 1.3 `countPendingSharedRecurrenceInstances(supabase, today)` filtra `due_date <= today`; agregar un test con un doble del cliente que pruebe el filtro. Verifica: tests del paquete en verde.

## 2. Web

- [ ] 2.1 Mover `LinkCandidatesDrawer` a `apps/web/lib/recurrences/components/` y extraer `AlreadyLoadedAction` (lectura de candidatos con protección de respuesta vieja, ampliar búsqueda, `onLinked`, `renderTrigger`) del `ResolveAheadActions` del hub, que pasa a componerlo. Verifica: `pnpm typecheck` y los tests del hub en verde, y el hub sigue ofreciendo «Ya lo tengo cargado».
- [ ] 2.2 En `pending-recurrences-block.tsx`, montar `AlreadyLoadedAction` en cada fila entre Confirmar y Omitir (fila con `flex-wrap`). Al vincular: aviso persistente `recurrences.link.linked_success` e `invalidateAfterRecurrenceInstanceMutation(qc, { confirmed: true })`. Verifica: un test del bloque que encuentre los tres botones y ningún «Ya lo pagué».
- [ ] 2.3 Estado inicial con `REVIEW_BLOCK_STARTS_OPEN`, y las líneas de reglas trabadas y el aviso de reconstrucción fuera de la guarda `isOpen`. Verifica: un test que muestre el bloque plegado con un vencido y las líneas de trabadas a la vista.
- [ ] 2.4 `TeaserSection` pasa `getTodayAR()` al conteo de compartidos. Verifica: `pnpm typecheck`.
- [ ] 2.5 Actualizar `review-surface-parity.test.ts` para exigir `REVIEW_BLOCK_STARTS_OPEN` y `AlreadyLoadedAction` en los dos bloques. Verifica: `pnpm test:web`.

## 3. Nativo

- [ ] 3.1 Extraer `AlreadyLoadedAction` en `apps/mobile/components/recurrences/` (con la invalidación adentro) y hacer que `ResolveAheadActions` lo componga. Verifica: `pnpm typecheck:mobile`.
- [ ] 3.2 En `PendingRecurrencesBlock.tsx`, agregar «Ya lo tengo cargado» en cada fila entre Confirmar y Omitir, con aviso `recurrences.link.linked_success` (nuevo resultado `linked` en `onDone`). Verifica: `pnpm typecheck:mobile` y `pnpm lint:mobile`.
- [ ] 3.3 Estado inicial `openOverride ?? REVIEW_BLOCK_STARTS_OPEN`, y las líneas de reglas trabadas y el aviso de reconstrucción fuera de la guarda `isOpen`. Verifica: `pnpm test` (incluye `apps/mobile`).

## 4. Verificación

- [ ] 4.1 `pnpm verify` en verde.
- [ ] 4.2 QA a mano en web a ancho de teléfono y en nativo: el bloque arranca plegado con vencidos y muestra las trabadas; vincular un vencido desde el bloque no crea movimiento ni mueve el saldo; desvincular una ocurrencia futura desde la ficha y volver a vincularle otro movimiento desde el bloque; una regla con una vencida y una futura no figura como trabada; el aviso de Compartido no cuenta una compartida futura. Lo que no se pueda correr en esta sesión queda escrito como pendiente para el usuario.
