## 1. Base de datos

- [x] 1.1 Escribir `supabase/migrations/0076_link_eligibility.sql` (antes, confirmar que la última en `main` sigue siendo 0075): función `recurrence_movement_linkable(public.transactions)`; `recurrence_link_candidates` redefinida para usarla; `recurrence_link_movement` copiada de **0074** y extendida con el rechazo `movement_not_linkable` / `GRN19` después de GRN11; `revoke`/`grant` y bloque `do` de autoverificación. Verificar con el test de 1.3.
- [x] 1.2 Extender el arnés `packages/recurrences/__tests__/support/recurrence-identity-db.ts`: `transactions.parent_id`, tabla `period_payments` reducida (`period_id`, `transaction_id`, `stamp_tax_transaction_id`) y aplicación de 0076. Verificar que los tests existentes del paquete siguen en verde.
- [x] 1.3 Test contra PGlite (`link-eligibility.test.ts`): ni la madre ni las cuotas hijas, ni el débito de pago ni el impuesto de sellos, aparecen como candidatos (con y sin ampliar); una compra con tarjeta en un pago sí aparece; vincular cualquiera de los excluidos falla con `GRN19` y no deja ocurrencia; un vínculo previo a una cuota se desvincula normalmente.

## 2. Paquete `@grana/recurrences`

- [x] 2.1 `getRecurrenceLinkCandidates`: después del RPC, un select de `transactions` por id con `account`, `category` y `subcategory` embebidos (mismas columnas que `INSTANCE_SELECT`), fusionado conservando el orden del RPC y descartando ids que ya no vuelvan. `LinkCandidate` suma esos tres campos. Verificar con un test que el orden se conserva y que llegan los embebidos.
- [x] 2.2 `linkAmountDiffers(candidateAmount, ruleAmount)` con `Money.compare`. Verificar con un test unitario (iguales, distintos por un centavo, distintos).
- [x] 2.3 Código `movement_not_linkable` (`GRN19`) en `LinkErrorCode` y `RPC_ERROR_BY_SQLSTATE`, su clave en `link-messages.ts`, y `recurrences.link.errors.movement_not_linkable` en `es.json` y `en.json`. Verificar con `link-messages.test.ts` / `guard-codes.test.ts` actualizados.

## 3. Pantallas (web y nativo, mismo commit)

- [x] 3.1 Web `apps/web/lib/recurrences/components/link-candidates-drawer.tsx`: nombre con `recurrenceTitle` + `getCategoryName`/`getSubcategoryName` + etiqueta del tipo; subtítulo «cuenta · fecha»; diferencia con `linkAmountDiffers`. Quitar el uso de `no_description` (y la clave del catálogo si queda sin uso).
- [x] 3.2 Nativo `apps/mobile/components/recurrences/LinkCandidatesSheet.tsx`: lo mismo con `categoryName`/`subcategoryName`. Verificar con `grep` de `no_description` y `0.004` en las dos apps que no queda ninguno.

## 4. Verificación

- [x] 4.1 `pnpm verify` en verde.
- [ ] 4.2 Pegar 0076 en el SQL Editor del proyecto online (paso manual del usuario) y recorrer los pasos de verificación del #190 en web a ancho de teléfono y en la app nativa.
