## Why

Sólo `createCreditCard` está extraída a `@grana/cards` con contrato neutral; el resto de las mutaciones de tarjeta viven enteras como server actions de web (`apps/web/app/_actions/credit-cards.ts`), con inserts/updates directos a Supabase y **texto de error pre-traducido en castellano** (`formError` literal). Cuando la ruta mobile de detalle de tarjeta necesite pagar un resumen, editar fechas de ciclo, editar la tarjeta o gestionar cuotas en curso, no tiene de dónde consumir esa lógica — el mismo gap que `add-card-flow-mobile` ya cerró para el alta. Slice 3 de 3: replica ese patrón probado para las mutaciones restantes.

Dos hallazgos acotan el alcance real:
- `registerCardPurchase` y `registerInstallments` **ya son shells finos** sobre `@grana/transactions-mutations` — ya están compartidas, no se tocan.
- `deactivateCreditCardAccount` es **redundante**: `@grana/accounts.archiveAccount` ya aplica el guard R-tarjeta (sin deuda pendiente) para `type === 'credit'` y `reactivateAccount` ya existe. No hay que extraer nada — se rewirea a la mutación de accounts existente (una tarjeta ES una cuenta).

## What Changes

- **Extraer 5 mutaciones a `@grana/cards`** con contrato neutral `CardMutationResult` (espejo de `createCreditCard`), recibiendo `{ supabase, userId, input, today }` y devolviendo `{ ok, id? } | { ok:false, fieldErrors? | messageKey? | errorCode? }`:
  - `payCardPeriod` (pago de resumen, incluida la reversa de pago y el **impuesto de sellos** por resumen incorporado en main: valida `stamp_tax_amount`, inserta el movimiento de sello y persiste `stamp_tax_rate` con rollback, componiendo los helpers puros ya compartidos de `@grana/money-logic` — `deriveStampTaxRate`, `suggestStampTaxAmount`, `COMMON_STAMP_TAX_RATES` — sin duplicarlos)
  - `updatePeriodDates` (edición de fechas de ciclo)
  - `updateCreditCard` (edición de nombre/institución/límite)
  - `updateInstallmentParent` (edición de la madre de cuotas)
  - `deleteInstallmentParent` (borrado de la madre de cuotas)
- **Migrar los errores literales a `messageKey`**: los `formError` en castellano de hoy (p. ej. `'Tarjeta no encontrada.'`) pasan a `messageKey` neutral (`cards.errors.*`); ambos consumers agregan la entrada con el mismo texto. El paquete nunca traduce.
- **Rewire web a shells finos**: cada server action de `credit-cards.ts` delega en la mutación de `@grana/cards`, mapea el resultado neutral con `translatePostgresError`/`next-intl` y conserva sus `revalidatePath`. Sin cambio de comportamiento observable.
- **Archive/reactivate de tarjeta vía `@grana/accounts`**: `deactivateCreditCardAccount` deja de duplicar el guard de deuda y delega en `@grana/accounts.archiveAccount`; la reactivación usa `reactivateAccount`. (La UI de cards puede incluso llamar directo a las actions de accounts; a decidir en design.)
- **No incluye consumer mobile de estas mutaciones**: como en `add-card-flow-mobile`, la capa compartida queda lista; los wrappers `apps/mobile/lib/cards/mutations.ts` + las pantallas nativas (pago, edición, cuotas) son el change follow-up junto con la ruta de detalle.

Refactor behavior-preserving en web: verificado con typecheck + lint + tests + smoke de cada flujo de mutación.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `cards`: el patrón de mutación compartida + contrato neutral (hoy codificado sólo para el alta) se generaliza a **todas las mutaciones de tarjeta** (pago de resumen, edición de fechas de ciclo, edición de tarjeta, edición/borrado de la madre de cuotas): viven en `@grana/cards` con `CardMutationResult`, web/mobile son shells finos que divergen sólo en resolución de `userId`, mapeo de error (web `next-intl`/`translatePostgresError`, mobile `useT`) e invalidación/revalidación; el paquete no traduce. El archive/reactivate de una tarjeta se realiza vía las mutaciones de `@grana/accounts` (`archiveAccount`/`reactivateAccount`), que ya aplican el guard R-tarjeta.

## Impact

- **Paquetes**: `@grana/cards` gana en `src/mutations.ts` (o módulos `mutations/*`) las 5 mutaciones + sus `*Input` schemas (de `@grana/validation`) + tests. Las ediciones de la madre de cuotas componen los internals de la madre/hija de `@grana/transactions-mutations` (no los duplican).
- **Web**: `apps/web/app/_actions/credit-cards.ts` adelgaza — cada action pasa a shell; `deactivateCreditCardAccount` delega en `@grana/accounts.archiveAccount`. Sin cambio funcional en `/cards/[id]` ni en `pay`/`edit`/`periods`.
- **i18n**: nuevas entradas `cards.errors.*` en el catálogo web (next-intl) con el MISMO texto castellano actual (anti-regresión del mensaje de error).
- **Mobile**: sin cambios en este change (la capa queda lista). Comentarios "keep in sync" de mutaciones, si los hubiera, se eliminan cuando aterrice el consumer.
- **Specs**: delta de `cards` (mutaciones de tarjeta con contrato neutral + archive vía accounts).
- **Dependencias entre changes**: independiente de Slice 1 y Slice 2 a nivel de código (toca el write path, no el read/VM), pero se ordena después por coherencia narrativa. El consumer mobile de mutaciones es follow-up (junto con la ruta de detalle de Slice 2).
- **Posible split**: si el review lo pide, las ediciones de cuotas (`updateInstallmentParent`/`deleteInstallmentParent`) pueden ir a `@grana/transactions-mutations` (junto a `register-installments`) en vez de `@grana/cards`; default propuesto: `@grana/cards` como hogar único de "mutaciones de tarjeta".
