## Why

El alta de tarjeta no existe en mobile: el CTA "Agregar tarjeta" del header de `/cards` se renderiza como **placeholder disabled** a la espera de un flujo de creación nativo (ver `cards` spec, línea 208 y comentario en `CardsHeader.tsx`). La causa raíz es de arquitectura: a diferencia de cuentas, las mutaciones de tarjeta no están extraídas a un paquete compartido — `createCreditCard` vive entera como server action de web (`apps/web/app/_actions/credit-cards.ts`), con inserts directos a Supabase. Mobile no tiene de dónde consumir la lógica de creación. Cerramos el gap replicando el patrón ya probado en cuentas (`extract-accounts-data-layer` + `accounts-mutations-neutral-errors`).

## What Changes

- **Extraer `createCreditCard` a `@grana/cards`** como mutación compartida con contrato de resultado neutral (`CardMutationResult`, espejo de `AccountMutationResult`): recibe `{ supabase, userId, input, today }`, valida con `createCreditCardSchema`, hace los 3 inserts (account `type=credit` → `account_currencies` → 2 `card_periods`: P1 real + P2 estimado), deriva el nombre auto y revierte en fallo parcial. La proyección de fechas ya es compartida (`@grana/money-logic`).
- **Rewire de web a thin shell**: el server action `createCreditCard` pasa a delegar en la mutación de `@grana/cards`, mapeando el resultado neutral con `translatePostgresError` y conservando `revalidatePath`. Sin cambio de comportamiento observable en web.
- **Consumer mobile** (paridad solo del alta):
  - `apps/mobile/lib/cards/mutations.ts`: wrapper fino que resuelve `userId`, inyecta `today`, llama la misma mutación, mapea el resultado neutral a `ActionResult` nativo (`errorKey` como catalog path) e invalida las query keys de cards.
  - `CreateCardForm` nativo (idiomático RN, mismos nombres/props públicas que web): selector de institución (`BankSelector`), red XOR nombre custom, monedas (ARS obligatoria + USD opcional), límite opcional, y las dos fechas (cierre + vencimiento del resumen actual) con datepicker nativo.
  - Ruta `apps/mobile/app/(app)/cards/new.tsx` (gemela de `accounts/new.tsx`) + opener desde el header.
  - Reemplazar el `AddCardPlaceholder` disabled de `CardsHeader.tsx` por el CTA real.
- **No incluye** (fuera de scope, paridad completa de cards queda para changes futuros): detalle de tarjeta, edición, archivar/reactivar, pago de resumen, registro de consumos/cuotas en mobile.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `cards`: el CTA "Agregar tarjeta" en mobile deja de ser placeholder disabled y abre el flujo de alta nativo; el requirement de alta de tarjeta pasa a ser cross-platform (web + mobile) con presentación idiomática por plataforma y lógica de creación compartida en `@grana/cards`.

## Impact

- **Paquetes**: `@grana/cards` gana `src/mutations.ts` (export `createCreditCard`, `type CardMutationResult`) y un `index.ts` ampliado. Dependencias ya presentes (`@grana/validation`, `@grana/supabase`, `@grana/money-logic`).
- **Web**: `apps/web/app/_actions/credit-cards.ts` → `createCreditCard` adelgaza a shell; el resto del action (pago, consumos, cuotas) sin tocar. `cards/new/page.tsx` y `create-card-form.tsx` sin cambios funcionales.
- **Mobile**: nuevos `lib/cards/mutations.ts`, `lib/cards/invalidation.ts` (o reuso de query-keys), `components/cards/CreateCardForm.tsx`, `app/(app)/cards/new.tsx`; edición de `components/cards/CardsHeader.tsx` y promoción de `cards.tsx` a carpeta de ruta si hace falta para anidar `new`.
- **i18n**: catálogo de errores de alta de tarjeta para mobile (`cards.errors.*`) resoluble con `useT`.
- **Diseño**: handoff HTML bajo `docs/design/cards-new/` (web + web-mobile + nativo) antes de spec/implementación, por la convención de design refs.
- **Specs**: delta de `cards` (requirements de wallet/header y de alta de tarjeta).
