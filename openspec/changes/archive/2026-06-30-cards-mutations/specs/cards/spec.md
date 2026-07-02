## ADDED Requirements

### Requirement: Las mutaciones de tarjeta viven en `@grana/cards` con contrato neutral; web y mobile son shells

Toda mutación de tarjeta —no sólo el alta— SHALL ejecutar una **única lógica compartida** expuesta en `@grana/cards`, recibiendo `{ supabase, userId, input, today }`, validando con su schema de `@grana/validation` cuando aplique, y devolviendo un resultado neutral `CardMutationResult` (`{ ok: true, id? }` o `{ ok: false, fieldErrors? | messageKey? | errorCode? }`). Esto cubre al menos: pago de resumen (`payCardPeriod`, con su rollback interno de fallo parcial), edición de fechas de ciclo (`updatePeriodDates`), edición de la tarjeta (`updateCreditCard`), y edición/borrado de la madre de cuotas (`updateInstallmentParent`, `deleteInstallmentParent`).

El paquete NO SHALL traducir texto ni devolver mensajes pre-traducidos: cada consumer resuelve el mensaje con su helper de i18n (`next-intl`/`translatePostgresError` en web, `useT` en mobile) a partir de `messageKey`/`errorCode`/`fieldErrors`. Los `formError` literales en castellano de las server actions previas SHALL migrarse a `messageKey` (`cards.errors.*`), agregando la entrada de catálogo con el MISMO texto en ambas plataformas.

El server action de web y el wrapper `lib/cards/mutations.ts` de mobile SHALL ser shells finos sobre esas mutaciones, divergiendo sólo en: resolución de `userId`, mapeo del resultado neutral a su `ActionResult`, e invalidación/revalidación de caché (web `revalidatePath`, mobile invalidación de query keys). Las mutaciones SHALL componer los internals compartidos que ya existan (p. ej. el patrón madre/hija de cuotas en `@grana/transactions-mutations`) en vez de duplicarlos. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`.

#### Scenario: Una mutación de tarjeta corre la misma lógica en web y mobile

- **WHEN** un consumer (web o mobile) paga un resumen, edita las fechas del ciclo, edita la tarjeta o edita/borra la madre de cuotas
- **THEN** invoca la mutación compartida de `@grana/cards` con su propio client, el `userId` autenticado y `today`
- **AND** recibe un `CardMutationResult` neutral, sin texto pre-traducido por el paquete

#### Scenario: El error neutral se resuelve en cada plataforma

- **WHEN** una mutación de tarjeta falla con `messageKey` (p. ej. `cards.errors.pending_debt`) o `errorCode`
- **THEN** web resuelve el texto con `next-intl`/`translatePostgresError` desde el shell del server action
- **AND** mobile resuelve el texto con `useT` desde `lib/cards/mutations.ts`
- **AND** ninguna plataforma lee un string en castellano devuelto por `@grana/cards`

#### Scenario: El shell web conserva la revalidación

- **WHEN** una mutación de tarjeta tiene éxito desde un server action de web
- **THEN** el shell invoca los `revalidatePath` que esa action invocaba antes (`/cards`, `/transactions`, `/shared` según corresponda)
- **AND** el comportamiento observable de las vistas de `/cards` no cambia

### Requirement: El archive y la reactivación de una tarjeta se realizan vía las mutaciones de cuentas

Como una tarjeta de crédito ES una cuenta (`accounts.type = 'credit'`), su archive y reactivación SHALL realizarse mediante las mutaciones compartidas de `@grana/accounts` (`archiveAccount` / `reactivateAccount`), que ya aplican el guard R-tarjeta (bloqueo si hay deuda pendiente) cuando `type === 'credit'`. NO SHALL existir una mutación de archive de tarjeta paralela que duplique ese guard. El server action de web que hoy desactiva la tarjeta SHALL delegar en `archiveAccount` (o la UI de cards SHALL invocar directamente la action de archive de cuentas), conservando su revalidación.

#### Scenario: Archivar una tarjeta con deuda pendiente se bloquea

- **WHEN** un consumer intenta archivar una tarjeta que tiene deuda pendiente
- **THEN** la operación pasa por `@grana/accounts.archiveAccount`, que detecta la deuda vía `getCreditCardDebtCheck`
- **AND** devuelve un resultado neutral con `messageKey`/`reason` de deuda pendiente, sin desactivar la tarjeta

#### Scenario: No existe una mutación de archive de tarjeta duplicada

- **WHEN** se revisa el write path de tarjetas tras este change
- **THEN** no hay una mutación de archive específica de tarjeta que reimplemente el guard de deuda
- **AND** el archive/reactivate de tarjeta resuelve en `@grana/accounts`
