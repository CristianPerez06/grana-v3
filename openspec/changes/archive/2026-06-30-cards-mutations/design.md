## Context

`apps/web/app/_actions/credit-cards.ts` aloja las mutaciones de tarjeta como server actions con lógica inline y `formError` en castellano. `createCreditCard` ya fue extraída a `@grana/cards` con `CardMutationResult` (change `add-card-flow-mobile`), estableciendo el patrón: paquete neutral + shell web que traduce/revalida + shell mobile que mapea `errorKey`/invalida. Esta Slice generaliza ese patrón a las mutaciones restantes.

Inventario real (auditado):
- **Ya compartidas (no se tocan):** `registerCardPurchase`, `registerInstallments` — ya son shells finos sobre orquestadores de `@grana/transactions-mutations`.
- **Redundante (sólo rewire):** `deactivateCreditCardAccount` — `@grana/accounts.archiveAccount` ya aplica el guard R-tarjeta para `type === 'credit'`; `reactivateAccount` ya existe.
- **A extraer (5):** `payCardPeriod` (+ reversa), `updatePeriodDates`, `updateCreditCard`, `updateInstallmentParent`, `deleteInstallmentParent`.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad para las 5 mutaciones, en `@grana/cards`, con `CardMutationResult` neutral.
- Migrar los `formError` literales a `messageKey` (`cards.errors.*`), texto idéntico al actual.
- Web sin cambio de comportamiento observable: cada action a shell fino.
- Archive/reactivate de tarjeta vía `@grana/accounts`, sin guard duplicado.

**Non-Goals:**
- Consumer mobile de estas mutaciones (wrappers `lib/cards/mutations.ts` + pantallas de pago/edición/cuotas): change follow-up, junto con la ruta de detalle.
- Re-extraer `registerCardPurchase`/`registerInstallments` (ya compartidas).
- Cambiar reglas de negocio (guard de deuda, asignación de período, patrón madre/hija): se mueven tal cual.

## Decisions

### D1 — Hogar: `@grana/cards` como package de "mutaciones de tarjeta"
Las 5 van a `@grana/cards` (`src/mutations.ts` o `src/mutations/<name>.ts`), siguiendo el precedente `createCreditCard`. Las ediciones de la madre de cuotas (`updateInstallmentParent`/`deleteInstallmentParent`) **componen** los internals madre/hija de `@grana/transactions-mutations` en vez de duplicarlos. Alternativa considerada: poner esas dos en `@grana/transactions-mutations` (junto a `register-installments`). Se prefiere `@grana/cards` por hogar único y por ser invocadas desde la superficie de cards; se deja como split opcional si el review lo pide. `@grana/cards` ya depende de `@grana/transactions-mutations` (type-only hoy; pasaría a runtime para componer internals — sigue siendo isomórfico).

### D2 — Contrato neutral `CardMutationResult`, idéntico al del alta
Firma `mutX({ supabase, userId, input, today }): Promise<CardMutationResult<XInput>>`. Sin `getTodayAR()` interno, sin creación de client, sin `next/*`. Reusa el tipo `CardMutationResult` ya exportado por el package.

### D3 — `formError` literal → `messageKey` (igual que add-card D3)
Cada string castellano de hoy (`'Tarjeta no encontrada.'`, `'Esta acción solo aplica a tarjetas de crédito.'`, `'pending_debt'`, etc.) se mapea a una key `cards.errors.*`. El shell web resuelve con `next-intl`/`translatePostgresError`; se agrega la entrada al catálogo web con el MISMO texto (anti-regresión). Las keys quedan listas para que el consumer mobile las resuelva con `useT` sin reimplementar el mensaje.

### D4 — Web shell conserva traducción + revalidación, firma pública intacta
Cada server action queda como: `auth → createClient → mutación @grana/cards → map neutral → revalidatePath(...)`. Los call sites de los formularios (`pay-card-period-form`, `edit-dates-sheet`, `edit-card-form`, paneles de cuotas) no cambian de interfaz. `deactivateCreditCardAccount` se convierte en shell sobre `@grana/accounts.archiveAccount` (o se reapunta la UI a la action de archive de cuentas — decisión menor, se elige lo que menos churn de UI genere).

