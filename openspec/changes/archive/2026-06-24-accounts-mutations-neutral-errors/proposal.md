## Why

Las mutations de `@grana/accounts` prometen un `AccountMutationResult` "neutro" para que cada plataforma traduzca, pero el contrato está a medias: `errorCode` (código PG crudo) sí es neutro, pero `formError` es un **grab-bag** — mezcla literales en español hardcodeados (`'Esta cuenta tiene movimientos. Archivala para preservar el historial.'`, `'Debe quedar al menos una moneda activa.'`, `'Cuenta no encontrada.'`), el mensaje crudo de Postgres (`error.message`) y un slug estructurado (`'pending_debt'`). El wrapper web `finish()` muestra `formError` tal cual; funciona porque la app es es-first.

Esto bloquea el espejo de cuentas en mobile: el consumer mobile no puede traducir esos `formError` a su propio i18n (`useT`) — solo puede mostrarlos verbatim, heredando español hardcodeado desde un paquete que debería ser agnóstico de plataforma. Y contradice el principio explícito de la extracción: *"el paquete devuelve `errorCode` por diseño precisamente para que cada plataforma sea dueña de su traducción"*.

El descubrimiento que hace esto barato: el catálogo `accounts.errors` en `@grana/i18n-messages` **ya contiene** los slugs que el paquete está esquivando (`delete_has_transactions`, `deactivate_last_currency`, `deactivate_non_zero_balance`, `create_failed`, `generic`, …). El paquete simplemente hardcodeó el string en lugar de devolver la key. Esta change hace que el paquete devuelva las keys que ya existen, y que ambas plataformas las resuelvan contra el catálogo compartido.

Es la **primera de tres** changes secuenciadas (`accounts-mutations-neutral-errors` → `transactions-read-slice` → `mobile-accounts-route`). Va primero porque es chica, autocontenida y un refactor puro del lado web (mismo output), y deja el contrato de error limpio antes de que nazca el mutator mobile.

## What Changes

- **`@grana/accounts` (`src/mutations.ts`)** — `AccountMutationResult` reemplaza el campo libre `formError?: string` por `messageKey?: string`, donde `messageKey` es un **path completo del catálogo** `@grana/i18n-messages` (p. ej. `'accounts.errors.deactivate_last_currency'`). Se conservan `errorCode?` (código PG, para el mapeo `23505 → duplicate`), `reason?` (slug estructurado que dispara UX, p. ej. `pending_debt`) y `fieldErrors?`.
  - Los ~9 sitios que hoy devuelven literal español → devuelven el `messageKey` correspondiente (la mayoría ya tienen slug en el catálogo).
  - Los sitios que devuelven `error.message` crudo → devuelven el `messageKey` genérico del caso (`create_failed` / `delete_failed` / `save_failed` / `generic`).
- **`@grana/i18n-messages` (`es.json` + `en.json`)** — agregar las 3 keys faltantes bajo `accounts.errors`: `account_not_found`, `currency_not_found`, `pending_debt`. (Las demás ya existen.)
- **`apps/web/app/_actions/accounts.ts` (`finish()`)** — resuelve `messageKey` vía next-intl (`getTranslations()` por path completo) en lugar de mostrarlo verbatim; sigue traduciendo `errorCode` vía `translatePostgresError`. **Output idéntico**: los mismos strings en español renderizan, porque cada `messageKey` apunta al string que antes estaba hardcodeado.
- **Sin cambios de comportamiento web.** Refactor puro: misma UX, mismos mensajes, mismos `reason` slugs, misma `revalidatePath`.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva. -->

### Modified Capabilities
- `web-data-access`: se afina el contrato del `AccountMutationResult` de `@grana/accounts` — los mensajes de error de dominio SHALL ser `messageKey` neutros (paths del catálogo compartido), no literales pre-traducidos ni `error.message` crudo, para que cada plataforma (web vía next-intl, mobile vía `useT`) traduzca contra `@grana/i18n-messages`.

## Impact

- **Código (paquete):** `packages/accounts/src/mutations.ts` (tipo `AccountMutationResult` + ~12 return sites), `src/index.ts` si cambia el tipo exportado.
- **Código (i18n):** `packages/i18n-messages/src/{es,en}.json` (+3 keys × 2 locales).
- **Código (web, thin):** `apps/web/app/_actions/accounts.ts` (`finish()` mapea `messageKey` → next-intl).
- **Sin cambios de datos/API/RLS.** Sin cambios visibles en web.
- **Prep mobile:** deja el contrato listo para que el mutator mobile de la change `mobile-accounts-route` resuelva `messageKey` + `errorCode` con `useT`, sin hacks de "mostrar formError verbatim".
- **Detalle a confirmar en apply (ver design):** si `fieldErrors` también arrastra strings localizados (vía `@grana/validation` / yup); si así fuera, alcance posible de la misma técnica o se difiere.
- **Riesgos:** bajo. Refactor puro con anchor de verificación fuerte (output web byte-idéntico). Los tests de cuentas + typecheck + paridad de catálogos i18n cubren la equivalencia.
