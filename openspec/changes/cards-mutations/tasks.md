## 1. Mutaciones chicas a `@grana/cards`

- [ ] 1.1 Extraer `updateCreditCard` a `@grana/cards` (`{ supabase, userId, input, today }` → `CardMutationResult`), validando con su schema de `@grana/validation`; `formError` literales → `messageKey` (`cards.errors.*`).
- [ ] 1.2 Extraer `updatePeriodDates` a `@grana/cards` con el mismo contrato; mover el sanity check de fechas dentro de la mutación.
- [ ] 1.3 Tests del package para ambas (éxito + casos de error mapeados a `messageKey`/`errorCode`).
- [ ] 1.4 Rewire de los server actions web `updateCreditCard`/`updatePeriodDates` a shells finos (auth + client + mutación + map + `revalidatePath`).

## 2. Ediciones de cuotas (madre/hija)

- [ ] 2.1 Extraer `updateInstallmentParent` a `@grana/cards`, componiendo los internals madre/hija de `@grana/transactions-mutations` (no duplicarlos); `CardMutationResult`.
- [ ] 2.2 Extraer `deleteInstallmentParent` a `@grana/cards` con el mismo contrato.
- [ ] 2.3 Verificar/añadir `@grana/transactions-mutations` como dependencia runtime de `packages/cards/package.json` (hoy type-only); confirmar que sigue isomórfico (sin `next/*`/server-only).
- [ ] 2.4 Tests del package (edición de madre, borrado de madre con sus hijas).
- [ ] 2.5 Rewire de los server actions web a shells (conservando `revalidatePath('/transactions')`/`/cards'`/`/shared'` según corresponda).

## 3. `payCardPeriod` (+ reversa)

- [ ] 3.1 Extraer `payCardPeriod` entera a `@grana/cards` (legs de pago, marca de período pagado, USD subordinado, e **impuesto de sellos**: validar `stamp_tax_amount`, insertar el movimiento `stamp_tax`, persistir `stamp_tax_rate` derivado vía `deriveStampTaxRate` de `@grana/money-logic`, con rollback) con `CardMutationResult`; `formError` → `messageKey` (incluye los nuevos literales: `'Período no encontrado.'`, `'No tenés acceso a este período.'`, `'Este período ya fue pagado.'`).
- [ ] 3.2 Mover la reversa de pago al package junto con `payCardPeriod`.
- [ ] 3.3 Tests del package: pago simple, pago con USD subordinado, pago con sello (derivación + persistencia de `stamp_tax_rate`), y reversa.
- [ ] 3.4 Rewire del server action web `payCardPeriod` (+ reversa) a shell fino; conservar `revalidatePath('/cards')`/`/transactions'`.

## 4. Archive/reactivate vía `@grana/accounts`

- [ ] 4.1 Rewire `deactivateCreditCardAccount`: delegar en `@grana/accounts.archiveAccount` (que ya aplica el guard R-tarjeta), conservando `revalidatePath('/cards')`/`/accounts'`; eliminar el guard de deuda duplicado del action.
- [ ] 4.2 Verificar que la reactivación de tarjeta usa `@grana/accounts.reactivateAccount`; sin mutación de archive de tarjeta paralela.

## 5. i18n + cierre

- [ ] 5.1 Agregar al catálogo web (next-intl) las entradas `cards.errors.*` con el MISMO texto castellano que devolvían los `formError` literales (anti-regresión).
- [ ] 5.2 Smoke web de cada flujo: pago de resumen + reversa, edición de fechas de ciclo, edición de tarjeta, edición/borrado de cuotas, y archive con deuda pendiente (bloqueo) y sin deuda (ok).
- [ ] 5.3 Typecheck + lint + tests verdes en `@grana/cards`, `@grana/accounts` (si tocado) y web; confirmar que `@grana/cards` sigue isomórfico (build mobile/Hermes sin server-only).
- [ ] 5.4 Verificar que `registerCardPurchase`/`registerInstallments` no se tocaron (ya compartidas) y que no quedó ningún `formError` literal en las mutaciones rewireadas.