### D5 — `payCardPeriod` es la pieza grande; tests de pago + sello
`payCardPeriod` (legs de pago, marca de período pagado, manejo USD subordinado, confirmación del ciclo en curso, y el **impuesto de sellos** por resumen) es la mutación de mayor riesgo. Se mueve entera con su rollback interno de fallo parcial y viaja con tests que cubren los guards + mapeo a `messageKey`, el pago simple ARS, el guard de USD sin cotización, y el sello (derivación + persistencia de `stamp_tax_rate` + no-sobrescritura).

**Hallazgo de implementación — no existe una "reversa de pago" en la app.** El plan asumía una reversa a mover junto con `payCardPeriod`. Auditado (grep exhaustivo + migraciones): `period_payments.transaction_id` es `ON DELETE RESTRICT`, no hay ningún `.delete()` sobre `period_payments`, ninguna server action de reversa, ni un trigger DB que revierta el período al borrar el gasto de pago. `deleteTransaction` es genérico y no toca `period_payments`. Es decir: **los resúmenes pagados no son reversibles hoy en el producto**. No hay código que extraer; agregar una reversa sería feature nuevo (fuera del alcance de esta extracción). Sólo viaja el rollback interno de fallo parcial. Los tests de reversa quedan N/A.

### D6 — Impuesto de sellos: composición, no reimplementación (incorporado en main)
El feature `impuesto de sellos automático por resumen` (mergeado en main) ya dejó la **matemática pura del sello en `@grana/money-logic`** (`deriveStampTaxRate`, `suggestStampTaxAmount`, `COMMON_STAMP_TAX_RATES`) y el campo `stamp_tax_amount` en `payCardPeriodSchema` (`@grana/validation`). Por eso la extracción de `payCardPeriod` a `@grana/cards` **compone** esos helpers y ese schema; el efecto de sello (insertar el movimiento `stamp_tax`, congelar la base ARS antes del insert, persistir `stamp_tax_rate` derivado, y revertir el insert en fallo parcial) viaja dentro de la mutación. El redesign de la pantalla de pago (también en main: `pay-card-period-form.tsx` + `debit-account-select.tsx`, y la reestructura de la ruta en grupo `(overview)`) es **JSX/shell que queda en web**; sólo cambia el `input` que el shell arma y pasa a la mutación, no el contrato de extracción.

## Risks / Trade-offs

- **`payCardPeriod` es lógica financiera crítica (legs de pago, reversa)** → Mitigación: mover sin reescribir; tests del package (pago simple / USD subordinado / reversa) + smoke del flujo `/cards/[id]/periods/[periodId]/pay` y de la reversa en web.
- **Migración literal→messageKey cambia la fuente del texto de error en web** → Mitigación: agregar las entradas `cards.errors.*` con el MISMO castellano; verificar visualmente cada error (tarjeta no encontrada, no-credit, deuda pendiente, fallos de Postgres).
- **`@grana/cards` pasa a depender runtime de `@grana/transactions-mutations`** (para componer internals de cuotas) → Mitigación: es un import de funciones puras/orquestadoras que ya reciben el client; no arrastra `next/*` ni server-only; el build de mobile (Hermes) lo valida.
- **Doble fuente de archive (action de cards vs action de accounts)** → Mitigación: este change elimina la lógica duplicada; `deactivateCreditCardAccount` queda como shell o se retira a favor de la action de accounts.

## Migration Plan

Sin migración de datos. Orden seguro: (1) extraer `updateCreditCard` y `updatePeriodDates` (las más chicas) con tests y rewire de sus shells web; (2) extraer `updateInstallmentParent`/`deleteInstallmentParent` componiendo internals de cuotas; (3) extraer `payCardPeriod` + reversa con tests; (4) rewire `deactivateCreditCardAccount` a `@grana/accounts.archiveAccount`; (5) agregar catálogo `cards.errors.*` web y verificar cada flujo. Tras cada paso: typecheck + lint + tests + smoke del flujo tocado. Rollback = revertir el commit.

## Open Questions

- ¿`deactivateCreditCardAccount` se conserva como shell sobre `archiveAccount` o se retira reapuntando la UI de cards (`CardActions`, `deactivate-block-dialog`) a la action de archive de cuentas? Propuesta: conservar el shell para no tocar la UI; evaluar el reapunte si simplifica.
- ¿Las ediciones de cuotas se quedan en `@grana/cards` o se mueven a `@grana/transactions-mutations`? Default: `@grana/cards` componiendo internals; abierto a split si el review prioriza cohesión con `register-installments`.
