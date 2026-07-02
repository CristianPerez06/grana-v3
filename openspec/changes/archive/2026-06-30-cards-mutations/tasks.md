## 1. Mutaciones chicas a `@grana/cards`

- [x] 1.1 Extraer `updateCreditCard` a `@grana/cards` (`{ supabase, userId, input, today }` → `CardMutationResult`), validando con su schema de `@grana/validation`; `formError` literales → `messageKey` (`cards.errors.*`).
- [x] 1.2 Extraer `updatePeriodDates` a `@grana/cards` con el mismo contrato; mover el sanity check de fechas dentro de la mutación.
- [x] 1.3 Tests del package para ambas (éxito + casos de error mapeados a `messageKey`/`errorCode`).
- [x] 1.4 Rewire de los server actions web `updateCreditCard`/`updatePeriodDates` a shells finos (auth + client + mutación + map + `revalidatePath`).

## 2. Ediciones de cuotas (madre/hija)

- [x] 2.1 Extraer `updateInstallmentParent` a `@grana/cards`, componiendo los internals madre/hija de `@grana/transactions-mutations` (no duplicarlos); `CardMutationResult`.
- [x] 2.2 Extraer `deleteInstallmentParent` a `@grana/cards` con el mismo contrato.
- [x] 2.3 Verificar/añadir `@grana/transactions-mutations` como dependencia runtime de `packages/cards/package.json` (hoy type-only); confirmar que sigue isomórfico (sin `next/*`/server-only).
- [x] 2.4 Tests del package (edición de madre, borrado de madre con sus hijas).
- [x] 2.5 Rewire de los server actions web a shells (conservando `revalidatePath('/transactions')`/`/cards'`/`/shared'` según corresponda).

## 3. `payCardPeriod` (+ reversa)

- [x] 3.1 Extraer `payCardPeriod` entera a `@grana/cards` (legs de pago, marca de período pagado, USD subordinado, e **impuesto de sellos**: validar `stamp_tax_amount`, insertar el movimiento `stamp_tax`, persistir `stamp_tax_rate` derivado vía `deriveStampTaxRate` de `@grana/money-logic`, con rollback) con `CardMutationResult`; `formError` → `messageKey` (incluye los nuevos literales: `'Período no encontrado.'`, `'No tenés acceso a este período.'`, `'Este período ya fue pagado.'`).
- [x] 3.2 ~~Mover la reversa de pago al package~~ **N/A**: no existe una reversa de pago en la app. Auditado (grep + migraciones): `period_payments.transaction_id` es `ON DELETE RESTRICT`, no hay `.delete()` sobre `period_payments`, ninguna server action de reversa, ni trigger DB que revierta el período. Los resúmenes pagados no son reversibles hoy en el producto (`deleteTransaction` es genérico y no toca `period_payments`). No hay código que mover; agregar una reversa sería feature nuevo, fuera del alcance de esta extracción. Sólo viaja el rollback interno de fallo parcial de `payCardPeriod` (cubierto en 3.1).
- [x] 3.3 Tests del package: pago simple, guard de USD sin cotización, pago con sello (derivación + persistencia de `stamp_tax_rate`, y no-sobrescritura de una tasa ya recordada). (Reversa: N/A — ver 3.2.)
- [x] 3.4 Rewire del server action web `payCardPeriod` a shell fino; conservar `revalidatePath('/cards')`/`/transactions'`.

## 4. Archive/reactivate vía `@grana/accounts`

- [x] 4.1 Rewire `deactivateCreditCardAccount`: delegar en `@grana/accounts.archiveAccount` (que ya aplica el guard R-tarjeta), conservando `revalidatePath('/cards')`/`/accounts'`; eliminar el guard de deuda duplicado del action.
- [x] 4.2 Verificar que la reactivación de tarjeta usa `@grana/accounts.reactivateAccount`; sin mutación de archive de tarjeta paralela.

## 5. i18n + cierre

- [x] 5.1 Agregar al catálogo web (next-intl) las entradas `cards.errors.*` con el MISMO texto castellano que devolvían los `formError` literales (anti-regresión).
- [x] 5.2 Smoke web de cada flujo: pago de resumen + reversa, edición de fechas de ciclo, edición de tarjeta, edición/borrado de cuotas, y archive con deuda pendiente (bloqueo) y sin deuda (ok).
- [x] 5.3 Typecheck + lint + tests verdes en `@grana/cards`, `@grana/accounts` (si tocado) y web; confirmar que `@grana/cards` sigue isomórfico (build mobile/Hermes sin server-only).
- [x] 5.4 Verificar que `registerCardPurchase`/`registerInstallments` no se tocaron (ya compartidas) y que no quedó ningún `formError` literal en las mutaciones rewireadas.
