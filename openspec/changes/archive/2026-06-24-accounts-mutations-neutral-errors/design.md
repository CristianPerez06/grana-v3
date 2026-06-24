## Contexto

Primera de tres changes hacia el espejo de cuentas en mobile. Esta deja el contrato de error de `@grana/accounts` limpio (neutro de plataforma) antes de que exista el consumer mobile. Las otras dos (`transactions-read-slice`, `mobile-accounts-route`) la siguen.

## El problema concreto: `formError` no es neutro

Inventario real de los return sites de `packages/accounts/src/mutations.ts` (hoy):

| Sitio | Hoy devuelve | Tipo | Destino (messageKey) | ¿Key existe? |
|---|---|---|---|---|
| createAccount (account insert falla) | `formError: error.message ?? 'Failed to create account'` | DB crudo | `accounts.errors.create_failed` | ✅ |
| createAccount (currency insert falla) | `formError: currencyError.message` | DB crudo | `accounts.errors.create_failed` | ✅ |
| archiveAccount (deuda de tarjeta) | `formError: 'pending_debt'` + `reason: 'pending_debt'` | slug | `accounts.errors.pending_debt` + conserva `reason` | ❌ nueva |
| deleteAccount (check tx falla) | `formError: txError.message` | DB crudo | `accounts.errors.delete_failed` | ✅ |
| deleteAccount (tiene movimientos) | `formError: 'Esta cuenta tiene movimientos…'` | literal es | `accounts.errors.delete_has_transactions` | ✅ |
| updateAccount (no encontrada) | `formError: 'Cuenta no encontrada.'` | literal es | `accounts.errors.account_not_found` | ❌ nueva |
| addCurrency / deactivate (no encontrada) | `formError: 'Cuenta no encontrada.'` | literal es | `accounts.errors.account_not_found` | ❌ nueva |
| deactivateCurrency (fetch falla) | `formError: fetchError.message` | DB crudo | `accounts.errors.save_failed` | ✅ |
| deactivateCurrency (última moneda) | `formError: 'Debe quedar al menos una moneda activa.'` | literal es | `accounts.errors.deactivate_last_currency` | ✅ |
| deactivateCurrency (moneda no existe) | `formError: 'Moneda no encontrada en la cuenta.'` | literal es | `accounts.errors.currency_not_found` | ❌ nueva |
| deactivateCurrency (saldo ≠ 0) | `formError: 'No podés desactivar una moneda…'` | literal es | `accounts.errors.deactivate_non_zero_balance` | ✅ |
| (varios PG) | `errorCode: error.code` | código PG | — (sin cambio) | — |

El catálogo `accounts.errors` ya cubre casi todo: el paquete eligió hardcodear el string en vez de devolver la key. Solo faltan 3 keys nuevas.

## El nuevo contrato

```
type AccountMutationResult<T = never> =
  | { ok: true; id?: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      messageKey?: string   // ← reemplaza formError. Path completo del catálogo.
      errorCode?: string    // código PG crudo (sin cambio)
      reason?: string       // slug estructurado que dispara UX (sin cambio)
    }
```

```
        @grana/accounts mutation
        devuelve { ok:false, messageKey?, errorCode?, reason? }
                 │
      ┌──────────┴───────────┐
      ▼                      ▼
   WEB finish()          MOBILE mutator (change #3)
   messageKey            messageKey
     ? t(messageKey)       ? t(messageKey)   (useT, mismo path)
   errorCode             errorCode
     ? translatePg(code)   ? mapCode→t(...)
                 │
                 ▼
        @grana/i18n-messages  (un catálogo, dos motores)
```

## Decisión: `messageKey` es el path completo del catálogo, no una key relativa al namespace

Dos formas de identificar el mensaje:
- **(A) key relativa** (`'deactivate_last_currency'`) + el caller sabe el namespace (`accounts.errors`). Es lo que hace hoy `translatePostgresError` en web (`getTranslations('accounts.errors')` + `t('duplicate')`).
- **(B) path completo** (`'accounts.errors.deactivate_last_currency'`). Es lo que usa mobile (`t('settings.categories.errors.duplicate')`, paths absolutos).

Elegimos **(B)**. El `messageKey` viaja a través del boundary del paquete, que es agnóstico de plataforma; un path absoluto se resuelve idéntico en ambos motores sin que el paquete asuma un namespace. Web resuelve con un translator de nivel raíz (`getTranslations()` sin namespace, luego `t(messageKey)`); mobile con su `translate(locale, messageKey)`. `errorCode` (PG) se mantiene en el flujo namespaced de `translatePostgresError` — es un eje distinto (código de DB, no mensaje de dominio) y no cambia.

## Decisión: `reason` se conserva, `messageKey` se agrega en paralelo

`archiveAccount` con deuda de tarjeta devuelve hoy `formError: 'pending_debt'` **y** `reason: 'pending_debt'`. El `reason` es el slug estructurado que la UX usa para decidir comportamiento (no solo texto). Lo conservamos tal cual y agregamos `messageKey: 'accounts.errors.pending_debt'` para el texto. Separar texto (`messageKey`) de semántica (`reason`) es justamente lo que faltaba.

## Decisión: alcance acotado a accounts

`@grana/transactions-mutations` también usa `formError` libre, pero queda fuera de esta change. El alcance es exactamente el contrato que desbloquea el mutator mobile de cuentas. Si la técnica conviene generalizarla (a transactions-mutations u otros paquetes de datos), es change aditiva posterior — no se fuerza acá.

## Anchor de verificación: output web byte-idéntico

Es un refactor puro. Cada `messageKey` apunta al string que antes estaba hardcodeado (o al `generic`/`*_failed` que ya cubría el caso crudo), así que la UX web renderiza exactamente lo mismo. La verificación es: `pnpm --filter web typecheck` + `lint` + `test`, paridad de catálogos i18n (`es`/`en` cubren las 3 keys nuevas), y un pase manual de los flujos de error (archivar con movimientos, desactivar última moneda, desactivar moneda con saldo).

## Detalle a confirmar en apply: `fieldErrors`

`fieldErrors` (vía `@grana/validation` / yup) podría arrastrar mensajes ya localizados en español. Si así fuera, mobile tendría el mismo problema a nivel de campo. A confirmar en apply: si los `fieldErrors` ya son neutros (keys) o si requieren el mismo tratamiento — en cuyo caso se decide si entra acá o se difiere. No se asume; se inspecciona.
